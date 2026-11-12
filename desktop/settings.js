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

        if (targetTab === "apps") {
            window.renderDefaultAppsSettings?.();
        } else if (targetTab === "desktop") {
            window.renderWallpaperOptions?.();
        }
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
        window.setProfileAvatar(avatar, user.avatar, `${user.displayName} profile picture`);
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
    const controls = document.querySelector("[data-account-switch-controls]");
    if (controls) {
        controls.innerHTML = window.renderProfileSwitchControls?.() || "";
        if (!controls.dataset.bound) { window.bindProfileSwitchControls?.(controls); controls.dataset.bound = "1"; }
    }
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
    const description = document.getElementById("settings-gdrive-description");
    const accountCard = document.getElementById("settings-gdrive-account");
    const accountAvatar = document.getElementById("settings-gdrive-account-avatar");
    const accountName = document.getElementById("settings-gdrive-account-name");
    const accountEmail = document.getElementById("settings-gdrive-account-email");
    const lastSyncText = document.getElementById("settings-gdrive-last-sync");
    
    if (clientIdInput) {
        const defaultId = window.GDriveSync?.defaultClientId || "";
        if (!clientIdInput.value && defaultId) {
            clientIdInput.value = defaultId;
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
        statusText.textContent = isConnected ? "Private session / Cloud Sync enabled" : (window.getSavedPrivateProfile?.()?.source === "google" ? "Private profile remembered / Cloud Sync paused" : "Not Connected");
    }
    if (description) {
        description.textContent = isConnected
            ? "Your Google private profile is active. SystemFS files, preferences, and saved progress are connected to Google Drive."
            : "Sign in with Google to activate your private profile and back up SystemFS. Your profile stays remembered after reload; reconnect to resume cloud backup.";
    }
    const profile = window.GDriveSync?.googleProfile || window.GDriveSync?.getSavedGoogleProfile?.();
    if (accountCard) accountCard.hidden = !profile;
    if (accountAvatar) {
        window.setProfileAvatar(accountAvatar, profile?.picture, `${profile?.name || "Google account"} profile picture`);
        accountAvatar.hidden = !profile?.picture;
    }
    if (accountName) accountName.textContent = profile?.name || "Google Drive account";
    if (accountEmail) accountEmail.textContent = profile?.email || window.GDriveSync?.getCurrentFolderLabel?.() || "";
    if (lastSyncText && window.GDriveSync?.getScopedStorageKey) {
        const lastSync = Number(window.Storage?.local.get(window.GDriveSync.getScopedStorageKey("last_sync_time")) || 0);
        lastSyncText.textContent = lastSync
            ? `Last synced ${new Date(lastSync).toLocaleString()}`
            : "Not synced yet";
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

    window.GDriveSync?.loadGsiLibrary().catch((error) => {
        console.warn("PortfoliOS: Google sign-in could not be prepared.", error);
    });

    const providerCards = document.querySelectorAll("#settings-cloud-providers .cloud-provider-card");
    if (providerCards.length) {
        providerCards.forEach((card) => {
            card.addEventListener("click", () => {
                const providerId = card.dataset.provider;
                if (!providerId) return;
                providerCards.forEach((c) => {
                    const isActive = c === card;
                    c.classList.toggle("active", isActive);
                    const badge = c.querySelector(".provider-badge");
                    if (badge) {
                        badge.classList.toggle("active", isActive);
                        badge.textContent = isActive ? "Active" : "Available";
                    }
                });
                if (window.CloudSync?.get(providerId)) {
                    window.CloudSync.setActiveDriver(providerId);
                    const syncDriver = window.CloudSync.get(providerId);
                    if (syncDriver?.authDriver && window.CloudAuth?.get(syncDriver.authDriver)) {
                        window.CloudAuth.setActiveDriver(syncDriver.authDriver);
                    }
                    const titleEl = document.getElementById("settings-cloud-provider-title");
                    if (titleEl) titleEl.textContent = `${syncDriver.name} Connection`;
                    if (window.showDesktopToast) {
                        window.showDesktopToast(`Cloud provider set to ${syncDriver.name}`);
                    }
                }
            });
        });
    }
    
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
                alert(err?.message || "Connection failed. Please check your credentials.");
            } finally {
                connectBtn.disabled = false;
                connectBtn.innerHTML = '<i class="fa-brands fa-google-drive"></i> Sign in with Google Drive';
                updateGDriveUI();
            }
        });
    }

    if (disconnectBtn) {
        disconnectBtn.addEventListener("click", async () => {
            if (window.GDriveSync) {
                await window.GDriveSync.logout();
                if (window.showDesktopToast) window.showDesktopToast("Google Drive Disconnected.");
            }
            updateGDriveUI();
        });
    }

    if (syncBtn) {
        syncBtn.addEventListener("click", () => {
            if (!window.isPrivateUser?.(window.state?.currentUserId)) {
                if (window.showDesktopToast) window.showDesktopToast("Cloud Sync is reserved for private workspaces.");
                return;
            }
            triggerGDriveSync();
        });
    }

    // Zero-Knowledge Keyring Vault Actions
    const unlockVaultBtn = document.getElementById("settings-vault-unlock-btn");
    const setupVaultBtn = document.getElementById("settings-vault-setup-btn");
    const exportVaultBtn = document.getElementById("settings-vault-export-btn");
    const importVaultBtn = document.getElementById("settings-vault-import-btn");
    const lockVaultBtn = document.getElementById("settings-vault-lock-btn");
    const purgeVaultBtn = document.getElementById("settings-vault-purge-btn");
    const vaultMsg = document.getElementById("settings-vault-msg");
    const vaultIndicator = document.getElementById("settings-vault-indicator");
    const vaultStatusText = document.getElementById("settings-vault-status-text");

    const showVaultMsg = (text, isError = false) => {
        if (!vaultMsg) return;
        vaultMsg.textContent = text;
        vaultMsg.style.color = isError ? "#ef4444" : "#22c55e";
        vaultMsg.hidden = false;
        setTimeout(() => { if (vaultMsg) vaultMsg.hidden = true; }, 5000);
    };

    const updateVaultStatusUI = async () => {
        if (!vaultIndicator || !vaultStatusText || !window.PortfoliOSVault?.getStatus) return;
        try {
            const status = await window.PortfoliOSVault.getStatus();
            vaultIndicator.className = "status-indicator-dot";
            if (status.isLocked) {
                vaultIndicator.classList.add("loading");
                vaultStatusText.textContent = `Vault Locked (${status.providers.length} provider(s) encrypted)`;
            } else if (!status.providers.length && !status.hasEncryptedBackup) {
                vaultIndicator.classList.add("idle");
                vaultStatusText.textContent = "Vault Unconfigured (Ready for setup)";
            } else {
                vaultIndicator.classList.add("connected");
                vaultStatusText.textContent = `Vault Active (${status.tokenCount || status.providers.length} provider(s) in memory)`;
            }
        } catch (_) {}
    };

    if (unlockVaultBtn) {
        unlockVaultBtn.addEventListener("click", () => {
            if (window.PortfoliOSVault?.showUnlockModal) {
                window.PortfoliOSVault.showUnlockModal({
                    onUnlock: () => {
                        showVaultMsg("✓ Zero-Knowledge Vault unlocked successfully.");
                        updateVaultStatusUI();
                    }
                });
            } else if (window.handleCommand) {
                window.handleCommand("vault unlock");
            }
        });
    }

    if (setupVaultBtn) {
        setupVaultBtn.addEventListener("click", () => {
            if (window.PortfoliOSVault?.showSetupModal) {
                window.PortfoliOSVault.showSetupModal({
                    onComplete: () => {
                        showVaultMsg("✓ Vault Master Passphrase initialized.");
                        updateVaultStatusUI();
                    }
                });
            } else if (window.handleCommand) {
                window.handleCommand("vault init");
            }
        });
    }

    if (purgeVaultBtn) {
        purgeVaultBtn.addEventListener("click", () => {
            if (window.PortfoliOSVault?.showPurgeModal) {
                window.PortfoliOSVault.showPurgeModal({
                    onPurged: () => {
                        showVaultMsg("✓ Zero-Knowledge Vault purged and reset.");
                        updateVaultStatusUI();
                    }
                });
            } else if (window.handleCommand) {
                window.handleCommand("vault purge");
            }
        });
    }

    if (exportVaultBtn) {
        exportVaultBtn.addEventListener("click", async () => {
            if (window.handleCommand) {
                await window.handleCommand("vault export");
                showVaultMsg("✓ Vault export initiated. Check terminal output.");
            }
        });
    }

    if (importVaultBtn) {
        importVaultBtn.addEventListener("click", async () => {
            if (window.PortfoliOSVault?.showUnlockModal) {
                window.PortfoliOSVault.showUnlockModal({
                    onUnlock: () => {
                        showVaultMsg("✓ Vault unlocked.");
                        updateVaultStatusUI();
                    }
                });
            } else if (window.handleCommand) {
                await window.handleCommand("vault import");
            }
        });
    }

    if (lockVaultBtn) {
        lockVaultBtn.addEventListener("click", () => {
            if (window.PortfoliOSVault && typeof window.PortfoliOSVault.lock === "function") {
                window.PortfoliOSVault.lock();
            }
            const session = window.PortfoliOSRuntimeBridge?.getActiveSession();
            if (session?.vault) session.vault.lock();
            showVaultMsg("✓ Zero-Knowledge Vault locked.");
            updateVaultStatusUI();
        });
    }

    window.addEventListener("portfolios:vault-status-changed", () => {
        updateVaultStatusUI();
    });
    updateVaultStatusUI();

    // Initial load
    updateGDriveUI();
}

