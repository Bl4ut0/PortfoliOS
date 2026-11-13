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
  constructor() {
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
    throw new Error('Sandbox networking only. Install the Native Relay extension and local Host Bridge for raw TCP/UDP. No hosted relay fallback is provided.');
  }

  /**
   * Create a UDP socket channel
   * @param {Object} socketOpts { port, address, targetHost, targetPort, token }
   */
  async createUdpSocket(socketOpts = {}) {
    if (!isPrivateSessionActive()) throw new Error('A private workspace is required.');
    if (this.backend === 'native') {
      return this._createNativeUdpSocket(socketOpts);

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

}

export default GameNetworkClient;
