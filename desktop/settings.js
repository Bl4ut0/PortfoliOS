/**
 * PortfoliOS: Desktop Settings Component
 * Handles settings tab switching, display resolution, sound volume, theme colors, and Google Drive sync.
 */

// Tab Navigation Logic
function initSettingsTabs() {
    const tabs = document.querySelectorAll(".settings-tab-btn");
    const panels = document.querySelectorAll(".settings-main .settings-panel");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.dataset.tab;
            
            // Switch tabs
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            // Switch panels
            panels.forEach(panel => {
                if (panel.dataset.panel === targetTab) {
                    panel.classList.add("active");
                } else {
                    panel.classList.remove("active");
                }
            });
        });
    });
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
                if (window.Storage) {
                    window.Storage.local.set("bl4ut0DesktopResolution", "auto");
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

// Google Drive Sync UI Sync Logic
function updateGDriveUI() {
    const isConnected = window.GDriveSync && window.GDriveSync.getToken() !== null;
    
    const indicator = document.getElementById("settings-gdrive-indicator");
    const statusText = document.getElementById("settings-gdrive-status-text");
    const connectBtn = document.getElementById("settings-gdrive-connect-btn");
    const disconnectBtn = document.getElementById("settings-gdrive-disconnect-btn");
    const syncSection = document.getElementById("settings-sync-actions-section");
    const clientIdInput = document.getElementById("settings-gdrive-client-id");
    
    if (clientIdInput) {
        const defaultId = window.GDriveSync?.defaultClientId || "";
        const storedId = localStorage.getItem("bl4ut0_gdrive_client_id") || defaultId;
        if (!clientIdInput.value && storedId) {
            clientIdInput.value = storedId;
        }
    }

    if (indicator) {
        indicator.className = `status-indicator-dot ${isConnected ? "connected" : "disconnected"}`;
    }
    if (statusText) {
        statusText.textContent = isConnected ? "Connected to Google Drive" : "Not Connected";
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
                connectBtn.innerHTML = '<i class="fa-solid fa-link"></i> Connect Account';
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
        if (window.showDesktopToast) window.showDesktopToast("File Sync Complete!");
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

// Bootstrap function for Settings App
function initSettingsApp() {
    initSettingsTabs();
    initVolumeSettings();
    initResolutionSettings();
    initGDriveSettings();
    window.renderWallpaperOptions();
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
    window.EventBus.on("volume:changed", (val) => updateVolumeUI(val));
    window.EventBus.on("state:changed:gdriveConnected", () => updateGDriveUI());
    window.EventBus.on("app:opened", (name) => {
        if (name === "settings") {
            // refresh data when window is opened
            if (window.state) {
                updateVolumeUI(window.state.volume);
                
                const resSelect = document.getElementById("desktop-resolution-select");
                if (resSelect) {
                    resSelect.value = window.state.desktopResolution;
                }
            }
            updateGDriveUI();
            window.renderWallpaperOptions();
        }
    });
}