// Wallpaper Review and Selection
let currentReviewedWallpaper = null;

window.renderWallpaperOptions = () => {
    const container = document.getElementById("wallpaper-options");
    const customContainer = document.getElementById("custom-wallpapers-grid");
    const reviewScreen = document.getElementById("wallpaper-review-screen");
    const reviewName = document.getElementById("wallpaper-review-name");
    const reviewStatus = document.getElementById("wallpaper-review-status");
    const applyBtn = document.getElementById("btn-apply-reviewed-wallpaper");
    const browseBtn = document.getElementById("btn-browse-custom-wallpaper");

    const wallpaperOptions = window.wallpaperOptions || [];
    const customList = window.getCustomWallpapers ? window.getCustomWallpapers() : [];
    const activeWallpaperId = window.state?.wallpaper || "aurora";

    const updateReviewPane = (id, isCustom, label, previewUrl) => {
        if (!reviewScreen) return;
        currentReviewedWallpaper = { id, isCustom, label, previewUrl };

        if (isCustom) {
            reviewScreen.removeAttribute("data-preview-wallpaper");
            reviewScreen.classList.add("has-custom-wallpaper");
            const bgUrl = previewUrl || (window._customWallpaperBlobUrl || (window.Storage ? window.Storage.local.get(window.getPreferencesKey("CustomWallpaperThumb")) : null));
            if (bgUrl) {
                reviewScreen.style.backgroundImage = `url("${bgUrl}")`;
            } else {
                reviewScreen.style.backgroundImage = "var(--custom-wallpaper-url, none)";
            }
        } else {
            reviewScreen.classList.remove("has-custom-wallpaper");
            reviewScreen.style.backgroundImage = "";
            reviewScreen.dataset.previewWallpaper = id;
        }

        if (reviewName) reviewName.textContent = label || id;
        const isActive = (id === window.state?.wallpaper);
        if (reviewStatus) {
            reviewStatus.textContent = isActive ? "Active Desktop Wallpaper" : "Selected Preview (Not Applied)";
            reviewStatus.style.color = isActive ? "var(--theme-primary, #22d3ee)" : "var(--text-muted, #94a3b8)";
        }
        if (applyBtn) {
            applyBtn.disabled = isActive;
            applyBtn.innerHTML = isActive ? '<i class="fa-solid fa-check-double"></i> Applied' : '<i class="fa-solid fa-check"></i> Set as Wallpaper';
        }
    };

    // Determine initial active wallpaper info for review pane
    const activeCustom = customList.find(c => c.id === activeWallpaperId);
    if (activeCustom) {
        updateReviewPane(activeCustom.id, true, activeCustom.name, activeCustom.thumb || activeCustom.thumbDataUrl || activeCustom.url);
    } else {
        const activeBuiltIn = wallpaperOptions.find(w => w.id === activeWallpaperId) || wallpaperOptions[0] || { id: "aurora", label: "Aurora" };
        updateReviewPane(activeBuiltIn.id, false, activeBuiltIn.label);
    }

    // Apply button click
    if (applyBtn && !applyBtn._hasApplyListener) {
        applyBtn._hasApplyListener = true;
        applyBtn.addEventListener("click", () => {
            if (currentReviewedWallpaper?.id) {
                window.setWallpaper(currentReviewedWallpaper.id);
                updateReviewPane(currentReviewedWallpaper.id, currentReviewedWallpaper.isCustom, currentReviewedWallpaper.label, currentReviewedWallpaper.previewUrl);
                if (window.showDesktopToast) window.showDesktopToast(`Wallpaper set to ${currentReviewedWallpaper.label}`);
            }
        });
    }

    // Browse button click
    if (browseBtn && !browseBtn._hasWallpaperListener) {
        browseBtn._hasWallpaperListener = true;
        browseBtn.addEventListener("click", () => {
            window.promptCustomWallpaperSelection?.();
        });
    }

    // 1. Render Custom Wallpapers Grid
    if (customContainer) {
        if (!customList.length) {
            customContainer.innerHTML = `
                <div class="wallpaper-empty-state" style="grid-column: 1 / -1; padding: 1rem; text-align: center; font-size: 0.75rem; color: var(--text-muted); background: var(--panel-soft); border-radius: var(--radius-sm); border: 1px dashed var(--line);">
                    <i class="fa-regular fa-image" style="margin-right: 6px;"></i> No custom wallpapers saved yet. Click "Browse Custom Image" to upload one.
                </div>
            `;
        } else {
            customContainer.innerHTML = customList.map((wallpaper) => {
                const isActive = (window.state?.wallpaper === wallpaper.id);
                const thumb = wallpaper.thumb || wallpaper.thumbDataUrl || wallpaper.url || "";
                return `
                    <div class="wallpaper-card custom-wallpaper-card ${isActive ? "active" : ""}"
                        data-wallpaper-choice="${wallpaper.id}" title="${wallpaper.name}">
                        <div class="wallpaper-preview" style="background-image: url('${thumb}'); background-size: cover; background-position: center;">
                            <button type="button" class="custom-wallpaper-delete-btn" data-delete-custom-wallpaper="${wallpaper.id}" title="Delete ${wallpaper.name}">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                        <div class="wallpaper-card-info">
                            <i class="fa-solid fa-image"></i>
                            <span style="max-width: 82px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${wallpaper.name}</span>
                        </div>
                    </div>
                `;
            }).join("");

            // Add delete event listeners
            customContainer.querySelectorAll("[data-delete-custom-wallpaper]").forEach((btn) => {
                btn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const wallId = btn.dataset.deleteCustomWallpaper;
                    if (!wallId) return;
                    await window.deleteCustomWallpaper(wallId);
                    if (window.showDesktopToast) window.showDesktopToast("Custom wallpaper removed");
                    window.renderWallpaperOptions();
                });
            });

            // Add hover review updates
            customContainer.querySelectorAll(".custom-wallpaper-card").forEach((card) => {
                const wallId = card.dataset.wallpaperChoice;
                const item = customList.find(c => c.id === wallId);
                if (item) {
                    card.addEventListener("mouseenter", () => {
                        updateReviewPane(item.id, true, item.name, item.thumb || item.thumbDataUrl || item.url);
                    });
                }
            });
        }
    }

    // 2. Render Built-in Wallpapers Grid
    if (container) {
        const builtIns = wallpaperOptions.filter(w => w.id !== "custom");
        container.innerHTML = builtIns.map((wallpaper) => `
            <button type="button" class="wallpaper-card ${window.state && window.state.wallpaper === wallpaper.id ? "active" : ""}"
                data-wallpaper-choice="${wallpaper.id}" title="Use ${wallpaper.label} wallpaper">
                <div class="wallpaper-preview" data-preview-wallpaper="${wallpaper.id}"></div>
                <div class="wallpaper-card-info">
                    <i class="${wallpaper.icon}"></i>
                    <span>${wallpaper.label}</span>
                </div>
            </button>
        `).join("");

        container.querySelectorAll(".wallpaper-card").forEach((card) => {
            const wallId = card.dataset.wallpaperChoice;
            const item = builtIns.find(w => w.id === wallId);
            if (item) {
                card.addEventListener("mouseenter", () => {
                    updateReviewPane(item.id, false, item.label);
                });
            }
        });
    }
};

