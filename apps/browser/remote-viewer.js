// No API key or provider admin token is available to this viewer.
let client = null, connected = false, expiry = null;
const notify = type => parent.postMessage({ source: 'portfolios-remote', type }, location.origin);
function destroy() { clearTimeout(expiry); const previous = client; client = null; previous?.destroy(); }
window.addEventListener('message', async event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.source !== 'portfolios-browser' || event.data.type !== 'connect' || connected) return;
    const data = event.data;
    try {
        const url = new URL(data.embedUrl);
        if (url.protocol !== 'https:' || !url.hostname.endsWith('.hyperbeam.com') || url.username || url.password || !/^[a-f0-9]{64}$/.test(data.leaseToken) || !Number.isFinite(data.expiresAt) || data.expiresAt * 1000 <= Date.now()) throw new Error('Invalid connection');
        connected = true;
        const { default: Hyperbeam } = await import('https://unpkg.com/@hyperbeam/web@0.0.38/dist/index.js');
        client = await Hyperbeam(document.getElementById('remote-container'), url.href, {
            timeout: 15000, delegateKeyboard: false, webhookUserdata: { leaseToken: data.leaseToken },
            onDisconnect: () => { destroy(); notify('ended'); },
            onCloseWarning: ({ deadline }) => { if (deadline) document.getElementById('remote-status').textContent = 'This remote session will end shortly.'; }
        });
        document.getElementById('remote-status').textContent = '';
        expiry = setTimeout(() => { destroy(); notify('ended'); }, Math.max(0, data.expiresAt * 1000 - Date.now()));
    } catch { destroy(); document.getElementById('remote-status').textContent = 'Remote connection unavailable. Return to Browser and choose another service.'; notify('error'); }
});
window.addEventListener('pagehide', destroy);
