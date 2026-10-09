/**
 * PortfoliOS Mobile application catalog.
 *
 * Mobile owns this catalog. It intentionally does not inherit desktop apps:
 * utilities are designed for touch and portfolio apps use mobile-specific views.
 */
window.mobileAppCatalog = [
    { id: "store", title: "Store", icon: "fa-solid fa-shop", color: "#a78bfa", category: "system", pinned: true, description: "Discover mobile apps and desktop alternatives." },
    { id: "local-ai", title: "Lobe", icon: "fa-solid fa-brain", color: "#22d3ee", category: "productivity", description: "Chat with your session-aware assistant." },
    { id: "taskmgr", title: "Task Manager", icon: "fa-solid fa-microchip", color: "#34d399", category: "system", description: "Review, resume, and close running mobile apps." },
    { id: "security-center", title: "Security Center", icon: "fa-solid fa-shield-halved", color: "#38bdf8", category: "system", description: "Check local file policy and scan your workspace." },
    { id: "profile", title: "Identity", icon: "fa-solid fa-id-card", color: "#e879f9", category: "system", description: "Your active account and backup status." },
    { id: "dossier", title: "Dossier", icon: "fa-solid fa-folder-open", color: "#60a5fa", category: "portfolio", description: "Browse projects available in this profile." },
    { id: "romplayer", title: "ROM Player", icon: "fa-solid fa-gamepad", color: "#f59e0b", category: "games", installable: true, description: "Play your NES, SNES, Game Boy, GBA, and Sega ROMs with touch controls. Cores download when launched." },
    { id: "browser", title: "Browser", icon: "fa-solid fa-compass", color: "#38bdf8", category: "system", pinned: true },
    { id: "documents", title: "Documents", icon: "fa-solid fa-file-pen", color: "#60a5fa", category: "productivity", pinned: true },
    { id: "music", title: "Music", icon: "fa-solid fa-headphones", color: "#f472b6", category: "media", pinned: true },
    { id: "settings", title: "Settings", icon: "fa-solid fa-gear", color: "#94a3b8", category: "system", pinned: true },
    { id: "files", title: "Files", icon: "fa-solid fa-folder", color: "#facc15", category: "productivity" },
    { id: "calculator", title: "Calculator", icon: "fa-solid fa-calculator", color: "#fb923c", category: "system" },
    { id: "devhub", title: "Dev Hub", icon: "fa-solid fa-terminal", color: "#22d3ee", category: "portfolio", sourceId: "devhub" },
    { id: "status", title: "Status", icon: "fa-solid fa-signal", color: "#22c55e", category: "portfolio", sourceId: "status" },
    { id: "homelab", title: "Home Lab", icon: "fa-solid fa-server", color: "#34d399", category: "portfolio", sourceId: "homelab" },
    { id: "automation", title: "Automation", icon: "fa-solid fa-gears", color: "#2dd4bf", category: "portfolio", sourceId: "automation" },
    { id: "addons", title: "Addons", icon: "fa-solid fa-wand-magic-sparkles", color: "#a78bfa", category: "portfolio", sourceId: "addons" },
    { id: "guildcraft", title: "GuildCraft", icon: "fa-solid fa-cubes", color: "#f59e0b", category: "portfolio", sourceId: "guildcraft" },
    { id: "survival-ai", title: "Survival AI", icon: "fa-solid fa-brain", color: "#f43f5e", category: "portfolio", sourceId: "survival-ai" },
    { id: "wardenit", title: "WardenIT", icon: "fa-solid fa-briefcase", color: "#e879f9", category: "portfolio", sourceId: "wardenit" },
    { id: "media", title: "Gallery", icon: "fa-solid fa-images", color: "#818cf8", category: "media", visibilitySourceId: "media" },
    { id: "flappybird", title: "Flappy Bird", icon: "fa-solid fa-dove", color: "#facc15", category: "games" }
];

window.mobileAppIds = window.mobileAppCatalog.map((app) => app.id);
window.mobilePinnedAppIds = window.mobileAppCatalog.filter((app) => app.pinned).map((app) => app.id);

window.isMobileAppAvailable = function(app) {
    const visibilityId = app.visibilitySourceId || app.sourceId;
    return (!visibilityId || !window.isVisibleForCurrentUser || window.isVisibleForCurrentUser(visibilityId));
};
window.isMobileAppInstalled = function(app) {
    return !app.installable || Boolean(window.isStoreAppInstalled?.(app.id));
};
