/**
 * PortfoliOS Native Game Relay - Background Service Worker
 * Bridges content script messages to the local Native Messaging Host.
 */

const NATIVE_HOST_NAME = 'com.bl4ut0.portfolios.relay';

let nativePort = null;
const activeContentPorts = new Set();
const pendingRequests = new Map();

/**
 * Ensure native host connection is established
 */
function ensureNativePort() {
  if (nativePort) return nativePort;

  try {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    nativePort = api.runtime.connectNative(NATIVE_HOST_NAME);

    nativePort.onMessage.addListener((msg) => {
      // 1. Check if it's a response to a specific request ID
      if (msg.id && pendingRequests.has(msg.id)) {
        const port = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        if (activeContentPorts.has(port)) {
          port.postMessage(msg);
        }
      }

      // 2. Broadcast streaming events (e.g., incoming UDP packets, TCP data) to all content ports
      for (const port of activeContentPorts) {
        try {
          port.postMessage(msg);
        } catch (_) {}
      }
    });

    nativePort.onDisconnect.addListener(() => {
      const err = (typeof chrome !== 'undefined' && chrome.runtime.lastError)
        ? chrome.runtime.lastError.message
        : 'Native host disconnected';

      console.warn('[PortfoliOS-Relay-BG] Native host disconnected:', err);
      nativePort = null;

      for (const port of activeContentPorts) {
        try {
          port.postMessage({ type: 'host.disconnected', error: err });
        } catch (_) {}
      }
      pendingRequests.clear();
    });

    console.log('[PortfoliOS-Relay-BG] Connected to native host:', NATIVE_HOST_NAME);
    return nativePort;
  } catch (err) {
    console.error('[PortfoliOS-Relay-BG] Failed to connect to native host:', err);
    nativePort = null;
    return null;
  }
}

// Listen for status inquiries from the popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'checkStatus') {
    try {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      api.runtime.sendNativeMessage(NATIVE_HOST_NAME, { type: 'ping' }, (response) => {
        if (api.runtime.lastError || !response || response.type !== 'pong') {
          sendResponse({
            online: false,
            error: api.runtime.lastError ? api.runtime.lastError.message : 'No response from host'
          });
        } else {
          sendResponse({ online: true, host: NATIVE_HOST_NAME });
        }
      });
    } catch (err) {
      sendResponse({ online: false, error: err.message });
    }
    return true; // Keep message channel open for async response
  }
});

// Listen for connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'portfolios-relay-bridge') return;

  activeContentPorts.add(port);
  console.log('[PortfoliOS-Relay-BG] Content script connected');

  port.onMessage.addListener((msg) => {
    const hostPort = ensureNativePort();
    if (!hostPort) {
      port.postMessage({
        id: msg.id,
        type: 'error',
        error: 'Native Relay host is not installed or failed to launch. Please run register-host script.'
      });
      return;
    }

    if (msg.id) {
      pendingRequests.set(msg.id, port);
    }

    try {
      hostPort.postMessage(msg);
    } catch (err) {
      port.postMessage({
        id: msg.id,
        type: 'error',
        error: `Failed to forward message to native host: ${err.message}`
      });
    }
  });

  port.onDisconnect.addListener(() => {
    activeContentPorts.delete(port);
    for (const [id, reqPort] of pendingRequests.entries()) {
      if (reqPort === port) pendingRequests.delete(id);
    }

    // If no more tabs are using the relay, disconnect native port to save resources
    if (activeContentPorts.size === 0 && nativePort) {
      try {
        nativePort.disconnect();
      } catch (_) {}
      nativePort = null;
      console.log('[PortfoliOS-Relay-BG] All content scripts disconnected; closed native host.');
    }
  });
});
