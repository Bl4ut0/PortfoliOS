/** Boot, identity and selected-workspace entry points. */
(function () {
    const loader = window.PortfolioLoader;
    let entry = null;
    let workspace = null;
    let storageReady = null;
    let registeredWorker = false;
    const boot = () => document.getElementById("boot-screen");
    function status(message, error = false) {
        let node = document.getElementById("startup-status");
        if (!node) { node = document.createElement("p"); node.id = "startup-status"; node.setAttribute("role", "status"); node.setAttribute("aria-live", "polite"); document.body.appendChild(node); }
        node.textContent = message; node.hidden = !message; node.classList.toggle("is-error", error);
    }
    function showView(view) {
        window.state.view = view; document.body.dataset.view = view;
        document.querySelectorAll("[data-view-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
        document.querySelectorAll(".mode-btn").forEach(button => button.classList.toggle("active", button.dataset.view === view));
        try { const url = new URL(location.href); url.searchParams.set("view", view); history.replaceState({ view }, "", url); } catch (error) {}
        window.EventBus?.emit("view:changed", view);
    }
    window.prepareSessionStorage = () => storageReady ||= (async () => {
        await window.SystemFS.init(); await window.SecurityKernel?.init();
    })().catch(error => { storageReady = null; throw error; });
    function registerWorker() {
        if (registeredWorker || !("serviceWorker" in navigator)) return;
        registeredWorker = true;
        navigator.serviceWorker.register("/sw.js?v=" + loader.manifest.release).then(() => window.addSystemLog?.("system", "Service worker registered.")).catch(error => { registeredWorker = false; window.addSystemLog?.("warning", "Offline support could not be prepared.", error); });
        navigator.serviceWorker.addEventListener("message", event => {
            if (event.data?.source === "portfolio-service-worker" && event.data.type === "system-log") window.addSystemLog?.(event.data.level || "system", event.data.message, event.data.detail);
        });
    }
    function background() {
        const run = () => {
            if (window.state?.sessionChosen && window.isPrivateUser?.() && window.GDriveSync?.getToken()) {
                window.GDriveSync.validateSession({ promptOnInvalid: false }).then(result => {
                    if (result?.valid && window.state.sessionChosen && window.isPrivateUser?.() && window.GDriveSync.getToken() && !window.GDriveSync.syncInProgress) window.triggerGDriveSync?.({ silent: true });
                }).catch(error => window.addSystemLog?.("warning", "Background Drive check failed.", error));
            }
            // Fonts are optional decoration. Neither login nor workspace waits on them.
            loader.style("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@500;600;700&display=swap").catch(() => {});
        };
        if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 2000 }); else setTimeout(run, 0);
    }
    window.startSelectedWorkspace = () => {
        if (workspace) return workspace;
        workspace = (async () => {
            const view = window.state.view;
            const firstMount = !loader.mounted.has(view);
            loader.mark(view + ":workspace-start");
            document.body.dataset.startupStage = "mounting"; status("Opening your workspace…");
            await window.prepareSessionStorage();
            await window.loadPreferencesFromFilesystem?.();
            await loader.mount(view);
            showView(view);
            window.applyCurrentUserProfile?.();
            if (view === "desktop" && firstMount) {
                // Only the selected profile's default windows can start here.
                for (const id of Array.from(window.state.openApps)) await window.openDesktopWindow?.(id);
                window.startCanvas?.();
            }
            window.state.workspaceStarted = true;
            document.body.dataset.startupStage = "workspace";
            status(""); loader.mark(view + ":workspace-ready"); background();
            return true;
        })().catch(error => { document.body.dataset.startupStage = "login"; status(error.message, true); throw error; }).finally(() => { workspace = null; });
        return workspace;
    };
    window.switchView = (requested) => {
        if (entry) return entry;
        const view = requested === "cli" ? "desktop" : requested;
        if (!loader.manifest.shells[view]) return Promise.resolve(false);
        entry = (async () => {
            loader.mark(view + ":selected"); status("Preparing " + view + "…");
            document.querySelectorAll("[data-enter-view]").forEach(button => { button.disabled = true; });
            await loader.login(view);
            window.state.systemStarted = true;
            // Set the experience before constructing its account screen; never mount another shell.
            window.state.view = view; document.body.dataset.view = view;
            loader.prefetch(view);
            loader.style("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css").catch(() => {});
            if (view !== "quick" && !window.state.sessionChosen) {
                document.body.dataset.startupStage = "login";
                window.openSessionChooser(view); boot().classList.add("hidden"); status("");
            } else {
                await window.startSelectedWorkspace(); boot().classList.add("hidden");
                if (requested === "cli") await window.openDesktopWindow?.("cli");
            }
            return true;
        })().catch(error => { status(error.message, true); window.addSystemLog?.("error", "Experience loading failed.", error); return false; }).finally(() => {
            entry = null; document.querySelectorAll("[data-enter-view]").forEach(button => { button.disabled = false; });
        });
        return entry;
    };
    document.addEventListener("DOMContentLoaded", () => {
        document.body.dataset.startupStage = "boot";
        boot().addEventListener("portfolio:selector-ready", registerWorker, { once: true });
        loader.mark("boot-start"); window.runBootSequence();
        if (window.requestIdleCallback) window.requestIdleCallback(registerWorker, { timeout: 2000 }); else setTimeout(registerWorker, 0);
        document.addEventListener("click", event => {
            const button = event.target.closest("[data-enter-view], button[data-view], a[data-view]");
            if (button && !button.disabled) { window.setTopDockOpen(false); void window.switchView(button.dataset.enterView || button.dataset.view); }
            if (event.target.closest("#topbar-tab")) window.setTopDockOpen(!document.body.classList.contains("top-dock-open"));
        });
    }, { once: true });
})();
let topDockDismissTimer = null;
window.setTopDockOpen = (isOpen, autoDismissMs = 0) => {
    if (topDockDismissTimer) {
        window.clearTimeout(topDockDismissTimer);
        topDockDismissTimer = null;
    }
    const topbarTab = window.byId ? window.byId("topbar-tab") : document.getElementById("topbar-tab");

    document.body.classList.toggle("top-dock-open", isOpen);
    document.body.classList.remove("top-dock-carry");
    if (topbarTab) topbarTab.setAttribute("aria-expanded", String(isOpen));

    if (isOpen && autoDismissMs > 0) {
        document.body.classList.add("top-dock-carry");
        topDockDismissTimer = window.setTimeout(() => {
            window.setTopDockOpen(false);
        }, autoDismissMs);
    }
};
