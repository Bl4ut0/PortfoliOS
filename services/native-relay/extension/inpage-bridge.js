/**
 * PortfoliOS Native Relay - In-Page Bridge
 * Provides `window.PortfoliOSNativeRelay` in the page context of os.bl4ut0.dev and os.bl4ut0.com.
 * Enables UDP/TCP network bridging for PortfoliOS applications.
 */

(function () {
  'use strict';

  if (window.PortfoliOSNativeRelay) return;

  let requestIdCounter = 0;
  const pendingRequests = new Map();
  const activeSockets = new Map();
  const streamCallbacks = new Map();

  function nextId() {
    return `req_${++requestIdCounter}_${Date.now()}`;
  }

  // Base64 to Uint8Array helper
  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Uint8Array to Base64 helper
  function uint8ArrayToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function sendToExtension(payload, onChunk = null) {
    return new Promise((resolve, reject) => {
      const id = payload.id || nextId();
      payload.id = id;

      pendingRequests.set(id, { resolve, reject });
      if (typeof onChunk === 'function') {
        streamCallbacks.set(id, onChunk);
      }

      window.postMessage({
        source: 'portfolios-relay-inpage',
        payload
      }, '*');

      const defaultTimeout = payload.type === 'cli.exec' ? 180000 : (payload.type === 'http.fetch' ? 45000 : 7000);
      const timeoutMs = Number(payload.timeoutMs) || defaultTimeout;
      setTimeout(() => {
        streamCallbacks.delete(id);
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error(`Relay request timeout (${payload.type})`));
        }
      }, timeoutMs);
    });
  }

  // Listen for responses from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'portfolios-relay-content') return;

    const msg = event.data.payload;
    if (!msg) return;

    // 0. Stream chunk callback for CLI interpolation
    if (msg.type === 'cli.chunk' && msg.streamId && streamCallbacks.has(msg.streamId)) {
      const cb = streamCallbacks.get(msg.streamId);
      try { cb(msg); } catch (err) { console.error(err); }
      return;
    }

    // 1. Resolve pending promise by request id
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      streamCallbacks.delete(msg.id);

      if (msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve(msg);
      }
    }

    // 2. Dispatch socket events
    if (msg.socketId && activeSockets.has(msg.socketId)) {
      const socket = activeSockets.get(msg.socketId);
      socket._handleIncoming(msg);
    }
  });

  // ==========================================
  // UDP Socket Abstraction
  // ==========================================
  class PortfoliOSUdpSocket {
    constructor(socketId) {
      this.socketId = socketId;
      this.listeners = new Map();
      this.boundAddress = null;
      this.boundPort = null;
    }

    on(event, handler) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(handler);
      return this;
    }

    emit(event, ...args) {
      const handlers = this.listeners.get(event) || [];
      for (const h of handlers) {
        try { h(...args); } catch (err) { console.error(err); }
      }
    }

    async bind(port = 0, address = '0.0.0.0') {
      const res = await sendToExtension({
        type: 'udp.bind',
        socketId: this.socketId,
        port,
        address
      });
      this.boundAddress = res.address;
      this.boundPort = res.port;
      return res;
    }

    async send(data, port, host) {
      let b64Data;
      if (typeof data === 'string') {
        b64Data = btoa(data);
      } else if (data instanceof Uint8Array) {
        b64Data = uint8ArrayToBase64(data);
      } else if (data instanceof ArrayBuffer) {
        b64Data = uint8ArrayToBase64(new Uint8Array(data));
      } else {
        throw new Error('Data must be String, Uint8Array, or ArrayBuffer');
      }

      return await sendToExtension({
        type: 'udp.send',
        socketId: this.socketId,
        data: b64Data,
        port,
        host
      });
    }

    async close() {
      activeSockets.delete(this.socketId);
      return await sendToExtension({
        type: 'udp.close',
        socketId: this.socketId
      });
    }

    _handleIncoming(msg) {
      if (msg.type === 'udp.message') {
        const bytes = base64ToUint8Array(msg.data);
        this.emit('message', bytes, msg.rinfo);
      } else if (msg.type === 'udp.error') {
        this.emit('error', new Error(msg.error));
      } else if (msg.type === 'udp.closed') {
        this.emit('close');
      }
    }
  }

  // ==========================================
  // TCP Socket Abstraction
  // ==========================================
  class PortfoliOSTcpSocket {
    constructor(socketId) {
      this.socketId = socketId;
      this.listeners = new Map();
      this.localAddress = null;
      this.localPort = null;
    }

    on(event, handler) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(handler);
      return this;
    }

    emit(event, ...args) {
      const handlers = this.listeners.get(event) || [];
      for (const h of handlers) {
        try { h(...args); } catch (err) { console.error(err); }
      }
    }

    async connect(host, port) {
      const res = await sendToExtension({
        type: 'tcp.connect',
        socketId: this.socketId,
        host,
        port
      });
      this.localAddress = res.localAddress;
      this.localPort = res.localPort;
      this.emit('connect', res);
      return res;
    }

    async write(data) {
      let b64Data;
      if (typeof data === 'string') {
        b64Data = btoa(data);
      } else if (data instanceof Uint8Array) {
        b64Data = uint8ArrayToBase64(data);
      } else if (data instanceof ArrayBuffer) {
        b64Data = uint8ArrayToBase64(new Uint8Array(data));
      } else {
        throw new Error('Data must be String, Uint8Array, or ArrayBuffer');
      }

      return await sendToExtension({
        type: 'tcp.send',
        socketId: this.socketId,
        data: b64Data
      });
    }

    async close() {
      activeSockets.delete(this.socketId);
      return await sendToExtension({
        type: 'tcp.close',
        socketId: this.socketId
      });
    }

    _handleIncoming(msg) {
      if (msg.type === 'tcp.data') {
        const bytes = base64ToUint8Array(msg.data);
        this.emit('data', bytes);
      } else if (msg.type === 'tcp.error') {
        this.emit('error', new Error(msg.error));
      } else if (msg.type === 'tcp.closed') {
        this.emit('close', msg.hadError);
      }
    }
  }

  // ==========================================
  // Public Relay API
  // ==========================================
  window.PortfoliOSNativeRelay = {
    version: '1.2.0',
    extensionInstalled: true,

    /**
     * Test if the native messaging relay host is installed and active
     */
    async isAvailable() {
      try {
        const res = await sendToExtension({ type: 'ping' });
        return Boolean(res && res.type === 'pong');
      } catch (_) {
        return false;
      }
    },

    /**
     * Inspect host capabilities, version, and MSI installation status
     */
    async getHostCapabilities() {
      try {
        const res = await sendToExtension({ type: 'ping' });
        if (!res || res.type !== 'pong') {
          return { extensionInstalled: true, hostConnected: false, msiInstalled: false };
        }
        return {
          extensionInstalled: true,
          hostConnected: true,
          msiInstalled: true,
          version: res.version || '1.1.0',
          platform: res.platform || 'win32-x64',
          runtime: res.runtime || '',
          capabilities: res.capabilities || { udp: true, tcp: true, http: true, cli: true, msiHost: true }
        };
      } catch (err) {
        return { extensionInstalled: true, hostConnected: false, msiInstalled: false, error: err.message };
      }
    },

    /**
     * Query installed Windows CLI binaries (agy, claude, codex) on the host
     */
    async getCliStatus(cwd = '') {
      return await sendToExtension({ type: 'cli.status', cwd });
    },

    /**
     * Execute a prompt or subcommand against the native Windows CLI (agy, claude, codex)
     */
    async runCliPrompt(options = {}, onChunk = null) {
      return await sendToExtension({
        type: 'cli.exec',
        bin: options.bin || 'agy',
        prompt: options.prompt || '',
        subcommand: options.subcommand || '',
        conversationId: options.conversationId || null,
        continueSession: Boolean(options.continueSession),
        model: options.model || null,
        effort: options.effort || 'high',
        cwd: options.cwd || '',
        timeoutMs: options.timeoutMs || 180000
      }, onChunk);
    },

    /**
     * Create a UDP socket for game network communication
     */
    async createUdpSocket(port = 0, address = '0.0.0.0') {
      const socketId = `udp_${nextId()}`;
      const socket = new PortfoliOSUdpSocket(socketId);
      activeSockets.set(socketId, socket);
      await socket.bind(port, address);
      return socket;
    },

    /**
     * Create a TCP socket for game network communication
     */
    async createTcpSocket(host, port) {
      const socketId = `tcp_${nextId()}`;
      const socket = new PortfoliOSTcpSocket(socketId);
      activeSockets.set(socketId, socket);
      if (host && port) {
        await socket.connect(host, port);
      }
      return socket;
    },

    /**
     * Fetch HTTP/HTTPS resources through the native relay (bypasses browser CORS & mixed content)
     * @param {string} url
     * @param {Object} options { method, headers, body, responseType, timeoutMs }
     */
    async fetch(url, options = {}) {
      const res = await sendToExtension({
        type: 'http.fetch',
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body || null,
        responseType: options.responseType || 'text',
        timeoutMs: options.timeoutMs || 30000
      });

      if (!res) {
        throw new Error('No response from native relay');
      }
      if (res.error) {
        throw new Error(res.error);
      }

      const isBase64 = res.isBase64 || options.responseType === 'arraybuffer';
      const rawData = res.data;

      return {
        ok: res.ok !== false && res.status >= 200 && res.status < 300,
        status: res.status || 200,
        statusText: res.statusText || 'OK',
        url: res.url || url,
        contentType: res.contentType || '',
        headers: {
          get: (name) => {
            const lower = String(name || '').toLowerCase();
            for (const [k, v] of Object.entries(res.headers || {})) {
              if (k.toLowerCase() === lower) return v;
            }
            return null;
          }
        },
        text: async () => {
          if (!isBase64) return typeof rawData === 'string' ? rawData : '';
          const bytes = base64ToUint8Array(rawData);
          return new TextDecoder().decode(bytes);
        },
        json: async () => {
          const txt = !isBase64 ? rawData : new TextDecoder().decode(base64ToUint8Array(rawData));
          return JSON.parse(txt);
        },
        arrayBuffer: async () => {
          if (isBase64) return base64ToUint8Array(rawData).buffer;
          return new TextEncoder().encode(String(rawData || '')).buffer;
        },
        data: isBase64 ? base64ToUint8Array(rawData).buffer : rawData
      };
    }
  };

  console.log('[PortfoliOS] Native Relay bridge ready.');
})();
