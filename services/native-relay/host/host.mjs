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
import process from 'node:process';

// Ensure stdout is raw binary
if (process.stdout._handle && process.stdout._handle.setRawMode) {
  process.stdout._handle.setRawMode(true);
}

const HOST_VERSION = '1.2.0';
const udpSockets = new Map();
const tcpSockets = new Map();

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
