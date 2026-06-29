/**
 * PortfoliOS: Desktop Experience Shell Orchestration
 * Manages view switching, window focus updates, boot triggers, top dock panels, and global click/key event delegations.
 */

let topDockDismissTimer = null;
window.setTopDockOpen = (isOpen, autoDismissMs = 0) => {
    if (topDockDismissTimer) {
        window.clearTimeout(topDockDismissTimer);
        topDockDismissTimer = null;
    }
    const advisory = window.byId ? window.byId("mobile-advisory") : document.getElementById("mobile-advisory");
    const topbarTab = window.byId ? window.byId("topbar-tab") : document.getElementById("topbar-tab");

    document.body.classList.toggle("top-dock-open", isOpen);
    document.body.classList.remove("top-dock-carry");
    if (topbarTab) topbarTab.setAttribute("aria-expanded", String(isOpen));

    if (isOpen && autoDismissMs > 0) {
        document.body.classList.add("top-dock-carry");
        topDockDismissTimer = window.setTimeout(() => {
            window.setTopDockOpen(false);
        }, autoDismissMs);
    }
};

window.openStoreBookmark = (bookmarkId) => {
    const bookmark = window.bookmarkById ? window.bookmarkById(bookmarkId) : null;
    if (!bookmark) return;

    state.browserBookmark = bookmark.id;
    if (window.renderBrowserPage) window.renderBrowserPage(bookmark.id);
    if (window.openDesktopWindow) window.openDesktopWindow("browser");
    
    const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
    if (startMenu) startMenu.hidden = true;
    if (window.showDesktopToast) window.showDesktopToast(`Opening ${bookmark.label}.`);
};

window.renderLinuxInfo = () => {
    const systems = window.systems || [];
    const linuxNeofetch = window.byId ? window.byId("linux-neofetch") : document.getElementById("linux-neofetch");
    const linuxNodeList = window.byId ? window.byId("linux-node-list") : document.getElementById("linux-node-list");

    if (linuxNeofetch) {
        linuxNeofetch.textContent = [
            "OS: Bl4ut0 Linux Lab",
            "Host: homelab / local-first portfolio",
            "Kernel: curiosity-13y+",
            "Shell: bash, PowerShell, Lua, JavaScript",
            "Services: Proxmox, Docker, Tailscale, Netdata, n8n",
            "Theme: quiet infra, loud ideas"
        ].join("\n");
    }

    if (linuxNodeList) {
        linuxNodeList.textContent = systems
            .map((item) => `${item.id.padEnd(12)} ${item.status.padEnd(8)} ${item.title}`)
            .join("\n");
    }
};

