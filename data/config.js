/**
 * PortfoliOS: Configuration Data
 * Definitions for wallpaper themes, CLI options, command mappings, and Quick review routes.
 */

window.wallpaperOptions = [
    { id: "aurora", label: "Aurora", icon: "fa-solid fa-wand-magic-sparkles" },
    { id: "grid", label: "Grid", icon: "fa-solid fa-border-all" },
    { id: "ember", label: "Ember", icon: "fa-solid fa-fire" },
    { id: "mono", label: "Mono", icon: "fa-solid fa-moon" },
    { id: "cosmos", label: "Cosmos", icon: "fa-solid fa-user-astronaut" },
    { id: "sunset", label: "Sunset", icon: "fa-solid fa-mountain-sun" },
    { id: "matrix", label: "Matrix", icon: "fa-solid fa-code" },
    { id: "cyberpunk", label: "Cyberpunk", icon: "fa-solid fa-bolt" },
    { id: "forest", label: "Forest", icon: "fa-solid fa-tree" },
    { id: "ocean", label: "Ocean", icon: "fa-solid fa-water" },
    { id: "sakura", label: "Sakura", icon: "fa-solid fa-spa" },
    { id: "glacier", label: "Glacier", icon: "fa-solid fa-snowflake" },
    { id: "solar", label: "Solar", icon: "fa-solid fa-sun" },
    { id: "retrowave", label: "Retrowave", icon: "fa-solid fa-guitar" }
];

window.screensaverOptions = [
    { id: "none", label: "None", icon: "fa-solid fa-ban", description: "Keep the desktop visible." },
    { id: "blank", label: "Blank Screen", icon: "fa-regular fa-square", description: "Fade to a quiet black display." },
    { id: "starfield", label: "3D Starfield", icon: "fa-solid fa-star", description: "Windows 95-style stars rushing from a center vanishing point." },
    { id: "mystify", label: "Mystify", icon: "fa-solid fa-draw-polygon", description: "Neon line trails inspired by classic Windows Mystify." },
    { id: "flying-windows", label: "Flying Windows", icon: "fa-brands fa-windows", description: "XP-style window logos drifting through the dark." },
    { id: "dvd-bounce", label: "DVD Bounce", icon: "fa-solid fa-compact-disc", description: "A PortfoliOS logo bouncing around like the classic DVD idle screen." },
    { id: "pipes", label: "3D Pipes", icon: "fa-solid fa-cubes-stacked", description: "A glossy pipe network nodding to the Windows 95 classic." },
    { id: "maze", label: "3D Maze", icon: "fa-solid fa-route", description: "A retro first-person brick maze flythrough." },
    { id: "marquee", label: "3D Text", icon: "fa-solid fa-font", description: "A chunky glowing PortfoliOS text saver." }
];

