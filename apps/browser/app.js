(function () {
    window.appRegistry.browser = {
        title: 'Portal', icon: 'apps/browser/icon.svg', windowClass: 'browser-window document-window',
        renderBody: () => window.BrowserWorkspace.render(),
        onOpen: () => window.DesktopBrowser.refresh(),
        onRestore: () => window.DesktopBrowser.refresh(),
        onFocus: () => window.DesktopBrowser.refresh(),
        onMinimize: () => window.DesktopBrowser.pause(),
        onClose: () => window.DesktopBrowser.close()
    };
})();
