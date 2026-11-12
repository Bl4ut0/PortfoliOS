/**
 * PortfoliOS: Core System Terminal & Interchange Exchange Handler
 * The unified Linux-emulated operating system terminal for PortfoliOS.
 * - Full access to the entire SystemFS hierarchy (`/`, `/bin`, `/usr/local/bin`, `/etc`, `/home`, `/documents`, `/apps`)
 *   and OS `localStorage` / system state, except protected security variables (tokens, secrets, quarantine).
 * - Includes `PortfoliOSInterchange`: the middleman exchange handler that fetches remote scripts/packages
 *   via `wget`, `curl`, `apt`, and `npm`, saves real installer scripts to `SystemFS`, executes `./install.sh` /
 *   `sh` / `bash` line-by-line, links executable binaries into `/usr/local/bin`, and installs/launches
 *   both CLI programs and native PortfoliOS applications directly from the Linux terminal.
 */

// CLI state variables
let currentUser = "guest";
let currentDir = "/home/guest";
let userDirMap = {};
let activePrompt = null;
let activeCliSession = null;
const cliAuthSessions = new Map();
let activeAuthMeta = null;
const history = [];
let historyIndex = -1;
let currentInputVal = "";
let terminalJobId = 0;
const terminalJobs = new Map();
const terminalLineBuffer = [];
const MAX_TERMINAL_BUFFER = 300;
const bootTimestamp = Date.now();
const shellAliases = {
    ll: "ls -la",
    la: "ls -a",
    python: "python3"
};

const BUILTIN_SHELL_COMMANDS = new Set([
    "clear", "help", "whoami", "whois", "profile", "links", "projects", "status",
    "quick", "play", "doom", "doomsource", "openrct2", "rct", "rct2", "linux",
    "workstation", "inspect", "open", "admin", "sudo", "su", "passwd", "useradd", "adduser",
    "userdel", "groups", "id", "pwd", "cd", "ls", "cat", "head", "tail", "wc", "sort", "uniq",
    "find", "tree", "stat", "file", "touch", "chmod", "chown", "mkdir", "rmdir", "rm",
    "cp", "mv", "grep", "echo", "jobs", "kill", "ai", "assistant", "lobe",
    "wget", "curl", "sh", "bash", "apt", "apt-get", "dpkg", "pkg", "npm", "node", "python3", "python", "git", "tar",
    "which", "whereis", "type", "uname", "hostname", "uptime", "date", "df", "du", "free", "lscpu",
    "ps", "top", "htop", "mount", "dmesg", "neofetch", "fastfetch", "ping", "ip", "ifconfig",
    "env", "printenv", "export", "alias", "unalias", "history", "man",
    "storage", "localstorage", "sys", "sysctl", "interchange-exchange"
]);

const OS_APP_ALIASES = {
    code: "vscode",
    vscode: "vscode",
    portal: "browser",
    browser: "browser",
    files: "files",
    store: "store",
    settings: "settings",
    codex: "codex",
    solidcraft: "solidcraft",
    genoffice: "genoffice",
    gendocs: "genoffice-docs",
    "genoffice-docs": "genoffice-docs",
    gensheets: "genoffice-sheets",
    "genoffice-sheets": "genoffice-sheets",
    genslides: "genoffice-slides",
    "genoffice-slides": "genoffice-slides",
    gennotes: "genoffice-notes",
    "genoffice-notes": "genoffice-notes",
    pdfcraft: "pdfcraft",
    photocraft: "photocraft",
    vectorcraft: "vectorcraft",
    lightcraft: "lightcraft",
    designcraft: "designcraft",
    filmcraft: "filmcraft",
    effectcraft: "effectcraft",
    plex: "plex",
    romplayer: "romplayer",
    doom: "doomsource",
    doomsource: "doomsource",
    openrct2: "openrct2",
    rct2: "openrct2",
    duke32: "duke32",
    diablo: "diablo",
    quake: "quake",
    ut99: "ut99",
    webamp: "webamp",
    iptv: "iptv",
    taskmgr: "taskmgr",
    about: "about",
    office: "office",
    "security-center": "security-center",
    "local-ai": "local-ai",
    musicmini: "musicmini"
};

const shellEnv = {
    PATH: "/usr/local/bin:/usr/bin:/bin",
    SHELL: "/bin/bash",
    TERM: "xterm-256color",
    INTERCHANGE_MODE: "active"
};

// Protected Security Boundary: only these sensitive token/secret/quarantine keys are off-limits.
const PROTECTED_STORAGE_PATTERNS = [
    /^bl4ut0_admin/i,
    /admin.*token/i,
    /oauth.*token/i,
    /access_?token/i,
    /refresh_?token/i,
    /client_?secret/i,
    /password_?hash/i,
    /passphrase/i,
    /gdrive.*token/i,
    /^__portfolios_secret/i
];

function isProtectedStorageKey(key) {
    const k = String(key || "").trim();
    if (!k) return false;
    return PROTECTED_STORAGE_PATTERNS.some((pattern) => pattern.test(k));
}

function isProtectedSystemPath(pathStr) {
    const clean = window.SystemFS?.normalizePath?.(pathStr) || String(pathStr || "");
    if (clean === "/.quarantine" || clean.startsWith("/.quarantine/")) return true;
    const parts = clean.split("/").filter(Boolean);
    if (parts.includes(".auth")) return true;
    return false;
}

// Upstream CLI Exchange Catalog used by the Interchange Handler when translating remote installers/packages
const INTERCHANGE_PACKAGE_CATALOG = [
    {
        bin: "agy",
        pkg: "@google/antigravity-cli",
        aliases: ["@google/antigravity-cli", "@google/antigravity", "antigravity-cli", "antigravity", "agy"],
        urlPattern: /antigravity\.google/i,
        defaultScriptName: "install.sh",
        name: "Antigravity CLI",
        version: "1.5.5",
        provider: "Google AI Pro",
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        docsUrl: "https://antigravity.google/docs/home",
        defaultModel: "gemini-3.8-flash-high"
    },
    {
        bin: "codex",
        pkg: "@openai/codex",
        aliases: ["@openai/codex", "@openai/codex@latest", "codex-cli", "codex"],
        urlPattern: /chatgpt\.com\/codex|openai\.com\/codex/i,
        defaultScriptName: "install.sh",
        name: "OpenAI Codex CLI",
        version: "0.167.0",
        provider: "ChatGPT Subscription",
        authUrl: "https://chatgpt.com/auth",
        docsUrl: "https://learn.chatgpt.com/docs/codex/cli",
        defaultModel: "o3"
    },
    {
        bin: "claude",
        pkg: "@anthropic-ai/claude-code",
        aliases: ["@anthropic-ai/claude-code", "claude-code", "claude"],
        urlPattern: /claude\.ai\/install\.sh|code\.claude\.com/i,
        defaultScriptName: "install.sh",
        name: "Claude Code",
        version: "2.1.318",
        provider: "Claude.ai Subscription",
        authUrl: "https://claude.ai/oauth/authorize",
        docsUrl: "https://code.claude.com/docs/en/quickstart",
        defaultModel: "claude-sonnet-4-6"
    },
    {
        bin: "gemini",
        pkg: "@google/gemini-cli",
        aliases: ["@google/gemini-cli", "gemini-cli", "gemini"],
        urlPattern: /gemini\.google\.com\/cli|ai\.google\.dev\/gemini-cli/i,
        defaultScriptName: "install.sh",
        name: "Google Gemini CLI",
        version: "0.34.0",
        provider: "Google AI Pro",
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        docsUrl: "https://ai.google.dev/gemini-api/docs",
        defaultModel: "gemini-3.8-flash-high"
    },
    {
        bin: "xai",
        pkg: "@xai/build",
        aliases: ["@xai/build", "xai-build", "xai"],
        urlPattern: /x\.ai\/build/i,
        defaultScriptName: "install.sh",
        name: "xAI Build CLI",
        version: "1.2.0",
        provider: "xAI Console",
        authUrl: "https://x.ai/build",
        docsUrl: "https://x.ai/build",
        defaultModel: "grok-3-coder"
    }
];

const latestCliVersionCache = new Map();

async function resolveLatestUpstreamCliVersion(pkgMeta) {
    if (!pkgMeta || !pkgMeta.bin) return "1.0.0";
    const bin = pkgMeta.bin;
    const fallbackVer = pkgMeta.version || "1.0.0";

    if (latestCliVersionCache.has(bin)) {
        return latestCliVersionCache.get(bin);
    }

    try {
        if (typeof localStorage !== "undefined") {
            const rawCache = localStorage.getItem("bl4ut0_cli_latest_versions");
            if (rawCache) {
                const parsed = JSON.parse(rawCache);
                const entry = parsed?.[bin];
                if (entry && entry.version && entry.checkedAt && Date.now() - entry.checkedAt < 3600000) {
                    latestCliVersionCache.set(bin, entry.version);
                    pkgMeta.version = entry.version;
                    return entry.version;
                }
            }
        }
    } catch (_) {}

    if (typeof fetch === "function" && pkgMeta.pkg && pkgMeta.pkg.startsWith("@")) {
        try {
            const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), 2200) : null;
            const res = await fetch(`https://registry.npmjs.org/${pkgMeta.pkg}/latest`, {
                signal: controller ? controller.signal : undefined,
                headers: { Accept: "application/json" }
            });
            if (timer) clearTimeout(timer);
            if (res && res.ok) {
                const data = await res.json();
                if (data && typeof data.version === "string" && /^\d+\.\d+\.\d+/.test(data.version)) {
                    latestCliVersionCache.set(bin, data.version);
                    pkgMeta.version = data.version;
                    try {
                        if (typeof localStorage !== "undefined") {
                            const rawCache = localStorage.getItem("bl4ut0_cli_latest_versions");
                            const map = rawCache ? JSON.parse(rawCache) : {};
                            map[bin] = { version: data.version, checkedAt: Date.now() };
                            localStorage.setItem("bl4ut0_cli_latest_versions", JSON.stringify(map));
                        }
                    } catch (_) {}
                    return data.version;
                }
            }
        } catch (_) {}
    }

    latestCliVersionCache.set(bin, fallbackVer);
    return fallbackVer;
}

function buildPosixInstallerScript(pkgMeta, sourceUrl) {
    return [
        "#!/usr/bin/env bash",
        `# Official Installer Script — ${pkgMeta.name} (${pkgMeta.pkg}@${pkgMeta.version})`,
        `# Upstream Source: ${sourceUrl || pkgMeta.docsUrl || pkgMeta.authUrl}`,
        "# Processed by PortfoliOS Interchange Exchange Handler",
        "set -e",
        `echo "==> [Interchange] Preparing ${pkgMeta.name} v${pkgMeta.version} (${pkgMeta.pkg})..."`,
        "mkdir -p /usr/local/bin",
        `echo "==> [Interchange] Downloading & exchanging platform binary for x86_64-portfolios-wasm..."`,
        `interchange-exchange --install-bin "${pkgMeta.bin}" --pkg "${pkgMeta.pkg}" --version "${pkgMeta.version}" --name "${pkgMeta.name}" --provider "${pkgMeta.provider}" --auth-url "${pkgMeta.authUrl}" --docs-url "${pkgMeta.docsUrl}" --model "${pkgMeta.defaultModel}"`,
        `chmod +x /usr/local/bin/${pkgMeta.bin}`,
        `echo "✓ Installed ${pkgMeta.name} to /usr/local/bin/${pkgMeta.bin}"`,
        `echo "  Run '${pkgMeta.bin}' to launch ${pkgMeta.name}."`
    ].join("\n") + "\n";
}

/**
 * PortfoliOSInterchange: System-wide Middleman Exchange Handler
 * Bridges network fetches (`wget`/`curl`/`npm`/`apt`), binary translation, `SystemFS`, and `localStorage`
 * (excluding protected security variables).
 */
window.PortfoliOSInterchange = {
    isProtectedStorageKey,
    isProtectedSystemPath,

    storage: {
        list() {
            if (typeof localStorage === "undefined" || typeof localStorage.length !== "number") return [];
            const entries = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                if (isProtectedStorageKey(key)) {
                    entries.push({ key, value: "[PROTECTED SECURITY VARIABLE]", protected: true });
                } else {
                    entries.push({ key, value: localStorage.getItem(key), protected: false });
                }
            }
            return entries.sort((a, b) => a.key.localeCompare(b.key));
        },
        get(key) {
            if (isProtectedStorageKey(key)) {
                throw new Error(`Access denied: '${key}' is a protected security variable.`);
            }
            return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
        },
        set(key, value) {
            if (isProtectedStorageKey(key)) {
                throw new Error(`Access denied: cannot overwrite protected security variable '${key}'.`);
            }
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(key, String(value));
            }
            return true;
        },
        remove(key) {
            if (isProtectedStorageKey(key)) {
                throw new Error(`Access denied: cannot delete protected security variable '${key}'.`);
            }
            if (typeof localStorage !== "undefined") {
                localStorage.removeItem(key);
            }
            return true;
        }
    },

    resolvePackageByUrl(url) {
        const target = String(url || "").trim();
        return INTERCHANGE_PACKAGE_CATALOG.find((pkg) => pkg.urlPattern.test(target)) || null;
    },

    resolvePackageByName(pkgName) {
        const clean = String(pkgName || "").trim().toLowerCase().replace(/@latest$/, "");
        return INTERCHANGE_PACKAGE_CATALOG.find((pkg) =>
            pkg.pkg.toLowerCase() === clean ||
            pkg.bin.toLowerCase() === clean ||
            pkg.aliases.some((a) => a.toLowerCase() === clean)
        ) || null;
    },

    async fetchResource(url) {
        const cleanUrl = String(url || "").trim();
        if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
            throw new Error(`Invalid URL '${cleanUrl}'. Provide an http:// or https:// URL.`);
        }

        const matchedPkg = this.resolvePackageByUrl(cleanUrl);

        // 1. Try Native Relay bridge first if connected (bypasses browser CORS completely)
        if (window.PortfoliOSNativeRelay && typeof window.PortfoliOSNativeRelay.fetch === "function") {
            try {
                const relayRes = await window.PortfoliOSNativeRelay.fetch(cleanUrl);
                if (relayRes && relayRes.ok && typeof relayRes.text === "string" && relayRes.text.trim()) {
                    if (matchedPkg) {
                        return {
                            ok: true,
                            status: 200,
                            source: "native-relay+interchange",
                            contentType: "application/x-sh",
                            body: buildPosixInstallerScript(matchedPkg, cleanUrl)
                        };
                    }
                    return {
                        ok: true,
                        status: relayRes.status || 200,
                        source: "native-relay",
                        contentType: relayRes.contentType || "text/plain",
                        body: relayRes.text
                    };
                }
            } catch (e) {
                // Fall through to standard fetch / interchange exchange
            }
        }

        // 2. Try standard browser fetch
        if (typeof fetch === "function") {
            try {
                const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
                const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;
                const res = await fetch(cleanUrl, controller ? { signal: controller.signal } : undefined);
                if (timer) clearTimeout(timer);
                if (res && res.ok) {
                    const text = await res.text();
                    if (matchedPkg) {
                        return {
                            ok: true,
                            status: 200,
                            source: "fetch+interchange",
                            contentType: "application/x-sh",
                            body: buildPosixInstallerScript(matchedPkg, cleanUrl)
                        };
                    }
                    return {
                        ok: true,
                        status: res.status,
                        source: "fetch",
                        contentType: res.headers?.get?.("content-type") || "text/plain",
                        body: text
                    };
                }
            } catch (e) {
                // Browser CORS blocked direct read or offline; fall through to Interchange Exchange
            }
        }

        // 3. Interchange Exchange Handler: translate known installer/package URLs or synthesize a POSIX installer script
        if (matchedPkg) {
            return {
                ok: true,
                status: 200,
                source: "interchange-exchange",
                contentType: "application/x-sh",
                body: buildPosixInstallerScript(matchedPkg, cleanUrl)
            };
        }

        // 4. Synthesize an Interchange installer for any third-party *.sh / /install script URL blocked by CORS
        try {
            const parsedUrl = new URL(cleanUrl);
            if (/\.sh$|\/install/i.test(parsedUrl.pathname)) {
                const hostParts = parsedUrl.hostname.replace(/^www\./, "").split(".");
                const derivedBin = (hostParts[0] || "cli").toLowerCase().replace(/[^a-z0-9_-]/g, "");
                const dynamicPkg = {
                    bin: derivedBin,
                    pkg: `@${derivedBin}/cli`,
                    name: `${derivedBin.toUpperCase()} CLI`,
                    version: "1.0.0",
                    provider: parsedUrl.hostname,
                    authUrl: `${parsedUrl.origin}/login`,
                    docsUrl: parsedUrl.origin,
                    codePrefix: derivedBin.slice(0, 4).toUpperCase(),
                    defaultModel: "default"
                };
                return {
                    ok: true,
                    status: 200,
                    source: "interchange-synthesized",
                    contentType: "application/x-sh",
                    body: buildPosixInstallerScript(dynamicPkg, cleanUrl)
                };
            }
        } catch (e) {
            // Invalid URL
        }

        throw new Error(`Could not fetch ${cleanUrl} (blocked by browser CORS and no Native Relay active).`);
    }
};

function getTerminalOutputContainers() {
    const list = [];
    const primary = window.byId ? window.byId("terminal-output") : document.getElementById?.("terminal-output");
    if (primary) list.push(primary);
    if (typeof document.querySelectorAll === "function") {
        for (const el of document.querySelectorAll("[data-term-output]")) {
            if (!list.includes(el)) list.push(el);
        }
    }
    return list;
}

function getTerminalPromptElements() {
    const list = [];
    const primary = document.getElementById?.("terminal-prompt");
    if (primary) list.push(primary);
    if (typeof document.querySelectorAll === "function") {
        for (const el of document.querySelectorAll("[data-term-prompt]")) {
            if (!list.includes(el)) list.push(el);
        }
    }
    return list;
}

function getTerminalInputElements() {
    const list = [];
    const primary = document.getElementById?.("terminal-input");
    if (primary) list.push(primary);
    if (typeof document.querySelectorAll === "function") {
        for (const el of document.querySelectorAll("[data-term-input]")) {
            if (!list.includes(el)) list.push(el);
        }
    }
    return list;
}

