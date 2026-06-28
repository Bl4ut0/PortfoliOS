/**
 * PortfoliOS: Preferences and UI Customization
 * Controls user preferences like wallpaper, volume level, theme colors, display scaling, and notification toast.
 */

window.postVolumeToGameFrame = (iframe) => {
    if (!iframe?.contentWindow) return;
    window.postMessageToIframe?.(iframe, { type: "volume", value: state.volume });
};

window.configureGameVolume = (root = document) => {
    root.querySelectorAll?.("iframe.game-frame").forEach(window.postVolumeToGameFrame);
    if (window.appRegistry && window.appRegistry.doomsource && typeof window.appRegistry.doomsource.setVolume === "function") {
        window.appRegistry.doomsource.setVolume(state.volume);
    }
    window.PortfolioOSAppFramework?.applyVolumeToRegisteredApps(state.volume);
};

window.focusGameIframe = (iframe) => {
    if (!iframe) return;
    window.setTimeout(() => {
        iframe.focus({ preventScroll: true });
        try {
            iframe.contentWindow?.focus();
            window.postMessageToIframe?.(iframe, { type: "focus-game" });
        } catch (error) {}
    }, 40);
};

window.syncGameIframe = (windowEl) => {
    const iframe = windowEl?.querySelector("iframe.game-frame");
    if (!iframe) return;

    if (iframe.dataset.gameSyncBound !== "true") {
        iframe.dataset.gameSyncBound = "true";
        iframe.addEventListener("load", () => {
            window.postVolumeToGameFrame(iframe);
            window.focusGameIframe(iframe);
        });
    }

    window.postVolumeToGameFrame(iframe);
    window.focusGameIframe(iframe);
};

window.showGameControls = (windowEl) => {
    const controls = windowEl?.querySelector("[data-game-controls]");
    if (!controls) return;
    controls.classList.remove("is-hidden");
};

window.handleGameRuntimeMessage = (event) => {
    const data = event.data || {};
    if (data.type !== "game-pointer-release") return;

    const now = Date.now();
    if (now - (window.handleGameRuntimeMessage.lastShown || 0) < 900) return;
    window.handleGameRuntimeMessage.lastShown = now;
    window.showDesktopToast("Cursor released to PortfoliOS.");
};

window.applyVolume = () => {
    const volume = Math.max(0, Math.min(100, Number(state.volume) || 0));
    state.volume = volume;
    document.documentElement.style.setProperty("--desktop-volume", String(volume / 100));
    
    const volInput = window.byId ? window.byId("desktop-volume") : document.getElementById("desktop-volume");
    const volVal = window.byId ? window.byId("desktop-volume-value") : document.getElementById("desktop-volume-value");
    if (volInput) volInput.value = String(volume);
    if (volVal) volVal.textContent = `${volume}%`;
    
    const volToggle = window.byId ? window.byId("volume-toggle") : document.getElementById("volume-toggle");
    if (volToggle) volToggle.setAttribute("aria-label", `Volume ${volume}%`);
    
    const volumeIcon = window.byId ? window.byId("taskbar-volume-icon") : document.getElementById("taskbar-volume-icon");
    if (volumeIcon) {
        volumeIcon.className = volume === 0
            ? "fa-solid fa-volume-xmark"
            : volume < 45
                ? "fa-solid fa-volume-low"
                : "fa-solid fa-volume-high";
    }
    document.querySelectorAll("audio, video").forEach((media) => {
        media.volume = volume / 100;
    });
    window.configureGameVolume();
};

window.getPortfolioThemeOptions = () => {
    const fallbackTheme = {
        id: "dark",
        label: "Dark",
        colorScheme: "dark",
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
    };
    return Array.isArray(window.portfolioThemes) && window.portfolioThemes.length
        ? window.portfolioThemes
        : [fallbackTheme];
};

window.getPortfolioTheme = (themeId = state.themeId) => {
    const themes = window.getPortfolioThemeOptions();
    return themes.find((theme) => theme.id === themeId) || themes[0];
};

window.getScreensaverOptions = () => {
    const fallback = [
        { id: "none", label: "None", icon: "fa-solid fa-ban", description: "Keep the desktop visible." }
    ];
    return Array.isArray(window.screensaverOptions) && window.screensaverOptions.length
        ? window.screensaverOptions
        : fallback;
};

window.getScreensaverOption = (screensaverId = state.screensaver) => {
    const options = window.getScreensaverOptions();
    return options.find((option) => option.id === screensaverId) || options[0];
};

