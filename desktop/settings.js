/**
 * PortfoliOS: Desktop Settings Component
 * Handles settings tab switching, display resolution, sound volume, theme colors, and Google Drive sync.
 */

// Tab Navigation Logic
function initSettingsTabs() {
    const tabs = document.querySelectorAll(".settings-tab-btn, .settings-user-card");
    const panels = document.querySelectorAll(".settings-main .settings-panel");

    window.openSettingsPanel = (targetTab = "desktop") => {
        tabs.forEach(tab => {
            const isActive = tab.dataset.tab === targetTab;
            tab.classList.toggle("active", isActive);
            tab.setAttribute("aria-selected", String(isActive));
        });

        panels.forEach(panel => {
            panel.classList.toggle("active", panel.dataset.panel === targetTab);
        });
    };

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            window.openSettingsPanel(tab.dataset.tab);
        });
    });
}

function renderSettingsUser() {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user) return;

    const avatarEls = [
        document.getElementById("settings-user-avatar"),
        document.getElementById("account-profile-avatar")
    ];
    avatarEls.forEach((avatar) => {
        if (!avatar) return;
        avatar.src = user.avatar || "";
        avatar.alt = `${user.displayName} profile picture`;
    });

    const settingsName = document.getElementById("settings-user-name");
    const settingsMeta = document.getElementById("settings-user-meta");
    const profileName = document.getElementById("account-profile-name");
    const profileHandle = document.getElementById("account-profile-handle");
    const profileType = document.getElementById("account-profile-type");

    if (settingsName) settingsName.textContent = user.displayName;
    if (settingsMeta) settingsMeta.textContent = `${user.handle} / ${user.role}`;
    if (profileName) profileName.textContent = user.displayName;
    if (profileHandle) profileHandle.textContent = user.handle;
    if (profileType) profileType.textContent = user.accountType || user.role;
}

// Volume Controls & Sync Logic
let lastNonZeroVolume = 70;

function updateVolumeUI(volume) {
    const slider = document.getElementById("settings-volume-slider");
    const label = document.getElementById("settings-volume-value");
    const icon = document.getElementById("settings-volume-icon");

    if (slider) slider.value = volume;
    if (label) label.textContent = `${volume}%`;
    if (icon) {
        icon.className = volume === 0
            ? "fa-solid fa-volume-xmark"
            : volume < 45
                ? "fa-solid fa-volume-low"
                : "fa-solid fa-volume-high";
    }
}

function initVolumeSettings() {
    const slider = document.getElementById("settings-volume-slider");
    const muteBtn = document.getElementById("settings-volume-mute-btn");

    if (slider) {
        slider.addEventListener("input", (e) => {
            const val = Number(e.target.value);
            if (window.setDesktopVolume) {
                window.setDesktopVolume(val);
            } else if (window.state) {
                window.state.volume = val;
                if (window.applyVolume) window.applyVolume();
            }
            if (val > 0) {
                lastNonZeroVolume = val;
            }
        });
    }

    if (muteBtn) {
        muteBtn.addEventListener("click", () => {
            const currentVol = window.state ? window.state.volume : 70;
            if (currentVol > 0) {
                lastNonZeroVolume = currentVol;
                if (window.setDesktopVolume) {
                    window.setDesktopVolume(0);
                } else if (window.state) {
                    window.state.volume = 0;
                    if (window.applyVolume) window.applyVolume();
                }
            } else {
                if (window.setDesktopVolume) {
                    window.setDesktopVolume(lastNonZeroVolume);
                } else if (window.state) {
                    window.state.volume = lastNonZeroVolume;
                    if (window.applyVolume) window.applyVolume();
                }
            }
        });
    }

    // Initial sync
    if (window.state) {
        updateVolumeUI(window.state.volume);
        if (window.state.volume > 0) {
            lastNonZeroVolume = window.state.volume;
        }
    }
}

// Display & Resolution Settings
function initResolutionSettings() {
    const resetBtn = document.getElementById("settings-reset-resolution-btn");
    const resSelect = document.getElementById("desktop-resolution-select");

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (window.state) {
                window.state.desktopResolution = "auto";
                const key = window.getPreferencesKey ? window.getPreferencesKey("DesktopResolution") : "bl4ut0DesktopResolution";
                if (window.Storage) {
                    window.Storage.local.set(key, "auto");
                }
                if (resSelect) resSelect.value = "auto";
                if (window.applyDesktopResolution) window.applyDesktopResolution();
                // Also update top header button
                const mainResetBtn = document.getElementById("reset-resolution-btn");
                if (mainResetBtn) mainResetBtn.style.display = "none";
            }
        });
    }
}

