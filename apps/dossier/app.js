(function() {
    const refresh = (windowEl) => {
        window.renderDossier?.(window.state?.activeId);
        const title = windowEl?.querySelector(":scope > .window-bar > span");
        if (title && window.state?.activeId) title.textContent = `dossier/${window.state.activeId}.md`;
    };

    window.appRegistry.dossier = {
        title: "Dossier",
        icon: "fa-solid fa-folder-open",
        windowClass: "dossier-window document-window",
        renderBody: () => window.renderAppTemplate("dossier"),
        onOpen: refresh,
        onRestore: refresh,
        onFocus: refresh
    };
})();
