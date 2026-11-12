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
    if (event.origin !== window.location.origin) return;
    const sourceFrame = Array.from(document.querySelectorAll("iframe.game-frame"))
        .find((iframe) => iframe.contentWindow === event.source);
    if (!sourceFrame) return;
    const data = event.data || {};
    if (data.type !== "game-pointer-release" && data.type !== "game-pointer-release-hint") return;

    const now = Date.now();
    if (now - (window.handleGameRuntimeMessage.lastShown || 0) < 900) return;
    window.handleGameRuntimeMessage.lastShown = now;
    window.showDesktopToast(data.type === "game-pointer-release-hint"
        ? "Press Ctrl+Alt to release cursor."
        : "Cursor released to PortfoliOS.");
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
            "--bg": "#06090f",
            "--panel": "rgba(15, 23, 42, 0.72)",
            "--panel-strong": "rgba(15, 23, 42, 0.88)",
            "--panel-soft": "rgba(255, 255, 255, 0.05)",
            "--line": "rgba(255, 255, 255, 0.08)",
            "--line-strong": "rgba(103, 232, 249, 0.22)",
            "--text": "#f8fafc",
            "--text-soft": "#94a3b8",
            "--text-muted": "#64748b",
            "--theme-primary": "#22d3ee",
            "--theme-accent": "#34d399",
            "--amber": "#f59e0b",
            "--blue": "#3b82f6",
            "--violet": "#a78bfa",
            "--rose": "#f43f5e",
            "--teal": "#14b8a6",
            "--glass-bg": "rgba(15, 23, 42, 0.78)",
            "--glass-border": "rgba(103, 232, 249, 0.18)",
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

// Keep text accents legible on both the base and raised theme surfaces.
window.getReadableThemeColor = (color, background, foreground) => {
    const rgb = hex => /^#[0-9a-f]{6}$/i.test(hex || '')
        ? [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)) : null;
    const ink = rgb(color), base = rgb(background), text = rgb(foreground);
    if (!ink || !base || !text) return foreground;
    const luminance = channels => channels.map(value => {
        const srgb = value / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
    const raised = base.map((value, index) => value * 0.90 + text[index] * 0.10);
    const target = luminance(base) > 0.5 ? 0 : 255;
    for (let step = 0; step <= 20; step++) {
        const candidate = ink.map(value => Math.round(value * (1 - step / 20) + target * step / 20));
        if ([base, raised].every(surface => contrast(candidate, surface) >= 5.2)) {
            return '#' + candidate.map(value => value.toString(16).padStart(2, '0')).join('');
        }
    }
    return foreground;
};
window.getThemeButtonText = color => {
    const channels = /^#[0-9a-f]{6}$/i.test(color || '')
        ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255) : [0, 0, 0];
    const luminance = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    return (1.05 / (luminance + 0.05)) > ((luminance + 0.05) / 0.05) ? '#ffffff' : '#000000';
};

