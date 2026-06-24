/**
 * PortfoliOS: Taskbar Component
 * Renders the active/minimized applications in the bottom taskbar and manages desktop window visibilities.
 */

window.renderTaskbar = () => {
    const taskbar = window.byId ? window.byId("taskbar-apps") : document.getElementById("taskbar-apps");
    if (!taskbar) return;
    
    const openApps = Array.from(state.openApps).map((id) => window.appById(id)).filter(Boolean);
    taskbar.innerHTML = openApps.length ? openApps.map((app) => `
        <button type="button" class="taskbar-app ${state.activeWindow === app.id && !state.minimizedApps.has(app.id) ? "active" : ""} ${state.minimizedApps.has(app.id) ? "is-minimized" : ""}"
            data-taskbar-app="${app.id}" title="${state.minimizedApps.has(app.id) ? "Restore" : "Focus"} ${app.title}">
            ${window.getAppIconHtml(app.icon, "taskbar-icon")}
            <span class="taskbar-app-title">${app.title}</span>
        </button>
    `).join("") : "";

    document.querySelectorAll(".desktop-window").forEach((windowEl) => {
        const name = windowEl.dataset.window;
        const shouldShow = state.openApps.has(name) && !state.minimizedApps.has(name);
        windowEl.classList.toggle("is-hidden", !shouldShow);
        windowEl.classList.toggle("active", shouldShow && state.activeWindow === name);
    });

    if (window.appRegistry && window.appRegistry.doomsource && typeof window.appRegistry.doomsource.isDoomActive === "function" && window.appRegistry.doomsource.isDoomActive()) {
        if (state.activeWindow === "doomsource" && state.openApps.has("doomsource") && !state.minimizedApps.has("doomsource")) {
            window.appRegistry.doomsource.resumeDoomGame();
        } else {
            window.appRegistry.doomsource.pauseDoomGame();
        }
    }

    window.renderLocalAITray?.();
};

window.closeLocalAITrayPanel = () => {
    const panel = window.byId ? window.byId("local-ai-tray-panel") : document.getElementById("local-ai-tray-panel");
    const toggle = window.byId ? window.byId("local-ai-tray-toggle") : document.getElementById("local-ai-tray-toggle");
    if (panel) panel.hidden = true;
    if (toggle) toggle.setAttribute("aria-expanded", "false");
};

window.toggleLocalAITrayPanel = () => {
    const panel = window.byId ? window.byId("local-ai-tray-panel") : document.getElementById("local-ai-tray-panel");
    const toggle = window.byId ? window.byId("local-ai-tray-toggle") : document.getElementById("local-ai-tray-toggle");
    if (!panel || !toggle || toggle.hidden) return;
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    toggle.setAttribute("aria-expanded", String(nextOpen));
    if (nextOpen) {
        const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
        const calPanel = window.byId ? window.byId("calendar-panel") : document.getElementById("calendar-panel");
        if (startMenu) startMenu.hidden = true;
        if (calPanel) calPanel.hidden = true;
        if (window.closeVolumePanel) window.closeVolumePanel();
    }
};

window.renderLocalAITray = () => {
    const status = window.LocalAI?.getStatus?.();
    const toggle = window.byId ? window.byId("local-ai-tray-toggle") : document.getElementById("local-ai-tray-toggle");
    const panel = window.byId ? window.byId("local-ai-tray-panel") : document.getElementById("local-ai-tray-panel");
    if (!toggle || !panel || !status) return;

    const isVisible = Boolean(status.enabled);
    toggle.hidden = !isVisible;
    if (!isVisible) {
        window.closeLocalAITrayPanel();
        return;
    }

    toggle.classList.toggle("is-loading", status.status === "loading");
    toggle.classList.toggle("is-generating", status.status === "generating");
    toggle.title = `Local AI: ${status.statusText}`;

    const label = panel.querySelector("#local-ai-tray-status");
    const detail = panel.querySelector("#local-ai-tray-detail");
    if (label) {
        label.textContent = status.status === "generating"
            ? "Active"
            : status.status === "loading"
                ? "Loading"
                : "Ready";
    }
    if (detail) {
        const pct = Math.round((status.progress || 0) * 100);
        detail.textContent = status.status === "loading"
            ? `${status.statusText} (${pct}%)`
            : `${status.modelLabel} is using about ${status.memoryMB} MB.`;
    }
};

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("app:opened", () => window.renderTaskbar());
    window.EventBus.on("app:minimized", () => window.renderTaskbar());
    window.EventBus.on("app:closed", () => window.renderTaskbar());
    window.EventBus.on("app:maximized", () => window.renderTaskbar());
    window.EventBus.on("desktop:refresh", () => window.renderTaskbar());
    window.EventBus.on("local-ai:status", () => window.renderLocalAITray());
}
