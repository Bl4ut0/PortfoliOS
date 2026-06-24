/**
 * PortfoliOS: Start Menu Component
 * Renders pinned programs and available portfolio system nodes in the Windows-style Start Menu.
 */

window.getStartMenuPinnedApps = () => {
    const apps = (window.desktopApps || []).filter((item) => item.pinned && window.isAppInstalled(item.id));
    const explicitOrder = Array.isArray(window.startMenuPinnedIds)
        ? window.startMenuPinnedIds
        : apps.map((item) => item.id);
    const byId = new Map(apps.map((item) => [item.id, item]));
    const ordered = explicitOrder.map((id) => byId.get(id)).filter(Boolean);
    const orderedIds = new Set(ordered.map((item) => item.id));
    return ordered.concat(apps.filter((item) => !orderedIds.has(item.id)));
};

window.getStartMenuNodes = () => {
    return (window.systems || []).filter((item) => window.isAppInstalled(item.id));
};

window.renderStartUser = () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user) return;

    const avatarEls = [
        window.byId ? window.byId("start-user-avatar") : document.getElementById("start-user-avatar"),
        window.byId ? window.byId("start-user-strip-avatar") : document.getElementById("start-user-strip-avatar")
    ];
    avatarEls.forEach((avatar) => {
        if (!avatar) return;
        avatar.src = user.avatar || "";
        avatar.alt = `${user.displayName} profile picture`;
    });

    const name = window.byId ? window.byId("start-user-name") : document.getElementById("start-user-name");
    const meta = window.byId ? window.byId("start-user-meta") : document.getElementById("start-user-meta");
    if (name) name.textContent = user.displayName;
    if (meta) meta.textContent = `${user.handle} / ${user.accountType || user.role}`;
};

window.renderStartMenu = () => {
    const startPinned = window.byId ? window.byId("start-pinned") : document.getElementById("start-pinned");
    const startGrid = window.byId ? window.byId("start-grid") : document.getElementById("start-grid");
    if (!startPinned || !startGrid) return;

    const escapeHtml = window.escapeHtml || ((value) => String(value ?? ""));
    const safeColor = (value) => /^#[0-9a-f]{3,8}$/i.test(String(value || "")) ? value : "#22d3ee";

    window.renderStartUser();

    startPinned.innerHTML = window.getStartMenuPinnedApps()
        .map((item) => `
            <button class="start-pin" data-open-app="${escapeHtml(item.id)}" title="Open ${escapeHtml(item.title)}">
                ${window.getAppIconHtml(item.icon)}
                <span>${escapeHtml(item.title)}</span>
            </button>
        `).join("");

    startGrid.innerHTML = window.getStartMenuNodes()
        .map((item) => `
            <button class="start-app" data-select="${escapeHtml(item.id)}" data-open-app="${escapeHtml(item.launchApp || "dossier")}"
                style="--tile-color:${safeColor(item.color)}">
                ${window.getAppIconHtml(item.icon)}
                <span>
                    <strong>${escapeHtml(item.title)}</strong>
                    <small>${escapeHtml(item.status)} / ${escapeHtml(item.type)}</small>
                </span>
            </button>
        `).join("");
};

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("app:installed", () => window.renderStartMenu());
    window.EventBus.on("app:uninstalled", () => window.renderStartMenu());
    window.EventBus.on("desktop:refresh", () => window.renderStartMenu());
    window.EventBus.on("user:changed", () => window.renderStartUser());
}
