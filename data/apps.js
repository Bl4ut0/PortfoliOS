/**
 * PortfoliOS: Application Definitions & Store Data
 * Contains catalog entries for desktop apps, store items, installation helper, and categorizations.
 */

window.standardInstalledAppIds = [
    "devhub", "profile", "dossier", "browser", "network", "linux", "cli",
    "settings", "store", "files", "addons", "guildcraft", "homelab",
    "survival-ai", "status", "taskmgr", "local-ai"
];

window.desktopPinnedIds = [
    "store", "files", "cli", "devhub",
    "romplayer", "doomsource", "duke32", "diablo", "quake", "webamp"
];

window.startMenuPinnedIds = [
    "store", "settings", "files", "browser",
    "cli", "local-ai", "profile", "dossier",
    "network", "taskmgr", "linux", "devhub"
];

window.startMenuGroups = [
    {
        id: "system",
        label: "System",
        ids: ["store", "files", "settings", "browser", "cli", "local-ai", "taskmgr", "linux"]
    },
    {
        id: "portfolio",
        label: "Portfolio",
        ids: ["profile", "dossier", "network", "devhub", "addons", "guildcraft", "homelab", "survival-ai", "status", "wardenit", "automation", "media"]
    },
    {
        id: "installed",
        label: "Installed Store Apps",
        ids: ["romplayer", "webamp", "doomsource", "duke32", "diablo", "quake"]
    }
];

window.defaultDesktopIconLayout = {
    store: { col: 0, row: 0 },
    files: { col: 0, row: 1 },
    cli: { col: 0, row: 2 },
    devhub: { col: 0, row: 3 },
    romplayer: { col: 1, row: 0 },
    doomsource: { col: 1, row: 1 },
    duke32: { col: 1, row: 2 },
    diablo: { col: 1, row: 3 },
    quake: { col: 1, row: 4 },
    webamp: { col: 1, row: 5 }
};

window.desktopApps = [
    { id: "profile", title: "Identity", icon: "fa-solid fa-id-card", pinned: true },
    { id: "dossier", title: "Dossier", icon: "fa-solid fa-folder-open", pinned: true },
    { id: "browser", title: "Browser", icon: "fa-brands fa-chrome", pinned: true },
    { id: "network", title: "Network Map", icon: "fa-solid fa-diagram-project", pinned: true },
    { id: "linux", title: "lab@bl4ut0", icon: "fa-brands fa-linux", pinned: true },
    { id: "cli", title: "Portfolio CLI", icon: "fa-solid fa-terminal", pinned: true },
    { id: "local-ai", title: "Local AI", icon: "fa-solid fa-brain", pinned: false },
    { id: "store", title: "Store", icon: "fa-solid fa-shop", pinned: true },
    { id: "files", title: "File Explorer", icon: "fa-solid fa-folder-open", pinned: true },
    { id: "taskmgr", title: "Task Manager", icon: "fa-solid fa-microchip", pinned: false },
    { id: "webamp", title: "Webamp", icon: "fa-solid fa-music", pinned: false },
    { id: "settings", title: "Settings", icon: "fa-solid fa-sliders", pinned: false },
    { id: "romplayer", title: "ROM Player", icon: "fa-solid fa-gamepad", pinned: true },
    { id: "doomsource", title: "Doom", icon: "doom-icon.png", pinned: false },
    { id: "duke32", title: "Duke Nukem 3D", icon: "duke3d-icon.png", pinned: false },
    { id: "diablo", title: "Diablo", icon: "diablo-icon.png", pinned: false },
    { id: "quake", title: "Quake", icon: "quake-icon.png", pinned: false }
];

