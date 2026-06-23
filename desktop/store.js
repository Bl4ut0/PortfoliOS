/**
 * PortfoliOS: Application Store
 * Manages rendering the app store catalog, categories, app installation progress emulation, and uninstallation.
 */

window.renderStore = () => {
    const contentEl = window.byId ? window.byId("store-content") : document.getElementById("store-content");
    if (!contentEl) return;

    if (!state.installingApps) state.installingApps = {};
    const activeCategory = state.storeCategory || "all";
    const storeApps = window.storeApps || [];
    const storeCategories = window.storeCategories || [];
    
    const visibleApps = storeApps.filter((app) => {
        if (activeCategory === "all") return true;
        return app.category.toLowerCase() === activeCategory;
    });

    const categoryHtml = storeCategories.map((category) => {
        const count = category.id === "all"
            ? storeApps.length
            : storeApps.filter((app) => app.category.toLowerCase() === category.id).length;
        return `
            <button type="button" class="store-category ${activeCategory === category.id ? "active" : ""}"
                data-store-category="${category.id}">
                <i class="${category.icon}"></i>
                <span>${category.label}</span>
                <b>${count}</b>
            </button>
        `;
    }).join("");

    const cardsHtml = visibleApps.map((app) => {
        const installed = window.isAppInstalled ? window.isAppInstalled(app.id) : false;
        const installingProgress = state.installingApps[app.id];
        const isInstalling = installingProgress !== undefined;
        const installable = app.installable !== false;

        let actionButtonHtml = "";
        if (isInstalling) {
            actionButtonHtml = `
                <div class="store-progress-container">
                    <span class="store-progress-label" data-progress-text="${app.id}">Installing (${installingProgress}%)...</span>
                    <div class="store-progress-track">
                        <div class="store-progress-bar" data-progress-bar="${app.id}" style="width: ${installingProgress}%"></div>
                    </div>
                </div>
            `;
        } else if (!installable && app.bookmarkId) {
            actionButtonHtml = `
                <button type="button" class="store-btn open" data-open-store-bookmark="${app.bookmarkId}">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
                </button>
            `;
        } else if (installed) {
            actionButtonHtml = `
                <button type="button" class="store-btn launch" data-open-app="${app.id}">
                    <i class="fa-solid fa-play"></i> Launch
                </button>
                <button type="button" class="store-btn uninstall" data-uninstall-store-app="${app.id}">
                    <i class="fa-solid fa-trash-can"></i> Uninstall
                </button>
            `;
        } else {
            actionButtonHtml = `
                <button type="button" class="store-btn install" data-install-store-app="${app.id}">
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
                        <h3>${app.title}</h3>
                        <span>${app.category}</span>
                    </div>
                </div>
                <p class="store-app-card-desc">${app.description}</p>
                <div class="store-app-card-footer">
                    <div class="store-app-card-meta">
                        <div>${installable ? "Size" : "Mode"}: ${app.size}</div>
                        <div>${app.publisher}</div>
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
        <div class="store-body">
            <aside class="store-category-list" aria-label="Store categories">
                ${categoryHtml}
            </aside>
            <div class="store-app-list">
                ${cardsHtml || `
                    <div class="store-empty">
                        <i class="fa-solid fa-box-open"></i>
                        <span>No apps in this category yet.</span>
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

            let list = ["doomsource"];
            if (window.Storage) {
                const saved = window.Storage.local.get("bl4ut0_installed_apps");
                list = saved ? JSON.parse(saved) : ["doomsource"];
                if (!list.includes(id)) list.push(id);
                window.Storage.local.set("bl4ut0_installed_apps", JSON.stringify(list));
            } else {
                const saved = localStorage.getItem("bl4ut0_installed_apps");
                list = saved ? JSON.parse(saved) : ["doomsource"];
                if (!list.includes(id)) list.push(id);
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
    let list = ["doomsource"];
    if (window.Storage) {
        const saved = window.Storage.local.get("bl4ut0_installed_apps");
        list = saved ? JSON.parse(saved) : ["doomsource"];
        list = list.filter((item) => item !== id);
        window.Storage.local.set("bl4ut0_installed_apps", JSON.stringify(list));
    } else {
        const saved = localStorage.getItem("bl4ut0_installed_apps");
        list = saved ? JSON.parse(saved) : ["doomsource"];
        list = list.filter((item) => item !== id);
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
