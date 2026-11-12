/** Shared Desktop/Mobile account selection and Google/Cloud private-session entry. */
(function () {
    const symbols = {
        shield: '<path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6z"/>',
        lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        signal: '<path d="M4 20v-3m5 3v-7m5 7V9m5 11V4"/>',
        wifi: '<path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/>',
        battery: '<rect x="2" y="6" width="18" height="12" rx="2"/><path d="M23 10v4M6 10v4m4-4v4m4-4v4"/>'
    };
    const symbol = name => '<svg class="session-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + symbols[name] + '</svg>';
    
    const providerIcons = {
        google: '<svg class="session-provider-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>',
        microsoft: '<svg class="session-provider-svg" viewBox="0 0 23 23" width="20" height="20" aria-hidden="true"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>',
        dropbox: '<svg class="session-provider-svg" viewBox="0 0 24 24" width="20" height="20" fill="#0061FE" aria-hidden="true"><path d="M6 2L0 6l6 4-6 4 6 4 6-4-6-4 6-4L6 2zm12 0l-6 4 6 4-6 4 6 4 6-4-6-4 6-4-6-4zm-6 13.33L6 19.33l6 4 6-4-6-4z"/></svg>',
        nextcloud: '<svg class="session-provider-svg" viewBox="0 0 24 24" width="20" height="20" fill="#0082c9" aria-hidden="true"><circle cx="12" cy="12" r="4"/><circle cx="4.5" cy="12" r="2.5"/><circle cx="19.5" cy="12" r="2.5"/></svg>'
    };

    const providerMeta = {
        google: { name: 'Google', btnText: 'Continue with Google', trustStorage: 'Direct client connection · Personal Google Drive AppData' },
        microsoft: { name: 'Microsoft OneDrive', btnText: 'Continue with OneDrive', trustStorage: 'Direct client connection · Personal OneDrive AppFolder' },
        dropbox: { name: 'Dropbox', btnText: 'Continue with Dropbox', trustStorage: 'Direct client connection · Sandboxed Dropbox AppFolder' },
        nextcloud: { name: 'Nextcloud (Homelab)', btnText: 'Continue with Nextcloud', trustStorage: 'Direct client connection · Homelab WebDAV storage' }
    };

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

    window.openSessionChooser = (experienceOrOptions = document.body.dataset.view, maybeOptions = {}) => {
        const experience = typeof experienceOrOptions === "string" ? experienceOrOptions : (document.body.dataset.view || "desktop");
        const options = typeof experienceOrOptions === "object" && experienceOrOptions !== null ? experienceOrOptions : (maybeOptions || {});
        document.getElementById("power-options-menu")?.remove();
        const sm = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
        if (sm) sm.hidden = true;
        if (document.getElementById("session-chooser")) return;
        if (window.GDriveSync?.syncInProgress && window.state?.sessionChosen && !options.force) {
            window.showDesktopToast?.("Wait for the current Drive backup to finish before switching accounts.");
            return;
        }
        if (options.force && window.GDriveSync) {
            window.GDriveSync.syncInProgress = false;
        }
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
                
                <!-- STAGE 1: Account Selection List -->
                <div class="session-stage-view session-stage-accounts" data-session-stage="accounts">
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
                                <span><strong>${escape(profile.name || profile.email || "Private profile")}</strong><small>${escape(profile.email || "Local private workspace")}</small><small>${window.GDriveSync?.accountSessions?.[id]?.expiresAt > Date.now() || (window.state?.currentUserId === id && window.GDriveSync?.getToken()) ? "Private workspace · Continue" : profile.source === "google" || profile.source === "cloud" ? "Private workspace · Sign in" : "Local workspace · Continue"}</small></span>
                                <span class="session-action-symbol" aria-hidden="true">→</span>
                            </button>
                        `).join("")}
                        <button type="button" class="session-account session-account-google" data-session-google>
                            <span class="session-account-icon"><span class="session-google-mark" aria-hidden="true">${providerIcons.google}</span></span>
                            <span><strong>Other account</strong><small>Sign in with Cloud</small></span>
                            <span class="session-action-symbol" aria-hidden="true">+</span>
                        </button>
                    </div>
                    <p class="session-chooser-note">Your files and settings belong to your account. Sign in to connect cloud backup.</p>
                    <div data-session-public-actions hidden><p>Keep your private workspace on this device, or back up your latest changes before switching.</p><button type="button" class="session-public-action" data-session-public-save>Save to Drive &amp; switch to public</button><button type="button" class="session-public-action" data-session-public-local>Switch to public · Keep local changes</button></div>
                    <p class="session-chooser-error" data-session-error role="alert" hidden></p>
                    <button type="button" class="session-chooser-offline" data-session-offline hidden>Continue this remembered profile offline</button>
                </div>

                <!-- STAGE 2: In-Place Cloud Auth Card -->
                <div class="session-auth-modal-backdrop session-stage-view session-stage-auth" data-session-stage="auth" hidden>
                    <div class="session-auth-card" role="dialog" aria-modal="true" aria-labelledby="session-auth-window-title">
                        <div class="session-auth-window-header">
                            <span class="session-auth-window-title" id="session-auth-window-title">
                                <span class="portfolios-mark" aria-hidden="true"><span class="prompt-chevron">&gt;</span><span class="prompt-cursor">_</span></span>
                                <span>PortfoliOS · Workspace Sign In</span>
                            </span>
                            <button type="button" class="session-auth-window-close" data-auth-close aria-label="Close authentication window">✕</button>
                        </div>
                        <div class="session-auth-brand">
                            <span class="portfolios-mark" aria-hidden="true"><span class="prompt-chevron">&gt;</span><span class="prompt-cursor">_</span></span>
                            <span class="session-auth-brand-text">PortfoliOS Workspace</span>
                        </div>

                        <div class="session-auth-target">
                            <div class="session-auth-target-avatar" data-auth-avatar-wrap hidden>
                                <img data-auth-avatar alt="">
                            </div>
                            <div class="session-auth-icon-wrap" data-auth-icon-wrap>
                                <svg class="session-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                            </div>
                            <h2 class="session-auth-title" data-auth-title>Private Workspace</h2>
                            <p class="session-auth-account" data-auth-account hidden></p>
                            <p class="session-auth-desc" data-auth-desc>Sign in with your cloud account to open your encrypted private profile and synchronize your files and preferences.</p>
                        </div>

                        <!-- Provider Selector Tabs -->
                        <div class="session-provider-selector" role="radiogroup" aria-label="Sign in Provider">
                            <button type="button" class="session-provider-tab is-active" data-auth-provider="google" role="radio" aria-checked="true">
                                ${providerIcons.google}
                                <span>Google</span>
                            </button>
                            <button type="button" class="session-provider-tab" data-auth-provider="microsoft" role="radio" aria-checked="false">
                                ${providerIcons.microsoft}
                                <span>OneDrive</span>
                            </button>
                            <button type="button" class="session-provider-tab" data-auth-provider="dropbox" role="radio" aria-checked="false">
                                ${providerIcons.dropbox}
                                <span>Dropbox</span>
                            </button>
                            <button type="button" class="session-provider-tab" data-auth-provider="nextcloud" role="radio" aria-checked="false">
                                ${providerIcons.nextcloud}
                                <span>Nextcloud</span>
                            </button>
                        </div>

                        <!-- Optional Nextcloud Server URL input -->
                        <div class="session-auth-server-group" data-auth-server-group hidden>
                            <label for="session-server-url" class="session-auth-server-label">Nextcloud Server URL</label>
                            <input type="url" id="session-server-url" class="session-auth-server-input" data-auth-server-url placeholder="https://cloud.example.com" spellcheck="false" autocomplete="url">
                        </div>

                        <!-- Optional Custom Client ID input for Microsoft / Dropbox -->
                        <div class="session-auth-server-group" data-auth-clientid-group hidden>
                            <label for="session-client-id" class="session-auth-server-label" data-auth-clientid-label>Application (client) ID</label>
                            <input type="text" id="session-client-id" class="session-auth-server-input" data-auth-client-id placeholder="Enter OAuth Client ID" spellcheck="false" autocomplete="off">
                            <span class="session-auth-hint" data-auth-clientid-hint style="display:block; margin-top:5px; font-size:11px; color:var(--text-soft); line-height:1.4;"></span>
                        </div>

                        <!-- Primary Continue Button -->
                        <button type="button" class="session-auth-continue-btn" data-auth-continue>
                            <span class="session-auth-continue-icon" data-auth-continue-icon>${providerIcons.google}</span>
                            <span data-auth-continue-text>Continue with Google</span>
                        </button>

                        <p class="session-chooser-error" data-auth-error role="alert" hidden></p>
                        <p class="session-auth-status" data-auth-status role="status" hidden></p>

                        <!-- Trust / Security Chips -->
                        <div class="session-auth-trust-chips">
                            <div class="session-auth-trust-chip">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                <span>Memory-only session · Tokens never persist to disk</span>
                            </div>
                            <div class="session-auth-trust-chip">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="17 8 12 3 7 8"/>
                                    <line x1="12" y1="3" x2="12" y2="15"/>
                                </svg>
                                <span data-auth-trust-storage>Direct client connection · Personal Google Drive AppData</span>
                            </div>
                        </div>

                        <!-- Bottom Navigation Actions -->
                        <div class="session-auth-actions">
                            <button type="button" class="session-auth-back-btn" data-auth-back>
                                <span aria-hidden="true">←</span> Back to accounts
                            </button>
                            <button type="button" class="session-auth-offline-btn" data-auth-offline hidden>
                                Continue profile offline
                            </button>
                        </div>
                    </div>
                </div>
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
        overlay.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                const stageAuth = overlay.querySelector('[data-session-stage="auth"]');
                if (stageAuth && !stageAuth.hidden) {
                    showAccountsStage();
                    event.stopPropagation();
                }
            }
        });

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
        let selectedProfileId = null;
        let activeProvider = 'google';
        let choosing = false;

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

        const updateProviderUI = (providerId) => {
            activeProvider = providerId;
            const meta = providerMeta[providerId] || providerMeta.google;
            overlay.querySelectorAll('[data-auth-provider]').forEach(btn => {
                const isActive = btn.dataset.authProvider === providerId;
                btn.classList.toggle('is-active', isActive);
                btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
            });
            const continueIcon = overlay.querySelector('[data-auth-continue-icon]');
            const continueText = overlay.querySelector('[data-auth-continue-text]');
            const trustStorage = overlay.querySelector('[data-auth-trust-storage]');
            const serverGroup = overlay.querySelector('[data-auth-server-group]');

            if (continueIcon) continueIcon.innerHTML = providerIcons[providerId] || providerIcons.google;
            if (continueText) continueText.textContent = meta.btnText;
            if (trustStorage) trustStorage.textContent = meta.trustStorage;
            if (serverGroup) serverGroup.hidden = providerId !== 'nextcloud';

            const clientidGroup = overlay.querySelector('[data-auth-clientid-group]');
            const clientidLabel = overlay.querySelector('[data-auth-clientid-label]');
            const clientidInput = overlay.querySelector('[data-auth-client-id]');
            const clientidHint = overlay.querySelector('[data-auth-clientid-hint]');

            if (clientidGroup) {
                if (providerId === 'microsoft') {
                    clientidGroup.hidden = false;
                    if (clientidLabel) clientidLabel.textContent = 'Microsoft Application (client) ID';
                    if (clientidInput) {
                        clientidInput.placeholder = 'e.g. 00000000-0000-0000-0000-000000000000';
                        clientidInput.value = localStorage.getItem('portfolios_cloud_client_id_microsoft') || '';
                    }
                    if (clientidHint) {
                        clientidHint.innerHTML = 'From <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener" style="color:var(--theme-primary); text-decoration:underline;">Azure App Registrations</a> (Redirect URI: <code>https://os.bl4ut0.dev/auth/callback.php</code>)';
                    }
                } else if (providerId === 'dropbox') {
                    clientidGroup.hidden = false;
                    if (clientidLabel) clientidLabel.textContent = 'Dropbox App Key (Client ID)';
                    if (clientidInput) {
                        clientidInput.placeholder = 'e.g. m8v...';
                        clientidInput.value = localStorage.getItem('portfolios_cloud_client_id_dropbox') || '';
                    }
                    if (clientidHint) {
                        clientidHint.innerHTML = 'From <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener" style="color:var(--theme-primary); text-decoration:underline;">Dropbox App Console</a> (Redirect URI: <code>https://os.bl4ut0.dev/auth/callback.php</code>)';
                    }
                } else {
                    clientidGroup.hidden = true;
                }
            }
        };

        const showAuthStage = (profileId) => {
            selectedProfileId = profileId;
            offlineProfileId = profileId;
            const stageAccounts = overlay.querySelector('[data-session-stage="accounts"]');
            const stageAuth = overlay.querySelector('[data-session-stage="auth"]');
            const avatarWrap = overlay.querySelector('[data-auth-avatar-wrap]');
            const iconWrap = overlay.querySelector('[data-auth-icon-wrap]');
            const titleEl = overlay.querySelector('[data-auth-title]');
            const accountEl = overlay.querySelector('[data-auth-account]');
            const descEl = overlay.querySelector('[data-auth-desc]');
            const offlineBtn = overlay.querySelector('[data-auth-offline]');
            const errorEl = overlay.querySelector('[data-auth-error]');

            if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }

            const providerSelector = overlay.querySelector('.session-provider-selector');
            if (profileId && profiles[profileId]) {
                const prof = profiles[profileId];
                if (avatarWrap) {
                    avatarWrap.hidden = false;
                    const img = avatarWrap.querySelector('img');
                    if (img) window.setProfileAvatar(img, prof.avatar, '');
                }
                if (iconWrap) iconWrap.hidden = true;
                if (titleEl) titleEl.textContent = prof.name || prof.email || "Private Profile";
                if (accountEl) {
                    accountEl.hidden = !prof.email;
                    accountEl.textContent = prof.email || "";
                }
                if (offlineBtn) offlineBtn.hidden = prof.source === 'google' && !prof.offlineAvailable;

                const usedProvider = prof.cloudProvider || (prof.source === 'google' ? 'google' : (prof.source === 'cloud' ? 'google' : null));
                if (usedProvider) {
                    // Hide other provider methods when account has a linked provider
                    if (providerSelector) providerSelector.hidden = true;
                    updateProviderUI(usedProvider);
                    const providerName = providerMeta[usedProvider]?.name || usedProvider;
                    if (descEl) descEl.textContent = `Sign in with ${providerName} to unlock your private workspace and synchronize your files.`;
                    if (prof.serverUrl) {
                        const serverUrlInput = overlay.querySelector('[data-auth-server-url]');
                        if (serverUrlInput) serverUrlInput.value = prof.serverUrl;
                    }
                } else {
                    if (providerSelector) providerSelector.hidden = false;
                    updateProviderUI('google');
                    if (descEl) descEl.textContent = "Choose a cloud provider to link to your private workspace and synchronize your files.";
                }
            } else {
                if (avatarWrap) avatarWrap.hidden = true;
                if (iconWrap) iconWrap.hidden = false;
                if (titleEl) titleEl.textContent = "Private Workspace";
                if (accountEl) { accountEl.hidden = true; accountEl.textContent = ''; }
                if (descEl) descEl.textContent = "Sign in with your cloud account to open your private workspace and sync files across devices.";
                if (offlineBtn) offlineBtn.hidden = true;
                if (providerSelector) providerSelector.hidden = false;
                updateProviderUI('google');
            }

            stageAccounts.hidden = false;
            stageAccounts.setAttribute('aria-hidden', 'true');
            stageAuth.hidden = false;
            overlay.querySelector('[data-auth-continue]')?.focus();
        };

        const showAccountsStage = () => {
            selectedProfileId = null;
            const stageAccounts = overlay.querySelector('[data-session-stage="accounts"]');
            const stageAuth = overlay.querySelector('[data-session-stage="auth"]');
            stageAuth.hidden = true;
            stageAccounts.hidden = false;
            stageAccounts.removeAttribute('aria-hidden');
            overlay.querySelector('.session-account')?.focus();
        };

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
            if (event.target.classList.contains("session-auth-modal-backdrop")) {
                showAccountsStage();
                return;
            }
            const button = event.target.closest("button");
            if (!button || button.disabled || choosing) return;

            // Theme picker handling
            if (button.hasAttribute("data-session-theme")) {
                toggleThemePicker();
                return;
            }
            if (button.hasAttribute("data-theme-close") || (event.target.closest(".session-theme-picker-modal") && !event.target.closest(".session-theme-picker-content"))) {
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

            // Global navigation
            if (button.hasAttribute("data-session-cancel")) { window.closeSessionChooser(); return; }
            if (button.hasAttribute("data-session-experience")) {
                document.getElementById("boot-screen")?.classList.remove("hidden");
                document.body.dataset.startupStage = "boot";
                window.closeSessionChooser();
                return;
            }

            // In-Place Stage Navigation
            if (button.hasAttribute("data-auth-back") || button.hasAttribute("data-auth-close")) {
                showAccountsStage();
                return;
            }
            if (button.hasAttribute("data-auth-provider")) {
                updateProviderUI(button.dataset.authProvider);
                return;
            }

            const id = button.dataset.sessionProfile;
            const error = overlay.querySelector("[data-session-error]");
            const authError = overlay.querySelector("[data-auth-error]");
            const offline = overlay.querySelector("[data-session-offline]");
            const authOffline = overlay.querySelector("[data-auth-offline]");

            // Clicked profile or other account -> In-place transition!
            if (id || button.hasAttribute("data-session-google")) {
                if (id) {
                    const prof = profiles[id];
                    const hasLiveSession = window.GDriveSync?.accountSessions?.[id]?.expiresAt > Date.now() || (window.state?.currentUserId === id && window.GDriveSync?.getToken());
                    if (hasLiveSession || (prof.source !== "google" && !prof.cloudProvider)) {
                        // Already signed in or local workspace: enter directly
                        choosing = true;
                        try {
                            await window.prepareSessionStorage?.();
                            await window.prepareProfileSwitch();
                            window.setCurrentUser(id, { preserveGoogleSession: true });
                            await window.SystemFS?.ensureDefaultFiles?.();
                            await complete();
                            return;
                        } catch (err) {
                            if (error) { error.textContent = err?.message || "Failed to enter workspace."; error.hidden = false; }
                        } finally {
                            choosing = false;
                        }
                        return;
                    }
                    // Requires authentication: transition in-place to Cloud Auth card!
                    showAuthStage(id);
                    return;
                }
                if (button.hasAttribute("data-session-google")) {
                    showAuthStage(null);
                    return;
                }
            }

            // Execute Authentication from In-Place Auth View
            if (button.hasAttribute("data-auth-continue")) {
                const buttons = Array.from(overlay.querySelectorAll("button"));
                const disabled = buttons.map(node => node.disabled);
                choosing = true;
                if (authError) authError.hidden = true;
                buttons.forEach(node => { node.disabled = true; });
                button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Connecting…</span>';
                overlay.setAttribute("aria-busy", "true");

                try {
                    await window.prepareSessionStorage?.();

                    if (activeProvider === 'google') {
                        await window.GDriveSync.loadGsiLibrary();
                        const clientId = window.GDriveSync.defaultClientId;
                        await window.GDriveSync.login(clientId, {
                            selectAccount: !selectedProfileId,
                            expectedSub: selectedProfileId ? profiles[selectedProfileId].sub : null,
                            auto: true
                        });
                        await complete();
                    } else if (window.CloudAuth) {
                        const serverUrl = overlay.querySelector('[data-auth-server-url]')?.value?.trim() || '';
                        const customClientId = overlay.querySelector('[data-auth-client-id]')?.value?.trim() || '';
                        if (customClientId && (activeProvider === 'microsoft' || activeProvider === 'dropbox')) {
                            localStorage.setItem('portfolios_cloud_client_id_' + activeProvider, customClientId);
                        }
                        const result = await window.CloudAuth.loginWithDriver(activeProvider, {
                            clientId: customClientId,
                            serverUrl,
                            timeoutMs: 120_000
                        });
                        if (window.activateCloudPrivateProfile) {
                            await window.activateCloudPrivateProfile(result);
                        } else if (window.activateGooglePrivateProfile && result.profile) {
                            await window.activateGooglePrivateProfile(result.profile);
                        }
                        await complete();
                    } else {
                        throw new Error('Cloud authentication registry is not available.');
                    }
                } catch (reason) {
                    if (authError) {
                        authError.textContent = reason?.message || "Cloud sign-in could not be completed. Please try again.";
                        authError.hidden = false;
                    }
                    if (authOffline) {
                        authOffline.hidden = !selectedProfileId || profiles[selectedProfileId]?.source === 'google';
                    }
                } finally {
                    choosing = false;
                    buttons.forEach((node, index) => { node.disabled = disabled[index]; });
                    overlay.removeAttribute("aria-busy");
                    updateProviderUI(activeProvider);
                }
                return;
            }

            // Public profile / Offline entry / Public actions
            const buttons = Array.from(overlay.querySelectorAll("button"));
            const disabled = buttons.map(node => node.disabled);
            choosing = true;
            if (error) error.hidden = true;
            if (offline) offline.hidden = true;
            buttons.forEach(node => { node.disabled = true; });
            overlay.setAttribute("aria-busy", "true");

            try {
                await window.prepareSessionStorage?.();
                if (button.hasAttribute("data-session-public")) {
                    if (window.isPrivateUser?.(window.state.currentUserId)) {
                        if (error) { error.hidden = false; error.textContent = 'Saving your private workspace…'; }
                        await window.switchToPublicProfile({ saveToDrive: !!window.GDriveSync?.getToken(), onProgress: message => { if (error) error.textContent = message; } });
                    } else {
                        window.resetPublicLocalState?.();
                        await window.SystemFS?.resetPublicWorkspace?.();
                        await window.SystemFS?.ensureDefaultFiles?.();
                    }
                    await complete();
                } else if (button.hasAttribute("data-session-public-save") || button.hasAttribute("data-session-public-local")) {
                    if (error) { error.hidden = false; error.textContent = "Saving local changes…"; }
                    await window.switchToPublicProfile({
                        saveToDrive: button.hasAttribute("data-session-public-save"),
                        onProgress: message => { if (error) error.textContent = message; }
                    });
                    await complete();
                } else if (button.hasAttribute("data-session-offline") || button.hasAttribute("data-auth-offline")) {
                    const profId = offlineProfileId || selectedProfileId;
                    if (profId) {
                        await window.prepareProfileSwitch();
                        window.setCurrentUser(profId);
                        await window.SystemFS?.ensureDefaultFiles?.();
                        await complete();
                    }
                }
            } catch (reason) {
                const targetError = overlay.querySelector('[data-session-stage="auth"]').hidden ? error : authError;
                if (targetError) {
                    targetError.textContent = reason?.message || "Your workspace could not be opened. Please try again.";
                    targetError.hidden = false;
                }
                if (offline) offline.hidden = !offlineProfileId || profiles[offlineProfileId]?.source === 'google';
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
