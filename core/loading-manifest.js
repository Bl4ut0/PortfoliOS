/** Release-scoped loading graph. Safe in both the page and service worker. */
(function (root) {
    const release = "2026.10.10.3";
    const shared = [
        "core/event-bus.js", "core/storage.js", "core/state.js", "core/utils.js",
        "core/filesystem.js", "core/security-service.js", "data/systems.js", "data/apps.js",
        "data/config.js", "data/users.js", "core/preferences.js", "core/gdrive-sync.js",
        "core/background-services.js", "core/session-context.js", "core/profile-switch.js", "core/session-chooser.js"
    ];
    root.PortfolioLoadingManifest = {
        release, shared,
        shells: {
            desktop: {
                styles: ["styles/layout.css", "styles/windows.css", "styles/desktop.css", "styles/components.css", "styles/navigation.css"],
                scripts: ["core/app-framework.js", "core/app-loader.js", "core/window-manager.js", "data/bookmarks.js",
                    "desktop/taskbar.js", "desktop/start-menu.js", "desktop/desktop-icons.js", "desktop/context-menu.js",
                    "desktop/calendar.js", "desktop/canvas-bg.js", "desktop/matrix-rain.js", "desktop/shell.js"]
            },
            mobile: {
                styles: ["styles/layout.css", "styles/navigation.css", "styles/mobile.css"],
                scripts: ["mobile/app-framework.js", "data/mobile-apps.js", "data/mobile-home.js",
                    "mobile/app-loader.js", "mobile/home.js", "mobile/shell.js"]
            },
            quick: {
                styles: ["styles/layout.css", "styles/quick.css", "styles/components.css", "styles/navigation.css"],
                scripts: ["desktop/dossier.js", "quick/shell.js"]
            }
        },
        services: {
            ai: ["core/local-ai.js", "core/simple-brain.js"],
            media: ["core/file-intents.js", "core/media-service.js"],
            games: ["apps/_shared/iframe-game.js"],
            browser: ["data/bookmarks.js", "core/browser-workspace.js"]
        },
        desktopApps: {
            cli: ["@ai", "desktop/terminal.js", "desktop/brain-helper.js"],
            "local-ai": ["@ai", "desktop/brain-helper.js"],
            settings: ["@ai", "desktop/settings.js", "desktop/brain-helper.js"],
            dossier: ["desktop/dossier.js"], network: ["desktop/network-map.js"],
            linux: ["desktop/linux.js"], browser: ["@browser", "desktop/browser.js"], store: ["desktop/store.js"],
            files: ["@media"], musicmini: ["@media"],
            doomsource: ["@games", "desktop/wad-inspector.js"],
            duke32: ["@games"], diablo: ["@games"], quake: ["@games"],
            openrct2: ["@games"], ut99: ["@games"], romplayer: ["@games"]
        },
        mobileApps: {
            browser: ["@browser"],
            "local-ai": ["@ai"], music: ["@media"], files: ["@media"], documents: ["@media"], media: ["@media"]
        }
    };
})(globalThis);
