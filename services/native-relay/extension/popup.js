/**
 * PortfoliOS Native Relay - Popup Controller
 * Shows service health, live UDP/TCP traffic metered by the background worker,
 * the active PortfoliOS connection and quick navigation to the desktop experience.
 */

const PORTFOLIOS_HOSTS = ['os.bl4ut0.dev', 'os.bl4ut0.com', 'localhost', '127.0.0.1'];
const PORTFOLIOS_TAB_PATTERNS = ['*://os.bl4ut0.dev/*', '*://os.bl4ut0.com/*', '*://localhost/*', '*://127.0.0.1/*'];
const DEFAULT_ORIGIN = 'https://os.bl4ut0.dev';

const $ = (id) => document.getElementById(id);

const state = {
  hostOnline: null,
  webOnline: null,
  stats: null,
  portfoliosTabs: []
};

// ==========================================
// Formatting helpers
// ==========================================
function formatBytes(bytes) {
  if (!bytes || bytes < 1) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

const formatRate = (bytesPerSecond) => `${formatBytes(bytesPerSecond)}/s`;

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`;
}

function isPortfoliosUrl(url) {
  try { return PORTFOLIOS_HOSTS.includes(new URL(url).hostname); } catch (_) { return false; }
}

function describeTab(url) {
  try {
    const parsed = new URL(url);
    const view = parsed.searchParams.get('view') || 'selector';
    return { host: parsed.host, view };
  } catch (_) {
    return { host: '', view: '' };
  }
}

// ==========================================
// Service health
// ==========================================
function setChip(dotId, textId, status, text) {
  $(dotId).className = `dot dot-${status}`;
  $(textId).textContent = text;
}

function checkNativeHost() {
  setChip('host-dot', 'host-status-text', 'checking', 'Checking…');
  chrome.runtime.sendMessage({ type: 'checkStatus' }, (res) => {
    if (chrome.runtime.lastError || !res || !res.online) {
      state.hostOnline = false;
      setChip('host-dot', 'host-status-text', 'offline', 'Not installed');
      $('host-chip').title = 'Run host/register-host.ps1, then Recheck.';
      $('footer-note').textContent = 'Native host unavailable';
    } else {
      state.hostOnline = true;
      const version = res.version ? ` · v${res.version}` : '';
      setChip('host-dot', 'host-status-text', 'online', `${res.latencyMs} ms${version}`);
      $('host-chip').title = [res.host, res.platform, res.runtime].filter(Boolean).join('\n');
      $('footer-note').textContent = res.platform ? `Host ${res.platform}` : 'Native Messaging';
    }
    renderOverall();
  });
}

async function checkWebService() {
  setChip('web-dot', 'web-status-text', 'checking', 'Checking…');
  const endpoints = [`${DEFAULT_ORIGIN}/manifest.webmanifest`, 'https://os.bl4ut0.com/manifest.webmanifest'];
  let found = null;
  let latency = 0;
  for (const endpoint of endpoints) {
    const started = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch(endpoint, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: controller.signal });
      clearTimeout(timeoutId);
      latency = Math.round(performance.now() - started);
      found = new URL(endpoint).host;
      break;
    } catch (_) {}
  }
  state.webOnline = !!found;
  if (found) setChip('web-dot', 'web-status-text', 'online', `${found} · ${latency} ms`);
  else setChip('web-dot', 'web-status-text', 'offline', 'Unreachable');
  renderOverall();
}

function renderOverall() {
  const dot = $('overall-status-dot');
  const label = $('overall-status-label');
  const live = (state.stats?.sockets?.length || 0) > 0;

  if (state.hostOnline === null || state.webOnline === null) {
    dot.className = 'dot dot-checking';
    label.textContent = 'Checking';
  } else if (state.hostOnline && live) {
    dot.className = 'dot dot-active';
    label.textContent = 'Live';
  } else if (state.hostOnline && state.webOnline) {
    dot.className = 'dot dot-online';
    label.textContent = 'Ready';
  } else if (!state.hostOnline && !state.webOnline) {
    dot.className = 'dot dot-offline';
    label.textContent = 'Offline';
  } else {
    dot.className = 'dot dot-checking';
    label.textContent = state.hostOnline ? 'No web' : 'No host';
  }
}

// ==========================================
// Live traffic
// ==========================================
function drawSparkline(history) {
  const canvas = $('sparkline');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 296;
  const height = canvas.clientHeight || 44;
  if (canvas.width !== width * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const points = 60;
  const series = Array.from({ length: points }, (_, i) => history[history.length - points + i] || null);
  const up = series.map((s) => (s ? s.udpTx + s.tcpTx : 0));
  const down = series.map((s) => (s ? s.udpRx + s.tcpRx : 0));
  const max = Math.max(1024, ...up, ...down);

  // Baseline grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2 + 0.5);
  ctx.lineTo(width, height / 2 + 0.5);
  ctx.stroke();

  const plot = (values, stroke, fill) => {
    const step = width / (points - 1);
    const y = (v) => height - 3 - (v / max) * (height - 8);
    ctx.beginPath();
    values.forEach((v, i) => (i ? ctx.lineTo(i * step, y(v)) : ctx.moveTo(0, y(v))));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  plot(down, '#4ade80', 'rgba(74, 222, 128, 0.10)');
  plot(up, '#22d3ee', 'rgba(34, 211, 238, 0.10)');

  ctx.fillStyle = 'rgba(148,163,184,0.7)';
  ctx.font = '9px Segoe UI, sans-serif';
  ctx.fillText(`peak ${formatRate(max)}`, 6, 11);
}

function renderTraffic(stats) {
  const history = stats.history || [];
  const last = history[history.length - 1] || { udpTx: 0, udpRx: 0, tcpTx: 0, tcpRx: 0 };
  const sockets = stats.sockets || [];
  const totals = stats.totals;

  $('rate-up').textContent = formatRate(last.udpTx + last.tcpTx);
  $('rate-down').textContent = formatRate(last.udpRx + last.tcpRx);
  $('total-up').textContent = formatBytes(totals.udp.tx + totals.tcp.tx);
  $('total-down').textContent = formatBytes(totals.udp.rx + totals.tcp.rx);

  for (const proto of ['udp', 'tcp']) {
    $(`${proto}-up`).textContent = formatRate(last[`${proto}Tx`]);
    $(`${proto}-down`).textContent = formatRate(last[`${proto}Rx`]);
    $(`${proto}-packets`).textContent = (totals[proto].txPackets + totals[proto].rxPackets).toLocaleString();
    $(`${proto}-open`).textContent = sockets.filter((s) => s.proto === proto).length;
  }

  $('session-duration').textContent = stats.sessionStartedAt
    ? `Session ${formatDuration(Date.now() - stats.sessionStartedAt)}`
    : 'Idle';

  drawSparkline(history);
}

// ==========================================
// Active connection
// ==========================================
function renderConnection() {
  const stats = state.stats || { tabs: [], sockets: [] };
  const sockets = stats.sockets || [];
  const bridged = stats.tabs || [];
  const pill = $('conn-pill');
  const title = $('conn-title');
  const detail = $('conn-detail');

  const primaryBridge = bridged[0];
  const primaryTab = primaryBridge
    ? { title: primaryBridge.title, url: primaryBridge.url }
    : state.portfoliosTabs[0];

  if (!primaryTab) {
    pill.className = 'pill pill-idle';
    pill.textContent = 'None';
    title.textContent = 'No PortfoliOS tab open';
    detail.textContent = 'Open the desktop to start a session.';
  } else {
    const { host, view } = describeTab(primaryTab.url);
    title.textContent = primaryTab.title || 'PortfoliOS';
    if (sockets.length) {
      pill.className = 'pill pill-live';
      pill.textContent = 'Live';
      const since = primaryBridge ? formatDuration(Date.now() - primaryBridge.connectedAt) : '';
      detail.textContent = `${host} · ${view} · bridge ${since}`;
    } else if (primaryBridge) {
      pill.className = 'pill pill-online';
      pill.textContent = 'Bridged';
      detail.textContent = `${host} · ${view} · no open sockets`;
    } else {
      pill.className = 'pill pill-idle';
      pill.textContent = 'Idle';
      detail.textContent = `${host} · ${view} · relay not in use`;
    }
    const extra = Math.max(bridged.length, state.portfoliosTabs.length) - 1;
    if (extra > 0) detail.textContent += ` · +${extra} tab${extra > 1 ? 's' : ''}`;
  }

  // Socket list (rebuilt with textContent only)
  const list = $('socket-list');
  list.replaceChildren();
  const sorted = [...sockets].sort((a, b) => b.lastActivity - a.lastActivity).slice(0, 12);
  for (const socket of sorted) {
    const item = document.createElement('li');
    item.className = 'socket' + (socket.lastError ? ' is-error' : '');

    const tag = document.createElement('span');
    tag.className = `proto-tag proto-${socket.proto}`;
    tag.textContent = socket.proto.toUpperCase();

    const route = document.createElement('div');
    route.className = 'socket-route';
    const local = socket.localPort ? `:${socket.localPort}` : ':…';
    const remote = socket.remoteHost ? `${socket.remoteHost}:${socket.remotePort ?? '?'}` : 'awaiting peer';
    route.textContent = `${local} → ${remote}`;
    const meta = document.createElement('small');
    const peers = socket.peerCount > 1 ? ` · ${socket.peerCount} peers` : '';
    meta.textContent = socket.lastError
      ? socket.lastError
      : `${socket.state}${peers} · ${formatDuration(Date.now() - socket.openedAt)}`;
    route.appendChild(meta);

    const bytes = document.createElement('div');
    bytes.className = 'socket-bytes';
    const up = document.createElement('span');
    up.className = 'up';
    up.textContent = `↑ ${formatBytes(socket.tx)}`;
    const down = document.createElement('span');
    down.className = 'down';
    down.textContent = `↓ ${formatBytes(socket.rx)}`;
    bytes.append(up, down);

    item.append(tag, route, bytes);
    list.appendChild(item);
  }

  renderDesktopButton();
}

function renderDesktopButton() {
  const tab = state.portfoliosTabs[0];
  if (tab) {
    const { host, view } = describeTab(tab.url);
    $('btn-desktop-label').textContent = view === 'desktop' ? 'Go to Desktop Experience' : 'Switch to Desktop Experience';
    $('btn-desktop-sub').textContent = `${host} · open tab`;
  } else {
    $('btn-desktop-label').textContent = 'Open Desktop Experience';
    $('btn-desktop-sub').textContent = `${new URL(DEFAULT_ORIGIN).host} · private profile`;
  }
}

function refreshTabs() {
  chrome.tabs.query({ url: PORTFOLIOS_TAB_PATTERNS }, (tabs) => {
    state.portfoliosTabs = (tabs || [])
      .filter((t) => isPortfoliosUrl(t.url))
      .sort((a, b) => Number(b.active) - Number(a.active) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
    renderConnection();
  });
}

// ==========================================
// Navigation
// ==========================================
function navigateTo(targetView) {
  const focus = (tab) => {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  };

  const existing = state.portfoliosTabs[0];
  if (existing) {
    const url = new URL(existing.url);
    if (url.searchParams.get('view') === targetView) {
      // Already in that experience: focus without reloading (keeps games/sessions alive).
      focus(existing);
    } else {
      url.searchParams.set('view', targetView);
      chrome.tabs.update(existing.id, { active: true, url: url.toString() });
      chrome.windows.update(existing.windowId, { focused: true });
    }
  } else {
    chrome.tabs.create({ url: `${DEFAULT_ORIGIN}/?view=${targetView}` });
  }
  window.close();
}

// ==========================================
// Wiring
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  $('btn-desktop').addEventListener('click', () => navigateTo('desktop'));
  $('btn-mobile').addEventListener('click', () => navigateTo('mobile'));
  $('btn-recheck').addEventListener('click', () => {
    checkNativeHost();
    checkWebService();
    refreshTabs();
  });

  const statsPort = chrome.runtime.connect({ name: 'portfolios-relay-popup' });
  statsPort.onMessage.addListener((msg) => {
    if (msg?.type !== 'stats') return;
    state.stats = msg;
    renderTraffic(msg);
    renderConnection();
    renderOverall();
  });

  checkNativeHost();
  checkWebService();
  refreshTabs();
  setInterval(refreshTabs, 3000);
});