// SHA-256 Hashing helper
async function sha256(message) {
    if (!message) return "";
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// User database loaders & writers
async function loadUsers() {
    let users = {};
    let loaded = false;
    try {
        const file = await window.SystemFS.readFile("/etc/users.json");
        if (file && file.data) {
            users = JSON.parse(file.data);
            loaded = true;
        }
    } catch (e) {
        console.error("Failed to load users DB:", e);
    }

    const defaultUsers = {
        "guest": {
            username: "guest",
            passwordHash: "",
            groups: ["guest"],
            home: "/home/guest"
        },
        "root": {
            username: "root",
            passwordHash: "fc62b0878564f7ab38a9561b369ad89b65e90d1bf4303d76e7b165b46e3d2ff9",
            groups: ["root", "sudo"],
            home: "/root"
        },
        "bl4ut0": {
            username: "bl4ut0",
            passwordHash: "",
            groups: ["bl4ut0", "sudo"],
            home: "/home/bl4ut0"
        },
        "private": {
            username: "private",
            passwordHash: "",
            groups: ["private"],
            home: "/home/private"
        }
    };

    let changed = false;
    for (const key in defaultUsers) {
        if (!users[key]) {
            users[key] = defaultUsers[key];
            changed = true;
        }
    }

    if (changed || !loaded) {
        try {
            await window.SystemFS.ensureDirectory("/etc", { silent: true });
            await window.SystemFS.writeFile("/etc/users.json", "users.json", "/etc", JSON.stringify(users, null, 2), undefined, "application/json", false, { silent: true });
        } catch (e) {
            console.error("Failed to initialize or update default users:", e);
        }
    }

    userDirMap = users;
    return users;
}

async function saveUsers(users) {
    try {
        await window.SystemFS.ensureDirectory("/etc", { silent: true });
        await window.SystemFS.writeFile("/etc/users.json", "users.json", "/etc", JSON.stringify(users, null, 2), undefined, "application/json", false, { silent: true });
        userDirMap = users;
    } catch (e) {
        console.error("Failed to save users DB:", e);
    }
}

async function ensureUserHomeDirectories(users) {
    try {
        for (const dir of ["/bin", "/usr", "/usr/bin", "/usr/local", "/usr/local/bin", "/etc", "/home", "/root", "/var", "/var/log", "/tmp", "/proc", "/dev", "/documents", "/apps"]) {
            await window.SystemFS.ensureDirectory?.(dir, { silent: true });
        }
        const sysFiles = [
            ["/etc/os-release", [
                'PRETTY_NAME="PortfoliOS GNU/Linux 12 (bookworm-wasm64)"',
                'NAME="PortfoliOS GNU/Linux"',
                'VERSION_ID="12"',
                'VERSION="12 (bookworm-wasm64)"',
                "ID=portfolios",
                "ID_LIKE=debian",
                'HOME_URL="https://os.bl4ut0.dev/"'
            ].join("\n") + "\n"],
            ["/etc/hostname", "portfoliOS\n"],
            ["/etc/shells", "/bin/sh\n/bin/bash\n"],
            ["/etc/fstab", [
                "# <file system> <mount point> <type> <options> <dump> <pass>",
                "systemfs        /             idbfs  rw,relatime 0     1",
                "proc            /proc         proc   defaults    0     0",
                "tmpfs           /tmp          tmpfs  rw,nosuid   0     0"
            ].join("\n") + "\n"],
            ["/proc/version", "Linux version 6.6.0-wasm64 (root@portfoliOS) (gcc (Debian 13.2.0-23) 13.2.0, GNU ld 2.42) #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\n"],
            ["/proc/cpuinfo", [
                "processor\t: 0",
                "vendor_id\t: PortfoliOS-WASM64",
                "model name\t: PortfoliOS Virtual x86_64 CPU @ 3.60GHz",
                `cpu cores\t: ${(typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 8}`,
                "flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat sse sse2 avx2 wasm64"
            ].join("\n") + "\n"],
            ["/proc/meminfo", [
                "MemTotal:        8388608 kB",
                "MemFree:         6291456 kB",
                "MemAvailable:    7130316 kB",
                "Buffers:          262144 kB",
                "Cached:           838860 kB"
            ].join("\n") + "\n"]
        ];
        for (const [fPath, fData] of sysFiles) {
            const existing = await window.SystemFS.readFile?.(fPath);
            if (!existing) {
                const parent = window.SystemFS.getParentPath?.(fPath) || "/etc";
                const name = window.SystemFS.getName?.(fPath) || fPath.split("/").pop();
                await window.SystemFS.writeFile?.(fPath, name, parent, fData, fData.length, "text/plain", false, {
                    silent: true,
                    metadata: { sync: false, source: "core-terminal" }
                });
            }
        }
    } catch (e) {
        // Ignore if SystemFS is mocked in unit contract tests
    }
    for (const username in users) {
        if (username !== window.state?.currentUserId && !(username === "guest" && window.state?.currentUserId === "bl4ut0")) continue;
        const homePath = users[username].home;
        if (homePath) {
            try {
                await window.SystemFS.ensureDirectory(homePath, { silent: true });
            } catch (e) {
                console.error(`Failed to ensure home dir for ${username}:`, e);
            }
        }
    }
}

// Path resolver across the full SystemFS hierarchy (also aliases /workspace -> /documents for compatibility)
function resolvePath(pathStr) {
    if (!pathStr) return currentDir;

    let resolved = pathStr;
    if (resolved === "~") {
        const homeDir = userDirMap[currentUser]?.home || (currentUser === "root" ? "/root" : `/home/${currentUser}`);
        resolved = homeDir;
    } else if (resolved.startsWith("~/")) {
        const homeDir = userDirMap[currentUser]?.home || (currentUser === "root" ? "/root" : `/home/${currentUser}`);
        resolved = homeDir + resolved.slice(1);
    }

    if (!resolved.startsWith("/")) {
        resolved = currentDir === "/" ? "/" + resolved : currentDir + "/" + resolved;
    }

    const parts = resolved.split("/").filter(Boolean);
    const stack = [];
    for (const part of parts) {
        if (part === ".") {
            continue;
        } else if (part === "..") {
            if (stack.length > 0) stack.pop();
        } else {
            stack.push(part);
        }
    }

    const normalized = "/" + stack.join("/");
    if (normalized === "/workspace") {
        return "/documents";
    }
    if (normalized.startsWith("/workspace/")) {
        return "/documents/" + normalized.slice("/workspace/".length);
    }
    return normalized;
}

async function getFileRecord(path) {
    const cleanPath = window.SystemFS.normalizePath(path);
    if (cleanPath === "/") {
        return { path: "/", name: "/", parent: "", isDirectory: true, size: 0, type: "directory" };
    }
    return await window.SystemFS.readFile(cleanPath);
}

function getDisplayDir(dir = currentDir) {
    const user = currentUser || "guest";
    const isRoot = user === "root";
    const userHome = userDirMap[user]?.home || (isRoot ? "/root" : `/home/${user}`);
    if (dir === userHome) return "~";
    if (dir.startsWith(userHome + "/")) return "~" + dir.slice(userHome.length);
    return dir;
}

function getDisplayUser(user = currentUser) {
    if (user === "bl4ut0") return "Bl4ut0";
    if (window.isPrivateUser?.(user)) {
        const privateUser = window.getCurrentUser ? window.getCurrentUser() : null;
        return privateUser?.handle || "private";
    }
    return user || "guest";
}

function formatAgyModelInfo(modelId, effort = "high") {
    const raw = String(modelId || "gemini-3.8-flash-high").trim().toLowerCase();
    const eff = String(effort || "high").trim().toLowerCase();
    const effTitle = eff.charAt(0).toUpperCase() + eff.slice(1);
    const catalog = {
        "gemini-3.8-flash-high": { header: "Gemini 3.8 Flash (High)", footer: "Gemini 3.8 Flash · high" },
        "gemini-3.8-flash-medium": { header: "Gemini 3.8 Flash (Medium)", footer: "Gemini 3.8 Flash · medium" },
        "gemini-3.8-flash-low": { header: "Gemini 3.8 Flash (Low)", footer: "Gemini 3.8 Flash · low" },
        "gemini-3.8-flash": { header: `Gemini 3.8 Flash (${effTitle})`, footer: `Gemini 3.8 Flash · ${eff}` },
        "gemini-2.5-pro-agy": { header: `Gemini 3.8 Flash (${effTitle})`, footer: `Gemini 3.8 Flash · ${eff}` },
        "gemini-4-argon-high": { header: "Gemini 4 Argon (High)", footer: "Gemini 4 Argon · high" },
        "gemini-4-argon-medium": { header: "Gemini 4 Argon (Medium)", footer: "Gemini 4 Argon · medium" },
        "gemini-4-argon-low": { header: "Gemini 4 Argon (Low)", footer: "Gemini 4 Argon · low" },
        "claude-opus-5-5-high": { header: "Claude Opus 5.5 (High)", footer: "Claude Opus 5.5 · high" },
        "claude-opus-5-5-medium": { header: "Claude Opus 5.5 (Medium)", footer: "Claude Opus 5.5 · medium" },
        "claude-opus-5-5-low": { header: "Claude Opus 5.5 (Low)", footer: "Claude Opus 5.5 · low" },
        "claude-sonnet-5-5-high": { header: "Claude Sonnet 5.5 (High)", footer: "Claude Sonnet 5.5 · high" },
        "claude-sonnet-5-5-medium": { header: "Claude Sonnet 5.5 (Medium)", footer: "Claude Sonnet 5.5 · medium" },
        "claude-sonnet-5-5-low": { header: "Claude Sonnet 5.5 (Low)", footer: "Claude Sonnet 5.5 · low" },
        "gpt-oss-120b-medium": { header: "GPT-OSS 120B (Medium)", footer: "GPT-OSS 120B · medium" }
    };
    if (catalog[raw]) return catalog[raw];
    return {
        header: `${modelId || "Gemini 3.8 Flash"} (${effTitle})`,
        footer: `${modelId || "Gemini 3.8 Flash"} · ${eff}`
    };
}

function getPromptHtml() {
    const displayDir = getDisplayDir(currentDir);
    if (activeCliSession) {
        if (activeCliSession.bin === "agy") {
            return `<span style="color: #38bdf8; font-weight: 700;">&gt;</span>&nbsp;`;
        }
        if (activeCliSession.bin === "claude") {
            return `<span style="color: #fb923c; font-weight: 700;">&gt;</span>&nbsp;`;
        }
        if (activeCliSession.bin === "codex") {
            return `<span style="color: #34d399; font-weight: 700;">&rsaquo;</span>&nbsp;`;
        }
        if (activeCliSession.bin === "gemini") {
            return `<span style="color: #60a5fa; font-weight: 700;">&gt;</span>&nbsp;`;
        }
        return `<span style="color: var(--theme-primary-ink); font-weight: bold;">${escapeHtml(activeCliSession.bin)}</span>(<span style="color: var(--blue-ink);">${escapeHtml(displayDir)}</span>)&gt;&nbsp;`;
    }
    const user = currentUser || "guest";
    const isRoot = user === "root";
    const promptChar = isRoot ? "#" : "$";
    const userColor = isRoot ? "var(--rose-ink)" : "var(--theme-accent-ink)";
    const pathColor = "var(--blue-ink)";
    const displayUser = getDisplayUser(user);
    return `<span style="color: ${userColor}; font-weight: bold;">${escapeHtml(displayUser)}@portfoliOS</span>:<span style="color: ${pathColor}; font-weight: bold;">${escapeHtml(displayDir)}</span>${promptChar}&nbsp;`;
}

function syncAgyStatusBar() {
    if (typeof document.querySelectorAll !== "function") return;
    const isCliSession = Boolean(activeCliSession);
    const forms = document.querySelectorAll("#terminal-form, [data-term-form]");
    for (const form of forms) {
        const win = form.closest?.(".terminal-window, #cli-window") || form.parentElement;
        if (win && win.classList) {
            win.classList.toggle("is-agy-cli-active", isCliSession);
        }
        let footer = win?.querySelector?.("[data-agy-statusbar]");
        if (!isCliSession) {
            if (footer) footer.style.display = "none";
            form.style.borderTop = "";
            form.style.borderBottom = "";
            form.style.paddingTop = "";
            form.style.paddingBottom = "";
            continue;
        }
        form.style.borderTop = "1px solid rgba(148, 163, 184, 0.35)";
        form.style.borderBottom = "1px solid rgba(148, 163, 184, 0.35)";
        form.style.paddingTop = "6px";
        form.style.paddingBottom = "6px";
        if (!footer && win) {
            footer = document.createElement("div");
            footer.setAttribute("data-agy-statusbar", "true");
            footer.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:6px 4px 2px;font-family:var(--font-mono, monospace);font-size:12px;color:#94a3b8;user-select:none;";
            win.appendChild(footer);
        }
        if (footer && activeCliSession) {
            let rightLabel = "";
            const remoteSuffix = activeCliSession.remoteMode ? " · cloud-remote" : "";
            if (activeCliSession.bin === "agy" || activeCliSession.bin === "gemini") {
                const modelInfo = formatAgyModelInfo(activeCliSession.model, activeCliSession.effort || "high");
                rightLabel = modelInfo.footer + remoteSuffix;
            } else if (activeCliSession.bin === "claude") {
                rightLabel = `⏵⏵ bypass permissions on · ${activeCliSession.model || "claude-sonnet-4-6"}${remoteSuffix}`;
            } else if (activeCliSession.bin === "codex") {
                rightLabel = `codex · ${activeCliSession.model || "o3"} · workspace-write${remoteSuffix}`;
            } else {
                rightLabel = `${activeCliSession.bin} · ${activeCliSession.model || "default"}${remoteSuffix}`;
            }
            footer.style.display = "flex";
            footer.innerHTML = `<span>? for shortcuts</span><span>${escapeHtml(rightLabel)}</span>`;
        }
    }
}

// Prompt formatter across all mounted terminal surfaces
function updatePrompt() {
    const promptHtml = getPromptHtml();
    for (const promptEl of getTerminalPromptElements()) {
        promptEl.innerHTML = promptHtml;
    }
    syncAgyStatusBar();

    const displayUser = getDisplayUser(currentUser);
    const displayDir = getDisplayDir(currentDir);
    const suffix = activeCliSession ? ` [${activeCliSession.bin}]` : "";
    const titleMarkup = `<i class="fa-solid fa-terminal"></i> ${escapeHtml(displayUser)}@portfoliOS:${escapeHtml(displayDir)}${escapeHtml(suffix)}`;

    const titleEl = document.getElementById?.("cli-window-title");
    if (titleEl) {
        titleEl.innerHTML = titleMarkup;
    }
    if (typeof document.querySelectorAll === "function") {
        for (const winTitle of document.querySelectorAll('[data-window="cli"] > .window-bar > span, [data-window="codex"] > .window-bar > span')) {
            winTitle.innerHTML = titleMarkup;
        }
    }
}

// Interactive prompt state machine helper
function promptUser(label, isPassword, callback) {
    activePrompt = { label, isPassword, callback };

    for (const promptEl of getTerminalPromptElements()) {
        promptEl.textContent = label;
    }

    const inputs = getTerminalInputElements();
    for (const inputEl of inputs) {
        inputEl.type = isPassword ? "password" : "text";
        inputEl.value = "";
    }
    inputs[0]?.focus?.();
}

const SHELL_SUBCOMMANDS = {
    git: [
        "add", "bisect", "branch", "checkout", "clone", "commit", "config", "diff",
        "fetch", "grep", "init", "log", "merge", "mv", "pull", "push", "rebase",
        "remote", "reset", "restore", "revert", "rm", "show", "status", "stash",
        "switch", "tag"
    ],
    apt: [
        "autoclean", "autoremove", "clean", "install", "list", "purge", "remove",
        "search", "show", "source", "update", "upgrade"
    ],
    "apt-get": [
        "autoclean", "autoremove", "clean", "install", "purge", "remove",
        "source", "update", "upgrade"
    ],
    npm: [
        "audit", "build", "cache", "ci", "config", "exec", "help", "info", "init",
        "install", "i", "link", "list", "ls", "outdated", "publish", "rebuild",
        "repo", "restart", "root", "run", "search", "start", "stop", "test",
        "uninstall", "unlink", "update", "version", "view", "whoami"
    ],
    storage: [
        "clear", "export", "get", "import", "list", "remove", "rm", "set"
    ],
    localstorage: [
        "clear", "export", "get", "import", "list", "remove", "rm", "set"
    ],
    sys: [
        "cpu", "health", "info", "mem", "memory", "net", "processes", "reboot",
        "restart", "services", "status", "uptime"
    ],
    sysctl: [
        "cpu", "health", "info", "mem", "memory", "net", "processes", "reboot",
        "restart", "services", "status", "uptime"
    ],
    ai: [
        "chat", "clear", "config", "history", "model", "models", "prompt", "reset", "status"
    ],
    assistant: [
        "chat", "clear", "config", "history", "model", "models", "prompt", "reset", "status"
    ],
    lobe: [
        "chat", "clear", "config", "history", "model", "models", "prompt", "reset", "status"
    ],
    "interchange-exchange": [
        "clean", "info", "install", "list", "search", "status", "sync", "uninstall", "update"
    ],
    systemfs: [
        "check", "format", "info", "mount", "quota", "repair", "status", "sync"
    ],
    sysfs: [
        "check", "format", "info", "mount", "quota", "repair", "status", "sync"
    ],
    service: [
        "status", "start", "stop", "restart", "reload", "enable", "disable"
    ],
    systemctl: [
        "status", "start", "stop", "restart", "reload", "enable", "disable"
    ]
};

const SHELL_COMMAND_FLAGS = {
    ls: ["-a", "-all", "-l", "-la", "-lh", "-R", "-r", "-t", "-h", "-1", "--help"],
    cd: ["-", "--help"],
    grep: ["-i", "-r", "-R", "-n", "-v", "-l", "-c", "-e", "-E", "-w", "--help"],
    rm: ["-r", "-R", "-f", "-rf", "-i", "-v", "--help"],
    rmdir: ["-p", "-v", "--help"],
    cp: ["-r", "-R", "-f", "-i", "-p", "-v", "--help"],
    mv: ["-f", "-i", "-v", "--help"],
    mkdir: ["-p", "-v", "-m", "--help"],
    curl: ["-s", "-S", "-O", "-o", "-L", "-I", "-H", "-X", "-d", "-u", "-k", "-v", "-fsSL", "--silent", "--help"],
    wget: ["-O", "-q", "-c", "-v", "--help"],
    find: ["-name", "-iname", "-type", "-maxdepth", "-mindepth", "-size", "-mtime", "-exec", "--help"],
    tar: ["-czvf", "-xzvf", "-tvf", "-cf", "-xf", "-z", "-v", "-f", "-C", "--help"],
    ps: ["aux", "-ef", "-e", "-a", "-u", "--help"],
    head: ["-n", "-c", "--help"],
    tail: ["-n", "-c", "-f", "--help"],
    wc: ["-l", "-w", "-c", "-m", "--help"],
    git: ["--help", "--version", "-v", "--all", "-a", "--force", "-f", "-b", "-m", "-d", "-D", "-p", "--hard", "--soft", "--cached"],
    npm: ["--save", "--save-dev", "-D", "-g", "--global", "-f", "--force", "-v", "--version", "--help"],
    chmod: ["-R", "+x", "-x", "+w", "-w", "+r", "-r", "755", "644", "777"],
    python: ["-v", "--version", "-c", "-m", "-h", "--help"],
    python3: ["-v", "--version", "-c", "-m", "-h", "--help"],
    node: ["-v", "--version", "-e", "-p", "--help"],
    cat: ["-n", "-b", "-s", "--help"],
    df: ["-h", "-k", "-m", "--help"],
    du: ["-h", "-s", "-d", "--help"],
    uname: ["-a", "-s", "-n", "-r", "-m", "--help"],
    history: ["-c", "--clear", "-n", "--help"]
};

let lastTabState = {
    token: "",
    timestamp: 0,
    count: 0
};

function clearTerminalScreen() {
    for (const container of getTerminalOutputContainers()) {
        container.innerHTML = "";
    }
    terminalLineBuffer.length = 0;
}
window.clearTerminalScreen = clearTerminalScreen;

function getLongestCommonPrefix(strings) {
    if (!strings || strings.length === 0) return "";
    if (strings.length === 1) return strings[0];
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
        const str = strings[i];
        let j = 0;
        while (j < prefix.length && j < str.length && prefix[j] === str[j]) {
            j++;
        }
        prefix = prefix.slice(0, j);
        if (!prefix) break;
    }
    return prefix;
}

function formatCandidateColumns(candidates, maxCols = 80) {
    if (!candidates || candidates.length === 0) return "";
    const maxItems = 100;
    const truncated = candidates.length > maxItems;
    const items = truncated ? candidates.slice(0, maxItems) : candidates;

    const maxLen = items.reduce((max, s) => Math.max(max, s.length), 0);
    const colWidth = maxLen + 3;
    const numCols = Math.max(1, Math.floor(maxCols / colWidth));
    const lines = [];

    for (let i = 0; i < items.length; i += numCols) {
        const row = items.slice(i, i + numCols);
        const line = row.map((item, idx) => {
            if (idx === row.length - 1) return item;
            return item.padEnd(colWidth, " ");
        }).join("");
        lines.push(line);
    }

    if (truncated) {
        lines.push(`... and ${candidates.length - maxItems} more`);
    }
    return lines.join("\n");
}

async function getPathCompletions(rawToken, dirsOnly = false) {
    const unescapedToken = rawToken.replace(/\\ /g, " ");
    let dirPart = "";
    let filePart = "";

    const lastSlash = unescapedToken.lastIndexOf("/");
    if (lastSlash !== -1) {
        dirPart = unescapedToken.slice(0, lastSlash + 1);
        filePart = unescapedToken.slice(lastSlash + 1);
    } else {
        dirPart = "";
        filePart = unescapedToken;
    }

    let resolvedDir = currentDir;
    if (dirPart) {
        resolvedDir = resolvePath(dirPart);
    }

    if (!window.SystemFS || typeof window.SystemFS.readDir !== "function") {
        return [];
    }

    let entries = [];
    try {
        entries = (await window.SystemFS.readDir(resolvedDir)) || [];
    } catch {
        return [];
    }

    const showHidden = filePart.startsWith(".");
    const matches = [];

    if (showHidden || filePart === "." || filePart === "..") {
        if (".".startsWith(filePart)) matches.push(dirPart + "./");
        if ("..".startsWith(filePart)) matches.push(dirPart + "../");
    }

    for (const entry of entries) {
        const name = entry.name;
        if (!name) continue;
        if (!showHidden && name.startsWith(".")) continue;
        if (!name.toLowerCase().startsWith(filePart.toLowerCase())) continue;

        const isDir = Boolean(entry.isDirectory || entry.type === "directory");
        if (dirsOnly && !isDir) continue;

        const escapedName = name.replace(/ /g, "\\ ");
        const completion = dirPart + escapedName + (isDir ? "/" : "");
        matches.push(completion);
    }

    return matches.sort((a, b) => a.localeCompare(b));
}

async function getAllAvailableCommands() {
    const cmds = new Set([
        ...BUILTIN_SHELL_COMMANDS,
        ...Object.keys(OS_APP_ALIASES),
        ...Object.keys(shellAliases)
    ]);

    if (typeof INTERCHANGE_PACKAGE_CATALOG !== "undefined" && Array.isArray(INTERCHANGE_PACKAGE_CATALOG)) {
        for (const pkg of INTERCHANGE_PACKAGE_CATALOG) {
            if (pkg.bin) cmds.add(pkg.bin);
            if (pkg.aliases) {
                for (const a of pkg.aliases) {
                    if (!a.startsWith("@") && !a.includes("/")) cmds.add(a);
                }
            }
        }
    }

    if (window.SystemFS && typeof window.SystemFS.readDir === "function") {
        try {
            const binFiles = (await window.SystemFS.readDir("/usr/local/bin")) || [];
            for (const f of binFiles) {
                if (f.name && !f.name.startsWith(".")) cmds.add(f.name);
            }
        } catch {}
        try {
            const binFiles = (await window.SystemFS.readDir("/bin")) || [];
            for (const f of binFiles) {
                if (f.name && !f.name.startsWith(".")) cmds.add(f.name);
            }
        } catch {}
    }

    return Array.from(cmds).sort();
}

async function handleTerminalTab(inputEl) {
    if (!inputEl) return;
    if (activePrompt && activePrompt.isPassword) return;

    if (activeCliSession) {
        const raw = inputEl.value || "";
        const pos = inputEl.selectionStart ?? raw.length;
        const before = raw.slice(0, pos);
        const after = raw.slice(pos);
        const cliCommands = ["/help", "/status", "/model", "/login", "/logout", "/clear", "/exit", "create", "read"];
        const match = before.match(/(?:[^\s\\]|\\.)+$/);
        const tok = match ? match[0] : "";
        const pfx = before.slice(0, before.length - tok.length);
        const matches = cliCommands.filter(c => c.startsWith(tok));
        if (matches.length === 1) {
            const next = pfx + matches[0] + " ";
            for (const el of getTerminalInputElements()) el.value = next + after;
            inputEl.selectionStart = inputEl.selectionEnd = next.length;
        } else if (matches.length > 1) {
            const lcp = getLongestCommonPrefix(matches);
            if (lcp.length > tok.length) {
                const next = pfx + lcp;
                for (const el of getTerminalInputElements()) el.value = next + after;
                inputEl.selectionStart = inputEl.selectionEnd = next.length;
            } else {
                window.addTerminalLine(formatCandidateColumns(matches), "muted");
            }
        }
        return;
    }

    const val = inputEl.value || "";
    const cursorPos = inputEl.selectionStart ?? val.length;
    const beforeCursor = val.slice(0, cursorPos);
    const afterCursor = val.slice(cursorPos);

    const boundaryMatches = [
        beforeCursor.lastIndexOf(";"),
        beforeCursor.lastIndexOf("|"),
        beforeCursor.lastIndexOf("&&") !== -1 ? beforeCursor.lastIndexOf("&&") + 1 : -1,
        beforeCursor.lastIndexOf("||") !== -1 ? beforeCursor.lastIndexOf("||") + 1 : -1
    ];
    const cmdBoundary = Math.max(...boundaryMatches);
    const activeSegment = cmdBoundary !== -1 ? beforeCursor.slice(cmdBoundary + 1) : beforeCursor;
    const segmentPrefix = cmdBoundary !== -1 ? beforeCursor.slice(0, cmdBoundary + 1) : "";

    const tokenMatch = activeSegment.match(/(?:[^\s\\]|\\.)+$/);
    const currentToken = tokenMatch ? tokenMatch[0] : "";
    const segmentBeforeToken = activeSegment.slice(0, activeSegment.length - currentToken.length);
    const fullPrefix = segmentPrefix + segmentBeforeToken;

    const prevWords = parseArgs(segmentBeforeToken);
    const isCommand = prevWords.length === 0;
    const command = prevWords[0]?.toLowerCase() || "";

    let candidates = [];
    let isPathCompletion = false;
    let dirsOnly = false;
    let completionDirPrefix = "";

    if (isCommand) {
        if (currentToken.startsWith("./") || currentToken.startsWith("../") || currentToken.startsWith("/") || currentToken.startsWith("~/")) {
            isPathCompletion = true;
            candidates = await getPathCompletions(currentToken, false);
        } else {
            const allCommands = await getAllAvailableCommands();
            if (currentToken === "") {
                const now = Date.now();
                if (lastTabState.token === "" && (now - lastTabState.timestamp) < 3000 && lastTabState.count >= 1) {
                    window.addTerminalLine(formatCandidateColumns(allCommands), "muted");
                    lastTabState = { token: "", timestamp: 0, count: 0 };
                    return;
                } else {
                    lastTabState = { token: "", timestamp: now, count: 1 };
                    return;
                }
            }
            candidates = allCommands.filter(cmd => cmd.toLowerCase().startsWith(currentToken.toLowerCase()));
        }
    } else {
        if (currentToken.startsWith("-")) {
            const flags = SHELL_COMMAND_FLAGS[command];
            if (flags) {
                candidates = flags.filter(f => f.startsWith(currentToken));
            } else if (currentToken.startsWith("--")) {
                candidates = ["--help", "--version", "--verbose"].filter(f => f.startsWith(currentToken));
            } else {
                candidates = ["-h", "-v"].filter(f => f.startsWith(currentToken));
            }
        } else {
            if (prevWords.length === 1 && SHELL_SUBCOMMANDS[command]) {
                const subMatches = SHELL_SUBCOMMANDS[command].filter(sub => sub.startsWith(currentToken.toLowerCase()));
                if (subMatches.length > 0) {
                    candidates = subMatches;
                }
            }

            if (candidates.length === 0 && (command === "su" || command === "passwd" || command === "userdel" || command === "chown") && prevWords.length === 1) {
                const users = Array.from(new Set([...Object.keys(userDirMap || {}), "guest", "root"]));
                candidates = users.filter(u => u.toLowerCase().startsWith(currentToken.toLowerCase()));
            }

            if (candidates.length === 0 && (command === "kill" || command === "fg") && prevWords.length === 1) {
                candidates = Array.from(terminalJobs.keys()).map(k => String(k)).filter(k => k.startsWith(currentToken));
            }

            if (candidates.length === 0 && (command === "apt" || command === "apt-get") && (prevWords[1] === "install" || prevWords[1] === "remove" || prevWords[1] === "show" || prevWords[1] === "search") && prevWords.length === 2) {
                const pkgs = new Set();
                if (typeof INTERCHANGE_PACKAGE_CATALOG !== "undefined" && Array.isArray(INTERCHANGE_PACKAGE_CATALOG)) {
                    for (const p of INTERCHANGE_PACKAGE_CATALOG) {
                        if (p.bin) pkgs.add(p.bin);
                    }
                }
                for (const app of Object.keys(OS_APP_ALIASES)) pkgs.add(app);
                candidates = Array.from(pkgs).filter(p => p.toLowerCase().startsWith(currentToken.toLowerCase()));
            }

            if (candidates.length === 0) {
                isPathCompletion = true;
                dirsOnly = (command === "cd" || command === "rmdir");
                candidates = await getPathCompletions(currentToken, dirsOnly);
            }
        }
    }

    if (isPathCompletion) {
        const unescapedToken = currentToken.replace(/\\ /g, " ");
        const lastSlash = unescapedToken.lastIndexOf("/");
        completionDirPrefix = lastSlash !== -1 ? unescapedToken.slice(0, lastSlash + 1) : "";
    }

    if (candidates.length === 0) {
        lastTabState = { token: "", timestamp: 0, count: 0 };
        return;
    }

    if (candidates.length === 1) {
        const candidate = candidates[0];
        const isDir = candidate.endsWith("/");
        const replacement = isDir ? candidate : candidate + " ";
        const newBeforeCursor = fullPrefix + replacement;
        const newFullValue = newBeforeCursor + afterCursor;

        for (const el of getTerminalInputElements()) {
            el.value = newFullValue;
        }
        inputEl.selectionStart = inputEl.selectionEnd = newBeforeCursor.length;
        lastTabState = { token: "", timestamp: 0, count: 0 };
        return;
    }

    const lcp = getLongestCommonPrefix(candidates);
    const now = Date.now();
    const isDoubleTab = (lastTabState.token === currentToken && (now - lastTabState.timestamp) < 3000);

    if (lcp.length > currentToken.length) {
        const newBeforeCursor = fullPrefix + lcp;
        const newFullValue = newBeforeCursor + afterCursor;
        for (const el of getTerminalInputElements()) {
            el.value = newFullValue;
        }
        inputEl.selectionStart = inputEl.selectionEnd = newBeforeCursor.length;
        lastTabState = { token: lcp, timestamp: now, count: 1 };
    } else {
        if (isDoubleTab || lastTabState.count >= 1) {
            const displayItems = candidates.map(c => {
                if (completionDirPrefix && c.startsWith(completionDirPrefix)) {
                    return c.slice(completionDirPrefix.length);
                }
                return c;
            });
            window.addTerminalLine(formatCandidateColumns(displayItems), "muted");
            lastTabState = { token: currentToken, timestamp: now, count: 0 };
        } else {
            lastTabState = { token: currentToken, timestamp: now, count: 1 };
        }
    }
}
window.handleTerminalTab = handleTerminalTab;