window.portfolioThemes = [
    {
        id: "dark",
        label: "Dark",
        icon: "fa-solid fa-moon",
        description: "Current PortfoliOS glass desktop.",
        colorScheme: "dark",
        swatches: ["#050608", "#22d3ee", "#34d399"],
        tokens: {
            "--bg": "#050608",
            "--panel": "rgba(9, 11, 16, 0.62)",
            "--panel-strong": "rgba(14, 18, 26, 0.85)",
            "--panel-soft": "rgba(255, 255, 255, 0.04)",
            "--line": "rgba(255, 255, 255, 0.07)",
            "--line-strong": "rgba(255, 255, 255, 0.14)",
            "--text": "#fafafa",
            "--text-soft": "#a1a1aa",
            "--text-muted": "#71717a",
            "--theme-primary": "#22d3ee",
            "--theme-accent": "#34d399",
            "--amber": "#f59e0b",
            "--blue": "#3b82f6",
            "--violet": "#a78bfa",
            "--rose": "#f43f5e",
            "--teal": "#14b8a6",
            "--glass-bg": "rgba(10, 12, 18, 0.62)",
            "--glass-border": "rgba(255, 255, 255, 0.07)",
            "--glass-highlight": "inset 0 1px 0 0 rgba(255, 255, 255, 0.12)",
            "--glass-shadow": "0 25px 50px -12px rgba(0, 0, 0, 0.75)"
        }
    },
    {
        id: "light",
        label: "Light",
        icon: "fa-solid fa-sun",
        description: "Readable bright desktop with cool accents.",
        colorScheme: "light",
        swatches: ["#f8fafc", "#0284c7", "#059669"],
        tokens: {
            "--bg": "#f8fafc",
            "--panel": "rgba(255, 255, 255, 0.76)",
            "--panel-strong": "rgba(255, 255, 255, 0.94)",
            "--panel-soft": "rgba(15, 23, 42, 0.055)",
            "--line": "rgba(15, 23, 42, 0.12)",
            "--line-strong": "rgba(15, 23, 42, 0.22)",
            "--text": "#0f172a",
            "--text-soft": "#475569",
            "--text-muted": "#64748b",
            "--theme-primary": "#0284c7",
            "--theme-accent": "#059669",
            "--amber": "#b45309",
            "--blue": "#2563eb",
            "--violet": "#7c3aed",
            "--rose": "#e11d48",
            "--teal": "#0f766e",
            "--glass-bg": "rgba(255, 255, 255, 0.72)",
            "--glass-border": "rgba(15, 23, 42, 0.12)",
            "--glass-highlight": "inset 0 1px 0 0 rgba(255, 255, 255, 0.82)",
            "--glass-shadow": "0 22px 45px -18px rgba(15, 23, 42, 0.35)"
        }
    },
    {
        id: "oled",
        label: "OLED",
        icon: "fa-regular fa-circle",
        description: "True black shell with high contrast glow.",
        colorScheme: "dark",
        swatches: ["#000000", "#00e5ff", "#ffffff"],
        tokens: {
            "--bg": "#000000",
            "--panel": "rgba(0, 0, 0, 0.78)",
            "--panel-strong": "rgba(0, 0, 0, 0.94)",
            "--panel-soft": "rgba(255, 255, 255, 0.035)",
            "--line": "rgba(255, 255, 255, 0.09)",
            "--line-strong": "rgba(255, 255, 255, 0.2)",
            "--text": "#ffffff",
            "--text-soft": "#d4d4d8",
            "--text-muted": "#8a8a93",
            "--theme-primary": "#00e5ff",
            "--theme-accent": "#f8fafc",
            "--amber": "#fbbf24",
            "--blue": "#38bdf8",
            "--violet": "#c084fc",
            "--rose": "#fb7185",
            "--teal": "#2dd4bf",
            "--glass-bg": "rgba(0, 0, 0, 0.78)",
            "--glass-border": "rgba(255, 255, 255, 0.1)",
            "--glass-highlight": "inset 0 1px 0 0 rgba(255, 255, 255, 0.09)",
            "--glass-shadow": "0 28px 60px -18px rgba(0, 0, 0, 0.95)"
        }
    },
    {
        id: "black-accent",
        label: "Black Accent",
        icon: "fa-solid fa-circle-half-stroke",
        description: "Light neutral UI with black action accents.",
        colorScheme: "light",
        swatches: ["#f5f5f4", "#111111", "#3f3f46"],
        tokens: {
            "--bg": "#f5f5f4",
            "--panel": "rgba(255, 255, 255, 0.82)",
            "--panel-strong": "rgba(255, 255, 255, 0.96)",
            "--panel-soft": "rgba(24, 24, 27, 0.06)",
            "--line": "rgba(24, 24, 27, 0.13)",
            "--line-strong": "rgba(24, 24, 27, 0.24)",
            "--text": "#111111",
            "--text-soft": "#3f3f46",
            "--text-muted": "#71717a",
            "--theme-primary": "#111111",
            "--theme-accent": "#3f3f46",
            "--amber": "#a16207",
            "--blue": "#1d4ed8",
            "--violet": "#6d28d9",
            "--rose": "#be123c",
            "--teal": "#0f766e",
            "--glass-bg": "rgba(255, 255, 255, 0.78)",
            "--glass-border": "rgba(24, 24, 27, 0.14)",
            "--glass-highlight": "inset 0 1px 0 0 rgba(255, 255, 255, 0.72)",
            "--glass-shadow": "0 22px 45px -18px rgba(24, 24, 27, 0.34)"
        }
    },
    {
        id: "terminal",
        label: "Terminal",
        icon: "fa-solid fa-terminal",
        description: "Green phosphor operator mode.",
        colorScheme: "dark",
        swatches: ["#020402", "#22c55e", "#84cc16"],
        tokens: {
            "--bg": "#020402",
            "--panel": "rgba(2, 8, 4, 0.72)",
            "--panel-strong": "rgba(4, 18, 8, 0.9)",
            "--panel-soft": "rgba(34, 197, 94, 0.055)",
            "--line": "rgba(134, 239, 172, 0.1)",
            "--line-strong": "rgba(134, 239, 172, 0.22)",
            "--text": "#ecfdf5",
            "--text-soft": "#bbf7d0",
            "--text-muted": "#6ee7b7",
            "--theme-primary": "#22c55e",
            "--theme-accent": "#84cc16",
            "--amber": "#facc15",
            "--blue": "#38bdf8",
            "--violet": "#a78bfa",
            "--rose": "#fb7185",
            "--teal": "#2dd4bf",
            "--glass-bg": "rgba(2, 8, 4, 0.74)",
            "--glass-border": "rgba(134, 239, 172, 0.12)",
            "--glass-highlight": "inset 0 1px 0 0 rgba(134, 239, 172, 0.12)",
            "--glass-shadow": "0 25px 50px -14px rgba(0, 0, 0, 0.9)"
        }
    },
    {
        id: "glacier",
        label: "Glacier",
        icon: "fa-solid fa-snowflake",
        description: "Cool pale panels with blue-violet accents.",
        colorScheme: "light",
        swatches: ["#eef7ff", "#2563eb", "#7c3aed"],
        tokens: {
            "--bg": "#eef7ff",
            "--panel": "rgba(255, 255, 255, 0.72)",
            "--panel-strong": "rgba(248, 250, 252, 0.94)",
            "--panel-soft": "rgba(37, 99, 235, 0.06)",
            "--line": "rgba(30, 64, 175, 0.13)",
            "--line-strong": "rgba(30, 64, 175, 0.24)",
            "--text": "#0f172a",
            "--text-soft": "#334155",
            "--text-muted": "#64748b",
            "--theme-primary": "#2563eb",
            "--theme-accent": "#7c3aed",
            "--amber": "#d97706",
            "--blue": "#0284c7",
            "--violet": "#7c3aed",
            "--rose": "#db2777",
            "--teal": "#0891b2",
            "--glass-bg": "rgba(255, 255, 255, 0.68)",
            "--glass-border": "rgba(30, 64, 175, 0.13)",
            "--glass-highlight": "inset 0 1px 0 0 rgba(255, 255, 255, 0.78)",
            "--glass-shadow": "0 24px 48px -18px rgba(30, 64, 175, 0.3)"
        }
    },
    {
        id: "sunset",
        label: "Sunset",
        icon: "fa-solid fa-mountain-sun",
        description: "Warm dusk palette with rose and amber.",
        colorScheme: "dark",
        swatches: ["#160b18", "#fb7185", "#f59e0b"],
        tokens: {
            "--bg": "#160b18",
            "--panel": "rgba(30, 15, 32, 0.7)",
            "--panel-strong": "rgba(45, 20, 45, 0.9)",
            "--panel-soft": "rgba(251, 113, 133, 0.06)",
            "--line": "rgba(254, 205, 211, 0.1)",
            "--line-strong": "rgba(254, 205, 211, 0.2)",
            "--text": "#fff7ed",
            "--text-soft": "#fed7aa",
            "--text-muted": "#f9a8d4",
            "--theme-primary": "#fb7185",
            "--theme-accent": "#f59e0b",
            "--amber": "#fbbf24",
            "--blue": "#60a5fa",
            "--violet": "#c084fc",
            "--rose": "#fb7185",
            "--teal": "#2dd4bf",
            "--glass-bg": "rgba(30, 15, 32, 0.7)",
            "--glass-border": "rgba(254, 205, 211, 0.1)",
            "--glass-highlight": "inset 0 1px 0 0 rgba(254, 205, 211, 0.12)",
            "--glass-shadow": "0 25px 55px -16px rgba(0, 0, 0, 0.72)"
        }
    }
];

