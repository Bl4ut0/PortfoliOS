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
        quickActiveId: "overview",
        quickRoute: "overview",
        quickFilter: "all",
        quickSearch: "",
        storeCategory: "all",
        storeInstallFilter: "all",
        cliIntroStarted: false,
        systemStarted: false,
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

    // Load initial values from storage if available
    if (window.Storage) {
        const hasPersonalProfile = localStorage.getItem("bl4ut0_private_user_profile") !== null;
        const userId = hasPersonalProfile ? "private" : "bl4ut0";
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
