/**
 * PortfoliOS: User Account Definitions
 * Keeps account identity separate from shell rendering so future multi-user support can grow cleanly.
 */

const DEFAULT_PRIVATE_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='26' fill='%23090d14'/%3E%3Ccircle cx='48' cy='37' r='16' fill='%2322d3ee'/%3E%3Cpath d='M22 78c4-18 18-28 26-28s22 10 26 28' fill='%232dd4bf'/%3E%3C/svg%3E";

// CORS image requests work with the shell's COEP isolation policy.
window.setProfileAvatar = (image, source, label = 'Profile picture') => {
    if (!image) return;
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.alt = label;
    image.onerror = () => {
        image.onerror = null;
        image.src = DEFAULT_PRIVATE_AVATAR;
    };
    image.src = source || DEFAULT_PRIVATE_AVATAR;
};

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
        privateProfile: false,
        hiddenIds: [
            "portfolio-studio"
        ]
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

window.getSavedPrivateProfile = (userId = window.state?.currentUserId) => {
    const profiles = window.getPrivateProfiles?.() || {};
    if (profiles[userId]) return profiles[userId];
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

window.getPrivateProfiles = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem("bl4ut0_private_profiles") || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        return Object.fromEntries(Object.entries(parsed).filter(([id, profile]) => /^(private|private_[a-zA-Z0-9_-]+)$/.test(id) && profile && typeof profile === "object" && profile.sub && profile.email));
    } catch (error) { return {}; }
};
window.isPrivateUser = (id = window.state?.currentUserId) => id === "private" || /^private_[a-zA-Z0-9_-]+$/.test(id || "");
window.refreshPrivateAccounts = () => {
    const template = window.userAccounts.find(user => user.id === "private");
    window.userAccounts = window.userAccounts.filter(user => !user.id.startsWith("private_"));
    Object.entries(window.getPrivateProfiles()).forEach(([id, profile]) => {
        if (!window.isPrivateUser(id) || !profile?.email || !profile?.sub) return;
        const account = { ...template, id, displayName: profile.name || profile.email, handle: profile.email, avatar: profile.avatar || DEFAULT_PRIVATE_AVATAR };
        if (id === "private") Object.assign(template, account);
        else window.userAccounts.push(account);
    });
};
window.refreshPrivateAccounts();
window.getUserAccounts = () => window.userAccounts || [];

window.getCurrentUser = () => {
    const users = window.getUserAccounts();
    return users.find((user) => user.id === window.state?.currentUserId) || users[0] || null;
};

window.getCurrentUserHiddenIds = () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    return new Set(user?.hiddenIds || []);
};

