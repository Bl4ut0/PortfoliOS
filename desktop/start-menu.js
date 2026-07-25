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
            dossier: "Project files",
            openrct2: "Theme park engine",
            musicmini: "Local music player"
        };

        return {
            id: app.id,
            title: app.title,
            icon: app.icon,
            color: app.id === "linux" ? "#34d399" : (app.id === "store" ? "#a78bfa" : "#22d3ee"),
            launchApp: app.id,
            selectId: "",
            meta: app.meta || metaById[app.id] || "Installed app",
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

    const groups = configuredGroups.map((group) => ({
        ...group,
        items: (group.ids || [])
            .map((id) => window.getStartMenuLauncher(id))
            .filter(window.isStartMenuLauncherAvailable)
    })).filter((group) => group.items.length);

    const configuredIds = new Set(configuredGroups.flatMap((group) => group.ids || []));
    const ungroupedItems = (window.desktopApps || [])
        .filter((app) => !configuredIds.has(app.id))
        .map((app) => window.getStartMenuLauncher(app.id))
        .filter(window.isStartMenuLauncherAvailable);

    if (ungroupedItems.length) {
        groups.push({ id: "other-apps", label: "Other Apps", items: ungroupedItems });
    }

    return groups;
};

window.getStartMenuInstalledApps = () => {
    const categoryLabels = new Map((window.startMenuCategories || []).map((category) => [category.id, category.label]));
    return (window.desktopApps || [])
        .filter((app) => window.isAppInstalled ? window.isAppInstalled(app.id) : true)
        .filter((app) => !window.isVisibleForCurrentUser || window.isVisibleForCurrentUser(app.id))
        .map((app) => ({
            ...window.getStartMenuLauncher(app.id),
            category: app.category || "other",
            categoryLabel: categoryLabels.get(app.category) || "Other"
        }))
        .filter(Boolean)
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
};

window.startMenuState = window.startMenuState || { view: "pinned", query: "" };

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

        const savedProfile = window.getSavedPrivateProfile ? window.getSavedPrivateProfile() : null;
        if (isPrivate) {
            userAvatarBtn.innerHTML = `<img src="${user.avatar}" alt="${user.displayName}">`;
            userAvatarBtn.title = `${user.displayName} (Active Private Profile)`;
        } else if (savedProfile) {
            const displayName = savedProfile.name || savedProfile.email || "Private User";
            userAvatarBtn.innerHTML = `<img src="${savedProfile.avatar}" alt="${displayName}">`;
            userAvatarBtn.title = `Switch to ${displayName}`;
        } else {
            userAvatarBtn.innerHTML = `<i class="fa-solid fa-circle-question" style="font-size: 1.25rem;"></i>`;
            userAvatarBtn.title = "Create private profile";
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
    prompt.setAttribute("aria-label", "Private profile");

    prompt.innerHTML = isPrivate ? `
        <div class="user-profile-prompt-head">
            <i class="fa-solid fa-user-shield"></i>
            <span>
                <strong>Private profile active</strong>
                <small>Local private desktop</small>
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
            <button type="button" data-open-settings-panel="cloud-sync">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                Cloud Sync Settings
            </button>
            <button type="button" id="btn-delete-profile" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.35); color: #ef4444; font-weight: bold; min-height: 2rem; padding: 0.42rem 0.62rem; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;">
                <i class="fa-solid fa-trash-can"></i>
                Delete Profile
            </button>
            <button type="button" data-close-user-profile-prompt>Close</button>
        </div>
    ` : `
        <div class="user-profile-prompt-head">
            <i class="fa-solid fa-user-plus"></i>
            <span>
                <strong>Create Private Profile</strong>
                <small>Local PortfoliOS account</small>
            </span>
            <button type="button" data-close-user-profile-prompt title="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <label class="cloud-sync-field">
            <span>Profile Name</span>
            <input type="text" id="private-profile-name" placeholder="Private Account" autocomplete="off">
        </label>
        <p>This profile is created in local browser storage. Cloud backup can be connected separately through Settings.</p>
        <div class="user-profile-prompt-actions">
            <button type="button" class="primary" data-create-private-profile>
                <i class="fa-solid fa-user-plus"></i>
                Create Local Profile
            </button>
            <button type="button" data-open-settings-panel="cloud-sync">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                Cloud Sync Settings
            </button>
            <button type="button" data-close-user-profile-prompt>Cancel</button>
        </div>
    `;

    host.appendChild(prompt);
    prompt.querySelector("input")?.focus({ preventScroll: true });
};

