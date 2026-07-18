(function() {
    const refresh = () => window.renderBrowser?.();

    window.appRegistry.browser = {
        title: "Browser",
        icon: "fa-brands fa-chrome",
        windowClass: "browser-window document-window",
        renderBody: () => window.renderAppTemplate("browser"),
        onOpen: refresh,
        onRestore: refresh,
        onFocus: refresh
    };
})();
