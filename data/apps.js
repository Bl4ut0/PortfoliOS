/**
 * PortfoliOS: Application Definitions & Store Data
 * Contains catalog entries for desktop apps, store items, installation helper, and categorizations.
 */

window.desktopPinnedIds = [
    "devhub", "store", "files", "webamp", "doomsource", "duke32", "diablo", "quake", 
    "addons", "guildcraft", "homelab", "survival-ai", "status", "linux", "cli"
];

window.desktopApps = [
    { id: "profile", title: "Identity", icon: "fa-solid fa-id-card", pinned: true },
    { id: "dossier", title: "Dossier", icon: "fa-solid fa-folder-open", pinned: true },
    { id: "browser", title: "Browser", icon: "fa-brands fa-chrome", pinned: true },
    { id: "network", title: "Network Map", icon: "fa-solid fa-diagram-project", pinned: true },
    { id: "linux", title: "lab@bl4ut0", icon: "fa-brands fa-linux", pinned: true },
    { id: "cli", title: "Portfolio CLI", icon: "fa-solid fa-terminal", pinned: true },
    { id: "local-ai", title: "Local AI", icon: "fa-solid fa-brain", pinned: true },
    { id: "store", title: "Store", icon: "fa-solid fa-shop", pinned: true },
    { id: "files", title: "File Explorer", icon: "fa-solid fa-folder-open", pinned: true },
    { id: "taskmgr", title: "Task Manager", icon: "fa-solid fa-microchip", pinned: false },
    { id: "webamp", title: "Webamp", icon: "fa-solid fa-music", pinned: false },
    { id: "settings", title: "Settings", icon: "fa-solid fa-sliders", pinned: true },
    { id: "doomsource", title: "Doom", icon: "doom-icon.png", pinned: false },
    { id: "duke32", title: "Duke Nukem 3D", icon: "duke3d-icon.png", pinned: false },
    { id: "diablo", title: "Diablo", icon: "diablo-icon.png", pinned: false },
    { id: "quake", title: "Quake", icon: "quake-icon.png", pinned: false }
];

window.storeApps = [
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
    { id: "productivity", label: "Productivity", icon: "fa-solid fa-file-lines" }
];

window.isAppInstalled = function(id) {
    const coreApps = [
        "devhub", "profile", "dossier", "browser", "network", "linux", "cli", 
        "settings", "store", "files", "addons", "guildcraft", "homelab", "survival-ai", "status", "taskmgr", "local-ai"
    ];
    if (coreApps.includes(id)) return true;

    if (window.Storage) {
        const saved = window.Storage.local.get("bl4ut0_installed_apps");
        if (saved) {
            try {
                const list = JSON.parse(saved);
                return list.includes(id);
            } catch (e) {}
        }
    }
    return id === "doomsource";
};