function initScreensaverSettings() {
    const delaySelect = document.getElementById("screensaver-delay-select");
    const previewBtn = document.getElementById("screensaver-preview-btn");

    if (delaySelect) {
        delaySelect.addEventListener("change", (event) => {
            if (window.setScreensaverDelay) window.setScreensaverDelay(event.target.value);
        });
    }

    if (previewBtn) {
        previewBtn.addEventListener("click", () => {
            if (window.startScreensaver) window.startScreensaver({ preview: true });
        });
    }
}

// Google Drive Sync UI Sync Logic
function updateGDriveUI() {
    const isConnected = window.GDriveSync && window.GDriveSync.getToken() !== null;
    
    const indicator = document.getElementById("settings-gdrive-indicator");
    const statusText = document.getElementById("settings-gdrive-status-text");
    const connectBtn = document.getElementById("settings-gdrive-connect-btn");
    const disconnectBtn = document.getElementById("settings-gdrive-disconnect-btn");
    const syncSection = document.getElementById("settings-sync-actions-section");
    const clientIdInput = document.getElementById("settings-gdrive-client-id");
    const originText = document.getElementById("settings-gdrive-origin");
    const returnModeText = document.getElementById("settings-gdrive-return-mode");
    
    if (clientIdInput) {
        const defaultId = window.GDriveSync?.defaultClientId || "";
        const storedId = localStorage.getItem("bl4ut0_gdrive_client_id") || defaultId;
        if (!clientIdInput.value && storedId) {
            clientIdInput.value = storedId;
        }
    }

    if (window.GDriveSync?.getOAuthStatus) {
        const oauthStatus = window.GDriveSync.getOAuthStatus();
        if (originText) originText.textContent = oauthStatus.origin;
        if (returnModeText) returnModeText.textContent = oauthStatus.returnMode;
    }

    if (indicator) {
        indicator.className = `status-indicator-dot ${isConnected ? "connected" : "disconnected"}`;
    }
    if (statusText) {
        const folderLabel = window.GDriveSync?.getCurrentFolderLabel ? window.GDriveSync.getCurrentFolderLabel() : "Google Drive";
        statusText.textContent = isConnected ? `Connected to ${folderLabel}` : "Not Connected";
    }
    if (connectBtn) {
        connectBtn.style.display = isConnected ? "none" : "inline-flex";
    }
    if (disconnectBtn) {
        disconnectBtn.style.display = isConnected ? "inline-flex" : "none";
    }
    if (syncSection) {
        syncSection.style.display = isConnected ? "block" : "none";
    }
}

// Google Drive Actions Logic
function initGDriveSettings() {
    const connectBtn = document.getElementById("settings-gdrive-connect-btn");
    const disconnectBtn = document.getElementById("settings-gdrive-disconnect-btn");
    const syncBtn = document.getElementById("settings-gdrive-sync-btn");
    
    if (connectBtn) {
        connectBtn.addEventListener("click", async () => {
            const clientIdInput = document.getElementById("settings-gdrive-client-id");
            const clientId = clientIdInput ? clientIdInput.value.trim() : "";
            if (!clientId) {
                alert("Please enter a valid Google Client ID first.");
                return;
            }

            try {
                connectBtn.disabled = true;
                connectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
                
                await window.GDriveSync.loadGsiLibrary();
                await window.GDriveSync.login(clientId);
                
                if (window.showDesktopToast) window.showDesktopToast("Google Drive Connected!");
                updateGDriveUI();
                
                // Auto sync
                await triggerGDriveSync();
            } catch (err) {
                console.error("GDrive Connection error:", err);
                alert("Connection failed. Please check your credentials.");
            } finally {
                connectBtn.disabled = false;
                connectBtn.innerHTML = '<i class="fa-brands fa-google-drive"></i> Sign in with Google Drive';
                updateGDriveUI();
            }
        });
    }

    if (disconnectBtn) {
        disconnectBtn.addEventListener("click", () => {
            if (window.GDriveSync) {
                window.GDriveSync.logout();
                if (window.showDesktopToast) window.showDesktopToast("Google Drive Disconnected.");
            }
            updateGDriveUI();
        });
    }

    if (syncBtn) {
        syncBtn.addEventListener("click", () => {
            triggerGDriveSync();
        });
    }

    // Initial load
    updateGDriveUI();
}

