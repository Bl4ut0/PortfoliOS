(function() {
    const refresh = (windowEl) => {
        window.initializeCliWindow?.();
        if (windowEl && !windowEl.dataset.cliFocusBound) {
            windowEl.dataset.cliFocusBound = "true";
            windowEl.querySelector(".terminal-window")?.addEventListener("click", event => {
                if (event.target.closest("input, button, a") || window.getSelection()?.toString()) return;
                windowEl.querySelector("#terminal-input")?.focus({ preventScroll: true });
            });
        }
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
