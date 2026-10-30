/** Shared Desktop/Mobile account selection and Google private-session entry. */
(function () {
    const symbols = {
        shield: '<path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6z"/>',
        lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        signal: '<path d="M4 20v-3m5 3v-7m5 7V9m5 11V4"/>',
        wifi: '<path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/>',
        battery: '<rect x="2" y="6" width="18" height="12" rx="2"/><path d="M23 10v4M6 10v4m4-4v4m4-4v4"/>'
    };
    const symbol = name => '<svg class="session-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + symbols[name] + '</svg>';
    let clockTimer = null;
    let previousFocus = null;
    let inerted = [];
    const escape = value => window.escapeHtml ? window.escapeHtml(value) : String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

    window.closeSessionChooser = () => {
        window.clearInterval(clockTimer);
        clockTimer = null;
        document.getElementById("power-options-menu")?.remove();
        const sm = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
        if (sm) sm.hidden = true;
        document.getElementById("session-chooser")?.remove();
        document.body.classList.remove("session-locked");
        inerted.forEach(([node, value]) => { node.inert = value; });
        inerted = [];
        previousFocus?.focus?.();
    };

    window.openSessionChooser = (experience = document.body.dataset.view) => {
        document.getElementById("power-options-menu")?.remove();
        const sm = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
        if (sm) sm.hidden = true;
        if (document.getElementById("session-chooser")) return;
        if (window.GDriveSync?.syncInProgress) { window.showDesktopToast?.("Wait for the current Drive backup to finish before switching accounts."); return; }
        window.GDriveSync?.closeReconnectPrompt();
        previousFocus = document.activeElement;
        const profiles = window.getPrivateProfiles?.() || {};
        const legacy = window.getSavedPrivateProfile?.("private");
        if (!Object.keys(profiles).length && legacy) profiles.private = legacy;
        const overlay = document.createElement("section");
        overlay.id = "session-chooser";
        overlay.className = "session-chooser";
        overlay.dataset.experience = experience === "mobile" ? "mobile" : "desktop";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "session-chooser-title");
        overlay.innerHTML = `
            <header class="session-lock-header"><span><span class="portfolios-mark" aria-hidden="true"><span class="prompt-chevron">&gt;</span><span class="prompt-cursor">_</span></span> PortfoliOS</span><span style="display:inline-flex;align-items:center;gap:12px;"><button type="button" class="session-theme-toggle" data-session-theme title="Choose theme"><i class="fa-solid fa-palette" aria-hidden="true"></i> <span>Theme</span></button><span>${overlay.dataset.experience === "mobile" ? "Mobile" : "Desktop"}</span></span></header>
            <div class="session-chooser-panel">
                <div class="session-lock-clock" aria-hidden="true"><span data-session-time></span><span data-session-date></span></div>
                <span class="session-chooser-eyebrow">Welcome back</span>
                <h1 id="session-chooser-title">Who’s using this device?</h1>
                <p>Select an account to enter your workspace.</p>
                <div class="session-chooser-accounts">
                    <button type="button" class="session-account" data-session-public>
                        <span class="session-account-icon"><img data-session-avatar="public" alt=""></span>
                        <span><strong>PortfoliOS public profile</strong><small>Bl4ut0’s portfolio · Fresh workspace</small></span>
                        <span class="session-action-symbol" aria-hidden="true">→</span>
                    </button>
                    ${Object.entries(profiles).filter(([id]) => window.isPrivateUser?.(id)).map(([id, profile]) => `
                        <button type="button" class="session-account" data-session-profile="${escape(id)}">
                            <span class="session-account-icon"><img data-session-avatar="${escape(id)}" alt=""></span>
                            <span><strong>${escape(profile.name || profile.email || "Private profile")}</strong><small>${escape(profile.email || "Local private workspace")}</small><small>${window.GDriveSync?.accountSessions?.[id]?.expiresAt > Date.now() || (window.state?.currentUserId === id && window.GDriveSync?.getToken()) ? "Private workspace · Continue" : profile.source === "google" ? "Private workspace · Sign in" : "Local workspace · Continue"}</small></span>
                            <span class="session-action-symbol" aria-hidden="true">→</span>
                        </button>
                    `).join("")}
                    <button type="button" class="session-account session-account-google" data-session-google>
                        <span class="session-account-icon"><span class="session-google-mark" aria-hidden="true">G</span></span>
                        <span><strong>Other account</strong><small>Sign in with Google</small></span>
                        <span class="session-action-symbol" aria-hidden="true">+</span>
                    </button>
                </div>
                <p class="session-chooser-note">Your files and settings belong to your account. Sign in with Google to connect Drive backup.</p>
                <div data-session-public-actions hidden><p>Keep your private workspace on this device, or back up your latest changes before switching.</p><button type="button" class="session-public-action" data-session-public-save>Save to Drive &amp; switch to public</button><button type="button" class="session-public-action" data-session-public-local>Switch to public · Keep local changes</button></div>
                <p class="session-chooser-error" data-session-error role="alert" hidden></p>
                <button type="button" class="session-chooser-offline" data-session-offline hidden>Continue this remembered profile offline</button>
            </div>
            <footer class="session-lock-footer"><button type="button" data-session-cancel ${window.state?.sessionChosen ? "" : "hidden"}>Return to workspace</button><button type="button" data-session-experience><span class="session-action-symbol" aria-hidden="true">←</span> Change experience</button><button type="button" data-session-theme><i class="fa-solid fa-palette" aria-hidden="true"></i> Theme</button><span>${symbol("lock")} Your personal workspace</span></footer>
        `;
        const mobile = overlay.dataset.experience === 'mobile';
        const host = mobile ? document.getElementById('mobile-device') : document.body;
        // Inert only sibling branches: never inert the phone containing sign-in.
        inerted = [];
        let branch = host;
        const capture = node => { if (node instanceof HTMLElement) inerted.push([node, node.inert]); };
        Array.from(host.children).forEach(capture);
        while (branch !== document.body) {
            Array.from(branch.parentElement.children).filter(node => node !== branch).forEach(capture);
            branch = branch.parentElement;
        }
        inerted.forEach(([node]) => { node.inert = true; });
        document.body.classList.add('session-locked');
        if (mobile) {
            overlay.querySelector('.session-lock-header').innerHTML = '<span data-session-status-time></span><span aria-label="Device status">' + symbol("signal") + symbol("wifi") + symbol("battery") + '</span>';
            overlay.querySelector('#session-chooser-title').textContent = 'Choose a user';
            overlay.querySelector('.session-lock-footer > span').innerHTML = '<span class="session-mobile-gesture" aria-hidden="true"></span>';
        }
        host.appendChild(overlay);
        overlay.querySelectorAll('[data-session-avatar]').forEach(image => {
            const id = image.dataset.sessionAvatar;
            window.setProfileAvatar(image, id === 'public' ? 'identity-portrait.jpg' : profiles[id]?.avatar, '');
        });
        const updateClock = () => {
            const now = new Date();
            overlay.querySelector('[data-session-time]').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const statusTime = overlay.querySelector('[data-session-status-time]');
            if (statusTime) statusTime.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            overlay.querySelector('[data-session-date]').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
        };
        updateClock();
        clockTimer = window.setInterval(updateClock, 30000);
        let offlineProfileId = null;
        const complete = async () => {
            window.GDriveSync?.closeReconnectPrompt?.();
            if (window.GDriveSync) window.GDriveSync.pendingReconnectReason = null;
            try {
                await window.startSelectedWorkspace?.();
            } catch (error) {
                window.state.sessionChosen = false;
                throw error;
            }
            window.closeSessionChooser();
            window.GDriveSync?.closeReconnectPrompt?.();
            if (window.GDriveSync) window.GDriveSync.pendingReconnectReason = null;

            if (window.PrivateSessions?.required()) {
                try {
                    await window.PrivateSessions.enter();
                    window.state.sessionChosen = true;
                    if (window.GDriveSync) window.GDriveSync.pendingReconnectReason = null;
                    window.GDriveSync?.closeReconnectPrompt?.();
                } catch (error) {
                    window.state.sessionChosen = false;
                    window.openSessionChooser();
                    const errEl = document.querySelector("[data-session-error]");
                    if (errEl) {
                        errEl.hidden = false;
                        errEl.textContent = error?.message || "Your workspace could not be opened. Please try again.";
                    }
                    throw error;
                }
            } else {
                window.state.sessionChosen = true;
                if (window.GDriveSync) window.GDriveSync.pendingReconnectReason = null;
                window.GDriveSync?.closeReconnectPrompt?.();
            }
        };
        let choosing = false;
        const toggleThemePicker = () => {
            const existing = overlay.querySelector("#session-theme-picker-modal");
            if (existing) { existing.remove(); return; }
            const themes = window.portfolioThemes || (window.getPortfolioThemeOptions ? window.getPortfolioThemeOptions() : []);
            const currentThemeId = document.documentElement.dataset.theme || window.state?.themeId || "dark";
            const modal = document.createElement("div");
            modal.id = "session-theme-picker-modal";
            modal.className = "session-theme-picker-modal";
            modal.innerHTML = `
                <div class="session-theme-picker-content">
                    <div class="session-theme-picker-header">
                        <strong><i class="fa-solid fa-palette"></i> Choose System Theme</strong>
                        <button type="button" class="session-theme-close" data-theme-close aria-label="Close">&times;</button>
                    </div>
                    <div class="session-theme-picker-grid">
                        ${themes.map(t => `
                            <button type="button" class="session-theme-card ${t.id === currentThemeId ? "is-active" : ""}" data-theme-select="${t.id}">
                                <div class="session-theme-card-preview" style="background:${t.tokens?.["--bg"] || "#050608"}; border-color:${t.tokens?.["--line-strong"] || "#333"};">
                                    <div class="session-theme-swatches">
                                        <span style="background:${t.tokens?.["--theme-primary"] || "#22d3ee"};"></span>
                                        <span style="background:${t.tokens?.["--theme-accent"] || "#34d399"};"></span>
                                    </div>
                                </div>
                                <div class="session-theme-card-info">
                                    <span class="session-theme-card-name">${t.label || t.id}</span>
                                    <small>${t.colorScheme === "light" ? "Light" : "Dark"}</small>
                                </div>
                            </button>
                        `).join("")}
                    </div>
                </div>
            `;
            overlay.appendChild(modal);
        };

        overlay.addEventListener("click", async event => {
            const button = event.target.closest("button");
            if (!button || button.disabled || choosing) return;
            if (button.hasAttribute("data-session-theme")) {
                toggleThemePicker();
                return;
            }
            if (button.hasAttribute("data-theme-close") || event.target.closest(".session-theme-picker-modal") && !event.target.closest(".session-theme-picker-content")) {
                overlay.querySelector("#session-theme-picker-modal")?.remove();
                return;
            }
            const themeBtn = event.target.closest("[data-theme-select]");
            if (themeBtn) {
                const newThemeId = themeBtn.dataset.themeSelect;
                if (window.setPortfolioTheme) window.setPortfolioTheme(newThemeId);
                overlay.querySelector("#session-theme-picker-modal")?.remove();
                return;
            }
            if (button.hasAttribute("data-session-cancel")) { window.closeSessionChooser(); return; }
            if (button.hasAttribute("data-session-experience")) {
                document.getElementById("boot-screen")?.classList.remove("hidden");
                document.body.dataset.startupStage = "boot";
                window.closeSessionChooser();
                return;
            }
            const id = button.dataset.sessionProfile;
            const error = overlay.querySelector("[data-session-error]");
            const offline = overlay.querySelector("[data-session-offline]");
            const buttons = Array.from(overlay.querySelectorAll("button"));
            const disabled = buttons.map(node => node.disabled);
            choosing = true; error.hidden = true; offline.hidden = true;
            buttons.forEach(node => { node.disabled = true; });
            overlay.setAttribute("aria-busy", "true");
            try {
                await window.prepareSessionStorage?.();
                if (button.hasAttribute("data-session-public")) {
                    if (window.isPrivateUser?.(window.state.currentUserId)) {
                        error.hidden = false; error.textContent = 'Saving your private workspace…';
                        await window.switchToPublicProfile({ saveToDrive: !!window.GDriveSync?.getToken(), onProgress: message => { error.textContent = message; } });
                    } else {
                        window.resetPublicLocalState?.();
                        await window.SystemFS?.resetPublicWorkspace?.();
                        await window.SystemFS?.ensureDefaultFiles?.();
                    }
                    await complete();
                } else if (button.hasAttribute("data-session-public-save") || button.hasAttribute("data-session-public-local")) {
                    error.hidden = false; error.textContent = "Saving local changes…";
                    await window.switchToPublicProfile({
                        saveToDrive: button.hasAttribute("data-session-public-save"),
                        onProgress: message => { error.textContent = message; }
                    });
                    await complete();
                } else if (button.hasAttribute("data-session-offline")) {
                    await window.prepareProfileSwitch();
                    window.setCurrentUser(offlineProfileId);
                    await window.SystemFS?.ensureDefaultFiles?.();
                    await complete();
                } else if (id || button.hasAttribute("data-session-google")) {
                    if (id) {
                        await window.prepareProfileSwitch();
                        window.setCurrentUser(id, { preserveGoogleSession: true });
                        if (profiles[id].source !== "google" || window.GDriveSync.getToken()) {
                            await window.SystemFS?.ensureDefaultFiles?.();
                            await complete();
                            return;
                        }
                    }
                    await window.GDriveSync.loadGsiLibrary();
                    const clientId = window.GDriveSync.defaultClientId;
                    await window.GDriveSync.login(clientId, { selectAccount: !id, expectedSub: id ? profiles[id].sub : null });
                    await complete();
                    // Eligible backup starts after the workspace becomes usable.
                }
            } catch (reason) {
                error.textContent = reason?.message || "Your workspace could not be opened. Please try again.";
                error.hidden = false;
                offlineProfileId = id || null;
                offline.hidden = !id || profiles[id]?.source === 'google';
            } finally {
                choosing = false;
                buttons.forEach((node, index) => { node.disabled = disabled[index]; });
                overlay.removeAttribute("aria-busy");
            }
        });
        overlay.addEventListener("keydown", event => {
            if (event.key !== "Tab") return;
            const buttons = Array.from(overlay.querySelectorAll("button:not([hidden]):not(:disabled)"));
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        });
        overlay.querySelector("button")?.focus();
        // Google code loads only when the user chooses Google sign-in.
    };

    window.EventBus?.on("view:changed", view => {
        if (!["desktop", "mobile"].includes(view)) return;
        if (window.state?.systemStarted && !window.state.sessionChosen) {
            const existing = document.getElementById('session-chooser');
            if (existing && existing.dataset.experience !== view) window.closeSessionChooser();
            window.openSessionChooser(view);
        }
    });
})();
