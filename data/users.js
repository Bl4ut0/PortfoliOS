/**
 * PortfoliOS: User Account Definitions
 * Keeps account identity separate from shell rendering so future multi-user support can grow cleanly.
 */

const DEFAULT_PRIVATE_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='26' fill='%23090d14'/%3E%3Ccircle cx='48' cy='37' r='16' fill='%2322d3ee'/%3E%3Cpath d='M22 78c4-18 18-28 26-28s22 10 26 28' fill='%232dd4bf'/%3E%3C/svg%3E";

window.userAccounts = [
    {
        id: "bl4ut0",
        displayName: "Guest Access",
        handle: "Bl4ut0 Owner Account",
        role: "Guest",
        accountType: "Public portfolio session",
        avatar: "identity-portrait.jpg",
        accent: "#22d3ee",
        status: "Guest session",
        privateProfile: false
    },
    {
        id: "private",
        displayName: "Private User",
        handle: "Cloud Sync",
        role: "User",
        accountType: "Private Account",
        avatar: DEFAULT_PRIVATE_AVATAR,
        accent: "#2dd4bf",
        status: "Synced profile",
        privateProfile: true,
        hiddenIds: [
            "profile", "dossier", "network", "devhub", "linux",
            "addons", "guildcraft", "homelab", "survival-ai", "status",
            "wardenit", "automation", "media"
        ],
        desktopIconLayout: {
            store: { col: 0, row: 0 },
            files: { col: 0, row: 1 },
            cli: { col: 0, row: 2 },
            romplayer: { col: 1, row: 0 },
            openrct2: { col: 1, row: 1 },
            doomsource: { col: 1, row: 2 },
            duke32: { col: 1, row: 3 },
            diablo: { col: 1, row: 4 },
            quake: { col: 1, row: 5 },
            webamp: { col: 2, row: 0 }
        }
    }
];

window.resetPrivateAccountDisplay = () => {
    const privateAccount = window.userAccounts?.find(a => a.id === "private");
    if (!privateAccount) return;
    privateAccount.displayName = "Private User";
    privateAccount.handle = "Cloud Sync";
    privateAccount.avatar = DEFAULT_PRIVATE_AVATAR;
};

window.syncPrivateAccountFromSavedProfile = () => {
    try {
        const savedProfileRaw = localStorage.getItem("bl4ut0_private_user_profile");
        if (savedProfileRaw) {
            const savedProfile = JSON.parse(savedProfileRaw);
            const privateAccount = window.userAccounts.find(a => a.id === "private");
            const displayName = savedProfile.name || savedProfile.email;
            if (privateAccount && displayName && savedProfile.avatar) {
                privateAccount.displayName = displayName;
                privateAccount.handle = displayName.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, "");
                privateAccount.avatar = savedProfile.avatar;
                return;
            }
        }
        window.resetPrivateAccountDisplay();
    } catch (e) {
        console.error("Failed to load private user profile", e);
        window.resetPrivateAccountDisplay();
    }
};

// Initialize private profile credentials from localStorage if saved
window.syncPrivateAccountFromSavedProfile();

window.getSavedPrivateProfile = () => {
    try {
        const raw = localStorage.getItem("bl4ut0_private_user_profile");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.name || parsed.email) && parsed.avatar) {
            return parsed;
        }
    } catch (e) {}
    return null;
};

window.getUserAccounts = () => window.userAccounts || [];

window.getCurrentUser = () => {
    const users = window.getUserAccounts();
    return users.find((user) => user.id === window.state?.currentUserId) || users[0] || null;
};

window.getCurrentUserHiddenIds = () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    return new Set(user?.hiddenIds || []);
};

window.isVisibleForCurrentUser = (id) => {
    if (!id) return false;
    return !window.getCurrentUserHiddenIds().has(id);
};

window.getCurrentDesktopIconLayout = () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    return user?.desktopIconLayout || window.defaultDesktopIconLayout || {};
};

window.getVisibleSystems = () => {
    return (window.systems || []).filter((item) => window.isVisibleForCurrentUser(item.id));
};

window.getVisibleDesktopApps = () => {
    return (window.desktopApps || []).filter((item) => window.isVisibleForCurrentUser(item.id));
};