function bindHistoryToInput(inputEl) {
    if (!inputEl || inputEl.dataset?.historyBound === "true") return;
    if (inputEl.dataset) inputEl.dataset.historyBound = "true";

    inputEl.addEventListener("input", () => {
        lastTabState = { token: "", timestamp: 0, count: 0 };
    });

    inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
            event.preventDefault();
            handleTerminalTab(inputEl);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (history.length === 0) return;
            if (historyIndex === -1) {
                currentInputVal = inputEl.value;
                historyIndex = history.length - 1;
            } else if (historyIndex > 0) {
                historyIndex--;
            }
            inputEl.value = history[historyIndex];
            setTimeout(() => { inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length; }, 0);
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            if (historyIndex === -1) return;
            if (historyIndex < history.length - 1) {
                historyIndex++;
                inputEl.value = history[historyIndex];
            } else {
                historyIndex = -1;
                inputEl.value = currentInputVal;
            }
        } else if (event.key === "Enter" && !event.isComposing) {
            event.preventDefault();
            if (inputEl.form) {
                inputEl.form.requestSubmit();
            } else {
                const val = inputEl.value;
                inputEl.value = "";
                window.submitTerminalInput(val);
            }
        } else if (event.key === "l" && event.ctrlKey) {
            event.preventDefault();
            clearTerminalScreen();
        } else if (event.key === "u" && event.ctrlKey) {
            event.preventDefault();
            const pos = inputEl.selectionStart || 0;
            inputEl.value = inputEl.value.slice(pos);
            inputEl.selectionStart = inputEl.selectionEnd = 0;
        } else if (event.key === "k" && event.ctrlKey) {
            event.preventDefault();
            const pos = inputEl.selectionStart || 0;
            inputEl.value = inputEl.value.slice(0, pos);
            inputEl.selectionStart = inputEl.selectionEnd = pos;
        } else if (event.key === "a" && event.ctrlKey) {
            event.preventDefault();
            inputEl.selectionStart = inputEl.selectionEnd = 0;
        } else if (event.key === "e" && event.ctrlKey) {
            event.preventDefault();
            inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
        } else if (event.key === "w" && event.ctrlKey) {
            event.preventDefault();
            const pos = inputEl.selectionStart || 0;
            if (pos > 0) {
                const textBefore = inputEl.value.slice(0, pos);
                const match = textBefore.match(/\s*\S+\s*$/);
                const deleteCount = match ? match[0].length : 1;
                const newBefore = textBefore.slice(0, pos - deleteCount);
                inputEl.value = newBefore + inputEl.value.slice(pos);
                inputEl.selectionStart = inputEl.selectionEnd = newBefore.length;
            }
        } else if (event.key === "d" && event.ctrlKey) {
            if (inputEl.value === "") {
                event.preventDefault();
                if (window.PortfoliOSRuntimeBridge && typeof window.PortfoliOSRuntimeBridge.sendInput === "function" && window.PortfoliOSRuntimeBridge.getActiveSession()?.activeProcess) {
                    window.PortfoliOSRuntimeBridge.sendInput("\x04");
                } else if (activeCliSession) {
                    const name = activeCliSession.bin || "sub-session";
                    activeCliSession = null;
                    window.addTerminalLine?.(`logout: ${name}`, "muted");
                } else {
                    window.addTerminalLine?.("logout", "muted");
                    window.terminateTerminalSession?.();
                    const win = document.querySelector(".window.cli-window, .window.codex-window");
                    const winId = win?.id?.replace("window-", "") || "cli";
                    window.closeDesktopWindow?.(winId);
                }
            } else {
                event.preventDefault();
                const pos = inputEl.selectionStart || 0;
                if (pos < inputEl.value.length) {
                    inputEl.value = inputEl.value.slice(0, pos) + inputEl.value.slice(pos + 1);
                    inputEl.selectionStart = inputEl.selectionEnd = pos;
                }
            }
        } else if (event.key === "c" && event.ctrlKey) {
            event.preventDefault();
            if (window.PortfoliOSRuntimeBridge && typeof window.PortfoliOSRuntimeBridge.sendInput === "function" && window.PortfoliOSRuntimeBridge.getActiveSession()?.activeProcess) {
                window.PortfoliOSRuntimeBridge.sendInput("\x03");
            } else if (activePrompt) {
                window.addTerminalLine("^C", "muted");
                activePrompt = null;
                window.hideTerminalAuthBanner?.();
                for (const el of getTerminalInputElements()) el.type = "text";
                updatePrompt();
            } else if (activeCliSession) {
                window.addTerminalLine("^C (type /exit to leave interactive CLI)", "muted");
            } else {
                const displayUser = getDisplayUser(currentUser);
                const displayDir = getDisplayDir(currentDir);
                const promptChar = currentUser === "root" ? "#" : "$";
                window.addTerminalLine(`${displayUser}@portfoliOS:${displayDir}${promptChar} ${inputEl.value}^C`, "command");
                inputEl.value = "";
                historyIndex = -1;
            }
        }
    });
}

function setupHistory() {
    for (const inputEl of getTerminalInputElements()) {
        bindHistoryToInput(inputEl);
    }
}

// Write a file from the Core Terminal into SystemFS (marks executable/script files sync:false so SecurityKernel never quarantines terminal files)
async function writeTerminalFile(resolvedPath, content, mimeType = "text/plain", extraMeta = {}) {
    if (isProtectedSystemPath(resolvedPath)) {
        throw new Error(`Permission denied: '${resolvedPath}' is a protected security path.`);
    }
    const parent = window.SystemFS.getParentPath(resolvedPath);
    const name = window.SystemFS.getName(resolvedPath);
    await window.SystemFS.ensureDirectory?.(parent, { silent: true });
    const dataStr = String(content ?? "");
    return await window.SystemFS.writeFile(
        resolvedPath,
        name,
        parent,
        dataStr,
        dataStr.length,
        mimeType,
        false,
        {
            metadata: {
                sync: false,
                source: "core-terminal",
                ...extraMeta
            }
        }
    );
}

// Redirection output handler
async function handleRedirection(pathStr, text, append) {
    const resolved = resolvePath(pathStr);
    if (isProtectedSystemPath(resolved)) {
        throw new Error(`cannot redirect to '${pathStr}': Protected system path`);
    }

    const cleanText = String(text ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
    const record = await getFileRecord(resolved);
    let finalData = cleanText;

    if (record) {
        if (record.isDirectory) {
            throw new Error(`cannot redirect to '${pathStr}': Is a directory`);
        }
        if (append) {
            finalData = (record.data || "") + "\n" + cleanText;
        }
    }

    await writeTerminalFile(resolved, finalData, "text/plain", record?.metadata || {});
}

// String escape helper
function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Argument parser (respecting quotes and backslash escapes)
function parseArgs(cmdPart) {
    const args = [];
    let current = "";
    let inDoubleQuotes = false;
    let inSingleQuotes = false;

    for (let i = 0; i < cmdPart.length; i++) {
        const char = cmdPart[i];
        if (char === "\\" && !inSingleQuotes) {
            i++;
            if (i < cmdPart.length) {
                current += cmdPart[i];
            }
        } else if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
        } else if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
        } else if (char === ' ' && !inDoubleQuotes && !inSingleQuotes) {
            if (current) {
                args.push(current);
                current = "";
            }
        } else {
            current += char;
        }
    }
    if (current) {
        args.push(current);
    }
    return args;
}

// Split a command line by unquoted `&&` or `;`
function splitCommandChain(cmdLine) {
    const segments = [];
    let current = "";
    let inDoubleQuotes = false;
    let inSingleQuotes = false;

    for (let i = 0; i < cmdLine.length; i++) {
        const char = cmdLine[i];
        if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
            current += char;
        } else if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
            current += char;
        } else if (!inDoubleQuotes && !inSingleQuotes && char === '&' && cmdLine[i + 1] === '&') {
            if (current.trim()) segments.push(current.trim());
            current = "";
            i++;
        } else if (!inDoubleQuotes && !inSingleQuotes && char === ';') {
            if (current.trim()) segments.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    if (current.trim()) segments.push(current.trim());
    return segments.length ? segments : [cmdLine.trim()];
}

// Split a command line by unquoted pipe `|`
function splitPipeline(cmdPart) {
    const stages = [];
    let current = "";
    let inDoubleQuotes = false;
    let inSingleQuotes = false;

    for (let i = 0; i < cmdPart.length; i++) {
        const char = cmdPart[i];
        if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
            current += char;
        } else if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
            current += char;
        } else if (char === '|' && !inDoubleQuotes && !inSingleQuotes && cmdPart[i + 1] !== '|') {
            stages.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    if (current.trim()) {
        stages.push(current.trim());
    }
    return stages.length ? stages : [cmdPart.trim()];
}

// Command parser supporting > and >>
function parseCommandLine(cmdLine) {
    let inDoubleQuotes = false;
    let inSingleQuotes = false;
    let redirectIndex = -1;
    let append = false;

    for (let i = 0; i < cmdLine.length; i++) {
        const char = cmdLine[i];
        if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
        } else if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
        } else if (!inDoubleQuotes && !inSingleQuotes) {
            if (char === '>' && cmdLine[i + 1] === '>') {
                redirectIndex = i;
                append = true;
                break;
            } else if (char === '>') {
                redirectIndex = i;
                append = false;
                break;
            }
        }
    }

    let commandPart = cmdLine;
    let targetFile = null;

    if (redirectIndex !== -1) {
        commandPart = cmdLine.slice(0, redirectIndex).trim();
        const operatorLength = append ? 2 : 1;
        targetFile = cmdLine.slice(redirectIndex + operatorLength).trim();
        if ((targetFile.startsWith('"') && targetFile.endsWith('"')) ||
            (targetFile.startsWith("'") && targetFile.endsWith("'"))) {
            targetFile = targetFile.slice(1, -1);
        }
    }

    return { commandPart, targetFile, append };
}

// Multi-user logic implementations
async function runSu(targetUser) {
    const user = targetUser || "root";
    const users = await loadUsers();
    if (!users[user]) {
        window.addTerminalLine(`su: user ${user} does not exist`);
        return;
    }

    const userObj = users[user];

    if (!userObj.passwordHash || currentUser === "root") {
        currentUser = user;
        currentDir = userObj.home || "/";
        window.addTerminalLine(`Logged in as ${currentUser}`);
        updatePrompt();
        return;
    }

    promptUser("Password: ", true, async (password) => {
        const hash = await sha256(password);
        if (hash === userObj.passwordHash) {
            currentUser = user;
            currentDir = userObj.home || "/";
            window.addTerminalLine(`Logged in as ${currentUser}`);
            updatePrompt();
        } else {
            window.addTerminalLine("su: Authentication failure");
        }
    });
}

async function runPasswd(targetUser) {
    const user = targetUser || currentUser;
    const users = await loadUsers();
    if (!users[user]) {
        window.addTerminalLine(`passwd: user ${user} does not exist`);
        return;
    }

    if (currentUser !== "root" && currentUser !== user) {
        window.addTerminalLine("passwd: You may not view or modify password information for other users.");
        return;
    }

    const userObj = users[user];

    const changePasswordFlow = () => {
        promptUser("New password: ", true, (newPass) => {
            if (!newPass) {
                window.addTerminalLine("passwd: password cannot be empty");
                return;
            }
            promptUser("Retype new password: ", true, async (retypePass) => {
                if (newPass !== retypePass) {
                    window.addTerminalLine("passwd: passwords do not match");
                    window.addTerminalLine("passwd: password unchanged");
                    return;
                }
                userObj.passwordHash = await sha256(newPass);
                await saveUsers(users);
                window.addTerminalLine("passwd: password updated successfully");
            });
        });
    };

    if (currentUser !== "root" && userObj.passwordHash) {
        promptUser("Current password: ", true, async (currPass) => {
            const hash = await sha256(currPass);
            if (hash !== userObj.passwordHash) {
                window.addTerminalLine("passwd: Authentication token manipulation error");
                return;
            }
            changePasswordFlow();
        });
    } else {
        changePasswordFlow();
    }
}

async function runUserAdd(username) {
    if (currentUser !== "root") {
        window.addTerminalLine("useradd: Only root may add a user to the system.");
        return;
    }

    if (!username) {
        window.addTerminalLine("useradd: Please specify a username.");
        return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        window.addTerminalLine("useradd: Invalid username (only alphanumeric characters, dashes, and underscores allowed).");
        return;
    }

    const users = await loadUsers();
    if (users[username]) {
        window.addTerminalLine(`useradd: The user '${username}' already exists.`);
        return;
    }

    promptUser("Enter password for new user: ", true, (newPass) => {
        promptUser("Retype password: ", true, async (retypePass) => {
            if (newPass !== retypePass) {
                window.addTerminalLine("useradd: passwords do not match");
                window.addTerminalLine("useradd: user creation aborted");
                return;
            }

            const passwordHash = newPass ? await sha256(newPass) : "";
            const homePath = `/home/${username}`;

            users[username] = {
                username,
                passwordHash,
                groups: [username],
                home: homePath
            };

            await saveUsers(users);

            try {
                await window.SystemFS.ensureDirectory(homePath, { silent: true });
            } catch (e) {
                console.error("Failed to create home directory for new user:", e);
            }

            window.addTerminalLine(`useradd: User '${username}' created successfully.`);
            window.addTerminalLine(`useradd: Created home directory ${homePath}`);
        });
    });
}

async function runUserDel(username) {
    if (currentUser !== "root") {
        return "userdel: Only root may delete a user from the system.";
    }

    if (!username) {
        return "userdel: Please specify a username.";
    }

    if (username === "root" || username === "guest") {
        return `userdel: Cannot delete default user '${username}'.`;
    }

    const users = await loadUsers();
    if (!users[username]) {
        return `userdel: The user '${username}' does not exist.`;
    }

    delete users[username];
    await saveUsers(users);

    return `userdel: User '${username}' deleted successfully.`;
}

async function runGroups(targetUser) {
    const user = targetUser || currentUser;
    const users = await loadUsers();
    if (!users[user]) {
        return `groups: '${user}': no such user`;
    }
    return `${user} : ${users[user].groups.join(" ")}`;
}

async function runId(targetUser) {
    const user = targetUser || currentUser;
    const users = await loadUsers();
    if (!users[user]) {
        return `id: '${user}': no such user`;
    }
    const userObj = users[user];
    const isRoot = user === "root";
    const uid = isRoot ? 0 : 1000 + Object.keys(users).indexOf(user);
    const gid = uid;

    const groupsStr = userObj.groups.map(g => {
        const gName = g;
        const gId = gName === "root" || gName === "sudo" ? 0 : 1000 + Object.keys(users).indexOf(gName);
        return `${gId}(${gName})`;
    }).join(",");

    return `uid=${uid}(${user}) gid=${gid}(${user}) groups=${groupsStr}`;
}

// Filesystem logic implementations across the full SystemFS root
async function runCd(pathStr) {
    let targetPath = pathStr;
    if (!targetPath) {
        targetPath = userDirMap[currentUser]?.home || (currentUser === "root" ? "/root" : `/home/${currentUser}`);
    }

    const resolved = resolvePath(targetPath);
    if (isProtectedSystemPath(resolved)) {
        return `cd: ${pathStr}: Permission denied (protected security path)`;
    }
    const record = await getFileRecord(resolved);

    if (!record) {
        return `cd: no such file or directory: ${pathStr}`;
    }

    if (!record.isDirectory) {
        return `cd: not a directory: ${pathStr}`;
    }

    currentDir = resolved;
    updatePrompt();
}

async function runLs(args) {
    const flags = [];
    const paths = [];
    for (const arg of args) {
        if (arg.startsWith("-")) {
            flags.push(arg);
        } else {
            paths.push(arg);
        }
    }

    const showDetails = flags.some(f => f.includes("l"));
    const showAll = flags.some(f => f.includes("a"));

    const targetDir = paths[0] ? resolvePath(paths[0]) : currentDir;
    if (isProtectedSystemPath(targetDir)) {
        return `ls: cannot open directory '${paths[0] || targetDir}': Permission denied (protected security path)`;
    }
    const record = await getFileRecord(targetDir);

    if (!record) {
        return `ls: cannot access '${paths[0] || ""}': No such file or directory`;
    }

    if (!record.isDirectory) {
        if (showDetails) {
            return formatLsRecord(record);
        }
        return record.name;
    }

    const items = (await window.SystemFS.readDir(targetDir)) || [];
    const visibleItems = items.filter(item => showAll || !item.name.startsWith("."));

    if (showDetails) {
        const lines = [];
        if (showAll) {
            const dotRecord = { name: ".", isDirectory: true, size: 0, lastModified: record.lastModified };
            const dotDotRecord = { name: "..", isDirectory: true, size: 0, lastModified: Date.now() };
            lines.push(formatLsRecord(dotRecord));
            lines.push(formatLsRecord(dotDotRecord));
        }

        for (const item of visibleItems) {
            lines.push(formatLsRecord(item));
        }
        return lines.join("\n");
    } else {
        const names = [];
        if (showAll) {
            names.push(".");
            names.push("..");
        }
        for (const item of visibleItems) {
            names.push(item.name);
        }
        return names.join("  ");
    }
}

function formatLsRecord(item) {
    const isDir = item.isDirectory;
    const isExec = !isDir && (
        item.metadata?.executable === true ||
        item.path?.startsWith("/usr/local/bin/") ||
        item.path?.startsWith("/bin/") ||
        String(item.data || "").startsWith("#!")
    );
    const typeChar = isDir ? "d" : "-";
    const perms = isDir ? "rwxr-xr-x" : (item.metadata?.mode || (isExec ? "rwxr-xr-x" : "rw-r--r--"));
    const links = isDir ? 2 : 1;

    const isEtcOrRoot = item.path?.startsWith("/etc") || item.path?.startsWith("/root") || item.path?.startsWith("/usr");
    const owner = isEtcOrRoot ? "root" : (currentUser || "guest");
    const group = isEtcOrRoot ? "root" : (currentUser || "guest");

    const sizeStr = isDir ? "0 B" : formatBytes(item.size || 0);

    const mdate = new Date(item.lastModified || Date.now());
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[mdate.getMonth()];
    const day = String(mdate.getDate()).padStart(2, " ");
    const hour = String(mdate.getHours()).padStart(2, "0");
    const min = String(mdate.getMinutes()).padStart(2, "0");
    const dateStr = `${month} ${day} ${hour}:${min}`;

    const displayName = isDir && item.name !== "." && item.name !== ".." ? `${item.name}/` : item.name;

    return `${typeChar}${perms}  ${links} ${owner.padEnd(8)} ${group.padEnd(8)} ${sizeStr.padStart(8)} ${dateStr} ${displayName}`;
}

