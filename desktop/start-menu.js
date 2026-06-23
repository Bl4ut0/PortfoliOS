/**
 * PortfoliOS: Start Menu Component
 * Renders pinned programs and available portfolio system nodes in the Windows-style Start Menu.
 */

window.renderStartMenu = () => {
    const startPinned = window.byId ? window.byId("start-pinned") : document.getElementById("start-pinned");
    const startGrid = window.byId ? window.byId("start-grid") : document.getElementById("start-grid");
    if (!startPinned || !startGrid) return;

    startPinned.innerHTML = window.desktopApps
        .filter((item) => item.pinned && window.isAppInstalled(item.id))
        .map((item) => `
            <button class="start-pin" data-open-app="${item.id}" title="Open ${item.title}">
                ${window.getAppIconHtml(item.icon)}
                <span>${item.title}</span>
            </button>
        `).join("");

    startGrid.innerHTML = window.systems
        .filter((item) => window.isAppInstalled(item.id))
        .map((item) => `
            <button class="start-app" data-select="${item.id}" data-open-app="${item.launchApp || "dossier"}"
                style="--tile-color:${item.color}">
                ${window.getAppIconHtml(item.icon)}
                <span>
                    <strong>${item.title}</strong>
                    <small>${item.status} / ${item.type}</small>
                </span>
            </button>
        `).join("");
};

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("app:installed", () => window.renderStartMenu());
    window.EventBus.on("app:uninstalled", () => window.renderStartMenu());
    window.EventBus.on("desktop:refresh", () => window.renderStartMenu());
}
