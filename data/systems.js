/**
 * PortfoliOS: Portfolio Project Data & System Architecture Knowledge Base (Systems)
 * Single source of truth for all projects, architecture nodes, and wiki articles mapped in
 * Quick Review, Dev Hub, Dossier, Mobile grid, and Network map.
 */
window.systems = [
    {
        id: "wardenit",
        title: "WardenIT",
        category: "Enterprise Infrastructure & Services",
        type: "Managed IT & Systems Engineering Firm",
        status: "Active",
        icon: "fa-solid fa-briefcase",
        color: "#f59e0b",
        summary: "Independent managed IT, systems engineering, cybersecurity, and automation firm founded by Alex \"Bl4ut0\" Mammen.",
        overview: "WardenIT provides high-availability infrastructure design, proactive cybersecurity, managed networking, cloud migration, and workflow automation for growing businesses. Focused on turnkey IT management, local data sovereignty, and robust disaster recovery.",
        architecture: "Enterprise environments architected by WardenIT leverage isolated 802.1Q VLAN network segmentation, multi-node hypervisor virtualization clusters (Proxmox VE / Hyper-V), automated RPO/RTO backup policies, and zero-trust remote access gateways without exposing inbound perimeter ports.",
        capabilities: [
            { icon: "fa-solid fa-server", title: "Managed Infrastructure", desc: "Turnkey server virtualization, high-availability clusters, SAN storage, and proactive health monitoring." },
            { icon: "fa-solid fa-shield-halved", title: "Enterprise Cybersecurity", desc: "Perimeter firewall configuration, segmented VLANs, endpoint defense, and zero-trust tunneling." },
            { icon: "fa-solid fa-gears", title: "Automation & Integration", desc: "Custom n8n orchestration pipelines, Python API middleware, and automated workstation provisioning." },
            { icon: "fa-solid fa-cloud-arrow-up", title: "Disaster Recovery", desc: "Immutable off-site snapshot replication, automated backup testing, and rapid recovery orchestration." }
        ],
        engineeringNotes: "Built from over a decade of production systems administration and enterprise infrastructure design. WardenIT emphasizes immutable backups, least-privilege identity access, and continuous automation over reactive break-fix firefighting.",
        signal: "The live WardenIT portal connects client support, systems engineering capabilities, infrastructure architecture, and consultative service requests in one unified professional platform.",
        tech: ["Managed IT", "Systems Engineering", "Network Security", "Proxmox VE", "Linux / Windows Server", "Zero Trust", "n8n", "Python", "Cloudflare"],
        links: [
            ["WardenIT Website", "https://wardenit.com/", "fa-solid fa-globe"]
        ],
        audience: "both",
        position: [86, 45]
    },
    {
        id: "devhub",
        title: "Bl4ut0.dev",
        category: "Developer Portal & Community Hub",
        type: "Central Developer Hub",
        status: "Online",
        icon: "fa-solid fa-terminal",
        color: "#22d3ee",
        summary: "The public project hub and central gateway for all addons, bots, tools, experiments, and release links created by Alex \"Bl4ut0\" Mammen.",
        overview: "Bl4ut0.dev serves as the primary public nexus connecting software releases, open-source repositories, Discord community channels, CurseForge distributions, and experimental web engines. It offers real-time status signals, direct artifact downloads, and interactive canvas visualizers.",
        architecture: "Deployed across Cloudflare's global edge network as a zero-latency static web application. Integrates real-time operational status badges, Font Awesome icon systems, responsive project matrices, and WebGL/Canvas visualizers (including the Light Cycles simulation).",
        capabilities: [
            { icon: "fa-solid fa-table-cells-large", title: "Project Directory", desc: "Comprehensive, searchable index of all software, game ports, and tooling projects." },
            { icon: "fa-solid fa-network-wired", title: "Status & Signals", desc: "Live health indicators and deployment status across all public endpoints." },
            { icon: "fa-solid fa-gamepad", title: "Interactive Canvas", desc: "High-performance HTML5 Canvas simulation showcasing game loop math and retro rendering." },
            { icon: "fa-solid fa-download", title: "Release Distribution", desc: "Direct distribution gateway connecting GitHub releases and CurseForge packages." }
        ],
        engineeringNotes: "Engineered for maximum accessibility and zero-dependency reliability. The site requires no heavy frameworks, loading instantly on any device and functioning fully offline through aggressive edge caching.",
        signal: "This is the primary public dev surface: project cards, status badges, GitHub links, CurseForge links, Discord access, and the Light Cycles canvas interaction.",
        tech: ["Static Architecture", "Cloudflare Pages", "Font Awesome", "HTML5 Canvas", "REST APIs", "Modern CSS"],
        links: [
            ["Open Dev Hub", "https://bl4ut0.dev", "fa-solid fa-globe"],
            ["GitHub", "https://github.com/Bl4ut0", "fa-brands fa-github"],
            ["CurseForge", "https://www.curseforge.com/members/bl4ut0/projects", "fa-solid fa-download"]
        ],
        audience: "both",
        position: [50, 42]
    },
    {
        id: "addons",
        title: "WoW Addons",
        category: "Game Engineering & Tooling",
        type: "Open-source Addon Engineering",
        status: "Active",
        icon: "fa-solid fa-wand-magic-sparkles",
        color: "#f59e0b",
        summary: "Lua and XML addon modernization for World of Warcraft Classic and TBC Anniversary, focusing on UX, data sync, and guild utility.",
        overview: "A specialized suite of deeply optimized game modifications and developer libraries for World of Warcraft Classic and TBC Anniversary. Projects tackle legacy code modernization, memory allocation optimization, peer-to-peer data synchronization, and accessibility.",
        architecture: "Addons execute within the embedded Blizzard Lua sandbox using FrameXML event dispatchers. Cross-player data is serialized into compressed byte payloads transmitted over hidden addon messaging channels (e.g. `C_ChatInfo.SendAddonMessage`).",
        capabilities: [
            { icon: "fa-solid fa-shield", title: "ItemRack Modernization", desc: "Refactored legacy equipment management with modern secure action templates and taint-free frame layering." },
            { icon: "fa-solid fa-arrow-right-arrow-left", title: "MarketSync Peer Protocol", desc: "Decentralized auction house ledger sync between guild members over in-game chat channels." },
            { icon: "fa-solid fa-compass", title: "MeshNav 3D Pathfinding", desc: "Spatial navigation mesh library providing coordinate abstraction and route guidance for Lua." },
            { icon: "fa-solid fa-volume-high", title: "LibSoundIndex", desc: "Indexed audio registry abstracting soundkit playback across client versions." }
        ],
        engineeringNotes: "Overcame severe legacy architectural limitations in ItemRack by rebuilding the event queue, isolating secure execution buttons to eliminate Blizzard UI taint, and redesigning the set-switching engine to handle instant stance and weapon swapping without frame stutter.",
        signal: "ItemRack, MarketSync, MeshNav, LibSoundIndex, and LoCA show legacy modernization, data sync, accessibility work, and community release discipline.",
        tech: ["Lua 5.1", "Blizzard XML", "WoW API", "Python build tooling", "CurseForge"],
        links: [
            ["ItemRack TBC", "https://github.com/Bl4ut0/ItemRack-TBC-Anniversary", "fa-brands fa-github"],
            ["MarketSync", "https://github.com/Bl4ut0/MarketSync", "fa-brands fa-github"],
            ["MeshNav", "https://github.com/Bl4ut0/MeshNav", "fa-brands fa-github"]
        ],
        audience: "both",
        position: [26, 24]
    },
    {
        id: "guildcraft",
        title: "GuildCraft",
        category: "Distributed Platforms & Bots",
        type: "Community Operations Platform",
        status: "Dev",
        icon: "fa-solid fa-cubes",
        color: "#a78bfa",
        summary: "Cross-game profession trade system with Discord bot integration, request queues, recipe trees, and community workflow management.",
        overview: "GuildCraft is an enterprise-grade community operations and crafting platform built for large gaming organizations. It unifies Discord bot interactions with a responsive web dashboard, allowing members to place crafting orders, track required materials, and calculate guild-wide trade logistics.",
        architecture: "Built on Next.js and TypeScript, backed by PostgreSQL for structured recipe and member databases and Redis for real-time order queue serialization. A specialized Discord.js microservice translates slash commands into transactional API calls.",
        capabilities: [
            { icon: "fa-brands fa-discord", title: "Discord Bot Slash Commands", desc: "Instant crafting requests and inventory queries directly from guild Discord servers." },
            { icon: "fa-solid fa-list-ol", title: "Redis Priority Queues", desc: "Asynchronous order processing prioritizing raid-critical items and active crafters." },
            { icon: "fa-solid fa-sitemap", title: "Dynamic Recipe Graph", desc: "Recursive material tree calculation breaking down complex items into raw reagents." },
            { icon: "fa-solid fa-chart-pie", title: "Guild Trade Analytics", desc: "Comprehensive dashboards detailing guild material throughput and crafter fulfillment." }
        ],
        engineeringNotes: "Designed to eliminate manual spreadsheet management in large MMO guilds. Built with strict transaction semantics so orders are never double-claimed or lost during high-traffic raid nights.",
        signal: "GuildCraft is the larger successor to Profession-Request, turning a guild bot into a broader platform for crafting logistics and member coordination.",
        tech: ["Next.js", "TypeScript", "Redis", "PostgreSQL", "Discord API", "Queues", "Tailwind CSS"],
        links: [
            ["Dev Website", "https://dev.guildcraft.io", "fa-solid fa-globe"],
            ["Discord Server", "https://discord.gg/K6JwVWaUrw", "fa-brands fa-discord"]
        ],
        audience: "both",
        position: [72, 24]
    },
    {
        id: "homelab",
        title: "Connected Home Lab",
        category: "Enterprise Infrastructure & Networking",
        type: "Infrastructure & Network Architecture",
        status: "Stable",
        icon: "fa-solid fa-server",
        color: "#34d399",
        summary: "Residential enterprise infrastructure stack with isolated tenant networking, homelab services, monitoring, and zero-trust remote access.",
        overview: "A multi-node hypervisor cluster and managed network architecture providing self-hosted computing, storage, monitoring, automation, and continuous delivery pipelines in a private residential data center.",
        architecture: "Clustered Proxmox VE hypervisors host dedicated Linux Containers (LXC) and virtual machines. Network traffic is strictly isolated across 802.1Q VLANs (Management, Trusted, IoT, Public Server DMZ). Ingress is secured via Tailscale WireGuard mesh and Cloudflare Zero Trust tunnels without exposing any inbound ports.",
        capabilities: [
            { icon: "fa-solid fa-network-wired", title: "802.1Q Network Segmentation", desc: "Managed switches and router firewall rules enforcing zero-trust boundaries between IoT and core servers." },
            { icon: "fa-solid fa-cubes", title: "Proxmox & Docker Clusters", desc: "High-density containerization hosting reverse proxies, databases, and microservices." },
            { icon: "fa-solid fa-lock", title: "Zero Inbound Exposure", desc: "End-to-end encrypted mesh routing via Tailscale and Cloudflare Tunnels." },
            { icon: "fa-solid fa-chart-line", title: "Real-Time Observability", desc: "Continuous hardware and network metric aggregation using Netdata and Prometheus." }
        ],
        engineeringNotes: "Engineered as a living testbed for production infrastructure methodologies. All configurations are versioned as code with automated snapshotting and off-site cloud replication.",
        signal: "VLAN segmentation, Proxmox, Docker, Tailscale, Netdata, n8n, and firewall policy turn a home network into a managed operating environment.",
        tech: ["Proxmox VE", "Docker", "Debian Linux", "802.1Q VLANs", "Tailscale", "Netdata", "n8n", "ZFS"],
        links: [],
        audience: "both",
        position: [25, 66]
    },
    {
        id: "pki",
        title: "Managed PKI & CA",
        category: "Security Infrastructure & Cryptography",
        type: "Security & Trust Infrastructure",
        status: "Online",
        icon: "fa-solid fa-shield-halved",
        color: "#38bdf8",
        summary: "Internally managed Public Key Infrastructure (PKI) issuing TLS/SSL certificates and deploying Global Certificate Authority (GCA) root trust.",
        overview: "A multi-tier cryptographic trust authority providing internal TLS certificate generation, intermediate issuing authorities, and automated trust distribution for home, enterprise, and testing environments.",
        architecture: "Two-tier hierarchy with an offline, air-gapped Root Certificate Authority and online Intermediate Issuing Authorities. ACME server integration facilitates automated certificate enrollment, renewal, and validation across internal hostnames.",
        capabilities: [
            { icon: "fa-solid fa-key", title: "Two-Tier Hierarchy", desc: "Air-gapped Root CA signing intermediate CAs, minimizing private key exposure." },
            { icon: "fa-solid fa-arrows-rotate", title: "Automated ACME Issuance", desc: "Zero-touch certificate renewal across web servers, internal APIs, and storage endpoints." },
            { icon: "fa-solid fa-vial", title: "Public Trust Test Portal", desc: "Dedicated verification page confirming valid root certificate installation in client browsers." }
        ],
        engineeringNotes: "Enforces 4096-bit RSA and ECDSA P-384 cryptography with strict RFC 5280 constraints, modern Subject Alternative Name (SAN) enforcement, and SHA-256 signatures.",
        signal: "Provides automated certificate management, intermediate CA issuing, GCA root deployment guides, and validation test pages to verify certificate trust installation.",
        tech: ["PKI", "Certificate Authority", "TLS/SSL", "X.509", "ACME Protocol", "GCA Root"],
        links: [
            ["PKI Portal", "https://pki.bl4ut0.dev/", "fa-solid fa-lock"],
            ["PKI Test Page", "https://pki.bl4ut0.dev/test", "fa-solid fa-vial"]
        ],
        audience: "both",
        position: [30, 72]
    },
    {
        id: "automation",
        title: "RCE and Automation",
        category: "Cloud Architecture & Integration",
        type: "Cloudflare Edge & Orchestration",
        status: "Stable",
        icon: "fa-solid fa-network-wired",
        color: "#fb7185",
        summary: "Edge proxy and workflow integration layer mediating analytics feeds, GraphQL schemas, rate pacing, and n8n webhook orchestration.",
        overview: "A lightweight, resilient integration middleware built on Cloudflare Workers. It acts as an intelligent API reverse proxy, rate-limiting gate, and event dispatcher connecting third-party web services to internal homelab automations.",
        architecture: "Runs on Cloudflare's serverless V8 edge compute. Intercepts incoming webhooks and queries, sanitizes and validates incoming payloads, paces outbound API bursts, and triggers n8n workflow queues over secure tunnels.",
        capabilities: [
            { icon: "fa-solid fa-bolt", title: "Edge Rate Pacing", desc: "Token bucket rate limiting preventing downstream API quota exhaustion." },
            { icon: "fa-solid fa-route", title: "GraphQL Query Mediation", desc: "Intelligent schema proxying and response caching at the edge." },
            { icon: "fa-solid fa-diagram-project", title: "n8n Webhook Dispatch", desc: "Asynchronous task delivery powering multi-step data pipelines." }
        ],
        engineeringNotes: "Eliminated the need to expose internal orchestration endpoints to the public internet by using edge authentication, cryptographic HMAC signature verification, and Tailscale egress routing.",
        signal: "RCE connects public APIs, Cloudflare Workers, spreadsheet workflows, and automation queues into a controlled integration layer.",
        tech: ["Cloudflare Workers", "TypeScript", "GraphQL", "n8n", "Webhooks", "Edge Computing"],
        links: [
            ["GitHub Repository", "https://github.com/Bl4ut0/RCE-Proxy", "fa-brands fa-github"]
        ],
        audience: "both",
        position: [50, 17]
    },
    {
        id: "portfolios-core",
        title: "PortfoliOS Core System",
        category: "Operating System Architecture",
        type: "Web Operating System Platform",
        status: "Online",
        icon: "fa-solid fa-desktop",
        color: "#22d3ee",
        summary: "A complete virtual Linux desktop and mobile operating system executed directly in modern client browsers with cloud synchronization.",
        overview: "PortfoliOS is an advanced browser-based operating system providing window management, virtualized POSIX filesystems, WebAssembly container execution, zero-trust file quarantine, and memory-safe multi-cloud profile synchronization.",
        architecture: "Client-centric, zero-backend-dependency architecture. All apps, compilers, image processors, and games execute on the visitor's local machine via WebAssembly and Web Workers. Cloud sync operates through personal user-controlled Google Drive, OneDrive, or Dropbox AppData sandboxes.",
        capabilities: [
            { icon: "fa-solid fa-window-restore", title: "Desktop & Mobile Parity", desc: "Adaptive UI rendering desktop windowing or touch-first mobile launcher from the same state tree." },
            { icon: "fa-solid fa-folder-tree", title: "SystemFS Virtual Storage", desc: "Transactional IndexedDB filesystem with quotas, path sanitization, and change event buses." },
            { icon: "fa-solid fa-microchip", title: "WASM POSIX Containers", desc: "Isolated WebAssembly execution threads with PTY terminal emulation and WASI syscall routing." },
            { icon: "fa-solid fa-cloud-arrow-up", title: "Memory-Only Cloud Sync", desc: "OAuth tokens never touch disk, backed by an atomic server-side handoff lease coordinator." }
        ],
        engineeringNotes: "Engineered from scratch to demonstrate that the browser is a full operating system runtime. Bypasses server hosting costs by shifting heavy computing (CAD, compilers, emulators) entirely to client WebAssembly.",
        signal: "PortfoliOS represents the unification of systems engineering, frontend architecture, and client-side container execution.",
        tech: ["JavaScript (ES2022)", "WebAssembly", "Web Workers", "IndexedDB", "WASI", "Service Worker"],
        links: [
            ["Project Repository", "https://github.com/Bl4ut0/PortfoliOS", "fa-brands fa-github"]
        ],
        audience: "both",
        position: [50, 50]
    },
    {
        id: "doomsource",
        title: "Doom (1993)",
        category: "WebAssembly Game Engines",
        type: "Browser WASM Port",
        status: "Playable",
        icon: "doom-icon.png",
        color: "#ef4444",
        summary: "Full client-side Doom engine compiled to WebAssembly, mounting same-origin WADs directly into the portfolio desktop.",
        overview: "The original 1993 id Software Doom engine compiled to WebAssembly via Emscripten. Runs with full software rendering, MIDI audio emulation, keyboard/mouse input, and save-state persistence.",
        architecture: "Mounts the shareware `DOOM.WAD` into an in-memory virtual filesystem, hooks into an HTML5 Canvas WebGL context, and loops game ticks using `requestAnimationFrame`. Canvas pointer lock provides authentic mouse look.",
        capabilities: [
            { icon: "fa-solid fa-microchip", title: "Native WASM Execution", desc: "C codebase compiled directly to WebAssembly with zero server-side processing." },
            { icon: "fa-solid fa-volume-high", title: "Web Audio Synthesizer", desc: "OPL3 FM synthesis simulation rendering classic Doom sound effects and music." },
            { icon: "fa-solid fa-floppy-disk", title: "Persistent Save Games", desc: "Engine save files are captured and stored in PortfoliOS SystemFS under `/games/doom/`." }
        ],
        engineeringNotes: "Configured Emscripten compilation flags for maximum optimization (`-O3`, `-s USE_SDL=2`), eliminating garbage-collection hiccups and maintaining a locked 60 FPS in floating desktop windows.",
        signal: "Demonstrates high-performance C-to-WebAssembly compilation and seamless canvas window integration.",
        tech: ["C/C++", "WebAssembly", "Emscripten", "SDL2", "HTML5 Canvas"],
        links: [
            ["id-Software DOOM", "https://github.com/id-Software/DOOM", "fa-brands fa-github"]
        ],
        launchApp: "doomsource",
        desktopOnly: true,
        audience: "both",
        position: [39, 31]
    },
    {
        id: "openrct2",
        title: "OpenRCT2",
        category: "WebAssembly Game Engines",
        type: "Packaged WASM Theme Park Engine",
        status: "Playable",
        icon: "fa-solid fa-train",
        color: "#22c55e",
        summary: "Packaged WebAssembly runtime shell for the open-source RollerCoaster Tycoon 2 engine, integrated into PortfoliOS.",
        overview: "OpenRCT2 is the definitive open-source re-implementation of RollerCoaster Tycoon 2. This port runs the full engine inside a desktop window, complete with park management, ride physics, and guest simulation.",
        architecture: "Hosts the official Emscripten build inside a sandboxed iframe runtime shell. The engine pulls packaged OpenRCT2 asset archives and RCT2 base data from server endpoints and mounts them into IndexedDB.",
        capabilities: [
            { icon: "fa-solid fa-gamepad", title: "Full RCT2 Simulation", desc: "100% feature-complete park management, coaster construction, and simulation logic." },
            { icon: "fa-solid fa-download", title: "Dynamic Asset Streaming", desc: "Large game data packages are streamed and cached client-side in browser storage." }
        ],
        engineeringNotes: "Engineered download guards and referer validation to protect game asset distribution while ensuring smooth IndexedDB caching across browser sessions.",
        signal: "The app hosts the official Emscripten bootstrap, opens it as an isolated top-level runtime, and includes packaged engine support data.",
        tech: ["C++", "WebAssembly", "Emscripten", "IndexedDB", "GPLv3"],
        links: [
            ["OpenRCT2 Project", "https://openrct2.io", "fa-solid fa-globe"],
            ["GitHub", "https://github.com/OpenRCT2/OpenRCT2", "fa-brands fa-github"]
        ],
        launchApp: "openrct2",
        desktopOnly: true,
        audience: "both",
        position: [51, 31]
    },
    {
        id: "duke32",
        title: "Duke Nukem 3D",
        category: "WebAssembly Game Engines",
        type: "Browser WASM Port",
        status: "Playable",
        icon: "fa-solid fa-radiation",
        color: "#eab308",
        summary: "Client-side WebAssembly port of the classic Build engine shooter Duke Nukem 3D.",
        overview: "Emscripten-compiled Build engine executing Duke Nukem 3D shareware directly in the browser with full audio, renderer, and mouse aiming.",
        capabilities: [
            { icon: "fa-solid fa-cube", title: "Build Engine 2.5D", desc: "Authentic 1996 Ken Silverman sector-based rendering engine." },
            { icon: "fa-solid fa-volume-high", title: "Digital Audio & Music", desc: "SoundFX and MIDI playback mediated through Web Audio API." }
        ],
        engineeringNotes: "Configured sandbox iframe permissions (`pointer-lock`, `autoplay`) to ensure mouse capture works smoothly without escaping window bounds.",
        signal: "Runs client-side using compiled WebAssembly. Renders smoothly in a floating window.",
        tech: ["Emscripten", "WebAssembly", "C/C++", "Build Engine"],
        links: [],
        launchApp: "duke32",
        desktopOnly: true,
        audience: "both",
        position: [33, 42]
    },
    {
        id: "diablo",
        title: "Diablo (1996)",
        category: "WebAssembly Game Engines",
        type: "DevilutionX WASM Port",
        status: "Playable",
        icon: "fa-solid fa-skull",
        color: "#dc2626",
        summary: "DevilutionX WebAssembly port of the legendary 1996 action RPG Diablo.",
        overview: "A browser-executed port of DevilutionX, the open-source preservation of Diablo. Features modern widescreen rendering, touch controls on mobile, and smooth 60 FPS animation.",
        capabilities: [
            { icon: "fa-solid fa-gamepad", title: "Full ARPG Gameplay", desc: "Complete dungeon crawling, inventory, magic system, and monster AI." },
            { icon: "fa-solid fa-expand", title: "Widescreen Support", desc: "Enhanced viewport aspect ratios adapted for modern monitors and tablets." }
        ],
        engineeringNotes: "Integrated DevilutionX's Emscripten target with PortfoliOS window management, ensuring canvas resizing correctly scales pixel art without blurring.",
        signal: "Highly polished, fully operational WebAssembly target with full widescreen support.",
        tech: ["DevilutionX", "WebAssembly", "C/C++", "SDL2"],
        links: [
            ["DevilutionX GitHub", "https://github.com/diasurgical/devilutionX", "fa-brands fa-github"]
        ],
        launchApp: "diablo",
        desktopOnly: true,
        audience: "both",
        position: [45, 42]
    },
    {
        id: "quake",
        title: "Quake (1996)",
        category: "WebAssembly Game Engines",
        type: "WebQuake Engine Port",
        status: "Playable",
        icon: "fa-solid fa-bolt",
        color: "#9ca3af",
        summary: "WebQuake native WebGL port of the original 3D Quake engine.",
        overview: "True 3D graphics in the browser. Uses WebGL shaders to render Quake's polygon BSP levels, dynamic lightmaps, and monster models with native mouse look.",
        capabilities: [
            { icon: "fa-solid fa-cube", title: "Native WebGL Pipeline", desc: "Hardware-accelerated 3D rendering with texture filtering and dynamic light maps." },
            { icon: "fa-solid fa-crosshairs", title: "Pointer Lock Controls", desc: "Authentic first-person WASD + mouse aiming with customizable sensitivity." }
        ],
        engineeringNotes: "Optimized WebGL buffer updates and sound sample streaming to maintain zero-latency rendering inside window frames.",
        signal: "Handles pointer lock aiming natively and renders smoothly inside a floating iframe window.",
        tech: ["JavaScript", "WebGL", "WebQuake", "Web Audio"],
        links: [],
        launchApp: "quake",
        desktopOnly: true,
        audience: "both",
        position: [39, 53]
    },
    {
        id: "flappybird",
        title: "Flappy Bird",
        category: "WebAssembly Game Engines",
        type: "HTML5 Canvas Arcade",
        status: "Playable",
        icon: "fa-solid fa-kiwi-bird",
        color: "#facc15",
        summary: "Touch-friendly arcade mini-game built to demonstrate canvas rendering and physics in mobile viewports.",
        overview: "A lightweight, responsive HTML5 Canvas arcade game optimized for both touchscreens and keyboard spacebar control. Features physics gravity calculations and high-score persistence.",
        capabilities: [
            { icon: "fa-solid fa-mobile-screen", title: "Touch & Click Parity", desc: "Instant tap response on mobile and spacebar/click support on desktop." },
            { icon: "fa-solid fa-trophy", title: "Local Storage High Scores", desc: "Best scores are preserved locally in user profile storage." }
        ],
        engineeringNotes: "Zero external assets or heavy libraries; built purely with vanilla JavaScript and standard HTML5 2D Canvas context.",
        signal: "Runs locally using a lightweight HTML5 canvas engine.",
        tech: ["HTML5 Canvas", "JavaScript", "Game Loop", "Physics"],
        links: [],
        launchApp: "flappybird",
        mobileOnly: true,
        audience: "both",
        position: [0, 0]
    },
    {
        id: "survival-ai",
        title: "Survival AI",
        category: "AI & Knowledge Systems",
        type: "Local-first Knowledge System",
        status: "Planned",
        icon: "fa-solid fa-brain",
        color: "#2dd4bf",
        summary: "Offline, local LLM and retrieval platform for high-contingency knowledge access without internet connectivity.",
        overview: "An air-gapped, offline survival and technical reference platform designed to run small quantized language models (e.g. 1B-3B parameters) and dense vector search on low-power local devices.",
        capabilities: [
            { icon: "fa-solid fa-book", title: "Offline Technical Corpus", desc: "Extensive offline markdown libraries for medical, engineering, and survival protocols." },
            { icon: "fa-solid fa-microchip", title: "Local Vector Retrieval", desc: "In-memory vector database querying documents with zero cloud dependency." }
        ],
        engineeringNotes: "Conceived as an emergency contingency tool, prioritizing compact binary model weights, minimal battery consumption, and immutable local storage.",
        signal: "The idea centers on durable Markdown, local vector search, air-gapped Linux nodes, and carefully structured reference corpuses.",
        tech: ["Local LLMs", "Vector DBs", "Markdown", "Linux", "Air-gapped design"],
        links: [],
        audience: "both",
        position: [72, 66]
    },
    {
        id: "media",
        title: "M3 Prism",
        category: "Multimedia Desktop Applications",
        type: "Multimedia Hub & Player",
        status: "Dev",
        icon: "fa-solid fa-play",
        color: "#60a5fa",
        summary: "Universal multimedia hub for high-bitrate streaming playlists, Xtream codes, SMB/DLNA libraries, and broad codec playback.",
        overview: "A desktop media workstation designed to aggregate disparate media streams, local file shares, and IPTV playlists into an organized, hardware-accelerated media station.",
        capabilities: [
            { icon: "fa-solid fa-tv", title: "IPTV & Xtream Support", desc: "Live stream decoding with electronic program guides (EPG) and category grouping." },
            { icon: "fa-solid fa-folder-open", title: "Network Shares (SMB)", desc: "Direct streaming from local NAS storage and DLNA media servers." }
        ],
        engineeringNotes: "Explores modern desktop shell design for streaming video, caching metadata, and managing high-volume playlist indices efficiently.",
        signal: "This project shows app-shell thinking across local media, streamed content, and practical desktop workflows.",
        tech: ["React", "Electron", "IPTV", "SMB", "DLNA", "HLS"],
        links: [
            ["GitHub Repository", "https://github.com/Bl4ut0/M3Prism", "fa-brands fa-github"]
        ],
        audience: "both",
        position: [47, 78]
    },
    {
        id: "status",
        title: "Status Console",
        category: "Cloud Architecture & Integration",
        type: "Public Service Health & Telemetry",
        status: "Planned",
        icon: "fa-solid fa-signal",
        color: "#34d399",
        summary: "Public service health and telemetry dashboard tracking uptime, bot availability, and endpoints across all community tools.",
        overview: "Central status page aggregating real-time ping monitors, webhook health checks, and service incidents into a unified public monitoring view.",
        capabilities: [
            { icon: "fa-solid fa-heart-pulse", title: "Continuous Health Checks", desc: "Automated HTTP and WebSocket pinging across all hosted projects." },
            { icon: "fa-solid fa-triangle-exclamation", title: "Incident Logging", desc: "Public incident timeline and scheduled maintenance announcements." }
        ],
        engineeringNotes: "Designed to pull telemetry from Cloudflare edge checks and homelab Prometheus exporters without exposing internal network details.",
        signal: "This node connects uptime monitors, incident notes, maintenance windows, and public-facing service health.",
        tech: ["Uptime checks", "Service health", "Incidents", "Cloudflare", "Prometheus"],
        links: [],
        audience: "both",
        position: [14, 45]
    },

    /* =========================================================================
     * PRIVATE WORKSPACE SYSTEM WIKI & ARCHITECTURE KNOWLEDGE BASE (Audience: Private)
     * ========================================================================= */
    {
        id: "systemfs-arch",
        title: "SystemFS Virtual Filesystem",
        category: "Operating System Architecture",
        type: "Layered Virtual Filesystem",
        status: "Core Subsystem",
        icon: "fa-solid fa-folder-tree",
        color: "#22d3ee",
        summary: "Hierarchical POSIX virtual filesystem with transactional atomic commits, IndexedDB backing, path sanitization, and quota tracking.",
        overview: "SystemFS is the fundamental storage backbone of PortfoliOS. It provides standard POSIX filesystem semantics (`readFile`, `writeFile`, `mkdir`, `deleteFile`, `getAllFiles`) entirely inside the browser, persisting user data across sessions in IndexedDB.",
        architecture: "Operates as a three-tier storage engine:\n1. **In-Memory Cache**: Active file records, directory trees, and metadata are cached for synchronous, low-latency lookups.\n2. **IndexedDB Object Stores**: Files, directories, and metadata are committed transactionally to ensure persistence across browser reloads.\n3. **EventBus Dispatcher**: Emits `fs:changed` events on any mutation, reactively alerting the Desktop, Taskbar, and CloudSync engines.",
        capabilities: [
            { icon: "fa-solid fa-shield", title: "Strict Path Normalization", desc: "Blocks path traversal (`../`), null-byte poisoning, and invalid character escapes." },
            { icon: "fa-solid fa-database", title: "Atomic Transaction Commits", desc: "Guarantees file integrity during simultaneous read/write bursts across multiple app windows." },
            { icon: "fa-solid fa-users-gear", title: "Profile Isolation", desc: "Per-user directories (`/home/<user>/`) isolated by security fences to prevent cross-account data leakage." },
            { icon: "fa-solid fa-clock-rotate-left", title: "Change Revisions", desc: "Monotonically increasing file revisions enable distributed cloud conflict detection." }
        ],
        engineeringNotes: "To ensure that file operations never lock the UI thread during large file transfers (e.g. 50 MB ROMs or CAD assemblies), SystemFS utilizes chunked Blob streaming with zero-copy object URLs.",
        signal: "Provides the underlying file storage, desktop layouts, and application workspace persistence for all PortfoliOS apps.",
        tech: ["IndexedDB", "Blob API", "POSIX Paths", "EventBus", "SHA-256"],
        links: [],
        audience: "private",
        position: [50, 50]
    },
    {
        id: "wasm-engine",
        title: "WASM POSIX Container Engine",
        category: "Operating System Architecture",
        type: "WebAssembly Container Runtime",
        status: "Core Subsystem",
        icon: "fa-solid fa-microchip",
        color: "#a78bfa",
        summary: "Client-side WebAssembly POSIX execution environment with virtualized standard I/O, PTY terminal emulator, and WASI bridge.",
        overview: "The WASM Container Engine turns PortfoliOS into a virtual Linux-like runtime environment in the browser. It allows compiled C, C++, Rust, and Go binaries to run locally inside sandboxed Web Workers with access to virtual terminal I/O and SystemFS files.",
        architecture: "Separates execution into isolated Web Workers communicating with the main thread via structured `postMessage` channels. A custom WASI (WebAssembly System Interface) bridge intercepts standard POSIX system calls (`fd_read`, `fd_write`, `path_open`) and translates them directly into asynchronous SystemFS calls.",
        capabilities: [
            { icon: "fa-solid fa-terminal", title: "Interactive PTY Controller", desc: "Handles ANSI terminal escapes, line buffering, raw mode, keyboard control sequences, and window resizing." },
            { icon: "fa-solid fa-shield-halved", title: "Sandboxed Worker Threads", desc: "Executes untrusted compiled binaries in isolated Web Workers without main-thread blocking." },
            { icon: "fa-solid fa-arrow-right-arrow-left", title: "WASI Filesystem Routing", desc: "Virtual `/dev/stdin`, `/dev/stdout`, and preopened `/home/` directories mapped to browser storage." },
            { icon: "fa-solid fa-stopwatch", title: "Execution Timeout Fences", desc: "Monitors worker health and cleanly terminates non-returning or crashed processes." }
        ],
        engineeringNotes: "Solved the challenge of interactive shell I/O in single-threaded browser environments by implementing an asynchronous circular ring buffer for stdin and streaming PTY output chunks directly to the xterm-style terminal parser.",
        signal: "Powers the local terminal CLI, Codex code runner, and WebAssembly utility commands.",
        tech: ["WebAssembly", "WASI", "Web Workers", "PTY Emulation", "ANSI Parser"],
        links: [],
        audience: "private",
        position: [50, 50]
    },
    {
        id: "security-kernel",
        title: "SecurityKernel & Quarantine",
        category: "Operating System Architecture",
        type: "Zero-Trust Security Engine",
        status: "Core Subsystem",
        icon: "fa-solid fa-user-shield",
        color: "#10b981",
        summary: "Local zero-trust cryptographic inspection engine verifying all files before import, storage, or cloud backup.",
        overview: "SecurityKernel safeguards user workspaces by inspecting every file that enters or leaves the system. It detects executable injection attacks, active script documents, corrupted structures, and profile privilege violations before they touch SystemFS.",
        architecture: "Acts as a cryptographic gatekeeper between external inputs (drag-and-drop, downloads, cloud sync) and the filesystem. Generates SHA-256 hashes, verifies MIME signatures against magic byte tables, and isolates questionable files in a dedicated zero-trust quarantine zone.",
        capabilities: [
            { icon: "fa-solid fa-fingerprint", title: "SHA-256 Content Hashing", desc: "Guarantees file immutability and generates verified cryptographic digests for cloud sync reconciliation." },
            { icon: "fa-solid fa-ban", title: "Executable Blocking", desc: "Prevents raw `.exe`, `.bat`, `.cmd`, or script files from executing directly within the workspace." },
            { icon: "fa-solid fa-biohazard", title: "Quarantine Isolation", desc: "Holds suspicious or unverified files in token-free quarantine storage until explicitly approved by the user." },
            { icon: "fa-solid fa-id-card", title: "Profile Boundary Enforcement", desc: "Ensures private files cannot be accessed or written by public guest sessions." }
        ],
        engineeringNotes: "Architected so that quarantine metadata contains zero credentials, auth tokens, or private user paths, ensuring that security logs can be audited without leaking user data.",
        signal: "Protects the operating system from malicious file imports and ensures cloud sync only uploads verified assets.",
        tech: ["Web Crypto API", "SHA-256", "MIME Sniffing", "Zero Trust", "Quarantine"],
        links: [],
        audience: "private",
        position: [50, 50]
    },
    {
        id: "native-relay",
        title: "Native Relay Bridge",
        category: "Operating System Architecture",
        type: "Web-to-OS IPC System",
        status: "Core Subsystem",
        icon: "fa-solid fa-network-wired",
        color: "#6366f1",
        summary: "Native messaging host bridge connecting PortfoliOS in the browser to local host OS processes, hardware, and CLI tools.",
        overview: "The Native Relay Bridge enables seamless communication between the browser-based PortfoliOS environment and native host operating system capabilities (e.g. Docker, Git, local compilers, native shell) via secure browser Native Messaging.",
        architecture: "Comprises three synchronized layers:\n1. **In-Page Bridge (`inpage-bridge.js`)**: Web-facing JavaScript SDK exposing high-level IPC methods.\n2. **Browser Extension (`background.js`)**: WebExtension background worker relaying messages via `chrome.runtime.sendNativeMessage`.\n3. **Host Process (`host.mjs`)**: Lightweight Node.js host process reading standard input length-prefixed JSON frames and executing authorized host tasks.",
        capabilities: [
            { icon: "fa-solid fa-terminal", title: "Native Shell Execution", desc: "Runs local host CLI commands and streams stdout/stderr back into the browser terminal." },
            { icon: "fa-solid fa-arrows-split-up-and-left", title: "Multi-Browser Support", desc: "Installer provisions native messaging manifests for Chrome, Edge, Brave, and Firefox." },
            { icon: "fa-solid fa-lock", title: "Origin Authentication", desc: "Strictly enforces origin whitelisting so only the authorized PortfoliOS domain can trigger host IPC." },
            { icon: "fa-solid fa-file-shield", title: "WiX MSI Installer", desc: "Per-user Windows installer configuring native messaging registry keys automatically." }
        ],
        engineeringNotes: "Designed with a robust framing protocol (4-byte native endian length headers) to guarantee packet integrity across Windows and Unix standard streams without dropped messages.",
        signal: "Connects web workspace applications to true local host hardware, native compilers, and host-level terminal tools.",
        tech: ["Native Messaging", "Node.js", "Chrome Extension API", "WiX Toolset", "MSI Installer"],
        links: [],
        audience: "private",
        position: [50, 50]
    },
    {
        id: "cloud-sync",
        title: "CloudSync & Session Gateway",
        category: "Operating System Architecture",
        type: "Distributed Cloud Synchronization",
        status: "Core Subsystem",
        icon: "fa-solid fa-cloud-arrow-up",
        color: "#06b6d4",
        summary: "Multi-cloud synchronization engine backing up user workspaces to personal cloud storage with zero server-side credential persistence.",
        overview: "CloudSync allows private users to maintain a synchronized, persistent virtual computer across any number of devices. Workspaces sync seamlessly to personal Google Drive AppData, OneDrive, or Dropbox folders without PortfoliOS ever storing user credentials on a server.",
        architecture: "Upholds strict memory-only authentication: OAuth 2.0 access tokens exist purely in active JavaScript memory and are wiped on logout. A lightweight server-side lease coordinator (`/core/private-session.php`) uses atomic filesystem locking (`flock`) to ensure only one active session mutates a workspace at a time, facilitating smooth cross-device handoffs.",
        capabilities: [
            { icon: "fa-solid fa-key", title: "Memory-Only Credentials", desc: "Tokens never touch localStorage, cookies, or SystemFS, protecting users against persistent token theft." },
            { icon: "fa-solid fa-arrows-rotate", title: "Live Debounced Sync", desc: "Intelligent 350ms debouncer batches file modifications into atomic upload bursts." },
            { icon: "fa-solid fa-laptop-code", title: "Distributed Device Handoff", desc: "Seamless session negotiation pauses, flushes open apps, and safely transfers workspace ownership to new devices." },
            { icon: "fa-solid fa-rotate-left", title: "Self-Healing Recovery", desc: "Recovers automatically from background timer throttling and temporary network blips without disrupting work." }
        ],
        engineeringNotes: "Implemented resumable 4 MiB chunked uploads with SHA-256 verification, enabling multi-gigabyte file synchronizations over unstable networks without data corruption.",
        signal: "Enables private, portable personal computing in the cloud while respecting complete user data sovereignty.",
        tech: ["Google Drive v3 API", "OAuth 2.0 PKCE", "PHP Session Coordinator", "Atomic flock", "Resumable Uploads"],
        links: [],
        audience: "private",
        position: [50, 50]
    },
    {
        id: "solidcraft-wiki",
        title: "SolidCraft — 3D Parametric CAD",
        category: "Creative & Office Applications",
        type: "Parametric 3D CAD Workstation",
        status: "Production App",
        icon: "apps/solidcraft/icon.svg",
        color: "#f59e0b",
        summary: "In-browser parametric 3D CAD modeling suite with constructive solid geometry (CSG), 3D viewport, and STL/OBJ export.",
        overview: "SolidCraft brings full engineering-grade 3D computer-aided design into the browser. Users can create 2D parametric sketches, extrude, revolve, perform boolean cut/union operations, and export models for 3D printing.",
        architecture: "Uses Three.js and WebGL for real-time 3D viewport rendering with orbit, pan, and zoom controls. The underlying geometry kernel computes constructive solid geometry (CSG) meshes and converts parametric trees into polygonal tessellations.",
        capabilities: [
            { icon: "fa-solid fa-cubes", title: "Boolean CSG Operations", desc: "Fast union, difference, and intersection operations on 3D solid geometries." },
            { icon: "fa-solid fa-pencil", title: "Parametric 2D Sketcher", desc: "Constraint-driven 2D sketch plane supporting lines, arcs, circles, and dimensioning." },
            { icon: "fa-solid fa-file-export", title: "3D Print Export (STL/OBJ)", desc: "Generates watertight binary and ASCII STL files ready for 3D slicing software." },
            { icon: "fa-solid fa-floppy-disk", title: "SystemFS Native Projects", desc: "Saves `.solid` parametric project files directly into user SystemFS storage." }
        ],
        engineeringNotes: "Optimized polygon vertex indexing to maintain 60 FPS viewport manipulation even with complex multi-feature CAD parts containing thousands of faces.",
        signal: "Demonstrates high-performance client-side 3D modeling and computational geometry in WebGL.",
        tech: ["Three.js", "WebGL", "CSG Geometry Kernel", "STL Generator", "SystemFS"],
        links: [],
        launchApp: "solidcraft",
        audience: "private",
        position: [50, 50]
    },
    {
        id: "genoffice-wiki",
        title: "GenOffice Productivity Suite",
        category: "Creative & Office Applications",
        type: "AI-Native Productivity Studio",
        status: "Production App",
        icon: "apps/genoffice/icon.svg",
        color: "#22c55e",
        summary: "Modular document and office productivity suite covering GenDocs, GenSheets, GenSlides, and GenNotes.",
        overview: "GenOffice is a comprehensive, AI-assisted office suite built natively for PortfoliOS. It provides full document creation, spreadsheet calculation with dynamic formula engines, slide deck presentations, and technical markdown notes.",
        architecture: "Constructed with modular sub-engines sharing a unified document model:\n- **GenDocs**: Word processor supporting rich text, typography styling, and OOXML `.docx` import/export.\n- **GenSheets**: High-performance grid calculation engine parsing Excel formulas (SUM, AVERAGE, VLOOKUP, IF) in real-time.\n- **GenSlides**: Canvas presentation builder with custom transitions and presentation mode.\n- **GenNotes**: Dual-pane Markdown editor with live preview, syntax highlighting, and table support.",
        capabilities: [
            { icon: "fa-solid fa-file-word", title: "GenDocs OOXML Support", desc: "Full rich-text editing with header hierarchies, font weights, alignments, and docx export." },
            { icon: "fa-solid fa-table", title: "GenSheets Calculation Engine", desc: "High-speed formula parsing supporting standard arithmetic, statistics, and logical functions." },
            { icon: "fa-solid fa-chalkboard-user", title: "GenSlides Deck Studio", desc: "Slide layout designer with drag-and-drop elements and full-screen presentation mode." },
            { icon: "fa-solid fa-note-sticky", title: "GenNotes Technical Markdown", desc: "Real-time markdown rendering with code block highlighting and LaTeX KaTeX math." }
        ],
        engineeringNotes: "Engineered with virtualized DOM scrolling in GenSheets to support massive 10,000-row spreadsheets without browser reflow lag or memory exhaustion.",
        signal: "Provides desktop-class office productivity tools completely offline without relying on external cloud office subscriptions.",
        tech: ["Vanilla JavaScript", "OOXML Engine", "Formula Evaluator", "Markdown Parser", "KaTeX"],
        links: [],
        launchApp: "genoffice",
        audience: "private",
        position: [50, 50]
    },
    {
        id: "craft-suite",
        title: "The Creative Craft Studio",
        category: "Creative & Office Applications",
        type: "Creative Multimedia Suite",
        status: "Production App",
        icon: "fa-solid fa-palette",
        color: "#ec4899",
        summary: "Professional creative suite: PdfCraft, PhotoCraft (layers), VectorCraft (SVG), LightCraft (RAW photo), FilmCraft, and EffectCraft.",
        overview: "A cohesive collection of creative studio applications designed for raster artwork, vector design, RAW photography development, video timeline sequencing, and PDF document publishing.",
        architecture: "Heavily leverages Web Workers for off-main-thread image processing (convolution kernels, blur matrices, color balancing) and WebGL shaders for real-time visual feedback.",
        capabilities: [
            { icon: "fa-solid fa-file-pdf", title: "PdfCraft", desc: "Inspect, merge, split, annotate, and reorganize multi-page PDF documents." },
            { icon: "fa-solid fa-image", title: "PhotoCraft", desc: "Layered raster graphics editor with blend modes, filters, crop, and selection tools." },
            { icon: "fa-solid fa-bezier-curve", title: "VectorCraft", desc: "Precision SVG vector illustration with bezier paths, strokes, fills, and SVG exports." },
            { icon: "fa-solid fa-camera", title: "LightCraft", desc: "Non-destructive RAW photo development with exposure, highlights, shadows, and curve tuning." },
            { icon: "fa-solid fa-film", title: "FilmCraft & EffectCraft", desc: "Audio-video timeline sequencing and real-time visual shader effect composition." }
        ],
        engineeringNotes: "Designed with memory-bounded pixel buffers and canvas slicing algorithms to ensure heavy 4K and 8K image files do not exceed mobile or low-RAM host limits.",
        signal: "Brings complete creative studio workflows to the web with zero external server dependencies.",
        tech: ["HTML5 Canvas", "WebGL Shaders", "Web Workers", "PDF.js", "SVG DOM", "SystemFS"],
        links: [],
        launchApp: "photocraft",
        audience: "private",
        position: [50, 50]
    },
    {
        id: "terminal-wiki",
        title: "Terminal Subsystem & CLI",
        category: "Developer Tools & Runtime",
        type: "Virtual Terminal & POSIX Shell",
        status: "Production Tool",
        icon: "fa-solid fa-terminal",
        color: "#22d3ee",
        summary: "Windows Terminal-inspired CLI terminal supporting command pipelines, environment variables, SystemFS navigation, and AI assistants.",
        overview: "The PortfoliOS Terminal is a feature-rich virtual shell providing command-line access to the entire operating system. It includes standard Unix utilities (`ls`, `cat`, `grep`, `mkdir`, `rm`, `pwd`, `su`), process management (`jobs`, `kill`), and AI integration.",
        architecture: "Implements an AST command parser supporting pipe operators (`|`), output redirection (`>`, `>>`), environment variable expansion (`$VAR`), command history navigation (Up/Down arrows), and tab completion.",
        capabilities: [
            { icon: "fa-solid fa-terminal", title: "Full POSIX Utilities", desc: "Built-in implementations of `ls`, `cat`, `grep`, `find`, `head`, `tail`, `wc`, `sort`, `uniq`." },
            { icon: "fa-solid fa-user-gear", title: "Multi-User & su Switching", desc: "Switch user contexts with `su`, manage user permissions, and enforce profile storage barriers." },
            { icon: "fa-solid fa-robot", title: "AI Assistant Commands", desc: "Interactive command-line coding and assistance through `ai on`, `ai status`, and `agy` agent." },
            { icon: "fa-solid fa-network-wired", title: "Native Relay CLI", desc: "Execute commands on the host machine directly from the terminal via Native Relay integration." }
        ],
        engineeringNotes: "Engineered with virtual ANSI escape handling for authentic 256-color output, cursor movement, and clear-screen sequences without external terminal libraries.",
        signal: "The command-line nerve center of PortfoliOS, linking files, processes, AI models, and native host capabilities.",
        tech: ["AST Parser", "ANSI Emulator", "Virtual Processes", "SystemFS", "Native Relay"],
        links: [],
        launchApp: "cli",
        audience: "private",
        position: [50, 50]
    },
    {
        id: "codex-wiki",
        title: "Codex & Code OSS Workspace",
        category: "Developer Tools & Runtime",
        type: "Developer IDE & Code Editor",
        status: "Production App",
        icon: "apps/vscode/icon.png",
        color: "#3b82f6",
        summary: "In-browser code editor and IDE workspace with syntax highlighting, SystemFS file mounting, and live execution preview.",
        overview: "Provides a full code editing environment inside PortfoliOS. Allows developers to write, inspect, and test JavaScript, HTML, CSS, Lua, and Python code directly on their virtual filesystem with live previews.",
        architecture: "Mounts the user's SystemFS project folders into the editor workspace. Integrates Monaco Editor / Ace Editor for syntax highlighting, multi-cursor editing, bracket matching, and code folding.",
        capabilities: [
            { icon: "fa-solid fa-code", title: "Multi-Language Syntax", desc: "Full syntax highlighting and indentation rules for over 20 programming and markup languages." },
            { icon: "fa-solid fa-play", title: "Live Preview Sandbox", desc: "Instant iframe preview of web code with isolated console logging and error capture." },
            { icon: "fa-solid fa-folder-tree", title: "SystemFS Project Explorer", desc: "Create, rename, drag-and-drop, and organize project files directly on the virtual disk." }
        ],
        engineeringNotes: "Implements debounced auto-saving to SystemFS with transactional safety, ensuring code is never lost during accidental window closures.",
        signal: "Enables real coding and software development directly inside the virtual operating system.",
        tech: ["Monaco Editor", "SystemFS", "Sandbox Iframe", "Syntax Highlighting"],
        links: [],
        launchApp: "vscode",
        audience: "private",
        position: [50, 50]
    },
    {
        id: "local-ai-wiki",
        title: "Local AI & WebLLM Engine",
        category: "Developer Tools & Runtime",
        type: "Client-Side In-Browser AI Engine",
        status: "Production Subsystem",
        icon: "fa-solid fa-robot",
        color: "#8b5cf6",
        summary: "Local AI inference engine running quantized models directly in the browser via WebGPU with fallback to cloud models.",
        overview: "Local AI provides intelligent conversational assistance, code generation, and system command suggestions without sending private user data to third-party cloud servers when using WebGPU models.",
        architecture: "Leverages WebGPU and WebLLM / Transformers.js to execute quantized neural networks (e.g. SmolLM, Llama 3.2 1B, Qwen) directly on the client's graphics hardware. Gracefully falls back to cloud providers (OpenAI, Gemini, Claude) when API keys are configured.",
        capabilities: [
            { icon: "fa-solid fa-microchip", title: "WebGPU Local Inference", desc: "Runs models entirely on client hardware with 100% data privacy and zero API costs." },
            { icon: "fa-solid fa-cloud", title: "Pluggable Cloud Providers", desc: "Seamless switching to Gemini, OpenAI, or Claude for complex coding tasks." },
            { icon: "fa-solid fa-bolt", title: "Streaming Token Pipeline", desc: "Real-time token streaming with Markdown formatting and code block syntax highlighting." }
        ],
        engineeringNotes: "Engineered shader cache warmup and memory-chunking pipelines so model weights download and mount into WebGPU VRAM with minimal initial delay.",
        signal: "Demonstrates true client-side artificial intelligence execution in modern browser runtimes.",
        tech: ["WebGPU", "WebLLM", "Transformers.js", "Streaming SSE", "Gemini API"],
        links: [],
        launchApp: "local-ai",
        audience: "private",
        position: [50, 50]
    },
    {
        id: "emulation-core",
        title: "Gaming & Emulation Core",
        category: "Gaming & Emulation Runtime",
        type: "WASM Emulation Subsystem",
        status: "Production Subsystem",
        icon: "fa-solid fa-gamepad",
        color: "#f59e0b",
        summary: "Multi-system retro emulation and source port architecture executing retro games client-side via WebAssembly.",
        overview: "The Emulation Core powers retro gaming inside PortfoliOS. Through RomPlayer and custom source ports, users can play classic titles from NES, SNES, Game Boy, Game Boy Advance, Sega Genesis, and DOS directly in browser windows.",
        architecture: "Employs libretro cores and Emscripten WebAssembly targets. Audio is routed through Web Audio AudioContext buffers with dynamic resamplers, while video frames are rendered to WebGL canvases with custom CRT and scanline shaders.",
        capabilities: [
            { icon: "fa-solid fa-gamepad", title: "Multi-Platform Emulation", desc: "Support for 8-bit, 16-bit, and 32-bit consoles via libretro WASM cores." },
            { icon: "fa-solid fa-sliders", title: "Gamepad & Touch Controls", desc: "Native Gamepad API integration supporting Xbox, PlayStation, and on-screen touch virtual controllers." },
            { icon: "fa-solid fa-floppy-disk", title: "Save States & SRAM", desc: "Game saves and state dumps are committed directly to `/ROMs/saves/` in SystemFS." }
        ],
        engineeringNotes: "Solved audio crackle and drift issues by implementing an adaptive circular audio ring buffer with dynamic sample-rate interpolation matching the client display's refresh rate.",
        signal: "Brings decades of classic gaming history to modern web browsers with zero installation.",
        tech: ["WebAssembly", "Libretro", "Emscripten", "Gamepad API", "WebGL Shaders", "Web Audio"],
        links: [],
        launchApp: "romplayer",
        audience: "private",
        position: [50, 50]
    },
    {
        id: "creator-dossier",
        title: "Alex \"Bl4ut0\" Mammen — Creator Dossier",
        category: "Creator & Systems Architect",
        type: "Architect & Systems Engineer Dossier",
        status: "Online",
        icon: "identity-portrait.jpg",
        color: "#22d3ee",
        summary: "Centralized dossier on Alex \"Bl4ut0\" Mammen: systems architect, founder of WardenIT, and creator of PortfoliOS.",
        overview: "Alex \"Bl4ut0\" Mammen is an experienced systems engineer, infrastructure architect, and full-stack software builder. Alex specializes in Linux virtualization, enterprise networking, edge computing, automation pipelines, and pushing modern browser runtimes to their absolute limits.",
        architecture: "Alex's engineering philosophy centers on **Data Sovereignty**, **Zero-Trust Security**, and **Client-Side Empowerment**. Rather than building brittle web apps reliant on expensive recurring cloud infrastructure, Alex designs resilient systems that run locally, leverage edge automation, and give users full ownership of their data.",
        capabilities: [
            { icon: "fa-solid fa-briefcase", title: "Founder & Lead Engineer at WardenIT", desc: "Delivering enterprise infrastructure, cybersecurity, managed networking, and automation at wardenit.com." },
            { icon: "fa-solid fa-desktop", title: "Creator & Architect of PortfoliOS", desc: "Architected the complete virtual web operating system, WASM container engine, and SystemFS." },
            { icon: "fa-solid fa-code-branch", title: "Open-Source Toolmaker", desc: "Active maintainer of World of Warcraft addons, Discord platforms (GuildCraft), and automation proxies." },
            { icon: "fa-solid fa-server", title: "Homelab & Network Operator", desc: "Operating enterprise multi-node Proxmox clusters, segmented VLANs, and private PKI infrastructure." }
        ],
        engineeringNotes: "This dossier serves as the single centralized hub for all professional and creator information within private workspaces. While the rest of this wiki provides technical documentation on the operating system and apps, this node provides direct contact points, career achievements, and project links.",
        signal: "The centralized professional and creator index for Alex \"Bl4ut0\" Mammen.",
        tech: ["Systems Engineering", "Infrastructure Architecture", "Linux", "WebAssembly", "TypeScript", "Proxmox VE", "Networking", "Zero Trust"],
        links: [
            ["WardenIT Website", "https://wardenit.com/", "fa-solid fa-briefcase"],
            ["Developer Portal", "https://bl4ut0.dev", "fa-solid fa-globe"],
            ["GitHub Profile", "https://github.com/Bl4ut0", "fa-brands fa-github"],
            ["CurseForge", "https://www.curseforge.com/members/bl4ut0/projects", "fa-solid fa-download"],
            ["Discord Community", "https://discord.gg/fEwanmFR9m", "fa-brands fa-discord"]
        ],
        audience: "private",
        position: [50, 50]
    }
];