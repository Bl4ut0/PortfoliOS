/**
 * PortfoliOS: Start Menu Component
 * Renders pinned programs and available portfolio system nodes in the Windows-style Start Menu.
 */

window.getStartMenuLauncher = (id) => {
    if (!id || (window.isVisibleForCurrentUser && !window.isVisibleForCurrentUser(id))) return null;

    const app = window.appById ? window.appById(id) : null;
    if (app) {
        const metaById = {
            store: "App catalog",
            files: "File manager",
            settings: "System settings",
            browser: "Web routes",
            cli: "Terminal",
            "local-ai": "AI controls",
            taskmgr: "Utilities",
            linux: "Lab shell",
            network: "Topology view",
            profile: "Identity",
            dossier: "Project files"
        };

        return {
            id: app.id,
            title: app.title,
            icon: app.icon,
            color: app.id === "linux" ? "#34d399" : (app.id === "store" ? "#a78bfa" : "#22d3ee"),
            launchApp: app.id,
            selectId: "",
            meta: metaById[app.id] || "Installed app",
            kind: "app"
        };
    }

    const system = window.systemById ? window.systemById(id) : null;
    if (!system) return null;

    return {
        id: system.id,
        title: system.title,
        icon: system.icon,
        color: system.color,
        launchApp: system.launchApp || "dossier",
        selectId: system.id,
        meta: `${system.status} / ${system.type}`,
        kind: "node"
    };
};

window.isStartMenuLauncherAvailable = (item) => {
    if (!item) return false;
    if (window.isVisibleForCurrentUser && !window.isVisibleForCurrentUser(item.id)) return false;
    return window.isAppInstalled ? window.isAppInstalled(item.id) : true;
};

window.getStartMenuPinnedApps = () => {
    const sourceApps = window.getVisibleDesktopApps ? window.getVisibleDesktopApps() : (window.desktopApps || []);
    const fallbackIds = sourceApps.filter((item) => item.pinned).map((item) => item.id);
    const explicitOrder = Array.isArray(window.startMenuPinnedIds)
        ? window.startMenuPinnedIds
        : fallbackIds;
    const ordered = explicitOrder
        .map((id) => window.getStartMenuLauncher(id))
        .filter(window.isStartMenuLauncherAvailable);
    const orderedIds = new Set(ordered.map((item) => item.id));
    return ordered.concat(
        fallbackIds
            .filter((id) => !orderedIds.has(id))
            .map((id) => window.getStartMenuLauncher(id))
            .filter(window.isStartMenuLauncherAvailable)
    );
};

window.getStartMenuGroups = () => {
    const configuredGroups = Array.isArray(window.startMenuGroups)
        ? window.startMenuGroups
        : [
            { id: "system", label: "System", ids: (window.desktopApps || []).map((item) => item.id) },
            { id: "portfolio", label: "Portfolio", ids: (window.systems || []).map((item) => item.id) }
        ];

    return configuredGroups.map((group) => ({
        ...group,
        items: (group.ids || [])
            .map((id) => window.getStartMenuLauncher(id))
            .filter(window.isStartMenuLauncherAvailable)
    })).filter((group) => group.items.length);
};

