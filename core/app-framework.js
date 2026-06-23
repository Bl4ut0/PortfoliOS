/**
 * PortfoliOS: App Framework Helpers
 * Shared contracts for modular app registration, lifecycle hooks, iframe messaging,
 * teardown, and audio integration.
 */
(function() {
    const requiredFields = ["title", "icon", "windowClass", "renderBody"];
    const lifecycleHooks = ["onOpen", "onClose", "onMinimize", "onMaximize"];
    const audioAdapters = new Map();

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getIframeTargetOrigin(iframe) {
        if (!iframe) return window.location.origin;
        const rawSrc = iframe.dataset?.src || iframe.getAttribute("src") || iframe.src || "";
        if (!rawSrc || rawSrc === "about:blank") return window.location.origin;

        try {
            return new URL(rawSrc, window.location.href).origin;
        } catch (error) {
            console.warn("PortfoliOS: Could not resolve iframe target origin.", error);
            return window.location.origin;
        }
    }

    function postMessageToIframe(iframe, message) {
        if (!iframe?.contentWindow) return false;
        try {
            iframe.contentWindow.postMessage(message, getIframeTargetOrigin(iframe));
            return true;
        } catch (error) {
            console.warn("PortfoliOS: Failed to post message to iframe.", error);
            return false;
        }
    }

    function validateAppRegistration(appId, app = window.appRegistry?.[appId]) {
        if (!app || typeof app !== "object") {
            console.error(`PortfoliOS: App "${appId}" did not register an app object.`);
            return false;
        }

        const missing = requiredFields.filter((field) => !app[field]);
        if (missing.length) {
            console.error(`PortfoliOS: App "${appId}" is missing required field(s): ${missing.join(", ")}.`);
            return false;
        }

        if (typeof app.renderBody !== "function") {
            console.error(`PortfoliOS: App "${appId}" renderBody must be a function.`);
            return false;
        }

        const invalidHooks = lifecycleHooks.filter((hook) => app[hook] && typeof app[hook] !== "function");
        if (invalidHooks.length) {
            console.error(`PortfoliOS: App "${appId}" has invalid hook(s): ${invalidHooks.join(", ")}.`);
            return false;
        }

        return true;
    }

    function runAppLifecycleHook(appId, hookName, windowEl, options = {}) {
        const app = window.appRegistry?.[appId];
        const hook = app?.[hookName];
        if (typeof hook !== "function") return Promise.resolve();

        try {
            return Promise.resolve(hook(windowEl)).catch((error) => {
                console.error(`PortfoliOS: ${appId}.${hookName} failed.`, error);
                if (options.rethrow) throw error;
            });
        } catch (error) {
            console.error(`PortfoliOS: ${appId}.${hookName} failed.`, error);
            return options.rethrow ? Promise.reject(error) : Promise.resolve();
        }
    }

    function unloadModularApp(appId) {
        const selectorId = window.CSS?.escape
            ? CSS.escape(appId)
            : String(appId).replace(/"/g, "\\\"");
        const windowEl = document.querySelector(`[data-window="${selectorId}"]`);
        const scriptEl = document.getElementById(`app-script-${appId}`);
        const styleEl = document.getElementById(`app-style-${appId}`);

        if (windowEl) windowEl.remove();
        if (scriptEl) scriptEl.remove();
        if (styleEl) styleEl.remove();
        if (window.appRegistry) delete window.appRegistry[appId];
        if (window.appLoadPromises) delete window.appLoadPromises[appId];
        audioAdapters.delete(appId);
    }

    function getDesktopVolume() {
        const rawVolume = window.state?.volume;
        return Math.max(0, Math.min(100, Number(rawVolume ?? 70) || 0));
    }

    function applyAudioAdapter(appId, volume = getDesktopVolume()) {
        const adapter = audioAdapters.get(appId);
        if (!adapter) return;

        try {
            if (typeof adapter === "function") {
                adapter(volume);
                return;
            }
            if (typeof adapter.setVolume === "function") {
                adapter.setVolume(volume);
            }
        } catch (error) {
            console.warn(`PortfoliOS: Audio adapter for "${appId}" failed.`, error);
        }
    }

    function applyVolumeToRegisteredApps(volume = getDesktopVolume()) {
        audioAdapters.forEach((adapter, appId) => applyAudioAdapter(appId, volume));
    }

    function registerAudioAdapter(appId, adapter) {
        if (!appId || !adapter) return () => {};
        audioAdapters.set(appId, adapter);
        applyAudioAdapter(appId);
        return () => {
            if (audioAdapters.get(appId) === adapter) {
                audioAdapters.delete(appId);
            }
        };
    }

    window.PortfolioOSAppFramework = {
        requiredFields,
        lifecycleHooks,
        escapeHtml,
        getIframeTargetOrigin,
        postMessageToIframe,
        validateAppRegistration,
        runAppLifecycleHook,
        unloadModularApp,
        registerAudioAdapter,
        applyVolumeToRegisteredApps,
        getDesktopVolume
    };

    window.escapeHtml = window.escapeHtml || escapeHtml;
    window.getIframeTargetOrigin = getIframeTargetOrigin;
    window.postMessageToIframe = postMessageToIframe;
    window.validateAppRegistration = validateAppRegistration;
    window.runAppLifecycleHook = runAppLifecycleHook;
    window.unloadModularApp = unloadModularApp;
    window.registerAppAudioAdapter = registerAudioAdapter;
})();
