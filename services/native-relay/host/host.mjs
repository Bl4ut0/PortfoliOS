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

const HOST_VERSION = '1.1.0';
const udpSockets = new Map();
const tcpSockets = new Map();

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
        let payloadBuffer;
        if (typeof msg.data === 'string') {
          payloadBuffer = Buffer.from(msg.data, 'base64');
        } else if (Array.isArray(msg.data)) {
          payloadBuffer = Buffer.from(msg.data);
        } else {
          throw new Error('Invalid payload format. Expected base64 string or byte array.');
        }

        socket.send(payloadBuffer, 0, payloadBuffer.length, msg.port, msg.host, (err, bytes) => {
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

        const socket = net.createConnection({
          host: msg.host,
          port: msg.port
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
