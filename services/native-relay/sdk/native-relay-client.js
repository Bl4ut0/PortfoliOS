/**
 * PortfoliOS Networking SDK
 * Unified networking client for PortfoliOS applications and WebAssembly environments.
 *
 * Tier 1: Local Native Relay via Browser Extension (Direct UDP/TCP, zero extra latency, LAN support).
 * Tier 2: Cloud WebSocket Relay Fallback (ut99-relay / central server proxy).
 */

export class GameNetworkClient {
  constructor(options = {}) {
    this.options = {
      cloudRelayUrl: options.cloudRelayUrl || 'wss://relay.os.bl4ut0.dev/v1/relay',
      preferNative: options.preferNative !== false,
      ...options
    };

    this.backend = 'none'; // 'native' | 'cloud' | 'none'
  }

  /**
   * Initialize and detect best available network tier
   */
  async init() {
    if (this.options.preferNative && typeof window !== 'undefined' && window.PortfoliOSNativeRelay) {
      const isAvailable = await window.PortfoliOSNativeRelay.isAvailable();
      if (isAvailable) {
        this.backend = 'native';
        console.log('[GameNetworkClient] Using Tier 1: Local Native Relay (Direct UDP/TCP)');
        return { backend: 'native' };
      }
    }

    if (this.options.cloudRelayUrl) {
      this.backend = 'cloud';
      console.log('[GameNetworkClient] Native relay not detected; falling back to Tier 2: Cloud Relay');
      return { backend: 'cloud' };
    }

    this.backend = 'none';
    throw new Error('No networking backend available (neither local native relay nor cloud relay).');
  }

  /**
   * Create a UDP socket channel
   * @param {Object} socketOpts { port, address, targetHost, targetPort, token }
   */
  async createUdpSocket(socketOpts = {}) {
    if (this.backend === 'native') {
      return this._createNativeUdpSocket(socketOpts);
    } else if (this.backend === 'cloud') {
      return this._createCloudUdpSocket(socketOpts);
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
    if (this.backend === 'native') {
      return await window.PortfoliOSNativeRelay.createTcpSocket(host, port);
    } else {
      throw new Error('Raw TCP socket requires the PortfoliOS Native Extension.');
    }
  }

  // --- Internal Native Implementation ---
  async _createNativeUdpSocket(socketOpts) {
    const socket = await window.PortfoliOSNativeRelay.createUdpSocket(socketOpts.port || 0, socketOpts.address || '0.0.0.0');
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

  // --- Internal Cloud Relay Implementation ---
  async _createCloudUdpSocket(socketOpts) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.options.cloudRelayUrl);
      ws.binaryType = 'arraybuffer';

      let messageListener = null;
      let errorListener = null;
      let closeListener = null;

      ws.onopen = () => {
        // Send initial open handshake
        ws.send(JSON.stringify({
          type: 'relay.open',
          target: socketOpts.targetHost,
          port: socketOpts.targetPort,
          token: socketOpts.token || ''
        }));
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const ctrl = JSON.parse(event.data);
            if (ctrl.type === 'relay.ready') {
              resolve(wrapper);
            } else if (ctrl.type === 'error') {
              reject(new Error(ctrl.error || 'Cloud relay handshake failed'));
            }
          } catch (_) {}
        } else if (event.data instanceof ArrayBuffer) {
          if (messageListener) {
            messageListener(new Uint8Array(event.data), {
              address: socketOpts.targetHost,
              port: socketOpts.targetPort
            });
          }
        }
      };

      ws.onerror = (err) => {
        if (errorListener) errorListener(err);
        reject(err);
      };

      ws.onclose = () => {
        if (closeListener) closeListener();
      };

      const wrapper = {
        type: 'cloud-udp',
        boundAddress: 'relay',
        boundPort: 0,

        onMessage(callback) { messageListener = callback; },
        onError(callback) { errorListener = callback; },
        onClose(callback) { closeListener = callback; },
        send(data) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        },
        close() {
          try { ws.close(); } catch (_) {}
        }
      };
    });
  }
}

export default GameNetworkClient;
