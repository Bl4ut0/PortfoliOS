import crypto from "node:crypto";
import dgram from "node:dgram";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import WebSocket, { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_CONFIG_PATH = path.join(ROOT_DIR, "relay.config.json");
const AUDIENCE = "portfolios-ut99-relay";
const CONTROL_TYPES = new Set([
  "ut99.relay.open",
  "ut99.relay.close",
  "ut99.relay.ping"
]);

const DEFAULT_CONFIG = {
  listen: { host: "127.0.0.1", port: 8787 },
  allowedOrigins: ["http://localhost:4173"],
  tokenSecretEnv: "UT99_RELAY_TOKEN_SECRET",
  targets: [],
  limits: {
    maxConnectionsPerIp: 4,
    maxSessionsPerMinutePerIp: 10,
    openTimeoutMs: 5000,
    sessionTtlMs: 30 * 60 * 1000,
    idleTimeoutMs: 60 * 1000,
    maxPayloadBytes: 1400,
    clientBytesPerSecond: 64 * 1024,
    serverBytesPerSecond: 128 * 1024
  }
};

function readConfig() {
  const configPath = process.env.UT99_RELAY_CONFIG || DEFAULT_CONFIG_PATH;
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    listen: { ...DEFAULT_CONFIG.listen, ...(parsed.listen || {}) },
    limits: { ...DEFAULT_CONFIG.limits, ...(parsed.limits || {}) }
  };
}

function getSecret(config) {
  const envName = config.tokenSecretEnv || "UT99_RELAY_TOKEN_SECRET";
  const secret = process.env[envName] || "";
  if (secret.length < 32) {
    throw new Error(`${envName} must be set to at least 32 random characters.`);
  }
  return secret;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64url(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function signPayload(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

function verifyToken(token, secret, targetId) {
  if (typeof token !== "string" || !token.includes(".")) {
    throw new Error("Missing relay token.");
  }

  const [body, sig] = token.split(".");
  const expected = base64url(crypto.createHmac("sha256", secret).update(body).digest());
  const provided = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !crypto.timingSafeEqual(provided, wanted)) {
    throw new Error("Invalid relay token signature.");
  }

  const payload = JSON.parse(fromBase64url(body).toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== AUDIENCE) throw new Error("Invalid relay token audience.");
  if (!Number.isFinite(payload.exp) || payload.exp <= now) throw new Error("Relay token is expired.");
  if (!Array.isArray(payload.targets) || !payload.targets.includes(targetId)) {
    throw new Error("Relay token is not scoped to this target.");
  }
  return payload;
}

function parseJsonFrame(data) {
  let text = "";
  if (typeof data === "string") text = data;
  else if (Buffer.isBuffer(data)) text = data.toString("utf8");
  else if (data instanceof ArrayBuffer) text = Buffer.from(data).toString("utf8");
  else return null;

  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed.type !== "string" || !CONTROL_TYPES.has(parsed.type)) {
    throw new Error("Unknown relay control message.");
  }
  return parsed;
}

function normalizeIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

function sameOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  return (allowedOrigins || []).includes(origin);
}

function isPrivateIpLiteral(host) {
  const family = net.isIP(host);
  if (!family) return false;
  if (family === 6) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  }

  const parts = host.split(".").map(Number);
  return parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254);
}

function resolveTarget(config, targetId, requestedPort) {
  const target = (config.targets || []).find((item) => item.id === targetId);
  if (!target) throw new Error("Relay target is not allowlisted.");

  const port = Number(requestedPort || target.ports?.[0]);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("Invalid relay target port.");
  }
  if (!Array.isArray(target.ports) || !target.ports.includes(port)) {
    throw new Error("Relay target port is not allowlisted.");
  }
  if (isPrivateIpLiteral(target.host) && !target.allowPrivate) {
    throw new Error("Private target addresses require allowPrivate=true.");
  }
  return { ...target, port };
}

