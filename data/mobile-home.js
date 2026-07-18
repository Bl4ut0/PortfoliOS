/**
 * PortfoliOS Mobile launcher data and pure helpers.
 *
 * This file is intentionally DOM-free so launcher search/layout behavior can be
 * validated in Node and reused by the browser-native mobile shell.
 */
(function(root, factory) {
    const api = factory();
    if (root) {
        root.mobileHomeConfig = api.config;
        root.MobileHomeData = api;
    }
    if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
    const config = {
        schema: 1,
        dock: ["browser", "documents", "music", "settings"],
        categories: [
            { id: "all", label: "All" },
            { id: "productivity", label: "Work" },
            { id: "portfolio", label: "Portfolio" },
            { id: "media", label: "Media" },
            { id: "games", label: "Games" },
            { id: "system", label: "System" }
        ],
        aliases: {
            browser: "web internet compass links",
            documents: "docs pdf writer markdown html notes",
            music: "audio songs albums player sound",
            settings: "preferences theme wallpaper system",
            files: "storage folders downloads local disk",
            calculator: "math numbers arithmetic utility",
            devhub: "bl4ut0 projects github developer portal",
            status: "uptime health incidents services signals",
            homelab: "server proxmox docker vlan tailscale n8n network",
            automation: "rce cloudflare graphql n8n webhook workflow",
            addons: "wow lua itemrack marketsync meshnav curseforge",
            guildcraft: "discord crafting queues community professions",
            "survival-ai": "offline local llm vector knowledge ai",
            wardenit: "professional resume consulting sysadmin support",
            media: "gallery photos pictures images camera",
            flappybird: "game arcade bird flappy"
        },
        widgets: {
            "at-a-glance": { id: "at-a-glance", title: "At a glance", icon: "fa-solid fa-sparkles" },
            "portfolio-pulse": { id: "portfolio-pulse", title: "PortfoliOS pulse", icon: "fa-solid fa-chart-line" },
            "now-playing": { id: "now-playing", title: "Now playing", icon: "fa-solid fa-wave-square" }
        },
        folders: {
            build: {
                id: "build",
                title: "Build",
                icon: "fa-solid fa-code",
                appIds: ["devhub", "addons", "guildcraft", "automation"]
            },
            operate: {
                id: "operate",
                title: "Operate",
                icon: "fa-solid fa-server",
                appIds: ["homelab", "status", "survival-ai", "wardenit"]
            },
            work: {
                id: "work",
                title: "Work",
                icon: "fa-solid fa-briefcase",
                appIds: ["documents", "files", "calculator", "automation"]
            },
            media: {
                id: "media",
                title: "Media & Play",
                icon: "fa-solid fa-photo-film",
                appIds: ["music", "media", "flappybird", "browser"]
            }
        },
        pages: [
            {
                id: "daily",
                title: "Daily",
                items: [
                    { type: "widget", widgetId: "at-a-glance" },
                    { type: "app", appId: "files" },
                    { type: "app", appId: "calculator" },
                    { type: "app", appId: "media" },
                    { type: "app", appId: "flappybird" },
                    { type: "folder", folderId: "work" }
                ]
            },
            {
                id: "portfolio",
                title: "Portfolio",
                items: [
                    { type: "widget", widgetId: "portfolio-pulse" },
                    { type: "widget", widgetId: "now-playing" },
                    { type: "folder", folderId: "build" },
                    { type: "folder", folderId: "operate" },
                    { type: "folder", folderId: "media" },
                    { type: "app", appId: "devhub" },
                    { type: "app", appId: "status" }
                ]
            }
        ],
        feed: [
            {
                id: "mobile-foundation",
                headline: "MobileOS foundation is online",
                label: "Available",
                icon: "fa-solid fa-mobile-screen-button",
                color: "#22d3ee",
                body: "Independent Home, Recents, quick settings, local files, Documents/PDF, Gallery, persistent music, and touch-native apps are available.",
                view: "quick"
            },
            { id: "devhub-online", sourceId: "devhub", headline: "Bl4ut0.dev is the public project hub", appId: "devhub" },
            { id: "addons-active", sourceId: "addons", headline: "WoW Addons modernization continues", appId: "addons" },
            { id: "automation-stable", sourceId: "automation", headline: "RCE and Automation integration layer", appId: "automation" },
            { id: "homelab-stable", sourceId: "homelab", headline: "Connected Home Lab operating environment", appId: "homelab" },
            { id: "guildcraft-dev", sourceId: "guildcraft", headline: "GuildCraft community operations platform", appId: "guildcraft" },
            { id: "survival-ai-roadmap", sourceId: "survival-ai", headline: "Survival AI local-first knowledge system", appId: "survival-ai" },
            { id: "status-roadmap", sourceId: "status", headline: "Public Status Console roadmap", appId: "status" },
            { id: "wardenit-roadmap", sourceId: "wardenit", headline: "WardenIT professional services route", appId: "wardenit" }
        ]
    };

    function normalizeQuery(value) {
        return String(value || "")
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim()
            .replace(/\s+/g, " ");
    }

    function searchRank(app, query) {
        const normalized = normalizeQuery(query);
        if (!normalized) return 1;
        const id = normalizeQuery(app.id);
        const title = normalizeQuery(app.title);
        const category = normalizeQuery(app.category);
        const aliases = normalizeQuery(config.aliases[app.id] || app.aliases || "");
        const tokens = normalized.split(" ");
        const combined = `${title} ${id} ${aliases} ${category}`;
        if (normalized === title || normalized === id) return 600;
        if (title.startsWith(normalized) || id.startsWith(normalized)) return 520;
        if (aliases.split(" ").some((alias) => alias.startsWith(normalized))) return 460;
        if (tokens.every((token) => combined.split(" ").some((word) => word.startsWith(token)))) return 380;
        if (combined.includes(normalized)) return 260;
        if (tokens.every((token) => combined.includes(token))) return 180;
        return -1;
    }

    function searchApps(catalog, query = "", category = "all") {
        const categoryId = normalizeQuery(category) || "all";
        return (Array.isArray(catalog) ? catalog : [])
            .filter((app) => categoryId === "all" || normalizeQuery(app.category) === categoryId)
            .map((app) => ({ app, rank: searchRank(app, query) }))
            .filter((entry) => entry.rank >= 0)
            .sort((a, b) => b.rank - a.rank || String(a.app.title).localeCompare(String(b.app.title), undefined, { sensitivity: "base" }))
            .map((entry) => entry.app);
    }

    function itemKey(item) {
        if (!item || typeof item !== "object") return "";
        if (item.type === "app") return `app:${item.appId || ""}`;
        if (item.type === "folder") return `folder:${item.folderId || ""}`;
        if (item.type === "widget") return `widget:${item.widgetId || ""}`;
        return "";
    }

    function cloneDefaultPages() {
        return config.pages.map((page) => ({
            id: page.id,
            title: page.title,
            items: page.items.map((item) => ({ ...item }))
        }));
    }

    function visibleFolder(folderId, catalog) {
        const folder = config.folders[folderId];
        if (!folder) return null;
        const appById = new Map((Array.isArray(catalog) ? catalog : []).map((app) => [app.id, app]));
        const apps = folder.appIds.map((id) => appById.get(id)).filter(Boolean);
        return apps.length ? { ...folder, apps } : null;
    }

    function sanitizeLayout(saved, catalog) {
        const appIds = new Set((Array.isArray(catalog) ? catalog : []).map((app) => app.id));
        const sourcePages = Array.isArray(saved?.pages) && saved.pages.length ? saved.pages : cloneDefaultPages();
        const seen = new Set();
        const pages = sourcePages.slice(0, 4).map((page, pageIndex) => {
            const items = (Array.isArray(page?.items) ? page.items : []).slice(0, 24).filter((item) => {
                const key = itemKey(item);
                if (!key || seen.has(key)) return false;
                if (item.type === "app" && !appIds.has(item.appId)) return false;
                if (item.type === "folder" && !visibleFolder(item.folderId, catalog)) return false;
                if (item.type === "widget" && !config.widgets[item.widgetId]) return false;
                seen.add(key);
                return true;
            }).map((item) => ({ ...item }));
            const fallback = config.pages[pageIndex];
            return {
                id: String(page?.id || fallback?.id || `page-${pageIndex + 1}`),
                title: String(page?.title || fallback?.title || `Home ${pageIndex + 1}`),
                items
            };
        });
        while (pages.length < 2) {
            const fallback = cloneDefaultPages()[pages.length];
            fallback.items = fallback.items.filter((item) => {
                const key = itemKey(item);
                if (seen.has(key)) return false;
                if (item.type === "app" && !appIds.has(item.appId)) return false;
                if (item.type === "folder" && !visibleFolder(item.folderId, catalog)) return false;
                seen.add(key);
                return true;
            });
            pages.push(fallback);
        }
        return { schema: config.schema, pages };
    }

    function visibleFeed(catalog, systems) {
        const appIds = new Set((Array.isArray(catalog) ? catalog : []).map((app) => app.id));
        const systemById = new Map((Array.isArray(systems) ? systems : []).map((system) => [system.id, system]));
        return config.feed.map((entry) => {
            const system = entry.sourceId ? systemById.get(entry.sourceId) : null;
            if (entry.sourceId && !system) return null;
            if (entry.appId && !appIds.has(entry.appId)) return null;
            return {
                ...entry,
                label: entry.label || system?.status || "Signal",
                body: entry.body || system?.summary || "",
                icon: entry.icon || system?.icon || "fa-solid fa-circle-info",
                color: entry.color || system?.color || "#22d3ee"
            };
        }).filter(Boolean);
    }

    return {
        config,
        normalizeQuery,
        searchRank,
        searchApps,
        itemKey,
        cloneDefaultPages,
        visibleFolder,
        sanitizeLayout,
        visibleFeed
    };
});
