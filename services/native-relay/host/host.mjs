#!/usr/bin/env node
/**
 * PortfoliOS Native Relay Host
 * Bridges PortfoliOS browser applications to raw UDP & TCP sockets
 * on the local network via WebExtensions Native Messaging.
 *
 * Compatible with Chrome, Edge, Brave, and Mozilla Firefox.
 */

import dgram from 'node:dgram';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import process from 'node:process';

// Ensure stdout is raw binary
if (process.stdout._handle && process.stdout._handle.setRawMode) {
  process.stdout._handle.setRawMode(true);
}

const HOST_VERSION = '1.2.0';
const udpSockets = new Map();
const tcpSockets = new Map();
const cliVersionCache = new Map();

function resolveCliBinaryPath(bin) {
  const cleanBin = String(bin || '').trim().toLowerCase();
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

  const candidates = [];
  if (cleanBin === 'agy') {
    candidates.push(
      path.join(localAppData, 'agy', 'bin', 'agy.exe'),
      path.join(os.homedir(), '.gemini', 'antigravity', 'bin', 'agy.exe'),
      path.join(localAppData, 'Programs', 'Antigravity', 'bin', 'agy.exe')
    );
  } else if (cleanBin === 'claude') {
    candidates.push(
      path.join(appData, 'npm', 'claude.cmd'),
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'claude.exe')
    );
  } else if (cleanBin === 'codex') {
    candidates.push(
      path.join(appData, 'npm', 'codex.cmd')
    );
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }

  try {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    const out = execFileSync(locator, [cleanBin], { encoding: 'utf8', timeout: 2500, windowsHide: true });
    const first = String(out || '').split(/\r?\n/).map(s => s.trim()).find(Boolean);
    if (first && fs.existsSync(first)) return first;
  } catch (_) {}

  return null;
}

function getCliBinaryVersion(bin, binPath) {
  if (!binPath) return null;
  if (cliVersionCache.has(bin)) return cliVersionCache.get(bin);
  try {
    const isCmd = /\.cmd$|\.bat$/i.test(binPath);
    const out = isCmd
      ? execFileSync('cmd.exe', ['/d', '/s', '/c', `"${binPath}" --version`], { encoding: 'utf8', timeout: 4000, windowsHide: true })
      : execFileSync(binPath, ['--version'], { encoding: 'utf8', timeout: 4000, windowsHide: true });
    const versionMatch = String(out || '').trim().match(/(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/);
    const ver = versionMatch ? versionMatch[1] : String(out || '').trim().split(/\r?\n/)[0];
    if (ver) cliVersionCache.set(bin, ver);
    return ver || null;
  } catch (_) {
    return null;
  }
}

function resolveHostWorkspaceCwd(requestedCwd) {
  const req = String(requestedCwd || '').trim();
  if (req && /^[a-zA-Z]:[\\/]/.test(req)) {
    const normalized = path.resolve(req);
    if (fs.existsSync(normalized)) return normalized;
  }
  const devProjects = 'C:\\Dev Projects';
  if (fs.existsSync(devProjects)) {
    return devProjects;
  }
  const fallbackDir = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'PortfoliOS', 'Workspace');
  try {
    fs.mkdirSync(fallbackDir, { recursive: true });
    return fallbackDir;
  } catch (_) {
    return os.homedir();
  }
}

// Restricted ports and endpoints to prevent SSRF and local privilege escalation
const FORBIDDEN_PORTS = new Set([
  22,    // SSH
  23,    // Telnet
  25,    // SMTP
  111,   // rpcbind
  135,   // MS RPC
  137, 138, 139, 445, // NetBIOS / SMB
  2375, 2376, // Docker Daemon
  3306,  // MySQL
  5432,  // PostgreSQL
  6379,  // Redis
  9222,  // Chrome Remote Debugging
  11434  // Ollama
]);

function isForbiddenHost(host) {
  const h = String(host || '').trim().toLowerCase();
  // Cloud metadata endpoint protection (SSRF)
  if (h === '169.254.169.254' || h.startsWith('169.254.')) return true;
  return false;
}

function validateConnectionTarget(host, port) {
  const p = Number(port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }
  const h = String(host || '').trim();
  if (!h) {
    throw new Error('Target host is required');
  }
  if (isForbiddenHost(h)) {
    throw new Error(`Connections to restricted host '${h}' are denied.`);
  }
  if (FORBIDDEN_PORTS.has(p)) {
    throw new Error(`Connections to restricted port ${p} are denied.`);
  }
  return { host: h, port: p };
}