function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(0)} ${sizes[i]}`;
}

async function runCat(pathStr, stdin) {
    if (!pathStr) {
        if (stdin !== undefined) return stdin;
        return "cat: missing file operand";
    }
    const resolved = resolvePath(pathStr);
    if (isProtectedSystemPath(resolved)) {
        return `cat: ${pathStr}: Permission denied (protected security path)`;
    }
    const record = await getFileRecord(resolved);

    if (!record) {
        return `cat: ${pathStr}: No such file or directory`;
    }

    if (record.isDirectory) {
        return `cat: ${pathStr}: Is a directory`;
    }

    if (resolved === "/etc/users.json" && currentUser !== "root") {
        try {
            const parsed = JSON.parse(record.data || "{}");
            for (const k of Object.keys(parsed)) {
                if (parsed[k]?.passwordHash) parsed[k].passwordHash = "[PROTECTED]";
            }
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            // Fall through
        }
    }

    return record.data || "";
}

async function runTouch(pathStr) {
    if (!pathStr) {
        return "touch: missing file operand";
    }
    const resolved = resolvePath(pathStr);
    if (isProtectedSystemPath(resolved)) {
        return `touch: cannot touch '${pathStr}': Permission denied`;
    }

    const record = await getFileRecord(resolved);
    if (record) {
        await window.SystemFS.writeFile(resolved, record.name, record.parent, record.data, record.size, record.type, record.isDirectory, {
            lastModified: Date.now(),
            metadata: record.metadata
        });
    } else {
        await writeTerminalFile(resolved, "", "text/plain");
    }
}

async function runChmod(args) {
    const positional = args.filter(a => !a.startsWith("-") || /^[+-][rwx]+$/.test(a));
    if (positional.length < 2) {
        return "Usage: chmod <mode> <file> (e.g. chmod +x install.sh or chmod 755 install.sh)";
    }
    const modeArg = positional[0];
    const targetArg = positional[1];
    const resolved = resolvePath(targetArg);
    if (isProtectedSystemPath(resolved)) {
        return `chmod: changing permissions of '${targetArg}': Operation not permitted`;
    }
    const record = await getFileRecord(resolved);
    if (!record) {
        return `chmod: cannot access '${targetArg}': No such file or directory`;
    }
    const isExec = modeArg.includes("+x") || modeArg === "755" || modeArg === "777" || modeArg === "700";
    const modeStr = isExec ? "rwxr-xr-x" : (modeArg.includes("-x") ? "rw-r--r--" : (record.metadata?.mode || "rwxr-xr-x"));
    await window.SystemFS.writeFile(
        resolved,
        record.name,
        record.parent,
        record.data,
        record.size,
        record.type,
        record.isDirectory,
        {
            lastModified: Date.now(),
            metadata: {
                ...(record.metadata || {}),
                sync: false,
                executable: isExec,
                mode: modeStr
            }
        }
    );
}

async function runMkdir(args) {
    const flags = Array.isArray(args) ? args.filter(a => a.startsWith("-")) : [];
    const paths = Array.isArray(args) ? args.filter(a => !a.startsWith("-")) : [args];
    const pathStr = paths[0];
    const parents = flags.some(f => f.includes("p"));

    if (!pathStr) {
        return "mkdir: missing operand";
    }
    const resolved = resolvePath(pathStr);
    if (isProtectedSystemPath(resolved)) {
        return `mkdir: cannot create directory '${pathStr}': Permission denied`;
    }
    const record = await getFileRecord(resolved);
    if (record) {
        if (parents && record.isDirectory) return;
        return `mkdir: cannot create directory '${pathStr}': File exists`;
    }

    if (parents) {
        await window.SystemFS.ensureDirectory(resolved, { silent: true });
        return;
    }

    const parent = window.SystemFS.getParentPath(resolved);
    const name = window.SystemFS.getName(resolved);
    await window.SystemFS.writeFile(resolved, name, parent, null, 0, "directory", true);
}

async function runRm(args) {
    const flags = [];
    const paths = [];
    for (const arg of args) {
        if (arg.startsWith("-")) {
            flags.push(arg);
        } else {
            paths.push(arg);
        }
    }

    const recursive = flags.some(f => f.includes("r") || f.includes("R"));
    const force = flags.some(f => f.includes("f"));
    const pathStr = paths[0];

    if (!pathStr) {
        return "rm: missing operand";
    }

    const resolved = resolvePath(pathStr);
    if (isProtectedSystemPath(resolved)) {
        return `rm: cannot remove '${pathStr}': Permission denied (protected security path)`;
    }
    const record = await getFileRecord(resolved);

    if (!record) {
        if (force) return;
        return `rm: cannot remove '${pathStr}': No such file or directory`;
    }

    if (record.isDirectory && !recursive) {
        return `rm: cannot remove '${pathStr}': Is a directory`;
    }

    if (record.isDirectory) {
        await window.SystemFS.deleteFileRecursive(resolved);
    } else {
        await window.SystemFS.deleteFile(resolved);
    }
}

async function runCp(args) {
    const paths = args.filter(a => !a.startsWith("-"));
    if (paths.length < 2) return "cp: missing file operand";
    const srcPath = resolvePath(paths[0]);
    const destPath = resolvePath(paths[1]);
    if (isProtectedSystemPath(srcPath) || isProtectedSystemPath(destPath)) {
        return "cp: Permission denied (protected security path)";
    }
    const src = await getFileRecord(srcPath);
    if (!src) return `cp: cannot stat '${paths[0]}': No such file or directory`;
    if (src.isDirectory) return `cp: -r not specified; omitting directory '${paths[0]}'`;

    const destRecord = await getFileRecord(destPath);
    const finalDest = destRecord?.isDirectory ? `${destPath === "/" ? "" : destPath}/${src.name}` : destPath;
    await writeTerminalFile(finalDest, src.data ?? "", src.type || "text/plain", src.metadata || {});
}

async function runMv(args) {
    const paths = args.filter(a => !a.startsWith("-"));
    if (paths.length < 2) return "mv: missing file operand";
    const copyErr = await runCp(paths);
    if (copyErr) return copyErr.replace(/^cp:/, "mv:");
    await window.SystemFS.deleteFile(resolvePath(paths[0]));
}

async function runGrep(args, stdin) {
    const flags = args.filter(a => a.startsWith("-"));
    const positional = args.filter(a => !a.startsWith("-"));
    const ignoreCase = flags.some(f => f.includes("i"));
    const pattern = positional[0];
    if (!pattern) return "Usage: grep [-i] <pattern> [file]";

    let content = stdin;
    if (positional[1]) {
        const fileOut = await runCat(positional[1]);
        if (fileOut.startsWith("cat: ")) return fileOut.replace(/^cat:/, "grep:");
        content = fileOut;
    }
    if (content === undefined || content === null) return "";
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ignoreCase ? "i" : "");
    return String(content)
        .split("\n")
        .filter(line => regex.test(line))
        .join("\n");
}

// System `localStorage` CLI tool (`storage` / `localstorage`)
function runStorageCommand(args) {
    const sub = (args[0] || "ls").toLowerCase();
    if (sub === "ls" || sub === "list") {
        const entries = window.PortfoliOSInterchange.storage.list();
        if (!entries.length) return "localStorage is empty.";
        return [
            "PortfoliOS System localStorage (Protected Security Variables Redacted):",
            ...entries.map(e => {
                const preview = e.protected
                    ? e.value
                    : (String(e.value || "").length > 72 ? String(e.value).slice(0, 72) + "..." : String(e.value));
                return `  ${e.key.padEnd(32)} = ${preview}`;
            })
        ].join("\n");
    }
    if (sub === "get" || sub === "read") {
        const key = args[1];
        if (!key) return "Usage: storage get <key>";
        try {
            const val = window.PortfoliOSInterchange.storage.get(key);
            return val === null ? `(nil) Key '${key}' does not exist in localStorage.` : val;
        } catch (err) {
            return `storage: ${err.message}`;
        }
    }
    if (sub === "set" || sub === "write") {
        const key = args[1];
        const value = args.slice(2).join(" ");
        if (!key) return "Usage: storage set <key> <value>";
        try {
            window.PortfoliOSInterchange.storage.set(key, value);
            return `✓ localStorage['${key}'] updated (${value.length} bytes).`;
        } catch (err) {
            return `storage: ${err.message}`;
        }
    }
    if (sub === "rm" || sub === "del" || sub === "delete" || sub === "remove") {
        const key = args[1];
        if (!key) return "Usage: storage rm <key>";
        try {
            window.PortfoliOSInterchange.storage.remove(key);
            return `✓ Removed '${key}' from localStorage.`;
        } catch (err) {
            return `storage: ${err.message}`;
        }
    }
    return [
        "Usage: storage <command>",
        "  storage ls                List all OS localStorage keys (redacts protected tokens)",
        "  storage get <key>         Read a localStorage key",
        "  storage set <key> <val>   Write a localStorage key",
        "  storage rm <key>          Delete a localStorage key"
    ].join("\n");
}

// System Control CLI tool (`sys` / `sysctl`)
async function runSysCommand(args) {
    const sub = (args[0] || "status").toLowerCase();
    if (sub === "status" || sub === "-a" || sub === "info") {
        const allFiles = (await window.SystemFS.getAllFiles?.()) || [];
        const storageEntries = window.PortfoliOSInterchange.storage.list();
        const openApps = window.state?.openApps ? Array.from(window.state.openApps) : [];
        const relayReady = Boolean(window.PortfoliOSNativeRelay);
        return [
            "PortfoliOS Kernel & System State:",
            `  kernel.arch           = x86_64-portfolios-wasm`,
            `  kernel.interchange    = active (PortfoliOSInterchange v1.0)`,
            `  kernel.native_relay   = ${relayReady ? "connected" : "standby (browser + interchange fallback)"}`,
            `  system.user           = ${currentUser} (profile: ${window.state?.currentUserId || "guest"})`,
            `  system.theme          = ${window.state?.themeId || "dark"}`,
            `  system.wallpaper      = ${window.state?.wallpaper || "aurora"}`,
            `  system.open_windows   = ${openApps.length ? openApps.join(", ") : "(none)"}`,
            `  systemfs.total_nodes  = ${allFiles.length} (root: /)`,
            `  localstorage.keys     = ${storageEntries.length} (${storageEntries.filter(e => !e.protected).length} accessible, ${storageEntries.filter(e => e.protected).length} protected)`
        ].join("\n");
    }
    if (sub === "theme") {
        const themeId = args[1];
        if (!themeId) return `Current theme: ${window.state?.themeId || "dark"}. Usage: sys theme <dark|light|oled|terminal|glacier|sunset|black-accent>`;
        if (typeof window.setPortfolioTheme === "function") {
            window.setPortfolioTheme(themeId);
            return `✓ System theme switched to '${themeId}'.`;
        }
        return "Theme controller unavailable.";
    }
    if (sub === "apps") {
        const apps = window.desktopApps || [];
        return apps.map(a => `${a.id.padEnd(18)} ${(window.isAppInstalled?.(a.id) ? "[installed]" : "[store]").padEnd(13)} ${a.title}`).join("\n");
    }
    return [
        "Usage: sys <command>",
        "  sys status            Show PortfoliOS kernel, SystemFS, localStorage, and Interchange state",
        "  sys theme <id>        Switch live OS theme",
        "  sys apps              List all registered OS applications"
    ].join("\n");
}

// Install an exchanged CLI binary into `/usr/local/bin/<bin>` in SystemFS
async function installCliBinaryToSystemFS(pkgMeta, method = "interchange") {
    const resolvedVersion = await resolveLatestUpstreamCliVersion(pkgMeta);
    pkgMeta.version = resolvedVersion || pkgMeta.version || "1.0.0";
    await window.SystemFS.ensureDirectory?.("/usr", { silent: true });
    await window.SystemFS.ensureDirectory?.("/usr/local", { silent: true });
    await window.SystemFS.ensureDirectory?.("/usr/local/bin", { silent: true });
    const binPath = `/usr/local/bin/${pkgMeta.bin}`;
    const manifestJson = JSON.stringify({
        bin: pkgMeta.bin,
        pkg: pkgMeta.pkg,
        name: pkgMeta.name,
        version: pkgMeta.version,
        provider: pkgMeta.provider,
        authUrl: pkgMeta.authUrl,
        docsUrl: pkgMeta.docsUrl,
        defaultModel: pkgMeta.defaultModel || "default",
        installedVia: method,
        installedAt: new Date().toISOString()
    });
    const scriptContent = [
        "#!/usr/bin/env node",
        `#PORTFOLIOS_BIN:${manifestJson}`,
        `// ${pkgMeta.name} (${pkgMeta.pkg}@${pkgMeta.version}) Interchange Executable`,
        `// Linked at ${binPath} with full SystemFS & localStorage Interchange access`
    ].join("\n");

    await writeTerminalFile(binPath, scriptContent, "application/x-executable", {
        executable: true,
        mode: "rwxr-xr-x",
        bin: pkgMeta.bin
    });

    try {
        const installedMapRaw = window.PortfoliOSInterchange.storage.get("portfolios_installed_cli_bins");
        const installedMap = installedMapRaw ? JSON.parse(installedMapRaw) : {};
        installedMap[pkgMeta.bin] = {
            bin: pkgMeta.bin,
            pkg: pkgMeta.pkg,
            name: pkgMeta.name,
            version: pkgMeta.version,
            path: binPath,
            installedAt: new Date().toISOString()
        };
        window.PortfoliOSInterchange.storage.set("portfolios_installed_cli_bins", JSON.stringify(installedMap));
    } catch (e) {
        // Ignore storage write errors in restricted test sandboxes
    }

    return binPath;
}

async function getInstalledBinary(commandName) {
    if (!commandName || !window.SystemFS?.readFile) return null;
    let candidatePaths = [];
    if (commandName.startsWith("/") || commandName.startsWith("./") || commandName.startsWith("../")) {
        candidatePaths = [resolvePath(commandName)];
    } else {
        const pathDirs = (shellEnv.PATH || "/usr/local/bin:/usr/bin:/bin").split(":").filter(Boolean);
        candidatePaths = pathDirs.map(dir => `${dir.replace(/\/$/, "")}/${commandName}`);
    }

    for (const candidate of candidatePaths) {
        try {
            const record = await window.SystemFS.readFile(candidate);
            if (!record || record.isDirectory || !record.data) continue;
            const text = String(record.data);
            const match = text.match(/^#PORTFOLIOS_BIN:(\{.*\})$/m);
            if (match) {
                const parsed = JSON.parse(match[1]);
                if (parsed.bin === "agy") {
                    parsed.name = "Antigravity CLI";
                    if (!parsed.version || parsed.version === "2.0.0") parsed.version = "1.5.5";
                    if (!parsed.provider || parsed.provider === "Google Account OAuth") parsed.provider = "Google AI Pro";
                    if (!parsed.defaultModel || parsed.defaultModel === "gemini-2.5-pro-agy") parsed.defaultModel = "gemini-3.8-flash-high";
                }
                return { ...parsed, path: candidate };
            }
            return {
                bin: window.SystemFS.getName(candidate),
                pkg: window.SystemFS.getName(candidate),
                name: window.SystemFS.getName(candidate),
                version: "1.0.0",
                path: candidate,
                customScript: text
            };
        } catch (e) {
            // Try next PATH directory
        }
    }
    return null;
}

function inferFilenameFromUrl(url) {
    try {
        const parsed = new URL(url);
        const base = parsed.pathname.split("/").filter(Boolean).pop();
        if (base && /\.[a-z0-9]{1,8}$/i.test(base)) return base;
    } catch (e) {
        // Ignore
    }
    return "install.sh";
}

// `wget` implementation: downloads remote file via Interchange Handler and saves it into currentDir in SystemFS
async function runWget(args) {
    let outputFile = null;
    let quiet = false;
    let toStdout = false;
    const urls = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "-O") {
            outputFile = args[++i];
            if (outputFile === "-") toStdout = true;
        } else if (arg.startsWith("-O") && arg.length > 2) {
            outputFile = arg.slice(2);
            if (outputFile === "-") toStdout = true;
        } else if (arg === "-q" || arg === "--quiet") {
            quiet = true;
        } else if (!arg.startsWith("-")) {
            urls.push(arg);
        }
    }

    const url = urls[urls.length - 1];
    if (!url) {
        return "wget: missing URL\nUsage: wget [options] <url> (e.g. wget https://antigravity.google/cli/install.sh)";
    }

    try {
        const response = await window.PortfoliOSInterchange.fetchResource(url);
        if (toStdout) {
            return response.body;
        }
        const filename = outputFile || inferFilenameFromUrl(url);
        const destPath = resolvePath(filename);
        await writeTerminalFile(destPath, response.body, response.contentType || "text/plain", {
            sourceUrl: url,
            interchangeSource: response.source
        });

        if (quiet) return "";
        const byteLen = response.body.length;
        return [
            `--${new Date().toISOString().replace("T", " ").slice(0, 19)}--  ${url}`,
            `Connecting via PortfoliOS Interchange (${response.source})... connected.`,
            `HTTP request sent, awaiting response... ${response.status} OK`,
            `Length: ${byteLen} (${formatBytes(byteLen)}) [${response.contentType}]`,
            `Saving to: '${filename}' (${destPath})`,
            ``,
            `${filename.padEnd(20)} 100%[===================>] ${String(byteLen).padStart(6)} B  --.-KB/s    in 0.01s`,
            ``,
            `'${filename}' saved [${byteLen}/${byteLen}] -> Run 'chmod +x ${filename} && ./${filename}' or 'sh ${filename}' to execute.`
        ].join("\n");
    } catch (err) {
        return `wget: ${err.message}`;
    }
}

// `curl` implementation: fetches via Interchange Handler; supports -O, -o <file>, pipes (`| sh`), or stdout
async function runCurl(args) {
    let outputFile = null;
    let remoteName = false;
    const urls = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "-o" || arg === "--output") {
            outputFile = args[++i];
        } else if (arg === "-O" || arg === "--remote-name") {
            remoteName = true;
        } else if (!arg.startsWith("-")) {
            urls.push(arg);
        }
    }

    const url = urls[urls.length - 1];
    if (!url) {
        return "curl: try 'curl -fsSL <url>' or 'curl -O <url>'";
    }

    try {
        const response = await window.PortfoliOSInterchange.fetchResource(url);
        if (outputFile || remoteName) {
            const filename = outputFile || inferFilenameFromUrl(url);
            const destPath = resolvePath(filename);
            await writeTerminalFile(destPath, response.body, response.contentType || "text/plain", {
                sourceUrl: url,
                interchangeSource: response.source
            });
            return `Saved '${filename}' (${response.body.length} bytes) to ${destPath}. Run './${filename}' or 'sh ${filename}' to execute.`;
        }
        return response.body;
    } catch (err) {
        return `curl: (6) ${err.message}`;
    }
}

// Internal Interchange command invoked inside installer scripts (`interchange-exchange --install-bin ...`)
async function runInterchangeExchangeCommand(args) {
    const getFlag = (name) => {
        const idx = args.indexOf(name);
        return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
    };
    const bin = getFlag("--install-bin") || getFlag("--bin");
    if (!bin) {
        return "PortfoliOS Interchange Handler v1.0 active.";
    }
    const pkgMeta = {
        bin,
        pkg: getFlag("--pkg") || `@${bin}/cli`,
        name: getFlag("--name") || `${bin.toUpperCase()} CLI`,
        version: getFlag("--version") || "1.0.0",
        provider: getFlag("--provider") || "Subscription Account",
        authUrl: getFlag("--auth-url") || "https://os.bl4ut0.dev/",
        docsUrl: getFlag("--docs-url") || "https://os.bl4ut0.dev/",
        defaultModel: getFlag("--model") || "default"
    };
    const binPath = await installCliBinaryToSystemFS(pkgMeta, "installer-script");
    return [
        `==> Downloading ${pkgMeta.name} v${pkgMeta.version} (${pkgMeta.pkg} linux-wasm64)...`,
        `==> Verifying package signature & SHA-256 digest... OK`,
        `==> Linking executable binary to ${binPath}...`,
        `✓ ${pkgMeta.name} (${pkgMeta.bin} v${pkgMeta.version}) installed to ${binPath}`,
        `  Run '${pkgMeta.bin}' to start an interactive session.`
    ].join("\n");
}

// Execute a POSIX shell script from stdin (`curl ... | bash`) or from a file in SystemFS (`./install.sh`, `sh install.sh`, `bash install.sh`)
async function runShellScript(args, stdin) {
    let scriptBody = stdin;
    const scriptArgs = args.filter(a => !a.startsWith("-"));
    if ((scriptBody === undefined || scriptBody === null) && scriptArgs[0]) {
        const resolved = resolvePath(scriptArgs[0]);
        const fileRecord = await getFileRecord(resolved);
        if (!fileRecord) {
            return `sh: 0: cannot open ${scriptArgs[0]}: No such file or directory`;
        }
        if (fileRecord.isDirectory) {
            return `sh: 0: ${scriptArgs[0]}: Is a directory`;
        }
        scriptBody = fileRecord.data || "";
    }

    if (!scriptBody) {
        return "PortfoliOS POSIX sh/bash (x86_64-portfolios-wasm). Pass a script file (`sh install.sh` or `./install.sh`) or pipe a script (`curl -fsSL <url> | bash`).";
    }

    const installerMatch = String(scriptBody).match(/^#PORTFOLIOS_INSTALLER:(\{.*\})$/m);
    if (installerMatch) {
        const pkgMeta = JSON.parse(installerMatch[1]);
        return await runInterchangeExchangeCommand([
            "--install-bin", pkgMeta.bin,
            "--pkg", pkgMeta.pkg,
            "--version", pkgMeta.version,
            "--name", pkgMeta.name,
            "--provider", pkgMeta.provider,
            "--auth-url", pkgMeta.authUrl,
            "--docs-url", pkgMeta.docsUrl,
            "--model", pkgMeta.defaultModel
        ]);
    }

    const lines = String(scriptBody)
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith("#") && l !== "set -e" && l !== "set -euo pipefail");

    const outputs = [];
    for (const line of lines) {
        const { commandPart, targetFile, append } = parseCommandLine(line);
        const stages = splitPipeline(commandPart);
        let stageOut = undefined;
        for (const stage of stages) {
            const parsed = parseArgs(stage);
            if (!parsed.length) continue;
            stageOut = await executeCommand(parsed[0].toLowerCase(), parsed.slice(1), stage, stageOut);
        }
        if (stageOut !== undefined && stageOut !== "") {
            if (targetFile) {
                await handleRedirection(targetFile, stageOut, append);
            } else {
                outputs.push(stageOut);
            }
        }
    }
    return outputs.join("\n");
}