window.applyThemeColors = () => {
    const primaryPicker = window.byId ? window.byId("theme-primary-picker") : document.getElementById("theme-primary-picker");
    const accentPicker = window.byId ? window.byId("theme-accent-picker") : document.getElementById("theme-accent-picker");
    const theme = window.getPortfolioTheme();
    const tokens = theme.tokens || {};

    document.documentElement.dataset.theme = theme.id;
    document.documentElement.style.colorScheme = theme.colorScheme || "dark";
    if (document.body) {
        document.body.dataset.theme = theme.id;
    }

    Object.entries(tokens).forEach(([name, value]) => {
        document.documentElement.style.setProperty(name, value);
    });

    if (state.themePrimary) {
        document.documentElement.style.setProperty("--theme-primary", state.themePrimary);
    }
    if (state.themeAccent) {
        document.documentElement.style.setProperty("--theme-accent", state.themeAccent);
    }

    const currentPrimary = state.themePrimary || tokens["--theme-primary"] || "#22d3ee";
    const currentAccent = state.themeAccent || tokens["--theme-accent"] || "#34d399";
    if (primaryPicker) primaryPicker.value = currentPrimary;
    if (accentPicker) accentPicker.value = currentAccent;
    if (window.renderThemeOptions) window.renderThemeOptions();
};

window.applyDesktopResolution = () => {
    const experience = window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience");
    if (!experience) return;
    
    const mode = state.desktopResolution || "auto";
    const resetBtn = window.byId ? window.byId("reset-resolution-btn") : document.getElementById("reset-resolution-btn");
    
    if (mode === "auto") {
        if (resetBtn) resetBtn.style.display = "none";
        document.body.classList.remove("desktop-scaled");
        experience.style.position = "";
        experience.style.left = "";
        experience.style.top = "";
        experience.style.width = "";
        experience.style.height = "";
        experience.style.transform = "";
        experience.style.transformOrigin = "";
        return;
    }
    
    if (resetBtn) resetBtn.style.display = "inline-flex";
    document.body.classList.add("desktop-scaled");
    const [targetW, targetH] = mode.split("x").map(Number);
    experience.style.width = targetW + "px";
    experience.style.height = targetH + "px";
    
    const parent = experience.parentElement;
    if (!parent) return;
    const parentW = parent.clientWidth;
    const parentH = parent.clientHeight;
    if (!parentW || !parentH) return;
    
    const scaleW = parentW / targetW;
    const scaleH = parentH / targetH;
    const scale = Math.min(scaleW, scaleH, 1);
    
    experience.style.position = "absolute";
    experience.style.left = "50%";
    experience.style.top = "50%";
    experience.style.transform = `translate(-50%, -50%) scale(${scale})`;
    experience.style.transformOrigin = "center center";
};

window.applyDesktopPreferences = () => {
    const desktop = window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience");
    if (desktop) desktop.dataset.wallpaper = state.wallpaper;
    
    if (window.renderWallpaperOptions) window.renderWallpaperOptions();
    window.applyVolume();
    window.applyThemeColors();
    window.applyDesktopResolution();
    window.applyScreensaverPreferences();
    if (window.updateMatrixRain) window.updateMatrixRain(state.wallpaper);
    
    const resSelect = window.byId ? window.byId("desktop-resolution-select") : document.getElementById("desktop-resolution-select");
    if (resSelect) resSelect.value = state.desktopResolution;
};

window.getPreferencesKey = (k, userId = window.state?.currentUserId || "bl4ut0") => {
    const safeUserId = String(userId || "bl4ut0").replace(/[^a-z0-9_-]/gi, "") || "bl4ut0";
    return `bl4ut0_${safeUserId}_${k}`;
};