window.createPrivateProfile = async () => {
    const nameInput = document.getElementById("private-profile-name");
    const requestedProfileName = nameInput ? nameInput.value.trim() : "";

    const button = document.querySelector("[data-create-private-profile]");
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
    }

    try {
        const profileName = requestedProfileName || "Private Account";
        const char = profileName.charAt(0).toUpperCase();
        const colors = ["#1a73e8", "#ea4335", "#f9ab00", "#34a853"];
        const charCode = char.charCodeAt(0);
        const color = colors[charCode % colors.length];
        const generatedAvatar = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='26' fill='${encodeURIComponent(color)}'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48' font-weight='bold' fill='%23ffffff'%3E${char}%3C/text%3E%3C/svg%3E`;

        const profile = {
            name: profileName,
            email: "",
            avatar: generatedAvatar,
            picture: "",
            source: "generated"
        };
        localStorage.setItem("bl4ut0_private_user_profile", JSON.stringify(profile));

        // Update active private user accounts info
        const privateAccount = window.userAccounts?.find(a => a.id === "private");
        if (privateAccount) {
            privateAccount.displayName = profileName;
            privateAccount.handle = profileName.toLowerCase().replace(/[^a-z0-9]/g, "") || "private";
            privateAccount.avatar = generatedAvatar;
        }

        if (window.setCurrentUser) window.setCurrentUser("private");
        if (window.savePreferencesToFilesystem) {
            await window.savePreferencesToFilesystem();
        }
        window.closeUserProfilePrompt();
        window.showDesktopToast?.(`Welcome, ${profileName}. Profile saved locally; cloud backup is available in Settings.`);
    } catch (err) {
        console.error("Profile creation failed:", err);
        let errorMsg = "Private profile could not be created.";
        if (err instanceof Error) {
            errorMsg = err.message;
        }
        window.showDesktopToast?.(errorMsg);
        
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Local Profile';
        }
    }
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

    const query = String(window.startMenuState.query || "").trim().toLocaleLowerCase();
    const matchesQuery = (item) => !query || [
        item.title, item.meta, item.categoryLabel
    ].some((value) => String(value || "").toLocaleLowerCase().includes(query));
    const pinnedApps = window.getStartMenuPinnedApps().filter((item) => {
        const app = (window.desktopApps || []).find((candidate) => candidate.id === item.id);
        if (!app) return false;
        return matchesQuery({ ...item, categoryLabel: app.category });
    });
    const installedApps = window.getStartMenuInstalledApps().filter(matchesQuery);

    startPinned.innerHTML = pinnedApps
        .map((item) => `
            <button class="start-pin" ${renderLauncherAttrs(item)} title="Open ${escapeHtml(item.title)}">
                ${window.getAppIconHtml(item.icon)}
                <span>${escapeHtml(item.title)}</span>
                <small>${escapeHtml(item.meta)}</small>
            </button>
        `).join("");

    const letterGroups = installedApps.reduce((groups, item) => {
        const letter = (item.title.match(/[A-Za-z0-9]/)?.[0] || "#").toUpperCase();
        if (!groups.has(letter)) groups.set(letter, []);
        groups.get(letter).push(item);
        return groups;
    }, new Map());

    startGrid.innerHTML = [...letterGroups.entries()].map(([letter, items]) => `
        <section class="start-menu-group" data-start-letter="${escapeHtml(letter)}">
            <div class="start-letter" aria-hidden="true">${escapeHtml(letter)}</div>
            <div class="start-app-list">
                ${items.map((item) => `
                    <button class="start-app" ${renderLauncherAttrs(item)}
                        style="--tile-color:${safeColor(item.color)}" title="Open ${escapeHtml(item.title)}">
                        ${window.getAppIconHtml(item.icon)}
                        <span>
                            <strong>${escapeHtml(item.title)}</strong>
                            <small>${escapeHtml(item.categoryLabel)} · ${escapeHtml(item.meta)}</small>
                        </span>
                    </button>
                `).join("")}
            </div>
        </section>
    `).join("");

    const activeView = query ? "all" : window.startMenuState.view;
    document.querySelectorAll("[data-start-view]").forEach((button) => {
        const active = button.dataset.startView === activeView;
        button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-start-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.startPanel !== activeView;
    });

    const pinnedCount = document.getElementById("start-pinned-count");
    const appCount = document.getElementById("start-app-count");
    const empty = document.getElementById("start-empty");
    if (pinnedCount) pinnedCount.textContent = `${pinnedApps.length} apps`;
    if (appCount) appCount.textContent = `${installedApps.length} installed`;
    if (empty) empty.hidden = activeView === "pinned" ? pinnedApps.length > 0 : installedApps.length > 0;
};

const startMenuRoot = document.getElementById("start-menu");
if (startMenuRoot) {
    startMenuRoot.addEventListener("input", (event) => {
        if (event.target.id !== "start-search-input") return;
        window.startMenuState.query = event.target.value;
        window.renderStartMenu();
    });

    startMenuRoot.addEventListener("click", (event) => {
        const viewButton = event.target.closest("[data-start-view]");
        if (viewButton) {
            window.startMenuState.view = viewButton.dataset.startView;
            window.startMenuState.query = "";
            const input = document.getElementById("start-search-input");
            if (input) input.value = "";
            window.renderStartMenu();
        }

        // Search and view controls are internal menu interactions. Keep their
        // click from reaching desktop-level dismiss/minimize handlers.
        if (viewButton || event.target.closest(".start-search")) {
            event.stopPropagation();
        }
    });
}

document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLocaleLowerCase() !== "k") return;
    const menu = document.getElementById("start-menu");
    if (!menu || menu.hidden) return;
    event.preventDefault();
    document.getElementById("start-search-input")?.focus();
});

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("app:installed", () => window.renderStartMenu());
    window.EventBus.on("app:uninstalled", () => window.renderStartMenu());
    window.EventBus.on("desktop:refresh", () => window.renderStartMenu());
    window.EventBus.on("user:changed", () => window.renderStartMenu());
}