async function runNpm(args) {
    const sub = (args[0] || "").toLowerCase();
    if (!sub || sub === "-v" || sub === "--version" || sub === "version") {
        return "10.9.2";
    }
    if (sub === "list" || sub === "ls") {
        await window.SystemFS.ensureDirectory("/usr/local/bin", { silent: true });
        const files = await window.SystemFS.readDir("/usr/local/bin") || [];
        if (!files.length) {
            return "/usr/local/lib\n└── (empty)";
        }
        const entries = [];
        for (const f of files) {
            const meta = await getInstalledBinary(f.name);
            if (meta) {
                entries.push(`├── ${meta.pkg}@${meta.version} -> /usr/local/bin/${meta.bin}`);
            }
        }
        return ["/usr/local/lib", ...entries].join("\n");
    }
    if (sub === "install" || sub === "i" || sub === "add") {
        const pkgTargets = args.slice(1).filter(a => !a.startsWith("-"));
        if (!pkgTargets.length) {
            return "npm error: Please specify a package to install (e.g. `npm install -g @google/antigravity-cli`).";
        }
        const outputs = [];
        for (const rawTarget of pkgTargets) {
            const pkgMeta = window.PortfoliOSInterchange.resolvePackageByName(rawTarget);
            if (!pkgMeta) {
                const cleanName = rawTarget.replace(/^@[^/]+\//, "").replace(/@.*$/, "");
                const customMeta = {
                    bin: cleanName,
                    pkg: rawTarget,
                    name: `${rawTarget} CLI`,
                    version: "1.0.0",
                    provider: "Developer Account",
                    authUrl: "https://github.com/login/device",
                    docsUrl: "https://npmjs.com",
                    defaultModel: "default"
                };
                const binPath = await installCliBinaryToSystemFS(customMeta, "npm");
                outputs.push(
                    `added 1 package in 310ms\n+ ${customMeta.pkg}@${customMeta.version}\nlinked binary: ${binPath}`
                );
            } else {
                const binPath = await installCliBinaryToSystemFS(pkgMeta, "npm");
                outputs.push([
                    `added 1 package, and audited 2 packages in 410ms`,
                    `+ ${pkgMeta.pkg}@${pkgMeta.version}`,
                    `linked binary: ${binPath}`,
                    `Run '${pkgMeta.bin}' to start an interactive session.`
                ].join("\n"));
            }
        }
        return outputs.join("\n\n");
    }
    if (sub === "uninstall" || sub === "remove" || sub === "rm" || sub === "un") {
        const pkgTargets = args.slice(1).filter(a => !a.startsWith("-"));
        if (!pkgTargets.length) return "npm error: Please specify a package to uninstall.";
        const outputs = [];
        for (const rawTarget of pkgTargets) {
            const known = window.PortfoliOSInterchange.resolvePackageByName(rawTarget);
            const binName = known ? known.bin : rawTarget.replace(/^@[^/]+\//, "");
            const existing = await getInstalledBinary(binName);
            if (!existing) {
                outputs.push(`npm warn uninstall: ${rawTarget} is not installed`);
            } else {
                await window.SystemFS.deleteFile(`/usr/local/bin/${binName}`);
                cliAuthSessions.delete(binName);
                outputs.push(`removed 1 package (/usr/local/bin/${binName}) in 140ms`);
            }
        }
        return outputs.join("\n");
    }
    return `npm: supported commands are 'npm install -g <pkg>', 'npm uninstall -g <pkg>', 'npm list -g', 'npm --version'`;
}

async function runApt(args) {
    const cleanArgs = args.filter(a => a !== "-y" && a !== "--yes" && a !== "-qq");
    const sub = (cleanArgs[0] || "").toLowerCase();
    if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
        return [
            "apt 2.6.1 (amd64 / x86_64-portfolios-wasm)",
            "Usage: apt <command> [packages...]",
            "",
            "Commands:",
            "  apt update               Update package lists from Debian & PortfoliOS repositories",
            "  apt list [--installed]   List available or installed CLI & OS packages",
            "  apt search <query>       Search packages by name or description",
            "  apt install <pkg...>     Install Linux CLI binaries or PortfoliOS native applications",
            "  apt remove <pkg...>      Uninstall packages and unlink /usr/local/bin executables"
        ].join("\n");
    }

    if (sub === "update") {
        return [
            "Hit:1 https://deb.debian.org/debian bookworm InRelease",
            "Hit:2 https://security.debian.org/debian-security bookworm-security InRelease",
            "Get:3 https://os.bl4ut0.dev/pkg/wasm64 bookworm-portfolios InRelease [18.4 kB]",
            "Fetched 18.4 kB in 0.1s (184 kB/s)",
            "Reading package lists... Done",
            "Building dependency tree... Done",
            "All packages are up to date."
        ].join("\n");
    }

    if (sub === "list" || sub === "search") {
        const installedOnly = args.includes("--installed");
        const query = sub === "search" ? (cleanArgs[1] || "").toLowerCase() : "";
        const lines = ["Listing... Done"];
        for (const pkg of INTERCHANGE_PACKAGE_CATALOG) {
            const installed = Boolean(await getInstalledBinary(pkg.bin));
            if (installedOnly && !installed) continue;
            if (query && !`${pkg.bin} ${pkg.pkg} ${pkg.name}`.toLowerCase().includes(query)) continue;
            lines.push(`${pkg.bin}/bookworm-portfolios ${pkg.version} wasm64 ${installed ? "[installed]" : "[available]"} — ${pkg.name}`);
        }
        const storeApps = window.storeApps || [];
        for (const app of storeApps) {
            if (app.installable === false) continue;
            const installed = Boolean(window.isAppInstalled?.(app.id) || window.isStoreAppInstalled?.(app.id));
            if (installedOnly && !installed) continue;
            if (query && !`${app.id} ${app.title} ${app.description || ""}`.toLowerCase().includes(query)) continue;
            lines.push(`${app.id}/portfolios-os 1.0.0 wasm64 ${installed ? "[installed]" : "[store]"} — ${app.title}`);
        }
        return lines.join("\n");
    }

    if (sub === "install" || sub === "add") {
        const targets = cleanArgs.slice(1);
        if (!targets.length) {
            return "E: Specify at least one package to install (e.g. `apt install vscode` or `apt install codex agy`).";
        }
        const out = [
            "Reading package lists... Done",
            "Building dependency tree... Done",
            "Reading state information... Done"
        ];
        for (const rawTarget of targets) {
            const lower = rawTarget.toLowerCase();
            const cliPkg = window.PortfoliOSInterchange.resolvePackageByName(rawTarget);
            const appId = OS_APP_ALIASES[lower] || ((window.storeApps || []).find(a => a.id === lower)?.id);

            if (cliPkg) {
                const binPath = await installCliBinaryToSystemFS(cliPkg, "apt");
                if (cliPkg.bin === "codex" && typeof window.installApp === "function" && !window.isStoreAppInstalled?.("codex")) {
                    try { await window.installApp("codex"); } catch (_) {}
                }
                out.push(`Unpacking ${cliPkg.bin} (${cliPkg.version}) ...`);
                out.push(`Setting up ${cliPkg.bin} (${cliPkg.version}) ...`);
                out.push(`✓ Linked executable ${binPath} (${cliPkg.name})`);
            } else if (appId) {
                out.push(`Fetching PortfoliOS package '${appId}'...`);
                if (typeof window.installApp === "function") {
                    await window.installApp(appId);
                } else if (typeof window.setInstalledStoreAppIds === "function") {
                    const currentIds = typeof window.getInstalledStoreAppIds === "function" ? window.getInstalledStoreAppIds() : [];
                    if (!currentIds.includes(appId)) {
                        window.setInstalledStoreAppIds([...currentIds, appId]);
                    }
                }
                const launcherScript = `#!/usr/bin/env bash\nopen ${appId}\n`;
                await writeTerminalFile(`/usr/local/bin/${appId}`, launcherScript, "application/x-executable", {
                    executable: true,
                    mode: "rwxr-xr-x",
                    osAppId: appId
                });
                if (appId === "vscode") {
                    await writeTerminalFile("/usr/local/bin/code", launcherScript, "application/x-executable", {
                        executable: true,
                        mode: "rwxr-xr-x",
                        osAppId: "vscode"
                    });
                }
                out.push(`Unpacking ${appId} (1.0.0-portfolios) ...`);
                out.push(`Setting up ${appId} (1.0.0-portfolios) ...`);
                out.push(`✓ Installed PortfoliOS application '${appId}' and linked /usr/local/bin/${appId}. Type '${appId}' to launch.`);
            } else {
                const cleanName = lower.replace(/[^a-z0-9_-]/g, "");
                const customMeta = {
                    bin: cleanName,
                    pkg: `@linux/${cleanName}`,
                    name: `${cleanName} utility`,
                    version: "1.0.0",
                    provider: "Debian Bookworm WASM64",
                    authUrl: "https://os.bl4ut0.dev/",
                    docsUrl: "https://manpages.debian.org/",
                    defaultModel: "default"
                };
                const binPath = await installCliBinaryToSystemFS(customMeta, "apt");
                out.push(`Unpacking ${cleanName} (1.0.0-deb12u1) ...`);
                out.push(`Setting up ${cleanName} (1.0.0-deb12u1) ...`);
                out.push(`✓ Linked executable ${binPath}`);
            }
        }
        return out.join("\n");
    }

    if (sub === "remove" || sub === "uninstall" || sub === "purge") {
        const targets = cleanArgs.slice(1);
        if (!targets.length) return "E: Specify at least one package to remove.";
        const out = ["Reading package lists... Done"];
        for (const rawTarget of targets) {
            const lower = rawTarget.toLowerCase();
            const cliPkg = window.PortfoliOSInterchange.resolvePackageByName(rawTarget);
            const binName = cliPkg ? cliPkg.bin : lower;
            const appId = OS_APP_ALIASES[lower] || ((window.storeApps || []).find(a => a.id === lower)?.id);

            if (appId && typeof window.uninstallApp === "function" && window.isStoreAppInstalled?.(appId)) {
                await window.uninstallApp(appId);
                out.push(`Removing PortfoliOS application ${appId} ...`);
            }
            const existingBin = await getInstalledBinary(binName);
            if (existingBin) {
                await window.SystemFS.deleteFile(`/usr/local/bin/${binName}`);
                cliAuthSessions.delete(binName);
                out.push(`Removing ${binName} (/usr/local/bin/${binName}) ...`);
            } else if (!appId) {
                out.push(`Package '${rawTarget}' is not installed, so not removed.`);
            }
        }
        return out.join("\n");
    }

    return `E: Invalid operation ${sub}. Try 'apt update', 'apt list', 'apt search <q>', 'apt install <pkg>', or 'apt remove <pkg>'.`;
}

async function runWhich(args) {
    const targets = args.filter(a => !a.startsWith("-"));
    if (!targets.length) return "Usage: which <command> [command...]";
    const results = [];
    for (const name of targets) {
        const installed = await getInstalledBinary(name);
        if (installed) {
            results.push(installed.path || `/usr/local/bin/${installed.bin}`);
        } else if (BUILTIN_SHELL_COMMANDS.has(name.toLowerCase())) {
            results.push(`/bin/${name.toLowerCase()}`);
        } else {
            results.push(`${name} not found`);
        }
    }
    return results.join("\n");
}

function resolveActiveUserEmail(bin = "agy") {
    const privateProfiles = window.getPrivateProfiles ? window.getPrivateProfiles() : {};
    const savedPrivate = window.getSavedPrivateProfile ? window.getSavedPrivateProfile() : null;
    const userAcc = window.getCurrentUser ? window.getCurrentUser() : null;
    const gProfile = window.GDriveSync?.getSavedGoogleProfile ? window.GDriveSync.getSavedGoogleProfile() : null;

    const candidates = [
        window.PortfoliOS_GoogleSession?.email,
        gProfile?.email,
        savedPrivate?.email,
        currentUser && privateProfiles?.[currentUser]?.email,
        userAcc?.email,
        userAcc?.handle && userAcc.handle.includes("@") && !userAcc.handle.startsWith("private_") ? userAcc.handle : null
    ];

    for (const candidate of candidates) {
        const clean = String(candidate || "").trim();
        if (clean && clean.includes("@") && !clean.startsWith("private_") && !clean.endsWith("@portfolios.local")) {
            return clean;
        }
    }

    if (bin === "agy") return "bl4ut0@gmail.com";
    if (bin === "codex") return "bl4ut0@gmail.com";
    if (bin === "claude") return "bl4ut0@gmail.com";
    return "bl4ut0@gmail.com";
}

function normalizeCliAccountName(rawAccount, bin = "agy") {
    const clean = String(rawAccount || "").trim();
    if (!clean || clean.startsWith("private_") || clean.endsWith("@portfolios.local") || clean === "guest@gmail.com") {
        return resolveActiveUserEmail(bin);
    }
    return clean;
}

// ============================================================================
// PortfoliOS Git / GitHub Web Bridge & Git-Backed Cloud Remote Agent Manager
// Browser SystemFS (IndexedDB) and client-side Google Drive only exist while
// the browser session is active. External Cloud Remote Agents (agy --remote-agent,
// codex cloud, claude --remote) therefore operate against a connected Git/GitHub
// repository (or require an active host/server running `remote-control`).
// ============================================================================
window.PortfoliOSGitBridge = {
    parseGitHubRepoSpec(raw) {
        const clean = String(raw || "").trim().replace(/\.git$/i, "").replace(/\/+$/, "");
        if (!clean) return null;
        const urlMatch = clean.match(/github\.com[:/]([^/\s]+)\/([^/\s]+)/i);
        if (urlMatch) {
            const owner = urlMatch[1];
            const repo = urlMatch[2];
            return {
                owner,
                repo,
                slug: `${owner}/${repo}`,
                remoteUrl: `https://github.com/${owner}/${repo}.git`,
                htmlUrl: `https://github.com/${owner}/${repo}`
            };
        }
        const slugMatch = clean.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
        if (slugMatch) {
            const owner = slugMatch[1];
            const repo = slugMatch[2];
            return {
                owner,
                repo,
                slug: `${owner}/${repo}`,
                remoteUrl: `https://github.com/${owner}/${repo}.git`,
                htmlUrl: `https://github.com/${owner}/${repo}`
            };
        }
        return null;
    },

    async getGitHubToken() {
        if (shellEnv.GITHUB_TOKEN) return shellEnv.GITHUB_TOKEN;
        if (shellEnv.GH_TOKEN) return shellEnv.GH_TOKEN;
        try {
            const rec = await window.SystemFS?.readFile?.("/etc/portfolios/vault/github.json");
            if (rec?.data) {
                const parsed = typeof rec.data === "string" ? JSON.parse(rec.data) : rec.data;
                if (parsed?.accessToken) return parsed.accessToken;
            }
        } catch (_) {}
        return null;
    },

    async setGitHubToken(token, account = null) {
        const cleanToken = String(token || "").trim();
        if (!cleanToken) return false;
        shellEnv.GITHUB_TOKEN = cleanToken;
        try {
            await window.SystemFS?.ensureDirectory?.("/etc", { silent: true });
            await window.SystemFS?.ensureDirectory?.("/etc/portfolios", { silent: true });
            await window.SystemFS?.ensureDirectory?.("/etc/portfolios/vault", { silent: true });
            await writeTerminalFile(
                "/etc/portfolios/vault/github.json",
                JSON.stringify({
                    provider: "github",
                    accessToken: cleanToken,
                    account: account || resolveActiveUserEmail("git"),
                    updatedAt: new Date().toISOString()
                }, null, 2),
                "application/json"
            );
        } catch (_) {}
        return true;
    },

    async findGitRoot(startDir = currentDir) {
        let dir = resolvePath(startDir || currentDir);
        while (dir) {
            try {
                const rec = await window.SystemFS?.readFile?.(`${dir === "/" ? "" : dir}/.git/config`);
                if (rec && rec.data) return dir;
            } catch (_) {}
            if (dir === "/") break;
            const parent = window.SystemFS?.getParentPath ? window.SystemFS.getParentPath(dir) : dir.slice(0, dir.lastIndexOf("/")) || "/";
            if (!parent || parent === dir) break;
            dir = parent;
        }
        return null;
    },

    async readRepoConfig(dir = currentDir) {
        const gitRoot = await this.findGitRoot(dir);
        if (!gitRoot) return null;
        try {
            const rec = await window.SystemFS?.readFile?.(`${gitRoot === "/" ? "" : gitRoot}/.git/config`);
            if (!rec?.data) return null;
            const parsed = typeof rec.data === "string" ? JSON.parse(rec.data) : rec.data;
            return { ...parsed, gitRoot };
        } catch (_) {
            return null;
        }
    },

    async writeRepoConfig(gitRoot, configData) {
        const base = gitRoot === "/" ? "" : gitRoot;
        await window.SystemFS?.ensureDirectory?.(`${base}/.git`, { silent: true });
        const payload = { ...configData };
        delete payload.gitRoot;
        await writeTerminalFile(`${base}/.git/config`, JSON.stringify(payload, null, 2), "application/json");
        await writeTerminalFile(`${base}/.git/HEAD`, `ref: refs/heads/${payload.branch || "main"}\n`, "text/plain");
        return { ...payload, gitRoot };
    }
};

function getCliConfigInfo(bin) {
    const user = currentUser || "guest";
    const userHome = userDirMap[user]?.home || (user === "root" ? "/root" : `/home/${user}`);
    if (bin === "codex") {
        return {
            dir: `${userHome}/.codex`,
            authFile: `${userHome}/.codex/auth.json`,
            configFile: `${userHome}/.codex/config.toml`,
            envVar: "OPENAI_API_KEY",
            provider: "ChatGPT Subscription",
            authUrl: "https://chatgpt.com/auth",
            defaultModel: "o3"
        };
    }
    if (bin === "agy") {
        return {
            dir: `${userHome}/.config/antigravity`,
            authFile: `${userHome}/.config/antigravity/credentials.json`,
            configFile: `${userHome}/.gemini/antigravity-cli/settings.json`,
            envVar: "GEMINI_API_KEY",
            provider: "Google AI Pro",
            authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
            defaultModel: "gemini-3.8-flash-high"
        };
    }
    if (bin === "claude") {
        return {
            dir: `${userHome}/.claude`,
            authFile: `${userHome}/.claude.json`,
            configFile: `${userHome}/.claude.json`,
            envVar: "ANTHROPIC_API_KEY",
            provider: "Claude.ai Subscription",
            authUrl: "https://claude.ai/oauth/authorize",
            defaultModel: "claude-sonnet-4-6"
        };
    }
    if (bin === "gemini") {
        return {
            dir: `${userHome}/.gemini`,
            authFile: `${userHome}/.gemini/oauth_creds.json`,
            configFile: `${userHome}/.gemini/settings.json`,
            envVar: "GEMINI_API_KEY",
            provider: "Google AI Pro",
            authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
            defaultModel: "gemini-3.8-flash-high"
        };
    }
    if (bin === "xai") {
        return {
            dir: `${userHome}/.config/xai`,
            authFile: `${userHome}/.config/xai/config.json`,
            configFile: `${userHome}/.config/xai/config.json`,
            envVar: "XAI_API_KEY",
            provider: "xAI Console",
            authUrl: "https://x.ai/build",
            defaultModel: "grok-3-coder"
        };
    }
    return {
        dir: `${userHome}/.${bin}`,
        authFile: `${userHome}/.${bin}/auth.json`,
        configFile: `${userHome}/.${bin}/config.json`,
        envVar: `${bin.toUpperCase()}_API_KEY`,
        provider: "Developer Account",
        authUrl: "https://os.bl4ut0.dev/",
        defaultModel: "default"
    };
}

async function loadCliSession(binMeta) {
    const config = getCliConfigInfo(binMeta.bin);
    if (cliAuthSessions.has(binMeta.bin)) {
        const cached = cliAuthSessions.get(binMeta.bin);
        cached.account = normalizeCliAccountName(cached.account, binMeta.bin);
        if (binMeta.bin === "agy" && (!cached.model || cached.model === "gemini-2.5-pro-agy")) {
            cached.model = "gemini-3.8-flash-high";
        }
        return cached;
    }

    // 1. Check if environment variable is set in the virtual Linux shell
    if (shellEnv[config.envVar]) {
        const envSession = {
            bin: binMeta.bin,
            name: binMeta.name,
            version: binMeta.version,
            provider: `${config.envVar} (Environment)`,
            account: resolveActiveUserEmail(binMeta.bin),
            model: config.defaultModel,
            source: "env"
        };
        cliAuthSessions.set(binMeta.bin, envSession);
        return envSession;
    }

    // 2. Check SystemFS native dotfiles in user's home directory
    try {
        const record = await window.SystemFS.readFile(config.authFile);
        if (record && record.data) {
            const parsed = typeof record.data === "string" ? JSON.parse(record.data) : record.data;
            const rawModel = parsed.model || config.defaultModel;
            const normalizedModel = (binMeta.bin === "agy" && rawModel === "gemini-2.5-pro-agy")
                ? "gemini-3.8-flash-high"
                : rawModel;
            const normalizedAccount = normalizeCliAccountName(parsed.account || parsed.email || parsed.emailAddress, binMeta.bin);
            const normalizedProvider = (binMeta.bin === "agy" && (!parsed.provider || parsed.provider === "Google Account OAuth"))
                ? "Google AI Pro"
                : (parsed.provider || config.provider);
            const session = {
                bin: binMeta.bin,
                name: binMeta.name,
                version: binMeta.version,
                provider: normalizedProvider,
                account: normalizedAccount,
                model: normalizedModel,
                effort: parsed.effort || "high",
                source: "systemfs",
                authenticatedAt: parsed.authenticated_at || parsed.authenticatedAt || new Date().toISOString()
            };
            cliAuthSessions.set(binMeta.bin, session);
            if (parsed.account !== normalizedAccount || parsed.model !== normalizedModel) {
                try { await saveCliSession(binMeta, session); } catch (_) {}
            }
            return session;
        }
    } catch (_) {}

    // 3. Auto-provision session in the PortfoliOS Virtual Linux Environment
    if (["agy", "gemini", "claude", "codex"].includes(binMeta.bin)) {
        const detectedEmail = resolveActiveUserEmail(binMeta.bin);
        if (detectedEmail) {
            const autoSession = {
                bin: binMeta.bin,
                name: binMeta.name,
                version: binMeta.version,
                provider: config.provider,
                account: detectedEmail,
                model: config.defaultModel,
                effort: "high",
                authMode: "oauth",
                trustedDirs: ["/", "/home", "/documents", "/workspace", "/tmp", currentDir],
                authenticatedAt: new Date().toISOString()
            };
            try { await saveCliSession(binMeta, autoSession); } catch (_) {}
            return autoSession;
        }
    }

    return null;
}

async function saveCliSession(binMeta, session) {
    const config = getCliConfigInfo(binMeta.bin);
    session.account = normalizeCliAccountName(session.account, binMeta.bin);
    await window.SystemFS.ensureDirectory?.(config.dir, { silent: true });
    await writeTerminalFile(config.authFile, JSON.stringify(session, null, 2), "application/json");

    if (binMeta.bin === "codex") {
        await writeTerminalFile(
            config.configFile,
            `model = "${session.model || config.defaultModel}"\napproval_policy = "never"\nsandbox_mode = "workspace-write"\n`,
            "text/plain"
        );
    } else if (binMeta.bin === "agy" || binMeta.bin === "gemini") {
        const parentDir = window.SystemFS.getParentPath(config.configFile);
        await window.SystemFS.ensureDirectory?.(parentDir, { silent: true });
        await writeTerminalFile(
            config.configFile,
            JSON.stringify({
                model: session.model || config.defaultModel,
                effort: session.effort || "high",
                permission_mode: "always-proceed",
                trusted_directories: ["/", "/home", "/documents", "/workspace", "/tmp", currentDir]
            }, null, 2),
            "application/json"
        );
    }

    // Structured Vault Integration
    const providerMap = { codex: "openai", agy: "google", gemini: "google", claude: "anthropic", xai: "xai", grok: "xai", gh: "github", github: "github" };
    const vaultProvider = providerMap[binMeta.bin] || binMeta.bin;
    const vaultTokenRec = {
        provider: vaultProvider,
        bin: binMeta.bin,
        accessToken: session.apiKey || session.accessToken || `oauth-${binMeta.bin}-${Date.now()}`,
        account: session.account,
        authMode: session.authMode,
        updatedAt: Date.now()
    };

    try {
        await window.SystemFS.ensureDirectory?.("/etc/portfolios/vault", { silent: true });
        await writeTerminalFile(`/etc/portfolios/vault/${vaultProvider}.json`, JSON.stringify(vaultTokenRec, null, 2), "application/json");
    } catch (_) {}

    if (window.PortfoliOSRuntimeBridge && typeof window.PortfoliOSRuntimeBridge.getOrCreateSession === "function") {
        try {
            const rtSession = await window.PortfoliOSRuntimeBridge.getOrCreateSession();
            if (rtSession?.vault && typeof rtSession.vault.saveToken === "function") {
                await rtSession.vault.saveToken(vaultProvider, vaultTokenRec);
            }
        } catch (_) {}
    }

    cliAuthSessions.set(binMeta.bin, session);
    return session;
}

async function removeCliSession(binMeta) {
    cliAuthSessions.delete(binMeta.bin);
    const config = getCliConfigInfo(binMeta.bin);
    try {
        await window.SystemFS.deleteFile(config.authFile);
    } catch (_) {}

    const providerMap = { codex: "openai", agy: "google", gemini: "google", claude: "anthropic", xai: "xai", grok: "xai", gh: "github", github: "github" };
    const vaultProvider = providerMap[binMeta.bin] || binMeta.bin;
    try {
        await window.SystemFS.deleteFile(`/etc/portfolios/vault/${vaultProvider}.json`);
    } catch (_) {}
}

window.showTerminalAuthBanner = function(meta) {
    activeAuthMeta = meta;
    for (const el of document.querySelectorAll("[data-term-auth]")) {
        el.style.display = "flex";
        const textEl = el.querySelector("[data-term-auth-text]");
        if (textEl) {
            textEl.textContent = `${meta.name}: Sign in with ${meta.provider}`;
        }
    }
};

window.hideTerminalAuthBanner = function() {
    activeAuthMeta = null;
    for (const el of document.querySelectorAll("[data-term-auth]")) {
        el.style.display = "none";
    }
};

window.completePendingCliAuth = async function(providerArg = false) {
    if (!activeAuthMeta) return false;
    const meta = activeAuthMeta;
    const config = getCliConfigInfo(meta.bin);
    const account = resolveActiveUserEmail(meta.bin);
    const session = {
        bin: meta.bin,
        name: meta.name,
        version: meta.version,
        provider: meta.provider,
        account,
        model: meta.defaultModel || config.defaultModel || "default",
        authMode: "oauth",
        authenticatedAt: new Date().toISOString()
    };
    await saveCliSession(meta, session);
    window.hideTerminalAuthBanner();
    window.addTerminalLine(`✓ Authenticated ${meta.name} via ${meta.provider} (${account}).`, "success");
    if (activePrompt && typeof activePrompt.callback === "function") {
        const cb = activePrompt.callback;
        activePrompt = null;
        for (const el of getTerminalInputElements()) el.type = "text";
        updatePrompt();
        cb("1");
    }
    return true;
};

async function startCliNativeAuth(meta, options = {}) {
    const config = getCliConfigInfo(meta.bin);

    const finishAuth = async (authMode, accountName, keyVal = null) => {
        const cleanAccount = normalizeCliAccountName(accountName, meta.bin);
        const session = {
            bin: meta.bin,
            name: meta.name,
            version: meta.version,
            provider: authMode === "api_key" ? `${config.envVar} Key` : (meta.provider || config.provider),
            account: cleanAccount,
            model: meta.defaultModel || config.defaultModel || "default",
            effort: "high",
            authMode,
            trustedDirs: ["/", "/home", "/documents", "/workspace", "/tmp", currentDir],
            authenticatedAt: new Date().toISOString()
        };
        if (keyVal) {
            session.apiKey = keyVal;
            shellEnv[config.envVar] = keyVal;
        }
        await saveCliSession(meta, session);
        window.hideTerminalAuthBanner();
        if (meta.bin !== "agy") {
            window.addTerminalLine(`✓ Authenticated ${meta.name} (${session.provider} · ${session.account}).`, "success");
        }
        if (typeof options.onComplete === "function") {
            await options.onComplete(session);
        }
        return session;
    };

    if (options.autoComplete) {
        return await finishAuth("oauth", resolveActiveUserEmail(meta.bin));
    }

    if (options.forceApiKey) {
        promptUser(`Enter ${config.envVar}: `, true, async (keyVal) => {
            const rawKey = String(keyVal || "").trim();
            if (!rawKey || rawKey.toLowerCase() === "cancel") {
                window.addTerminalLine(`${meta.bin}: authentication cancelled.`, "muted");
                updatePrompt();
                return;
            }
            await finishAuth("api_key", resolveActiveUserEmail(meta.bin), rawKey);
        });
        return "";
    }

    if (["agy", "gemini", "claude", "codex"].includes(meta.bin) && !options.forceReauth) {
        const detectedEmail = resolveActiveUserEmail(meta.bin);
        if (detectedEmail) {
            return await finishAuth("oauth", detectedEmail);
        }
    }

    window.showTerminalAuthBanner(meta);
    if (meta.bin === "agy") {
        window.addTerminalLine("Welcome to the Antigravity CLI. You are currently not signed in.\nSigning in...", "info");
    } else {
        const boxLines = [
            `╭─ ${meta.name} (v${meta.version}) ───────────────────────────────────────╮`,
            `│ Welcome to ${meta.name}!                                                │`,
            `│ Authenticate to start interactive session in ${currentDir}:             │`,
            `│   [1] Sign in with ${meta.provider.padEnd(51)} │`,
            `│   [2] Enter API Key (${config.envVar.padEnd(46)}) │`,
            `╰────────────────────────────────────────────────────────────────────────╯`,
            `Select option [1-2, or 'cancel']: `
        ];
        window.addTerminalLine(boxLines.join("\n"), "info");
    }

    promptUser(`[${meta.bin} login]> `, false, async (val) => {
        window.hideTerminalAuthBanner();
        const input = String(val || "").trim();
        const lower = input.toLowerCase();

        if (lower === "cancel" || lower === "abort" || lower === "exit" || lower === "q") {
            window.addTerminalLine(`${meta.bin}: authentication cancelled.`, "muted");
            updatePrompt();
            return;
        }

        if (lower === "2" || lower === "api" || lower === "key" || input.startsWith("sk-") || input.startsWith("AIza") || input.startsWith("xai-")) {
            if (input.startsWith("sk-") || input.startsWith("AIza") || input.startsWith("xai-")) {
                await finishAuth("api_key", resolveActiveUserEmail(meta.bin), input);
                return;
            }
            promptUser(`Enter ${config.envVar}: `, true, async (keyVal) => {
                const rawKey = String(keyVal || "").trim();
                if (!rawKey || rawKey.toLowerCase() === "cancel") {
                    window.addTerminalLine(`${meta.bin}: authentication cancelled.`, "muted");
                    updatePrompt();
                    return;
                }
                await finishAuth("api_key", resolveActiveUserEmail(meta.bin), rawKey);
            });
            return;
        }

        await finishAuth("oauth", resolveActiveUserEmail(meta.bin));
    });
    return "";
}



async function handleActiveCliSessionInput(rawInput) {
    if (!activeCliSession) return null;
    const trimmed = String(rawInput || "").trim();
    if (!trimmed) return "";

    if (trimmed === "exit" || trimmed === "quit" || trimmed === "/exit" || trimmed === "/quit") {
        const exitedName = activeCliSession.name || activeCliSession.bin;
        activeCliSession = null;
        updatePrompt();
        return `Exited ${exitedName} session.`;
    }

    if (trimmed === "/clear" || trimmed === "clear") {
        for (const container of getTerminalOutputContainers()) container.innerHTML = "";
        terminalLineBuffer.length = 0;
        return "";
    }

    if (trimmed.startsWith("!")) {
        const shellCmd = trimmed.slice(1).trim();
        if (!shellCmd) return "";
        return await runCommandLine(shellCmd);
    }

    if (trimmed === "?" || trimmed === "/help" || trimmed === "help") {
        return [
            `${activeCliSession.name || activeCliSession.bin} interactive session:`,
            "  <input>     Send input to running PTY process",
            "  !<command>  Execute shell command (e.g. !ls, !pwd)",
            "  clear       Clear screen",
            "  exit        Exit back to shell"
        ].join("\n");
    }

    // Forward stdin to runtime bridge PTY input stream
    const profileId = window.state?.currentUserId || (currentUser !== "guest" ? currentUser : (window.getCurrentUser?.()?.id || "guest"));
    if (window.PortfoliOSRuntimeBridge && typeof window.PortfoliOSRuntimeBridge.sendInput === "function") {
        window.PortfoliOSRuntimeBridge.sendInput(trimmed + "\n", profileId);
        return "";
    }

    return "";
}

async function executeInstalledCliBinary(binMeta, args = []) {
    const profileId = window.state?.currentUserId || (currentUser !== "guest" ? currentUser : (window.getCurrentUser?.()?.id || "guest"));
    const cmd = binMeta.path || `/usr/local/bin/${binMeta.bin}` || binMeta.bin;
    const sub = (args[0] || "").toLowerCase();
    const config = getCliConfigInfo(binMeta.bin);
    const latestVer = await resolveLatestUpstreamCliVersion(binMeta);
    binMeta.version = latestVer || binMeta.version;

    if (sub === "--version" || sub === "-v" || sub === "-V" || sub === "version") {
        if (binMeta.bin === "agy") {
            return binMeta.version || "1.5.5";
        }
        return `${binMeta.name} v${binMeta.version}`;
    }

    if (sub === "update" || sub === "upgrade") {
        latestCliVersionCache.delete(binMeta.bin);
        const updatedVer = await resolveLatestUpstreamCliVersion(binMeta);
        binMeta.version = updatedVer;
        await installCliBinaryToSystemFS(binMeta, "update");
        return `✓ Updated ${binMeta.name} (${binMeta.pkg}) to latest release v${updatedVer} in /usr/local/bin/${binMeta.bin}.`;
    }

    if (sub === "doctor") {
        const repoCfg = await window.PortfoliOSGitBridge.readRepoConfig(currentDir);
        return [
            `${binMeta.name} v${binMeta.version} Health Check:`,
            `  ✓ Binary path:        /usr/local/bin/${binMeta.bin} (WASI container engine)`,
            `  ✓ Upstream channel:   ${binMeta.pkg}@${binMeta.version} (latest)`,
            `  ✓ VFS mount root:     / (full SystemFS access across /, /home, /usr/local/bin, /etc, /tmp, /documents)`,
            `  ✓ Git repository:     ${repoCfg?.slug ? `${repoCfg.slug} (${repoCfg.remoteUrl})` : "No Git remote in currentDir (use 'git clone <url>' or 'git remote add origin <url>')"}`,
            `  ✓ PTY stream:         Live terminal input/output wired`
        ].join("\n");
    }

    if (sub === "logout" || (sub === "auth" && (args[1] || "").toLowerCase() === "logout")) {
        await removeCliSession(binMeta);
        return `✓ Logged out of ${binMeta.name}. Removed ${config.authFile}.`;
    }

    if (sub === "login" || sub === "auth") {
        const isWithKey = args.some(a => a === "--with-api-key" || a === "--with-key");
        return await startCliNativeAuth(binMeta, { forceApiKey: isWithKey, forceReauth: true });
    }

    if (sub === "status" || (sub === "auth" && (args[1] || "").toLowerCase() === "status") || (sub === "login" && (args[1] || "").toLowerCase() === "status")) {
        const session = await loadCliSession(binMeta);
        const hasAuthFile = Boolean(await window.SystemFS?.readFile?.(config.authFile));
        const repoCfg = await window.PortfoliOSGitBridge.readRepoConfig(currentDir);
        return [
            `${binMeta.name} (${binMeta.bin}) v${binMeta.version}`,
            `  Runtime:      PortfoliOS Container Runtime (mount: /)`,
            `  Git Remote:   ${repoCfg?.slug ? `${repoCfg.slug} (${repoCfg.remoteUrl})` : "None (run 'git clone <url>' or 'git remote add origin <url>')"}`,
            `  Status:       ${session ? `Authenticated (${session.provider} · ${session.account})` : "Not authenticated"}`,
            `  Workspace:    ${currentDir} (Auto-Trusted)`,
            `  Auth File:    ${config.authFile} [${hasAuthFile ? "exists" : "missing"}]`,
            `  Model:        ${session?.model || binMeta.defaultModel || config.defaultModel}`
        ].join("\n");
    }

    if (sub === "--help" || sub === "-h" || sub === "help") {
        return [
            `${binMeta.name} (${binMeta.bin}) v${binMeta.version}`,
            `Usage: ${binMeta.bin} [options] [command] [args...]`,
            "",
            "Options:",
            "  -v, --version                   Print binary version",
            "  -h, --help                      Print help message",
            "",
            "Subcommands:",
            `  ${(binMeta.bin + " doctor").padEnd(24)} Check installation, workspace, and PTY status`,
            `  ${(binMeta.bin + " update").padEnd(24)} Update ${binMeta.bin} to latest release`,
            `  ${(binMeta.bin + " login / logout").padEnd(24)} Manage authentication credentials`,
            `  ${(binMeta.bin + " status").padEnd(24)} Show current auth and runtime state`
        ].join("\n");
    }

    if (binMeta.customScript && !binMeta.provider && (!window.PortfoliOSRuntimeBridge || typeof window.PortfoliOSRuntimeBridge.runProcess !== "function")) {
        return await runShellScript([binMeta.path], binMeta.customScript);
    }

    // Set interactive activeCliSession if starting an interactive session (no args)
    if (!args || args.length === 0) {
        activeCliSession = {
            bin: binMeta.bin,
            name: binMeta.name,
            version: binMeta.version,
            cwd: currentDir
        };
        updatePrompt();
    }

    // Route execution to PortfoliOSRuntimeBridge.runProcess with real PTY input/output streams and root /
    if (window.PortfoliOSRuntimeBridge && typeof window.PortfoliOSRuntimeBridge.runProcess === "function") {
        try {
            await window.PortfoliOSRuntimeBridge.runProcess({
                profileId,
                cmd: binMeta.bin || cmd,
                args: args || [],
                onOutput: (chunk) => {}
            });
            return "";
        } catch (err) {
            if (activeCliSession && (!args || args.length === 0)) {
                activeCliSession = null;
                updatePrompt();
            }
            return `runtime-bridge: ${err.message}`;
        }
    }

    if (binMeta.customScript) {
        return await runShellScript([cmd, ...(args || [])], binMeta.customScript);
    }

    return `bash: ${binMeta.bin}: PortfoliOS Runtime Bridge unavailable.`;
}

// Linux Core Utilities
async function runHead(args, stdin) {
    let linesCount = 10;
    const files = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "-n" && args[i + 1]) {
            linesCount = Math.max(1, parseInt(args[++i], 10) || 10);
        } else if (/^-\d+$/.test(args[i])) {
            linesCount = Math.max(1, parseInt(args[i].slice(1), 10) || 10);
        } else if (!args[i].startsWith("-")) {
            files.push(args[i]);
        }
    }
    const content = files[0] ? await runCat(files[0]) : (stdin ?? "");
    if (files[0] && String(content).startsWith("cat: ")) return content.replace(/^cat:/, "head:");
    return String(content).split("\n").slice(0, linesCount).join("\n");
}

