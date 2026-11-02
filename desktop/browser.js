/** Desktop lifecycle adapter for the shared Browser workspace. */
(function () {
    let controller = null, pendingUrl = null;
    window.renderBrowser = () => {
        const root = document.querySelector('[data-window="browser"] [data-web-browser]');
        if (!root) return;
        if (controller && (controller.disposed || controller.owner !== window.state?.currentUserId)) { void controller.destroy(); controller = null; }
        if (!controller) controller = window.BrowserWorkspace.mount(root);
        if (pendingUrl) { controller.navigate(pendingUrl); pendingUrl = null; }
    };
    window.renderBrowserPage = id => {
        const bookmark = (window.browserBookmarks || []).find(item => item.id === id);
        if (!bookmark || (window.isVisibleForCurrentUser && !window.isVisibleForCurrentUser(bookmark.systemId))) return;
        if (window.state) window.state.browserBookmark = bookmark.id;
        if (!window.BrowserWorkspace.normalizeAddress(bookmark.url)) { window.showDesktopToast?.('This is an internal portfolio route. Open it from the project explorer.'); return; }
        if (controller) controller.navigate(bookmark.url);
        else pendingUrl = bookmark.url;
    };
    window.DesktopBrowser = {
        refresh: window.renderBrowser,
        pause: () => controller?.pause('Remote browsing ends when minimized to conserve the shared allowance.'),
        close: async () => { const old = controller; controller = null; await old?.destroy(); }
    };

    // Integrated window drag and maximize events from the embedded browser tabstrip
    window.addEventListener('message', (event) => {
        if (event.data?.source !== 'portfolios-browserjs') return;
        const windowEl = document.querySelector('.desktop-window.browser-window');
        if (!windowEl) return;

        if (event.data.type === 'window-dblclick') {
            const maxBtn = windowEl.querySelector('[data-maximize-window="browser"]');
            maxBtn?.click();
            return;
        }

        if (event.data.type === 'window-drag-start') {
            if (windowEl.classList.contains('is-maximized')) return;
            const surface = document.querySelector('.desktop-wallpaper')
                || document.getElementById('desktop-experience');
            if (!surface) return;

            window.openDesktopWindow?.('browser');
            window.freezeWindowGeometry?.(windowEl, surface);
            windowEl.classList.add('is-dragging');

            const bounds = window.getDesktopBounds ? window.getDesktopBounds(surface) : { width: window.innerWidth, usableHeight: window.innerHeight };
            const startX = event.data.screenX;
            const startY = event.data.screenY;
            const startLeft = parseFloat(windowEl.style.left) || 0;
            const startTop = parseFloat(windowEl.style.top) || 0;
            const startWidth = windowEl.offsetWidth;

            const onMove = (msgEvent) => {
                if (msgEvent.data?.source !== 'portfolios-browserjs' || msgEvent.data?.type !== 'window-drag-move') return;
                const scale = window.getDesktopScale ? window.getDesktopScale() : 1;
                const dx = (msgEvent.data.screenX - startX) / scale;
                const dy = (msgEvent.data.screenY - startY) / scale;
                const nextLeft = Math.max(8 - startWidth + 100, Math.min(bounds.width - 100, startLeft + dx));
                const nextTop = Math.max(8, Math.min(bounds.usableHeight - 40, startTop + dy));
                windowEl.style.left = `${nextLeft}px`;
                windowEl.style.top = `${nextTop}px`;
            };

            const onEnd = (msgEvent) => {
                if (msgEvent.type === 'message' && (msgEvent.data?.source !== 'portfolios-browserjs' || msgEvent.data?.type !== 'window-drag-end')) return;
                windowEl.classList.remove('is-dragging');
                window.removeEventListener('message', onMove);
                window.removeEventListener('message', onEnd);
                window.removeEventListener('pointerup', onEnd);
            };

            window.addEventListener('message', onMove);
            window.addEventListener('message', onEnd);
            window.addEventListener('pointerup', onEnd);
        }
    });
})();