window.renderStartUser = () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user) return;

    const stripAvatar = window.byId ? window.byId("start-user-strip-avatar") : document.getElementById("start-user-strip-avatar");
    if (stripAvatar) {
        stripAvatar.src = user.avatar || "";
        stripAvatar.alt = `${user.displayName} profile picture`;
    }

    const name = window.byId ? window.byId("start-user-name") : document.getElementById("start-user-name");
    const meta = window.byId ? window.byId("start-user-meta") : document.getElementById("start-user-meta");
    if (name) name.textContent = user.displayName;
    if (meta) meta.textContent = `${user.handle} / ${user.accountType || user.role}`;

    // Update rail avatar status styles
    const ownerAvatarBtn = document.getElementById("start-rail-avatar-owner");
    const userAvatarBtn = document.getElementById("start-rail-avatar-user");

    if (ownerAvatarBtn) {
        const isOwner = user.id === "bl4ut0";
        ownerAvatarBtn.classList.toggle("active-profile", isOwner);
        ownerAvatarBtn.style.opacity = isOwner ? "1" : "0.55";
    }

    if (userAvatarBtn) {
        const isPrivate = user.id === "private";
        userAvatarBtn.classList.toggle("active-profile", isPrivate);
        userAvatarBtn.style.opacity = isPrivate ? "1" : "0.55";

        const savedProfileRaw = localStorage.getItem("bl4ut0_private_user_profile");
        if (isPrivate) {
            userAvatarBtn.innerHTML = `<img src="${user.avatar}" alt="${user.displayName}">`;
            userAvatarBtn.title = `${user.displayName} (Active Private Profile)`;
        } else if (savedProfileRaw) {
            try {
                const savedProfile = JSON.parse(savedProfileRaw);
                userAvatarBtn.innerHTML = `<img src="${savedProfile.avatar}" alt="${savedProfile.email}">`;
                userAvatarBtn.title = `Switch to ${savedProfile.email}`;
            } catch (e) {
                userAvatarBtn.innerHTML = `<i class="fa-solid fa-circle-question" style="font-size: 1.25rem;"></i>`;
                userAvatarBtn.title = "Sign In";
            }
        } else {
            userAvatarBtn.innerHTML = `<i class="fa-solid fa-circle-question" style="font-size: 1.25rem;"></i>`;
            userAvatarBtn.title = "Sign In";
        }
    }
};

window.closeUserProfilePrompt = () => {
    const prompt = window.byId ? window.byId("user-profile-prompt") : document.getElementById("user-profile-prompt");
    if (prompt) prompt.remove();
};

window.openUserProfilePrompt = () => {
    window.closeUserProfilePrompt();

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const isPrivate = currentUser?.id === "private";
    const desktop = window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience");
    const host = desktop?.querySelector(".desktop-wallpaper") || desktop || document.body;

    const prompt = document.createElement("aside");
    prompt.id = "user-profile-prompt";
    prompt.className = "user-profile-prompt";
    prompt.setAttribute("aria-label", "Cloud profile sign in");

    prompt.innerHTML = isPrivate ? `
        <div class="user-profile-prompt-head">
            <i class="fa-solid fa-user-shield"></i>
            <span>
                <strong>Private profile active</strong>
                <small>Cloud Sync / private desktop</small>
            </span>
            <button type="button" data-close-user-profile-prompt title="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <p>Your private desktop hides the owner project nodes and keeps Store downloads scoped to this profile.</p>
        <div class="user-profile-prompt-actions">
            <button type="button" class="primary" data-restore-owner-profile>
                <i class="fa-solid fa-arrow-right-from-bracket"></i>
                Return to Owner
            </button>
            <button type="button" id="btn-delete-profile" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.35); color: #ef4444; font-weight: bold; min-height: 2rem; padding: 0.42rem 0.62rem; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;">
                <i class="fa-solid fa-trash-can"></i>
                Delete Profile
            </button>
            <button type="button" data-close-user-profile-prompt>Close</button>
        </div>
    ` : `
        <div class="user-profile-prompt-head">
            <i class="fa-solid fa-cloud-arrow-down"></i>
            <span>
                <strong>Sign in to Private User</strong>
                <small>Cloud sync profile download</small>
            </span>
            <button type="button" data-close-user-profile-prompt title="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <label class="cloud-sync-field">
            <span>Cloud Sync ID (Email)</span>
            <input type="email" id="cloud-sync-id" placeholder="user@example.com" autocomplete="email">
        </label>
        <p>This switches to a private desktop with owner-specific shortcuts and personal nodes removed.</p>
        <div class="user-profile-prompt-actions">
            <button type="button" class="primary" data-sign-in-private-profile>
                <i class="fa-solid fa-cloud-arrow-down"></i>
                Sign In & Sync
            </button>
            <button type="button" data-close-user-profile-prompt>Cancel</button>
        </div>
    `;

    host.appendChild(prompt);
    prompt.querySelector("input")?.focus({ preventScroll: true });
};

