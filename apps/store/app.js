(function() {
    const refresh = () => window.renderStore?.();

    window.appRegistry.store = {
        title: "Store",
        icon: "fa-solid fa-shop",
        windowClass: "store-window service-window",
        renderBody: () => window.renderAppTemplate("store"),
        onOpen: refresh,
        onRestore: refresh,
        onFocus: refresh
    };
})();