async function triggerGDriveSync() {
    const syncBtn = document.getElementById("settings-gdrive-sync-btn");
    const progressContainer = document.getElementById("settings-gdrive-progress-container");
    const progressBar = document.getElementById("settings-gdrive-progress-bar");
    const progressText = document.getElementById("settings-gdrive-progress-text");
    const disconnectBtn = document.getElementById("settings-gdrive-disconnect-btn");

    if (!window.GDriveSync) return;

    if (progressContainer) progressContainer.style.display = "flex";
    if (syncBtn) syncBtn.disabled = true;
    if (disconnectBtn) disconnectBtn.disabled = true;

    try {
        if (window.savePreferencesToFilesystem) {
            await window.savePreferencesToFilesystem();
        }
        await window.GDriveSync.sync((processed, total, path) => {
            if (total === 0) {
                if (progressText) progressText.textContent = "Syncing... (No files)";
                if (progressBar) progressBar.style.width = "100%";
            } else {
                const percent = Math.round((processed / total) * 100);
                if (progressText) progressText.textContent = `Syncing [${processed}/${total}]: ${path.split("/").pop()}`;
                if (progressBar) progressBar.style.width = `${percent}%`;
            }
        });
        if (window.loadPreferencesFromFilesystem) {
            await window.loadPreferencesFromFilesystem();
        }
        const folderLabel = window.GDriveSync?.getCurrentFolderLabel ? window.GDriveSync.getCurrentFolderLabel() : "Google Drive";
        if (window.showDesktopToast) window.showDesktopToast(`Synced ${folderLabel}`);
        if (progressText) progressText.textContent = "Sync complete!";
        if (progressBar) progressBar.style.width = "100%";
    } catch (err) {
        console.error("GDrive Sync error:", err);
        if (progressText) progressText.textContent = "Sync failed.";
        if (progressBar) progressBar.style.width = "0%";
        alert("Synchronization failed: " + err.message);
    } finally {
        if (syncBtn) syncBtn.disabled = false;
        if (disconnectBtn) disconnectBtn.disabled = false;
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = "none";
        }, 3000);
    }
}

// Wallpaper Picker
window.renderWallpaperOptions = () => {
    const container = window.byId ? window.byId("wallpaper-options") : document.getElementById("wallpaper-options");
    if (!container) return;

    const wallpaperOptions = window.wallpaperOptions || [];

    container.innerHTML = wallpaperOptions.map((wallpaper) => `
        <button type="button" class="wallpaper-card ${window.state && window.state.wallpaper === wallpaper.id ? "active" : ""}"
            data-wallpaper-choice="${wallpaper.id}" title="Use ${wallpaper.label} wallpaper">
            <div class="wallpaper-preview" data-preview-wallpaper="${wallpaper.id}"></div>
            <div class="wallpaper-card-info">
                <i class="${wallpaper.icon}"></i>
                <span>${wallpaper.label}</span>
            </div>
        </button>
    `).join("");
};

window.renderThemeOptions = () => {
    const container = window.byId ? window.byId("theme-options") : document.getElementById("theme-options");
    if (!container) return;

    const themes = window.getPortfolioThemeOptions ? window.getPortfolioThemeOptions() : (window.portfolioThemes || []);
    const escapeHtml = window.escapeHtml || ((value) => String(value ?? ""));

    container.innerHTML = themes.map((theme) => {
        const swatches = theme.swatches || [
            theme.tokens?.["--bg"] || "#050608",
            theme.tokens?.["--theme-primary"] || "#22d3ee",
            theme.tokens?.["--theme-accent"] || "#34d399"
        ];
        return `
            <button type="button" class="theme-card ${window.state && window.state.themeId === theme.id ? "active" : ""}"
                data-theme-choice="${escapeHtml(theme.id)}" title="Use ${escapeHtml(theme.label)} theme">
                <div class="theme-card-preview" style="--preview-bg:${escapeHtml(swatches[0])}; --preview-primary:${escapeHtml(swatches[1])}; --preview-accent:${escapeHtml(swatches[2])};">
                    <span></span>
                    <b></b>
                </div>
                <div class="theme-card-info">
                    <i class="${escapeHtml(theme.icon || "fa-solid fa-palette")}"></i>
                    <span>${escapeHtml(theme.label)}</span>
                </div>
            </button>
        `;
    }).join("");
};

