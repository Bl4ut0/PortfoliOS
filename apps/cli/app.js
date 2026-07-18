(function() {
    const refresh = (windowEl) => {
        window.initializeCliWindow?.();
        const output = windowEl?.querySelector("#terminal-output");
        if (output && !output.childNodes.length) window.startCliIntro?.();
    };

    window.appRegistry.cli = {
        title: "Portfolio CLI",
        icon: "fa-solid fa-terminal",
        windowClass: "cli-window utility-window",
        renderBody: () => window.renderAppTemplate("cli"),
        onOpen: refresh,
        onRestore: refresh,
        onFocus: refresh
    };
})();