// Default Applications and File Associations
window.renderDefaultAppsSettings = () => {
    const listContainer = document.getElementById("default-file-associations-list");
    const customAppSelect = document.getElementById("select-custom-app");
    const customContainer = document.getElementById("custom-associations-container");
    const addBtn = document.getElementById("btn-add-custom-association");
    const resetBtn = document.getElementById("btn-reset-associations");

    if (!listContainer && !customContainer) return;

    const installedApps = (window.desktopApps || []).filter(app => !window.isAppInstalled || window.isAppInstalled(app.id));
    const sortedApps = [...installedApps].sort((a, b) => a.title.localeCompare(b.title));
    const appMap = new Map(sortedApps.map(a => [a.id, a]));

    // 1. Populate standard file type categories
    if (listContainer) {
        const groups = window.COMMON_FILE_TYPE_GROUPS || [];
        listContainer.innerHTML = groups.map((group) => {
            const currentAppId = window.getFileAssociation(group.extensions[0]) || group.defaultApp;

            const compatibleList = (group.compatibleApps || []).filter(appId => !window.isAppInstalled || window.isAppInstalled(appId));
            const otherApps = sortedApps.filter(a => !compatibleList.includes(a.id));

            let optionsHtml = compatibleList.map(appId => {
                const app = appMap.get(appId);
                const title = app ? app.title : appId;
                return `<option value="${appId}" ${appId === currentAppId ? "selected" : ""}>${title}</option>`;
            }).join("");

            if (otherApps.length) {
                optionsHtml += `<optgroup label="Other Applications">` + otherApps.map(app => {
                    return `<option value="${app.id}" ${app.id === currentAppId ? "selected" : ""}>${app.title}</option>`;
                }).join("") + `</optgroup>`;
            }

            const extPills = group.extensions.map(ext => `<span class="ext-badge">${ext}</span>`).join(" ");

            return `
                <div class="file-assoc-row" data-group-id="${group.id}">
                    <div class="file-assoc-info">
                        <div class="file-assoc-icon"><i class="${group.icon}"></i></div>
                        <div class="file-assoc-meta">
                            <span class="file-assoc-title">${group.label}</span>
                            <div class="file-assoc-extensions">${extPills}</div>
                        </div>
                    </div>
                    <div class="file-assoc-control">
                        <select class="settings-select file-group-select" data-group-id="${group.id}" aria-label="Default app for ${group.label}">
                            ${optionsHtml}
                        </select>
                    </div>
                </div>
            `;
        }).join("");

        // Bind change listeners
        listContainer.querySelectorAll(".file-group-select").forEach((select) => {
            select.addEventListener("change", () => {
                const groupId = select.dataset.groupId;
                const newApp = select.value;
                const group = groups.find(g => g.id === groupId);
                if (group && newApp) {
                    group.extensions.forEach(ext => window.setFileAssociation(ext, newApp));
                    const appTitle = appMap.get(newApp)?.title || newApp;
                    if (window.showDesktopToast) window.showDesktopToast(`Default app for ${group.label} set to ${appTitle}`);
                    window.renderDefaultAppsSettings();
                }
            });
        });
    }

    // 2. Populate custom app selector dropdown
    if (customAppSelect) {
        customAppSelect.innerHTML = sortedApps.map(app => `<option value="${app.id}">${app.title}</option>`).join("");
    }

    // 3. Add Custom Association Button
    if (addBtn && !addBtn._hasAddListener) {
        addBtn._hasAddListener = true;
        addBtn.addEventListener("click", () => {
            const input = document.getElementById("input-custom-ext");
            const select = document.getElementById("select-custom-app");
            let ext = (input?.value || "").trim().toLowerCase();
            if (!ext) {
                if (window.showDesktopToast) window.showDesktopToast("Please enter a file extension (e.g. .log)");
                return;
            }
            if (!ext.startsWith(".")) ext = "." + ext;
            if (ext.length < 2) {
                if (window.showDesktopToast) window.showDesktopToast("Invalid file extension");
                return;
            }
            const appId = select?.value;
            if (!appId) return;

            window.setFileAssociation(ext, appId);
            const appTitle = appMap.get(appId)?.title || appId;
            if (window.showDesktopToast) window.showDesktopToast(`Associated ${ext} with ${appTitle}`);
            if (input) input.value = "";
            window.renderDefaultAppsSettings();
        });
    }

    // 4. Render user-defined associations in custom table
    if (customContainer) {
        const userAssocs = window.getUserFileAssociations ? window.getUserFileAssociations() : {};
        const entries = Object.entries(userAssocs);

        if (!entries.length) {
            customContainer.innerHTML = `
                <div style="padding: 0.8rem; font-size: 0.75rem; color: var(--text-muted); background: var(--panel-soft); border-radius: var(--radius-sm); border: 1px dashed var(--line); text-align: center;">
                    No custom file type associations added yet. Enter an extension above to bind it.
                </div>
            `;
        } else {
            customContainer.innerHTML = `
                <table class="custom-assoc-table">
                    <thead>
                        <tr>
                            <th>Extension</th>
                            <th>Associated Application</th>
                            <th style="text-align: right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${entries.map(([ext, appId]) => {
                            const app = appMap.get(appId);
                            const appName = app ? app.title : appId;
                            const appIcon = app?.icon || "fa-solid fa-window-maximize";
                            const iconHtml = appIcon.includes("/") 
                                ? `<img src="${appIcon}" alt="" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 6px;">`
                                : `<i class="${appIcon}" style="color: var(--theme-primary); margin-right: 6px;"></i>`;
                            return `
                                <tr>
                                    <td><span class="ext-badge">${ext}</span></td>
                                    <td>${iconHtml}<strong>${appName}</strong></td>
                                    <td style="text-align: right;">
                                        <button type="button" class="settings-btn btn-danger btn-compact" data-remove-ext="${ext}" title="Remove association for ${ext}">
                                            <i class="fa-solid fa-trash-can"></i> Remove
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            `;

            customContainer.querySelectorAll("[data-remove-ext]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const ext = btn.dataset.removeExt;
                    if (!ext) return;
                    window.removeFileAssociation(ext);
                    if (window.showDesktopToast) window.showDesktopToast(`Removed association for ${ext}`);
                    window.renderDefaultAppsSettings();
                });
            });
        }
    }

    // 5. Reset button
    if (resetBtn && !resetBtn._hasResetListener) {
        resetBtn._hasResetListener = true;
        resetBtn.addEventListener("click", () => {
            if (confirm("Reset all file associations back to PortfoliOS defaults?")) {
                window.resetFileAssociations();
                if (window.showDesktopToast) window.showDesktopToast("File associations reset to defaults");
                window.renderDefaultAppsSettings();
            }
        });
    }
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
            try {
                if (status.status === "generating") {
                    await window.LocalAI.cancelGeneration?.("settings");
                    window.showDesktopToast?.("AI response cancelled.");
                } else {
                    await window.LocalAI.disable("user-settings");
                    window.showDesktopToast?.(isCloud ? "Cloud AI disconnected." : "Local AI stopped.");
                }
            } catch (error) {
                console.error("Local AI stop failed.", error);
                window.showDesktopToast?.("Could not stop the current AI operation.");
            } finally {
                updateLocalAiSettingsUI();
            }
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
        
        modelSelect.disabled = status.busy;
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
        if (status.status === "generating") {
            stopBtn.className = "settings-btn btn-danger";
            stopBtn.innerHTML = '<i class="fa-solid fa-square"></i> Cancel Reply';
        } else if (isCloud) {
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

    window.getSystemDebugReport = () => {
        const build = document.querySelector('meta[name="portfolios-build"]')?.content || 'unknown';
        const paths = ['core/gdrive-sync.js', 'desktop/settings.js', 'core/local-ai.js', 'main.js'];
        const assets = paths.map(path => Array.from(document.scripts)
            .map(script => script.getAttribute('src') || '')
            .find(src => src.startsWith(path + '?')) || path + '?v=unknown');
        return [
            '[PortfoliOS Debug] build=' + build + ' loaded=' + (window.SystemLogStartedAt || 'unknown') + ' exported=' + new Date().toISOString(),
            '[Assets] ' + assets.join(' '),
            '[Startup] ' + performance.getEntriesByType("measure").filter(entry => entry.name.startsWith("portfolio:")).map(entry => entry.name + "=" + Math.round(entry.duration) + "ms").join(" "),
            ...getLocalAIDebugLines(),
            ...(window.SystemLogs || [])
        ].join('\n');
    };

    const renderLogs = () => {
        logContainer.textContent = window.getSystemDebugReport();
        logContainer.scrollTop = logContainer.scrollHeight;
    };

    window.renderSystemDebugLogs = renderLogs;
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
            const textToCopy = window.getSystemDebugReport();
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
    const biosBtn = document.getElementById("settings-open-bios-btn");
    if (biosBtn) {
        biosBtn.addEventListener("click", () => {
            window.openBiosSetup?.();
        });
    }

    const resetVarsBtn = document.getElementById("settings-reset-variables-btn");
    const fullResetBtn = document.getElementById("settings-full-reset-btn");

    if (resetVarsBtn) {
        resetVarsBtn.addEventListener("click", async () => {
            if (confirm("Are you sure you want to reset saved desktop variables?\nThis will reset icon positions and uninstall Store-downloaded apps. The page will reload.")) {
                if (window.clearDesktopIconPositions) {
                    try { await window.clearDesktopIconPositions(); }
                    catch(error) { window.showDesktopToast?.(error.message); return; }
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
    const root = document.querySelector('[data-window="settings"] .desktop-settings-content');
    if (!root) return;
    if (root.dataset.settingsBound === "true") {
        refreshSettingsOnActivation("settings");
        return;
    }
    root.dataset.settingsBound = "true";

    window.AppIcons?.mount(document.getElementById("theme-options")?.parentElement);
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
    window.renderDefaultAppsSettings?.();

    // Initialize custom dropdowns on load
    const resSelect = document.getElementById("desktop-resolution-select");
    if (resSelect && window.createCustomDropdown) window.createCustomDropdown(resSelect);

    const ssDelaySelect = document.getElementById("screensaver-delay-select");
    if (ssDelaySelect && window.createCustomDropdown) window.createCustomDropdown(ssDelaySelect);
}

window.initializeSettingsWindow = initSettingsApp;

// Run initialization once the DOM is loaded or when settings is opened
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSettingsApp);
} else {
    // If DOM is already loaded (modular app shell style)
    initSettingsApp();
}

function refreshSettingsOnActivation(name) {
    if (name !== "settings") return;

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
    window.renderDefaultAppsSettings?.();

    const activePanel = document.querySelector(".settings-panel.active");
    if (activePanel?.dataset.panel === "debug") {
        window.renderSystemDebugLogs?.();
    }
}

// EventBus bindings
if (window.EventBus) {
    window.EventBus.on("wallpaper:changed", () => window.renderWallpaperOptions());
    window.EventBus.on("associations:changed", () => window.renderDefaultAppsSettings?.());
    window.EventBus.on("desktop:refresh", () => window.renderWallpaperOptions());
    window.EventBus.on("desktop:refresh", () => window.renderThemeOptions());
    window.EventBus.on("desktop:refresh", () => window.renderScreensaverOptions());
    window.EventBus.on("theme:changed", () => window.renderThemeOptions());
    window.EventBus.on("theme:reset", () => window.renderThemeOptions());
    window.EventBus.on("screensaver:changed", () => window.renderScreensaverOptions());
    window.EventBus.on("user:changed", () => renderSettingsUser());
    window.EventBus.on("volume:changed", (val) => updateVolumeUI(val));
    window.EventBus.on("state:changed:gdriveConnected", () => updateGDriveUI());
    window.EventBus.on("gdrive:auth-changed", () => { updateGDriveUI(); renderSettingsUser(); });
    window.EventBus.on("local-ai:status", () => updateLocalAiSettingsUI());
    window.EventBus.on("local-ai:model-changed", () => updateLocalAiSettingsUI());
    window.EventBus.on("local-ai:mirror-changed", () => updateLocalAiSettingsUI());
    window.EventBus.on("app:opened", refreshSettingsOnActivation);
    window.EventBus.on("app:restored", refreshSettingsOnActivation);
    window.EventBus.on("app:focused", refreshSettingsOnActivation);
}