class TokenBucket {
  constructor(bytesPerSecond) {
    this.capacity = Math.max(1, Number(bytesPerSecond) || 1);
    this.tokens = this.capacity;
    this.refillPerMs = this.capacity / 1000;
    this.updatedAt = Date.now();
  }

  take(size) {
    const now = Date.now();
    const elapsed = now - this.updatedAt;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.updatedAt = now;
    if (size > this.tokens) return false;
    this.tokens -= size;
    return true;
  }
}

function sendControl(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function closeWithReason(ws, code, reason) {
  try {
    sendControl(ws, { type: "ut99.relay.error", reason });
    ws.close(code, reason.slice(0, 120));
  } catch {
    ws.terminate();
  }
}

function makeMetrics() {
  return {
    startedAt: Date.now(),
    accepted: 0,
    rejected: 0,
    active: 0,
    udpInBytes: 0,
    udpOutBytes: 0,
    wsInBytes: 0,
    wsOutBytes: 0
  };
}

function makeIpLimiter(config) {
  const openEventsByIp = new Map();
  const connectionsByIp = new Map();
  const limits = config.limits;

  return {
    canConnect(ip) {
      return (connectionsByIp.get(ip) || 0) < limits.maxConnectionsPerIp;
    },
    addConnection(ip) {
      connectionsByIp.set(ip, (connectionsByIp.get(ip) || 0) + 1);
    },
    removeConnection(ip) {
      const next = Math.max(0, (connectionsByIp.get(ip) || 0) - 1);
      if (next === 0) connectionsByIp.delete(ip);
      else connectionsByIp.set(ip, next);
    },
    canOpen(ip) {
      const now = Date.now();
      const recent = (openEventsByIp.get(ip) || []).filter((stamp) => now - stamp < 60_000);
      if (recent.length >= limits.maxSessionsPerMinutePerIp) {
        openEventsByIp.set(ip, recent);
        return false;
      }
      recent.push(now);
      openEventsByIp.set(ip, recent);
      return true;
    }
  };
}

function startServer(config, secret) {
  const metrics = makeMetrics();
  const ipLimiter = makeIpLimiter(config);
  const limits = config.limits;

  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, active: metrics.active }));
      return;
    }
    if (req.url === "/metrics") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ...metrics, uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000) }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found\n");
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: limits.maxPayloadBytes });

  server.on("upgrade", (req, socket, head) => {
    const ip = normalizeIp(req);
    const origin = req.headers.origin || "";
    if (req.url !== "/v1/ut99/relay") {
      metrics.rejected++;
      socket.destroy();
      return;
    }
    if (!sameOriginAllowed(origin, config.allowedOrigins)) {
      metrics.rejected++;
      socket.destroy();
      return;
    }
    if (!ipLimiter.canConnect(ip)) {
      metrics.rejected++;
      socket.destroy();
      return;
    }

    ipLimiter.addConnection(ip);
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, ip);
    });
  });

  wss.on("connection", (ws, req, ip) => {
    metrics.accepted++;
    metrics.active++;

    let opened = false;
    let udp = null;
    let target = null;
    let tokenPayload = null;
    let cleaned = false;
    let lastActivityAt = Date.now();
    const clientBucket = new TokenBucket(limits.clientBytesPerSecond);
    const serverBucket = new TokenBucket(limits.serverBytesPerSecond);

    const openTimer = setTimeout(() => {
      if (!opened) closeWithReason(ws, 4408, "Relay open timeout.");
    }, limits.openTimeoutMs);

    const ttlTimer = setTimeout(() => {
      closeWithReason(ws, 4408, "Relay session expired.");
    }, limits.sessionTtlMs);

    const idleTimer = setInterval(() => {
      if (Date.now() - lastActivityAt > limits.idleTimeoutMs) {
        closeWithReason(ws, 4408, "Relay session idle timeout.");
      }
    }, Math.min(10_000, limits.idleTimeoutMs));

    function closeUdp() {
      if (!udp) return;
      try {
        udp.close();
      } catch {}
      udp = null;
    }

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(openTimer);
      clearTimeout(ttlTimer);
      clearInterval(idleTimer);
      closeUdp();
      metrics.active = Math.max(0, metrics.active - 1);
      ipLimiter.removeConnection(ip);
    }

    function openRelay(message) {
      if (opened) throw new Error("Relay already opened.");
      if (!ipLimiter.canOpen(ip)) throw new Error("Too many relay sessions from this IP.");

      target = resolveTarget(config, message.targetId, message.port);
      tokenPayload = verifyToken(message.token, secret, target.id);

      udp = dgram.createSocket("udp4");
      udp.on("error", (error) => {
        closeWithReason(ws, 1011, `UDP error: ${error.message}`);
      });
      udp.on("message", (packet) => {
        if (!serverBucket.take(packet.length)) return;
        metrics.udpInBytes += packet.length;
        metrics.wsOutBytes += packet.length;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(packet, { binary: true });
        }
      });
      udp.connect(target.port, target.host, () => {
        opened = true;
        lastActivityAt = Date.now();
        sendControl(ws, {
          type: "ut99.relay.ready",
          targetId: target.id,
          targetLabel: target.label || target.id,
          subject: tokenPayload.sub || "anonymous",
          ttlMs: limits.sessionTtlMs,
          maxPayloadBytes: limits.maxPayloadBytes
        });
      });
    }

    ws.on("message", (data, isBinary) => {
      try {
        lastActivityAt = Date.now();
        const size = Buffer.byteLength(data);
        if (size > limits.maxPayloadBytes) {
          throw new Error("Relay payload exceeds maximum size.");
        }
        if (!clientBucket.take(size)) {
          throw new Error("Relay client rate limit exceeded.");
        }

        if (!opened || !isBinary) {
          const control = parseJsonFrame(data);
          if (control.type === "ut99.relay.open") {
            openRelay(control);
            return;
          }
          if (control.type === "ut99.relay.ping") {
            sendControl(ws, { type: "ut99.relay.pong", now: Date.now() });
            return;
          }
          if (control.type === "ut99.relay.close") {
            ws.close(1000, "closed");
            return;
          }
          return;
        }

        metrics.wsInBytes += size;
        metrics.udpOutBytes += size;
        udp.send(Buffer.from(data));
      } catch (error) {
        closeWithReason(ws, 1008, error.message || "Relay policy violation.");
      }
    });

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });

  server.listen(config.listen.port, config.listen.host, () => {
    console.log(`UT99 relay listening on http://${config.listen.host}:${config.listen.port}`);
    console.log(`Allowed origins: ${(config.allowedOrigins || []).join(", ")}`);
    console.log(`Allowlisted targets: ${(config.targets || []).map((item) => item.id).join(", ") || "(none)"}`);
  });
}

function parseMintArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args.set(key, value);
  }
  return args;
}

function mintToken(config, secret, argv) {
  const args = parseMintArgs(argv);
  const sub = args.get("sub") || "dev";
  const target = args.get("target");
  const ttl = Math.max(30, Number(args.get("ttl") || 600));
  if (!target) {
    throw new Error("Use --target <target-id> when minting a token.");
  }
  if (!(config.targets || []).some((item) => item.id === target)) {
    throw new Error(`Unknown target '${target}'.`);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signPayload({
    aud: AUDIENCE,
    sub,
    targets: [target],
    iat: now,
    exp: now + ttl,
    nonce: crypto.randomBytes(12).toString("hex")
  }, secret);

  console.log(token);
}

const config = readConfig();
const secret = getSecret(config);

if (process.argv.includes("--mint-token")) {
  const argStart = process.argv.indexOf("--mint-token") + 1;
  mintToken(config, secret, process.argv.slice(argStart));
} else {
  startServer(config, secret);
}
