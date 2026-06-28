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
        rawState.currentUserId = window.Storage.local.get("bl4ut0CurrentUser") || "bl4ut0";
        rawState.wallpaper = window.Storage.local.get("bl4ut0Wallpaper") || "aurora";
        rawState.volume = Number(window.Storage.local.get("bl4ut0Volume") || 70);
        rawState.themeId = window.Storage.local.get("bl4ut0ThemeId") || "dark";
        rawState.themePrimary = window.Storage.local.get("bl4ut0ThemePrimary");
        rawState.themeAccent = window.Storage.local.get("bl4ut0ThemeAccent");
        rawState.desktopResolution = window.Storage.local.get("bl4ut0DesktopResolution") || "auto";
        rawState.screensaver = window.Storage.local.get("bl4ut0Screensaver") || "none";
        rawState.screensaverDelay = Number(window.Storage.local.get("bl4ut0ScreensaverDelay") || 5);
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