window.storeApps = [
    {
        id: "romplayer",
        title: "ROM Player",
        icon: "fa-solid fa-gamepad",
        category: "Games",
        description: "Universal EmulatorJS launcher for browser-friendly console and handheld ROM libraries.",
        size: "CDN cores",
        publisher: "EmulatorJS / PortfoliOS",
    },
    {
        id: "doomsource",
        title: "Doom",
        icon: "doom-icon.png",
        category: "Games",
        description: "Classic 1993 first-person shooter running on a compiled WebAssembly engine.",
        size: "11.8 MB",
        publisher: "id Software / emscripten port"
    },
    {
        id: "duke32",
        title: "Duke Nukem 3D",
        icon: "duke3d-icon.png",
        category: "Games",
        description: "Shareware version of Duke Nukem 3D running in a browser port.",
        size: "26.4 MB",
        publisher: "3D Realms / emscripten port"
    },
    {
        id: "diablo",
        title: "Diablo",
        icon: "diablo-icon.png",
        category: "Games",
        description: "DevilutionX web port of the original 1996 action RPG.",
        size: "50.1 MB",
        publisher: "Blizzard North / DevilutionX team"
    },
    {
        id: "quake",
        title: "Quake",
        icon: "quake-icon.png",
        category: "Games",
        description: "WebQuake native JavaScript/WebGL port of the original Quake 1.",
        size: "18.2 MB",
        publisher: "id Software / WebQuake"
    },
    {
        id: "webamp",
        title: "Webamp",
        icon: "fa-solid fa-music",
        category: "Media",
        description: "Winamp 2.9 re-implementation in HTML5/JS with full skins, EQ, and visualizer support.",
        size: "1.4 MB",
        publisher: "Nullsoft / Webamp team"
    },
    {
        id: "tools",
        title: "Tools Hub",
        icon: "fa-solid fa-screwdriver-wrench",
        category: "Services",
        description: "Hosted utility launcher for browser-based tools and small web workflows.",
        size: "Hosted",
        publisher: "tools.bl4ut0.com",
        bookmarkId: "tools",
        installable: false
    },
    {
        id: "pdf",
        title: "PDF Tools",
        icon: "fa-solid fa-file-pdf",
        category: "Services",
        description: "Hosted PDF utility surface for document conversion and related workflows.",
        size: "Hosted",
        publisher: "pdf.bl4ut0.com",
        bookmarkId: "pdf",
        installable: false
    }
];

window.storeCategories = [
    { id: "all", label: "All", icon: "fa-solid fa-layer-group" },
    { id: "games", label: "Games", icon: "fa-solid fa-gamepad" },
    { id: "services", label: "Services", icon: "fa-solid fa-cloud" },
    { id: "media", label: "Media", icon: "fa-solid fa-music" },
    { id: "productivity", label: "Productivity", icon: "fa-solid fa-file-lines" }
];

window.getInstalledStoreAppsKey = function(userId = window.state?.currentUserId || "bl4ut0") {
    const safeUserId = String(userId || "bl4ut0").replace(/[^a-z0-9_-]/gi, "") || "bl4ut0";
    return safeUserId === "bl4ut0"
        ? "bl4ut0_installed_apps"
        : `bl4ut0_installed_apps_${safeUserId}`;
};

window.getInstalledStoreAppIds = function() {
    const key = window.getInstalledStoreAppsKey();
    const saved = window.Storage
        ? window.Storage.local.get(key)
        : localStorage.getItem(key);

    if (!saved) return [];

    try {
        const list = JSON.parse(saved);
        return Array.isArray(list) ? [...new Set(list.filter(Boolean))] : [];
    } catch (e) {
        return [];
    }
};

window.setInstalledStoreAppIds = function(ids) {
    const key = window.getInstalledStoreAppsKey();
    const list = [...new Set((ids || []).filter(Boolean))];
    const serialized = JSON.stringify(list);
    if (window.Storage) {
        window.Storage.local.set(key, serialized);
    } else {
        localStorage.setItem(key, serialized);
    }
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
    return list;
};

window.resetInstalledStoreApps = function() {
    const key = window.getInstalledStoreAppsKey();
    if (window.Storage) {
        window.Storage.local.remove(key);
    } else {
        localStorage.removeItem(key);
    }
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.isStoreAppInstalled = function(id) {
    return window.getInstalledStoreAppIds().includes(id);
};

window.isAppInstalled = function(id) {
    if (window.isVisibleForCurrentUser && !window.isVisibleForCurrentUser(id)) return false;
    if ((window.standardInstalledAppIds || []).includes(id)) return true;
    return window.getInstalledStoreAppIds().includes(id);
};
