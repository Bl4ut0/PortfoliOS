/**
 * PortfoliOS: Portfolio Project Data (Systems)
 * Single source of truth for all projects/nodes mapped in the Dev Hub, Dossier, Mobile grid, and Network map.
 */
window.systems = [
    {
        id: "devhub",
        title: "Bl4ut0.dev",
        type: "Developer Portal",
        status: "Online",
        icon: "fa-solid fa-terminal",
        color: "#22d3ee",
        summary: "The public project hub for addons, bots, tools, experiments, and release links.",
        signal: "This is the current visible dev surface: project cards, status badges, GitHub links, CurseForge links, Discord access, and the Light Cycles interaction.",
        tech: ["Static site", "Project grid", "Font Awesome", "Cloudflare", "Public links"],
        links: [
            ["Open Dev Hub", "https://bl4ut0.dev", "fa-solid fa-globe"],
            ["GitHub", "https://github.com/Bl4ut0", "fa-brands fa-github"],
            ["CurseForge", "https://www.curseforge.com/members/bl4ut0/projects", "fa-solid fa-download"]
        ],
        position: [50, 42]
    },
    {
        id: "doomsource",
        title: "Doom",
        type: "Browser source port",
        status: "Playable",
        icon: "doom-icon.png",
        color: "#ef4444",
        summary: "A browser-executed DOOM program that loads the compiled WebAssembly engine and same-origin DOOM.WAD directly inside the portfolio desktop.",
        signal: "The app runs as a local browser program for each visitor: the page fetches the server WAD, mounts it into the Emscripten filesystem, starts the WASM runtime, and hands keyboard focus to the canvas.",
        tech: ["GPL source", "C/C++", "WebAssembly", "Server WAD asset", "Client-side runtime"],
        links: [
            ["id-Software/DOOM", "https://github.com/id-Software/DOOM", "fa-brands fa-github"]
        ],
        launchApp: "doomsource",
        desktopOnly: true,
        position: [39, 31]
    },
    {
        id: "openrct2",
        title: "OpenRCT2",
        type: "Open-source theme park engine",
        status: "Runtime packaged",
        icon: "fa-solid fa-train",
        color: "#22c55e",
        summary: "A PortfoliOS runtime shell for the open-source RollerCoaster Tycoon 2 engine, staged as a Store-installed desktop game.",
        signal: "The app hosts the official Emscripten bootstrap, opens it as an isolated top-level runtime, and includes the packaged engine, OpenRCT2 support data, and server-hosted RCT.zip game data.",
        tech: ["GPLv3", "C++", "WebAssembly", "Emscripten", "Server assets"],
        links: [
            ["Web Runtime", "apps/openrct2/runtime/index.php", "fa-solid fa-play"],
            ["OpenRCT2 Downloads", "https://openrct2.io/downloads", "fa-solid fa-download"],
            ["GitHub", "https://github.com/OpenRCT2/OpenRCT2", "fa-brands fa-github"],
            ["Install Guide", "https://docs.openrct2.io/en/latest/installing/installing-on-windows.html", "fa-solid fa-book"]
        ],
        launchApp: "openrct2",
        desktopOnly: true,
        position: [51, 31]
    },
    {
        id: "duke32",
        title: "Duke Nukem 3D",
        type: "Browser port",
        status: "Playable",
        icon: "fa-solid fa-radiation",
        color: "#eab308",
        summary: "A browser-executed port of Duke Nukem 3D using emduke32.",
        signal: "Runs incredibly fast because it's compiled straight for modern web standards. Renders beautifully in an iframe sandbox.",
        tech: ["Emscripten", "WebAssembly", "C/C++"],
        links: [],
        launchApp: "duke32",
        desktopOnly: true,
        position: [33, 42]
    },
    {
        id: "diablo",
        title: "Diablo",
        type: "Browser port",
        status: "Playable",
        icon: "fa-solid fa-skull",
        color: "#dc2626",
        summary: "DevilutionX web port of the original 1996 Diablo.",
        signal: "Highly polished, fully operational WebAssembly target with full widescreen support.",
        tech: ["DevilutionX", "WebAssembly", "C/C++"],
        links: [],
        launchApp: "diablo",
        desktopOnly: true,
        position: [45, 42]
    },
    {
        id: "quake",
        title: "Quake",
        type: "Browser port",
        status: "Playable",
        icon: "fa-solid fa-bolt",
        color: "#9ca3af",
        summary: "WebQuake native JavaScript/WebGL port of the original Quake 1 engine.",
        signal: "Handles look-aim pointer locking natively and looks stunning running inside a floating iframe window.",
        tech: ["JavaScript", "WebGL", "WebQuake"],
        links: [],
        launchApp: "quake",
        desktopOnly: true,
        position: [39, 53]
    },
    {
        id: "flappybird",
        title: "Flappy Bird",
        type: "Mobile Game",
        status: "Playable",
        icon: "fa-solid fa-kiwi-bird",
        color: "#facc15",
        summary: "A mobile-first arcade clone designed to demonstrate canvas rendering and simple physics in a touch-friendly format.",
        signal: "Runs locally using a lightweight HTML5 canvas engine.",
        tech: ["HTML5 Canvas", "JavaScript", "Game Loop", "Physics"],
        links: [],
        launchApp: "flappybird",
        mobileOnly: true,
        position: [0, 0]
    },
    {
        id: "addons",
        title: "WoW Addons",
        type: "Open-source addon work",
        status: "Active",
        icon: "fa-solid fa-wand-magic-sparkles",
        color: "#f59e0b",
        summary: "Lua and XML work around Classic/TBC Anniversary compatibility, UX, and guild-scale utility.",
        signal: "ItemRack, MarketSync, MeshNav, LibSoundIndex, and LoCA show legacy modernization, data sync, accessibility work, and community release discipline.",
        tech: ["Lua", "Blizzard XML", "WoW API", "Python tooling", "CurseForge"],
        links: [
            ["ItemRack", "https://github.com/Bl4ut0/ItemRack-TBC-Anniversary", "fa-brands fa-github"],
            ["MarketSync", "https://github.com/Bl4ut0/MarketSync", "fa-brands fa-github"],
            ["MeshNav", "https://github.com/Bl4ut0/MeshNav", "fa-brands fa-github"]
        ],
        position: [26, 24]
    },
    {
        id: "guildcraft",
        title: "GuildCraft",
        type: "Community operations platform",
        status: "Dev",
        icon: "fa-solid fa-cubes",
        color: "#a78bfa",
        summary: "A cross-game profession trade system with Discord bot integration, request queues, recipe configuration, and community workflow management.",
        signal: "GuildCraft is the larger successor to Profession-Request, turning a guild bot into a broader platform for crafting logistics and member coordination.",
        tech: ["Next.js", "Redis", "PostgreSQL", "Discord API", "Queues"],
        links: [
            ["Dev Website", "https://dev.guildcraft.io", "fa-solid fa-globe"],
            ["Discord", "https://discord.gg/K6JwVWaUrw", "fa-brands fa-discord"]
        ],
        position: [72, 24]
    },
    {
        id: "homelab",
        title: "Connected Home Lab",
        type: "Infrastructure and network architecture",
        status: "Stable",
        icon: "fa-solid fa-server",
        color: "#34d399",
        summary: "A residential infrastructure stack with isolated tenant networking, homelab services, monitoring, automation, and secure remote access.",
        signal: "VLAN segmentation, Proxmox, Docker, Tailscale, Netdata, n8n, and firewall policy turn a home network into a managed operating environment.",
        tech: ["Proxmox VE", "Docker", "Linux", "VLANs", "Tailscale", "Netdata", "n8n"],
        links: [],
        position: [25, 66]
    },
    {
        id: "survival-ai",
        title: "Survival AI",
        type: "Local-first knowledge system",
        status: "Planned",
        icon: "fa-solid fa-brain",
        color: "#2dd4bf",
        summary: "An offline, local LLM and retrieval platform for high-contingency knowledge access without internet dependency.",
        signal: "The idea centers on durable Markdown, local vector search, air-gapped Linux nodes, and carefully structured reference corpuses.",
        tech: ["Local LLMs", "Vector DBs", "Markdown", "Linux", "Air-gapped design"],
        links: [],
        position: [72, 66]
    },
    {
        id: "media",
        title: "M3 Prism",
        type: "Multimedia desktop app",
        status: "Dev",
        icon: "fa-solid fa-play",
        color: "#60a5fa",
        summary: "A universal multimedia hub for high-bitrate playlists, Xtream codes, SMB/DLNA libraries, and broad codec support.",
        signal: "This project shows app-shell thinking across local media, streamed content, and practical desktop workflows.",
        tech: ["React", "Electron", "IPTV", "SMB", "DLNA"],
        links: [
            ["GitHub", "https://github.com/Bl4ut0/M3Prism", "fa-brands fa-github"]
        ],
        position: [47, 78]
    },
    {
        id: "automation",
        title: "RCE and Automation",
        type: "Cloudflare and orchestration",
        status: "Stable",
        icon: "fa-solid fa-network-wired",
        color: "#fb7185",
        summary: "A proxy and workflow layer around analytics data, GraphQL access, rate pacing, and n8n webhook orchestration.",
        signal: "RCE connects public APIs, Cloudflare Workers, spreadsheet workflows, and automation queues into a controlled integration layer.",
        tech: ["Cloudflare Workers", "GraphQL", "n8n", "Webhooks", "Rate pacing"],
        links: [
            ["GitHub", "https://github.com/Bl4ut0/RCE-Proxy", "fa-brands fa-github"]
        ],
        position: [50, 17]
    },
    {
        id: "status",
        title: "Status Console",
        type: "Public service health",
        status: "Planned",
        icon: "fa-solid fa-signal",
        color: "#34d399",
        summary: "A future public status surface for community tools, hosted services, bots, and project endpoints.",
        signal: "This node is ready to connect uptime monitors, incident notes, maintenance windows, and public-facing service health.",
        tech: ["Uptime checks", "Service health", "Incidents", "Cloudflare", "Community tools"],
        links: [],
        position: [14, 45]
    },
    {
        id: "wardenit",
        title: "WardenIT",
        type: "Professional services identity",
        status: "Planned",
        icon: "fa-solid fa-briefcase",
        color: "#f59e0b",
        summary: "The professional/business node for systems administration, support experience, infrastructure work, and client-facing services.",
        signal: "This can become the clean route for resume material, consulting language, client trust signals, and professional contact flow.",
        tech: ["Linux admin", "SLA support", "PowerShell", "Active Directory", "Infrastructure"],
        links: [],
        position: [86, 45]
    }
];