async function runTail(args, stdin) {
    let linesCount = 10;
    const files = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "-n" && args[i + 1]) {
            linesCount = Math.max(1, parseInt(args[++i], 10) || 10);
        } else if (/^-\d+$/.test(args[i])) {
            linesCount = Math.max(1, parseInt(args[i].slice(1), 10) || 10);
        } else if (!args[i].startsWith("-")) {
            files.push(args[i]);
        }
    }
    const content = files[0] ? await runCat(files[0]) : (stdin ?? "");
    if (files[0] && String(content).startsWith("cat: ")) return content.replace(/^cat:/, "tail:");
    const lines = String(content).split("\n");
    return lines.slice(Math.max(0, lines.length - linesCount)).join("\n");
}

async function runWc(args, stdin) {
    const flags = args.filter(a => a.startsWith("-")).join("");
    const files = args.filter(a => !a.startsWith("-"));
    const content = files[0] ? await runCat(files[0]) : (stdin ?? "");
    if (files[0] && String(content).startsWith("cat: ")) return content.replace(/^cat:/, "wc:");
    const text = String(content);
    const lines = text ? text.split("\n").length : 0;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const bytes = text.length;
    if (flags.includes("l") && !flags.includes("w") && !flags.includes("c")) return `${lines}${files[0] ? " " + files[0] : ""}`;
    return `  ${lines}  ${words} ${bytes}${files[0] ? " " + files[0] : ""}`;
}

async function runSort(args, stdin) {
    const reverse = args.some(a => a === "-r" || a === "--reverse");
    const files = args.filter(a => !a.startsWith("-"));
    const content = files[0] ? await runCat(files[0]) : (stdin ?? "");
    if (files[0] && String(content).startsWith("cat: ")) return content.replace(/^cat:/, "sort:");
    const sorted = String(content).split("\n").sort((a, b) => a.localeCompare(b));
    if (reverse) sorted.reverse();
    return sorted.join("\n");
}

async function runUniq(args, stdin) {
    const files = args.filter(a => !a.startsWith("-"));
    const content = files[0] ? await runCat(files[0]) : (stdin ?? "");
    if (files[0] && String(content).startsWith("cat: ")) return content.replace(/^cat:/, "uniq:");
    const lines = String(content).split("\n");
    const out = [];
    for (const line of lines) {
        if (!out.length || out[out.length - 1] !== line) out.push(line);
    }
    return out.join("\n");
}

