/**
 * PortfoliOS: Modular Application Loader
 * Dynamically loads and unloads stylesheets and scripts for application extensions.
 */

window.appRegistry = window.appRegistry || {};
window.modularApps = window.modularApps || [];
window.appAssetVersion = "1.0.100";
window.appLoadPromises = window.appLoadPromises || {};
window.appLoadErrors = window.appLoadErrors || {};

window.isModularApp = function(appId) {
    return Array.isArray(window.modularApps) && window.modularApps.includes(appId);
};

function loadAppStylesheet(appId) {
    const existing = document.getElementById(`app-style-${appId}`);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.id = `app-style-${appId}`;
        link.rel = "stylesheet";
        link.href = `apps/${appId}/app.css?v=${window.appAssetVersion}`;
        link.onload = () => resolve(link);
        link.onerror = () => reject(new Error(`Failed to load stylesheet for app "${appId}".`));
        document.head.appendChild(link);
    });
}

function loadAppScript(appId) {
    const staleScript = document.getElementById(`app-script-${appId}`);
    if (staleScript) staleScript.remove();

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.id = `app-script-${appId}`;
        script.src = `apps/${appId}/app.js?v=${window.appAssetVersion}`;
        script.onload = () => resolve(script);
        script.onerror = () => reject(new Error(`Failed to load script for app "${appId}".`));
        document.head.appendChild(script);
    });
}

function removeAppAssets(appId) {
    document.getElementById(`app-script-${appId}`)?.remove();
    document.getElementById(`app-style-${appId}`)?.remove();
    delete window.appRegistry[appId];
}

window.ensureAppLoaded = async function(appId) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(String(appId || ""))) {
        throw new Error(`Invalid modular app ID: "${appId}".`);
    }
    if (!window.isModularApp(appId)) {
        throw new Error(`App "${appId}" is not declared as modular in data/apps.js.`);
    }
    if (window.appRegistry[appId]) {
        if (!window.validateAppRegistration?.(appId)) {
            const error = new Error(`App "${appId}" failed registration validation.`);
            removeAppAssets(appId);
            window.appLoadErrors[appId] = error;
            throw error;
        }
        return window.appRegistry[appId];
    }
    if (window.appLoadPromises[appId]) return window.appLoadPromises[appId];

    delete window.appLoadErrors[appId];
    const loadPromise = Promise.allSettled([
        loadAppStylesheet(appId),
        loadAppScript(appId)
    ]).then((results) => {
        const rejected = results.find((result) => result.status === "rejected");
        if (rejected) throw rejected.reason;

        const app = window.appRegistry[appId];
        if (!app) {
            throw new Error(`App "${appId}" loaded without registering window.appRegistry.${appId}.`);
        }
        if (!window.validateAppRegistration?.(appId, app)) {
            throw new Error(`App "${appId}" failed registration validation.`);
        }
        return app;
    }).catch((error) => {
        removeAppAssets(appId);
        window.appLoadErrors[appId] = error;
        throw error;
    }).finally(() => {
        if (window.appLoadPromises[appId] === loadPromise) {
            delete window.appLoadPromises[appId];
        }
    });

    window.appLoadPromises[appId] = loadPromise;
    return loadPromise;
};
