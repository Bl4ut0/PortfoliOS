/**
 * PortfoliOS: Application Definitions & Store Data
 * Contains catalog entries for desktop apps, store items, installation helper, and categorizations.
 */

window.standardInstalledAppIds = [
    "devhub", "profile", "dossier", "browser", "network", "linux", "cli",
    "settings", "store", "files", "addons", "guildcraft", "homelab",
    "survival-ai", "status", "taskmgr", "local-ai", "musicmini", "office"
];

window.desktopPinnedIds = [
    "store", "files", "cli", "devhub", "office",
    "romplayer", "openrct2", "doomsource", "duke32", "diablo", "quake", "ut99", "webamp", "musicmini", "iptv"
];

window.startMenuPinnedIds = [
    "store", "settings", "files", "office", "browser",
    "cli", "local-ai", "musicmini", "profile", "dossier",
    "network", "taskmgr", "linux", "devhub"
];

window.startMenuGroups = [
    {
        id: "system",
        label: "System",
        ids: ["store", "files", "office", "settings", "browser", "cli", "local-ai", "musicmini", "taskmgr", "linux"]
    },
    {
        id: "portfolio",
        label: "Portfolio",
        ids: ["profile", "dossier", "network", "devhub", "addons", "guildcraft", "homelab", "survival-ai", "status", "wardenit", "automation", "media"]
    },
    {
        id: "installed",
        label: "Installed Store Apps",
        ids: ["romplayer", "openrct2", "webamp", "iptv", "doomsource", "duke32", "diablo", "quake", "ut99"]
    }
];

window.defaultDesktopIconLayout = {
    store: { col: 0, row: 0 },
    files: { col: 0, row: 1 },
    cli: { col: 0, row: 2 },
    devhub: { col: 0, row: 3 },
    office: { col: 0, row: 4 },
    romplayer: { col: 1, row: 0 },
    openrct2: { col: 1, row: 1 },
    doomsource: { col: 1, row: 2 },
    duke32: { col: 1, row: 3 },
    diablo: { col: 1, row: 4 },
    quake: { col: 1, row: 5 },
    ut99: { col: 2, row: 0 },
    webamp: { col: 2, row: 1 },
    musicmini: { col: 2, row: 2 },
    iptv: { col: 2, row: 3 }
};

window.desktopApps = [
    { id: "profile", title: "Identity", icon: "fa-solid fa-id-card", pinned: true, modular: true, meta: "Identity profile" },
    { id: "dossier", title: "Dossier", icon: "fa-solid fa-folder-open", pinned: true, modular: true, meta: "Project dossier" },
    { id: "browser", title: "Browser", icon: "fa-brands fa-chrome", pinned: true, modular: true, meta: "Portfolio browser" },
    { id: "network", title: "Network Map", icon: "fa-solid fa-diagram-project", pinned: true, modular: true, meta: "Systems topology" },
    { id: "linux", title: "lab@bl4ut0", icon: "fa-brands fa-linux", pinned: true, modular: true, meta: "Linux lab view" },
    { id: "cli", title: "Portfolio CLI", icon: "fa-solid fa-terminal", pinned: true, modular: true, meta: "Interactive shell" },
    { id: "local-ai", title: "Local AI", icon: "fa-solid fa-brain", pinned: false, modular: true, meta: "AI runtime control" },
    { id: "store", title: "Store", icon: "fa-solid fa-shop", pinned: true, modular: true, meta: "Application catalog" },
    { id: "files", title: "File Explorer", icon: "fa-solid fa-folder-open", pinned: true, modular: true, meta: "File manager" },
    { id: "office", title: "LibreOffice WASM", icon: "fa-solid fa-file-signature", pinned: true, modular: true, meta: "Document workspace" },
    { id: "taskmgr", title: "Task Manager", icon: "fa-solid fa-microchip", pinned: false, modular: true, meta: "System monitor" },
    { id: "webamp", title: "Webamp", icon: "fa-solid fa-music", pinned: false, modular: true, meta: "Classic media player" },
    { id: "musicmini", title: "Music Mini", icon: "fa-solid fa-record-vinyl", pinned: true, modular: true, meta: "Local music player" },
    { id: "iptv", title: "IPTV Stream", icon: "fa-solid fa-tv", pinned: false, modular: true, meta: "Live TV and XMLTV guide" },
    { id: "settings", title: "Settings", icon: "fa-solid fa-sliders", pinned: false, modular: true, meta: "System preferences" },
    { id: "romplayer", title: "ROM Player", icon: "fa-solid fa-gamepad", pinned: true, modular: true, meta: "Emulator launcher" },
    { id: "openrct2", title: "OpenRCT2", icon: "fa-solid fa-train", pinned: false, modular: true, meta: "Theme park engine" },
    { id: "doomsource", title: "Doom", icon: "doom-icon.png", pinned: false, modular: true, meta: "WASM game" },
    { id: "duke32", title: "Duke Nukem 3D", icon: "duke3d-icon.png", pinned: false, modular: true, meta: "Browser game" },
    { id: "diablo", title: "Diablo", icon: "diablo-icon.png", pinned: false, modular: true, meta: "Browser game" },
    { id: "quake", title: "Quake", icon: "quake-icon.png", pinned: false, modular: true, meta: "Browser game" },
    { id: "ut99", title: "UT99", icon: "fa-solid fa-crosshairs", pinned: false, modular: true, meta: "Browser game" }
];

window.modularApps = window.desktopApps
    .filter((app) => app.modular === true)
    .map((app) => app.id);

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
        id: "openrct2",
        title: "OpenRCT2",
        icon: "fa-solid fa-train",
        category: "Games",
        description: "Open-source RollerCoaster Tycoon 2 WebAssembly runtime with staged engine, support data, and game assets.",
        size: "608.8 MiB runtime",
        publisher: "OpenRCT2 project"
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
        id: "ut99",
        title: "Unreal Tournament 99",
        icon: "fa-solid fa-crosshairs",
        category: "Games",
        description: "Browser-hosted Unreal Tournament 99 flyby runtime with OldUnreal multiplayer links and relay prep.",
        size: "Remote WASM",
        publisher: "OldUnreal / icculus.org"
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
        id: "iptv",
        title: "IPTV Stream",
        icon: "fa-solid fa-tv",
        category: "Media",
        description: "Play authorized Xtream and M3U live TV sources with a local XMLTV guide cache.",
        size: "0.8 MB + guide cache",
        publisher: "PortfoliOS"
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
    },
    {
        id: "pki",
        title: "Managed PKI & CA",
        icon: "fa-solid fa-shield-halved",
        category: "Services",
        description: "Internally managed Public Key Infrastructure and GCA deployment testing portal.",
        size: "Hosted",
        publisher: "pki.bl4ut0.dev",
        bookmarkId: "pki",
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