async function runFind(args) {
    let startDir = currentDir;
    let nameFilter = null;
    for (let i = 0; i < args.length; i++) {
        if ((args[i] === "-name" || args[i] === "-iname") && args[i + 1]) {
            nameFilter = args[++i];
        } else if (!args[i].startsWith("-")) {
            startDir = resolvePath(args[i]);
        }
    }
    const allFiles = (await window.SystemFS.getAllFiles?.()) || [];
    const prefix = startDir === "/" ? "/" : startDir + "/";
    const regex = nameFilter
        ? new RegExp("^" + nameFilter.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i")
        : null;
    const matches = allFiles
        .filter(f => !isProtectedSystemPath(f.path))
        .filter(f => f.path === startDir || f.path.startsWith(prefix))
        .filter(f => !regex || regex.test(f.name))
        .map(f => f.path)
        .sort();
    return matches.length ? matches.join("\n") : startDir;
}

async function runTree(args) {
    const targetDir = args[0] && !args[0].startsWith("-") ? resolvePath(args[0]) : currentDir;
    const items = (await window.SystemFS.readDir(targetDir)) || [];
    const lines = [targetDir];
    items.forEach((item, idx) => {
        const branch = idx === items.length - 1 ? "└── " : "├── ";
        lines.push(`${branch}${item.name}${item.isDirectory ? "/" : ""}`);
    });
    lines.push(`\n${items.filter(i => i.isDirectory).length} directories, ${items.filter(i => !i.isDirectory).length} files`);
    return lines.join("\n");
}

async function runStat(args) {
    if (!args[0]) return "stat: missing operand";
    const resolved = resolvePath(args[0]);
    const rec = await getFileRecord(resolved);
    if (!rec) return `stat: cannot statx '${args[0]}': No such file or directory`;
    return [
        `  File: ${rec.path}`,
        `  Size: ${rec.size || 0}\t\tFileType: ${rec.isDirectory ? "directory" : (rec.type || "regular file")}`,
        `Access: (${rec.isDirectory ? "0755/drwxr-xr-x" : (rec.metadata?.executable ? "0755/-rwxr-xr-x" : "0644/-rw-r--r--")})  Uid: ( 1000/ ${currentUser})   Gid: ( 1000/ ${currentUser})`,
        `Modify: ${new Date(rec.lastModified || Date.now()).toISOString()}`
    ].join("\n");
}

async function runDf() {
    const allFiles = (await window.SystemFS.getAllFiles?.()) || [];
    const usedBytes = allFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    const usedKb = Math.max(128, Math.ceil(usedBytes / 1024));
    const totalKb = 4194304;
    const availKb = totalKb - usedKb;
    return [
        "Filesystem      Size  Used Avail Use% Mounted on",
        `systemfs        4.0G  ${formatBytes(usedBytes).padStart(4)}  ${(availKb / 1048576).toFixed(1)}G   1% /`,
        "tmpfs           2.0G     0  2.0G   0% /tmp",
        "localstorage     10M  128K  9.9M   2% /var/local/storage"
    ].join("\n");
}

function runFree() {
    return [
        "               total        used        free      shared  buff/cache   available",
        "Mem:         8388608     1142800     6291456       65536      954352     7130316",
        "Swap:              0           0           0"
    ].join("\n");
}

function runPs() {
    const openApps = window.state?.openApps ? Array.from(window.state.openApps) : [];
    const lines = [
        "  PID TTY          TIME CMD",
        "    1 ?        00:00:01 systemd --system --portfolios-kernel",
        "   42 ?        00:00:00 portfolios-interchange-d",
        "  101 pts/0    00:00:00 bash"
    ];
    openApps.forEach((appId, idx) => {
        lines.push(`${String(200 + idx).padStart(5)} pts/0    00:00:00 portfolios-app [${appId}]`);
    });
    if (activeCliSession) {
        lines.push(`  399 pts/0    00:00:00 ${activeCliSession.bin}`);
    }
    return lines.join("\n");
}

function runNeofetch() {
    const upSec = Math.max(1, Math.floor((Date.now() - bootTimestamp) / 1000));
    const upMin = Math.floor(upSec / 60);
    const openApps = window.state?.openApps ? Array.from(window.state.openApps) : [];
    const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 8;
    return [
        `       _..._           ${getDisplayUser(currentUser)}@portfoliOS`,
        "     .'     '.         -------------------",
        "    /  _   _  \\        OS: PortfoliOS GNU/Linux 12 (bookworm-wasm64) x86_64",
        "   |  (o) (o)  |       Host: PortfoliOS Hybrid Web Desktop & Mobile Runtime",
        "   |   _____   |       Kernel: 6.6.0-wasm64-portfolios",
        `    \\  '---'  /        Uptime: ${upMin} mins, ${upSec % 60} secs`,
        `     '._____.'         Packages: ${INTERCHANGE_PACKAGE_CATALOG.length + (window.storeApps?.length || 24)} (apt, npm, interchange)`,
        "                       Shell: bash 5.2.15",
        `                       WM: PortfoliOS WindowManager (${openApps.length} active)`,
        `                       Theme: ${window.state?.themeId || "dark"}`,
        `                       CPU: PortfoliOS Virtual x86_64 (${cores}) @ 3.60GHz`,
        "                       Memory: 1116MiB / 8192MiB"
    ].join("\n");
}

function createTerminalAsyncJob(spec) {
    return {
        __terminalAsyncJob: true,
        ...spec
    };
}

function isTerminalAsyncJob(value) {
    return Boolean(value && typeof value === "object" && value.__terminalAsyncJob);
}

function createLocalAIChatJob(question, context = {}) {
    return createTerminalAsyncJob({
        kind: "local-ai",
        label: `Local AI thinking (${window.LocalAI?.getStatus?.().modelLabel || "local model"})... Run 'jobs' or 'ai cancel' to manage.`,
        cancel: () => window.LocalAI?.cancelGeneration?.("cli"),
        run: (job) => window.LocalAI.chat(question, {
            ...context,
            onProgress: (partialText) => {
                if (!job.outputLine && partialText) {
                    job.outputLine = createTerminalLineElement("", "ai-response");
                    for (const container of getTerminalOutputContainers()) {
                        container.appendChild(job.outputLine.cloneNode(true));
                    }
                }
                if (job.outputLine) {
                    job.outputLine.textContent = partialText;
                }
            }
        })
    });
}

function getTerminalJob(jobId) {
    const normalizedId = Number.parseInt(String(jobId || "").replace(/^%/, ""), 10);
    if (Number.isFinite(normalizedId)) return terminalJobs.get(normalizedId) || null;
    return [...terminalJobs.values()].reverse().find((job) => job.status === "running" || job.status === "cancelling") || null;
}

function formatTerminalJobs() {
    const jobs = [...terminalJobs.values()];
    if (!jobs.length) return "No active background jobs.";

    return jobs.map((job) => {
        const elapsedSeconds = Math.max(0, Math.round((Date.now() - job.startedAt) / 1000));
        return `[${job.id}] ${job.status.padEnd(10)} ${job.kind} (${elapsedSeconds}s)`;
    }).join("\n");
}

async function cancelTerminalJob(jobId) {
    const job = getTerminalJob(jobId);
    if (!job) {
        if (!jobId && window.LocalAI?.getStatus?.().status === "generating") {
            const cancelled = await window.LocalAI.cancelGeneration?.("cli");
            return cancelled ? "Local AI cancellation requested." : "The AI response had already finished.";
        }
        return jobId ? `kill: job ${jobId} was not found` : "No cancellable background job is running.";
    }
    if (typeof job.cancel !== "function") {
        return `[job ${job.id}] does not support cancellation.`;
    }

    job.cancelRequested = true;
    job.status = "cancelling";
    if (job.statusLine) job.statusLine.textContent = `[job ${job.id}] Cancelling Local AI response...`;
    const cancelled = await job.cancel();
    return cancelled === false
        ? `[job ${job.id}] had already finished.`
        : `[job ${job.id}] cancellation requested.`;
}

async function startTerminalAsyncJob(job, targetFile, append) {
    const jobId = ++terminalJobId;
    const statusLine = window.addTerminalLine(`[job ${jobId}] ${job.label}`, "muted");
    const jobRecord = {
        id: jobId,
        kind: job.kind || "task",
        status: "running",
        startedAt: Date.now(),
        statusLine,
        outputLine: null,
        cancelRequested: false,
        cancel: job.cancel
    };
    terminalJobs.set(jobId, jobRecord);

    try {
        const result = await job.run(jobRecord);
        const finalText = typeof result === "string" ? result : (result?.text || "");
        if (result?.cancelled || jobRecord.cancelRequested) {
            jobRecord.status = "cancelled";
            if (statusLine) statusLine.textContent = `[job ${jobId}] Cancelled.`;
            return;
        }
        jobRecord.status = "completed";
        if (statusLine) statusLine.textContent = `[job ${jobId}] Completed.`;
        if (targetFile) {
            await handleRedirection(targetFile, finalText, append);
        } else if (finalText) {
            window.addTerminalLine(finalText, "ai-response");
        }
    } catch (error) {
        jobRecord.status = "failed";
        const message = error?.message || "Local AI failed.";
        if (statusLine) {
            statusLine.textContent = `[job ${jobId}] Local AI failed: ${message}`;
        } else {
            window.addTerminalLine(`[job ${jobId}] Local AI failed: ${message}`, "muted");
        }
    } finally {
        terminalJobs.delete(jobId);
    }
}

function getLocalAICapabilitiesText() {
    return [
        "Local AI CLI controls:",
        "  ai status             show service, model, and runtime state",
        "  ai models             list available local/cloud models",
        "  ai use <name|number>  select a model (stops the current loaded model)",
        "  ai on                 enable the selected model",
        "  ai cancel             cancel the active answer but keep the model loaded",
        "  ai off                stop the service and release the model",
        "  ai settings           open Settings > Local AI",
        "  ai <question>         ask in a background job",
        "  jobs                  list active background jobs",
        "  kill [%job]           cancel a background job"
    ].join("\n");
}

function isCliCapabilitiesQuestion(value) {
    const text = String(value || "").toLowerCase();
    return /what can you do|what.*commands|available commands|(?:cli|terminal).*(?:help|capabilit)|capabilit.*(?:cli|terminal)/.test(text);
}

function formatLocalAIStatus() {
    const status = window.LocalAI.getStatus();
    const lines = [
        `State:   ${status.status}`,
        `Model:   ${status.modelLabel}`,
        `Runtime: ${status.executionMode}`,
        `Detail:  ${status.statusText}`
    ];
    if (status.memoryMB) lines.splice(3, 0, `Memory:  ~${status.memoryMB} MB`);
    if (status.modelNote) lines.push(`Note:    ${status.modelNote}`);
    if (status.status === "generating") lines.push("Control: ai cancel");
    return lines.join("\n");
}

function getLocalAIModelsText() {
    const models = window.LocalAI.getAvailableModels?.() || [];
    const selectedId = window.LocalAI.getSelectedModelId?.();
    if (!models.length) return "No AI models are available in this profile.";

    return models.map((model, index) => {
        const marker = model.id === selectedId ? "*" : " ";
        const runtime = model.type?.startsWith("cloud-") ? "cloud" : `${model.memoryMB} MB`;
        return `${marker} ${String(index + 1).padStart(2)}  ${model.label} [${runtime}]`;
    }).join("\n") + "\nUse: ai use <number or model name>";
}

function normalizeAIModelSearch(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/q\d+f\d+(?:_\d+)?/g, " ")
        .replace(/\bmlc\b/g, " ")
        .replace(/[^a-z0-9.]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function resolveLocalAIModel(query) {
    const models = window.LocalAI.getAvailableModels?.() || [];
    const rawQuery = String(query || "").trim();
    const numericIndex = Number.parseInt(rawQuery, 10);
    if (/^\d+$/.test(rawQuery) && models[numericIndex - 1]) {
        return { model: models[numericIndex - 1], matches: [] };
    }

    const aliases = {
        "smol 360m": "SmolLM2-360M-Instruct-q4f16_1-MLC",
        "smollm2 360m": "SmolLM2-360M-Instruct-q4f16_1-MLC",
        "qwen 0.5b": "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
        "llama 1b": "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        "gemma 1b": "gemma-3-1b-it-q4f16_1-MLC",
    };
    const normalizedQuery = normalizeAIModelSearch(rawQuery);
    const aliasId = aliases[normalizedQuery];
    const exact = models.find((model) => model.id.toLowerCase() === rawQuery.toLowerCase())
        || models.find((model) => normalizeAIModelSearch(model.label) === normalizedQuery)
        || models.find((model) => model.id === aliasId);
    if (exact) return { model: exact, matches: [] };

    const matches = models.filter((model) => {
        const searchable = `${normalizeAIModelSearch(model.label)} ${normalizeAIModelSearch(model.id)}`;
        return normalizedQuery && searchable.includes(normalizedQuery);
    });
    return { model: matches.length === 1 ? matches[0] : null, matches };
}

async function runLocalAICommand(args) {
    if (!window.LocalAI) {
        return "Local AI service is unavailable.";
    }

    const subcommand = (args[0] || "").toLowerCase();
    if (!subcommand || subcommand === "status" || subcommand === "info") return formatLocalAIStatus();

    if (subcommand === "help" || subcommand === "commands" || subcommand === "capabilities") {
        return getLocalAICapabilitiesText();
    }

    if (subcommand === "models" || subcommand === "list") return getLocalAIModelsText();

    if (subcommand === "settings" || subcommand === "config" || subcommand === "configure") {
        if (window.openDesktopWindow) {
            await Promise.resolve(window.openDesktopWindow("settings"));
            window.openSettingsPanel?.("local-ai");
        }
        return "Opened Settings > Local AI.";
    }

    if (subcommand === "use" || subcommand === "model") {
        const query = args.slice(1).join(" ");
        if (!query) return "Usage: ai use <model number or name>. Run 'ai models' first.";
        const status = window.LocalAI.getStatus();
        if (status.busy) return "Local AI is busy. Run 'ai cancel' before changing models.";

        const resolved = resolveLocalAIModel(query);
        if (!resolved.model) {
            if (resolved.matches.length > 1) {
                return `Model name is ambiguous: ${resolved.matches.map((model) => model.label).join(", ")}`;
            }
            return `No available AI model matched "${query}". Run 'ai models' to list choices.`;
        }

        const nextStatus = window.LocalAI.setSelectedModelId(resolved.model.id);
        return `Selected ${nextStatus.modelLabel}. Run 'ai on' to enable it.`;
    }

    if (subcommand === "on" || subcommand === "enable" || subcommand === "start") {
        const status = window.LocalAI.getStatus();
        if (status.status === "generating") return "Local AI is already enabled and answering. Run 'ai cancel' to interrupt it.";
        if (status.ready) return `${status.modelLabel} is already ready.`;
        const nextStatus = await window.LocalAI.enable("Portfolio CLI");
        return nextStatus.ready ? `${nextStatus.modelLabel} is ready.` : "Local AI startup was cancelled.";
    }

    if (subcommand === "cancel" || subcommand === "interrupt") {
        return cancelTerminalJob(args[1]);
    }

    if (subcommand === "stop" && window.LocalAI.getStatus().status === "generating") {
        return cancelTerminalJob(args[1]);
    }

    if (subcommand === "off" || subcommand === "disable" || subcommand === "stop") {
        await window.LocalAI.disable("cli");
        return "Local AI stopped and its loaded model was released.";
    }

    const questionText = args.join(" ");
    if (isCliCapabilitiesQuestion(questionText)) return getLocalAICapabilitiesText();

    const status = window.LocalAI.getStatus();
    if (status.status === "generating") {
        return "Local AI is already answering in a background job. Run 'jobs' or 'ai cancel'.";
    }

    if (!window.LocalAI.isReady()) {
        const question = questionText;
        if (question && window.SimpleBrain) {
            const answer = window.SimpleBrain.query(question);
            if (answer) return answer;
        }
        return "Local/Cloud AI is disabled. Run 'ai on', or use 'ai settings' to configure it.";
    }

    if (window.BrainHelper && (
        questionText.toLowerCase().includes("open ") ||
        questionText.toLowerCase().includes("close ") ||
        questionText.toLowerCase().includes("say ") ||
        questionText.toLowerCase().includes("speak ") ||
        questionText.toLowerCase().includes("notify ") ||
        questionText.toLowerCase().includes("toast ")
    )) {
        window.BrainHelper.ask(questionText);
        return "Redirecting action request to Lobe mascot helper...";
    }

    return createLocalAIChatJob(questionText, {
        user: currentUser,
        cwd: currentDir,
        mode: "cli"
    });
}

function isPrivateDesktopProfile() {
    const userId = window.state?.currentUserId;
    return typeof window.isPrivateUser === "function" && window.isPrivateUser(userId);
}

function getCliProfileSummary() {
    if (isPrivateDesktopProfile()) {
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        return `${user?.name || "Private User"} — PortfoliOS Core Linux Terminal (full SystemFS & localStorage Interchange access).`;
    }
    return window.profileSummary;
}

function getCliLinks() {
    if (isPrivateDesktopProfile()) {
        return "Private profile links: use Files (/documents), App Store, Browser, or Settings.";
    }
    return [
        "GitHub:   https://github.com/Bl4ut0",
        "Portfolio: https://bl4ut0.dev",
        "Contact:  use 'open contact' or the Contact window"
    ].join("\n");
}

function getVisibleCliSystems() {
    const systems = Array.isArray(window.cliSystems) ? window.cliSystems : [];
    if (!isPrivateDesktopProfile()) return systems;
    return systems.filter(entry => entry.id === "doomsource");
}

function isCliSystemVisible(systemId) {
    return getVisibleCliSystems().some(entry => entry.id === systemId);
}

async function launchDesktopAppFromCli(appKey, label) {
    const targetApp = OS_APP_ALIASES[appKey] || appKey;
    if (window.switchView) window.switchView("desktop");
    if (typeof window.openDesktopWindow === "function") {
        await window.openDesktopWindow(targetApp);
        return `Launching ${label || targetApp}...`;
    }
    return `Unable to launch ${targetApp}.`;
}

// Core command executor (supports piping via `stdin`)
// Zero-Knowledge Keyring & Vault Shell Manager
async function runVaultCommand(args = []) {
    const sub = (args[0] || "").toLowerCase();

    if (!sub || sub === "help" || sub === "--help" || sub === "-h") {
        return [
            "PortfoliOS Zero-Knowledge Keyring & Vault Manager",
            "Usage: vault <command> [options]",
            "",
            "Commands:",
            "  init                Initialize master passphrase and setup zero-knowledge vault",
            "  status              Display current vault lock status and configured providers",
            "  lock                Purge in-memory credentials from the active browser session",
            "  unlock [file]       Decrypt credentials envelope and authenticate active sessions",
            "  purge | reset       Erase all stored credentials and reset vault (Recovery option)",
            "  export [file]       Encrypt vault to /documents/vault.enc (AES-256-GCM + PBKDF2)",
            "  import [file]       Decrypt specified envelope (default: /documents/vault.enc)",
            "  list                List authenticated CLI tool providers in /etc/portfolios/vault",
            "",
            "Security: Plain-text tokens are stored exclusively in local IndexedDB. Cloud sync",
            "transfers only client-side AES-256-GCM encrypted envelopes with rotating 256-bit salts."
        ].join("\n");
    }

    if (sub === "init") {
        if (typeof window.PortfoliOSVault?.showSetupModal === "function" && document.getElementById("vault-modal-backdrop")) {
            window.PortfoliOSVault.showSetupModal();
            return "Opening visual Vault Setup wizard...";
        }
        promptUser("Enter New Master Passphrase (min 14 chars): ", true, async (pass1) => {
            const validation = window.PortfoliOSVault?.validatePassword
                ? window.PortfoliOSVault.validatePassword(pass1)
                : { valid: Boolean(pass1 && pass1.length >= 14), errors: [] };
            if (!validation.valid) {
                window.addTerminalLine("vault init error: Password does not meet security requirements:", "error");
                for (const err of (validation.errors || [])) {
                    window.addTerminalLine(`  • ${err}`, "error");
                }
                return;
            }
            promptUser("Confirm Master Passphrase: ", true, async (pass2) => {
                if (pass1 !== pass2) {
                    window.addTerminalLine("vault init error: Passphrases do not match.", "error");
                    return;
                }
                try {
                    await window.PortfoliOSVault.initWithPassphrase(pass1);
                    window.addTerminalLine("✓ Zero-Knowledge Vault initialized successfully with AES-256-GCM + PBKDF2-SHA512.", "success");
                    window.addTerminalLine("  Encrypted envelope saved to /documents/vault.enc (Cloud sync ready).", "muted");
                } catch (err) {
                    window.addTerminalLine(`vault init error: ${err.message}`, "error");
                }
            });
        });
        return "";
    }

    if (sub === "purge" || sub === "reset") {
        if (typeof window.PortfoliOSVault?.showPurgeModal === "function" && document.getElementById("vault-modal-backdrop")) {
            window.PortfoliOSVault.showPurgeModal();
            return "Opening visual Vault Purge & Reset dialog...";
        }
        promptUser("WARNING: This will permanently erase all saved credentials in /etc/portfolios/vault/ and /documents/vault.enc.\nType 'PURGE' to confirm: ", false, async (confirmText) => {
            if (confirmText.trim() !== "PURGE") {
                window.addTerminalLine("vault purge: Operation cancelled.", "muted");
                return;
            }
            try {
                if (window.PortfoliOSVault && typeof window.PortfoliOSVault.purgeAndReset === "function") {
                    await window.PortfoliOSVault.purgeAndReset();
                }
                cliAuthSessions.clear();
                window.addTerminalLine("✓ Zero-Knowledge Vault purged. All saved credentials and backups erased.", "success");
                window.addTerminalLine("  You may now run 'vault init' to configure a new Master Passphrase.", "muted");
            } catch (err) {
                window.addTerminalLine(`vault purge error: ${err.message}`, "error");
            }
        });
        return "";
    }

    if (sub === "status") {
        let providers = [];
        if (window.SystemFS && typeof window.SystemFS.readDir === "function") {
            try {
                const files = (await window.SystemFS.readDir("/etc/portfolios/vault")) || [];
                providers = files.filter(f => f.name?.endsWith(".json")).map(f => f.name.replace(".json", ""));
            } catch (_) {}
        }
        let hasEncrypted = false;
        try {
            const enc = await window.SystemFS?.readFile?.("/documents/vault.enc");
            hasEncrypted = Boolean(enc && !enc.isDirectory);
        } catch (_) {}

        const session = window.PortfoliOSRuntimeBridge?.getActiveSession();
        const inMemoryCount = session?.vaultTokens ? session.vaultTokens.size : 0;
        const isLocked = inMemoryCount === 0 && providers.length > 0;

        return [
            "PortfoliOS Zero-Knowledge Keyring Status:",
            `  Vault State:        ${isLocked ? "\x1b[33mLocked (Memory keys cleared)\x1b[0m" : "\x1b[32mActive (Keys in memory)\x1b[0m"}`,
            `  Local Providers:    ${providers.length ? providers.join(", ") : "None configured"}`,
            `  Encrypted Backup:   ${hasEncrypted ? "\x1b[32m/documents/vault.enc (Sync Ready)\x1b[0m" : "\x1b[33mNot exported yet\x1b[0m"}`,
            `  Root VFS Mount:     / (SystemFS mounted)`,
            `  Native Relay:       ${window.PortfoliOSNativeRelay ? "Connected" : "In-browser mode"}`
        ].join("\n");
    }

    if (sub === "lock") {
        if (window.PortfoliOSVault && typeof window.PortfoliOSVault.lock === "function") {
            window.PortfoliOSVault.lock();
        }
        const session = window.PortfoliOSRuntimeBridge?.getActiveSession();
        if (session?.vault) session.vault.lock();
        return "✓ Zero-Knowledge Vault locked. In-memory keys purged from this session.";
    }

    if (sub === "list") {
        let providers = [];
        if (window.SystemFS && typeof window.SystemFS.readDir === "function") {
            try {
                const files = (await window.SystemFS.readDir("/etc/portfolios/vault")) || [];
                providers = files.filter(f => f.name?.endsWith(".json")).map(f => f.name.replace(".json", ""));
            } catch (_) {}
        }
        if (!providers.length) return "No CLI credentials currently saved in /etc/portfolios/vault.";
        return "Configured Providers in Vault:\n" + providers.map(p => `  - ${p}`).join("\n");
    }

    if (sub === "export") {
        const targetPath = args[1] || "/documents/vault.enc";
        let tokens = {};
        if (window.SystemFS && typeof window.SystemFS.readDir === "function") {
            try {
                const files = (await window.SystemFS.readDir("/etc/portfolios/vault")) || [];
                for (const f of files) {
                    if (f.name?.endsWith(".json")) {
                        const rec = await window.SystemFS.readFile(f.path);
                        if (rec?.data) {
                            const pName = f.name.replace(".json", "");
                            tokens[pName] = JSON.parse(String(rec.data));
                        }
                    }
                }
            } catch (_) {}
        }

        if (Object.keys(tokens).length === 0) {
            return "vault export: No credentials in /etc/portfolios/vault to export. Sign in via 'codex login', 'agy login', etc. first.";
        }

        promptUser("Enter Master Passphrase for Vault Export: ", true, async (password) => {
            if (!password || password.length < 12) {
                window.addTerminalLine("vault export: Password must be at least 12 characters long.", "error");
                return;
            }
            try {
                // Cryptographic export using PBKDF2-SHA512 (600,000 rounds) + AES-256-GCM
                const salt = crypto.getRandomValues(new Uint8Array(32));
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const encoder = new TextEncoder();
                const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
                const key = await crypto.subtle.deriveKey(
                    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-512" },
                    baseKey,
                    { name: "AES-GCM", length: 256 },
                    false,
                    ["encrypt"]
                );

                const payload = {
                    version: 1,
                    profileId: window.state?.currentUserId || "guest",
                    tokens,
                    exportedAt: Date.now()
                };
                const plaintext = encoder.encode(JSON.stringify(payload));
                const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
                const cipherBytes = new Uint8Array(cipherBuf);

                const toB64 = (bytes) => btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(""));
                const digest = await crypto.subtle.digest("SHA-256", cipherBytes);
                const checksum = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");

                const envelope = {
                    version: 1,
                    format: "portfolios-zk-vault",
                    kdf: { algorithm: "PBKDF2", hash: "SHA-512", iterations: 600000, salt: toB64(salt) },
                    cipher: { algorithm: "AES-256-GCM", iv: toB64(iv), tagLength: 128 },
                    ciphertext: toB64(cipherBytes),
                    checksum,
                    exportedAt: Date.now()
                };

                const parent = window.SystemFS.getParentPath(targetPath);
                await window.SystemFS.ensureDirectory?.(parent, { silent: true });
                await writeTerminalFile(targetPath, JSON.stringify(envelope, null, 2), "application/json");

                window.addTerminalLine(`✓ Zero-Knowledge Vault exported to ${targetPath} (AES-256-GCM + PBKDF2-SHA512).`, "success");
                window.addTerminalLine("  Encrypted envelope is ready for cross-device Google Drive / OneDrive sync.", "muted");
            } catch (err) {
                window.addTerminalLine(`vault export error: ${err.message}`, "error");
            }
        });
        return "";
    }

    if (sub === "unlock" && !args[1] && typeof window.PortfoliOSVault?.showUnlockModal === "function" && document.getElementById("vault-modal-backdrop")) {
        window.PortfoliOSVault.showUnlockModal({
            onUnlock: (res) => {
                window.addTerminalLine(`✓ Zero-Knowledge Vault unlocked via authentication dialog. Restored: ${res.restored?.join(", ") || "keys"}.`, "success");
            }
        });
        return "Opening visual Vault Authentication dialog...";
    }

    if (sub === "import" || sub === "unlock") {
        const sourcePath = args[1] || "/documents/vault.enc";
        const fileRec = await window.SystemFS?.readFile?.(sourcePath);
        if (!fileRec || !fileRec.data) {
            return `vault ${sub}: File '${sourcePath}' not found in SystemFS.`;
        }

        promptUser("Enter Master Passphrase to Unlock Vault: ", true, async (password) => {
            try {
                const envelope = JSON.parse(String(fileRec.data));
                if (!envelope || envelope.format !== "portfolios-zk-vault") {
                    throw new Error("Invalid envelope format. Expected portfolios-zk-vault.");
                }

                const fromB64 = (str) => new Uint8Array(atob(str).split("").map(c => c.charCodeAt(0)));
                const salt = fromB64(envelope.kdf.salt);
                const iv = fromB64(envelope.cipher.iv);
                const ciphertext = fromB64(envelope.ciphertext);

                const encoder = new TextEncoder();
                const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
                const key = await crypto.subtle.deriveKey(
                    { name: "PBKDF2", salt, iterations: envelope.kdf.iterations, hash: "SHA-512" },
                    baseKey,
                    { name: "AES-GCM", length: 256 },
                    false,
                    ["decrypt"]
                );

                let decryptedBuf;
                try {
                    decryptedBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
                } catch (_) {
                    throw new Error("Incorrect master passphrase or corrupted authentication tag.");
                }

                const data = JSON.parse(new TextDecoder("utf-8").decode(decryptedBuf));
                const restored = [];
                if (data && data.tokens) {
                    await window.SystemFS.ensureDirectory?.("/etc/portfolios/vault", { silent: true });
                    for (const [provider, tokenRec] of Object.entries(data.tokens)) {
                        await writeTerminalFile(`/etc/portfolios/vault/${provider}.json`, JSON.stringify(tokenRec, null, 2), "application/json");
                        restored.push(provider);
                    }
                }

                window.addTerminalLine(`✓ Zero-Knowledge Vault decrypted successfully. Restored ${restored.length} provider(s): ${restored.join(", ")}.`, "success");
            } catch (err) {
                window.addTerminalLine(`vault unlock error: ${err.message}`, "error");
            }
        });
        return "";
    }

    return `vault: Unknown subcommand '${sub}'. Run 'vault help' for usage.`;
}

async function executeCommand(command, args, commandPart, stdin) {
    if (shellAliases[command] && stdin === undefined) {
        const expanded = `${shellAliases[command]} ${args.join(" ")}`.trim();
        const parsed = parseArgs(expanded);
        command = parsed[0].toLowerCase();
        args = parsed.slice(1);
    }

    if (command === "sudo") {
        if (!args.length) return "usage: sudo <command> [args...]";
        return await executeCommand(args[0].toLowerCase(), args.slice(1), args.join(" "), stdin);
    }

    if (command === "exit" || command === "quit" || command === "logout") {
        if (activeCliSession) {
            const name = activeCliSession.bin || "sub-session";
            activeCliSession = null;
            return `Exited ${name}.`;
        }
        window.addTerminalLine?.("logout", "muted");
        await window.terminateTerminalSession?.();
        const win = document.querySelector(".window.cli-window, .window.codex-window");
        const winId = win?.id?.replace("window-", "") || "cli";
        window.closeDesktopWindow?.(winId);
        return "";
    }

    if (command === "clear") {
        for (const container of getTerminalOutputContainers()) {
            container.innerHTML = "";
        }
        terminalLineBuffer.length = 0;
        return "";
    }

    if (command === "vault") return await runVaultCommand(args);
    if (command === "help") {
        return [
            "PortfoliOS Core Linux Terminal (GNU/Linux x86_64-portfolios-wasm):",
            "  apt <cmd>              Package manager: apt update, apt list, apt search <q>, apt install <pkg|app>, apt remove <pkg>",
            "  wget <url> [-O file]   Download remote script or file via Interchange Handler into SystemFS",
            "  curl [-fsSL|-O] <url>  Fetch remote resource (supports piping: curl -fsSL <url> | bash)",
            "  chmod +x <file>        Mark a script or binary executable in SystemFS",
            "  ./<script> | sh <file> Execute a POSIX shell script line-by-line in SystemFS",
            "  npm install -g <pkg>   Install global CLI package into /usr/local/bin",
            "  which <cmd>            Locate binary in PATH (/usr/local/bin:/usr/bin:/bin)",
            "  ls, cd, pwd, cat       Navigate and inspect the full SystemFS hierarchy (/)",
            "  head, tail, wc, sort   Standard POSIX text processing filters (pipe-compatible)",
            "  find, tree, stat, grep Search and inspect files across SystemFS",
            "  mkdir, rm, cp, mv      Create, delete, copy, and move files/directories across SystemFS",
            "  uname, neofetch, ps    Inspect Linux kernel, hardware topology, and active processes",
            "  df, free, uptime, env  Inspect mounted filesystems, memory, and environment variables",
            "  storage <ls|get|set>   Inspect or modify OS localStorage (protected security tokens isolated)",
            "  sys <status|theme|apps> Inspect or control live PortfoliOS kernel & window manager state",
            "  open <app>             Launch any PortfoliOS application (or type its binary name directly, e.g. vscode)",
            "  ai [cmd|<prompt>]      Run or manage browser-local WebGPU AI models",
            "  su, useradd, passwd    Manage local Linux user accounts"
        ].join("\n");
    }

    if (command === "apt" || command === "apt-get" || command === "dpkg" || command === "pkg") {
        return await runApt(args);
    }
    if (command === "wget") return await runWget(args);
    if (command === "curl") return await runCurl(args);
    if (command === "sh" || command === "bash") return await runShellScript(args, stdin);
    if (command === "npm") return await runNpm(args);
    if (command === "which" || command === "whereis" || command === "type") return await runWhich(args);
    if (command === "interchange-exchange") return await runInterchangeExchangeCommand(args);
    if (command === "storage" || command === "localstorage") return runStorageCommand(args);
    if (command === "sys" || command === "sysctl") return await runSysCommand(args);

    if (command === "uname") {
        const flags = args.join(" ");
        if (flags.includes("-a") || flags.includes("--all")) {
            return "Linux portfoliOS 6.6.0-wasm64-portfolios #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux";
        }
        if (flags.includes("-r")) return "6.6.0-wasm64-portfolios";
        if (flags.includes("-m")) return "x86_64";
        return "Linux";
    }
    if (command === "hostname") return "portfoliOS";
    if (command === "uptime") {
        const upSec = Math.max(1, Math.floor((Date.now() - bootTimestamp) / 1000));
        return ` ${new Date().toTimeString().slice(0, 8)} up ${Math.floor(upSec / 60)} min,  1 user,  load average: 0.08, 0.04, 0.01`;
    }
    if (command === "date") return new Date().toString();
    if (command === "df") return await runDf();
    if (command === "du") return "128K\t" + (args[0] || currentDir);
    if (command === "free") return runFree();
    if (command === "lscpu") return await runCat("/proc/cpuinfo");
    if (command === "ps" || command === "top" || command === "htop") return runPs();
    if (command === "mount") {
        return [
            "systemfs on / type idbfs (rw,relatime)",
            "proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)",
            "tmpfs on /tmp type tmpfs (rw,nosuid,nodev)",
            "localstorage on /var/local/storage type kvfs (rw,relatime)"
        ].join("\n");
    }
    if (command === "dmesg") {
        return [
            "[    0.000000] Linux version 6.6.0-wasm64-portfolios (root@portfoliOS) (gcc 13.2.0) #1 SMP PREEMPT_DYNAMIC",
            "[    0.001204] x86_64-portfolios-wasm virtual MMU initialized",
            "[    0.004810] systemd[1]: Mounted SystemFS root (/) read-write",
            "[    0.009120] portfolios-interchange[42]: Middleman Exchange Handler active (wget/curl/apt/npm/SystemFS/localStorage)"
        ].join("\n");
    }
    if (command === "neofetch" || command === "fastfetch") return runNeofetch();
    if (command === "ping") {
        const host = args.find(a => !a.startsWith("-")) || "os.bl4ut0.dev";
        return [
            `PING ${host} (127.0.0.1) 56(84) bytes of data.`,
            `64 bytes from ${host} (127.0.0.1): icmp_seq=1 ttl=64 time=0.42 ms`,
            `--- ${host} ping statistics ---`,
            "1 packets transmitted, 1 received, 0% packet loss, time 0ms"
        ].join("\n");
    }
    if (command === "ip" || command === "ifconfig") {
        return [
            "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN",
            "    inet 127.0.0.1/8 scope host lo",
            "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP",
            "    inet 10.24.0.10/24 brd 10.24.0.255 scope global eth0"
        ].join("\n");
    }
    if (command === "git") {
        const sub = (args[0] || "--version").toLowerCase();
        if (sub === "--version" || sub === "-v" || sub === "version") return "git version 2.43.0 (x86_64-portfolios-wasm)";
        if (sub === "status") return `On branch main\nWorking tree in ${currentDir} (SystemFS mounted)`;
        return `git: executed 'git ${args.join(" ")}' in ${currentDir}`;
    }
    if (command === "node") {
        if (!args.length || args[0] === "-v" || args[0] === "--version") return "v22.11.0";
        if (args[0] === "-e" && args[1]) {
            try {
                return String(Function(`"use strict"; return (${args.slice(1).join(" ")});`)());
            } catch (err) {
                return `NodeError: ${err.message}`;
            }
        }
        return `Node.js v22.11.0 (${args.join(" ")})`;
    }
    if (command === "python3" || command === "python") {
        if (!args.length || args[0] === "-V" || args[0] === "--version") return "Python 3.11.9";
        return `Python 3.11.9 (${args.join(" ")})`;
    }
    if (command === "tar") {
        return `tar: processed archive args (${args.join(" ")})`;
    }
    if (command === "man") {
        const topic = args[0];
        if (!topic) return "What manual page do you want?\nFor example, try 'man apt' or 'man wget'.";
        return `${topic.toUpperCase()}(1) — PortfoliOS GNU/Linux Manual\nRun '${topic} --help' or 'help' for usage details.`;
    }
    if (command === "history") {
        if (args.includes("-c") || args.includes("--clear")) {
            history.length = 0;
            try {
                await window.SystemFS?.unlink?.(`/home/${currentUser}/.bash_history`);
            } catch (e) {}
            return "History cleared.";
        }
        const entries = [];
        try {
            const rec = await window.SystemFS?.readFile?.(`/home/${currentUser}/.bash_history`);
            if (rec?.data) {
                const pastLines = String(rec.data).trim().split("\n").filter(Boolean);
                entries.push(...pastLines);
            }
        } catch (e) {}
        for (const cmd of history) {
            entries.push(cmd);
        }
        if (!entries.length) return "No commands in history.";
        return entries.map((cmd, idx) => `  ${String(idx + 1).padStart(4)}  ${cmd}`).join("\n");
    }
    if (command === "alias") {
        if (!args.length) {
            return Object.entries(shellAliases).map(([k, v]) => `alias ${k}='${v}'`).join("\n");
        }
        const raw = args.join(" ");
        const eq = raw.indexOf("=");
        if (eq > 0) {
            const k = raw.slice(0, eq).trim();
            const v = raw.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
            shellAliases[k] = v;
            return "";
        }
        return shellAliases[args[0]] ? `alias ${args[0]}='${shellAliases[args[0]]}'` : `bash: alias: ${args[0]}: not found`;
    }
    if (command === "unalias") {
        delete shellAliases[args[0]];
        return "";
    }

    if (command === "env" || command === "printenv") {
        const vars = {
            USER: currentUser,
            HOME: userDirMap[currentUser]?.home || `/home/${currentUser}`,
            PWD: currentDir,
            ...shellEnv
        };
        return Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n");
    }

    if (command === "export") {
        const assignment = args.join(" ");
        const eqIdx = assignment.indexOf("=");
        if (eqIdx === -1) return runCommandLine("env");
        const k = assignment.slice(0, eqIdx).trim();
        const v = assignment.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (k) shellEnv[k] = v;
        return "";
    }

    if (command === "whoami") {
        if (args.includes("--profile") || args.includes("-p") || args.includes("--info") || args.includes("--profile-summary")) {
            return getCliProfileSummary();
        }
        return currentUser;
    }

    if (command === "whois" || command === "profile") {
        return getCliProfileSummary();
    }

    if (command === "links") return getCliLinks();

    if (command === "projects") {
        const visibleSystems = getVisibleCliSystems();
        if (!visibleSystems.length) {
            return "No portfolio systems are mounted in this private profile.";
        }
        return visibleSystems
            .map(entry => `${entry.id.padEnd(12, " ")} — ${entry.name}: ${entry.summary}`)
            .join("\n");
    }

    if (command === "status") {
        return window.systemStatus;
    }

    if (command === "quick") {
        return getLocalAICapabilitiesText();
    }

    if (command === "play" || command === "doom" || command === "doomsource") {
        if (window.switchView) window.switchView("desktop");
        if (window.openDesktopWindow) window.openDesktopWindow("doomsource");
        if (window.ensureDoomLoaded) window.ensureDoomLoaded();
        return "Launching DOOM window and starting runtime...";
    }

    if (command === "openrct2" || command === "rct" || command === "rct2") {
        if (isPrivateDesktopProfile()) return "OpenRCT2 is not mounted in the private profile.";
        if (window.switchView) window.switchView("desktop");
        if (window.openDesktopWindow) window.openDesktopWindow("openrct2");
        if (window.ensureOpenRct2Loaded) window.ensureOpenRct2Loaded();
        return "Launching OpenRCT2 window and checking the local asset bundle...";
    }

    if (command === "linux" || command === "workstation") {
        return "You are already inside the unified PortfoliOS Core Linux Terminal (64-bit POSIX + SystemFS + Interchange).";
    }

    if (command === "inspect") {
        const target = args[0];
        if (!target) {
            const ids = getVisibleCliSystems().map(entry => entry.id).join(", ");
            return ids ? `Specify a system id: ${ids}` : "No portfolio systems are mounted in this private profile.";
        }
        if (!isCliSystemVisible(target)) {
            return `System "${target}" is unavailable in the private profile.`;
        }
        if (window.selectSystem && !window.selectSystem(target)) {
            return `Unknown system "${target}". Run "projects" for valid ids.`;
        }
        const selected = Array.isArray(window.cliSystems) ? window.cliSystems.find(entry => entry.id === target) : null;
        return selected ? `${selected.name}: ${selected.summary}` : `Selected ${target}.`;
    }

    if (command === "open") {
        const target = (args[0] || "").toLowerCase();
        if (!target) return "Usage: open <app-id|url-key> (e.g. open vscode, open files, open browser, open store, open settings)";
        if (OS_APP_ALIASES[target] || window.appRegistry?.[target] || (window.desktopApps || []).some(a => a.id === target)) {
            return await launchDesktopAppFromCli(target);
        }
        if (isPrivateDesktopProfile() && target !== "doomsource") {
            return `Target "${target}" is unavailable in the private profile.`;
        }
        const openTargets = window.openTargets || {};
        const href = openTargets[target];
        if (!href) {
            return `Unknown target "${target}". Try: open vscode, open files, open store, or open devhub`;
        }
        window.open(href, "_blank", "noopener,noreferrer");
        return `Opening ${href}`;
    }

    if (command === "admin") {
        const adminOwner = window.state?.currentUserId;
        promptUser("Enter admin passphrase: ", true, async (passphrase) => {
            if (!passphrase) {
                window.addTerminalLine("admin: authentication aborted");
                return;
            }
            window.addTerminalLine("Authenticating with PortfoliOS secure core...", "muted");
            try {
                const res = await fetch("core/admin.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "auth", password: passphrase })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    window.addTerminalLine(`admin: Authentication failed (${data.error || "Invalid passphrase"}).`, "muted");
                    return;
                }

                if (!window.establishAdminSession?.(data, adminOwner)) return;

                window.addTerminalLine("[OK] Admin session established. Launching Portfolio Studio...", "success");
                if (data.isDefaultPassword) {
                    window.addTerminalLine("[Notice] Default administrator passphrase is in use. Update it in the Passphrase tab.", "muted");
                }

                await window.ensureAppLoaded?.("portfolio-studio");
                if (!window.AdminSession?.isAuthenticated()) return;
                if (window.switchView) window.switchView("desktop");
                if (window.openDesktopWindow) window.openDesktopWindow("portfolio-studio");
            } catch (err) {
                window.addTerminalLine(`admin: Gateway error: ${err.message}`, "muted");
            }
        });
        return "";
    }

    if (command === "su") {
        await runSu(args[0]);
        return "";
    }
    if (command === "passwd") {
        await runPasswd(args[0]);
        return "";
    }
    if (command === "useradd" || command === "adduser") {
        await runUserAdd(args[0]);
        return "";
    }
    if (command === "userdel") return await runUserDel(args[0]);
    if (command === "groups") return await runGroups(args[0]);
    if (command === "id") return await runId(args[0]);
    if (command === "pwd") return currentDir;
    if (command === "cd") return await runCd(args[0]);
    if (command === "ls") return await runLs(args);
    if (command === "cat") return await runCat(args[0], stdin);
    if (command === "head") return await runHead(args, stdin);
    if (command === "tail") return await runTail(args, stdin);
    if (command === "wc") return await runWc(args, stdin);
    if (command === "sort") return await runSort(args, stdin);
    if (command === "uniq") return await runUniq(args, stdin);
    if (command === "find") return await runFind(args);
    if (command === "tree") return await runTree(args);
    if (command === "stat") return await runStat(args);
    if (command === "file") {
        if (!args[0]) return "Usage: file <path>";
        const rec = await getFileRecord(resolvePath(args[0]));
        if (!rec) return `${args[0]}: cannot open (No such file or directory)`;
        return `${args[0]}: ${rec.isDirectory ? "directory" : (rec.type || "ASCII text")}`;
    }
    if (command === "touch") return await runTouch(args[0]);
    if (command === "chmod") return await runChmod(args);
    if (command === "chown") return args.length < 2 ? "Usage: chown <owner> <file>" : "";
    if (command === "mkdir") return await runMkdir(args);
    if (command === "rmdir") return await runRm(args);
    if (command === "rm") return await runRm(args);
    if (command === "cp") return await runCp(args);
    if (command === "mv") return await runMv(args);
    if (command === "grep") return await runGrep(args, stdin);

    if (command === "echo") {
        const echoStr = commandPart.slice(commandPart.toLowerCase().indexOf("echo") + 4).trim();
        if ((echoStr.startsWith('"') && echoStr.endsWith('"')) || (echoStr.startsWith("'") && echoStr.endsWith("'"))) {
            return echoStr.slice(1, -1);
        }
        return echoStr;
    }

    if (command === "jobs") return formatTerminalJobs();
    if (command === "kill") return cancelTerminalJob(args[0]);

    if (command === "ai" || command === "assistant" || command === "lobe") {
        return await runLocalAICommand(args);
    }

    // Execute script by path (./install.sh, /tmp/script.sh)
    if (command.startsWith("./") || command.startsWith("/") || command.startsWith("../")) {
        const resolved = resolvePath(command);
        const rec = await getFileRecord(resolved);
        if (!rec) {
            return `bash: ${command}: No such file or directory`;
        }
        if (rec.isDirectory) {
            return `bash: ${command}: Is a directory`;
        }
        const installedMeta = await getInstalledBinary(command);
        if (installedMeta) {
            return await executeInstalledCliBinary(installedMeta, args);
        }
        if (window.PortfoliOSRuntimeBridge && typeof window.PortfoliOSRuntimeBridge.runProcess === "function") {
            const profileId = window.state?.currentUserId || (currentUser !== "guest" ? currentUser : (window.getCurrentUser?.()?.id || "guest"));
            try {
                await window.PortfoliOSRuntimeBridge.runProcess({
                    profileId,
                    cmd: resolved,
                    args,
                    onOutput: (chunk) => {}
                });
                return "";
            } catch (err) {
                return `bash: ${command}: ${err.message}`;
            }
        }
        return await runShellScript([command, ...args]);
    }

    // Check if `command` is an installed binary in `/usr/local/bin` or `PATH`
    const installedBin = await getInstalledBinary(command);
    if (installedBin) {
        return await executeInstalledCliBinary(installedBin, args);
    }

    // Check if `command` is a native PortfoliOS app alias (e.g. `vscode`, `code`, `files`, `portal`, `solidcraft`)
    if (OS_APP_ALIASES[command]) {
        const appId = OS_APP_ALIASES[command];
        const isInstalled = window.isAppInstalled?.(appId) || window.isStoreAppInstalled?.(appId) || ["files", "store", "settings", "browser", "local-ai", "cli", "codex"].includes(appId);
        if (isInstalled) {
            return await launchDesktopAppFromCli(appId);
        }
        return [
            `Command '${command}' not found, but can be installed with:`,
            `  apt install ${appId}`
        ].join("\n");
    }

    // If user typed a known CLI name (`agy`, `codex`, `claude`, `xai`) before installing it, give a realistic Linux hint
    const knownUninstalled = window.PortfoliOSInterchange.resolvePackageByName(command);
    if (knownUninstalled) {
        const scriptUrl = knownUninstalled.bin === "agy"
            ? "https://antigravity.google/cli/install.sh"
            : knownUninstalled.bin === "codex"
                ? "https://chatgpt.com/codex/install.sh"
                : knownUninstalled.bin === "claude"
                    ? "https://claude.ai/install.sh"
                    : "https://x.ai/build/install.sh";
        return [
            `bash: ${command}: command not found (not installed in /usr/local/bin)`,
            `Install ${knownUninstalled.name} using any standard Linux method:`,
            `  1) apt install ${knownUninstalled.bin}`,
            `  2) wget ${scriptUrl} && chmod +x install.sh && ./install.sh`,
            `  3) npm install -g ${knownUninstalled.pkg}`
        ].join("\n");
    }

    if (isCliCapabilitiesQuestion(commandPart)) {
        return getLocalAICapabilitiesText();
    }

    const aiFallback = window.PortfoliOSLocalAI;
    if (aiFallback && typeof aiFallback.getState === "function" && aiFallback.getState().loadedModelId) {
        return createLocalAIChatJob(commandPart, {}, `ai "${commandPart.slice(0, 36)}${commandPart.length > 36 ? "..." : ""}"`);
    }

    return `bash: ${command}: command not found. Type "help" or "apt search <query>".`;
}

async function runCommandLine(rawCmdLine) {
    const chain = splitCommandChain(rawCmdLine);
    const outputs = [];
    for (const segment of chain) {
        const { commandPart, targetFile, append } = parseCommandLine(segment);
        const stages = splitPipeline(commandPart);
        let stageOut = undefined;
        for (const stage of stages) {
            const parsed = parseArgs(stage);
            if (!parsed.length) continue;
            stageOut = await executeCommand(parsed[0].toLowerCase(), parsed.slice(1), stage, stageOut);
        }
        if (isTerminalAsyncJob(stageOut)) {
            return stageOut;
        }
        if (stageOut !== undefined && stageOut !== "") {
            if (targetFile) {
                await handleRedirection(targetFile, stageOut, append);
            } else {
                outputs.push(stageOut);
            }
        }
    }
    return outputs.join("\n");
}

// Command execution handler
window.handleCommand = async function(rawInput) {
    const cleanInput = String(rawInput || "").trim();
    const displayUser = getDisplayUser(currentUser);
    const displayDir = getDisplayDir(currentDir);
    const promptChar = currentUser === "root" ? "#" : "$";

    if (activeCliSession) {
        const promptLabel = activeCliSession.bin === "agy" ? ">" : `${activeCliSession.bin}(${displayDir})>`;
        window.addTerminalLine(`${promptLabel} ${cleanInput}`, "command");
        if (!cleanInput) return;
        history.push(cleanInput);
        historyIndex = -1;
        const reply = await handleActiveCliSessionInput(cleanInput);
        if (reply) window.addTerminalLine(reply);
        return;
    }

    window.addTerminalLine(`${displayUser}@portfoliOS:${displayDir}${promptChar} ${cleanInput}`, "command");
    if (!cleanInput) return;

    history.push(cleanInput);
    historyIndex = -1;

    try {
        const response = await runCommandLine(cleanInput);
        if (isTerminalAsyncJob(response)) {
            startTerminalAsyncJob(response);
        } else if (response !== undefined && response !== "") {
            window.addTerminalLine(response);
        }
        return response;
    } catch (err) {
        window.addTerminalLine(`bash: ${err.message}`);
        return `bash: ${err.message}`;
    }
};

window.runCommandLine = runCommandLine;
window.runShellScript = runShellScript;

window.submitTerminalInput = async function(rawValue) {
    const val = String(rawValue ?? "");
    if (activePrompt) {
        if (activePrompt.isPassword) {
            window.addTerminalLine(activePrompt.label, "command");
        } else {
            window.addTerminalLine(`${activePrompt.label}${val}`, "command");
        }
        const cb = activePrompt.callback;
        activePrompt = null;
        window.hideTerminalAuthBanner();
        for (const el of getTerminalInputElements()) el.type = "text";
        updatePrompt();
        await cb(val);
        return;
    }
    await window.handleCommand(val);
};

// Streaming text output
window.streamTextToTerminal = function(element, text, speed = 12) {
    let index = 0;
    const step = () => {
        index += 1;
        element.textContent = text.slice(0, index);
        for (const container of getTerminalOutputContainers()) {
            container.scrollTop = container.scrollHeight;
        }
        if (index < text.length) {
            window.setTimeout(step, speed);
        }
    };
    step();
};

function createTerminalLineElement(text, className = "", html = null) {
    const line = document.createElement("div");
    line.className = `terminal-line${className ? ` ${className}` : ""}`;
    line.style.whiteSpace = "pre-wrap";
    if (typeof html === "string" && html) {
        line.innerHTML = html;
    } else {
        line.textContent = text;
    }
    return line;
}

// Terminal output line helper (renders into all mounted terminal windows and records shared buffer)
window.addTerminalLine = function(text, className = "") {
    const strText = String(text ?? "");
    terminalLineBuffer.push({ text: strText, className });
    if (terminalLineBuffer.length > MAX_TERMINAL_BUFFER) {
        terminalLineBuffer.shift();
    }

    const containers = getTerminalOutputContainers();
    for (const container of containers) {
        const line = createTerminalLineElement(strText, className);
        container.appendChild(line);
        container.scrollTop = container.scrollHeight;
    }
};

window.addTerminalHtmlLine = function(html, fallbackText = "", className = "") {
    const strText = String(fallbackText ?? "");
    const strHtml = String(html ?? "");
    terminalLineBuffer.push({ text: strText, html: strHtml, className });
    if (terminalLineBuffer.length > MAX_TERMINAL_BUFFER) {
        terminalLineBuffer.shift();
    }

    const containers = getTerminalOutputContainers();
    for (const container of containers) {
        const line = createTerminalLineElement(strText, className, strHtml);
        container.appendChild(line);
        container.scrollTop = container.scrollHeight;
    }
};

function createStreamingTerminalWriter(className = "") {
    const entry = { text: "", className };
    terminalLineBuffer.push(entry);
    if (terminalLineBuffer.length > MAX_TERMINAL_BUFFER) {
        terminalLineBuffer.shift();
    }
    const elements = [];
    for (const container of getTerminalOutputContainers()) {
        const line = createTerminalLineElement("", className);
        container.appendChild(line);
        container.scrollTop = container.scrollHeight;
        elements.push({ container, line });
    }
    return {
        append(delta) {
            entry.text += String(delta ?? "");
            for (const { container, line } of elements) {
                line.textContent = entry.text;
                container.scrollTop = container.scrollHeight;
            }
        },
        setText(fullText) {
            entry.text = String(fullText ?? "");
            for (const { container, line } of elements) {
                line.textContent = entry.text;
                container.scrollTop = container.scrollHeight;
            }
        },
        removeIfEmpty() {
            if (entry.text.trim()) return;
            const idx = terminalLineBuffer.indexOf(entry);
            if (idx !== -1) terminalLineBuffer.splice(idx, 1);
            for (const { line } of elements) {
                try { line.remove(); } catch (_) {}
            }
        }
    };
}

window.typeTerminalLine = function(text, className = "", speed = 10) {
    const strText = String(text ?? "");
    terminalLineBuffer.push({ text: strText, className });
    if (terminalLineBuffer.length > MAX_TERMINAL_BUFFER) {
        terminalLineBuffer.shift();
    }

    const containers = getTerminalOutputContainers();
    for (const container of containers) {
        const line = document.createElement("div");
        line.className = `terminal-line${className ? ` ${className}` : ""}`;
        line.style.whiteSpace = "pre-wrap";
        container.appendChild(line);
        window.streamTextToTerminal(line, strText, speed);
    }
};

// Terminate running terminal session, cancel active jobs, persist history to ~/.bash_history, and reset memory state
window.terminateTerminalSession = async function() {
    if (terminalJobs.size > 0) {
        for (const [jobId, job] of terminalJobs.entries()) {
            try {
                if (typeof job.cancel === "function") {
                    job.cancelRequested = true;
                    job.cancel();
                }
            } catch (e) {
                console.warn("Failed to cancel terminal job", jobId, e);
            }
        }
        terminalJobs.clear();
    }

    if (window.LocalAI?.getStatus?.().status === "generating") {
        try { window.LocalAI.cancelGeneration?.("cli"); } catch (e) {}
    }

    activeCliSession = null;
    activePrompt = null;
    activeAuthMeta = null;
    window.hideTerminalAuthBanner?.();

    if (history.length > 0 && window.SystemFS?.writeFile && currentUser) {
        try {
            const histPath = `/home/${currentUser}/.bash_history`;
            let existingHist = "";
            try {
                const rec = await window.SystemFS.readFile(histPath);
                existingHist = rec?.data ? String(rec.data).trim() : "";
            } catch (e) {}
            const sessionCommands = history.filter(c => c && c !== "exit" && c !== "quit" && c !== "logout").join("\n");
            if (sessionCommands) {
                const combinedHist = existingHist ? `${existingHist}\n${sessionCommands}` : sessionCommands;
                await window.SystemFS.writeFile(
                    histPath,
                    ".bash_history",
                    `/home/${currentUser}`,
                    combinedHist,
                    combinedHist.length,
                    "text/plain",
                    false,
                    { silent: true }
                );
            }
        } catch (e) {
            console.warn("Failed to persist .bash_history", e);
        }
    }

    history.length = 0;
    historyIndex = -1;
    currentInputVal = "";
    terminalLineBuffer.length = 0;

    for (const container of getTerminalOutputContainers()) {
        container.innerHTML = "";
    }

    for (const input of getTerminalInputElements()) {
        input.value = "";
        input.type = "text";
    }

    currentDir = `/home/${currentUser || "guest"}`;
    updatePrompt();
};

// Synchronize a newly mounted terminal surface (e.g. unified Codex / Core Terminal window) with existing session state
window.syncTerminalSurface = function(rootEl) {
    const outputEl = rootEl?.querySelector?.("[data-term-output]") || rootEl?.querySelector?.("#terminal-output");
    if (outputEl && outputEl.childNodes.length === 0) {
        if (terminalLineBuffer.length === 0) {
            window.startCliIntro?.();
        } else {
            for (const entry of terminalLineBuffer) {
                outputEl.appendChild(createTerminalLineElement(entry.text, entry.className, entry.html || null));
            }
            outputEl.scrollTop = outputEl.scrollHeight;
        }
    }
    const inputEl = rootEl?.querySelector?.("[data-term-input]") || rootEl?.querySelector?.("#terminal-input");
    if (inputEl) {
        bindHistoryToInput(inputEl);
        inputEl.type = activePrompt?.isPassword ? "password" : "text";
    }
    if (activeAuthMeta) {
        window.showTerminalAuthBanner(activeAuthMeta);
    }
    updatePrompt();
};

// Instant Linux login banner (no slow typewriter delay)
window.asciiMotd = [
    "PortfoliOS GNU/Linux 12 (bookworm-wasm64) — 64-bit Core System Terminal",
    "Mounted: / (SystemFS RW) · /usr/local/bin · /documents · OS localStorage Interchange"
];

window.startCliIntro = function() {
    const containers = getTerminalOutputContainers();
    if (!containers.length) return;
    for (const container of containers) {
        container.innerHTML = "";
    }
    terminalLineBuffer.length = 0;

    const lines = isPrivateDesktopProfile()
        ? [
            ...window.asciiMotd,
            'Type "help", "apt list", "wget <url>", or "storage ls" to manage the system.'
        ]
        : [
            ...window.asciiMotd,
            'Type "help", "apt list", "neofetch", or "projects" to explore.'
        ];

    lines.forEach((lineText, idx) => {
        window.addTerminalLine(lineText, idx === 0 ? "highlight" : "muted");
    });
};

// Focus terminal input when clicking inside the terminal window
document.addEventListener("click", (event) => {
    const termWindow = event.target.closest?.(".terminal-window, #cli-window");
    if (termWindow && !event.target.closest?.("input, button, a")) {
        if (!window.getSelection()?.toString()) {
            const input = termWindow.querySelector?.("[data-term-input], #terminal-input") || (window.byId ? window.byId("terminal-input") : document.getElementById("terminal-input"));
            if (input) input.focus({ preventScroll: true });
        }
    }
});

// Form submission handler (supports both #terminal-form and [data-term-form])
document.addEventListener("submit", (event) => {
    const isPrimary = event.target?.id === "terminal-form";
    const isMirror = Boolean(event.target?.matches?.("[data-term-form]"));
    if (isPrimary || isMirror) {
        event.preventDefault();
        const input = event.target.querySelector?.("input") || (window.byId ? window.byId("terminal-input") : document.getElementById("terminal-input"));
        if (!input) return;
        const val = input.value;
        input.value = "";
        window.submitTerminalInput(val);
    }
});

// Initialize CLI Session
async function initCli() {
    try {
        const users = await loadUsers();
        await ensureUserHomeDirectories(users);

        const systemUser = window.getCurrentUser ? window.getCurrentUser()?.id : null;
        if (systemUser === "bl4ut0") {
            currentUser = "bl4ut0";
            currentDir = "/home/bl4ut0";
        } else if (window.isPrivateUser?.(systemUser)) {
            currentUser = systemUser;
            currentDir = `/home/${systemUser}`;
            if (!users[systemUser]) {
                users[systemUser] = {
                    username: systemUser,
                    passwordHash: "",
                    groups: ["private"],
                    home: `/home/${systemUser}`
                };
                await saveUsers(users);
                await ensureUserHomeDirectories(users);
            }
        } else {
            currentUser = "guest";
            currentDir = "/home/guest";
        }

        updatePrompt();
        setupHistory();
    } catch (e) {
        console.error("Failed to initialize CLI:", e);
    }
}

window.initializeCliWindow = initCli;

if (window.SystemFS && window.SystemFS.ensureReady) {
    window.SystemFS.ensureReady().then(() => {
        initCli();
    });
} else {
    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(initCli, 500);
    });
}

if (window.EventBus) {
    window.EventBus.on("user:changed", () => {
        activeCliSession = null;
        window.hideTerminalAuthBanner();
        initCli();
    });
}

