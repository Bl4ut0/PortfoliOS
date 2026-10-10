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
        pause: () => controller?.stop('Remote browsing ends when minimized to conserve the shared allowance.'),
        close: async () => { const old = controller; controller = null; await old?.destroy(); }
    };
})();
