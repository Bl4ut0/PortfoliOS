(function() {
    const refresh = () => window.renderNetworkMap?.();

    window.appRegistry.network = {
        title: "Network Map",
        icon: "fa-solid fa-diagram-project",
        windowClass: "network-window service-window",
        renderBody: () => window.renderAppTemplate("network"),
        onOpen: refresh,
        onRestore: refresh,
        onFocus: refresh
    };
})();