// Admin privileges are memory-only, expire, and belong to the active profile.
(() => {
    let timer;
    const refresh = () => window.EventBus?.emit("desktop:refresh");
    const clear = () => {
        clearTimeout(timer);
        window.AdminSession = null;
        window.closeDesktopWindow?.("portfolio-studio");
        refresh();
    };
    window.clearAdminSession = clear;
    window.establishAdminSession = (session, owner) => {
        if (owner !== window.state?.currentUserId || typeof session.token !== "string" || !session.token || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return false;
        clearTimeout(timer);
        window.AdminSession = {
            token: session.token, expiresAt: session.expiresAt,
            isAuthenticated: () => owner === window.state?.currentUserId && Date.now() < session.expiresAt
        };
        timer = setTimeout(clear, Math.min(session.expiresAt - Date.now(), 2147483647));
        refresh();
        return true;
    };
    window.EventBus?.on("user:changed", clear);
})();

window.isVisibleForCurrentUser = (id) => {
    if (!id) return false;
    if (id === "portfolio-studio") return Boolean(window.AdminSession?.isAuthenticated());
    return !window.getCurrentUserHiddenIds().has(id);
};

window.applyPortfolioConfigOverrides = (config) => {
    if (!config || typeof config !== "object") return;
    const publicUser = window.userAccounts?.find(u => u.id === "bl4ut0");
    if (publicUser && config.profile) {
        if (config.profile.displayName) publicUser.displayName = config.profile.displayName;
        if (config.profile.handle) publicUser.handle = config.profile.handle;
        if (config.profile.role) publicUser.role = config.profile.role;
        if (config.profile.status) publicUser.status = config.profile.status;
        if (config.profile.bio) publicUser.bio = config.profile.bio;
        if (config.profile.avatar) publicUser.avatar = config.profile.avatar;
    }
    if (config.guestHiddenAppIds && Array.isArray(config.guestHiddenAppIds)) {
        publicUser.hiddenIds = [...new Set([...(publicUser.hiddenIds || []), ...config.guestHiddenAppIds])];
    }
    if (config.boot) {
        const eyebrow = document.querySelector(".eyebrow");
        const title = document.getElementById("boot-title");
        const summary = document.getElementById("boot-summary");
        if (eyebrow && config.boot.eyebrow) eyebrow.textContent = config.boot.eyebrow;
        if (title && config.boot.title) title.textContent = config.boot.title;
        if (summary && config.boot.summary) summary.textContent = config.boot.summary;
    }
};

// Asynchronously load server-configured overrides on boot
if (typeof fetch === "function") {
    fetch("data/portfolio-config.json", { cache: "no-store" })
        .then(res => res.ok ? res.json() : null)
        .then(cfg => { if (cfg) window.applyPortfolioConfigOverrides(cfg); })
        .catch(() => {});
}

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

    if (window.state.sessionChosen && desktop && window.applyDesktopPreferences) {
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

    if (!window.state.sessionChosen) return;
    if (window.renderDesktopIcons) window.renderDesktopIcons();
    if (window.renderStartMenu) window.renderStartMenu();
    if (window.renderDossier) window.renderDossier(window.state.activeId);
    if (window.renderNetworkMap) window.renderNetworkMap();
    if (window.renderMobileApps) window.renderMobileApps();
    if (window.renderQuick) window.renderQuick();
    if (window.renderTaskbar) window.renderTaskbar();
    if (window.renderStore) window.renderStore();
};

window.prepareProfileSwitch = async ({ allowProfileSwitch = false, autoSave = false } = {}) => {
    if (window.GDriveSync?.profileSwitchInProgress && !allowProfileSwitch) throw new Error("A profile switch is already in progress.");
    if (Object.keys(window.state?.installingApps || {}).length) throw new Error("Wait for app installation to finish before switching accounts.");
    if (window.GDriveSync?.syncInProgress) throw new Error("Wait for the current Drive backup to finish before switching accounts.");
    await window.flushDesktopLayout?.();
    await window.AppIcons?.flush();
    const apps = Array.from(window.state?.openApps || []);
    for (const appId of apps) {
        const allowed = await window.runAppLifecycleHook?.(appId, "beforeClose", window.getDesktopWindowElement?.(appId), { rethrow: true, reason: "profile-switch", autoSave });
        if (allowed === false) throw new Error("Save your work in " + (window.appRegistry?.[appId]?.title || appId) + " before switching profiles.");
    }
    const closed = await Promise.all(apps.map(appId => window.closeDesktopWindow?.(appId)));
    if (closed.includes(false)) throw new Error("Save your open work before switching profiles.");
    await window.MobileOS?.clearTasks?.();
};

window.setCurrentUser = (userId, { preserveGoogleSession = false, allowProfileSwitch = false } = {}) => {
    if (window.GDriveSync?.profileSwitchInProgress && !allowProfileSwitch) return;
    const user = window.getUserAccounts().find((account) => account.id === userId);
    if (!user || !window.state) return;
    if (window.GDriveSync?.syncInProgress && window.state.currentUserId !== user.id) return;
    window.state.currentUserId = user.id;
    if (window.Storage) {
        window.Storage.local.set("bl4ut0CurrentUser", user.id);
    }
    if (window.EventBus) {
        window.EventBus.emit("user:changed", { ...user, preserveGoogleSession });
    }
    if (window.applyCurrentUserProfile) {
        window.applyCurrentUserProfile();
    }
};

// Remembered identity customizes a local workspace; it is not a Google credential.
window.activateGooglePrivateProfile = async (googleProfile) => {
    if (!googleProfile?.sub || !googleProfile?.email || !/^[a-zA-Z0-9_-]+$/.test(googleProfile.sub)) throw new Error("Google did not return an account identity. Please sign in again.");
    const profiles = window.getPrivateProfiles();
    const existingId = Object.keys(profiles).find(id => profiles[id]?.sub === googleProfile.sub);
    const legacy = window.getSavedPrivateProfile("private");
    const id = "private_" + googleProfile.sub;
    const migrateLegacy = !existingId && !Object.keys(profiles).length && legacy && (!legacy.sub || legacy.sub === googleProfile.sub);
    const profile = {
        name: googleProfile.name || googleProfile.email, email: googleProfile.email,
        sub: googleProfile.sub, picture: googleProfile.picture || "",
        avatar: /^https:\/\//i.test(googleProfile.picture || "") ? googleProfile.picture : DEFAULT_PRIVATE_AVATAR, source: "google"
    };
    if (migrateLegacy) {
        const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
        keys.forEach(key => {
            if (key?.startsWith("bl4ut0_private_") && !["bl4ut0_private_user_profile", "bl4ut0_private_profiles", "bl4ut0_private_workspace_migrated"].includes(key)) {
                localStorage.setItem(key.replace("bl4ut0_private_", "bl4ut0_" + id + "_"), localStorage.getItem(key));
            } else if (key?.startsWith("desktop_pos_private_")) {
                localStorage.setItem(key.replace("desktop_pos_private_", "desktop_pos_" + id + "_"), localStorage.getItem(key));
            } else if (key === "bl4ut0_installed_apps_private") localStorage.setItem("bl4ut0_installed_apps_" + id, localStorage.getItem(key));
        });
        await window.SystemFS?.migrateProfileWorkspace?.("private", id);
    }
    if (existingId && existingId !== id) delete profiles[existingId];
    profiles[id] = profile;
    localStorage.setItem("bl4ut0_private_profiles", JSON.stringify(profiles));
    await window.prepareProfileSwitch();
    window.refreshPrivateAccounts();
    window.setCurrentUser(id, { preserveGoogleSession: true });
    await window.SystemFS?.ensureDefaultFiles?.();
    await window.savePreferencesToFilesystem?.();
    return profile;
};

window.readFilesystemRecordText = async (record) => {
    if (!record || record.data === null || record.data === undefined) return "";
    if (typeof record.data === "string") return record.data;
    if (record.data instanceof Blob) return record.data.text();
    if (record.data instanceof ArrayBuffer) return new TextDecoder().decode(record.data);
    return String(record.data);
};

window.clearPrivateProfileData = async () => {
    const userId = window.state?.currentUserId;
    if (!window.isPrivateUser(userId)) return;
    await window.PrivateSessions?.release({allowOffline:true});
    localStorage.removeItem('portfolios:recovery-base:'+userId);
    const profiles = window.getPrivateProfiles();
    const otherIds = Object.keys(profiles).filter(id => id !== userId);
    [window.localStorage, window.sessionStorage].forEach(storage => {
        try {
            const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
            keys.forEach(key => {
                if (key?.startsWith('portfolios:preference-revision:') && window.WorkspaceSessions?.ownsPreference(key.slice('portfolios:preference-revision:'.length),userId)) {storage.removeItem(key);return;}
                if (!key || otherIds.some(id => key.startsWith("bl4ut0_" + id + "_") || key.startsWith("desktop_pos_" + id + "_"))) return;
                if (key.startsWith("bl4ut0_" + userId + "_") && key !== "bl4ut0_private_profiles" || key === "bl4ut0_installed_apps_" + userId || key.startsWith("desktop_pos_" + userId + "_")) storage.removeItem(key);
            });
        } catch (error) {}
    });
    delete profiles[userId];
    localStorage.setItem("bl4ut0_private_profiles", JSON.stringify(profiles));
    delete window.GDriveSync?.accountSessions?.[userId];
    await window.GDriveSync?.logout();
    await window.SystemFS?.deleteFileRecursive("/home/" + userId, { silent: true });
    window.refreshPrivateAccounts();
    if (userId === "private") window.resetPrivateAccountDisplay();
};

const profilePreferenceWrites = new Map();
window.savePreferencesToFilesystem = async ({ strict = false } = {}) => {
    const userId = window.getCurrentUser?.()?.id;
    if (!window.isPrivateUser?.(userId)) return;
    try {
        if (!window.SystemFS) throw new Error('Local storage is unavailable.');
        const previous = profilePreferenceWrites.get(userId) || Promise.resolve();
        const operation = previous.catch(()=>{}).then(()=> {
            const save = async () => {
                if(userId !== window.state.currentUserId) throw new Error('The profile changed before preferences were saved.');
                // Read at commit time, not before waiting behind another tab/write.
                const path='/home/'+userId+'/settings.json';
                const existing=await window.SystemFS.readFile(path);
                const existingText=existing?await window.readFilesystemRecordText(existing):null;
                if(userId !== window.state.currentUserId) throw new Error('The profile changed before preferences were saved.');
                const settings = Object.create(null), prefix='bl4ut0_'+userId+'_';
                const installedKey=window.getInstalledStoreAppsKey?.(userId) || 'bl4ut0_installed_apps_'+userId;
                for(let i=0;i<localStorage.length;i++) {
                    const key=localStorage.key(i);
                    if(key && (window.WorkspaceSessions ? window.WorkspaceSessions.ownsPreference(key,userId) : (key.startsWith(prefix) || key.startsWith('desktop_pos_'+userId+'_') || key===installedKey) && key!=='bl4ut0_private_profiles')) settings[key]=localStorage.getItem(key);
                }
                const revisions=window.WorkspaceSessions?.revisions(userId) || {};
                for(const key of Object.keys(revisions)) settings[key]=localStorage.getItem(key); // null records a deliberate reset.
                settings.__portfoliosPreferenceRevisions=revisions;
                const json=JSON.stringify(settings,null,2);
                if(userId !== window.state.currentUserId) throw new Error('The profile changed before preferences were saved.');
                if(existingText===json)return;
                if(userId !== window.state.currentUserId) throw new Error('The profile changed before preferences were saved.');
                await window.SystemFS.writeFile(path,'settings.json','/home/'+userId,json,new Blob([json]).size,'application/json',false,{silent:true});
                window.EventBus?.emit('preferences:saved',{userId});
            };
            return window.WorkspaceSessions ? window.WorkspaceSessions.withLock('preferences',userId,save) : save();
        });
        profilePreferenceWrites.set(userId,operation);
        try {await operation;} finally {if(profilePreferenceWrites.get(userId)===operation)profilePreferenceWrites.delete(userId);}
    } catch(error) {console.error('Failed to save preferences to filesystem',error);if(strict)throw error;}
};

window.loadPreferencesFromFilesystem = async () => {
    const userId=window.getCurrentUser?.()?.id;
    if(!window.isPrivateUser?.(userId) || !window.SystemFS)return;
    const restore=async()=>{
        const record=await window.SystemFS.readFile('/home/'+userId+'/settings.json');
        if(!record?.data)return;
        const settings=JSON.parse(await window.readFilesystemRecordText(record));
        if(userId!==window.state.currentUserId)return;
        const revisions=settings.__portfoliosPreferenceRevisions || {};
        const prefix='bl4ut0_'+userId+'_', installedKey=window.getInstalledStoreAppsKey?.(userId) || 'bl4ut0_installed_apps_'+userId;
        let changed=false;
        for(const [key,value] of Object.entries(settings)) {
            if(window.WorkspaceSessions ? !window.WorkspaceSessions.ownsPreference(key,userId) : !(key.startsWith(prefix) || key.startsWith('desktop_pos_'+userId+'_') || key===installedKey) || key==='bl4ut0_private_profiles')continue;
            const localRevision=window.WorkspaceSessions?.revision(key) || 0;
            const remoteRevision=Number.isFinite(revisions[key]) && revisions[key]>0?revisions[key]:0;
            if(localRevision>0 && localRevision>=remoteRevision)continue;
            if(value!==null && typeof value!=='string')continue;
            if(localStorage.getItem(key)!==value) {
                if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);
                changed=true;
            }
            window.WorkspaceSessions?.adoptRevision(key,remoteRevision);
        }
        if(changed) {
            window.syncPrivateAccountFromSavedProfile?.();
            window.applyCurrentUserProfile?.();
            window.EventBus?.emit('preferences:external',{userId});
        }
    };
    try {await (window.WorkspaceSessions ? window.WorkspaceSessions.withLock('preferences',userId,restore) : restore());}
    catch(error){console.error('Failed to load preferences from filesystem',error);}
};
