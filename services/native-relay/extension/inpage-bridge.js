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

  function sendToExtension(payload) {
    return new Promise((resolve, reject) => {
      const id = payload.id || nextId();
      payload.id = id;

      pendingRequests.set(id, { resolve, reject });

      window.postMessage({
        source: 'portfolios-relay-inpage',
        payload
      }, '*');

      // 5 second default timeout for control commands
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error(`Relay request timeout (${payload.type})`));
        }
      }, 7000);
    });
  }

  // Listen for responses from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'portfolios-relay-content') return;

    const msg = event.data.payload;
    if (!msg) return;

    // 1. Resolve pending promise by request id
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);

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
    version: '1.0.0',

    /**
     * Test if the native messaging relay host is installed and active
     */
    async isAvailable() {
      try {
        const res = await sendToExtension({ type: 'ping' });
        return res && res.type === 'pong';
      } catch (_) {
        return false;
      }
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
    }
  };

  console.log('[PortfoliOS] Native Relay bridge ready.');
})();
