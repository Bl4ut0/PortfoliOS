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
};

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("app:opened", () => window.renderTaskbar());
    window.EventBus.on("app:minimized", () => window.renderTaskbar());
    window.EventBus.on("app:closed", () => window.renderTaskbar());
    window.EventBus.on("app:maximized", () => window.renderTaskbar());
    window.EventBus.on("desktop:refresh", () => window.renderTaskbar());
}
