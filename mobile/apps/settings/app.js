(function() {
    let activeController = null;

    const fallbackWallpapers = [
        { id: "aurora", label: "Aurora", icon: "fa-solid fa-wand-magic-sparkles" },
        { id: "ember", label: "Ember", icon: "fa-solid fa-fire" },
        { id: "forest", label: "Forest", icon: "fa-solid fa-tree" },
        { id: "graphite", label: "Graphite", icon: "fa-solid fa-circle-half-stroke" }
    ];
    const fallbackThemes = [
        { id: "dark", label: "Dark" },
        { id: "light", label: "Light" }
    ];
    const accentOptions = [
        { id: "cyan", label: "Cyan", color: "#22d3ee" },
        { id: "blue", label: "Blue", color: "#3b82f6" },
        { id: "violet", label: "Violet", color: "#a78bfa" },
        { id: "green", label: "Green", color: "#34d399" },
        { id: "amber", label: "Amber", color: "#f59e0b" }
    ];

    function escapeHtml(value) {
        return window.PortfolioOSMobileFramework?.escapeHtml?.(value)
            || String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
    }

    function getShellApi() {
        return window.MobileOS
            || window.PortfolioOSMobileShell
            || window.PortfolioOSMobile
            || window.mobileOS
            || null;
    }

    async function callApi(api, methodNames, ...args) {
        if (!api) return { handled: false, value: undefined };
        for (const methodName of methodNames) {
            if (typeof api[methodName] !== "function") continue;
            return { handled: true, value: await api[methodName].apply(api, args) };
        }
        return { handled: false, value: undefined };
    }

    async function getPreferences() {
        const api = getShellApi();
        let source = {};
        try {
            if (typeof api?.getPreferences === "function") {
                source = await api.getPreferences() || {};
            } else if (api?.preferences && typeof api.preferences === "object") {
                source = api.preferences;
            }
        } catch (error) {
            console.warn("PortfoliOS Mobile Settings: could not read shell preferences.", error);
        }

        const read = async (name, fallback) => {
            if (source[name] !== undefined) return source[name];
            if (typeof api?.getPreference === "function") {
                try {
                    const value = await api.getPreference(name);
                    if (value !== undefined) return value;
                } catch (error) {}
            }
            return fallback;
        };

        return {
            wallpaper: await read("wallpaper", window.state?.wallpaper || "aurora"),
            accent: await read("accent", source.accentColor || "cyan"),
            theme: await read("theme", source.themeId || window.state?.themeId || "dark"),
            navigation: await read("navigation", source.navigationMode || source.navMode || "gesture"),
            reducedMotion: Boolean(await read(
                "reducedMotion",
                window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false
            )),
            volume: Math.max(0, Math.min(100, Number(await read("volume", window.state?.volume ?? 70)) || 0)),
            locked: Boolean(await read("locked", false))
        };
    }

    function getWallpaperOptions() {
        const api = getShellApi();
        const options = typeof api?.getWallpaperOptions === "function"
            ? api.getWallpaperOptions()
            : null;
        return Array.isArray(options) && options.length ? options : fallbackWallpapers;
    }

    function getThemeOptions() {
        const api = getShellApi();
        const options = typeof api?.getThemeOptions === "function"
            ? api.getThemeOptions()
            : null;
        return Array.isArray(options) && options.length ? options : fallbackThemes;
    }

    function setStatus(root, message, tone = "neutral") {
        const status = root?.querySelector("[data-mobile-settings-status]");
        if (!status) return;
        status.textContent = message;
        status.dataset.tone = tone;
    }

    async function writePreference(name, value) {
        const api = getShellApi();
        const shellPreferenceName = name === "navigation" ? "navMode" : name;
        let result = name === "volume"
            ? { handled: false, value: undefined }
            : await callApi(api, ["setPreference"], shellPreferenceName, value);

        if (!result.handled) {
            const methods = {
                wallpaper: ["setWallpaper"],
                accent: ["setAccent", "setAccentColor"],
                theme: ["setTheme"],
                navigation: ["setNavigationMode", "setNavigation"],
                reducedMotion: ["setReducedMotion"],
                volume: ["setVolume"]
            };
            result = await callApi(api, methods[name] || [], value);
        }

        if (result.handled) {
            if (result.value === false) throw new Error(`${name} is not available in this shell.`);
            return true;
        }

        if (name === "wallpaper" && typeof window.setWallpaper === "function") {
            if (Array.isArray(window.wallpaperOptions)
                && !window.wallpaperOptions.some((option) => option.id === value)) return false;
            window.setWallpaper(value);
            return true;
        }
        if (name === "accent" && typeof window.setThemeColor === "function") {
            const color = accentOptions.find((option) => option.id === value)?.color;
            if (!color) return false;
            window.setThemeColor("primary", color);
            return true;
        }
        if (name === "theme" && typeof window.setPortfolioTheme === "function") {
            window.setPortfolioTheme(value);
            return true;
        }
        if (name === "volume" && typeof window.setDesktopVolume === "function") {
            window.setDesktopVolume(value);
            return true;
        }

        return false;
    }

    function formatBytes(value) {
        const bytes = Number(value);
        if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
        if (bytes < 1024) return `${bytes} B`;
        const units = ["KB", "MB", "GB", "TB"];
        let size = bytes / 1024;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex += 1;
        }
        return `${size >= 100 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
    }

    async function refreshStorageSummary(root) {
        const summary = root?.querySelector("[data-mobile-storage-summary]");
        if (!summary) return;
        summary.textContent = "Checking browser storage…";

        try {
            const api = getShellApi();
            const apiResult = await callApi(api, ["getStorageSummary", "estimateStorage"]);
            const estimate = apiResult.handled
                ? apiResult.value || {}
                : await navigator.storage?.estimate?.() || {};
            const persisted = typeof estimate.persisted === "boolean"
                ? estimate.persisted
                : await navigator.storage?.persisted?.();
            const usage = formatBytes(estimate.usage);
            const quota = formatBytes(estimate.quota);
            const files = Number.isFinite(Number(estimate.fileCount))
                ? ` · ${Number(estimate.fileCount)} files`
                : "";
            summary.textContent = `${usage} used of ${quota}${files}${persisted ? " · persistent" : ""}`;
        } catch (error) {
            summary.textContent = "Storage details are unavailable in this browser.";
        }
    }

    function updateSelection(root, group, value) {
        root?.querySelectorAll(`[data-settings-${group}]`).forEach((button) => {
            const selected = button.dataset[`settings${group[0].toUpperCase()}${group.slice(1)}`] === String(value);
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    async function refreshControls(root) {
        const preferences = await getPreferences();
        updateSelection(root, "wallpaper", preferences.wallpaper);
        updateSelection(root, "theme", preferences.theme);
        updateSelection(root, "accent", preferences.accent);
        updateSelection(root, "nav", preferences.navigation);

        const reducedMotion = root?.querySelector("[data-settings-reduced-motion]");
        if (reducedMotion) reducedMotion.checked = preferences.reducedMotion;
        const volume = root?.querySelector("[data-settings-volume]");
        const volumeValue = root?.querySelector("[data-settings-volume-value]");
        if (volume) volume.value = String(preferences.volume);
        if (volumeValue) volumeValue.textContent = `${preferences.volume}%`;
    }

    async function requestFullscreen(root) {
        const api = getShellApi();
        try {
            let result;
            if (document.fullscreenElement) {
                result = await callApi(api, ["exitFullscreen"]);
                if (!result.handled && typeof document.exitFullscreen === "function") await document.exitFullscreen();
            } else {
                result = await callApi(api, ["requestFullscreen", "enterFullscreen"]);
                if (!result.handled && typeof document.documentElement.requestFullscreen === "function") {
                    await document.documentElement.requestFullscreen();
                } else if (!result.handled) {
                    throw new Error("Fullscreen is not supported here. Add the site to your home screen instead.");
                }
            }
            setStatus(root, document.fullscreenElement ? "Fullscreen enabled." : "Fullscreen closed.", "success");
        } catch (error) {
            setStatus(root, error.message || "Fullscreen could not be changed.", "error");
        }
    }

    async function lockDevice(root) {
        const result = await callApi(getShellApi(), ["lock", "lockDevice", "showLockScreen"]);
        setStatus(
            root,
            result.handled && result.value !== false
                ? "Device locked."
                : "The lock screen is not available in this browser session.",
            result.handled && result.value !== false ? "success" : "error"
        );
    }

    async function installExperience(root) {
        const result = await callApi(getShellApi(), ["install", "installExperience"]);
        setStatus(
            root,
            result.handled && result.value !== false
                ? "Install prompt opened."
                : "Use your browser menu and choose Add to Home Screen.",
            result.handled && result.value !== false ? "success" : "neutral"
        );
    }

    async function switchExperience(root, view) {
        const apiResult = await callApi(getShellApi(), ["switchExperience", "switchView"], view);
        if (apiResult.handled && apiResult.value !== false) return;
        const fallback = window.switchExperience || window.switchView;
        if (typeof fallback === "function") {
            fallback(view);
            return;
        }
        setStatus(root, `${view} is unavailable in this session.`, "error");
    }

    async function applyPreference(root, name, value, successMessage) {
        try {
            const handled = await writePreference(name, value);
            if (!handled) throw new Error(`${name} is not supported by this MobileOS shell.`);
            setStatus(root, successMessage, "success");
            await refreshControls(root);
        } catch (error) {
            setStatus(root, error.message || "That setting could not be changed.", "error");
            await refreshControls(root);
        }
    }

    async function bind(root) {
        activeController?.abort();
        activeController = new AbortController();
        const { signal } = activeController;

        root.addEventListener("click", async (event) => {
            const wallpaper = event.target.closest("[data-settings-wallpaper]");
            if (wallpaper) {
                await applyPreference(root, "wallpaper", wallpaper.dataset.settingsWallpaper, "Wallpaper updated.");
                return;
            }

            const theme = event.target.closest("[data-settings-theme]");
            if (theme) {
                await applyPreference(root, "theme", theme.dataset.settingsTheme, "Theme updated.");
                return;
            }

            const accent = event.target.closest("[data-settings-accent]");
            if (accent) {
                await applyPreference(root, "accent", accent.dataset.settingsAccent, "Accent color updated.");
                return;
            }

            const navigation = event.target.closest("[data-settings-nav]");
            if (navigation) {
                await applyPreference(root, "navigation", navigation.dataset.settingsNav, "Navigation mode updated.");
                return;
            }

            const experience = event.target.closest("[data-settings-experience]");
            if (experience) {
                await switchExperience(root, experience.dataset.settingsExperience);
                return;
            }

            if (event.target.closest("[data-settings-fullscreen]")) {
                await requestFullscreen(root);
                return;
            }
            if (event.target.closest("[data-settings-lock]")) {
                await lockDevice(root);
                return;
            }
            if (event.target.closest("[data-settings-install]")) {
                await installExperience(root);
                return;
            }
            if (event.target.closest("[data-settings-storage-refresh]")) {
                await refreshStorageSummary(root);
            }
        }, { signal });

        root.addEventListener("change", async (event) => {
            if (event.target.matches("[data-settings-reduced-motion]")) {
                await applyPreference(root, "reducedMotion", event.target.checked, "Motion preference updated.");
            } else if (event.target.matches("[data-settings-volume]")) {
                await applyPreference(root, "volume", Number(event.target.value), "Volume updated.");
            }
        }, { signal });

        root.addEventListener("input", (event) => {
            if (!event.target.matches("[data-settings-volume]")) return;
            const label = root.querySelector("[data-settings-volume-value]");
            if (label) label.textContent = `${event.target.value}%`;
        }, { signal });

        document.addEventListener("fullscreenchange", () => {
            const button = root.querySelector("[data-settings-fullscreen]");
            if (button) {
                button.innerHTML = document.fullscreenElement
                    ? '<i class="fa-solid fa-compress"></i><span>Exit fullscreen</span>'
                    : '<i class="fa-solid fa-expand"></i><span>Go fullscreen</span>';
            }
        }, { signal });

        await Promise.all([refreshControls(root), refreshStorageSummary(root)]);
    }

    function renderChoiceButtons(options, attribute) {
        return options.map((option) => `
            <button type="button" class="mobile-settings-choice" ${attribute}="${escapeHtml(option.id)}" aria-pressed="false">
                ${option.icon ? `<i class="${escapeHtml(option.icon)}"></i>` : ""}
                <span>${escapeHtml(option.label || option.id)}</span>
            </button>
        `).join("");
    }

    window.mobileAppRegistry.settings = {
        title: "Settings",
        icon: "fa-solid fa-gear",
        viewClass: "mobile-settings-app",
        render: () => `
            <header class="mobile-settings-heading">
                <span><i class="fa-solid fa-gear"></i></span>
                <div>
                    <p>MobileOS</p>
                    <h2>Settings</h2>
                    <small>Make this phone workspace yours.</small>
                </div>
            </header>

            <p class="mobile-settings-status" data-mobile-settings-status data-tone="neutral" aria-live="polite">Settings are stored by the active MobileOS shell.</p>

            <section class="mobile-settings-card">
                <div class="mobile-settings-section-title">
                    <i class="fa-solid fa-image"></i>
                    <div><h3>Wallpaper</h3><p>Choose a system background.</p></div>
                </div>
                <div class="mobile-settings-choice-grid mobile-settings-wallpapers">
                    ${renderChoiceButtons(getWallpaperOptions(), "data-settings-wallpaper")}
                </div>
            </section>

            <section class="mobile-settings-card">
                <div class="mobile-settings-section-title">
                    <i class="fa-solid fa-palette"></i>
                    <div><h3>Appearance</h3><p>Theme, color, and motion.</p></div>
                </div>
                <div class="mobile-settings-choice-grid">
                    ${renderChoiceButtons(getThemeOptions(), "data-settings-theme")}
                </div>
                <div class="mobile-settings-accent-grid" role="group" aria-label="Accent color">
                    ${accentOptions.map((option) => `
                        <button type="button" data-settings-accent="${option.id}" aria-label="${option.label}" aria-pressed="false" style="--settings-swatch:${option.color}">
                            <span></span><small>${option.label}</small>
                        </button>
                    `).join("")}
                </div>
                <label class="mobile-settings-row">
                    <span><strong>Reduce motion</strong><small>Use quieter system transitions.</small></span>
                    <input class="mobile-settings-switch" type="checkbox" data-settings-reduced-motion aria-label="Reduce motion">
                </label>
            </section>

            <section class="mobile-settings-card">
                <div class="mobile-settings-section-title">
                    <i class="fa-solid fa-volume-high"></i>
                    <div><h3>Sound</h3><p>Shared app and media volume.</p></div>
                </div>
                <label class="mobile-settings-volume" for="mobile-settings-volume">
                    <i class="fa-solid fa-volume-low"></i>
                    <input id="mobile-settings-volume" type="range" min="0" max="100" step="1" value="70" data-settings-volume>
                    <output data-settings-volume-value>70%</output>
                </label>
            </section>

            <section class="mobile-settings-card">
                <div class="mobile-settings-section-title">
                    <i class="fa-solid fa-mobile-screen-button"></i>
                    <div><h3>System navigation</h3><p>Gestures or familiar Android buttons.</p></div>
                </div>
                <div class="mobile-settings-choice-grid mobile-settings-navigation">
                    <button type="button" class="mobile-settings-choice" data-settings-nav="gesture" aria-pressed="false"><i class="fa-solid fa-grip-lines"></i><span>Gestures</span></button>
                    <button type="button" class="mobile-settings-choice" data-settings-nav="buttons" aria-pressed="false"><i class="fa-solid fa-ellipsis"></i><span>3-button</span></button>
                </div>
            </section>

            <section class="mobile-settings-card">
                <div class="mobile-settings-section-title">
                    <i class="fa-solid fa-hard-drive"></i>
                    <div><h3>Storage</h3><p data-mobile-storage-summary>Checking browser storage…</p></div>
                </div>
                <button type="button" class="mobile-settings-action" data-settings-storage-refresh><i class="fa-solid fa-rotate"></i><span>Refresh storage</span></button>
            </section>

            <section class="mobile-settings-card">
                <div class="mobile-settings-section-title">
                    <i class="fa-solid fa-shuffle"></i>
                    <div><h3>Experience</h3><p>Move between system surfaces.</p></div>
                </div>
                <div class="mobile-settings-experiences">
                    <button type="button" data-settings-experience="quick"><i class="fa-solid fa-bolt"></i><span>Quick Data</span></button>
                    <button type="button" data-settings-experience="desktop"><i class="fa-solid fa-desktop"></i><span>Desktop</span></button>
                </div>
            </section>

            <section class="mobile-settings-card mobile-settings-system-actions">
                <button type="button" class="mobile-settings-action" data-settings-fullscreen><i class="fa-solid fa-expand"></i><span>Go fullscreen</span></button>
                <button type="button" class="mobile-settings-action" data-settings-install><i class="fa-solid fa-mobile-screen-button"></i><span>Add to home screen</span></button>
                <button type="button" class="mobile-settings-action" data-settings-lock><i class="fa-solid fa-lock"></i><span>Lock now</span></button>
            </section>
        `,
        onOpen: bind,
        onResume: (root) => refreshControls(root),
        onClose: () => {
            activeController?.abort();
            activeController = null;
        }
    };
})();