window.renderScreensaverOptions = () => {
    const container = window.byId ? window.byId("screensaver-options") : document.getElementById("screensaver-options");
    if (!container) return;

    const options = window.getScreensaverOptions ? window.getScreensaverOptions() : (window.screensaverOptions || []);
    const escapeHtml = window.escapeHtml || ((value) => String(value ?? ""));

    container.innerHTML = options.map((option) => `
        <button type="button" class="screensaver-card ${window.state && window.state.screensaver === option.id ? "active" : ""}"
            data-screensaver-choice="${escapeHtml(option.id)}" title="Use ${escapeHtml(option.label)} screensaver">
            <div class="screensaver-card-preview" data-preview-screensaver="${escapeHtml(option.id)}">
                <span></span><span></span><span></span>
            </div>
            <div class="screensaver-card-info">
                <i class="${escapeHtml(option.icon || "fa-regular fa-square")}"></i>
                <span>${escapeHtml(option.label)}</span>
            </div>
        </button>
    `).join("");
};

// API Key Dialog variables & helpers
let currentDialogProvider = null;

function openApiKeyDialog(provider) {
    currentDialogProvider = provider;
    const backdrop = document.getElementById("ai-key-dialog-backdrop");
    const title = document.getElementById("ai-key-dialog-title");
    const label = document.getElementById("ai-key-dialog-label");
    const input = document.getElementById("ai-key-dialog-input");
    const getLink = document.getElementById("ai-key-dialog-get-link");

    if (!backdrop) return;

    if (provider === "openai") {
        if (title) title.innerHTML = '<i class="fa-solid fa-robot"></i> Configure OpenAI API Key';
        if (label) label.textContent = "OpenAI API Key";
        if (getLink) getLink.href = "https://platform.openai.com/api-keys";
        if (input) input.value = localStorage.getItem("settings-openai-api-key") || "";
    } else if (provider === "gemini") {
        if (title) title.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Configure Gemini API Key';
        if (label) label.textContent = "Google Gemini API Key";
        if (getLink) getLink.href = "https://aistudio.google.com/app/apikey";
        if (input) input.value = localStorage.getItem("settings-gemini-api-key") || "";
    }

    backdrop.style.display = "flex";
    if (input) input.focus();
}

function closeApiKeyDialog() {
    const backdrop = document.getElementById("ai-key-dialog-backdrop");
    if (backdrop) {
        backdrop.style.display = "none";
    }
    currentDialogProvider = null;
}

// Local AI Settings panel logic
function initLocalAISettings() {
    const modelSelect = document.getElementById("settings-local-ai-model-select");
    const enableBtn = document.getElementById("settings-local-ai-enable-btn");
    const stopBtn = document.getElementById("settings-local-ai-stop-btn");

    if (modelSelect) {
        modelSelect.addEventListener("change", (e) => {
            if (window.LocalAI?.setSelectedModelId) {
                window.LocalAI.setSelectedModelId(e.target.value);
                updateLocalAiSettingsUI();
            }
        });
    }

    if (enableBtn) {
        enableBtn.addEventListener("click", async () => {
            if (!window.LocalAI) return;
            enableBtn.disabled = true;
            enableBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Starting...';
            try {
                await window.LocalAI.enable("Settings app");
            } catch (error) {
                console.error("Local AI start failed.", error);
                window.showDesktopToast?.("Local AI failed to start.");
            } finally {
                updateLocalAiSettingsUI();
            }
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener("click", async () => {
            if (!window.LocalAI) return;
            stopBtn.disabled = true;
            const status = window.LocalAI.getStatus();
            const isCloud = status.modelType && status.modelType.startsWith("cloud-");
            await window.LocalAI.disable("user-settings");
            window.showDesktopToast?.(isCloud ? "Cloud AI disconnected." : "Local AI stopped.");
            updateLocalAiSettingsUI();
        });
    }

    // Wire Configure buttons
    const configOpenAiBtn = document.getElementById("ai-key-configure-openai");
    const configGeminiBtn = document.getElementById("ai-key-configure-gemini");
    const dialogCancelBtn = document.getElementById("ai-key-dialog-cancel");
    const dialogSaveBtn = document.getElementById("ai-key-dialog-save");
    const dialogInput = document.getElementById("ai-key-dialog-input");
    const dialogBackdrop = document.getElementById("ai-key-dialog-backdrop");
    const aboutToggle = document.getElementById("ai-about-toggle");
    const aboutContent = document.getElementById("ai-about-content");

    if (configOpenAiBtn) {
        configOpenAiBtn.addEventListener("click", () => openApiKeyDialog("openai"));
    }
    if (configGeminiBtn) {
        configGeminiBtn.addEventListener("click", () => openApiKeyDialog("gemini"));
    }
    if (dialogCancelBtn) {
        dialogCancelBtn.addEventListener("click", closeApiKeyDialog);
    }
    if (dialogSaveBtn) {
        dialogSaveBtn.addEventListener("click", () => {
            if (currentDialogProvider === "openai" && dialogInput) {
                localStorage.setItem("settings-openai-api-key", dialogInput.value.trim());
                window.showDesktopToast?.("OpenAI API Key saved.");
            } else if (currentDialogProvider === "gemini" && dialogInput) {
                localStorage.setItem("settings-gemini-api-key", dialogInput.value.trim());
                window.showDesktopToast?.("Gemini API Key saved.");
            }
            closeApiKeyDialog();
            updateLocalAiSettingsUI();
        });
    }
    if (dialogInput) {
        dialogInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                dialogSaveBtn?.click();
            }
        });
    }
    if (dialogBackdrop) {
        dialogBackdrop.addEventListener("click", (e) => {
            if (e.target === dialogBackdrop) {
                closeApiKeyDialog();
            }
        });
    }

    if (aboutToggle && aboutContent) {
        aboutToggle.addEventListener("click", () => {
            const isOpen = aboutContent.classList.toggle("open");
            aboutToggle.classList.toggle("open", isOpen);
        });
    }

    updateLocalAiSettingsUI();
}

