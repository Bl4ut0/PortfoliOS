/**
 * PortfoliOS Native Relay - Background Service Worker
 * Bridges content script messages to the local Native Messaging Host,
 * meters UDP/TCP traffic per socket and streams live stats to the popup.
 */

const NATIVE_HOST_NAME = 'com.bl4ut0.portfolios.relay';
const HISTORY_SECONDS = 60;
const api = typeof browser !== 'undefined' ? browser : chrome;

let nativePort = null;
const activeContentPorts = new Set();
const popupPorts = new Set();
const pendingRequests = new Map(); // request id -> content port
const portInfo = new Map();        // content port -> { tabId, url, title, frameId, connectedAt }

// ==========================================
// Traffic metering
// ==========================================
const emptyCounters = () => ({ tx: 0, rx: 0, txPackets: 0, rxPackets: 0 });
const totals = { udp: emptyCounters(), tcp: emptyCounters() };
const sockets = new Map(); // socketId -> socket record
const history = [];        // [{ t, udpTx, udpRx, tcpTx, tcpRx }]
let lastSample = { udpTx: 0, udpRx: 0, tcpTx: 0, tcpRx: 0 };
let sampleTimer = null;
let sessionStartedAt = null;

function base64Bytes(data) {
  if (typeof data !== 'string') return Array.isArray(data) ? data.length : 0;
  const len = data.length;
  if (!len) return 0;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

function protoOf(type, socketId) {
  if (typeof type === 'string' && type.startsWith('udp.')) return 'udp';
  if (typeof type === 'string' && type.startsWith('tcp.')) return 'tcp';
  if (typeof socketId === 'string' && socketId.startsWith('udp_')) return 'udp';
  if (typeof socketId === 'string' && socketId.startsWith('tcp_')) return 'tcp';
  return null;
}

function ensureSocket(socketId, proto, port) {
  let record = sockets.get(socketId);
  if (!record) {
    const info = port ? portInfo.get(port) : null;
    record = {
      id: socketId,
      proto,
      port: port || null,
      tabId: info?.tabId ?? null,
      state: 'opening',
      localPort: null,
      remoteHost: null,
      remotePort: null,
      peers: new Set(),
      tx: 0,
      rx: 0,
      txPackets: 0,
      rxPackets: 0,
      openedAt: Date.now(),
      lastActivity: Date.now()
    };
    sockets.set(socketId, record);
    if (!sessionStartedAt) sessionStartedAt = Date.now();
  } else if (port && !record.port) {
    record.port = port;
    record.tabId = portInfo.get(port)?.tabId ?? record.tabId;
  }
  return record;
}

/** Outbound: page -> native host */
function meterOutbound(msg, port) {
  const proto = protoOf(msg.type, msg.socketId);
  if (!proto || !msg.socketId) return;
  const record = ensureSocket(msg.socketId, proto, port);

  if (msg.type === 'tcp.connect' || msg.type === 'udp.send') {
    if (msg.host) record.remoteHost = String(msg.host);
    if (msg.port) record.remotePort = Number(msg.port);
    if (msg.host && msg.port) record.peers.add(`${msg.host}:${msg.port}`);
  }
  if (msg.type === 'udp.send' || msg.type === 'tcp.send') {
    const bytes = base64Bytes(msg.data);
    record.tx += bytes;
    record.txPackets += 1;
    record.lastActivity = Date.now();
    totals[proto].tx += bytes;
    totals[proto].txPackets += 1;
  }
}

/** Inbound: native host -> page */
function meterInbound(msg) {
  const proto = protoOf(msg.type, msg.socketId);
  if (!proto || !msg.socketId) return;
  const record = sockets.get(msg.socketId) || ensureSocket(msg.socketId, proto, null);

  switch (msg.type) {
    case 'udp.bound':
      record.state = 'bound';
      record.localPort = msg.port ?? null;
      break;
    case 'tcp.connected':
      record.state = 'connected';
      record.localPort = msg.localPort ?? null;
      break;
    case 'udp.message':
    case 'tcp.data': {
      const bytes = base64Bytes(msg.data);
      record.rx += bytes;
      record.rxPackets += 1;
      record.lastActivity = Date.now();
      if (record.state === 'opening') record.state = proto === 'udp' ? 'bound' : 'connected';
      if (msg.rinfo?.address) record.peers.add(`${msg.rinfo.address}:${msg.rinfo.port}`);
      totals[proto].rx += bytes;
      totals[proto].rxPackets += 1;
      break;
    }
    case 'udp.error':
    case 'tcp.error':
      record.lastError = msg.error || 'Socket error';
      break;
    case 'udp.closed':
    case 'tcp.closed':
      sockets.delete(msg.socketId);
      break;
    default:
      break;
  }
}

function takeSample() {
  const now = {
    udpTx: totals.udp.tx, udpRx: totals.udp.rx,
    tcpTx: totals.tcp.tx, tcpRx: totals.tcp.rx
  };
  history.push({
    t: Date.now(),
    udpTx: now.udpTx - lastSample.udpTx,
    udpRx: now.udpRx - lastSample.udpRx,
    tcpTx: now.tcpTx - lastSample.tcpTx,
    tcpRx: now.tcpRx - lastSample.tcpRx
  });
  while (history.length > HISTORY_SECONDS) history.shift();
  lastSample = now;
  broadcastStats();
}

function updateSampler() {
  const needed = activeContentPorts.size > 0 || popupPorts.size > 0 || sockets.size > 0;
  if (needed && !sampleTimer) {
    lastSample = {
      udpTx: totals.udp.tx, udpRx: totals.udp.rx,
      tcpTx: totals.tcp.tx, tcpRx: totals.tcp.rx
    };
    sampleTimer = setInterval(takeSample, 1000);
  } else if (!needed && sampleTimer) {
    clearInterval(sampleTimer);
    sampleTimer = null;
  }
  if (activeContentPorts.size === 0 && sockets.size === 0) sessionStartedAt = null;
}

function snapshot() {
  const tabs = new Map();
  for (const [, info] of portInfo) {
    if (info.tabId == null) continue;
    const existing = tabs.get(info.tabId);
    if (!existing || info.connectedAt < existing.connectedAt) tabs.set(info.tabId, { ...info });
  }
  return {
    type: 'stats',
    hostConnected: !!nativePort,
    sessionStartedAt,
    bridges: activeContentPorts.size,
    tabs: [...tabs.values()],
    totals,
    history,
    sockets: [...sockets.values()].map((s) => ({
      id: s.id,
      proto: s.proto,
      tabId: s.tabId,
      state: s.state,
      localPort: s.localPort,
      remoteHost: s.remoteHost,
      remotePort: s.remotePort,
      peerCount: s.peers.size,
      tx: s.tx,
      rx: s.rx,
      txPackets: s.txPackets,
      rxPackets: s.rxPackets,
      openedAt: s.openedAt,
      lastActivity: s.lastActivity,
      lastError: s.lastError || null
    }))
  };
}

function broadcastStats() {
  if (!popupPorts.size) return;
  const data = snapshot();
  for (const port of popupPorts) {
    try { port.postMessage(data); } catch (_) {}
  }
}

// ==========================================
// Native host connection
// ==========================================
function ensureNativePort() {
  if (nativePort) return nativePort;

  try {
    nativePort = api.runtime.connectNative(NATIVE_HOST_NAME);

    nativePort.onMessage.addListener((msg) => {
      meterInbound(msg);

      // Responses go to the requesting tab; socket events go to the socket owner.
      let target = null;
      if (msg.id && pendingRequests.has(msg.id)) {
        target = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
      } else if (msg.socketId) {
        target = sockets.get(msg.socketId)?.port || null;
      }

      if (target && activeContentPorts.has(target)) {
        try { target.postMessage(msg); } catch (_) {}
      } else if (!target) {
        // Unknown owner (e.g. close event after cleanup): broadcast; bridges ignore foreign ids.
        for (const port of activeContentPorts) {
          try { port.postMessage(msg); } catch (_) {}
        }
      }
    });

    nativePort.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Native host disconnected';
      console.warn('[PortfoliOS-Relay-BG] Native host disconnected:', err);
      nativePort = null;
      sockets.clear();
      for (const port of activeContentPorts) {
        try { port.postMessage({ type: 'host.disconnected', error: err }); } catch (_) {}
      }
      pendingRequests.clear();
      updateSampler();
      broadcastStats();
    });

    console.log('[PortfoliOS-Relay-BG] Connected to native host:', NATIVE_HOST_NAME);
    return nativePort;
  } catch (err) {
    console.error('[PortfoliOS-Relay-BG] Failed to connect to native host:', err);
    nativePort = null;
    return null;
  }
}

