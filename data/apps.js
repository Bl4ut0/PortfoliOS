/**
 * PortfoliOS: Application Definitions & Store Data
 * Contains catalog entries for desktop apps, store items, installation helper, and categorizations.
 */

window.standardInstalledAppIds = [
    "devhub", "profile", "dossier", "browser", "network", "linux", "cli",
    "settings", "store", "files", "security-center", "addons", "guildcraft", "homelab",
    "survival-ai", "status", "taskmgr", "local-ai", "musicmini", "office", "portfolio-studio"
];

window.desktopPinnedIds = [
    "store", "files", "cli", "browser", "devhub", "office",
    "pdfcraft", "solidcraft", "genoffice", "photocraft", "vectorcraft", "lightcraft", "designcraft", "filmcraft", "effectcraft",
    "romplayer", "openrct2", "doomsource", "duke32", "diablo", "quake", "ut99", "webamp", "musicmini", "iptv"
];

window.startMenuPinnedIds = [
    "store", "settings", "files", "security-center", "office", "browser",
    "cli", "local-ai", "musicmini", "profile", "dossier",
    "network", "taskmgr", "linux", "devhub"
];

// Start menu organization lives with the app registry so new apps only need a
// category and an optional position in startMenuPinnedIds.
window.startMenuCategories = [
    { id: "system", label: "System" },
    { id: "productivity", label: "Productivity" },
    { id: "development", label: "Development" },
    { id: "media", label: "Media" },
    { id: "games", label: "Games" }
];

window.startMenuGroups = [
    {
        id: "system",
        label: "System",
        ids: ["store", "files", "security-center", "office", "settings", "browser", "cli", "local-ai", "musicmini", "taskmgr", "linux"]
    },
    {
        id: "portfolio",
        label: "Portfolio",
        ids: ["profile", "dossier", "network", "devhub", "addons", "guildcraft", "homelab", "survival-ai", "status", "wardenit", "automation", "media"]
    },
    {
        id: "installed",
        label: "Installed Store Apps",
        ids: [
            "pdfcraft", "photocraft", "vectorcraft", "lightcraft", "designcraft", "filmcraft", "effectcraft",
            "romplayer", "openrct2", "webamp", "iptv", "doomsource", "duke32", "diablo", "quake", "ut99"
        ]
    }
];

window.defaultDesktopIconLayout = {
    store: { col: 0, row: 0 },
    files: { col: 0, row: 1 },
    cli: { col: 0, row: 2 },
    browser: { col: 0, row: 3 },
    devhub: { col: 0, row: 4 },
    office: { col: 0, row: 5 },
    pdfcraft: { col: 1, row: 0 },
    solidcraft: { col: 1, row: 6 },
    genoffice: { col: 1, row: 7 },
    photocraft: { col: 1, row: 1 },
    vectorcraft: { col: 1, row: 2 },
    lightcraft: { col: 1, row: 3 },
    designcraft: { col: 1, row: 4 },
    filmcraft: { col: 1, row: 5 },
    effectcraft: { col: 2, row: 0 },
    romplayer: { col: 2, row: 1 },
    openrct2: { col: 2, row: 2 },
    doomsource: { col: 2, row: 3 },
    duke32: { col: 2, row: 4 },
    diablo: { col: 2, row: 5 },
    quake: { col: 3, row: 0 },
    ut99: { col: 3, row: 1 },
    webamp: { col: 3, row: 2 },
    musicmini: { col: 3, row: 3 },
    iptv: { col: 3, row: 4 }
};

