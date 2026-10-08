/** Shared Desktop/Mobile account selection and Google private-session entry. */
(function () {
    let clockTimer = null;
    let previousFocus = null;
    let inerted = [];
    const escape = value => window.escapeHtml ? window.escapeHtml(value) : String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

    window.closeSessionChooser = () => {
        window.clearInterval(clockTimer);
        clockTimer = null;
        document.getElementById("session-chooser")?.remove();
        document.body.classList.remove("session-locked");
        inerted.forEach(([node, value]) => { node.inert = value; });
        inerted = [];
        previousFocus?.focus?.();
    };

    window.openSessionChooser = () => {
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
        overlay.dataset.experience = document.body.dataset.view === "mobile" ? "mobile" : "desktop";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "session-chooser-title");
        overlay.innerHTML = `
            <header class="session-lock-header"><span><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> PortfoliOS</span><span>${overlay.dataset.experience === "mobile" ? "Mobile" : "Desktop"}</span></header>
            <div class="session-chooser-panel">
                <div class="session-lock-clock" aria-hidden="true"><span data-session-time></span><span data-session-date></span></div>
                <span class="session-chooser-eyebrow">Welcome back</span>
                <h1 id="session-chooser-title">Who’s using this device?</h1>
                <p>Select an account to enter your workspace.</p>
                <div class="session-chooser-accounts">
                    <button type="button" class="session-account" data-session-public>
                        <span class="session-account-icon"><img data-session-avatar="public" alt=""></span>
                        <span><strong>Bl4ut0 public profile</strong><small>Public workspace · Enter</small></span>
                        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                    </button>
                    ${Object.entries(profiles).filter(([id]) => window.isPrivateUser?.(id)).map(([id, profile]) => `
                        <button type="button" class="session-account" data-session-profile="${escape(id)}">
                            <span class="session-account-icon"><img data-session-avatar="${escape(id)}" alt=""></span>
                            <span><strong>${escape(profile.name || profile.email || "Private profile")}</strong><small>${escape(profile.email || "Local private workspace")}</small><small>${window.GDriveSync?.accountSessions?.[id]?.expiresAt > Date.now() || (window.state?.currentUserId === id && window.GDriveSync?.getToken()) ? "Private workspace · Continue" : profile.source === "google" ? "Private workspace · Sign in" : "Local workspace · Continue"}</small></span>
                            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                        </button>
                    `).join("")}
                    <button type="button" class="session-account session-account-google" data-session-google>
                        <span class="session-account-icon"><i class="fa-brands fa-google"></i></span>
                        <span><strong>Other account</strong><small>Sign in with Google</small></span>
                        <i class="fa-solid fa-plus" aria-hidden="true"></i>
                    </button>
                </div>
                <p class="session-chooser-note">Your files and settings belong to your account. Sign in with Google to connect Drive backup.</p>
                <p class="session-chooser-error" data-session-error role="alert" hidden></p>
                <button type="button" class="session-chooser-offline" data-session-offline hidden>Continue this remembered profile offline</button>
            </div>
            <footer class="session-lock-footer"><button type="button" data-session-experience><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Change experience</button><span><i class="fa-solid fa-lock" aria-hidden="true"></i> Your personal workspace</span></footer>
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
            overlay.querySelector('.session-lock-header').innerHTML = '<span data-session-status-time></span><span aria-label="Device status"><i class="fa-solid fa-signal" aria-hidden="true"></i><i class="fa-solid fa-wifi" aria-hidden="true"></i><i class="fa-solid fa-battery-full" aria-hidden="true"></i></span>';
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
        const complete = () => {
            window.state.sessionChosen = true;
            window.GDriveSync.pendingReconnectReason = null;
            window.startSelectedWorkspace?.();
            window.closeSessionChooser();
        };
        overlay.addEventListener("click", async event => {
            const button = event.target.closest("button");
            if (!button || button.disabled) return;
            if (button.hasAttribute('data-session-experience')) {
                document.getElementById('boot-screen')?.classList.remove('hidden');
                window.closeSessionChooser();
                return;
            }
            if (button.hasAttribute("data-session-public")) {
                await window.prepareProfileSwitch();
                window.setCurrentUser("bl4ut0");
                complete();
                return;
            }
            if (button.hasAttribute("data-session-offline")) {
                await window.prepareProfileSwitch();
                window.setCurrentUser(offlineProfileId);
                await window.SystemFS?.ensureDefaultFiles?.();
                await window.loadPreferencesFromFilesystem?.();
                complete();
                return;
            }
            const id = button.dataset.sessionProfile;
            if (!id && !button.hasAttribute("data-session-google")) return;
            const error = overlay.querySelector("[data-session-error]");
            const offline = overlay.querySelector("[data-session-offline]");
            error.hidden = true;
            offline.hidden = true;
            overlay.querySelectorAll("button").forEach(node => { node.disabled = true; });
            overlay.setAttribute("aria-busy", "true");
            try {
                if (id) {
                    await window.prepareProfileSwitch();
                    window.setCurrentUser(id);
                    if (profiles[id].source !== "google" || window.GDriveSync.getToken()) {
                        await window.SystemFS?.ensureDefaultFiles?.();
                        await window.loadPreferencesFromFilesystem?.();
                        complete();
                        return;
                    }
                }
                await window.GDriveSync.loadGsiLibrary();
                const clientId = window.Storage?.local.get("bl4ut0_gdrive_client_id") || window.GDriveSync.defaultClientId;
                await window.GDriveSync.login(clientId, { selectAccount: !id, expectedSub: id ? profiles[id].sub : null });
                await window.loadPreferencesFromFilesystem?.();
                complete();
                window.triggerGDriveSync?.({ silent: true });
            } catch (reason) {
                error.textContent = reason?.message || "Sign-in could not be completed. Please try again.";
                error.hidden = false;
                offlineProfileId = id || null;
                offline.hidden = !id;
            } finally {
                overlay.querySelectorAll("button").forEach(node => { node.disabled = false; });
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
        window.GDriveSync?.loadGsiLibrary().catch(() => {});
    };

    window.EventBus?.on("view:changed", view => {
        if (!["desktop", "mobile"].includes(view)) return;
        if (window.state?.systemStarted && !window.state.sessionChosen) window.openSessionChooser();
    });
})();