function updateLocalAiSettingsUI() {
    const modelSelect = document.getElementById("settings-local-ai-model-select");
    const enableBtn = document.getElementById("settings-local-ai-enable-btn");
    const stopBtn = document.getElementById("settings-local-ai-stop-btn");
    const indicator = document.getElementById("settings-local-ai-indicator");
    const statusText = document.getElementById("settings-local-ai-status-text");
    const progressContainer = document.getElementById("settings-local-ai-progress-container");
    const progressBar = document.getElementById("settings-local-ai-progress-bar");
    const metaModel = document.getElementById("settings-local-ai-meta-model");
    const metaMemory = document.getElementById("settings-local-ai-meta-memory");
    const metaDetails = document.getElementById("settings-local-ai-meta-details");

    const pillDot = document.getElementById("ai-status-pill-dot");
    const pillText = document.getElementById("ai-status-pill-text");

    const status = window.LocalAI?.getStatus ? window.LocalAI.getStatus() : {
        status: "idle",
        statusText: "Local AI service is unavailable.",
        modelLabel: "-",
        memoryMB: 0,
        progress: 0,
        webGpuSupported: false
    };

    const isCloud = status.modelType && status.modelType.startsWith("cloud-");

    // Populate dropdown options if not loaded
    if (modelSelect && window.LocalAI) {
        const models = window.LocalAI.getAvailableModels() || [];
        const selectedModelId = window.LocalAI.getSelectedModelId() || "";

        const freeCloudModels = models.filter(m => m.type && m.type.startsWith("cloud-") && m.free);
        const premiumCloudModels = models.filter(m => m.type && m.type.startsWith("cloud-") && !m.free);
        const localModels = models.filter(m => !m.type || m.type === "local");

        let selectHtml = "";
        
        if (freeCloudModels.length > 0) {
            selectHtml += `<optgroup label="Cloud Models (Free)">`;
            selectHtml += freeCloudModels.map(m => 
                `<option value="${m.id}" ${m.id === selectedModelId ? "selected" : ""}>${m.label}</option>`
            ).join("");
            selectHtml += `</optgroup>`;
        }
        if (premiumCloudModels.length > 0) {
            selectHtml += `<optgroup label="Cloud Models (API Key Required)">`;
            selectHtml += premiumCloudModels.map(m => 
                `<option value="${m.id}" ${m.id === selectedModelId ? "selected" : ""}>${m.label}</option>`
            ).join("");
            selectHtml += `</optgroup>`;
        }
        if (localModels.length > 0) {
            selectHtml += `<optgroup label="Local Models (WebGPU)">`;
            selectHtml += localModels.map(m => 
                `<option value="${m.id}" ${m.id === selectedModelId ? "selected" : ""}>${m.label}</option>`
            ).join("");
            selectHtml += `</optgroup>`;
        }
        
        if (modelSelect.innerHTML !== selectHtml) {
            modelSelect.innerHTML = selectHtml;
            if (!modelSelect.dataset.customized && window.createCustomDropdown) {
                window.createCustomDropdown(modelSelect);
            } else {
                modelSelect.updateCustomDropdown?.();
            }
        } else if (!modelSelect.dataset.customized && window.createCustomDropdown) {
            window.createCustomDropdown(modelSelect);
        } else {
            modelSelect.updateCustomDropdown?.();
        }
        
        modelSelect.disabled = !isCloud && (status.busy || status.ready);
    }

    // Update API Key Status Dots
    const openaiKeyStatus = document.getElementById("ai-key-status-openai");
    const geminiKeyStatus = document.getElementById("ai-key-status-gemini");
    if (openaiKeyStatus) {
        const hasOpenaiKey = !!localStorage.getItem("settings-openai-api-key");
        openaiKeyStatus.innerHTML = hasOpenaiKey 
            ? '<span class="status-indicator-dot connected" style="display: inline-block; width: 6px; height: 6px; margin-right: 4px; vertical-align: middle;"></span>Configured' 
            : '<span class="status-indicator-dot idle" style="display: inline-block; width: 6px; height: 6px; margin-right: 4px; vertical-align: middle;"></span>Not configured';
    }
    if (geminiKeyStatus) {
        const hasGeminiKey = !!localStorage.getItem("settings-gemini-api-key");
        geminiKeyStatus.innerHTML = hasGeminiKey 
            ? '<span class="status-indicator-dot connected" style="display: inline-block; width: 6px; height: 6px; margin-right: 4px; vertical-align: middle;"></span>Using custom key' 
            : '<span class="status-indicator-dot idle" style="display: inline-block; width: 6px; height: 6px; margin-right: 4px; vertical-align: middle;"></span>Using built-in key';
    }

    // Update Status Indicators (Service Card)
    if (indicator) {
        indicator.className = "status-indicator-dot";
        if (status.ready || status.status === "generating") {
            if (isCloud) {
                indicator.classList.add("cloud");
            } else {
                indicator.classList.add("connected");
            }
        } else if (status.status === "loading") {
            indicator.classList.add("loading");
        } else if (status.status === "error") {
            indicator.classList.add("disconnected");
        } else {
            indicator.classList.add("idle");
        }
    }

    if (statusText) {
        statusText.textContent = status.status === "generating"
            ? "Active"
            : status.status === "loading"
                ? "Loading"
                : status.status === "error"
                    ? "Error"
                    : (status.ready ? (isCloud ? "Cloud Ready" : "Local Ready") : "Off");
    }

    // Update Status Pill (Header)
    if (pillDot && pillText) {
        pillDot.className = "status-indicator-dot";
        if (status.ready || status.status === "generating") {
            if (isCloud) {
                pillDot.classList.add("cloud");
                pillText.textContent = "Cloud";
            } else {
                pillDot.classList.add("connected");
                pillText.textContent = "Local";
            }
        } else if (status.status === "loading") {
            pillDot.classList.add("loading");
            pillText.textContent = "Loading";
        } else if (status.status === "error") {
            pillDot.classList.add("disconnected");
            pillText.textContent = "Error";
        } else {
            pillDot.classList.add("idle");
            pillText.textContent = "Off";
        }
    }

    // Progress Bar
    if (progressContainer && progressBar) {
        if (status.status === "loading") {
            progressContainer.style.display = "block";
            const pct = Math.round((status.progress || 0) * 100);
            progressBar.style.width = `${pct}%`;
        } else {
            progressContainer.style.display = "none";
        }
    }

    // Meta Grid
    if (metaModel) metaModel.textContent = status.modelLabel || "-";
    if (metaMemory) metaMemory.textContent = status.memoryMB ? `~${status.memoryMB} MB` : (isCloud ? "Cloud API" : "-");
    if (metaDetails) {
        if (status.status === "loading") {
            const pct = Math.round((status.progress || 0) * 100);
            metaDetails.textContent = `${status.statusText} (${pct}%)`;
        } else if (status.status === "error") {
            metaDetails.textContent = status.lastError || status.statusText;
        } else {
            metaDetails.textContent = status.statusText || (isCloud ? "Cloud service is disconnected." : "Service is stopped.");
        }
    }

    // Enable/Stop buttons
    const isAiActive = status.enabled && status.status !== "error";
    if (enableBtn) {
        if (isCloud) {
            enableBtn.disabled = status.busy;
            enableBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Connect Cloud AI';
        } else {
            enableBtn.disabled = !status.webGpuSupported || status.busy;
            enableBtn.innerHTML = status.status === "error"
                ? '<i class="fa-solid fa-rotate-right"></i> Retry enabling Local AI'
                : '<i class="fa-solid fa-bolt"></i> Enable Local AI';
        }
        enableBtn.style.display = isAiActive ? "none" : "inline-flex";
    }

    if (stopBtn) {
        stopBtn.disabled = !status.enabled;
        stopBtn.style.display = isAiActive ? "inline-flex" : "none";
        if (isCloud) {
            stopBtn.className = "settings-btn btn-danger";
            stopBtn.innerHTML = '<i class="fa-solid fa-link-slash"></i> Disconnect';
        } else {
            stopBtn.className = "settings-btn btn-danger";
            stopBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Service';
        }
    }
}