window.desktopApps = [
    { id: "plex", title: "Plex Player", icon: "apps/plex/icon.svg", category: "media", modular: true, meta: "Native Plex client preview" },
    { id: "vscode", title: "Code OSS", icon: "apps/vscode/icon.png", category: "development", modular: true, meta: "SystemFS code workspace" },
    { id: "solidcraft", title: "SolidCraft", icon: "apps/solidcraft/icon.svg", category: "productivity", modular: true, meta: "Parametric 3D CAD & solid modeling" },
    { id: "genoffice", title: "GenOffice", icon: "apps/genoffice/icon.svg", category: "productivity", modular: true, meta: "AI-native office suite for Docs, Sheets, Slides & PDFs" },
    { id: "pdfcraft", title: "PdfCraft", icon: "apps/pdfcraft/icon.svg", category: "productivity", modular: true, meta: "PDF editor and organizer" },
    { id: "photocraft", title: "PhotoCraft", icon: "apps/photocraft/icon.svg", category: "productivity", modular: true, meta: "Layered image and raster artwork editing" },
    { id: "vectorcraft", title: "VectorCraft", icon: "apps/vectorcraft/icon.svg", category: "productivity", modular: true, meta: "Vector illustration and SVG design" },
    { id: "lightcraft", title: "LightCraft", icon: "apps/lightcraft/icon.svg", category: "productivity", modular: true, meta: "Photo library and RAW development" },
    { id: "designcraft", title: "DesignCraft", icon: "apps/designcraft/icon.svg", category: "productivity", modular: true, meta: "Page layout and publishing studio" },
    { id: "filmcraft", title: "FilmCraft", icon: "apps/filmcraft/icon.svg", category: "media", modular: true, meta: "Nonlinear video timeline editor" },
    { id: "effectcraft", title: "EffectCraft", icon: "apps/effectcraft/icon.svg", category: "media", modular: true, meta: "Motion graphics and visual effects" },
    { id: "codex", title: "Codex CLI Preview", icon: "fa-solid fa-terminal", category: "development", modular: true, meta: "Private workspace readiness" },
    { id: "profile", title: "Identity", icon: "fa-solid fa-id-card", category: "productivity", pinned: true, modular: true, meta: "Identity profile" },
    { id: "dossier", title: "Dossier", icon: "fa-solid fa-folder-open", category: "productivity", pinned: true, modular: true, meta: "Project dossier" },
    { id: "browser", title: "Browser", icon: "fa-brands fa-chrome", category: "system", pinned: true, modular: true, meta: "Portfolio browser" },
    { id: "network", title: "Network Map", icon: "fa-solid fa-diagram-project", category: "development", pinned: true, modular: true, meta: "Systems topology" },
    { id: "linux", title: "lab@bl4ut0", icon: "fa-brands fa-linux", category: "development", pinned: true, modular: true, meta: "Linux lab view" },
    { id: "cli", title: "Portfolio CLI", icon: "fa-solid fa-terminal", category: "development", pinned: true, modular: true, meta: "Interactive shell" },
    { id: "local-ai", title: "Local AI", icon: "fa-solid fa-brain", category: "development", pinned: false, modular: true, meta: "AI runtime control" },
    { id: "store", title: "Store", icon: "fa-solid fa-shop", category: "system", pinned: true, modular: true, meta: "Application catalog" },
    { id: "files", title: "File Explorer", icon: "fa-solid fa-folder-open", category: "system", pinned: true, modular: true, meta: "File manager" },
    { id: "security-center", title: "Security Center", icon: "fa-solid fa-shield-halved", category: "system", pinned: true, modular: true, meta: "Local file protection" },
    { id: "office", title: "Office Preview", icon: "fa-solid fa-file-signature", category: "productivity", pinned: true, modular: true, meta: "Local text and JSON sheets" },
    { id: "taskmgr", title: "Task Manager", icon: "fa-solid fa-microchip", category: "system", pinned: false, modular: true, meta: "System monitor" },
    { id: "webamp", title: "Webamp", icon: "fa-solid fa-music", category: "media", pinned: false, modular: true, meta: "Classic media player" },
    { id: "musicmini", title: "Music Mini", icon: "fa-solid fa-record-vinyl", category: "media", pinned: true, modular: true, meta: "Local music player" },
    { id: "iptv", title: "IPTV Stream", icon: "fa-solid fa-tv", category: "media", pinned: false, modular: true, meta: "Live TV and XMLTV guide" },
    { id: "settings", title: "Settings", icon: "fa-solid fa-sliders", category: "system", pinned: false, modular: true, meta: "System preferences" },
    { id: "romplayer", title: "ROM Player", icon: "fa-solid fa-gamepad", category: "games", pinned: true, modular: true, meta: "Emulator launcher" },
    { id: "openrct2", title: "OpenRCT2", icon: "fa-solid fa-train", category: "games", pinned: false, modular: true, meta: "Theme park engine" },
    { id: "doomsource", title: "Doom", icon: "doom-icon.png", category: "games", pinned: false, modular: true, meta: "WASM game" },
    { id: "duke32", title: "Duke Nukem 3D", icon: "duke3d-icon.png", category: "games", pinned: false, modular: true, meta: "Browser game" },
    { id: "diablo", title: "Diablo", icon: "diablo-icon.png", category: "games", pinned: false, modular: true, meta: "Browser game" },
    { id: "quake", title: "Quake", icon: "quake-icon.png", category: "games", pinned: false, modular: true, meta: "Browser game" },
    { id: "ut99", title: "UT99", icon: "fa-solid fa-crosshairs", category: "games", pinned: false, modular: true, meta: "Browser game" },
    { id: "portfolio-studio", title: "Portfolio Studio", icon: "fa-solid fa-sliders", category: "system", pinned: false, modular: true, meta: "Portfolio admin studio" }
];