window.applyCurrentUserProfile = () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !window.state) return;

    const desktop = window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience");
    if (desktop) desktop.dataset.user = user.id;

    // Load user-scoped preferences from localStorage into state
    if (window.Storage) {
        const userId = user.id;
        const getKey = (k) => `bl4ut0_${userId}_${k}`;
        
        window.state.wallpaper = window.Storage.local.get(getKey("Wallpaper")) || (userId === "bl4ut0" ? "aurora" : "ember");
        window.state.volume = Number(window.Storage.local.get(getKey("Volume")) || 70);
        window.state.themeId = window.Storage.local.get(getKey("ThemeId")) || "dark";
        window.state.themePrimary = window.Storage.local.get(getKey("ThemePrimary")) || null;
        window.state.themeAccent = window.Storage.local.get(getKey("ThemeAccent")) || null;
        window.state.desktopResolution = window.Storage.local.get(getKey("DesktopResolution")) || "auto";
        window.state.screensaver = window.Storage.local.get(getKey("Screensaver")) || "none";
        window.state.screensaverDelay = Number(window.Storage.local.get(getKey("ScreensaverDelay")) || 5);
    }

    if (window.applyDesktopPreferences) {
        window.applyDesktopPreferences();
    }

    Array.from(window.state.openApps || []).forEach((appId) => {
        if (window.isVisibleForCurrentUser(appId)) return;
        if (window.closeDesktopWindow && document.querySelector(`[data-window="${appId}"]`)) {
            window.closeDesktopWindow(appId);
            return;
        }
        window.state.openApps.delete(appId);
        window.state.minimizedApps.delete(appId);
    });

    const visibleSystems = window.getVisibleSystems();
    if (!window.isVisibleForCurrentUser(window.state.activeId)) {
        window.state.activeId = visibleSystems[0]?.id || "";
    }
    if (window.state.mobileActiveId && !window.isVisibleForCurrentUser(window.state.mobileActiveId)) {
        window.state.mobileActiveId = null;
    }
    if (window.state.quickActiveId !== "overview" && !window.isVisibleForCurrentUser(window.state.quickActiveId)) {
        window.state.quickActiveId = "overview";
    }

    if (window.renderDesktopIcons) window.renderDesktopIcons();
    if (window.renderStartMenu) window.renderStartMenu();
    if (window.renderDossier) window.renderDossier(window.state.activeId);
    if (window.renderNetworkMap) window.renderNetworkMap();
    if (window.renderMobileApps) window.renderMobileApps();
    if (window.renderQuick) window.renderQuick();
    if (window.renderTaskbar) window.renderTaskbar();
    if (window.renderStore) window.renderStore();
};

window.setCurrentUser = (userId) => {
    const user = window.getUserAccounts().find((account) => account.id === userId);
    if (!user || !window.state) return;

    window.state.currentUserId = user.id;
    if (window.Storage) {
        window.Storage.local.set("bl4ut0CurrentUser", user.id);
    }
    if (window.EventBus) {
        window.EventBus.emit("user:changed", user);
    }
    if (window.applyCurrentUserProfile) {
        window.applyCurrentUserProfile();
    }
};

window.readFilesystemRecordText = async (record) => {
    if (!record || record.data === null || record.data === undefined) return "";
    if (typeof record.data === "string") return record.data;
    if (record.data instanceof Blob) return record.data.text();
    if (record.data instanceof ArrayBuffer) return new TextDecoder().decode(record.data);
    return String(record.data);
};

window.clearPrivateProfileData = async () => {
    const shouldRemoveKey = (key) => {
        if (!key) return false;
        return key === "bl4ut0_private_user_profile"
            || key === "bl4ut0_installed_apps_private"
            || key.startsWith("bl4ut0_private_")
            || key.startsWith("desktop_pos_private_")
            || key.startsWith("bl4ut0_sync_manifest_private-")
            || key.startsWith("bl4ut0_last_sync_time_private-");
    };

    [window.localStorage, window.sessionStorage].forEach((storage) => {
        try {
            const keys = [];
            for (let i = 0; i < storage.length; i += 1) {
                const key = storage.key(i);
                if (shouldRemoveKey(key)) keys.push(key);
            }
            keys.forEach((key) => storage.removeItem(key));
        } catch (error) {}
    });

    window.GDriveSync?.clearScopedSyncState?.("private");

    if (window.SystemFS) {
        try {
            await window.SystemFS.deleteFile("/home/private/settings.json", { silent: true });
        } catch (error) {}
    }

    window.resetPrivateAccountDisplay();
};

window.savePreferencesToFilesystem = async () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user) return;

    try {
        if (!window.SystemFS) return;
        const userId = user.id;
        const prefix = `bl4ut0_${userId}_`;
        const installedAppsKey = window.getInstalledStoreAppsKey
            ? window.getInstalledStoreAppsKey(userId)
            : (userId === "bl4ut0" ? "bl4ut0_installed_apps" : `bl4ut0_installed_apps_${userId}`);
        const settings = {};

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(prefix) || key === installedAppsKey || (userId === "private" && key === "bl4ut0_private_user_profile"))) {
                settings[key] = localStorage.getItem(key);
            }
        }

        const jsonStr = JSON.stringify(settings, null, 2);
        const path = `/home/${userId}/settings.json`;
        const name = "settings.json";
        const parent = `/home/${userId}`;
        
        await window.SystemFS.writeFile(path, name, parent, jsonStr, jsonStr.length, "application/json", false, { silent: true });
        console.log(`PortfoliOS: Saved ${userId} profile preferences to virtual filesystem.`);
    } catch (e) {
        console.error("Failed to save preferences to filesystem", e);
    }
};

window.loadPreferencesFromFilesystem = async () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user) return;

    try {
        if (!window.SystemFS) return;
        const record = await window.SystemFS.readFile(`/home/${user.id}/settings.json`);
        if (record && record.data) {
            const settingsText = await window.readFilesystemRecordText(record);
            const settings = JSON.parse(settingsText);
            let changed = false;
            Object.entries(settings).forEach(([key, val]) => {
                if (val !== null && val !== undefined) {
                    if (localStorage.getItem(key) !== String(val)) {
                        localStorage.setItem(key, String(val));
                        changed = true;
                    }
                }
            });

            if (changed) {
                window.syncPrivateAccountFromSavedProfile?.();
                console.log(`PortfoliOS: Restored ${user.id} profile preferences from virtual filesystem.`);
                if (window.applyCurrentUserProfile) {
                    window.applyCurrentUserProfile();
                }
            }
        }
    } catch (e) {
        console.error("Failed to load preferences from filesystem", e);
    }
};
