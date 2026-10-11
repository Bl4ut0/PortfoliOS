(function () {
    const APP_ID = "portfolio-studio";
    const sessions = new WeakMap();

    function renderLockedBody() {
        return `
            <div class="studio-locked-screen">
                <i class="fa-solid fa-shield-halved studio-locked-icon"></i>
                <h2 style="margin: 0; font-size: 1.25rem;">Admin Authorization Required</h2>
                <p style="margin: 0; max-width: 420px; color: var(--text-soft); line-height: 1.5;">
                    Portfolio Studio is protected. To manage public branding, app access lockouts, and appearance defaults, open the <strong>Terminal (CLI)</strong> and execute:
                </p>
                <code style="padding: 6px 14px; background: rgba(0,0,0,0.5); border: 1px solid var(--line); border-radius: 4px; color: var(--theme-primary); font-size: 0.95rem;">admin</code>
            </div>
        `;
    }

    function renderStudioBody() {
        return `
            <main class="studio-container">
                <div class="studio-header">
                    <div>
                        <strong style="font-size: 14px;">Portfolio Studio</strong>
                        <span style="color: var(--text-muted); margin-left: 8px;">Public Portfolio Control Center</span>
                    </div>
                    <div class="studio-badge">
                        <i class="fa-solid fa-lock"></i>
                        <span>Admin Session Active</span>
                    </div>
                </div>

                <div class="studio-tabs" role="tablist">
                    <button class="studio-tab-btn active" data-tab="profile" role="tab" aria-selected="true">
                        <i class="fa-solid fa-user"></i> Identity & Bio
                    </button>
                    <button class="studio-tab-btn" data-tab="lockouts" role="tab" aria-selected="false">
                        <i class="fa-solid fa-shield"></i> Public App Lockouts
                    </button>
                    <button class="studio-tab-btn" data-tab="appearance" role="tab" aria-selected="false">
                        <i class="fa-solid fa-palette"></i> Defaults & Theme
                    </button>
                    <button class="studio-tab-btn" data-tab="security" role="tab" aria-selected="false">
                        <i class="fa-solid fa-key"></i> Passphrase
                    </button>
                </div>

                <div class="studio-tab-panels">
                    <!-- Tab 1: Profile & Bio -->
                    <div class="studio-panel active" data-panel="profile">
                        <div class="studio-section">
                            <h3 class="studio-section-title"><i class="fa-solid fa-id-card"></i> Public Identity</h3>
                            <p class="studio-section-desc">Information presented to guests visiting the public portfolio session.</p>
                            <div class="studio-form-grid">
                                <div class="studio-form-group">
                                    <label class="studio-label">Display Name</label>
                                    <input type="text" class="studio-input" data-field="profile.displayName" placeholder="e.g. Alex Mammen">
                                </div>
                                <div class="studio-form-group">
                                    <label class="studio-label">Handle / Username</label>
                                    <input type="text" class="studio-input" data-field="profile.handle" placeholder="e.g. bl4ut0">
                                </div>
                                <div class="studio-form-group">
                                    <label class="studio-label">Role / Title</label>
                                    <input type="text" class="studio-input" data-field="profile.role" placeholder="e.g. Systems Builder">
                                </div>
                                <div class="studio-form-group">
                                    <label class="studio-label">Session Status</label>
                                    <input type="text" class="studio-input" data-field="profile.status" placeholder="e.g. Available for Projects">
                                </div>
                            </div>
                            <div class="studio-form-group" style="margin-top: 10px;">
                                <label class="studio-label">Bio Summary</label>
                                <textarea class="studio-textarea" data-field="profile.bio" placeholder="Brief summary displayed in dossier and profile views..."></textarea>
                            </div>
                        </div>

                        <div class="studio-section">
                            <h3 class="studio-section-title"><i class="fa-solid fa-terminal"></i> Boot Screen Welcome</h3>
                            <p class="studio-section-desc">Text rendered on the initial boot console for new visitors.</p>
                            <div class="studio-form-grid">
                                <div class="studio-form-group">
                                    <label class="studio-label">Eyebrow Heading</label>
                                    <input type="text" class="studio-input" data-field="boot.eyebrow" placeholder="Personal Network Console">
                                </div>
                                <div class="studio-form-group">
                                    <label class="studio-label">Title</label>
                                    <input type="text" class="studio-input" data-field="boot.title" placeholder="PortfoliOS">
                                </div>
                            </div>
                            <div class="studio-form-group" style="margin-top: 10px;">
                                <label class="studio-label">Summary Paragraph</label>
                                <textarea class="studio-textarea" data-field="boot.summary" placeholder="Development projects, infrastructure, community links..."></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 2: App Lockouts -->
                    <div class="studio-panel" data-panel="lockouts">
                        <div class="studio-section">
                            <h3 class="studio-section-title"><i class="fa-solid fa-lock"></i> Public App Visibility Matrix</h3>
                            <p class="studio-section-desc">Toggle off any applications you want to hide or lock out for guest visitors. Hidden apps will not appear on the public desktop, start menu, or store.</p>
                            <div class="studio-app-grid" id="studio-app-checklist">
                                <!-- Populated dynamically from desktopApps list -->
                            </div>
                        </div>
                    </div>

                    <!-- Tab 3: Appearance Defaults -->
                    <div class="studio-panel" data-panel="appearance">
                        <div class="studio-section">
                            <h3 class="studio-section-title"><i class="fa-solid fa-brush"></i> Default Environment Appearance</h3>
                            <p class="studio-section-desc">Set the default wallpaper and UI theme that guests experience upon first loading the site.</p>
                            <div class="studio-form-grid">
                                <div class="studio-form-group">
                                    <label class="studio-label">Default Theme</label>
                                    <select class="studio-select" data-field="appearance.defaultTheme">
                                        <option value="dark">Dark (Standard Glass)</option>
                                        <option value="light">Light</option>
                                        <option value="cyberpunk">Cyberpunk</option>
                                        <option value="matrix">Matrix Code</option>
                                        <option value="dracula">Dracula</option>
                                        <option value="nord">Nord</option>
                                    </select>
                                </div>
                                <div class="studio-form-group">
                                    <label class="studio-label">Default Wallpaper</label>
                                    <select class="studio-select" data-field="appearance.defaultWallpaper">
                                        <option value="aurora">Aurora</option>
                                        <option value="grid">Grid</option>
                                        <option value="ember">Ember</option>
                                        <option value="mono">Mono</option>
                                        <option value="cosmos">Cosmos</option>
                                        <option value="sunset">Sunset</option>
                                        <option value="matrix">Matrix</option>
                                        <option value="cyberpunk">Cyberpunk</option>
                                        <option value="retrowave">Retrowave</option>
                                    </select>
                                </div>
                                <div class="studio-form-group">
                                    <label class="studio-label">Default Screensaver</label>
                                    <select class="studio-select" data-field="appearance.defaultScreensaver">
                                        <option value="starfield">3D Starfield</option>
                                        <option value="mystify">Mystify Neon</option>
                                        <option value="pipes">3D Pipes</option>
                                        <option value="flying-windows">Flying Windows</option>
                                        <option value="dvd-bounce">DVD Bounce</option>
                                        <option value="blank">Blank Screen</option>
                                        <option value="none">None</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 4: Security -->
                    <div class="studio-panel" data-panel="security">
                        <div class="studio-section">
                            <h3 class="studio-section-title"><i class="fa-solid fa-key"></i> Administrator Passphrase</h3>
                            <p class="studio-section-desc">Change the master passphrase used for the CLI <code>admin</code> command authentication.</p>
                            <div class="studio-form-grid">
                                <div class="studio-form-group">
                                    <label class="studio-label">New Passphrase (min 8 chars)</label>
                                    <input type="password" class="studio-input" id="studio-new-pass" placeholder="Enter new passphrase...">
                                </div>
                                <div class="studio-form-group">
                                    <label class="studio-label">Confirm Passphrase</label>
                                    <input type="password" class="studio-input" id="studio-confirm-pass" placeholder="Retype new passphrase...">
                                </div>
                            </div>
                            <div style="margin-top: 10px;">
                                <button type="button" class="studio-btn studio-btn-secondary" id="studio-update-pass-btn">
                                    <i class="fa-solid fa-floppy-disk"></i> Update Admin Passphrase
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="studio-footer">
                    <span id="studio-status" style="color: var(--text-soft); font-size: 12px;">Configuration synchronized with server.</span>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" class="studio-btn studio-btn-secondary" id="studio-discard-btn">
                            <i class="fa-solid fa-rotate-left"></i> Reload
                        </button>
                        <button type="button" class="studio-btn studio-btn-primary" id="studio-save-btn">
                            <i class="fa-solid fa-cloud-arrow-up"></i> Publish to Server
                        </button>
                    </div>
                </div>
            </main>
        `;
    }

    async function mount(root) {
        if (!window.AdminSession?.isAuthenticated()) {
            root.innerHTML = renderLockedBody();
            return;
        }

        root.innerHTML = renderStudioBody();

        // Tabs switching
        const tabBtns = root.querySelectorAll(".studio-tab-btn");
        const panels = root.querySelectorAll(".studio-panel");
        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const target = btn.dataset.tab;
                tabBtns.forEach(b => {
                    const active = b === btn;
                    b.classList.toggle("active", active);
                    b.setAttribute("aria-selected", String(active));
                });
                panels.forEach(p => p.classList.toggle("active", p.dataset.panel === target));
            });
        });

        const statusEl = root.getElementById?.("studio-status") || root.querySelector("#studio-status");
        const setStatus = (msg, isErr = false) => {
            if (statusEl) {
                statusEl.textContent = msg;
                statusEl.style.color = isErr ? "var(--rose, #f43f5e)" : "var(--theme-primary, #22d3ee)";
            }
            if (window.showDesktopToast) window.showDesktopToast(msg);
        };

        // Load configuration from server
        let currentConfig = null;
        async function fetchConfig() {
            try {
                const res = await fetch("core/admin.php?action=get_config", { cache: "no-store" });
                const data = await res.json();
                if (data.success && data.config) {
                    currentConfig = data.config;
                } else {
                    currentConfig = {
                        profile: { displayName: "Guest Access", handle: "bl4ut0", role: "Guest", status: "Guest session", bio: "", links: [] },
                        boot: { eyebrow: "Personal Network Console", title: "PortfoliOS", summary: "" },
                        appearance: { defaultTheme: "dark", defaultWallpaper: "aurora", defaultScreensaver: "starfield" },
                        guestHiddenAppIds: ["portfolio-studio"]
                    };
                }
                populateUI(currentConfig);
            } catch (err) {
                setStatus("Failed to load server configuration: " + err.message, true);
            }
        }

        function populateUI(cfg) {
            // Fill text fields
            root.querySelectorAll("[data-field]").forEach(input => {
                const path = input.dataset.field.split(".");
                let val = cfg;
                for (const part of path) {
                    val = val ? val[part] : null;
                }
                if (val !== undefined && val !== null) {
                    input.value = val;
                }
            });

            // Populate app lockout matrix
            const appGrid = root.querySelector("#studio-app-checklist");
            if (appGrid) {
                appGrid.innerHTML = "";
                const hiddenSet = new Set(cfg.guestHiddenAppIds || ["portfolio-studio"]);
                const allApps = window.desktopApps || [];

                allApps.forEach(app => {
                    if (app.id === "portfolio-studio") return; // Always hidden from public
                    const isVisible = !hiddenSet.has(app.id);

                    const card = document.createElement("label");
                    card.className = "studio-app-card";
                    card.innerHTML = `
                        <div class="studio-app-info">
                            <i class="${app.icon || 'fa-solid fa-cube'} studio-app-icon"></i>
                            <span class="studio-app-name">${app.title || app.id}</span>
                        </div>
                        <span class="studio-switch">
                            <input type="checkbox" data-app-id="${app.id}" ${isVisible ? "checked" : ""}>
                            <span class="studio-switch-slider"></span>
                        </span>
                    `;
                    appGrid.appendChild(card);
                });
            }
        }

        // Save & Publish
        root.querySelector("#studio-save-btn")?.addEventListener("click", async () => {
            if (!window.AdminSession?.isAuthenticated()) {
                setStatus("Session expired. Please run 'admin' in CLI.", true);
                return;
            }

            setStatus("Publishing configuration to production server...");
            const hiddenIds = ["portfolio-studio"];
            root.querySelectorAll("#studio-app-checklist input[data-app-id]").forEach(cb => {
                if (!cb.checked) {
                    hiddenIds.push(cb.dataset.appId);
                }
            });

            const payload = {
                profile: {
                    displayName: root.querySelector("[data-field='profile.displayName']")?.value || "",
                    handle: root.querySelector("[data-field='profile.handle']")?.value || "",
                    role: root.querySelector("[data-field='profile.role']")?.value || "",
                    status: root.querySelector("[data-field='profile.status']")?.value || "",
                    bio: root.querySelector("[data-field='profile.bio']")?.value || "",
                    avatar: "identity-portrait.jpg",
                    accent: "#22d3ee",
                    links: currentConfig?.profile?.links || []
                },
                boot: {
                    eyebrow: root.querySelector("[data-field='boot.eyebrow']")?.value || "",
                    title: root.querySelector("[data-field='boot.title']")?.value || "",
                    summary: root.querySelector("[data-field='boot.summary']")?.value || ""
                },
                appearance: {
                    defaultTheme: root.querySelector("[data-field='appearance.defaultTheme']")?.value || "dark",
                    defaultWallpaper: root.querySelector("[data-field='appearance.defaultWallpaper']")?.value || "aurora",
                    defaultScreensaver: root.querySelector("[data-field='appearance.defaultScreensaver']")?.value || "starfield"
                },
                guestHiddenAppIds: hiddenIds
            };

            try {
                const res = await fetch("core/admin.php", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${window.AdminSession.token}`
                    },
                    body: JSON.stringify({
                        action: "save",
                        token: window.AdminSession.token,
                        config: payload
                    })
                });
                const data = await res.json();
                if (data.success) {
                    setStatus("Changes published live to server successfully.");
                    // Apply immediately in local memory as well
                    if (window.applyPortfolioConfigOverrides) {
                        window.applyPortfolioConfigOverrides(data.config);
                    }
                } else {
                    setStatus("Publish failed: " + (data.error || "Unknown server error"), true);
                }
            } catch (err) {
                setStatus("Error communicating with admin server: " + err.message, true);
            }
        });

        // Discard / Reload
        root.querySelector("#studio-discard-btn")?.addEventListener("click", () => {
            fetchConfig();
            setStatus("Reloaded server configuration.");
        });

        // Change Admin Passphrase
        root.querySelector("#studio-update-pass-btn")?.addEventListener("click", async () => {
            const p1 = root.querySelector("#studio-new-pass")?.value || "";
            const p2 = root.querySelector("#studio-confirm-pass")?.value || "";
            if (p1.length < 8) {
                setStatus("Passphrase must be at least 8 characters long.", true);
                return;
            }
            if (p1 !== p2) {
                setStatus("Passphrases do not match.", true);
                return;
            }

            try {
                const res = await fetch("core/admin.php", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${window.AdminSession.token}`
                    },
                    body: JSON.stringify({
                        action: "change_password",
                        token: window.AdminSession.token,
                        new_password: p1
                    })
                });
                const data = await res.json();
                if (data.success) {
                    setStatus("Admin passphrase updated successfully.");
                    root.querySelector("#studio-new-pass").value = "";
                    root.querySelector("#studio-confirm-pass").value = "";
                } else {
                    setStatus("Password update failed: " + (data.error || "Server rejected update"), true);
                }
            } catch (err) {
                setStatus("Error changing password: " + err.message, true);
            }
        });

        fetchConfig();
    }

    window.appRegistry["portfolio-studio"] = {
        title: "Portfolio Studio",
        icon: "fa-solid fa-sliders",
        windowClass: "portfolio-studio-window utility-window",
        renderBody: () => renderLockedBody(), // Default inert template is locked
        onOpen: mount
    };
})();
