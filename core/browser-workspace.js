/** Shared on-demand Browser UI. Provider traffic never passes through PortfoliOS. */
(function () {
    const providers = [
        { id: 'proxysite', name: 'ProxySite', url: 'https://www.proxysite.com/', icon: 'fa-solid fa-globe', detail: 'Free web proxy · opens in a separate tab' },
        { id: 'hideme', name: 'hide.me', url: 'https://hide.me/en/proxy', icon: 'fa-solid fa-shield-halved', detail: 'Free web proxy · no provider account required' },
        { id: 'hyperbeam', name: 'Hyperbeam', icon: 'fa-solid fa-cloud', detail: 'Remote browser · shared monthly free allowance' }
    ];
    const controllers = new Set();
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    function normalizeAddress(value) {
        const raw = String(value || '').trim();
        if (!raw) return null;
        try {
            const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : 'https://' + raw);
            return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
        } catch { return null; }
    }
    const profile = () => String(window.state?.currentUserId || 'bl4ut0').replace(/[^a-z0-9_-]/gi, '');
    const preferenceKey = id => `bl4ut0_${id}_BrowserProvider`;
    function remembered(id) {
        try { const value = localStorage.getItem(preferenceKey(id)); return providers.some(p => p.id === value) ? value : null; } catch { return null; }
    }
    function render() {
        return `<section class="web-browser" data-web-browser>
            <header class="web-browser-heading"><span aria-hidden="true">◎</span><div><p>Your window to the web</p><h2>Browser</h2></div></header>
            <form class="web-browser-address" data-web-address-form><input data-web-address aria-label="Website address" autocomplete="off" spellcheck="false" inputmode="url" placeholder="Enter a website address"><button type="submit">Go</button><button type="button" data-web-change>Services</button></form>
            <nav class="web-browser-bookmarks" data-web-bookmarks aria-label="Website bookmarks"></nav>
            <div class="web-browser-message" data-web-message role="status" aria-live="polite"></div>
            <section class="web-browser-chooser" data-web-chooser><h3>Choose your browsing service</h3><p>Websites are fetched by your chosen provider. Browsing traffic stays off the PortfoliOS server.</p>
                <div class="web-provider-list" role="group" aria-label="Browsing services">${providers.map(p => `<button type="button" class="web-provider" data-web-provider="${p.id}" aria-pressed="false"><i class="${p.icon}" aria-hidden="true"></i><span><strong>${p.name}</strong><small>${p.detail}</small>${p.id === 'hyperbeam' ? '<small data-web-quota>Checking availability…</small>' : ''}</span><span aria-hidden="true">›</span></button>`).join('')}</div>
                <label class="web-browser-remember"><input type="checkbox" data-web-remember> Remember my choice for this profile</label>
                <a class="web-browser-primary" data-web-launch target="_blank" rel="noopener noreferrer" hidden>Continue</a><button type="button" class="web-browser-primary" data-web-start hidden>Start remote browser</button>
                <p class="web-browser-note">Free web proxies open their own page, where you enter the destination address. Their cookies are managed by the provider and are not isolated by your PortfoliOS profile.</p>
            </section>
            <section class="web-browser-handoff" data-web-handoff hidden><h3 data-web-handoff-title></h3><p>Enter your destination on the provider’s page. You can copy the address below before opening it.</p><div class="web-browser-destination"><code data-web-destination></code><button type="button" data-web-copy>Copy address</button></div><a class="web-browser-primary" data-web-reopen target="_blank" rel="noopener noreferrer">Open provider in new tab ↗</a><p class="web-browser-note">PortfoliOS cannot read or control that tab. Use its browser controls to navigate.</p></section>
            <section class="web-browser-remote" data-web-remote hidden><div class="web-browser-remote-bar"><span data-web-countdown></span><button type="button" data-web-stop>End session</button></div><div data-web-viewport></div></section>
            <footer class="web-browser-note">Your provider handles the websites you visit. A private workspace does not make browsing invisible to that provider.</footer>
        </section>`;
    }
    function mount(root, options = {}) {
        const owner = profile(), aborter = new AbortController(), signal = aborter.signal;
        const find = selector => root.querySelector(selector);
        let selected = remembered(owner), status = null, lease = null, timer = null, busy = false, disposed = false, generation = 0, monitoring = false, lastMonitor = 0;
        const address = find('[data-web-address]'), remember = find('[data-web-remember]');
        remember.checked = !!selected;
        const message = text => { if (!disposed) find('[data-web-message]').textContent = text || ''; };
        const validOwner = () => !disposed && profile() === owner;
        function saveChoice() {
            try {
                if (remember.checked && selected) localStorage.setItem(preferenceKey(owner), selected);
                else localStorage.removeItem(preferenceKey(owner));
                void window.savePreferencesToFilesystem?.();
            } catch { message('Your choice could not be remembered on this device.'); }
        }
        async function api(action, data = {}, keepalive = false) {
            const requestAbort = new AbortController();
            const cancel = () => requestAbort.abort();
            if (signal.aborted && action === 'status') cancel();
            if (action === 'status') signal.addEventListener('abort', cancel, { once: true });
            const deadline = setTimeout(cancel, action === 'status' ? 15000 : 25000);
            let response;
            try { response = await fetch('/apps/browser/hyperbeam.php' + (action === 'status' ? '?action=status' : ''), action === 'status'
                ? { credentials: 'same-origin', cache: 'no-store', signal: requestAbort.signal }
                : { method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, csrf: status?.csrf, profile: owner, ...data }), signal: requestAbort.signal });
            } finally { clearTimeout(deadline); signal.removeEventListener('abort', cancel); }
            let result;
            try { result = await response.json(); } catch { throw new Error('Remote browsing is unavailable. Choose a free proxy service.'); }
            if (!response.ok) throw new Error(result.message || 'Remote browsing is unavailable.');
            return result;
        }
        function update() {
            if (!validOwner()) return;
            const provider = providers.find(p => p.id === selected);
            root.querySelectorAll('[data-web-provider]').forEach(button => {
                button.setAttribute('aria-pressed', String(button.dataset.webProvider === selected)); button.disabled = busy;
            });
            const launch = find('[data-web-launch]'), start = find('[data-web-start]');
            launch.hidden = !provider?.url;
            if (provider?.url) { launch.href = provider.url; launch.textContent = `Continue with ${provider.name} ↗`; }
            start.hidden = selected !== 'hyperbeam'; start.disabled = busy || !status?.available;
            start.textContent = busy ? 'Starting remote browser…' : 'Start remote browser';
            find('[data-web-quota]').textContent = status?.available ? `${Math.floor(status.remainingSeconds / 60).toLocaleString()} min available under the shared safety cap` : status?.message || 'Checking availability…';
            find('[data-web-change]').disabled = busy;
            address.readOnly = !!lease || busy;
            find('[data-web-address-form] button[type="submit"]').disabled = !!lease || busy;
        }
        async function refreshStatus() {
            try { const next = await api('status'); if (validOwner()) status = next; update(); return next.monitoringOk !== false && !next.mustEnd; }
            catch { if (!signal.aborted && validOwner()) status = { ...status, available: false, message: 'Remote browsing unavailable. Free proxies are ready.' }; }
            update(); return false;
        }
        function showChooser() {
            find('[data-web-chooser]').hidden = false; find('[data-web-handoff]').hidden = true; find('[data-web-remote]').hidden = true;
        }
        function handoff(provider) {
            saveChoice(); find('[data-web-chooser]').hidden = true; find('[data-web-handoff]').hidden = false;
            find('[data-web-handoff-title]').textContent = `Browse with ${provider.name}`;
            find('[data-web-reopen]').href = provider.url;
            const target = normalizeAddress(address.value);
            find('[data-web-destination]').textContent = target || 'Enter an address above, or on the provider’s page.';
            find('[data-web-copy]').disabled = !target;
            message(`Use ${provider.name} in its own tab to browse through its servers.`);
        }
        async function stop(reason = '') {
            generation++;
            const current = lease; lease = null; clearInterval(timer); timer = null;
            find('[data-web-viewport]').replaceChildren();
            if (current) {
                try { await api('stop', { lease: current.lease }, true); }
                catch { if (!disposed) message('Disconnected locally. The remote session will end at its enforced timeout.'); }
            }
            if (!disposed) { showChooser(); update(); if (reason) message(reason); }
        }
        async function start() {
            if (busy || !status?.available || !validOwner()) return;
            const target = address.value.trim() ? normalizeAddress(address.value) : 'https://bl4ut0.dev/';
            if (!target) { message('Enter a valid HTTP or HTTPS website address.'); return; }
            if (!('credentialless' in document.createElement('iframe'))) { message('Embedded remote browsing requires a current Chrome or Edge browser. Choose a free proxy instead.'); return; }
            busy = true; message('Starting your separate remote browser…'); update();
            const epoch = ++generation;
            try {
                saveChoice();
                const result = await api('start', { url: target, mobile: !!options.mobile, requestId: crypto.randomUUID() });
                if (!validOwner() || epoch !== generation) { await api('stop', { lease: result.lease }, true); return; }
                lease = result;
                const frame = document.createElement('iframe');
                frame.className = 'web-browser-remote-frame'; frame.title = 'Hyperbeam remote browser'; frame.credentialless = true;
                frame.allow = 'autoplay; fullscreen; clipboard-read; clipboard-write'; frame.referrerPolicy = 'no-referrer';
                frame.src = '/apps/browser/remote.php?v=' + encodeURIComponent(window.PortfolioLoadingManifest?.release || '1');
                frame.addEventListener('load', () => {
                    if (lease === result && validOwner()) frame.contentWindow.postMessage({ source: 'portfolios-browser', type: 'connect', embedUrl: result.embedUrl, leaseToken: result.leaseToken, expiresAt: result.expiresAt }, location.origin);
                }, { signal });
                find('[data-web-viewport]').replaceChildren(frame);
                find('[data-web-chooser]').hidden = true; find('[data-web-handoff]').hidden = true; find('[data-web-remote]').hidden = false;
                const tick = () => {
                    if (!lease) return;
                    const seconds = Math.max(0, Math.ceil((lease.expiresAt * 1000 - Date.now()) / 1000));
                    find('[data-web-countdown]').textContent = `Hyperbeam · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} remaining`;
                    if (!seconds) void stop('Session allowance reached. Choose a service to continue.');
                    else if (!monitoring && Date.now() - lastMonitor >= 30000) {
                        monitoring = true; lastMonitor = Date.now();
                        void refreshStatus().then(ok => { if (!ok && lease) void stop('Remote usage cannot be verified or has reached its safety limit. Choose a free proxy to continue.'); }).finally(() => { monitoring = false; });
                    }
                };
                lastMonitor = Date.now(); tick(); timer = setInterval(tick, 1000);
                message('Use the remote browser’s address bar and navigation controls. Ending this session clears its remote cookies.');
            } catch (error) { if (validOwner()) { message(error.message); void refreshStatus(); } }
            finally { busy = false; update(); }
        }
        root.addEventListener('click', event => {
            const choice = event.target.closest('[data-web-provider]');
            if (choice && !busy) { selected = choice.dataset.webProvider; message(''); update(); }
            if (event.target.closest('[data-web-launch], [data-web-reopen]')) {
                const provider = providers.find(p => p.id === selected); if (provider?.url) handoff(provider);
            }
            if (event.target.closest('[data-web-change]')) { void stop(); void refreshStatus(); }
            if (event.target.closest('[data-web-start]')) void start();
            if (event.target.closest('[data-web-stop]')) void stop('Remote browser ended.');
            if (event.target.closest('[data-web-copy]')) {
                const target = normalizeAddress(address.value);
                if (target && navigator.clipboard) void navigator.clipboard.writeText(target).then(() => message('Address copied. Paste it into the provider’s address field.')).catch(() => message('Select and copy the address shown below.'));
                else message('Select and copy the address shown below.');
            }
            const bookmark = event.target.closest('[data-web-bookmark]'); if (bookmark) navigate(bookmark.dataset.webBookmark);
        }, { signal });
        root.addEventListener('submit', event => {
            if (!event.target.matches('[data-web-address-form]')) return;
            event.preventDefault();
            const target = normalizeAddress(address.value);
            if (!target) { message('Enter a valid HTTP or HTTPS website address.'); return; }
            address.value = target;
            if (selected === 'hyperbeam') void start();
            else { const provider = providers.find(p => p.id === selected); if (provider) handoff(provider); else { showChooser(); message('Choose a browsing service to continue.'); } }
        }, { signal });
        remember.addEventListener('change', saveChoice, { signal });
        window.addEventListener('message', event => {
            const frame = find('.web-browser-remote-frame');
            if (event.origin !== location.origin || event.source !== frame?.contentWindow || event.data?.source !== 'portfolios-remote') return;
            if (event.data.type === 'ended') void stop('Remote session ended. Choose a service to continue.');
            if (event.data.type === 'error') void stop('The remote connection failed. Choose a service to continue.');
        }, { signal });
        window.addEventListener('pagehide', () => { void stop(); }, { signal });
        document.addEventListener('visibilitychange', () => { if (document.hidden && (lease || busy)) void stop('Remote browsing ended while the page was in the background.'); }, { signal });
        function navigate(value) {
            if (lease) { message('Use the remote browser’s address bar, or end its session before choosing another destination.'); return; }
            const target = normalizeAddress(value); if (!target) return;
            address.value = target; showChooser(); update(); address.focus({ preventScroll: true });
        }
        find('[data-web-bookmarks]').innerHTML = (window.browserBookmarks || []).filter(b => normalizeAddress(b.url) && (!window.isVisibleForCurrentUser || window.isVisibleForCurrentUser(b.systemId))).map(b => `<button type="button" data-web-bookmark="${esc(b.url)}">${esc(b.label)}</button>`).join('');
        const controller = {
            navigate, stop, refreshStatus, get disposed() { return disposed; },
            snapshot: () => ({ address: normalizeAddress(address.value) || '', provider: selected }),
            restore: saved => { if (saved?.address) address.value = normalizeAddress(saved.address) || ''; if (providers.some(p => p.id === saved?.provider)) selected = saved.provider; update(); },
            back: () => { if (!lease && !find('[data-web-chooser]').hidden) return false; void stop(); return true; },
            destroy: async () => { disposed = true; controllers.delete(controller); aborter.abort(); await stop(); }, owner, mobile: !!options.mobile
        };
        controllers.add(controller); update(); void refreshStatus();
        if (selected && selected !== 'hyperbeam') handoff(providers.find(p => p.id === selected));
        return controller;
    }
    window.EventBus?.on('view:changed', view => { for (const controller of controllers) if (view !== (controller.mobile ? 'mobile' : 'desktop')) void controller.stop('Remote browsing ended when changing experiences.'); });
    window.EventBus?.on('user:changed', () => { for (const controller of [...controllers]) void controller.destroy(); });
    window.BrowserWorkspace = { render, mount, normalizeAddress, providers, preferenceKey };
})();