// ==========================================
// Popup status probe
// ==========================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'checkStatus') return;
  const started = performance.now();
  try {
    api.runtime.sendNativeMessage(NATIVE_HOST_NAME, { type: 'ping' }, (response) => {
      const latencyMs = Math.round(performance.now() - started);
      if (api.runtime.lastError || !response || response.type !== 'pong') {
        sendResponse({
          online: false,
          error: api.runtime.lastError ? api.runtime.lastError.message : 'No response from host'
        });
      } else {
        sendResponse({
          online: true,
          host: NATIVE_HOST_NAME,
          latencyMs,
          version: response.version || null,
          platform: response.platform || null,
          runtime: response.runtime || null
        });
      }
    });
  } catch (err) {
    sendResponse({ online: false, error: err.message });
  }
  return true; // async response
});

// ==========================================
// Port connections (content bridges + popup)
// ==========================================
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'portfolios-relay-popup') {
    popupPorts.add(port);
    updateSampler();
    try { port.postMessage(snapshot()); } catch (_) {}
    port.onDisconnect.addListener(() => {
      popupPorts.delete(port);
      updateSampler();
    });
    return;
  }

  if (port.name !== 'portfolios-relay-bridge') return;

  const tab = port.sender?.tab;
  portInfo.set(port, {
    tabId: tab?.id ?? null,
    url: port.sender?.url || tab?.url || '',
    title: tab?.title || '',
    frameId: port.sender?.frameId ?? 0,
    connectedAt: Date.now()
  });
  activeContentPorts.add(port);
  updateSampler();
  console.log('[PortfoliOS-Relay-BG] Content bridge connected from', portInfo.get(port).url);

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

    if (msg.id) pendingRequests.set(msg.id, port);
    meterOutbound(msg, port);

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
    portInfo.delete(port);
    for (const [id, reqPort] of pendingRequests.entries()) {
      if (reqPort === port) pendingRequests.delete(id);
    }

    // Release sockets owned by the closed tab/frame so they do not leak in the host.
    for (const [socketId, record] of sockets.entries()) {
      if (record.port !== port) continue;
      if (nativePort) {
        try { nativePort.postMessage({ type: `${record.proto}.close`, socketId }); } catch (_) {}
      }
      sockets.delete(socketId);
    }

    // No tabs use the relay any more: stop the native host to save resources.
    if (activeContentPorts.size === 0 && nativePort) {
      try { nativePort.disconnect(); } catch (_) {}
      nativePort = null;
      console.log('[PortfoliOS-Relay-BG] All content bridges disconnected; closed native host.');
    }
    updateSampler();
    broadcastStats();
  });
});

// Keep tab titles fresh for the popup's active-connection card.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.title && !changeInfo.url) return;
  for (const info of portInfo.values()) {
    if (info.tabId !== tabId) continue;
    if (tab.title) info.title = tab.title;
    if (tab.url) info.url = tab.url;
  }
});
