/** PortfoliOS Mobile: lazy loader for mobile-only app modules. */
(function() {
    const assetVersion = "1.2.2";
    window.mobileAppLoadPromises = window.mobileAppLoadPromises || {};

    function isMobileApp(appId) {
        return Array.isArray(window.mobileAppIds) && window.mobileAppIds.includes(appId);
    }

    function loadStyle(appId) {
        return new Promise((resolve, reject) => {
            const link = document.createElement("link");
            link.id = `mobile-app-style-${appId}`;
            link.rel = "stylesheet";
            link.href = `mobile/apps/${appId}/app.css?v=${assetVersion}`;
            link.onload = () => resolve(link);
            link.onerror = () => reject(new Error(`Failed to load mobile stylesheet "${appId}".`));
            document.head.appendChild(link);
        });
    }

    function loadScript(appId) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.id = `mobile-app-script-${appId}`;
            script.src = `mobile/apps/${appId}/app.js?v=${assetVersion}`;
            script.onload = () => resolve(script);
            script.onerror = () => reject(new Error(`Failed to load mobile module "${appId}".`));
            document.head.appendChild(script);
        });
    }

    window.ensureMobileAppLoaded = async (appId) => {
        if (!isMobileApp(appId)) throw new Error(`Unknown mobile app "${appId}".`);
        if (window.mobileAppRegistry?.[appId]) return window.mobileAppRegistry[appId];
        if (window.mobileAppLoadPromises[appId]) return window.mobileAppLoadPromises[appId];

        const promise = Promise.all([loadStyle(appId), loadScript(appId)])
            .then(() => {
                const app = window.mobileAppRegistry?.[appId];
                if (!window.validateMobileAppRegistration?.(appId, app)) {
                    throw new Error(`Mobile app "${appId}" failed registration validation.`);
                }
                return app;
            })
            .catch((error) => {
                window.unloadMobileApp?.(appId);
                throw error;
            })
            .finally(() => {
                delete window.mobileAppLoadPromises[appId];
            });
        window.mobileAppLoadPromises[appId] = promise;
        return promise;
    };
})();