window.boot = async () => {
    if (window.SystemFS) {
        try {
            await window.SystemFS.init();
        } catch (err) {
            console.error("Filesystem init error:", err);
        }
    }

    if (window.loadPreferencesFromFilesystem) {
        await window.loadPreferencesFromFilesystem();
    }

    if (window.applyCurrentUserProfile) {
        window.applyCurrentUserProfile();
    }

    if (window.modularApps && window.ensureAppLoaded) {
        window.modularApps.forEach(appId => {
            if (window.isAppInstalled && window.isAppInstalled(appId)) {
                window.ensureAppLoaded(appId);
            }
        });
    }

    if (window.renderDesktopIcons) window.renderDesktopIcons();
    if (window.renderStartMenu) window.renderStartMenu();
    if (window.renderDossier) window.renderDossier(state.activeId);
    if (window.renderNetworkMap) window.renderNetworkMap();
    if (window.renderQuick) window.renderQuick();
    if (window.renderMobileApps) window.renderMobileApps();
    if (window.renderBrowser) window.renderBrowser();
    window.renderLinuxInfo();
    if (window.renderTaskbar) window.renderTaskbar();
    if (window.applyDesktopPreferences) window.applyDesktopPreferences();
    if (window.initWindowManagement) window.initWindowManagement();

    // Programmatically open default windows from state
    if (state.openApps) {
        Array.from(state.openApps).forEach((appId) => {
            if (window.openDesktopWindow) {
                window.openDesktopWindow(appId);
            }
        });
    }

    if (window.initDesktopIconDragging) window.initDesktopIconDragging();
    if (window.updateClock) window.updateClock();
    
    window.addEventListener("resize", () => {
        if (window.renderDesktopIcons) window.renderDesktopIcons();
        if (window.applyDesktopResolution) window.applyDesktopResolution();
    });

    if (window.handleGameRuntimeMessage) {
        window.addEventListener("message", window.handleGameRuntimeMessage);
    }

    if (window.runBootSequence) {
        window.runBootSequence();
    }

    // Ctrl+C CLI escape keybind
    window.addEventListener("keydown", (event) => {
        if (!event.ctrlKey || event.key.toLowerCase() !== "c") return;
        if (state.activeWindow !== "cli" || !state.openApps.has("cli")) return;
        event.preventDefault();
        if (window.closeDesktopWindow) window.closeDesktopWindow("cli");
    }, true);

    // Stop arrow keys from scrolling the webpage during focused game play
    window.addEventListener("keydown", (e) => {
        if (["doomsource", "openrct2", "romplayer"].includes(state.activeWindow) && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
            e.preventDefault();
        }
    }, { capture: true, passive: false });

    // Stop key events bubbling from standard text inputs so game controls don't trigger while writing text
    const preventBubble = (event) => {
        event.stopPropagation();
    };
    
    document.querySelectorAll("input, textarea").forEach((el) => {
        el.addEventListener("keydown", preventBubble);
        el.addEventListener("keyup", preventBubble);
        el.addEventListener("keypress", preventBubble);
    });

    if (window.Storage) {
        if (window.Storage.session.get("bl4ut0MobileNoteDismissed") === "1") {
            const mobileAdvisory = window.byId ? window.byId("mobile-advisory") : document.getElementById("mobile-advisory");
            if (mobileAdvisory) mobileAdvisory.classList.add("is-hidden");
        }
    } else {
        if (sessionStorage.getItem("bl4ut0MobileNoteDismissed") === "1") {
            const mobileAdvisory = window.byId ? window.byId("mobile-advisory") : document.getElementById("mobile-advisory");
            if (mobileAdvisory) mobileAdvisory.classList.add("is-hidden");
        }
    }

    const desktopExp = window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience");
    if (desktopExp && window.showContextMenu) {
        desktopExp.addEventListener("contextmenu", window.showContextMenu);
    }

    // Focus triggers & popup dismissals
    document.addEventListener("pointerdown", (event) => {
        if (event.target.closest('[data-window="doomsource"]')) {
            if (window.appRegistry && window.appRegistry.doomsource && typeof window.appRegistry.doomsource.focusDoomCanvas === "function") {
                window.appRegistry.doomsource.focusDoomCanvas();
            }
        }
        const gameFrame = event.target.closest("iframe.game-frame");
        if (gameFrame && window.focusGameIframe) {
            window.focusGameIframe(gameFrame);
        }

        // Dismiss context menus, starts, clock, volume panels if clicked outside
        if (!event.target.closest("#desktop-context-menu") && window.closeContextMenu) {
            window.closeContextMenu();
        }
        
        const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
        if (startMenu && !event.target.closest("#start-menu") && !event.target.closest("#start-toggle")) {
            startMenu.hidden = true;
        }

        const userPrompt = window.byId ? window.byId("user-profile-prompt") : document.getElementById("user-profile-prompt");
        if (userPrompt && !event.target.closest("#user-profile-prompt") && !event.target.closest("[data-open-private-profile]")) {
            window.closeUserProfilePrompt?.();
        }
        const powerMenu = document.getElementById("power-options-menu");
        if (powerMenu && !powerMenu.hidden && !event.target.closest("#power-options-menu") && !event.target.closest("[data-start-power]")) {
            powerMenu.hidden = true;
        }
        const calPanel = window.byId ? window.byId("calendar-panel") : document.getElementById("calendar-panel");
        if (calPanel && !event.target.closest("#calendar-panel") && !event.target.closest("#clock-toggle")) {
            calPanel.hidden = true;
        }
        
        if (!event.target.closest("#volume-panel") && !event.target.closest("#volume-toggle") && window.closeVolumePanel) {
            window.closeVolumePanel();
        }

        if (!event.target.closest("#local-ai-tray-panel") && !event.target.closest("#local-ai-tray-toggle") && window.closeLocalAITrayPanel) {
            window.closeLocalAITrayPanel();
        }
    });

    // Global click delegation
    document.addEventListener("click", async (event) => {
        const topbarTab = event.target.closest("#topbar-tab");
        if (topbarTab) {
            window.setTopDockOpen(!document.body.classList.contains("top-dock-open"));
            return;
        }

        const doomRetry = event.target.closest("#doom-source-retry");
        if (doomRetry) {
            if (window.appRegistry && window.appRegistry.doomsource && typeof window.appRegistry.doomsource.loadDoomEngine === "function") {
                window.appRegistry.doomsource.loadDoomEngine();
            }
            return;
        }

        const dismissGameControls = event.target.closest("[data-dismiss-game-controls]");
        if (dismissGameControls) {
            dismissGameControls.closest("[data-game-controls]")?.classList.add("is-hidden");
            return;
        }

        const closeSettings = event.target.closest("[data-close-settings]");
        if (closeSettings) {
            if (window.closeDesktopWindow) window.closeDesktopWindow("settings");
            return;
        }

        const wallpaperChoice = event.target.closest("[data-wallpaper-choice]");
        if (wallpaperChoice) {
            if (window.setWallpaper) window.setWallpaper(wallpaperChoice.dataset.wallpaperChoice);
            return;
        }

        const settingsPanelButton = event.target.closest("[data-open-settings-panel]");
        if (settingsPanelButton) {
            if (window.openDesktopSettings) window.openDesktopSettings(settingsPanelButton.dataset.openSettingsPanel || "desktop");
            const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
            if (startMenu) startMenu.hidden = true;
            return;
        }

        const privateProfileButton = event.target.closest("[data-open-private-profile]");
        if (privateProfileButton) {
            const hasSavedProfile = !!(window.getSavedPrivateProfile ? window.getSavedPrivateProfile() : null);
            const isPrivate = (window.getCurrentUser ? window.getCurrentUser()?.id : "") === "private";
            
            if (isPrivate) {
                if (window.openUserProfilePrompt) window.openUserProfilePrompt();
            } else if (hasSavedProfile) {
                if (window.setCurrentUser) window.setCurrentUser("private");
            } else {
                if (window.openUserProfilePrompt) window.openUserProfilePrompt();
            }
            const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
            if (startMenu) startMenu.hidden = true;
            return;
        }

        const deleteProfileBtn = event.target.closest("#btn-delete-profile");
        if (deleteProfileBtn) {
            if (window.clearPrivateProfileData) {
                await window.clearPrivateProfileData();
            } else {
                localStorage.removeItem("bl4ut0_private_user_profile");
            }
            if (window.setCurrentUser) window.setCurrentUser("bl4ut0");
            if (window.closeUserProfilePrompt) window.closeUserProfilePrompt();
            window.showDesktopToast?.("Private profile deleted.");
            return;
        }

        const privateProfileSignIn = event.target.closest("[data-sign-in-private-profile]");
        if (privateProfileSignIn) {
            if (window.signInPrivateProfile) window.signInPrivateProfile();
            return;
        }

        const restoreOwnerProfile = event.target.closest("[data-restore-owner-profile]");
        if (restoreOwnerProfile) {
            const isOwner = (window.getCurrentUser ? window.getCurrentUser()?.id : "") === "bl4ut0";
            if (!isOwner) {
                if (window.restoreOwnerProfile) window.restoreOwnerProfile();
                const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
                if (startMenu) startMenu.hidden = true;
            }
            return;
        }

        const closeUserProfilePrompt = event.target.closest("[data-close-user-profile-prompt]");
        if (closeUserProfilePrompt) {
            if (window.closeUserProfilePrompt) window.closeUserProfilePrompt();
            return;
        }

        const startPowerButton = event.target.closest("[data-start-power]");
        if (startPowerButton) {
            event.stopPropagation();
            let powerMenu = document.getElementById("power-options-menu");
            if (!powerMenu) {
                powerMenu = document.createElement("div");
                powerMenu.id = "power-options-menu";
                powerMenu.className = "power-options-menu";
                powerMenu.innerHTML = `
                    <button type="button" class="power-option-item" id="power-restart-btn">
                        <i class="fa-solid fa-rotate-right"></i>
                        <span>Restart</span>
                    </button>
                    <button type="button" class="power-option-item" id="power-shutdown-btn">
                        <i class="fa-solid fa-power-off"></i>
                        <span>Shut Down</span>
                    </button>
                `;
                document.body.appendChild(powerMenu);
                
                powerMenu.querySelector("#power-restart-btn").addEventListener("click", () => {
                    window.showDesktopToast?.("Restarting system...");
                    setTimeout(() => window.location.reload(), 800);
                });
                
                powerMenu.querySelector("#power-shutdown-btn").addEventListener("click", () => {
                    powerMenu.hidden = true;
                    let shutdownOverlay = document.getElementById("shutdown-overlay");
                    if (!shutdownOverlay) {
                        shutdownOverlay = document.createElement("div");
                        shutdownOverlay.id = "shutdown-overlay";
                        shutdownOverlay.className = "shutdown-overlay";
                        shutdownOverlay.innerHTML = `
                            <div class="shutdown-content">
                                <i class="fa-solid fa-power-off" style="font-size: 3rem; color: #ea4335; cursor: pointer;" id="power-on-btn" title="Turn On"></i>
                                <p style="margin-top: 1rem; color: #9ca3af; font-family: monospace; font-size: 0.9rem;">System is shut down.</p>
                            </div>
                        `;
                        document.body.appendChild(shutdownOverlay);
                        
                        shutdownOverlay.querySelector("#power-on-btn").addEventListener("click", () => {
                            shutdownOverlay.classList.remove("active");
                            setTimeout(() => {
                                shutdownOverlay.remove();
                                window.location.reload();
                            }, 500);
                        });
                    }
                    setTimeout(() => {
                        shutdownOverlay.classList.add("active");
                    }, 50);
                });
            }
            
            const rect = startPowerButton.getBoundingClientRect();
            const scale = window.getDesktopScale ? window.getDesktopScale() : 1;
            powerMenu.style.left = `${rect.left / scale}px`;
            powerMenu.style.bottom = `${(window.innerHeight - rect.top) / scale + 8}px`;
            powerMenu.hidden = !powerMenu.hidden;
            return;
        }

        const themeChoice = event.target.closest("[data-theme-choice]");
        if (themeChoice) {
            if (window.setPortfolioTheme) window.setPortfolioTheme(themeChoice.dataset.themeChoice);
            return;
        }

        const screensaverChoice = event.target.closest("[data-screensaver-choice]");
        if (screensaverChoice) {
            if (window.setScreensaver) window.setScreensaver(screensaverChoice.dataset.screensaverChoice);
            return;
        }

        const dismissMobileNote = event.target.closest("[data-dismiss-mobile-note]");
        if (dismissMobileNote) {
            const advisory = window.byId ? window.byId("mobile-advisory") : document.getElementById("mobile-advisory");
            if (advisory) advisory.classList.add("is-hidden");
            if (window.Storage) {
                window.Storage.session.set("bl4ut0MobileNoteDismissed", "1");
            } else {
                sessionStorage.setItem("bl4ut0MobileNoteDismissed", "1");
            }
            return;
        }

        const themeResetBtn = event.target.closest("#theme-reset-btn");
        if (themeResetBtn) {
            if (window.resetThemeColors) window.resetThemeColors();
            return;
        }

        const startToggle = event.target.closest("#start-toggle");
        if (startToggle) {
            const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
            const calPanel = window.byId ? window.byId("calendar-panel") : document.getElementById("calendar-panel");
            if (startMenu) startMenu.hidden = !startMenu.hidden;
            if (calPanel) calPanel.hidden = true;
            if (window.closeVolumePanel) window.closeVolumePanel();
            if (window.closeLocalAITrayPanel) window.closeLocalAITrayPanel();
            return;
        }

        const resetResolutionBtn = event.target.closest("#reset-resolution-btn");
        if (resetResolutionBtn) {
            state.desktopResolution = "auto";
            const key = window.getPreferencesKey ? window.getPreferencesKey("DesktopResolution") : "bl4ut0DesktopResolution";
            if (window.Storage) {
                window.Storage.local.set(key, "auto");
            } else {
                localStorage.setItem(key, "auto");
            }
            const resSelect = window.byId ? window.byId("desktop-resolution-select") : document.getElementById("desktop-resolution-select");
            if (resSelect) resSelect.value = "auto";
            if (window.applyDesktopResolution) window.applyDesktopResolution();
            return;
        }

        const volumeToggle = event.target.closest("#volume-toggle");
        if (volumeToggle) {
            if (window.toggleVolumePanel) window.toggleVolumePanel();
            if (window.closeLocalAITrayPanel) window.closeLocalAITrayPanel();
            return;
        }

        const localAITrayToggle = event.target.closest("#local-ai-tray-toggle");
        if (localAITrayToggle) {
            if (window.toggleLocalAITrayPanel) window.toggleLocalAITrayPanel();
            return;
        }

        const localAITraySettings = event.target.closest("[data-local-ai-tray-settings]");
        if (localAITraySettings) {
            if (window.openDesktopWindow) {
                window.openDesktopWindow("settings").then(() => {
                    if (window.openSettingsPanel) {
                        window.openSettingsPanel("local-ai");
                    }
                });
            }
            if (window.closeLocalAITrayPanel) window.closeLocalAITrayPanel();
            return;
        }

        const localAITrayEnable = event.target.closest("[data-local-ai-tray-enable]");
        if (localAITrayEnable) {
            if (window.LocalAI) {
                localAITrayEnable.disabled = true;
                const status = window.LocalAI.getStatus();
                const isCloud = status.modelType && status.modelType.startsWith("cloud-");
                localAITrayEnable.innerHTML = isCloud 
                    ? '<i class="fa-solid fa-spinner fa-spin"></i> Connecting' 
                    : '<i class="fa-solid fa-spinner fa-spin"></i> Starting';
                window.LocalAI.enable("Local AI tray")
                    .then((status) => {
                        if (status?.ready) {
                            window.showDesktopToast?.(isCloud ? "Cloud AI is ready." : "Local AI is ready.");
                        }
                    })
                    .catch((error) => {
                        console.error("Local AI tray start failed.", error);
                        window.showDesktopToast?.(isCloud ? "Cloud AI failed to connect." : "Local AI failed to start.");
                    })
                    .finally(() => {
                        window.renderLocalAITray?.();
                    });
            }
            return;
        }

        const localAITrayStop = event.target.closest("[data-local-ai-tray-stop]");
        if (localAITrayStop) {
            if (window.LocalAI) {
                const status = window.LocalAI.getStatus();
                const isCloud = status.modelType && status.modelType.startsWith("cloud-");
                window.LocalAI.disable("tray");
                window.showDesktopToast?.(isCloud ? "Cloud AI disconnected." : "Local AI stopped.");
            }
            return;
        }

        const clockToggle = event.target.closest("#clock-toggle");
        if (clockToggle) {
            const calPanel = window.byId ? window.byId("calendar-panel") : document.getElementById("calendar-panel");
            const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
            if (calPanel) calPanel.hidden = !calPanel.hidden;
            if (startMenu) startMenu.hidden = true;
            if (window.closeVolumePanel) window.closeVolumePanel();
            if (window.closeLocalAITrayPanel) window.closeLocalAITrayPanel();
            return;
        }

        const profileTab = event.target.closest("[data-profile-tab]");
        if (profileTab) {
            const tabId = profileTab.dataset.profileTab;
            const header = profileTab.closest(".profile-tabs-header");
            if (header) {
                header.querySelectorAll(".profile-tab").forEach(btn => {
                    btn.classList.remove("active");
                    btn.setAttribute("aria-selected", "false");
                });
            }
            profileTab.classList.add("active");
            profileTab.setAttribute("aria-selected", "true");
            
            const layout = profileTab.closest(".profile-layout");
            if (layout) {
                layout.querySelectorAll(".profile-panel").forEach(panel => {
                    panel.classList.remove("active");
                });
                const activePanel = layout.querySelector(`#profile-panel-${tabId}`);
                if (activePanel) {
                    activePanel.classList.add("active");
                }
            }
            return;
        }

        const minimizeButton = event.target.closest("[data-minimize-window]");
        if (minimizeButton) {
            if (window.minimizeDesktopWindow) window.minimizeDesktopWindow(minimizeButton.dataset.minimizeWindow);
            return;
        }

        const maximizeButton = event.target.closest("[data-maximize-window]");
        if (maximizeButton) {
            if (window.toggleMaximizeWindow) window.toggleMaximizeWindow(maximizeButton.dataset.maximizeWindow);
            return;
        }

        const closeButton = event.target.closest("[data-close-window]");
        if (closeButton) {
            if (window.closeDesktopWindow) window.closeDesktopWindow(closeButton.dataset.closeWindow);
            return;
        }

        const taskbarButton = event.target.closest("[data-taskbar-app]");
        if (taskbarButton) {
            if (window.handleTaskbarApp) window.handleTaskbarApp(taskbarButton.dataset.taskbarApp);
            return;
        }

        const browserBookmark = event.target.closest("[data-browser-bookmark]");
        if (browserBookmark) {
            if (window.renderBrowserPage) window.renderBrowserPage(browserBookmark.dataset.browserBookmark);
            if (event.target.closest(".browser-bookmarks")) {
                return;
            }
        }

        const quickRouteButton = event.target.closest("[data-quick-route]");
        if (quickRouteButton) {
            state.quickRoute = quickRouteButton.dataset.quickRoute;
            state.quickSearch = "";
            const qSearch = window.byId ? window.byId("quick-search") : document.getElementById("quick-search");
            if (qSearch) qSearch.value = "";
            const routeItems = window.getQuickRouteItems ? window.getQuickRouteItems() : [];
            state.quickActiveId = state.quickRoute === "overview" ? "overview" : (routeItems[0]?.id || "overview");
            if (window.renderQuick) window.renderQuick();
            return;
        }

        const quickFilterButton = event.target.closest("[data-quick-filter]");
        if (quickFilterButton) {
            state.quickFilter = quickFilterButton.dataset.quickFilter;
            const routeItems = window.getQuickRouteItems ? window.getQuickRouteItems() : [];
            if (state.quickActiveId !== "overview" && !routeItems.some((item) => item.id === state.quickActiveId)) {
                state.quickActiveId = routeItems[0]?.id || "overview";
            }
            if (window.renderQuick) window.renderQuick();
            return;
        }

        const quickSelectButton = event.target.closest("[data-quick-select]");
        if (quickSelectButton) {
            state.quickActiveId = quickSelectButton.dataset.quickSelect;
            state.activeId = state.quickActiveId;
            if (window.renderQuick) window.renderQuick();
            return;
        }

        const mobileOpenButton = event.target.closest("[data-mobile-open]");
        if (mobileOpenButton) {
            if (window.openMobileApp) window.openMobileApp(mobileOpenButton.dataset.mobileOpen);
            return;
        }

        const mobileHomeButton = event.target.closest("[data-mobile-home]");
        if (mobileHomeButton) {
            if (window.showMobileHome) window.showMobileHome();
            return;
        }

        const mobileBackButton = event.target.closest("[data-mobile-back]");
        if (mobileBackButton) {
            if (state.mobileActiveId && window.showMobileHome) window.showMobileHome();
            return;
        }

        const mobileRecentsButton = event.target.closest("[data-mobile-recents]");
        if (mobileRecentsButton) {
            if (window.showMobileHome) window.showMobileHome();
            const mobScreen = window.byId ? window.byId("mobile-screen") : document.getElementById("mobile-screen");
            if (mobScreen) mobScreen.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        const selectButton = event.target.closest("[data-select]");
        if (selectButton) {
            if (window.renderDossier) window.renderDossier(selectButton.dataset.select);
        }

        const installStoreApp = event.target.closest("[data-install-store-app]");
        if (installStoreApp) {
            if (window.installApp) window.installApp(installStoreApp.dataset.installStoreApp);
            return;
        }

        const storeCategoryBtn = event.target.closest("[data-store-category]");
        if (storeCategoryBtn) {
            state.storeCategory = storeCategoryBtn.dataset.storeCategory;
            if (window.renderStore) window.renderStore();
            return;
        }

        const storeInstallFilterBtn = event.target.closest("[data-store-install-filter]");
        if (storeInstallFilterBtn) {
            state.storeInstallFilter = storeInstallFilterBtn.dataset.storeInstallFilter;
            state.storeCategory = "all";
            if (window.renderStore) window.renderStore();
            return;
        }

        const storeBookmarkButton = event.target.closest("[data-open-store-bookmark]");
        if (storeBookmarkButton) {
            if (window.openStoreBookmark) window.openStoreBookmark(storeBookmarkButton.dataset.openStoreBookmark);
            return;
        }

        const uninstallStoreApp = event.target.closest("[data-uninstall-store-app]");
        if (uninstallStoreApp) {
            if (window.uninstallApp) window.uninstallApp(uninstallStoreApp.dataset.uninstallStoreApp);
            return;
        }

        const openButton = event.target.closest("[data-open-app]");
        if (openButton) {
            if (openButton.dataset.preventClick === "true") {
                delete openButton.dataset.preventClick;
                return;
            }
            if (openButton.dataset.openApp === "settings" && window.openDesktopSettings) {
                window.openDesktopSettings("desktop");
            } else if (window.openDesktopWindow) {
                window.openDesktopWindow(openButton.dataset.openApp);
            }
            const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
            if (startMenu) startMenu.hidden = true;
        }

        const viewButton = event.target.closest("[data-view]");
        if (viewButton) {
            const shouldCarryDock = document.body.classList.contains("top-dock-open");
            if (window.switchView) window.switchView(viewButton.dataset.view);
            window.setTopDockOpen(shouldCarryDock, shouldCarryDock ? 2600 : 0);
        }

        const enterButton = event.target.closest("[data-enter-view]");
        if (enterButton) {
            const bootScreen = window.byId ? window.byId("boot-screen") : document.getElementById("boot-screen");
            if (bootScreen) bootScreen.classList.add("hidden");
            if (window.switchView) window.switchView(enterButton.dataset.enterView);
            
            if (!state.systemStarted) {
                state.systemStarted = true;
                if (window.startCanvas) window.startCanvas();
                if (window.updateClock) setInterval(window.updateClock, 30000);
            }
        }

        if (!event.target.closest(".topbar")) {
            window.setTopDockOpen(false);
        }
    });

    const volumeSlider = window.byId ? window.byId("desktop-volume") : document.getElementById("desktop-volume");
    if (volumeSlider) {
        volumeSlider.addEventListener("input", (event) => {
            if (window.setDesktopVolume) window.setDesktopVolume(event.target.value);
        });
    }

    const themePrimaryPicker = window.byId ? window.byId("theme-primary-picker") : document.getElementById("theme-primary-picker");
    if (themePrimaryPicker) {
        themePrimaryPicker.addEventListener("input", (event) => {
            if (window.setThemeColor) window.setThemeColor("primary", event.target.value);
        });
    }

    const themeAccentPicker = window.byId ? window.byId("theme-accent-picker") : document.getElementById("theme-accent-picker");
    if (themeAccentPicker) {
        themeAccentPicker.addEventListener("input", (event) => {
            if (window.setThemeColor) window.setThemeColor("accent", event.target.value);
        });
    }

    const resolutionSelect = window.byId ? window.byId("desktop-resolution-select") : document.getElementById("desktop-resolution-select");
    if (resolutionSelect) {
        resolutionSelect.addEventListener("change", (event) => {
            state.desktopResolution = event.target.value;
            const key = window.getPreferencesKey ? window.getPreferencesKey("DesktopResolution") : "bl4ut0DesktopResolution";
            if (window.Storage) {
                window.Storage.local.set(key, event.target.value);
            } else {
                localStorage.setItem(key, event.target.value);
            }
            if (window.applyDesktopResolution) window.applyDesktopResolution();
        });
    }

    const quickSearch = window.byId ? window.byId("quick-search") : document.getElementById("quick-search");
    if (quickSearch) {
        quickSearch.addEventListener("input", (event) => {
            state.quickSearch = event.target.value;
            const routeItems = window.getQuickRouteItems ? window.getQuickRouteItems() : [];
            if (state.quickActiveId !== "overview" && !routeItems.some((item) => item.id === state.quickActiveId)) {
                state.quickActiveId = routeItems[0]?.id || "overview";
            }
            if (window.renderQuick) window.renderQuick();
        });
    }

    document.querySelectorAll(".desktop-window").forEach((windowEl) => {
        windowEl.addEventListener("pointerdown", () => {
            state.activeWindow = windowEl.dataset.window;
            state.minimizedApps.delete(windowEl.dataset.window);
            windowEl.style.zIndex = String(++state.zIndex);
            document.querySelectorAll(".desktop-window").forEach((item) => item.classList.remove("active"));
            windowEl.classList.add("active");
            if (window.renderTaskbar) window.renderTaskbar();
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "F11") {
            if (state.activeWindow === "browser") {
                event.preventDefault();
                if (window.toggleMaximizeWindow) window.toggleMaximizeWindow("browser");
            }
        }
    });

    document.querySelectorAll(".terminal-window").forEach(win => {
        win.addEventListener("click", () => {
            const input = window.byId ? window.byId("terminal-input") : document.getElementById("terminal-input");
            if (input && window.getSelection().toString().length === 0) {
                input.focus();
            }
        });
    });

    const wadInput = window.byId ? window.byId("wad-file-input") : document.getElementById("wad-file-input");
    if (wadInput) {
        wadInput.addEventListener("change", (event) => {
            if (window.inspectWadFile) {
                window.inspectWadFile(event.target.files[0]).catch(() => {
                    const status = window.byId ? window.byId("wad-status") : document.getElementById("wad-status");
                    if (status) status.textContent = "Could not read that WAD file.";
                });
            }
        });
    }

    const serverWadButton = window.byId ? window.byId("server-wad-check") : document.getElementById("server-wad-check");
    if (serverWadButton) {
        serverWadButton.addEventListener("click", () => {
            if (window.inspectServerWad) {
                window.inspectServerWad().catch(() => {
                    const status = window.byId ? window.byId("server-wad-status") : document.getElementById("server-wad-status");
                    if (status) status.textContent = "Could not inspect the server WAD route.";
                });
            }
        });
    }
};
