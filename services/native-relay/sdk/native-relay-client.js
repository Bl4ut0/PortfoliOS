/**
 * PortfoliOS Networking SDK
 * Unified networking client for PortfoliOS applications and WebAssembly environments.
 *
 * Tier 1: Local Native Relay via Browser Extension (Direct UDP/TCP, zero extra latency, LAN support).
 * No hosted fallback: without the local relay, raw networking stays unavailable.
 */

function getRelayBridge() {
  if (typeof window === 'undefined') return null;
  try {
    if (window.PortfoliOSNativeRelay) return window.PortfoliOSNativeRelay;
    if (window.parent && window.parent !== window && window.parent.PortfoliOSNativeRelay) {
      return window.parent.PortfoliOSNativeRelay;
    }
    if (window.top && window.top !== window && window.top.PortfoliOSNativeRelay) {
      return window.top.PortfoliOSNativeRelay;
    }
  } catch (_) {}
  return null;
}

function isPrivateSessionActive() {
  if (typeof window === 'undefined') return true;
  try {
    const fn = window.isPrivateUser || window.parent?.isPrivateUser || window.top?.isPrivateUser;
    if (typeof fn === 'function') {
      const uid = window.state?.currentUserId || window.parent?.state?.currentUserId || window.top?.state?.currentUserId;
      return Boolean(fn(uid));
    }
  } catch (_) {}
  return false;
}

export class GameNetworkClient {
  constructor(options = {}) {
    this.mode = options.mode === 'custom' ? 'custom' : 'native';
    this.endpoint = options.endpoint || '';
    this.backend = 'none'; // 'native' | 'none'
  }

  /**
   * Initialize and detect best available network tier
   */
  async init() {
    this.backend = 'none';
    if (!isPrivateSessionActive()) {
      this.backend = 'none';
      console.warn('[GameNetworkClient] Network bridge features are excluded to private workspaces only.');
      throw new Error('Network bridge features are restricted to private workspaces.');
    }

    if (this.mode === 'custom') {
      const endpoint = new URL(this.endpoint);
      if (endpoint.protocol !== 'wss:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Use a secure wss:// endpoint for your compatible UDP relay without credentials or query parameters.');
      this.endpoint = endpoint.href;
      this.backend = 'custom';
      return { backend: 'custom' };
    }
    const relayBridge = getRelayBridge();
    if (relayBridge) {
      const isAvailable = await Promise.race([relayBridge.isAvailable(), new Promise(resolve => setTimeout(() => resolve(false), 2500))]);
      if (isAvailable) {
        this.backend = 'native';
        console.log('[GameNetworkClient] Using Tier 1: Local Native Relay (Direct UDP/TCP)');
        return { backend: 'native' };
      }
    }

    this.backend = 'none';
    throw new Error('Sandbox networking only. Install the Native Relay extension and local Host Bridge, or explicitly configure your compatible UDP relay. No hosted relay fallback is provided.');
  }

  /**
   * Create a UDP socket channel
   * @param {Object} socketOpts { port, address, targetHost, targetPort, token }
   */
  async createUdpSocket(socketOpts = {}) {
    if (!isPrivateSessionActive()) throw new Error('A private workspace is required.');
    if (this.backend === 'native') {
      return this._createNativeUdpSocket(socketOpts);
    } else if (this.backend === 'custom') {
      return this._createCustomUdpSocket(socketOpts);
    } else {
      throw new Error('Call init() before creating sockets.');
    }
  }

  /**
   * Create a TCP socket channel
   * @param {string} host
   * @param {number} port
   */
  async createTcpSocket(host, port) {
    if (!isPrivateSessionActive()) throw new Error('A private workspace is required.');
    const relayBridge = getRelayBridge();
    if (this.backend === 'native' && relayBridge) {
      return await relayBridge.createTcpSocket(host, port);
    } else {
      throw new Error('Raw TCP socket requires the PortfoliOS Native Extension.');
    }
  }

  // --- Internal Native Implementation ---
  async _createNativeUdpSocket(socketOpts) {
    const relayBridge = getRelayBridge();
    const socket = await relayBridge.createUdpSocket(socketOpts.port || 0, socketOpts.address || '0.0.0.0');
    return {
      type: 'native-udp',
      boundAddress: socket.boundAddress,
      boundPort: socket.boundPort,

      onMessage(callback) {
        socket.on('message', callback);
      },
      onError(callback) {
        socket.on('error', callback);
      },
      onClose(callback) {
        socket.on('close', callback);
      },
      send(data, port, host) {
        const destPort = port || socketOpts.targetPort;
        const destHost = host || socketOpts.targetHost;
        return socket.send(data, destPort, destHost);
      },
      close() {
        return socket.close();
      }
    };
  }

  // Explicit user-selected WebSocket-to-UDP bridge protocol. This is not Wisp.
  async _createCustomUdpSocket(socketOpts) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.endpoint); ws.binaryType = 'arraybuffer';
      let ready = false, messageListener, errorListener, closeListener;
      const fail = () => { clearTimeout(deadline); if (!ready) reject(new Error('Your UDP relay could not establish a session.')); try { ws.close(); } catch {} };
      const deadline = setTimeout(fail, 10000);
      const wrapper = {
        type: 'custom-udp', boundAddress: 'user-relay', boundPort: 0,
        onMessage(callback) { messageListener = callback; },
        onError(callback) { errorListener = callback; },
        onClose(callback) { closeListener = callback; },
        send(data) { if (ws.readyState !== WebSocket.OPEN) throw new Error('Relay socket is closed.'); ws.send(data); },
        close() { clearTimeout(deadline); ws.close(); }
      };
      ws.onopen = () => ws.send(JSON.stringify({ type: 'relay.open', target: socketOpts.targetHost, port: socketOpts.targetPort, token: socketOpts.token || '' }));
      ws.onmessage = event => {
        if (typeof event.data === 'string') {
          let control; try { control = JSON.parse(event.data); } catch { return; }
          if (control.type === 'relay.ready') { ready = true; clearTimeout(deadline); resolve(wrapper); }
          else if (control.type === 'error') { errorListener?.(new Error('Your relay rejected the request.')); fail(); }
        } else if (ready && event.data instanceof ArrayBuffer) messageListener?.(new Uint8Array(event.data), {address: socketOpts.targetHost, port: socketOpts.targetPort});
      };
      ws.onerror = () => { errorListener?.(new Error('Relay connection failed.')); fail(); };
      ws.onclose = () => { clearTimeout(deadline); if (!ready) reject(new Error('Relay closed before session setup.')); closeListener?.(); };
    });
  }

}

export default GameNetworkClient;