function initDebugSettings() {
    const logContainer = document.getElementById("settings-debug-log-container");
    const copyBtn = document.getElementById("settings-debug-copy-btn");
    const clearBtn = document.getElementById("settings-debug-clear-btn");

    if (!logContainer) return;

    const getLocalAIDebugLines = () => {
        const snapshot = window.LocalAI?.getDebugSnapshot?.() || window.LocalAI?.getStatus?.();
        if (!snapshot) return [];

        const pct = Math.round((Number(snapshot.progress) || 0) * 100);
        const progressLabel = snapshot.progressLabel || (Number.isFinite(pct) ? `${pct}%` : "-");
        const fields = [
            `status=${snapshot.status || "-"}`,
            `progress=${progressLabel}`,
            `model=${snapshot.modelId || snapshot.modelLabel || "-"}`,
            `type=${snapshot.modelType || "-"}`,
            `webgpu=${snapshot.webGpuSupported ?? snapshot.webGpu ?? "-"}`,
            `mirror=${snapshot.mirror ?? "-"}`,
            `worker=${snapshot.workerUrl || "-"}`
        ];

        const lines = [
            `[LocalAI Snapshot] ${fields.join(" ")}`,
            `[LocalAI Detail] ${snapshot.statusText || "-"}`
        ];
        if (snapshot.lastError) {
            lines.push(`[LocalAI Last Error] ${snapshot.lastError}`);
        }
        return lines;
    };

    const renderLogs = () => {
        const logs = window.SystemLogs || [];
        const localAiLines = getLocalAIDebugLines();
        if (logs.length === 0 && localAiLines.length === 0) {
            logContainer.innerHTML = `<span style="color: var(--text-muted, #6b7280);">No logs recorded. System is running cleanly.</span>`;
            return;
        }
        logContainer.textContent = [...localAiLines, ...logs].join("\n");
        logContainer.scrollTop = logContainer.scrollHeight;
    };

    renderLogs();

    if (window.EventBus) {
        window.EventBus.on("system:log-added", () => {
            const activePanel = document.querySelector(".settings-panel.active");
            if (activePanel && activePanel.dataset.panel === "debug") {
                renderLogs();
            }
        });
        window.EventBus.on("local-ai:status", () => {
            const activePanel = document.querySelector(".settings-panel.active");
            if (activePanel && activePanel.dataset.panel === "debug") {
                renderLogs();
            }
        });
    }

    const tabs = document.querySelectorAll(".settings-tab-btn, .settings-user-card");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            if (tab.dataset.tab === "debug") {
                renderLogs();
            }
        });
    });

    if (copyBtn) {
        copyBtn.addEventListener("click", () => {
            const textToCopy = (window.SystemLogs || []).join("\n");
            if (!textToCopy) {
                if (window.showDesktopToast) window.showDesktopToast("No logs to copy");
                return;
            }
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    if (window.showDesktopToast) window.showDesktopToast("Logs copied to clipboard!");
                })
                .catch(err => {
                    console.error("Failed to copy logs:", err);
                    if (window.showDesktopToast) window.showDesktopToast("Failed to copy logs");
                });
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            window.SystemLogs = [];
            renderLogs();
            if (window.showDesktopToast) window.showDesktopToast("Debug logs cleared");
        });
    }
}