window.applyThemeColors = (options = {}) => {
    const isManual = options.manual === true || options.animate === true;
    if (isManual) {
        document.documentElement.classList.add("theme-transitioning");
        window.clearTimeout(window._themeTransitionTimer);
        window._themeTransitionTimer = window.setTimeout(() => {
            document.documentElement.classList.remove("theme-transitioning");
        }, 260);
    }

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

    // Persist quick reference keys for instant frame 0 loading on refresh
    if (window.Storage) {
        if (state.themePrimary) window.Storage.local.set("bl4ut0_last_theme_primary", state.themePrimary);
        if (state.themeAccent) window.Storage.local.set("bl4ut0_last_theme_accent", state.themeAccent);
        if (state.themeId) window.Storage.local.set("bl4ut0_last_theme", state.themeId);
    }

    const currentPrimary = state.themePrimary || tokens["--theme-primary"] || "#22d3ee";
    const currentAccent = state.themeAccent || tokens["--theme-accent"] || "#34d399";
    const background = tokens['--bg'] || '#050608';
    const foreground = tokens['--text'] || '#fafafa';
    const isLight = (theme.colorScheme || "dark") === "light";

    // Dynamically manage semantic surfaces so switching themes never leaves stale inline styles
    const surfaceInset = tokens["--surface-inset"] || background;
    const surface = tokens["--surface"] || (isLight ? "color-mix(in srgb, var(--bg) 96%, var(--text))" : "color-mix(in srgb, var(--bg) 97%, var(--text))");
    const surfaceRaised = tokens["--surface-raised"] || (isLight ? "color-mix(in srgb, var(--bg) 92%, var(--text))" : "color-mix(in srgb, var(--bg) 94%, var(--text))");
    const surfaceOverlay = tokens["--surface-overlay"] || (isLight ? "color-mix(in srgb, var(--bg) 90%, var(--text))" : "color-mix(in srgb, var(--bg) 94%, var(--text))");
    const controlHover = tokens["--control-hover"] || (isLight ? "color-mix(in srgb, var(--text) 7%, transparent)" : "color-mix(in srgb, var(--text) 9%, transparent)");
    const scrim = tokens["--scrim"] || (isLight ? "rgba(15, 23, 42, 0.4)" : "rgba(0, 0, 0, 0.65)");

    document.documentElement.style.setProperty("--surface-inset", surfaceInset);
    document.documentElement.style.setProperty("--surface", surface);
    document.documentElement.style.setProperty("--surface-raised", surfaceRaised);
    document.documentElement.style.setProperty("--surface-overlay", surfaceOverlay);
    document.documentElement.style.setProperty("--control-hover", controlHover);
    document.documentElement.style.setProperty("--scrim", scrim);

    const readable = color => window.getReadableThemeColor(color, background, foreground);
    document.documentElement.dataset.colorScheme = theme.colorScheme || 'dark';
    document.documentElement.style.setProperty('--on-primary', window.getThemeButtonText(currentPrimary));
    document.documentElement.style.setProperty('--on-accent', window.getThemeButtonText(currentAccent));
    document.documentElement.style.setProperty('--theme-primary-ink', readable(currentPrimary));
    document.documentElement.style.setProperty('--theme-accent-ink', readable(currentAccent));
    ['amber', 'blue', 'violet', 'rose', 'teal'].forEach(name => {
        document.documentElement.style.setProperty('--' + name + '-ink', readable(tokens['--' + name]));
    });
    ['text-soft', 'text-muted'].forEach(name => {
        document.documentElement.style.setProperty('--' + name, readable(tokens['--' + name]));
    });
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

window.getCustomWallpapers = () => {
    try {
        const raw = window.Storage ? window.Storage.local.get(window.getPreferencesKey("CustomWallpapers")) : null;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (_) {}
    return [];
};

window.deleteCustomWallpaper = async (wallpaperId) => {
    const list = window.getCustomWallpapers();
    const item = list.find(w => w.id === wallpaperId);
    const updated = list.filter(w => w.id !== wallpaperId);
    if (window.Storage) {
        window.Storage.local.set(window.getPreferencesKey("CustomWallpapers"), JSON.stringify(updated));
    }
    if (item?.path && window.SystemFS) {
        try { await window.SystemFS.deleteFile(item.path); } catch (_) {}
    }
    if (state.wallpaper === wallpaperId || (state.wallpaper === "custom" && !updated.length)) {
        window.setWallpaper("aurora");
    } else if (state.wallpaper === "custom" && updated.length) {
        window.setWallpaper(updated[0].id);
    }
    if (window.renderWallpaperOptions) window.renderWallpaperOptions();
    if (window.showDesktopToast) window.showDesktopToast("Custom wallpaper removed.");
};

window.applyDesktopPreferences = () => {
    const desktop = window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience");
    if (desktop) {
        const isCustom = state.wallpaper === "custom" || state.wallpaper?.startsWith("custom-");
        desktop.dataset.wallpaper = isCustom ? "custom" : state.wallpaper;
        const wallEl = desktop.querySelector(".desktop-wallpaper");

        if (isCustom) {
            const customList = window.getCustomWallpapers();
            const activeCustom = customList.find(w => w.id === state.wallpaper) || customList[0] || null;
            const thumb = activeCustom?.thumb || (window.Storage ? window.Storage.local.get(window.getPreferencesKey("CustomWallpaperThumb")) : null);
            const activeBlob = window._customWallpaperBlobUrl;

            if (activeBlob && window._activeCustomWallpaperId === state.wallpaper) {
                desktop.style.setProperty("--custom-wallpaper-url", `url("${activeBlob}")`);
                if (wallEl) wallEl.style.backgroundImage = `url("${activeBlob}")`;
            } else if (thumb) {
                desktop.style.setProperty("--custom-wallpaper-url", `url("${thumb}")`);
                if (wallEl) wallEl.style.backgroundImage = `url("${thumb}")`;
            } else {
                desktop.style.removeProperty("--custom-wallpaper-url");
                if (wallEl) wallEl.style.removeProperty("background-image");
            }

            // Asynchronously hydrate from SystemFS full-resolution file
            const targetPath = activeCustom?.path || (window.Storage ? window.Storage.local.get(window.getPreferencesKey("CustomWallpaperPath")) : null);
            if (targetPath && window.SystemFS) {
                window.SystemFS.ensureReady().then(async () => {
                    const record = await window.SystemFS.readFile(targetPath);
                    if (record && record.data) {
                        const blob = record.data instanceof Blob ? record.data : new Blob([record.data], { type: record.type || "image/jpeg" });
                        if (window._customWallpaperBlobUrl) {
                            try { URL.revokeObjectURL(window._customWallpaperBlobUrl); } catch (_) {}
                        }
                        window._customWallpaperBlobUrl = URL.createObjectURL(blob);
                        window._activeCustomWallpaperId = state.wallpaper;
                        if (desktop && (state.wallpaper === "custom" || state.wallpaper.startsWith("custom-"))) {
                            desktop.style.setProperty("--custom-wallpaper-url", `url("${window._customWallpaperBlobUrl}")`);
                            if (wallEl) wallEl.style.backgroundImage = `url("${window._customWallpaperBlobUrl}")`;
                        }
                        document.querySelectorAll('.wallpaper-preview[data-preview-wallpaper="custom"], .wallpaper-preview[data-preview-wallpaper="' + state.wallpaper + '"]').forEach((preview) => {
                            preview.style.backgroundImage = `url("${window._customWallpaperBlobUrl}")`;
                        });
                    }
                }).catch((err) => {
                    console.warn("Could not load custom wallpaper from SystemFS:", err);
                });
            }
        } else {
            desktop.style.removeProperty("--custom-wallpaper-url");
            if (wallEl) wallEl.style.removeProperty("background-image");
        }
    }
    
    if (window.renderWallpaperOptions) window.renderWallpaperOptions();
    window.applyVolume();
    window.applyThemeColors();
    window.applyDesktopResolution();
    window.applyScreensaverPreferences();
    if (window.updateMatrixRain) window.updateMatrixRain(state.wallpaper);
    
    const resSelect = window.byId ? window.byId("desktop-resolution-select") : document.getElementById("desktop-resolution-select");
    if (resSelect) resSelect.value = state.desktopResolution;
};

function generateWallpaperThumbnail(blob) {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                URL.revokeObjectURL(url);
                try {
                    const canvas = document.createElement("canvas");
                    const maxW = 240;
                    const maxH = 150;
                    let w = img.width || maxW;
                    let h = img.height || maxH;
                    if (w > maxW || h > maxH) {
                        const ratio = Math.min(maxW / w, maxH / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    canvas.width = Math.max(1, w);
                    canvas.height = Math.max(1, h);
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", 0.72));
                } catch (_) {
                    resolve(null);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };
            img.src = url;
        } catch (_) {
            resolve(null);
        }
    });
}

window.setCustomWallpaper = async (recordOrBlob, path) => {
    try {
        let blob = null;
        let wallpaperPath = path || null;
        let name = "wallpaper.jpg";

        if (recordOrBlob instanceof Blob) {
            blob = recordOrBlob;
            name = recordOrBlob.name || "wallpaper.jpg";
        } else if (recordOrBlob instanceof Uint8Array || recordOrBlob instanceof ArrayBuffer) {
            blob = new Blob([recordOrBlob], { type: "image/png" });
            name = path || "wallpaper.png";
        } else if (recordOrBlob?.data instanceof Blob) {
            blob = recordOrBlob.data;
            name = recordOrBlob.name || "wallpaper.jpg";
            wallpaperPath = wallpaperPath || recordOrBlob.path;
        } else if (recordOrBlob?.data instanceof Uint8Array || recordOrBlob?.data instanceof ArrayBuffer) {
            blob = new Blob([recordOrBlob.data], { type: recordOrBlob.type || "image/jpeg" });
            name = recordOrBlob.name || "wallpaper.jpg";
            wallpaperPath = wallpaperPath || recordOrBlob.path;
        } else if (typeof recordOrBlob?.data === "string") {
            if (recordOrBlob.data.startsWith("data:") || recordOrBlob.data.startsWith("blob:")) {
                const res = await fetch(recordOrBlob.data);
                blob = await res.blob();
            } else {
                blob = new Blob([recordOrBlob.data], { type: recordOrBlob.type || "image/jpeg" });
            }
            name = recordOrBlob.name || "wallpaper.jpg";
            wallpaperPath = wallpaperPath || recordOrBlob.path;
        } else if (recordOrBlob?.file instanceof Blob) {
            blob = recordOrBlob.file;
            name = recordOrBlob.file.name || "wallpaper.jpg";
        } else if (recordOrBlob?.record) {
            return await window.setCustomWallpaper(recordOrBlob.record, recordOrBlob.path || path);
        } else if (typeof recordOrBlob === "string") {
            if (recordOrBlob.startsWith("data:") || recordOrBlob.startsWith("blob:") || recordOrBlob.startsWith("http")) {
                const res = await fetch(recordOrBlob);
                blob = await res.blob();
                if (path) name = path.includes("/") ? path.split("/").pop() : path;
            } else if (window.SystemFS) {
                wallpaperPath = recordOrBlob;
                const rec = await window.SystemFS.readFile(recordOrBlob);
                if (rec?.data instanceof Blob) blob = rec.data;
                else if (rec?.data) blob = new Blob([rec.data], { type: rec.type || "image/jpeg" });
                name = rec?.name || "wallpaper.jpg";
            }
        } else if (wallpaperPath && window.SystemFS) {
            const rec = await window.SystemFS.readFile(wallpaperPath);
            if (rec?.data instanceof Blob) blob = rec.data;
            else if (rec?.data) blob = new Blob([rec.data], { type: rec.type || "image/jpeg" });
            name = rec?.name || "wallpaper.jpg";
        }

        if (!blob) {
            throw new Error("No valid image data found for custom wallpaper.");
        }

        // Ensure the wallpaper is saved persistently in SystemFS
        if (window.SystemFS) {
            await window.SystemFS.ensureReady();
            if (!wallpaperPath || !wallpaperPath.startsWith("/")) {
                const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "jpg";
                wallpaperPath = `/Pictures/wallpapers/custom-${Date.now()}.${ext}`;
            }
            await window.SystemFS.ensureDirectory("/Pictures/wallpapers", { silent: true });
            await window.SystemFS.writeFile(
                wallpaperPath,
                name,
                "/Pictures/wallpapers",
                blob,
                blob.size,
                blob.type || "image/jpeg",
                false,
                { silent: true }
            );
        }

        // Generate lightweight thumbnail for instant frame 0 rendering (never exceeds localStorage quota)
        const thumb = await generateWallpaperThumbnail(blob);
        const customId = `custom-${Date.now()}`;
        const newEntry = {
            id: customId,
            name: name || "Custom Wallpaper",
            path: wallpaperPath,
            thumb: thumb,
            dateAdded: Date.now()
        };

        const list = window.getCustomWallpapers();
        const filtered = list.filter(item => (wallpaperPath && item.path !== wallpaperPath) && item.name !== name);
        filtered.unshift(newEntry);

        if (window.Storage) {
            window.Storage.local.set(window.getPreferencesKey("CustomWallpapers"), JSON.stringify(filtered));
            if (wallpaperPath) {
                window.Storage.local.set(window.getPreferencesKey("CustomWallpaperPath"), wallpaperPath);
            }
            if (thumb) {
                window.Storage.local.set(window.getPreferencesKey("CustomWallpaperThumb"), thumb);
            }
            window.Storage.local.set(window.getPreferencesKey("ActiveCustomWallpaperId"), customId);
        }

        // Revoke previous blob URL if any, and create clean in-memory Object URL
        if (window._customWallpaperBlobUrl) {
            try { URL.revokeObjectURL(window._customWallpaperBlobUrl); } catch (_) {}
        }
        window._customWallpaperBlobUrl = URL.createObjectURL(blob);
        window._activeCustomWallpaperId = customId;

        // Apply immediately to desktop and previews
        const desktop = window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience");
        if (desktop) {
            desktop.dataset.wallpaper = "custom";
            desktop.style.setProperty("--custom-wallpaper-url", `url("${window._customWallpaperBlobUrl}")`);
            const wallEl = desktop.querySelector(".desktop-wallpaper");
            if (wallEl) wallEl.style.backgroundImage = `url("${window._customWallpaperBlobUrl}")`;
        }
        document.querySelectorAll('.wallpaper-preview[data-preview-wallpaper="custom"], .wallpaper-preview[data-preview-wallpaper="' + customId + '"]').forEach((preview) => {
            preview.style.backgroundImage = `url("${window._customWallpaperBlobUrl}")`;
        });

        // Update state and notify
        window.setWallpaper(customId);

        if (window.Toast) {
            window.Toast.show("Desktop wallpaper updated", { type: "success" });
        } else if (window.showDesktopToast) {
            window.showDesktopToast("Desktop wallpaper updated");
        }
        return newEntry;
    } catch (e) {
        console.error("Failed to set custom wallpaper:", e);
        if (window.Toast) window.Toast.show("Failed to set wallpaper: " + (e.message || "Unknown error"), { type: "error" });
        else if (window.showDesktopToast) window.showDesktopToast("Failed to set wallpaper: " + (e.message || "Unknown error"));
    }
};

window.promptCustomWallpaperSelection = async () => {
    if (!window.SystemFS) return;
    try {
        const result = await window.SystemFS.showOpenDialog({
            title: "Choose Desktop Wallpaper",
            startPath: "/Pictures",
            types: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp"],
            acceptLabel: "Set Wallpaper"
        });
        if (!result) return;
        if (result.file) {
            await window.setCustomWallpaper(result.file);
        } else if (result.record || result.path) {
            await window.setCustomWallpaper(result.record, result.path);
        }
    } catch (err) {
        console.error("Failed to select custom wallpaper:", err);
        window.showDesktopToast?.(err.message || "Failed to select wallpaper");
    }
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
        window.Storage.local.set("bl4ut0_last_theme", theme.id);
    }
    window.applyThemeColors({ manual: true, animate: true });
    if (window.EventBus) window.EventBus.emit("theme:changed", { themeId: theme.id, theme });
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.setWallpaper = (wallpaperId) => {
    const options = window.wallpaperOptions || [];
    const customList = window.getCustomWallpapers ? window.getCustomWallpapers() : [];
    const isCustom = wallpaperId === "custom" || String(wallpaperId).startsWith("custom-") || customList.some(w => w.id === wallpaperId);
    if (!isCustom && !options.some((wallpaper) => wallpaper.id === wallpaperId)) return;

    state.wallpaper = wallpaperId;
    if (window.Storage) {
        window.Storage.local.set(window.getPreferencesKey("Wallpaper"), wallpaperId);
        if (isCustom) {
            window.Storage.local.set(window.getPreferencesKey("ActiveCustomWallpaperId"), wallpaperId);
        }
    }
    window.applyDesktopPreferences();
    if (window.EventBus) window.EventBus.emit("wallpaper:changed", wallpaperId);
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

// =========================================================================
// Default Applications & File Associations Engine
// =========================================================================
const DEFAULT_FILE_ASSOCIATIONS = {
    // Images -> defaults to imageviewer
    ".png": "imageviewer",
    ".jpg": "imageviewer",
    ".jpeg": "imageviewer",
    ".webp": "imageviewer",
    ".gif": "imageviewer",
    ".bmp": "imageviewer",
    ".ico": "imageviewer",
    ".svg": "imageviewer",
    // Layered / RAW / Creative
    ".psd": "photocraft",
    ".ora": "photocraft",
    ".cr2": "lightcraft",
    ".nef": "lightcraft",
    ".raw": "lightcraft",
    ".craft": "designcraft",
    ".fx": "effectcraft",
    // Documents / Code
    ".pdf": "pdfcraft",
    ".txt": "vscode",
    ".md": "vscode",
    ".json": "vscode",
    ".js": "vscode",
    ".html": "vscode",
    ".css": "vscode",
    ".py": "vscode",
    ".sh": "cli",
    // Office Documents
    ".docx": "genoffice-docs",
    ".doc": "genoffice-docs",
    ".xlsx": "genoffice-sheets",
    ".xls": "genoffice-sheets",
    ".pptx": "genoffice-slides",
    ".ppt": "genoffice-slides",
    ".gdoc": "genoffice-docs",
    ".gsheet": "genoffice-sheets",
    ".gslides": "genoffice-slides",
    ".gnotes": "genoffice-notes",
    // Audio, Video, 3D
    ".mp3": "musicmini",
    ".wav": "musicmini",
    ".ogg": "musicmini",
    ".flac": "musicmini",
    ".m4a": "musicmini",
    ".mp4": "filmcraft",
    ".webm": "filmcraft",
    ".mkv": "filmcraft",
    ".step": "solidcraft",
    ".stp": "solidcraft",
    ".stl": "solidcraft",
    ".obj": "solidcraft"
};

const COMMON_FILE_TYPE_GROUPS = [
    {
        id: "images",
        label: "Photos & Images",
        icon: "fa-regular fa-image",
        extensions: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".ico", ".svg"],
        defaultApp: "imageviewer",
        compatibleApps: ["imageviewer", "photocraft", "vectorcraft", "lightcraft", "browser"]
    },
    {
        id: "layered-images",
        label: "Layered Artwork & PSD",
        icon: "fa-solid fa-layer-group",
        extensions: [".psd", ".ora"],
        defaultApp: "photocraft",
        compatibleApps: ["photocraft", "imageviewer"]
    },
    {
        id: "documents-code",
        label: "Text Documents & Code",
        icon: "fa-solid fa-file-code",
        extensions: [".txt", ".md", ".json", ".js", ".html", ".css", ".py"],
        defaultApp: "vscode",
        compatibleApps: ["vscode", "genoffice-notes", "cli"]
    },
    {
        id: "pdf",
        label: "PDF Documents",
        icon: "fa-solid fa-file-pdf",
        extensions: [".pdf"],
        defaultApp: "pdfcraft",
        compatibleApps: ["pdfcraft", "browser"]
    },
    {
        id: "office-docs",
        label: "Word Documents",
        icon: "fa-solid fa-file-word",
        extensions: [".docx", ".doc", ".gdoc"],
        defaultApp: "genoffice-docs",
        compatibleApps: ["genoffice-docs", "genoffice", "office"]
    },
    {
        id: "office-sheets",
        label: "Spreadsheets",
        icon: "fa-solid fa-file-excel",
        extensions: [".xlsx", ".xls", ".gsheet"],
        defaultApp: "genoffice-sheets",
        compatibleApps: ["genoffice-sheets", "genoffice", "office"]
    },
    {
        id: "office-slides",
        label: "Presentations",
        icon: "fa-solid fa-file-powerpoint",
        extensions: [".pptx", ".ppt", ".gslides"],
        defaultApp: "genoffice-slides",
        compatibleApps: ["genoffice-slides", "genoffice", "office"]
    },
    {
        id: "audio",
        label: "Music & Audio",
        icon: "fa-solid fa-music",
        extensions: [".mp3", ".wav", ".ogg", ".flac", ".m4a"],
        defaultApp: "musicmini",
        compatibleApps: ["musicmini"]
    },
    {
        id: "video",
        label: "Videos & Movies",
        icon: "fa-solid fa-video",
        extensions: [".mp4", ".webm", ".mkv"],
        defaultApp: "filmcraft",
        compatibleApps: ["filmcraft"]
    },
    {
        id: "cad-3d",
        label: "CAD Models & 3D",
        icon: "fa-solid fa-cube",
        extensions: [".step", ".stp", ".stl", ".obj"],
        defaultApp: "solidcraft",
        compatibleApps: ["solidcraft"]
    }
];

window.DEFAULT_FILE_ASSOCIATIONS = DEFAULT_FILE_ASSOCIATIONS;
window.COMMON_FILE_TYPE_GROUPS = COMMON_FILE_TYPE_GROUPS;

window.getUserFileAssociations = () => {
    try {
        const raw = window.Storage ? window.Storage.local.get(window.getPreferencesKey("FileAssociations")) : null;
        if (raw && typeof raw === "object") return raw;
        if (typeof raw === "string") {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") return parsed;
        }
    } catch (_) {}
    return {};
};

window.getFileAssociation = (filenameOrExt = "") => {
    if (!filenameOrExt) return null;
    const clean = String(filenameOrExt).trim().toLowerCase();
    const ext = clean.startsWith(".") ? clean : (clean.includes(".") ? "." + clean.split(".").pop() : "");
    if (!ext) return null;

    const userMap = window.getUserFileAssociations();
    const targetApp = userMap[ext] || DEFAULT_FILE_ASSOCIATIONS[ext] || null;

    if (targetApp) {
        if (!window.isAppInstalled || window.isAppInstalled(targetApp)) return targetApp;
        if (targetApp === "photocraft" && (!window.isAppInstalled || window.isAppInstalled("imageviewer"))) return "imageviewer";
        if (targetApp === "vscode" && (!window.isAppInstalled || window.isAppInstalled("genoffice-notes"))) return "genoffice-notes";
        if (targetApp.startsWith("genoffice-") && (!window.isAppInstalled || window.isAppInstalled("office"))) return "office";
    }
    return targetApp;
};

window.setFileAssociation = (extension, appId) => {
    if (!extension || !appId) return;
    const cleanExt = extension.startsWith(".") ? extension.toLowerCase() : "." + extension.toLowerCase();
    const userMap = window.getUserFileAssociations();
    userMap[cleanExt] = appId;
    if (window.Storage) {
        window.Storage.local.set(window.getPreferencesKey("FileAssociations"), JSON.stringify(userMap));
    }
    if (window.EventBus) window.EventBus.emit("associations:changed", { extension: cleanExt, appId });
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.removeFileAssociation = (extension) => {
    if (!extension) return;
    const cleanExt = extension.startsWith(".") ? extension.toLowerCase() : "." + extension.toLowerCase();
    const userMap = window.getUserFileAssociations();
    delete userMap[cleanExt];
    if (window.Storage) {
        window.Storage.local.set(window.getPreferencesKey("FileAssociations"), JSON.stringify(userMap));
    }
    if (window.EventBus) window.EventBus.emit("associations:changed", { extension: cleanExt });
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.resetFileAssociations = () => {
    if (window.Storage) {
        window.Storage.local.remove(window.getPreferencesKey("FileAssociations"));
    }
    if (window.EventBus) window.EventBus.emit("associations:changed");
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

// Neutral alias used by non-desktop experiences and shared media services.
window.setSystemVolume = window.setDesktopVolume;

window.setThemeColor = (type, value) => {
    if (type === "primary") {
        state.themePrimary = value;
        if (window.Storage) {
            window.Storage.local.set(window.getPreferencesKey("ThemePrimary"), value);
            window.Storage.local.set("bl4ut0_last_theme_primary", value);
        }
    } else if (type === "accent") {
        state.themeAccent = value;
        if (window.Storage) {
            window.Storage.local.set(window.getPreferencesKey("ThemeAccent"), value);
            window.Storage.local.set("bl4ut0_last_theme_accent", value);
        }
    }
    window.applyThemeColors({ manual: true, animate: true });
    if (window.EventBus) window.EventBus.emit("theme:changed", { themeId: state.themeId, type, value });
    if (window.savePreferencesToFilesystem) window.savePreferencesToFilesystem();
};

window.resetThemeColors = () => {
    state.themePrimary = null;
    state.themeAccent = null;
    if (window.Storage) {
        window.Storage.local.remove(window.getPreferencesKey("ThemePrimary"));
        window.Storage.local.remove(window.getPreferencesKey("ThemeAccent"));
        window.Storage.local.remove("bl4ut0_last_theme_primary");
        window.Storage.local.remove("bl4ut0_last_theme_accent");
    }
    window.applyThemeColors({ manual: true, animate: true });
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

// Immediately apply theme custom properties so boot screen and login screen match from frame 1
window.applyThemeColors();
