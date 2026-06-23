/**
 * PortfoliOS: Modular Application Loader
 * Dynamically loads and unloads stylesheets and scripts for application extensions.
 */

window.appRegistry = {};
window.modularApps = ["doomsource", "duke32", "diablo", "quake", "files", "webamp", "taskmgr"];
window.appAssetVersion = "1.0.30";
window.appLoadPromises = {};

window.ensureAppLoaded = async function(appId) {
    if (!window.modularApps.includes(appId) || window.appRegistry[appId]) return;
    if (window.appLoadPromises[appId]) return window.appLoadPromises[appId];
    
    if (!document.getElementById(`app-style-${appId}`)) {
        const link = document.createElement("link");
        link.id = `app-style-${appId}`;
        link.rel = "stylesheet";
        link.href = `apps/${appId}/app.css?v=${window.appAssetVersion}`;
        document.head.appendChild(link);
    }
    
    if (!document.getElementById(`app-script-${appId}`)) {
        window.appLoadPromises[appId] = new Promise((resolve) => {
            const script = document.createElement("script");
            const finish = () => {
                delete window.appLoadPromises[appId];
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
};