window.setPortfolioTheme = (themeId, options = {}) => {
    const theme = window.getPortfolioTheme(themeId);
    state.themeId = theme.id;

    if (options.clearOverrides !== false) {
        state.themePrimary = null;
        state.themeAccent = null;
        if (window.Storage) {
            window.Storage.local.remove(window.getPreferencesKey("ThemePrimary"));
            window.Storage.local.remove(window.getPreferencesKey("ThemeAccent"));
        }
    }

    if (window.Storage) {
        window.Storage.local.set(window.getPreferencesKey("ThemeId"), theme.id);
    }
    window.applyThemeColors();
    if (window.EventBus) window.EventBus.emit("theme:changed", { themeId: theme.id, theme });
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.setWallpaper = (wallpaperId) => {
    const options = window.wallpaperOptions || [];
    if (!options.some((wallpaper) => wallpaper.id === wallpaperId)) return;
    state.wallpaper = wallpaperId;
    if (window.Storage) {
        window.Storage.local.set(window.getPreferencesKey("Wallpaper"), wallpaperId);
    }
    window.applyDesktopPreferences();
    if (window.EventBus) window.EventBus.emit("wallpaper:changed", wallpaperId);
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.renderScreensaverStage = () => {
    const overlay = window.byId ? window.byId("desktop-screensaver") : document.getElementById("desktop-screensaver");
    if (!overlay) return;

    const screensaver = state.screensaver || "none";
    const stars = Array.from({ length: 72 }, (_, index) => {
        const angle = ((index * 137) % 360) * (Math.PI / 180);
        const distance = 24 + ((index * 19) % 72);
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance * 0.68;
        const size = 1 + (index % 5);
        const duration = 2.6 + (index % 7) * 0.2;
        return `<span style="--i:${index}; --tx:${tx.toFixed(1)}vw; --ty:${ty.toFixed(1)}vh; --size:${size}px; --duration:${duration.toFixed(2)}s;"></span>`;
    }).join("");
    const lines = Array.from({ length: 8 }, (_, index) => {
        const width = 24 + (index % 4) * 8;
        const height = 12 + (index % 3) * 7;
        const x = -16 + (index % 5) * 8;
        const y = -10 + (index % 4) * 5;
        return `<span style="--i:${index}; --w:${width}vw; --h:${height}vh; --x:${x}vw; --y:${y}vh;"></span>`;
    }).join("");
    const windows = Array.from({ length: 14 }, (_, index) => {
        const x = -24 - ((index * 13) % 38);
        const y = 6 + ((index * 19) % 82);
        const size = 2.6 + (index % 4) * 0.46;
        return `<span style="--i:${index}; --x:${x}vw; --y:${y}vh; --s:${size}rem;"><i class="fa-brands fa-windows"></i></span>`;
    }).join("");
    const pipeTypes = ["horizontal", "vertical", "elbow", "horizontal", "vertical", "tee"];
    const pipes = Array.from({ length: 28 }, (_, index) => {
        const type = pipeTypes[index % pipeTypes.length];
        const x = (index * 23) % 96;
        const y = (index * 37) % 88;
        const len = 3.6 + (index % 5) * 1.1;
        const hue = (index * 41) % 360;
        return `<span class="pipe pipe-${type}" style="--i:${index}; --x:${x}vw; --y:${y}vh; --len:${len.toFixed(1)}rem; --hue:${hue};"></span>`;
    }).join("");
    const mazeWalls = Array.from({ length: 24 }, (_, index) => {
        const sideName = index % 3 === 0 ? "left" : index % 3 === 1 ? "right" : "block";
        const top = 10 + (index % 5) * 12;
        const height = 18 + (index % 4) * 7;
        const width = sideName === "block" ? 12 + (index % 3) * 5 : 20 + (index % 4) * 5;
        return `<span class="maze-wall maze-wall-${sideName}" style="--i:${index}; --top:${top}%; --wall-h:${height}vh; --wall-w:${width}vw;"></span>`;
    }).join("");

    const templates = {
        blank: '<div class="screensaver-blank" aria-hidden="true"></div>',
        starfield: `<div class="screensaver-starfield" aria-hidden="true">${stars}</div>`,
        mystify: `<div class="screensaver-mystify" aria-hidden="true">${lines}</div>`,
        "flying-windows": `<div class="screensaver-flying-windows" aria-hidden="true">${windows}</div>`,
        "dvd-bounce": '<div class="screensaver-dvd-bounce" aria-hidden="true"><span class="dvd-logo-bouncer"><b>PortfoliOS</b><small>VIDEO</small></span></div>',
        pipes: `<div class="screensaver-pipes" aria-hidden="true">${pipes}</div>`,
        maze: `<div class="screensaver-maze" aria-hidden="true"><div class="maze-viewport">${mazeWalls}</div></div>`,
        marquee: '<div class="screensaver-marquee" aria-hidden="true"><span data-text="PortfoliOS">PortfoliOS</span></div>'
    };

    overlay.dataset.screensaver = screensaver;
    overlay.innerHTML = templates[screensaver] || "";
};

window.startScreensaver = (options = {}) => {
    const overlay = window.byId ? window.byId("desktop-screensaver") : document.getElementById("desktop-screensaver");
    if (!overlay || state.screensaver === "none") {
        if (options.preview && window.showDesktopToast) window.showDesktopToast("Choose a screensaver first.");
        return;
    }

    window.clearTimeout(window.screensaverTimer);
    window.renderScreensaverStage();
    overlay.hidden = false;
    overlay.classList.add("active");
    document.body.classList.add("screensaver-active");
};

window.stopScreensaver = () => {
    const overlay = window.byId ? window.byId("desktop-screensaver") : document.getElementById("desktop-screensaver");
    const wasActive = overlay && !overlay.hidden;

    if (overlay) {
        overlay.classList.remove("active");
        overlay.hidden = true;
    }
    document.body.classList.remove("screensaver-active");

    if (wasActive || state.screensaver !== "none") {
        window.scheduleScreensaver();
    }
};

window.scheduleScreensaver = () => {
    window.clearTimeout(window.screensaverTimer);
    if (!state || state.screensaver === "none") return;

    const delayMinutes = Math.max(1, Math.min(60, Number(state.screensaverDelay) || 5));
    window.screensaverTimer = window.setTimeout(() => {
        if (document.hidden || !state.systemStarted) {
            window.scheduleScreensaver();
            return;
        }
        window.startScreensaver();
    }, delayMinutes * 60000);
};

window.bindScreensaverActivity = () => {
    if (window.screensaverActivityBound) return;
    window.screensaverActivityBound = true;
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((eventName) => {
        window.addEventListener(eventName, () => {
            const overlay = window.byId ? window.byId("desktop-screensaver") : document.getElementById("desktop-screensaver");
            if (overlay && !overlay.hidden) {
                window.stopScreensaver();
            } else {
                window.scheduleScreensaver();
            }
        }, { passive: true });
    });
};

window.applyScreensaverPreferences = () => {
    window.bindScreensaverActivity();

    const option = window.getScreensaverOption();
    if (state.screensaver !== option.id) {
        state.screensaver = option.id;
    }

    const delaySelect = window.byId ? window.byId("screensaver-delay-select") : document.getElementById("screensaver-delay-select");
    if (delaySelect) delaySelect.value = String(state.screensaverDelay || 5);

    if (window.renderScreensaverOptions) window.renderScreensaverOptions();
    window.renderScreensaverStage();
    window.scheduleScreensaver();
};

window.setScreensaver = (screensaverId) => {
    const options = window.getScreensaverOptions();
    if (!options.some((option) => option.id === screensaverId)) return;
    state.screensaver = screensaverId;
    if (window.Storage) {
        window.Storage.local.set(window.getPreferencesKey("Screensaver"), screensaverId);
    }
    window.applyScreensaverPreferences();
    if (window.EventBus) window.EventBus.emit("screensaver:changed", { screensaverId });
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.setScreensaverDelay = (minutes) => {
    state.screensaverDelay = Math.max(1, Math.min(60, Number(minutes) || 5));
    if (window.Storage) {
        window.Storage.local.set(window.getPreferencesKey("ScreensaverDelay"), String(state.screensaverDelay));
    }
    window.applyScreensaverPreferences();
    if (window.EventBus) window.EventBus.emit("screensaver:delay-changed", { delay: state.screensaverDelay });
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.setDesktopVolume = (value) => {
    state.volume = Math.max(0, Math.min(100, Number(value) || 0));
    if (window.Storage) {
        window.Storage.local.set(window.getPreferencesKey("Volume"), String(state.volume));
    }
    window.applyVolume();
    if (window.EventBus) window.EventBus.emit("volume:changed", state.volume);
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.setThemeColor = (type, value) => {
    if (type === "primary") {
        state.themePrimary = value;
        if (window.Storage) window.Storage.local.set(window.getPreferencesKey("ThemePrimary"), value);
    } else if (type === "accent") {
        state.themeAccent = value;
        if (window.Storage) window.Storage.local.set(window.getPreferencesKey("ThemeAccent"), value);
    }
    window.applyThemeColors();
    if (window.EventBus) window.EventBus.emit("theme:changed", { themeId: state.themeId, type, value });
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.resetThemeColors = () => {
    state.themePrimary = null;
    state.themeAccent = null;
    if (window.Storage) {
        window.Storage.local.remove(window.getPreferencesKey("ThemePrimary"));
        window.Storage.local.remove(window.getPreferencesKey("ThemeAccent"));
    }
    window.applyThemeColors();
    if (window.EventBus) window.EventBus.emit("theme:reset", { themeId: state.themeId });
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.showDesktopToast = (message) => {
    const toast = window.byId ? window.byId("desktop-toast") : document.getElementById("desktop-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(window.showDesktopToast.timer);
    window.showDesktopToast.timer = window.setTimeout(() => {
        toast.hidden = true;
    }, 1800);
};

window.addEventListener("message", window.handleGameRuntimeMessage);
