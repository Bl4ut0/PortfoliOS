/**
 * PortfoliOS Native Relay - Content Script
 * Injected into os.bl4ut0.dev, os.bl4ut0.com, and local dev origins.
 * Bridges in-page window.postMessage to background service worker.
 */

(function () {
  'use strict';

  // Inject inpage-bridge.js into DOM
  function injectBridge() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('inpage-bridge.js');
      script.async = false;
      (document.head || document.documentElement).appendChild(script);
      script.onload = () => script.remove();
    } catch (err) {
      console.error('[PortfoliOS-Relay-Content] Failed to inject inpage-bridge:', err);
    }
  }

  injectBridge();

  let bgPort = null;

  function ensureBgPort() {
    if (bgPort) return bgPort;

    bgPort = chrome.runtime.connect({ name: 'portfolios-relay-bridge' });

    bgPort.onMessage.addListener((msg) => {
      window.postMessage({
        source: 'portfolios-relay-content',
        payload: msg
      }, '*');
    });

    bgPort.onDisconnect.addListener(() => {
      bgPort = null;
      window.postMessage({
        source: 'portfolios-relay-content',
        payload: { type: 'host.disconnected', error: 'Background connection closed' }
      }, '*');
    });

    return bgPort;
  }

  // Listen for messages from inpage-bridge
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'portfolios-relay-inpage') return;

    const payload = event.data.payload;
    const port = ensureBgPort();
    try {
      port.postMessage(payload);
    } catch (err) {
      window.postMessage({
        source: 'portfolios-relay-content',
        payload: {
          id: payload.id,
          type: 'error',
          error: `Failed to communicate with extension: ${err.message}`
        }
      }, '*');
    }
  });
})();
