/**
 * PortfoliOS: Application Store
 * Manages rendering the app store catalog, categories, app installation progress emulation, and uninstallation.
 */

window.renderStore = () => {
    const contentEl = window.byId ? window.byId("store-content") : document.getElementById("store-content");
    if (!contentEl) return;

    if (!state.installingApps) state.installingApps = {};
    const activeCategory = state.storeCategory || "all";
    const activeInstallFilter = state.storeInstallFilter || "all";
    const storeApps = window.storeApps || [];
    const storeCategories = window.storeCategories || [];
    const escapeHtml = window.escapeHtml || ((value) => String(value ?? ""));
    const normalizedInstallFilter = ["all", "installed", "not-installed"].includes(activeInstallFilter)
        ? activeInstallFilter
        : "all";

    const isInstalled = (app) => window.isStoreAppInstalled
        ? window.isStoreAppInstalled(app.id)
        : (window.getInstalledStoreAppIds ? window.getInstalledStoreAppIds().includes(app.id) : false);

    const matchesInstallFilter = (app) => {
        const installed = isInstalled(app);
        if (normalizedInstallFilter === "installed") return installed;
        if (normalizedInstallFilter === "not-installed") return !installed;
        return true;
    };

    const appsMatchingInstallFilter = storeApps.filter(matchesInstallFilter);

    const visibleApps = storeApps.filter((app) => {
        if (activeCategory === "all") return true;
        return app.category.toLowerCase() === activeCategory;
    }).filter(matchesInstallFilter);

    const installFilters = [
        { id: "all", label: "All", icon: "fa-solid fa-border-all" },
        { id: "installed", label: "Installed", icon: "fa-solid fa-circle-check" },
        { id: "not-installed", label: "Not Installed", icon: "fa-solid fa-cloud-arrow-down" }
    ];

    const installFilterHtml = installFilters.map((filter) => {
        const count = storeApps.filter((app) => {
            if (filter.id === "installed") return isInstalled(app);
            if (filter.id === "not-installed") return !isInstalled(app);
            return true;
        }).length;
        return `
            <button type="button" class="store-filter ${normalizedInstallFilter === filter.id ? "is-active" : ""}"
                data-store-install-filter="${escapeHtml(filter.id)}"
                aria-pressed="${normalizedInstallFilter === filter.id ? "true" : "false"}">
                <i class="${escapeHtml(filter.icon)}"></i>
                <span>${escapeHtml(filter.label)}</span>
                <b>${count}</b>
            </button>
        `;
    }).join("");

    const categoryHtml = storeCategories.map((category) => {
        const count = category.id === "all"
            ? appsMatchingInstallFilter.length
            : appsMatchingInstallFilter.filter((app) => app.category.toLowerCase() === category.id).length;
        const categoryId = escapeHtml(category.id);
        return `
            <button type="button" class="store-category ${activeCategory === category.id ? "is-active" : ""}"
                data-store-category="${categoryId}"
                aria-pressed="${activeCategory === category.id ? "true" : "false"}">
                <i class="${escapeHtml(category.icon)}"></i>
                <span>${escapeHtml(category.label)}</span>
                <b>${count}</b>
            </button>
        `;
    }).join("");

    const cardsHtml = visibleApps.map((app) => {
        const installed = isInstalled(app);
        const installingProgress = state.installingApps[app.id];
        const isInstalling = installingProgress !== undefined;
        const installable = app.installable !== false;
        const stateLabel = !installable ? "Hosted" : installed ? "Installed" : "Not installed";
        const appId = escapeHtml(app.id);
        const title = escapeHtml(app.title);
        const category = escapeHtml(app.category);
        const description = escapeHtml(app.description);
        const size = escapeHtml(app.size);
        const publisher = escapeHtml(app.publisher);

        let actionButtonHtml = "";
        if (isInstalling) {
            actionButtonHtml = `
                <div class="store-progress-container">
                    <span class="store-progress-label" data-progress-text="${appId}">Installing (${installingProgress}%)...</span>
                    <div class="store-progress-track">
                        <div class="store-progress-bar" data-progress-bar="${appId}" style="width: ${installingProgress}%"></div>
                    </div>
                </div>
            `;
        } else if (!installable && app.bookmarkId) {
            actionButtonHtml = `
                <button type="button" class="store-btn open" data-open-store-bookmark="${escapeHtml(app.bookmarkId)}">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
                </button>
            `;
        } else if (installed) {
            actionButtonHtml = `
                <button type="button" class="store-btn launch" data-open-app="${appId}">
                    <i class="fa-solid fa-play"></i> Launch
                </button>
                <button type="button" class="store-btn uninstall" data-uninstall-store-app="${appId}">
                    <i class="fa-solid fa-trash-can"></i> Uninstall
                </button>
            `;
        } else {
            actionButtonHtml = `
                <button type="button" class="store-btn install" data-install-store-app="${appId}">
                    <i class="fa-solid fa-download"></i> Install
                </button>
            `;
        }

        return `
            <div class="store-app-card">
                <div class="store-app-card-header">
                    <div class="store-app-card-icon">
                        ${window.getAppIconHtml(app.icon)}
                    </div>
                    <div class="store-app-card-info">
                        <h3>${title}</h3>
                        <span>${category}</span>
                    </div>
                    <b class="store-app-state">${escapeHtml(stateLabel)}</b>
                </div>
                <p class="store-app-card-desc">${description}</p>
                <div class="store-app-card-footer">
                    <div class="store-app-card-meta">
                        <div>${installable ? "Size" : "Mode"}: ${size}</div>
                        <div>${publisher}</div>
                    </div>
                    <div class="store-app-card-action-container">
                        ${actionButtonHtml}
                    </div>
                </div>
            </div>
        `;
    }).join("");

    contentEl.innerHTML = `
        <div class="store-hero">
            <i class="fa-solid fa-shop store-hero-icon"></i>
            <div class="store-hero-text">
                <h2>PortfoliOS App Store</h2>
                <p>Install games, launch hosted services, and stage future productivity apps.</p>
            </div>
        </div>
        <div class="store-toolbar" aria-label="Store install filters">
            ${installFilterHtml}
        </div>
        <div class="store-body">
            <aside class="store-category-list" aria-label="Store categories">
                ${categoryHtml}
            </aside>
            <div class="store-app-list">
                ${cardsHtml || `
                    <div class="store-empty">
                        <i class="fa-solid fa-box-open"></i>
                        <span>No apps match this filter yet.</span>
                    </div>
                `}
            </div>
        </div>
    `;
};

