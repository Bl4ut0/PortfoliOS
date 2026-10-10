/**
 * PortfoliOS: Global State Management
 * Transparent reactive state container powered by ES6 Proxies.
 */
(function() {
    const rawState = {
        activeId: "devhub",
        view: "desktop",
        zIndex: 7,
        openApps: new Set(["profile"]),
        minimizedApps: new Set(),
        activeWindow: "profile",
        currentUserId: "bl4ut0",
        browserBookmark: "devhub",
        mobileActiveId: null,
        mobileSurface: "home",
        quickActiveId: "overview",
        quickRoute: "overview",
        quickFilter: "all",
        quickSearch: "",
        storeCategory: "all",
        storeInstallFilter: "all",
        cliIntroStarted: false,
        systemStarted: false,
        sessionChosen: false,
        workspaceStarted: false,
        wallpaper: "aurora", // will be updated from storage on boot / preferences load
        volume: 70,
        themeId: "dark",
        themePrimary: null,
        themeAccent: null,
        desktopResolution: "auto",
        screensaver: "none",
        screensaverDelay: 5,
        gdriveConnected: false
    };

    // Public visits are disposable; reset before state reads saved preferences.
    window.resetPublicLocalState = (storage = typeof localStorage !== "undefined" ? localStorage : window.localStorage) => {
        if (!storage) return;
        const legacy = new Set(['bl4ut0_installed_apps', 'bl4ut0Wallpaper', 'bl4ut0Volume', 'bl4ut0ThemeId', 'bl4ut0ThemePrimary', 'bl4ut0ThemeAccent', 'bl4ut0DesktopResolution', 'bl4ut0Screensaver', 'bl4ut0ScreensaverDelay']);
        const keys = Array.from({length:storage.length}, (_, index) => storage.key(index));
        keys.forEach(key => {
            if (key && (key.startsWith('bl4ut0_bl4ut0_') || key.startsWith('desktop_pos_bl4ut0_') || legacy.has(key))) storage.removeItem(key);
        });
    };
    window.resetPublicLocalState();
    window.resetPublicLocalState(window.sessionStorage);

    // Load initial values from storage if available
    if (window.Storage) {
        let hasPersonalProfile = false;
        try {
            const profile = JSON.parse(window.Storage.local.get("bl4ut0_private_user_profile") || "null");
            hasPersonalProfile = !!(profile && (profile.name || profile.email) && profile.avatar);
        } catch (error) {}
        const selectedUser = window.Storage.local.get("bl4ut0CurrentUser");
        let profiles = {};
        try { profiles = JSON.parse(window.Storage.local.get("bl4ut0_private_profiles") || "{}"); } catch (error) {}
        const selectedProfile = profiles?.[selectedUser];
        const userId = selectedProfile?.sub && selectedProfile?.email && /^private_[a-zA-Z0-9_-]+$/.test(selectedUser)
            ? selectedUser : (hasPersonalProfile && selectedUser !== "bl4ut0" ? "private" : "bl4ut0");
        rawState.currentUserId = userId;
        
        const getKey = (k) => `bl4ut0_${userId}_${k}`;
        const getPrefVal = (k, legacyKey, defaultVal) => {
            const scopedKey = getKey(k);
            const val = window.Storage.local.get(scopedKey);
            if (val !== null && val !== undefined) return val;
            
            // Check and migrate legacy key for Owner user
            if (userId === "bl4ut0") {
                const legacyVal = window.Storage.local.get(legacyKey);
                if (legacyVal !== null && legacyVal !== undefined) {
                    window.Storage.local.set(scopedKey, String(legacyVal));
                    return legacyVal;
                }
            }
            return defaultVal;
        };
        
        rawState.wallpaper = getPrefVal("Wallpaper", "bl4ut0Wallpaper", userId === "bl4ut0" ? "aurora" : "ember");
        rawState.volume = Number(getPrefVal("Volume", "bl4ut0Volume", 70));
        rawState.themeId = getPrefVal("ThemeId", "bl4ut0ThemeId", "dark");
        rawState.themePrimary = getPrefVal("ThemePrimary", "bl4ut0ThemePrimary", null);
        rawState.themeAccent = getPrefVal("ThemeAccent", "bl4ut0ThemeAccent", null);
        rawState.desktopResolution = getPrefVal("DesktopResolution", "bl4ut0DesktopResolution", "auto");
        rawState.screensaver = getPrefVal("Screensaver", "bl4ut0Screensaver", "none");
        rawState.screensaverDelay = Number(getPrefVal("ScreensaverDelay", "bl4ut0ScreensaverDelay", 5));
    }

    window.state = new Proxy(rawState, {
        set(target, key, value) {
            if (target[key] === value) return true;
            const oldValue = target[key];
            target[key] = value;
            
            if (window.EventBus) {
                window.EventBus.emit(`state:changed:${key}`, { newValue: value, oldValue });
                window.EventBus.emit('state:changed', { key, newValue: value, oldValue });
            }
            return true;
        }
    });
})();
