/**
 * PortfoliOS: Modular Application Loader
 * Dynamically loads and unloads stylesheets and scripts for application extensions.
 */

window.appRegistry = window.appRegistry || {};
window.modularApps = window.modularApps || ["doomsource", "duke32", "diablo", "quake", "files", "webamp", "taskmgr"];
window.appAssetVersion = "1.0.33";
window.appLoadPromises = window.appLoadPromises || {};

window.ensureAppLoaded = async function(appId) {
    if (!window.modularApps.includes(appId)) return;
    if (window.appRegistry[appId]) {
        window.validateAppRegistration?.(appId);
        return;
    }
    if (window.appLoadPromises[appId]) return window.appLoadPromises[appId];
    
    if (!document.getElementById(`app-style-${appId}`)) {
        const link = document.createElement("link");
        link.id = `app-style-${appId}`;
        link.rel = "stylesheet";
        link.href = `apps/${appId}/app.css?v=${window.appAssetVersion}`;
        link.onerror = () => console.error(`Failed to load stylesheet for app: ${appId}`);
        document.head.appendChild(link);
    }
    
    if (!document.getElementById(`app-script-${appId}`)) {
        window.appLoadPromises[appId] = new Promise((resolve) => {
            const script = document.createElement("script");
            const finish = () => {
                delete window.appLoadPromises[appId];
                if (window.appRegistry[appId]) {
                    window.validateAppRegistration?.(appId);
                } else {
                    console.error(`PortfoliOS: App "${appId}" loaded without registering itself.`);
                    script.remove();
                }
                resolve();
            };
            script.id = `app-script-${appId}`;
            script.src = `apps/${appId}/app.js?v=${window.appAssetVersion}`;
            script.onload = finish;
            script.onerror = () => {
                console.error(`Failed to load script for app: ${appId}`);
                finish();
            };
            document.head.appendChild(script);
        });
        return window.appLoadPromises[appId];
    }

    window.validateAppRegistration?.(appId);
};