window.modularApps = window.desktopApps
    .filter((app) => app.modular === true)
    .map((app) => app.id);

window.storeApps = [
    { id: "genoffice", title: "GenOffice", icon: "apps/genoffice/icon.svg", category: "Productivity", description: "Open-source AI-native office suite by Genspark. Features six integrated editors for Word (.docx), Excel (.xlsx), PowerPoint (.pptx), PDF, Markdown, and HTML with byte-preserving patch engines, Local AI agent skills, and full SystemFS integration.", size: "Modular suite", publisher: "Genspark AI / PortfoliOS" },
    { id: "solidcraft", title: "SolidCraft", icon: "apps/solidcraft/icon.svg", category: "Productivity", description: "Parametric 3D CAD modeling studio built in pure Rust and WebAssembly. Features a parametric timeline, 2D constraint sketches, solid modeling, MCP agent server, and STEP/STL/3MF export.", size: "WASM runtime", publisher: "Tangency Labs / PortfoliOS adapter" },
    { id: "plex", title: "Plex Player", icon: "apps/plex/icon.svg", category: "Media", description: "Native Plex library and browser player preview. Link your account, choose a secure server, and play personal media. Server/browser compatibility testing is ongoing.", size: "On-demand streaming", publisher: "PortfoliOS / unofficial Plex client" },
    { id: "vscode", title: "Code OSS", icon: "apps/vscode/icon.png", category: "Development", description: "VS Code web workbench for your Documents workspace. Explorer, editing and local saves. Native terminals and desktop-only extensions need a separate runtime.", size: "10 MB runtime", publisher: "Code OSS / CodinGame / PortfoliOS" },
    { id: "pdfcraft", title: "PdfCraft", icon: "apps/pdfcraft/icon.svg", category: "Productivity", description: "Edit and organize PDFs locally with the official PdfCraft WASM editor. Opens and saves workspace PDFs. Desktop interface; runtime loads on first launch.", size: "41 MB runtime", publisher: "ArtCraft / PortfoliOS adapter" },
    { id: "photocraft", title: "PhotoCraft", icon: "apps/photocraft/icon.svg", category: "Productivity", description: "Photoshop-style layers, brushes, image editing, and PSD workflows. Desktop interface; workspace storage.", size: "ArtCraft Suite", publisher: "ArtCraft / PortfoliOS adapter" },
    { id: "vectorcraft", title: "VectorCraft", icon: "apps/vectorcraft/icon.svg", category: "Productivity", description: "Vector illustration, paths, SVG artwork, and Illustrator-style workflows. Saves workspace SVGs.", size: "ArtCraft Suite", publisher: "ArtCraft / PortfoliOS adapter" },
    { id: "lightcraft", title: "LightCraft", icon: "apps/lightcraft/icon.svg", category: "Productivity", description: "Photo library and RAW development studio with non-destructive exposure, contrast, and color tuning.", size: "ArtCraft Suite", publisher: "ArtCraft / PortfoliOS adapter" },
    { id: "designcraft", title: "DesignCraft", icon: "apps/designcraft/icon.svg", category: "Productivity", description: "Multi-page publication layout, typography, brochure composition, and print preparation.", size: "ArtCraft Suite", publisher: "ArtCraft / PortfoliOS adapter" },
    { id: "filmcraft", title: "FilmCraft", icon: "apps/filmcraft/icon.svg", category: "Media", description: "Nonlinear video editing, audio tracks, timeline cuts, and Premiere-style media workflows.", size: "ArtCraft Suite", publisher: "ArtCraft / PortfoliOS adapter" },
    { id: "effectcraft", title: "EffectCraft", icon: "apps/effectcraft/icon.svg", category: "Media", description: "Motion graphics, keyframe animation, visual effects, and compositing studio.", size: "ArtCraft Suite", publisher: "ArtCraft / PortfoliOS adapter" },
    { id: "codex", title: "Codex CLI Preview", icon: "fa-solid fa-terminal", category: "Productivity", description: "Private workspace readiness and official CLI setup. Browser sign-in and coding are not available yet.", size: "Preview only", publisher: "PortfoliOS" },
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
        description: "WebQuake engine. Choose pak0.pak from your own local Quake or shareware installation when launched.",
        size: "Engine + your PAK",
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

const storeInstallPrefix = (owner = window.state?.currentUserId) => `bl4ut0_${owner}_app_install_`;
const validStoreId = id => typeof id==='string' && /^[a-z0-9_-]{1,80}$/i.test(id);
window.getInstalledStoreAppIds = function() {
    const owner=window.state?.currentUserId || 'bl4ut0', key=window.getInstalledStoreAppsKey(owner);
    let legacy=[];
    try {const value=JSON.parse(window.Storage?.local.get(key) || localStorage.getItem(key) || '[]');if(Array.isArray(value))legacy=value.filter(validStoreId);}catch{}
    if(!window.isPrivateUser?.(owner))return [...new Set(legacy)];
    const prefix=storeInstallPrefix(owner), result=new Set(legacy);
    // Migrate existing installations additively; an explicit per-app uninstall
    // always overrides a legacy list restored by an older client.
    for(const id of legacy) {
        if(localStorage.getItem(prefix+id)===null) window.Storage.local.set(prefix+id,'true');
    }
    for(let i=0;i<localStorage.length;i++) {
        const stored=localStorage.key(i);
        if(!stored?.startsWith(prefix))continue;
        const id=stored.slice(prefix.length);if(!validStoreId(id))continue;
        const value=localStorage.getItem(stored);
        if(value==='true')result.add(id);else if(value==='false')result.delete(id);
    }
    return [...result];
};
window.setStoreAppInstalled = function(id, installed) {
    if(!validStoreId(id))throw new Error('Invalid application identifier.');
    const owner=window.state?.currentUserId || 'bl4ut0';
    const current=new Set(window.getInstalledStoreAppIds());
    if(window.isPrivateUser?.(owner) && !window.Storage.local.set(storeInstallPrefix(owner)+id,String(Boolean(installed))))throw new Error('The app installation could not be saved.');
    if(installed)current.add(id);else current.delete(id);
    const list=window.isPrivateUser?.(owner)?window.getInstalledStoreAppIds():[...current];
    if(!window.Storage.local.set(window.getInstalledStoreAppsKey(owner),JSON.stringify(list)))throw new Error('The app library could not be saved.');
    window.savePreferencesToFilesystem?.();
    return list;
};
window.setInstalledStoreAppIds = function(ids) {
    const next=new Set((ids || []).filter(validStoreId));
    const current=window.getInstalledStoreAppIds();
    for(const id of new Set([...current,...next])) {
        if(current.includes(id)!==next.has(id))window.setStoreAppInstalled(id,next.has(id));
    }
    window.Storage.local.set(window.getInstalledStoreAppsKey(),JSON.stringify(window.getInstalledStoreAppIds()));
    window.savePreferencesToFilesystem?.();
    return window.getInstalledStoreAppIds();
};
window.resetInstalledStoreApps = function() {return window.setInstalledStoreAppIds([]);};

window.isStoreAppInstalled = function(id) {
    return window.getInstalledStoreAppIds().includes(id);
};

window.isAppInstalled = function(id) {
    if (window.isVisibleForCurrentUser && !window.isVisibleForCurrentUser(id)) return false;
    if ((window.standardInstalledAppIds || []).includes(id)) return true;
    return window.getInstalledStoreAppIds().includes(id);
};