window.installApp = (id) => {
    if (!state.installingApps) state.installingApps = {};
    if (state.installingApps[id] !== undefined) return;

    state.installingApps[id] = 0;
    window.renderStore();

    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        state.installingApps[id] = progress;
        
        const progressEl = document.querySelector(`[data-progress-bar="${id}"]`);
        if (progressEl) {
            progressEl.style.width = `${progress}%`;
        }
        const textEl = document.querySelector(`[data-progress-text="${id}"]`);
        if (textEl) {
            textEl.textContent = `Installing (${progress}%)...`;
        }

        if (progress >= 100) {
            clearInterval(interval);
            delete state.installingApps[id];

            const list = window.getInstalledStoreAppIds ? window.getInstalledStoreAppIds() : [];
            if (!list.includes(id)) list.push(id);
            if (window.setInstalledStoreAppIds) {
                window.setInstalledStoreAppIds(list);
            } else if (window.Storage) {
                window.Storage.local.set("bl4ut0_installed_apps", JSON.stringify(list));
            } else {
                localStorage.setItem("bl4ut0_installed_apps", JSON.stringify(list));
            }

            if (window.modularApps && window.modularApps.includes(id) && window.ensureAppLoaded) {
                window.ensureAppLoaded(id);
            }

            if (window.EventBus) window.EventBus.emit("app:installed", id);
            
            // Re-render everything
            if (window.renderDesktopIcons) window.renderDesktopIcons();
            if (window.renderStartMenu) window.renderStartMenu();
            if (window.renderTaskbar) window.renderTaskbar();
            window.renderStore();
            
            const storeApps = window.storeApps || [];
            const app = storeApps.find(a => a.id === id);
            if (window.showDesktopToast) window.showDesktopToast(`${app ? app.title : id} installed successfully.`);
        }
    }, 150);
};

window.uninstallApp = (id) => {
    const list = (window.getInstalledStoreAppIds ? window.getInstalledStoreAppIds() : []).filter((item) => item !== id);
    if (window.setInstalledStoreAppIds) {
        window.setInstalledStoreAppIds(list);
    } else if (window.Storage) {
        window.Storage.local.set("bl4ut0_installed_apps", JSON.stringify(list));
    } else {
        localStorage.setItem("bl4ut0_installed_apps", JSON.stringify(list));
    }

    if (state.openApps.has(id) && window.closeDesktopWindow) {
        window.closeDesktopWindow(id);
    }

    if (window.EventBus) window.EventBus.emit("app:uninstalled", id);

    // Re-render everything
    if (window.renderDesktopIcons) window.renderDesktopIcons();
    if (window.renderStartMenu) window.renderStartMenu();
    if (window.renderTaskbar) window.renderTaskbar();
    window.renderStore();
    
    const storeApps = window.storeApps || [];
    const app = storeApps.find(a => a.id === id);
    if (window.showDesktopToast) window.showDesktopToast(`${app ? app.title : id} uninstalled.`);
};
