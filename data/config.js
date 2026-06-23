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