window.quickRoutes = [
    { id: "overview", label: "Overview", icon: "fa-solid fa-table-cells-large", get ids() { return window.systems ? window.systems.map((item) => item.id) : []; } },
    { id: "build", label: "Build", icon: "fa-solid fa-code-branch", ids: ["devhub", "addons", "guildcraft", "automation", "media", "doomsource", "duke32", "diablo", "quake"] },
    { id: "operate", label: "Operate", icon: "fa-solid fa-server", ids: ["homelab", "status", "automation", "devhub"] },
    { id: "research", label: "Research", icon: "fa-solid fa-brain", ids: ["survival-ai", "doomsource", "duke32", "diablo", "quake", "homelab"] },
    { id: "connect", label: "Connect", icon: "fa-solid fa-link", ids: ["devhub", "guildcraft", "wardenit", "status", "addons"] }
];

window.quickFilters = [
    { id: "all", label: "All" },
    { id: "live", label: "Live" },
    { id: "planned", label: "Planned" }
];

window.cliCommands = {
    help: [
        "Commands:",
        "  whoami          profile summary",
        "  projects        list portfolio nodes",
        "  inspect <id>    print a dossier, example: inspect homelab",
        "  quick           open direct review mode",
        "  play / doom     open Doom engine loader",
        "  linux           open lab@bl4ut0",
        "  workstation     focus desktop workspace",
        "  links           public links",
        "  status          service/status surface",
        "  open <target>   open devhub, github, discord, guildcraft, curseforge",
        "  clear           clear terminal"
    ].join("\n"),
    whoami: "Alex \"Bl4ut0\" Mammen - systems builder, addon porter, automation tinkerer, homelab operator, and community toolmaker.",
    links: [
        "GitHub: https://github.com/Bl4ut0",
        "Dev Hub: https://bl4ut0.dev",
        "Discord: https://discord.gg/fEwanmFR9m",
        "GuildCraft Dev: https://dev.guildcraft.io",
        "CurseForge: https://www.curseforge.com/members/bl4ut0/projects"
    ].join("\n")
};

window.cliIntroLines = [
    ["POST OK / loading bl4ut0.cli", "muted"],
    ["mount /experience/desktop /experience/mobile /experience/quick /apps/cli", "muted"],
    ["PortfoliOS shell ready.", ""],
    [window.cliCommands.help, "muted"]
];

window.openTargets = {
    devhub: "https://bl4ut0.dev",
    github: "https://github.com/Bl4ut0",
    discord: "https://discord.gg/fEwanmFR9m",
    guildcraft: "https://dev.guildcraft.io",
    curseforge: "https://www.curseforge.com/members/bl4ut0/projects",
    doomsource: "https://github.com/id-Software/DOOM"
};
