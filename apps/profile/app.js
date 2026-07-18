(function() {
    const refresh = () => window.applyCurrentUserProfile?.();

    window.appRegistry.profile = {
        title: "Identity",
        icon: "fa-solid fa-id-card",
        windowClass: "profile-window document-window",
        renderBody: () => window.renderAppTemplate("profile"),
        onOpen: refresh,
        onRestore: refresh,
        onFocus: refresh
    };
})();