// System Reset / Recovery Options
function initSystemResetSettings() {
    const resetVarsBtn = document.getElementById("settings-reset-variables-btn");
    const fullResetBtn = document.getElementById("settings-full-reset-btn");

    if (resetVarsBtn) {
        resetVarsBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to reset saved desktop variables?\nThis will reset icon positions and uninstall Store-downloaded apps. The page will reload.")) {
                if (window.clearDesktopIconPositions) {
                    window.clearDesktopIconPositions();
                }

                if (window.resetInstalledStoreApps) {
                    window.resetInstalledStoreApps();
                } else if (window.Storage) {
                    window.Storage.local.remove("bl4ut0_installed_apps");
                } else {
                    localStorage.removeItem("bl4ut0_installed_apps");
                    sessionStorage.removeItem("bl4ut0_installed_apps");
                }

                window.showDesktopToast?.("Saved variables reset. Reloading...");
                setTimeout(() => window.location.reload(), 1200);
            }
        });
    }

    if (fullResetBtn) {
        fullResetBtn.addEventListener("click", () => {
            if (confirm("CRITICAL WARNING: This will completely wipe all settings, wallpapers, volume level, API keys, custom apps, and your local filesystem (IndexedDB files).\n\nAre you sure you want to proceed with a Full Factory Reset?")) {
                // Clear localStorage & sessionStorage
                localStorage.clear();
                sessionStorage.clear();

                // Delete Virtual Filesystem Database (IndexedDB)
                if (window.indexedDB) {
                    try {
                        window.indexedDB.deleteDatabase("PortfoliOS_FS");
                    } catch (e) {
                        console.error("Failed to delete IndexedDB database", e);
                    }
                }

                window.showDesktopToast?.("Full system reset. Rebooting...");
                setTimeout(() => window.location.reload(), 1200);
            }
        });
    }
}

