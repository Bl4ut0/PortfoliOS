/**
 * PortfoliOS: Preferences and UI Customization
 * Controls user preferences like wallpaper, volume level, theme colors, display scaling, and notification toast.
 */

window.postVolumeToGameFrame = (iframe) => {
    if (!iframe?.contentWindow) return;
    try {
        iframe.contentWindow.postMessage({ type: "volume", value: state.volume }, "*");
    } catch (error) {}
};

window.configureGameVolume = (root = document) => {
    root.querySelectorAll?.("iframe.game-frame").forEach(window.postVolumeToGameFrame);
    if (window.appRegistry && window.appRegistry.doomsource && typeof window.appRegistry.doomsource.setVolume === "function") {
        window.appRegistry.doomsource.setVolume(state.volume);
    }
};

window.focusGameIframe = (iframe) => {
    if (!iframe) return;
    window.setTimeout(() => {
        iframe.focus({ preventScroll: true });
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.postMessage({ type: "focus-game" }, "*");
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

window.applyThemeColors = () => {
    const primaryPicker = window.byId ? window.byId("theme-primary-picker") : document.getElementById("theme-primary-picker");
    const accentPicker = window.byId ? window.byId("theme-accent-picker") : document.getElementById("theme-accent-picker");

    if (state.themePrimary) {
        document.documentElement.style.setProperty("--theme-primary", state.themePrimary);
        if (primaryPicker) primaryPicker.value = state.themePrimary;
    }
    if (state.themeAccent) {
        document.documentElement.style.setProperty("--theme-accent", state.themeAccent);
        if (accentPicker) accentPicker.value = state.themeAccent;
    }
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
    if (window.updateMatrixRain) window.updateMatrixRain(state.wallpaper);
    
    const resSelect = window.byId ? window.byId("desktop-resolution-select") : document.getElementById("desktop-resolution-select");
    if (resSelect) resSelect.value = state.desktopResolution;
};

window.setWallpaper = (wallpaperId) => {
    const options = window.wallpaperOptions || [];
    if (!options.some((wallpaper) => wallpaper.id === wallpaperId)) return;
    state.wallpaper = wallpaperId;
    if (window.Storage) {
        window.Storage.local.set("bl4ut0Wallpaper", wallpaperId);
    }
    window.applyDesktopPreferences();
    if (window.EventBus) window.EventBus.emit("wallpaper:changed", wallpaperId);
};

window.setDesktopVolume = (value) => {
    state.volume = Math.max(0, Math.min(100, Number(value) || 0));
    if (window.Storage) {
        window.Storage.local.set("bl4ut0Volume", String(state.volume));
    }
    window.applyVolume();
    if (window.EventBus) window.EventBus.emit("volume:changed", state.volume);
};

window.setThemeColor = (type, value) => {
    if (type === "primary") {
        state.themePrimary = value;
        if (window.Storage) window.Storage.local.set("bl4ut0ThemePrimary", value);
    } else if (type === "accent") {
        state.themeAccent = value;
        if (window.Storage) window.Storage.local.set("bl4ut0ThemeAccent", value);
    }
    window.applyThemeColors();
    if (window.EventBus) window.EventBus.emit("theme:changed", { type, value });
};

window.resetThemeColors = () => {
    state.themePrimary = null;
    state.themeAccent = null;
    if (window.Storage) {
        window.Storage.local.remove("bl4ut0ThemePrimary");
        window.Storage.local.remove("bl4ut0ThemeAccent");
    }
    document.documentElement.style.removeProperty("--theme-primary");
    document.documentElement.style.removeProperty("--theme-accent");
    
    const primaryPicker = window.byId ? window.byId("theme-primary-picker") : document.getElementById("theme-primary-picker");
    const accentPicker = window.byId ? window.byId("theme-accent-picker") : document.getElementById("theme-accent-picker");
    if (primaryPicker) primaryPicker.value = "#22d3ee";
    if (accentPicker) accentPicker.value = "#34d399";
    
    if (window.EventBus) window.EventBus.emit("theme:reset");
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
