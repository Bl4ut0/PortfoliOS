(function() {
    const refresh = () => window.initializeSettingsWindow?.();

    window.appRegistry.settings = {
        title: "Settings",
        icon: "fa-solid fa-sliders",
        windowClass: "settings-window utility-window",
        renderBody: () => window.renderAppTemplate("settings"),
        onOpen: refresh,
        onRestore: refresh,
        onFocus: refresh
    };
})();