// Bootstrap function for Settings App
function initSettingsApp() {
    initSettingsTabs();
    initVolumeSettings();
    initResolutionSettings();
    initScreensaverSettings();
    initGDriveSettings();
    initLocalAISettings();
    initDebugSettings();
    initSystemResetSettings();
    renderSettingsUser();
    window.renderWallpaperOptions();
    window.renderThemeOptions();
    window.renderScreensaverOptions();

    // Initialize custom dropdowns on load
    const resSelect = document.getElementById("desktop-resolution-select");
    if (resSelect && window.createCustomDropdown) window.createCustomDropdown(resSelect);

    const ssDelaySelect = document.getElementById("screensaver-delay-select");
    if (ssDelaySelect && window.createCustomDropdown) window.createCustomDropdown(ssDelaySelect);
}

// Run initialization once the DOM is loaded or when settings is opened
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSettingsApp);
} else {
    // If DOM is already loaded (modular app shell style)
    initSettingsApp();
}

// EventBus bindings
if (window.EventBus) {
    window.EventBus.on("wallpaper:changed", () => window.renderWallpaperOptions());
    window.EventBus.on("desktop:refresh", () => window.renderWallpaperOptions());
    window.EventBus.on("desktop:refresh", () => window.renderThemeOptions());
    window.EventBus.on("desktop:refresh", () => window.renderScreensaverOptions());
    window.EventBus.on("theme:changed", () => window.renderThemeOptions());
    window.EventBus.on("theme:reset", () => window.renderThemeOptions());
    window.EventBus.on("screensaver:changed", () => window.renderScreensaverOptions());
    window.EventBus.on("user:changed", () => renderSettingsUser());
    window.EventBus.on("volume:changed", (val) => updateVolumeUI(val));
    window.EventBus.on("state:changed:gdriveConnected", () => updateGDriveUI());
    window.EventBus.on("local-ai:status", () => updateLocalAiSettingsUI());
    window.EventBus.on("local-ai:model-changed", () => updateLocalAiSettingsUI());
    window.EventBus.on("local-ai:mirror-changed", () => updateLocalAiSettingsUI());
    window.EventBus.on("app:opened", (name) => {
        if (name === "settings") {
            // refresh data when window is opened
            if (window.state) {
                updateVolumeUI(window.state.volume);
                
                const resSelect = document.getElementById("desktop-resolution-select");
                if (resSelect) {
                    resSelect.value = window.state.desktopResolution;
                    resSelect.updateCustomDropdown?.();
                }

                const screensaverDelay = document.getElementById("screensaver-delay-select");
                if (screensaverDelay) {
                    screensaverDelay.value = String(window.state.screensaverDelay || 5);
                    screensaverDelay.updateCustomDropdown?.();
                }
            }
            updateGDriveUI();
            updateLocalAiSettingsUI();
            renderSettingsUser();
            window.renderWallpaperOptions();
            window.renderThemeOptions();
            window.renderScreensaverOptions();
            
            const activePanel = document.querySelector(".settings-panel.active");
            if (activePanel && activePanel.dataset.panel === "debug") {
                const logContainer = document.getElementById("settings-debug-log-container");
                if (logContainer) {
                    const logs = window.SystemLogs || [];
                    logContainer.textContent = logs.length === 0 ? "No logs recorded." : logs.join("\n");
                    logContainer.scrollTop = logContainer.scrollHeight;
                }
            }
        }
    });
}
