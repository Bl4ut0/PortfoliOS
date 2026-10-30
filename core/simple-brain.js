/**
 * PortfoliOS: SimpleBrain
 * Rule-based offline answering and desktop task execution engine.
 * Handles system actions, window management, desktop preferences, calculations,
 * unit conversions, utilities, and portfolio navigation offline.
 * Gracefully defaults to null to allow fallback routing.
 */
(function() {
    const APP_ALIASES = {
        files: ["files", "file explorer", "explorer", "file manager", "finder", "documents folder", "recycle bin", "trash"],
        cli: ["cli", "terminal", "console", "shell", "bash", "command prompt", "cmd"],
        browser: ["browser", "web browser", "chrome", "internet", "web"],
        settings: ["settings", "preferences", "config", "configuration", "control panel"],
        store: ["store", "app store", "apps", "market", "marketplace"],
        taskmgr: ["task manager", "taskmgr", "tasks", "activity monitor", "processes"],
        "security-center": ["security center", "security", "antivirus", "defender"],
        "portfolio-studio": ["portfolio studio", "studio", "admin studio"],
        genoffice: ["genoffice", "office", "docs", "documents", "word", "sheets", "slides", "excel", "powerpoint", "presentation", "spreadsheet"],
        solidcraft: ["solidcraft", "cad", "3d cad", "solid modeling", "modeling"],
        pdfcraft: ["pdfcraft", "pdf", "pdf editor", "acrobat"],
        photocraft: ["photocraft", "photo", "photoshop", "image editor", "paint"],
        vectorcraft: ["vectorcraft", "vector", "illustrator", "svg", "draw"],
        lightcraft: ["lightcraft", "lightroom", "raw", "photo library"],
        designcraft: ["designcraft", "indesign", "publisher", "page layout"],
        vscode: ["vscode", "code", "code oss", "editor"],
        codex: ["codex", "codex cli"],
        musicmini: ["music", "musicmini", "mini music", "music player", "player", "mini player", "audio", "spotify", "songs"],
        webamp: ["webamp", "winamp", "mp3 player"],
        iptv: ["iptv", "tv", "television", "live tv", "streams"],
        plex: ["plex", "plex player", "movies"],
        filmcraft: ["filmcraft", "premiere", "video editor", "timeline editor"],
        effectcraft: ["effectcraft", "after effects", "vfx", "motion graphics"],
        doomsource: ["doom", "doomsource", "doom 1993"],
        duke32: ["duke", "duke32", "duke nukem", "duke nukem 3d"],
        diablo: ["diablo", "devilution", "devilutionx"],
        quake: ["quake", "webquake"],
        ut99: ["ut99", "unreal", "unreal tournament"],
        openrct2: ["openrct2", "rct2", "roller coaster", "rollercoaster tycoon", "rollercoaster"],
        romplayer: ["romplayer", "rom", "emulator", "retroarch", "nes", "snes", "gba"],
        profile: ["profile", "identity", "bio", "about me"],
        dossier: ["dossier", "resume", "cv", "projects dossier"],
        network: ["network", "network map", "topology", "infra"],
        linux: ["linux", "lab", "homelab", "terminal lab"],
        "local-ai": ["local ai", "ai", "lobe", "gemini", "assistant", "ai settings"]
    };

    function resolveAppId(name) {
        if (!name) return null;
        const clean = name.toLowerCase().replace(/['".,?!]/g, "").trim();
        for (const [id, aliases] of Object.entries(APP_ALIASES)) {
            if (id === clean || aliases.includes(clean)) return id;
        }
        for (const [id, aliases] of Object.entries(APP_ALIASES)) {
            if (aliases.some(a => clean.includes(a) || a.includes(clean))) return id;
        }
        return null;
    }

    function getAppTitle(id) {
        const app = (window.desktopApps || []).find(a => a.id === id);
        if (app && app.title) return app.title;
        return id.charAt(0).toUpperCase() + id.slice(1);
    }

    function safeEvalMath(expression) {
        let clean = expression
            .toLowerCase()
            .replace(/×/g, "*")
            .replace(/÷/g, "/")
            .replace(/\bplus\b/g, "+")
            .replace(/\bminus\b/g, "-")
            .replace(/\btimes\b/g, "*")
            .replace(/\bdivided by\b/g, "/")
            .replace(/\bto the power of\b/g, "^")
            .replace(/\bsquare root of\s*([\d.]+)/g, "sqrt($1)")
            .replace(/\bpi\b/g, Math.PI.toString())
            .replace(/\be\b/g, Math.E.toString())
            .replace(/\s+/g, "");

        const pctMatch = clean.match(/^([\d.]+)%(?:of)?([\d.]+)$/);
        if (pctMatch) {
            const pct = parseFloat(pctMatch[1]);
            const base = parseFloat(pctMatch[2]);
            const res = (pct / 100) * base;
            return { result: res, text: `🧮 **${pct}% of ${base}** = **${Number(res.toFixed(6))}**` };
        }

        clean = clean.replace(/sqrt\(([^)]+)\)/g, "Math.sqrt($1)");

        let pos = 0;
        function parseNumberOrParenthesis() {
            if (pos >= clean.length) return NaN;
            if (clean[pos] === '+') { pos++; return parseNumberOrParenthesis(); }
            if (clean[pos] === '-') { pos++; return -parseNumberOrParenthesis(); }

            const funcMatch = clean.slice(pos).match(/^(?:Math\.)?(sqrt|abs|round|floor|ceil|sin|cos|tan|log)\(/);
            if (funcMatch) {
                const funcName = funcMatch[1];
                pos += funcMatch[0].length;
                const arg = parseExpression();
                if (clean[pos] === ')') pos++;
                switch (funcName) {
                    case 'sqrt': return Math.sqrt(arg);
                    case 'abs': return Math.abs(arg);
                    case 'round': return Math.round(arg);
                    case 'floor': return Math.floor(arg);
                    case 'ceil': return Math.ceil(arg);
                    case 'sin': return Math.sin(arg);
                    case 'cos': return Math.cos(arg);
                    case 'tan': return Math.tan(arg);
                    case 'log': return Math.log(arg);
                    default: return NaN;
                }
            }

            if (clean[pos] === '(') {
                pos++;
                const val = parseExpression();
                if (clean[pos] === ')') pos++;
                return val;
            }

            const numMatch = clean.slice(pos).match(/^(\d+(?:\.\d+)?)/);
            if (numMatch) {
                pos += numMatch[0].length;
                return parseFloat(numMatch[1]);
            }
            return NaN;
        }

        function parsePower() {
            let left = parseNumberOrParenthesis();
            while (pos < clean.length && (clean[pos] === '^' || clean.slice(pos, pos + 2) === '**')) {
                if (clean.slice(pos, pos + 2) === '**') pos += 2;
                else pos++;
                const right = parseNumberOrParenthesis();
                left = Math.pow(left, right);
            }
            return left;
        }

        function parseMultiplyDivide() {
            let left = parsePower();
            while (pos < clean.length && (clean[pos] === '*' || clean[pos] === '/' || clean[pos] === '%')) {
                const op = clean[pos++];
                const right = parsePower();
                if (op === '*') left = left * right;
                else if (op === '/') {
                    if (right === 0) return Infinity;
                    left = left / right;
                } else if (op === '%') left = left % right;
            }
            return left;
        }

        function parseExpression() {
            let left = parseMultiplyDivide();
            while (pos < clean.length && (clean[pos] === '+' || clean[pos] === '-')) {
                const op = clean[pos++];
                const right = parseMultiplyDivide();
                if (op === '+') left = left + right;
                else if (op === '-') left = left - right;
            }
            return left;
        }

        const val = parseExpression();
        if (isNaN(val) || pos < clean.length) return null;
        const rounded = Number(val.toFixed(8));
        return { result: rounded, text: `🧮 **Calculation**: \`${expression.trim()}\` = **${rounded}**` };
    }

    function handleConversions(query) {
        const q = query.toLowerCase().replace(/,/g, "").trim();

        // Temperature: C <-> F
        const cToF = q.match(/^(-?\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*c(?:elsius)?\s+(?:to|in)\s+(?:°|deg|degrees)?\s*f(?:ahrenheit)?$/);
        if (cToF) {
            const c = parseFloat(cToF[1]);
            const f = (c * 9/5) + 32;
            return `🌡️ **Temperature**: ${c}°C = **${Number(f.toFixed(2))}°F**`;
        }
        const fToC = q.match(/^(-?\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*f(?:ahrenheit)?\s+(?:to|in)\s+(?:°|deg|degrees)?\s*c(?:elsius)?$/);
        if (fToC) {
            const f = parseFloat(fToC[1]);
            const c = (f - 32) * 5/9;
            return `🌡️ **Temperature**: ${f}°F = **${Number(c.toFixed(2))}°C**`;
        }

        // Distance: km <-> miles, m <-> feet, cm <-> inches
        const kmToMi = q.match(/^(\d+(?:\.\d+)?)\s*(?:km|kilometers?)\s+(?:to|in)\s+(?:mi|miles?)$/);
        if (kmToMi) {
            const km = parseFloat(kmToMi[1]);
            const mi = km * 0.621371;
            return `📏 **Distance**: ${km} km = **${Number(mi.toFixed(3))} miles**`;
        }
        const miToKm = q.match(/^(\d+(?:\.\d+)?)\s*(?:mi|miles?)\s+(?:to|in)\s+(?:km|kilometers?)$/);
        if (miToKm) {
            const mi = parseFloat(miToKm[1]);
            const km = mi * 1.60934;
            return `📏 **Distance**: ${mi} miles = **${Number(km.toFixed(3))} km**`;
        }
        const mToFt = q.match(/^(\d+(?:\.\d+)?)\s*(?:m|meters?)\s+(?:to|in)\s+(?:ft|feet)$/);
        if (mToFt) {
            const m = parseFloat(mToFt[1]);
            const ft = m * 3.28084;
            return `📏 **Length**: ${m} m = **${Number(ft.toFixed(2))} ft**`;
        }
        const ftToM = q.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet)\s+(?:to|in)\s+(?:m|meters?)$/);
        if (ftToM) {
            const ft = parseFloat(ftToM[1]);
            const m = ft * 0.3048;
            return `📏 **Length**: ${ft} ft = **${Number(m.toFixed(2))} m**`;
        }
        const inToCm = q.match(/^(\d+(?:\.\d+)?)\s*(?:in|inches?)\s+(?:to|in)\s+(?:cm|centimeters?)$/);
        if (inToCm) {
            const inches = parseFloat(inToCm[1]);
            const cm = inches * 2.54;
            return `📏 **Length**: ${inches} inches = **${Number(cm.toFixed(2))} cm**`;
        }
        const cmToIn = q.match(/^(\d+(?:\.\d+)?)\s*(?:cm|centimeters?)\s+(?:to|in)\s+(?:in|inches?)$/);
        if (cmToIn) {
            const cm = parseFloat(cmToIn[1]);
            const inches = cm * 0.393701;
            return `📏 **Length**: ${cm} cm = **${Number(inches.toFixed(2))} inches**`;
        }

        // Weight: kg <-> lbs, g <-> oz
        const kgToLbs = q.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)\s+(?:to|in)\s+(?:lbs?|pounds?)$/);
        if (kgToLbs) {
            const kg = parseFloat(kgToLbs[1]);
            const lbs = kg * 2.20462;
            return `⚖️ **Weight**: ${kg} kg = **${Number(lbs.toFixed(2))} lbs**`;
        }
        const lbsToKg = q.match(/^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\s+(?:to|in)\s+(?:kg|kilograms?)$/);
        if (lbsToKg) {
            const lbs = parseFloat(lbsToKg[1]);
            const kg = lbs * 0.453592;
            return `⚖️ **Weight**: ${lbs} lbs = **${Number(kg.toFixed(2))} kg**`;
        }

        // Digital storage: bytes, kb, mb, gb, tb
        const dataUnits = { b: 1, bytes: 1, kb: 1024, mb: 1024**2, gb: 1024**3, tb: 1024**4 };
        const dataMatch = q.match(/^(\d+(?:\.\d+)?)\s*(bytes|b|kb|mb|gb|tb)\s+(?:to|in)\s+(bytes|b|kb|mb|gb|tb)$/);
        if (dataMatch) {
            const val = parseFloat(dataMatch[1]);
            const fromUnit = dataMatch[2].toLowerCase();
            const toUnit = dataMatch[3].toLowerCase();
            const inBytes = val * dataUnits[fromUnit];
            const converted = inBytes / dataUnits[toUnit];
            return `💾 **Storage**: ${val} ${fromUnit.toUpperCase()} = **${Number(converted.toFixed(4))} ${toUnit.toUpperCase()}**`;
        }

        return null;
    }

    function base64Encode(str) {
        if (typeof btoa === "function") {
            try { return btoa(unescape(encodeURIComponent(str))); }
            catch { return btoa(str); }
        }
        if (typeof Buffer !== "undefined") return Buffer.from(str, "utf-8").toString("base64");
        return str;
    }

    function base64Decode(str) {
        if (typeof atob === "function") {
            try { return decodeURIComponent(escape(atob(str))); }
            catch { return atob(str); }
        }
        if (typeof Buffer !== "undefined") return Buffer.from(str, "base64").toString("utf-8");
        return str;
    }

    function generateUUID() {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    window.SimpleBrain = {
        query(rawQuery) {
            const query = (rawQuery || "").toLowerCase().trim();
            if (!query) return null;

            const sessionAnswer = window.getAssistantSessionAnswer?.(rawQuery);
            if (sessionAnswer) return sessionAnswer;

            // Context from GenOffice Copilot: "In the context of the GenOffice <app> workspace: <prompt>"
            const genofficeContextMatch = String(rawQuery).match(/^In the context of the GenOffice\s+([a-z0-9_-]+)\s+workspace:\s*(.*)$/i);
            if (genofficeContextMatch) {
                const subApp = genofficeContextMatch[1].toLowerCase();
                const subPrompt = genofficeContextMatch[2].trim().toLowerCase();
                if (subPrompt.includes("summary") || subPrompt.includes("summarize")) {
                    return `**Executive Summary (${subApp.toUpperCase()})**:\n• Native multi-format fidelity maintained.\n• Integrated with local SystemFS with zero external cloud leakage.\n• Clean validation against standard Open Document / Office exchange formats.`;
                }
                if (subPrompt.includes("formula") || subPrompt.includes("calculate")) {
                    return `Suggested Spreadsheet Formula:\n\`=SUM(B2:B10) * 1.15\`\nCalculates total with a 15% projected expansion.`;
                }
                if (subPrompt.includes("slide") || subPrompt.includes("presentation") || subPrompt.includes("outline")) {
                    return `Suggested Slide Deck Outline:\n1. **Executive Overview & Goals**\n2. **Current System Architecture**\n3. **Performance Metrics & Milestones**\n4. **Deployment & Next Steps**`;
                }
                if (subPrompt.includes("table") || subPrompt.includes("grid")) {
                    return `Sample Data Grid:\n| Item | Category | Units | Status |\n| --- | --- | --- | --- |\n| Alpha | Core | 120 | Active |\n| Beta | Relay | 85 | Verified |`;
                }
            }

            // Strip leading conversational prefixes for cleaner intent parsing
            const stripped = query
                .replace(/^(?:hey\s+)?(?:lobe|assistant|brain|simplebrain|computer|bot)[,\s:]*/i, "")
                .replace(/^(?:can\s+you|could\s+you|please|would\s+you|do\s+you\s+know\s+how\s+to)\s+/i, "")
                .trim();

            // 1. System Actions & Window Management
            const openMatch = stripped.match(/^(?:open|launch|start|run|play)\s+([a-z0-9_ -]+)$/i);
            if (openMatch) {
                const target = openMatch[1].trim();
                const appId = resolveAppId(target);
                if (appId) {
                    if (window.openDesktopWindow) window.openDesktopWindow(appId);
                    return `🚀 Opening **${getAppTitle(appId)}**...`;
                }
            }

            if (/^(?:close|exit|quit)\s+(?:all|everything|all\s+(?:windows|apps))$/i.test(stripped)) {
                const openApps = Array.from(window.state?.openApps || []);
                if (openApps.length && window.closeDesktopWindow) {
                    openApps.forEach(id => window.closeDesktopWindow(id));
                    return `Closed **${openApps.length}** open window(s).`;
                }
                return "No windows are currently open.";
            }

            const closeMatch = stripped.match(/^(?:close|exit|quit|kill)\s+([a-z0-9_ -]+)$/i);
            if (closeMatch) {
                const target = closeMatch[1].trim();
                const appId = resolveAppId(target);
                if (appId) {
                    if (window.closeDesktopWindow) window.closeDesktopWindow(appId);
                    return `Closing **${getAppTitle(appId)}**...`;
                }
            }

            const minMatch = stripped.match(/^(?:minimize|hide)\s+([a-z0-9_ -]+)$/i);
            if (minMatch) {
                const target = minMatch[1].trim();
                const appId = resolveAppId(target);
                if (appId) {
                    if (window.minimizeDesktopWindow) window.minimizeDesktopWindow(appId);
                    return `Minimized **${getAppTitle(appId)}**.`;
                }
            }

            const maxMatch = stripped.match(/^(?:maximize|fullscreen)\s+([a-z0-9_ -]+)$/i);
            if (maxMatch) {
                const target = maxMatch[1].trim();
                const appId = resolveAppId(target);
                if (appId) {
                    if (window.toggleMaximizeWindow) window.toggleMaximizeWindow(appId);
                    return `Toggled maximize for **${getAppTitle(appId)}**.`;
                }
            }

            if (/(?:what\s+apps\s+are\s+open|running\s+apps|list\s+(?:open\s+)?(?:apps|windows)|open\s+windows)/i.test(stripped)) {
                const openApps = Array.from(window.state?.openApps || []);
                if (!openApps.length) return "No applications are currently open.";
                const list = openApps.map(id => `- **${getAppTitle(id)}** (\`${id}\`)`).join("\n");
                return `Currently open applications (**${openApps.length}**):\n${list}`;
            }

            // 2. Desktop Preferences & Customization
            const wallMatch = stripped.match(/^(?:(?:set|change)\s+)?wallpaper\s*(?:to\s+)?([a-z0-9_-]+)?$/i);
            if (wallMatch) {
                const target = wallMatch[1]?.toLowerCase();
                const wallpapers = window.wallpaperOptions || [];
                if (!target || target === "list" || target === "options") {
                    const names = wallpapers.map(w => `\`${w.id}\``).join(", ");
                    return `Available wallpapers:\n${names}\n\nTo set one: \`set wallpaper <name>\``;
                }
                const found = wallpapers.find(w => w.id === target || w.label.toLowerCase() === target);
                if (found) {
                    if (window.setWallpaper) window.setWallpaper(found.id);
                    return `🖼️ Desktop wallpaper set to **${found.label}**.`;
                }
            }

            const themeMatch = stripped.match(/^(?:(?:set|change)\s+)?theme\s*(?:to\s+)?([a-z0-9_-]+)?$/i);
            if (themeMatch) {
                const target = themeMatch[1]?.toLowerCase();
                const themes = window.portfolioThemes || [];
                if (!target || target === "list" || target === "options") {
                    const names = themes.map(t => `\`${t.id}\``).join(", ");
                    return `Available themes:\n${names}\n\nTo set one: \`set theme <name>\``;
                }
                const found = themes.find(t => t.id === target || t.label.toLowerCase() === target);
                if (found) {
                    if (window.setPortfolioTheme) window.setPortfolioTheme(found.id);
                    return `🎨 Theme changed to **${found.label}**.`;
                }
            }

            if (/^(?:mute|mute\s+audio|mute\s+volume)$/i.test(stripped)) {
                if (window.setDesktopVolume) window.setDesktopVolume(0);
                return "🔇 Desktop audio muted.";
            }
            if (/^(?:unmute|unmute\s+audio)$/i.test(stripped)) {
                if (window.setDesktopVolume) window.setDesktopVolume(70);
                return "🔊 Desktop audio unmuted (70%).";
            }
            if (/^(?:volume\s+up|turn\s+it\s+up|increase\s+volume)$/i.test(stripped)) {
                const cur = window.state?.volume ?? 70;
                const next = Math.min(100, cur + 10);
                if (window.setDesktopVolume) window.setDesktopVolume(next);
                return `🔊 Desktop volume increased to **${next}%**.`;
            }
            if (/^(?:volume\s+down|turn\s+it\s+down|decrease\s+volume)$/i.test(stripped)) {
                const cur = window.state?.volume ?? 70;
                const next = Math.max(0, cur - 10);
                if (window.setDesktopVolume) window.setDesktopVolume(next);
                return `🔉 Desktop volume decreased to **${next}%**.`;
            }
            const volMatch = stripped.match(/^(?:(?:set\s+)?volume\s*(?:to\s+)?|vol\s+)(\d{1,3})%?$/i);
            if (volMatch) {
                const val = Math.min(100, Math.max(0, parseInt(volMatch[1], 10)));
                if (window.setDesktopVolume) window.setDesktopVolume(val);
                return `🔊 Desktop volume set to **${val}%**.`;
            }

            if (/^(?:start|run|launch|show)\s+screensaver$/i.test(stripped)) {
                if (window.startScreensaver) window.startScreensaver();
                return "Starting screensaver...";
            }
            if (/^(?:stop|hide|exit)\s+screensaver$/i.test(stripped)) {
                if (window.stopScreensaver) window.stopScreensaver();
                return "Screensaver stopped.";
            }

            if (/^(?:empty|clear)\s+(?:trash|recycle\s+bin)$/i.test(stripped)) {
                if (window.FileSystem?.emptyRecycleBin) {
                    window.FileSystem.emptyRecycleBin();
                    return "🗑️ Recycle Bin emptied.";
                }
                return "Recycle Bin is ready.";
            }

            const toastMatch = stripped.match(/^(?:notify|toast|remind\s+me(?:\s+to)?)\s+(.+)$/i);
            if (toastMatch) {
                const msg = toastMatch[1].trim();
                if (window.showDesktopToast) window.showDesktopToast(msg);
                return `🔔 Notification posted: "${msg}"`;
            }

            // 3. Date & Time
            if (/^(?:what\s+time\s+is\s+it|time|current\s+time|what\s+is\s+the\s+time|clock)$/i.test(stripped)) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
                return `🕒 Current Time: **${timeStr}** (${tz})`;
            }
            if (/^(?:what\s+day\s+is\s+today|what\s+is\s+the\s+date|what\s+date\s+is\s+today|date|today(?:'s)?\s+date|day)$/i.test(stripped)) {
                const now = new Date();
                const dateStr = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                return `📅 Today is **${dateStr}**.`;
            }

            // 4. Safe Math & Calculations
            const mathMatch = stripped.match(/^(?:calculate|calc|what\s+is|compute)?\s*([0-9\s.+\-*/×÷%^()]+|sqrt\([0-9.]+\)|round\([0-9.]+\)|[\d.]+\s*(?:%|percent)(?:\s+of)?\s*[\d.]+|[\d.]+\s+(?:plus|minus|times|divided\s+by)\s+[\d.]+|square\s+root\s+of\s+[\d.]+)$/i);
            if (mathMatch && mathMatch[1]) {
                const mathResult = safeEvalMath(mathMatch[1]);
                if (mathResult) return mathResult.text;
            }

            // 5. Unit Conversions
            const convResult = handleConversions(stripped);
            if (convResult) return convResult;

            // 6. System Status & Specs
            if (/^(?:system\s+status|sysinfo|system\s+info|specs|about\s+system)$/i.test(stripped)) {
                const isPriv = typeof window.isPrivateUser === "function" ? window.isPrivateUser() : false;
                const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
                const openApps = Array.from(window.state?.openApps || []);
                const vol = window.state?.volume ?? 70;
                const wall = window.state?.wallpaper ?? "aurora";
                const theme = window.state?.themeId ?? "dark";
                const res = `${window.innerWidth || 1920}x${window.innerHeight || 1080}`;
                const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

                return [
                    "💻 **PortfoliOS System Status**:",
                    `- **Profile**: ${isPriv ? "Private Synced Session" : `Owner (${currentUser?.id || "bl4ut0"})`}`,
                    `- **Resolution**: ${res} (${window.state?.desktopResolution || "Auto"})`,
                    `- **Open Apps**: ${openApps.length ? openApps.map(getAppTitle).join(", ") : "None"}`,
                    `- **Theme**: \`${theme}\` | **Wallpaper**: \`${wall}\``,
                    `- **Volume**: ${vol}%`,
                    `- **Hardware**: ${cores} logical CPU cores`
                ].join("\n");
            }

            // 7. Developer & Productivity Utilities
            if (/^(?:uuid|generate\s+uuid|random\s+uuid|guid)$/i.test(stripped)) {
                return `🔑 Generated UUID:\n\`${generateUUID()}\``;
            }

            if (/^(?:flip\s+a\s+coin|coin\s+flip|heads\s+or\s+tails)$/i.test(stripped)) {
                const res = Math.random() < 0.5 ? "Heads" : "Tails";
                return `🪙 Coin Flip: **${res}**`;
            }

            const diceMatch = stripped.match(/^(?:roll\s+a\s+dice|roll\s+dice|roll\s+d(\d+))$/i);
            if (diceMatch) {
                const sides = diceMatch[1] ? parseInt(diceMatch[1], 10) : 6;
                const roll = Math.floor(Math.random() * sides) + 1;
                return `🎲 Dice Roll (d${sides}): **${roll}**`;
            }

            const randMatch = stripped.match(/^random\s+number(?:\s+between\s+(\d+)\s+and\s+(\d+))?$/i);
            if (randMatch) {
                const min = randMatch[1] ? parseInt(randMatch[1], 10) : 1;
                const max = randMatch[2] ? parseInt(randMatch[2], 10) : 100;
                const num = Math.floor(Math.random() * (max - min + 1)) + min;
                return `🎲 Random Number (${min}–${max}): **${num}**`;
            }

            const b64Enc = stripped.match(/^base64\s+encode\s+(.+)$/i);
            if (b64Enc) {
                try {
                    return `🔐 **Base64 Encoded**:\n\`${base64Encode(b64Enc[1])}\``;
                } catch { return "Failed to base64 encode input."; }
            }
            const b64Dec = stripped.match(/^base64\s+decode\s+([a-z0-9+/=]+)$/i);
            if (b64Dec) {
                try {
                    return `🔓 **Base64 Decoded**:\n\`${base64Decode(b64Dec[1])}\``;
                } catch { return "Failed to base64 decode input."; }
            }

            if (/^lorem(?:\s+ipsum)?$/i.test(stripped)) {
                return "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
            }

            // 8. Office & Spreadsheet Formulas
            if (/(?:formula|spreadsheet|vlookup|xlookup|sum\s+function|average\s+function|countif|index\s+match)/i.test(stripped)) {
                if (/vlookup/i.test(stripped)) {
                    return "📊 **=VLOOKUP(search_key, range, index, [is_sorted])**\nSearches down the first column of a range and returns the value of a specified cell in the row found.\n\n*Example*:\n`=VLOOKUP(A2, D2:G100, 3, FALSE)`";
                }
                if (/xlookup/i.test(stripped)) {
                    return "📊 **=XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode])**\nModern, flexible replacement for VLOOKUP and HLOOKUP that searches in any direction.\n\n*Example*:\n`=XLOOKUP(A2, D2:D100, G2:G100, \"Not Found\")`";
                }
                if (/(?:sum|add\s+numbers)/i.test(stripped)) {
                    return "📊 **=SUM(range1, [range2, ...])**\nCalculates the sum of all numeric values across one or more cell ranges.\n\n*Example*:\n`=SUM(B2:B15)` or `=SUM(A1:A10, C1:C10)`";
                }
                if (/average/i.test(stripped)) {
                    return "📊 **=AVERAGE(range1, [range2, ...])**\nComputes the arithmetic mean of numeric values in the specified ranges.\n\n*Example*:\n`=AVERAGE(C2:C50)`";
                }
                if (/(?:if\s+formula|if\s+function|conditional)/i.test(stripped)) {
                    return "📊 **=IF(logical_expression, value_if_true, [value_if_false])**\nReturns one value if a condition evaluates to TRUE and another if FALSE.\n\n*Example*:\n`=IF(B2 >= 70, \"Pass\", \"Fail\")`";
                }
                if (/countif/i.test(stripped)) {
                    return "📊 **=COUNTIF(range, criterion)**\nCounts the number of cells within a range that meet a specified condition.\n\n*Example*:\n`=COUNTIF(D2:D50, \">100\")`";
                }
                return "📊 **Common Spreadsheet Formulas**:\n- `=SUM(A1:A10)` - Add numbers in a range\n- `=AVERAGE(B1:B20)` - Arithmetic mean\n- `=IF(condition, true_val, false_val)` - Conditional check\n- `=VLOOKUP(key, range, col_index, FALSE)` - Vertical search\n- `=COUNT(A1:A50)` - Count numeric cells";
            }

            if (/(?:cli\s+help|terminal\s+help|how\s+to\s+use\s+(?:cli|terminal)|cli\s+commands)/i.test(stripped)) {
                return [
                    "💻 **PortfoliOS CLI Quick Reference**:",
                    "- `ls [path]` - List directory contents",
                    "- `cd <path>` - Change active directory",
                    "- `cat <file>` - View text file contents",
                    "- `pwd` - Print current directory path",
                    "- `open <app>` - Launch an application or game",
                    "- `status` - System & service status",
                    "- `projects` - List active project nodes",
                    "- `jobs` - View background generation jobs",
                    "- `clear` - Clear terminal screen",
                    "Type `help` for a full list of commands."
                ].join("\n");
            }

            // 9. Standard Preserved Answers
            const isPrivate = typeof window.isPrivateUser === "function" ? window.isPrivateUser() : false;
            if (isPrivate) {
                if (/(who|about|yourself)/.test(query)) {
                    return "I am a simulated assistant running inside a private PortfoliOS profile. Owner-specific identity and project links are hidden in this session.";
                }
                if (/(project|portfolio|built)/.test(query)) {
                    return "This private profile exposes only the shared desktop shell and available apps. Use `projects` or open the Store to see what is available here.";
                }
                if (/(contact|discord|github|email|phone)/.test(query)) {
                    return "Owner contact links are not exposed in private profile mode.";
                }
            }

            if (/(who|about|yourself|owner|alex|mammen)/.test(query)) {
                return "I am a simulated assistant built into **PortfoliOS**. I can tell you about Alex (Bl4ut0), an infrastructure operator and systems builder focused on connecting self-hosted tools and gaming ecosystems.";
            }
            if (/(project|portfolio|built|apps)/.test(query)) {
                return "There are several active nodes in the portfolio:\n**Bl4ut0.dev** - The main dev portal.\n**GuildCraft** - A gaming community platform.\n**DOOM Source** - An embedded WASM Doom engine.\nType `projects` or `status` to see standard system lists.";
            }
            if (/(skill|tech|stack|experience|code|language)/.test(query)) {
                return "Core skills include:\n- **Infrastructure**: Linux, Proxmox, Docker, Cloudflare\n- **Development**: Node.js, Lua (WoW), React, Python\n- **Operations**: Self-hosting, homelab automation, system administration";
            }
            if (/(contact|discord|github|link|social)/.test(query)) {
                return "You can find Alex on:\n- **GitHub**: github.com/Bl4ut0\n- **Discord**: discord.gg/fEwanmFR9m\nType `links` for a full directory.";
            }
            if (/(hello|hi|hey|greetings)/.test(query)) {
                return "Hello! I'm the PortfoliOS Assistant. How can I help you navigate the system today?";
            }
            if (/(doom|game|play|diablo|quake)/.test(query)) {
                return "Ah, games! You can play DOOM, Diablo, or Quake right here in the browser. Type `play doom` in the CLI or select a game from the desktop.";
            }
            if (/clear/.test(query)) {
                return "Type `clear` as a raw command to clear the terminal screen.";
            }
            if (/(joke|funny)/.test(query)) {
                return "Why do programmers prefer dark mode?\nBecause light attracts bugs.";
            }
            if (/(purpose|what is this|help|command)/.test(query)) {
                return "PortfoliOS is a personal browser-native OS showcasing Alex's work. Try typing standard system commands like `help`, `projects`, `status`, or `ls`.";
            }

            // Conversational fallback for unmatched queries
            if (query.includes("?") || /\b(what|how|why|who|where|can|tell|show|explain|help|info|status|do)\b/.test(query) || query.split(/\s+/).length > 1) {
                return "I'm an offline rule-based helper. I can launch apps, control desktop settings (wallpaper, theme, volume), perform calculations, convert units, and answer questions about PortfoliOS.\n\nTry:\n- `open doom` or `open files`\n- `set wallpaper matrix`\n- `set volume to 80%`\n- `calculate 15 * 80`\n- `what time is it`";
            }

            return null;
        }
    };
})();
