/**
 * PortfoliOS Mobile application framework.
 * This registry and lifecycle are deliberately independent from the desktop app framework.
 */
(function() {
    const lifecycleHooks = ["onOpen", "onResume", "onPause", "onBack", "onIntent", "serializeState", "restoreState", "onClose"];
    const idPattern = /^[a-z0-9][a-z0-9-]*$/;

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function validateMobileAppRegistration(appId, app = window.mobileAppRegistry?.[appId]) {
        if (!idPattern.test(String(appId || "")) || !app || typeof app !== "object") return false;
        if (typeof app.title !== "string" || !app.title.trim()) return false;
        if (typeof app.icon !== "string" || !app.icon.trim()) return false;
        if (typeof app.viewClass !== "string" || !/^mobile-[a-z0-9-]+-app$/.test(app.viewClass)) return false;
        if (typeof app.render !== "function") return false;
        return lifecycleHooks.every((hook) => app[hook] == null || typeof app[hook] === "function");
    }

    async function runMobileAppLifecycle(appId, hookName, root, context = {}) {
        const hook = window.mobileAppRegistry?.[appId]?.[hookName];
        if (typeof hook !== "function") return undefined;
        try {
            return await hook(root, context);
        } catch (error) {
            console.error(`PortfoliOS Mobile: ${appId}.${hookName} failed.`, error);
            return undefined;
        }
    }

    function getMobileCatalogApp(appId) {
        return (window.mobileAppCatalog || []).find((app) => app.id === appId) || null;
    }

    function getMobileSystem(sourceId) {
        const item = window.systemById?.(sourceId)
            || (window.systems || []).find((system) => system.id === sourceId);
        if (!item) throw new Error(`Missing mobile source record "${sourceId}".`);
        return item;
    }

    function renderMobileProjectCard(sourceId, options = {}) {
        const item = getMobileSystem(sourceId);
        const links = (item.links || []).map(([label, href, icon]) => `
            <a class="mobile-native-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">
                <i class="${escapeHtml(icon)}"></i>
                <span>${escapeHtml(label)}</span>
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
        `).join("");
        return `
            <header class="mobile-native-hero">
                <span class="mobile-native-hero-icon"><i class="${escapeHtml(item.icon)}"></i></span>
                <div>
                    <p>${escapeHtml(options.eyebrow || item.type)}</p>
                    <h2>${escapeHtml(options.heading || item.title)}</h2>
                    <span class="mobile-native-status">${escapeHtml(item.status)}</span>
                </div>
            </header>
            <p class="mobile-native-summary">${escapeHtml(item.summary)}</p>
            <section class="mobile-native-section">
                <h3>${escapeHtml(options.signalLabel || "Current signal")}</h3>
                <p>${escapeHtml(item.signal)}</p>
            </section>
            <section class="mobile-native-section">
                <h3>Stack</h3>
                <div class="mobile-native-tags">${(item.tech || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
            </section>
            <nav class="mobile-native-links" aria-label="${escapeHtml(item.title)} links">
                ${links || '<span class="mobile-native-empty">No public route yet.</span>'}
            </nav>
        `;
    }

    function unloadMobileApp(appId) {
        document.getElementById(`mobile-app-script-${appId}`)?.remove();
        document.getElementById(`mobile-app-style-${appId}`)?.remove();
        delete window.mobileAppRegistry?.[appId];
        delete window.mobileAppLoadPromises?.[appId];
    }

    window.mobileAppRegistry = window.mobileAppRegistry || {};
    window.PortfolioOSMobileFramework = {
        lifecycleHooks,
        escapeHtml,
        getMobileCatalogApp,
        validateMobileAppRegistration,
        runMobileAppLifecycle,
        renderMobileProjectCard,
        unloadMobileApp
    };
    window.validateMobileAppRegistration = validateMobileAppRegistration;
    window.runMobileAppLifecycle = runMobileAppLifecycle;
    window.renderMobileProjectCard = renderMobileProjectCard;
    window.getMobileCatalogApp = getMobileCatalogApp;
    window.unloadMobileApp = unloadMobileApp;
})();