/**
 * Send a message to the browser via length-prefixed stdout
 */
function sendNativeMessage(obj) {
  try {
    const jsonStr = JSON.stringify(obj);
    const payload = Buffer.from(jsonStr, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);

    process.stdout.write(Buffer.concat([header, payload]));
  } catch (err) {
    // Stderr is logged by the browser in extension developer logs
    process.stderr.write(`[NativeRelayHost] Error sending message: ${err.message}\n`);
  }
}

/**
 * Handle incoming message from browser
 */
function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;

  const { type, id, socketId } = msg;

  switch (type) {
    case 'ping': {
      sendNativeMessage({
        type: 'pong',
        id,
        timestamp: Date.now(),
        version: HOST_VERSION,
        platform: `${process.platform}-${process.arch}`,
        runtime: `node ${process.versions.node}`,
        capabilities: {
          udp: true,
          tcp: true,
          http: true,
          cli: true,
          msiHost: true
        },
        sockets: { udp: udpSockets.size, tcp: tcpSockets.size }
      });
      break;
    }

    // ==========================================
    // UDP Sockets (UT2004, Quake, etc.)
    // ==========================================
    case 'udp.bind': {
      try {
        if (udpSockets.has(socketId)) {
          sendNativeMessage({ type: 'udp.error', id, socketId, error: 'Socket already exists' });
          return;
        }

        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        socket.on('message', (buffer, rinfo) => {
          sendNativeMessage({
            type: 'udp.message',
            socketId,
            data: buffer.toString('base64'),
            rinfo: {
              address: rinfo.address,
              port: rinfo.port,
              family: rinfo.family,
              size: rinfo.size
            }
          });
        });

        socket.on('error', (err) => {
          sendNativeMessage({
            type: 'udp.error',
            socketId,
            error: err.message
          });
        });

        socket.on('close', () => {
          udpSockets.delete(socketId);
          sendNativeMessage({ type: 'udp.closed', socketId });
        });

        const port = msg.port || 0;
        const address = msg.address || '0.0.0.0';

        socket.bind(port, address, () => {
          const bound = socket.address();
          udpSockets.set(socketId, socket);
          sendNativeMessage({
            type: 'udp.bound',
            id,
            socketId,
            address: bound.address,
            port: bound.port
          });
        });
      } catch (err) {
        sendNativeMessage({ type: 'udp.error', id, socketId, error: err.message });
      }
      break;
    }

    case 'udp.send': {
      const socket = udpSockets.get(socketId);
      if (!socket) {
        sendNativeMessage({ type: 'udp.error', id, socketId, error: 'Socket not found' });
        return;
      }

      try {
        const { host: safeHost, port: safePort } = validateConnectionTarget(msg.host, msg.port);

        let payloadBuffer;
        if (typeof msg.data === 'string') {
          payloadBuffer = Buffer.from(msg.data, 'base64');
        } else if (Array.isArray(msg.data)) {
          payloadBuffer = Buffer.from(msg.data);
        } else {
          throw new Error('Invalid payload format. Expected base64 string or byte array.');
        }

        socket.send(payloadBuffer, 0, payloadBuffer.length, safePort, safeHost, (err, bytes) => {
          if (err) {
            sendNativeMessage({ type: 'udp.error', id, socketId, error: err.message });
          } else {
            sendNativeMessage({ type: 'udp.sent', id, socketId, bytes });
          }
        });
      } catch (err) {
        sendNativeMessage({ type: 'udp.error', id, socketId, error: err.message });
      }
      break;
    }

    case 'udp.close': {
      const socket = udpSockets.get(socketId);
      if (socket) {
        try {
          socket.close();
        } catch (_) {}
        udpSockets.delete(socketId);
      }
      sendNativeMessage({ type: 'udp.closed', id, socketId });
      break;
    }

    // ==========================================
    // TCP Sockets (Diablo Battle.net / IPX / direct)
    // ==========================================
    case 'tcp.connect': {
      try {
        if (tcpSockets.has(socketId)) {
          sendNativeMessage({ type: 'tcp.error', id, socketId, error: 'Socket already exists' });
          return;
        }

        const { host: safeHost, port: safePort } = validateConnectionTarget(msg.host, msg.port);

        const socket = net.createConnection({
          host: safeHost,
          port: safePort
        });

        socket.on('connect', () => {
          tcpSockets.set(socketId, socket);
          sendNativeMessage({
            type: 'tcp.connected',
            id,
            socketId,
            localAddress: socket.localAddress,
            localPort: socket.localPort
          });
        });

        socket.on('data', (data) => {
          sendNativeMessage({
            type: 'tcp.data',
            socketId,
            data: data.toString('base64')
          });
        });

        socket.on('error', (err) => {
          sendNativeMessage({
            type: 'tcp.error',
            socketId,
            error: err.message
          });
        });

        socket.on('close', (hadError) => {
          tcpSockets.delete(socketId);
          sendNativeMessage({
            type: 'tcp.closed',
            socketId,
            hadError
          });
        });
      } catch (err) {
        sendNativeMessage({ type: 'tcp.error', id, socketId, error: err.message });
      }
      break;
    }

    case 'tcp.send': {
      const socket = tcpSockets.get(socketId);
      if (!socket) {
        sendNativeMessage({ type: 'tcp.error', id, socketId, error: 'Socket not found' });
        return;
      }

      try {
        let payloadBuffer;
        if (typeof msg.data === 'string') {
          payloadBuffer = Buffer.from(msg.data, 'base64');
        } else if (Array.isArray(msg.data)) {
          payloadBuffer = Buffer.from(msg.data);
        } else {
          throw new Error('Invalid payload format.');
        }

        socket.write(payloadBuffer, (err) => {
          if (err) {
            sendNativeMessage({ type: 'tcp.error', id, socketId, error: err.message });
          } else {
            sendNativeMessage({ type: 'tcp.sent', id, socketId, bytes: payloadBuffer.length });
          }
        });
      } catch (err) {
        sendNativeMessage({ type: 'tcp.error', id, socketId, error: err.message });
      }
      break;
    }

    case 'tcp.close': {
      const socket = tcpSockets.get(socketId);
      if (socket) {
        try {
          socket.end();
        } catch (_) {}
        tcpSockets.delete(socketId);
      }
      sendNativeMessage({ type: 'tcp.closed', id, socketId });
      break;
    }

    // ==========================================
    // HTTP/HTTPS Fetch (IPTV Streams, M3U8, EPG, APIs)
    // ==========================================
    case 'http.fetch': {
      (async () => {
        try {
          const targetUrl = String(msg.url || '').trim();
          if (!targetUrl) {
            sendNativeMessage({ type: 'http.response', id, ok: false, status: 400, error: 'URL is required' });
            return;
          }
          const parsed = new URL(targetUrl);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            sendNativeMessage({ type: 'http.response', id, ok: false, status: 400, error: 'Only HTTP and HTTPS URLs are allowed' });
            return;
          }
          if (isForbiddenHost(parsed.hostname)) {
            sendNativeMessage({ type: 'http.response', id, ok: false, status: 403, error: `Connections to restricted host '${parsed.hostname}' are denied` });
            return;
          }
          if (parsed.port && FORBIDDEN_PORTS.has(Number(parsed.port))) {
            sendNativeMessage({ type: 'http.response', id, ok: false, status: 403, error: `Connections to restricted port ${parsed.port} are denied` });
            return;
          }

          const fetchOpts = {
            method: (msg.method || 'GET').toUpperCase(),
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
              ...(msg.headers || {})
            }
          };

          if (msg.body && fetchOpts.method !== 'GET' && fetchOpts.method !== 'HEAD') {
            fetchOpts.body = typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body);
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), Number(msg.timeoutMs) || 30000);
          fetchOpts.signal = controller.signal;

          const res = await fetch(targetUrl, fetchOpts);
          clearTimeout(timeout);

          const resHeaders = {};
          res.headers.forEach((val, key) => { resHeaders[key] = val; });
          const contentType = res.headers.get('content-type') || '';

          const isBinary = msg.responseType === 'arraybuffer' || 
            /video|audio|octet-stream|mp2t|mpegurl/i.test(contentType);

          let data;
          if (isBinary) {
            const ab = await res.arrayBuffer();
            data = Buffer.from(ab).toString('base64');
          } else {
            data = await res.text();
          }

          sendNativeMessage({
            type: 'http.response',
            id,
            ok: res.ok,
            status: res.status,
            statusText: res.statusText,
            url: res.url,
            headers: resHeaders,
            contentType,
            isBase64: isBinary,
            data
          });
        } catch (err) {
          sendNativeMessage({
            type: 'http.response',
            id,
            ok: false,
            status: 0,
            statusText: 'Network Error',
            error: err.message
          });
        }
      })();
      break;
    }

    // ==========================================
    // Native Windows CLI Interpolation (agy, claude, codex)
    // ==========================================
    case 'cli.status': {
      try {
        const agyPath = resolveCliBinaryPath('agy');
        const claudePath = resolveCliBinaryPath('claude');
        const codexPath = resolveCliBinaryPath('codex');
        const hostCwd = resolveHostWorkspaceCwd(msg.cwd);

        sendNativeMessage({
          type: 'cli.status.response',
          id,
          ok: true,
          hostVersion: HOST_VERSION,
          platform: `${process.platform}-${process.arch}`,
          cwd: hostCwd.replace(/\\/g, '/'),
          binaries: {
            agy: {
              installed: Boolean(agyPath),
              path: agyPath,
              version: getCliBinaryVersion('agy', agyPath) || '1.5.5',
              defaultModel: 'gemini-3.8-flash-high',
              defaultModelDisplay: 'Gemini 3.8 Flash (High)'
            },
            claude: {
              installed: Boolean(claudePath),
              path: claudePath,
              version: getCliBinaryVersion('claude', claudePath) || '2.1.318',
              defaultModel: 'claude-sonnet-4-6'
            },
            codex: {
              installed: Boolean(codexPath),
              path: codexPath,
              version: getCliBinaryVersion('codex', codexPath) || '0.167.0',
              defaultModel: 'gpt-4o'
            }
          }
        });
      } catch (err) {
        sendNativeMessage({
          type: 'cli.status.response',
          id,
          ok: false,
          error: err.message
        });
      }
      break;
    }

    case 'cli.exec': {
      (async () => {
        try {
          const bin = String(msg.bin || 'agy').trim().toLowerCase();
          if (!['agy', 'claude', 'codex'].includes(bin)) {
            sendNativeMessage({ type: 'cli.response', id, ok: false, error: `Unsupported CLI binary: ${bin}` });
            return;
          }

          const binPath = resolveCliBinaryPath(bin);
          if (!binPath) {
            sendNativeMessage({
              type: 'cli.response',
              id,
              ok: false,
              error: `Native binary '${bin}' was not found on this Windows host.`
            });
            return;
          }

          const hostCwd = resolveHostWorkspaceCwd(msg.cwd);
          const subcommand = String(msg.subcommand || '').trim().toLowerCase();

          if (bin === 'agy' && subcommand === 'models') {
            const out = execFileSync(binPath, ['models'], {
              cwd: hostCwd,
              encoding: 'utf8',
              timeout: 15000,
              windowsHide: true
            });
            sendNativeMessage({
              type: 'cli.response',
              id,
              ok: true,
              bin,
              response: String(out || '').trim(),
              cwd: hostCwd.replace(/\\/g, '/')
            });
            return;
          }

          const promptText = String(msg.prompt || '').trim();
          if (!promptText) {
            sendNativeMessage({ type: 'cli.response', id, ok: false, error: 'Prompt text is required' });
            return;
          }

          let spawnCmd = binPath;
          let spawnArgs = [];

          if (bin === 'agy') {
            spawnArgs = [
              '--print', promptText,
              '--dangerously-skip-permissions',
              '--effort', String(msg.effort || 'high'),
              '--output-format', 'stream-json'
            ];
            if (msg.conversationId) {
              spawnArgs.push('--conversation', String(msg.conversationId));
            } else if (msg.continueSession) {
              spawnArgs.push('--continue');
            }
            if (msg.model && !['default', 'gemini-2.5-pro-agy'].includes(String(msg.model))) {
              spawnArgs.push('--model', String(msg.model));
            }
          } else if (bin === 'claude') {
            const rawArgs = ['-p', promptText, '--dangerously-skip-permissions'];
            if (msg.continueSession) rawArgs.push('--continue');
            if (/\.cmd$|\.bat$/i.test(binPath)) {
              spawnCmd = 'cmd.exe';
              spawnArgs = ['/d', '/s', '/c', `"${binPath}" ${rawArgs.map(a => `"${String(a).replace(/"/g, '\\"')}"`).join(' ')}`];
            } else {
              spawnArgs = rawArgs;
            }
          } else if (bin === 'codex') {
            const rawArgs = ['exec', '--dangerously-bypass-approvals-and-sandbox', promptText];
            if (/\.cmd$|\.bat$/i.test(binPath)) {
              spawnCmd = 'cmd.exe';
              spawnArgs = ['/d', '/s', '/c', `"${binPath}" ${rawArgs.map(a => `"${String(a).replace(/"/g, '\\"')}"`).join(' ')}`];
            } else {
              spawnArgs = rawArgs;
            }
          }

          const child = spawn(spawnCmd, spawnArgs, {
            cwd: hostCwd,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
          });

          let stdoutBuffer = '';
          let streamedText = '';
          let finalResponse = '';
          let conversationId = msg.conversationId || null;
          let usage = null;
          let stderrText = '';

          child.stdout.on('data', (chunk) => {
            const text = chunk.toString('utf8');
            if (bin === 'agy') {
              stdoutBuffer += text;
              let newlineIdx;
              while ((newlineIdx = stdoutBuffer.indexOf('\n')) !== -1) {
                const line = stdoutBuffer.slice(0, newlineIdx).trim();
                stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);
                if (!line) continue;
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.event === 'init') {
                    conversationId = parsed.conversation_id || conversationId;
                    sendNativeMessage({
                      type: 'cli.chunk',
                      streamId: id,
                      bin,
                      event: 'init',
                      conversationId,
                      cwd: (parsed.init?.cwd || hostCwd).replace(/\\/g, '/')
                    });
                  } else if (parsed.event === 'step_update' && parsed.step_update) {
                    const su = parsed.step_update;
                    if (su.conversation_id) conversationId = su.conversation_id;
                    if (su.step_type === 'agent_response' && typeof su.text_delta === 'string' && su.text_delta) {
                      streamedText += su.text_delta;
                      sendNativeMessage({
                        type: 'cli.chunk',
                        streamId: id,
                        bin,
                        event: 'delta',
                        textDelta: su.text_delta,
                        conversationId
                      });
                    }
                  } else if (parsed.event === 'result' && parsed.result) {
                    conversationId = parsed.result.conversation_id || conversationId;
                    if (typeof parsed.result.response === 'string') {
                      finalResponse = parsed.result.response;
                    }
                    usage = parsed.result.usage || null;
                  }
                } catch (_) {
                  streamedText += line + '\n';
                  sendNativeMessage({
                    type: 'cli.chunk',
                    streamId: id,
                    bin,
                    event: 'delta',
                    textDelta: line + '\n',
                    conversationId
                  });
                }
              }
            } else {
              streamedText += text;
              sendNativeMessage({
                type: 'cli.chunk',
                streamId: id,
                bin,
                event: 'delta',
                textDelta: text
              });
            }
          });

          child.stderr.on('data', (chunk) => {
            stderrText += chunk.toString('utf8');
          });

          child.on('error', (err) => {
            sendNativeMessage({
              type: 'cli.response',
              id,
              ok: false,
              bin,
              error: err.message
            });
          });

          child.on('close', (code) => {
            if (bin === 'agy' && stdoutBuffer.trim()) {
              try {
                const parsed = JSON.parse(stdoutBuffer.trim());
                if (parsed.event === 'result' && parsed.result) {
                  conversationId = parsed.result.conversation_id || conversationId;
                  if (typeof parsed.result.response === 'string') {
                    finalResponse = parsed.result.response;
                  }
                  usage = parsed.result.usage || null;
                }
              } catch (_) {}
            }
            const output = (finalResponse || streamedText || '').trimEnd();
            sendNativeMessage({
              type: 'cli.response',
              id,
              ok: code === 0 || Boolean(output),
              bin,
              conversationId,
              response: output || stderrText.trim(),
              usage,
              cwd: hostCwd.replace(/\\/g, '/')
            });
          });
        } catch (err) {
          sendNativeMessage({
            type: 'cli.response',
            id,
            ok: false,
            error: err.message
          });
        }
      })();
      break;
    }

    default:
      sendNativeMessage({ type: 'error', id, error: `Unknown command type: ${type}` });
  }
}

// ==========================================
// Native Messaging Stdin Framing Protocol
// ==========================================
let inputBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);

  while (inputBuffer.length >= 4) {
    const msgLen = inputBuffer.readUInt32LE(0);
    const totalLen = 4 + msgLen;

    if (inputBuffer.length < totalLen) {
      // Wait for complete message
      break;
    }

    const msgBytes = inputBuffer.slice(4, totalLen);
    inputBuffer = inputBuffer.slice(totalLen);

    try {
      const parsed = JSON.parse(msgBytes.toString('utf8'));
      handleMessage(parsed);
    } catch (err) {
      process.stderr.write(`[NativeRelayHost] Failed to parse message: ${err.message}\n`);
    }
  }
});

process.stdin.on('end', () => {
  // Browser disconnected or tab closed - cleanly shut down all active sockets
  for (const socket of udpSockets.values()) {
    try { socket.close(); } catch (_) {}
  }
  for (const socket of tcpSockets.values()) {
    try { socket.destroy(); } catch (_) {}
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