window.signInPrivateProfile = () => {
    const emailInput = document.getElementById("cloud-sync-id");
    const email = emailInput ? emailInput.value.trim() : "";
    if (!email) {
        window.showDesktopToast?.("Please enter a valid email.");
        return;
    }
    if (!email.includes("@")) {
        window.showDesktopToast?.("Please enter a valid email address.");
        return;
    }

    const button = document.querySelector("[data-sign-in-private-profile]");
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing';
    }

    window.setTimeout(() => {
        // Generate Google-style letter avatar
        const char = email.charAt(0).toUpperCase();
        const colors = ["#1a73e8", "#ea4335", "#f9ab00", "#34a853"];
        const charCode = char.charCodeAt(0);
        const color = colors[charCode % colors.length];
        const avatar = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='26' fill='${encodeURIComponent(color)}'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48' font-weight='bold' fill='%23ffffff'%3E${char}%3C/text%3E%3C/svg%3E`;

        const profile = { email, avatar };
        localStorage.setItem("bl4ut0_private_user_profile", JSON.stringify(profile));

        // Update active private user accounts info
        const privateAccount = window.userAccounts?.find(a => a.id === "private");
        if (privateAccount) {
            privateAccount.displayName = email;
            privateAccount.handle = email.split('@')[0];
            privateAccount.avatar = avatar;
        }

        if (window.setCurrentUser) window.setCurrentUser("private");
        window.closeUserProfilePrompt();
        window.showDesktopToast?.("Private cloud profile synced.");
    }, 420);
};

window.restoreOwnerProfile = () => {
    if (window.setCurrentUser) window.setCurrentUser("bl4ut0");
    window.closeUserProfilePrompt();
    window.showDesktopToast?.("Owner desktop restored.");
};

window.renderStartMenu = () => {
    const startPinned = window.byId ? window.byId("start-pinned") : document.getElementById("start-pinned");
    const startGrid = window.byId ? window.byId("start-grid") : document.getElementById("start-grid");
    if (!startPinned || !startGrid) return;

    const escapeHtml = window.escapeHtml || ((value) => String(value ?? ""));
    const safeColor = (value) => /^#[0-9a-f]{3,8}$/i.test(String(value || "")) ? value : "#22d3ee";

    window.renderStartUser();

    const renderLauncherAttrs = (item) => `
        ${item.selectId ? `data-select="${escapeHtml(item.selectId)}"` : ""}
        data-open-app="${escapeHtml(item.launchApp)}"`;

    startPinned.innerHTML = window.getStartMenuPinnedApps()
        .map((item) => `
            <button class="start-pin" ${renderLauncherAttrs(item)} title="Open ${escapeHtml(item.title)}">
                ${window.getAppIconHtml(item.icon)}
                <span>${escapeHtml(item.title)}</span>
                <small>${escapeHtml(item.meta)}</small>
            </button>
        `).join("");

    startGrid.innerHTML = window.getStartMenuGroups()
        .map((group) => `
            <section class="start-menu-group" data-start-group="${escapeHtml(group.id)}">
                <div class="start-group-title">
                    <h4>${escapeHtml(group.label)}</h4>
                    <b>${group.items.length}</b>
                </div>
                <div class="start-group-grid">
                    ${group.items.map((item) => `
                        <button class="start-app" ${renderLauncherAttrs(item)}
                            style="--tile-color:${safeColor(item.color)}" title="Open ${escapeHtml(item.title)}">
                            ${window.getAppIconHtml(item.icon)}
                            <span>
                                <strong>${escapeHtml(item.title)}</strong>
                                <small>${escapeHtml(item.meta)}</small>
                            </span>
                        </button>
                    `).join("")}
                </div>
            </section>
        `).join("");
};

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("app:installed", () => window.renderStartMenu());
    window.EventBus.on("app:uninstalled", () => window.renderStartMenu());
    window.EventBus.on("desktop:refresh", () => window.renderStartMenu());
    window.EventBus.on("user:changed", () => window.renderStartMenu());
}
