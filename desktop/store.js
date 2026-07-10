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

const GAME_INSTALL_CONFIGS = {
    ut99: {
        totalSize: 13800000,
        files: [
            { path: "/apps/ut99/runtime/index.html", url: "/apps/ut99/runtime/index.php/index.html", type: "text/html" },
            { path: "/apps/ut99/runtime/index.js", url: "/apps/ut99/runtime/index.php/index.js", type: "text/javascript" },
            { path: "/apps/ut99/runtime/index.wasm", url: "/apps/ut99/runtime/index.php/index.wasm", type: "application/wasm" },
            { path: "/apps/ut99/runtime/index.data", url: "/apps/ut99/runtime/index.php/index.data", type: "application/octet-stream" }
        ]
    },
    doomsource: {
        totalSize: 13800000,
        files: [
            { path: "/apps/doomsource/doom.js", url: "/doom.js?v=1.0.27", type: "text/javascript" },
            { path: "/apps/doomsource/doom.wasm", url: "/doom.wasm?v=1.0.27", type: "application/wasm" },
            { path: "/apps/doomsource/DOOM.WAD", url: "/DOOM.WAD", type: "application/octet-stream" }
        ]
    },
    duke32: {
        totalSize: 16100000,
        files: [
            { path: "/apps/duke32/index.html", url: "/duke32/index.html?v=1.0.25", type: "text/html" },
            { path: "/apps/duke32/duke3d.zip", url: "/duke32/duke3d.zip", type: "application/zip" }
        ]
    },
    quake: {
        totalSize: 18800000,
        files: [
            { path: "/apps/quake/index.html", url: "/quake/index.html?v=1.0.22", type: "text/html" },
            { path: "/apps/quake/id1/pak0.pak", url: "/quake/id1/pak0.pak", type: "application/octet-stream" },
            ...["CDAudio.js", "Chase.js", "CL.js", "Cmd.js", "COM.js", "Console.js", "CRC.js", "Cvar.js", "Def.js", "Draw.js", "ED.js", "GL.js", "Host.js", "IN.js", "Key.js", "M.js", "Mod.js", "MSG.js", "NET.js", "NET_Loop.js", "NET_WEBS.js", "PF.js", "PR.js", "Protocol.js", "Q.js", "R.js", "S.js", "Sbar.js", "SCR.js", "SV.js", "Sys.js", "SZ.js", "V.js", "Vec.js", "VID.js", "W.js"].map(name => ({
                path: `/apps/quake/WebQuake/${name}`,
                url: `/quake/WebQuake/${name}`,
                type: "text/javascript"
            }))
        ]
    },
    diablo: {
        totalSize: 26600000,
        files: [
            { path: "/apps/diablo/index.html", url: "/diablo/index.html?v=1.0.24", type: "text/html" },
            { path: "/apps/diablo/spawn.mpq", url: "/diablo/spawn.mpq", type: "application/octet-stream" },
            { path: "/apps/diablo/8acc76fdb6ee253c485e.worker.js", url: "/diablo/8acc76fdb6ee253c485e.worker.js", type: "text/javascript" },
            { path: "/apps/diablo/d2271be9a67638d3642f.worker.js", url: "/diablo/d2271be9a67638d3642f.worker.js", type: "text/javascript" },
            { path: "/apps/diablo/storage.html", url: "/diablo/storage.html", type: "text/html" },
            { path: "/apps/diablo/portfolio-diablo-autostart.js", url: "/diablo/portfolio-diablo-autostart.js", type: "text/javascript" },
            { path: "/apps/diablo/static/js/0.aaa06a1e.chunk.js", url: "/diablo/static/js/0.aaa06a1e.chunk.js", type: "text/javascript" },
            { path: "/apps/diablo/static/js/main.0a18bc0c.chunk.js", url: "/diablo/static/js/main.0a18bc0c.chunk.js", type: "text/javascript" }
        ]
    },
    openrct2: {
        totalSize: 76000000,
        files: [
            { path: "/apps/openrct2/runtime/index.html", url: "/apps/openrct2/runtime/index.html?v=1.0.56", type: "text/html" },
            { path: "/apps/openrct2/runtime/index.js", url: "/apps/openrct2/runtime/index.js?v=1.0.56", type: "text/javascript" },
            { path: "/apps/openrct2/runtime/openrct2.zip", url: "/apps/openrct2/runtime/openrct2.zip", type: "application/zip" },
            { path: "/apps/openrct2/runtime/assets.zip", url: "/apps/openrct2/runtime/assets.zip", type: "application/zip" }
        ]
    }
};

const installAppFiles = async (id) => {
    if (!state.installingApps) state.installingApps = {};
    state.installingApps[id] = 0;
    window.renderStore();

    const config = GAME_INSTALL_CONFIGS[id];
    if (!config) {
        runFakeInstall(id);
        return;
    }

    try {
        const totalSize = config.totalSize;
        let loadedBytesMap = {};

        const downloadFileWithProgress = async (fileEntry) => {
            const response = await fetch(fileEntry.url);
            if (!response.ok) throw new Error(`HTTP error ${response.status} for ${fileEntry.url}`);
            
            const contentLength = response.headers.get("content-length");
            const fileTotal = contentLength ? parseInt(contentLength, 10) : 0;
            
            const reader = response.body.getReader();
            const chunks = [];
            let fileLoaded = 0;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                fileLoaded += value.length;
                
                loadedBytesMap[fileEntry.path] = fileLoaded;
                const sumLoaded = Object.values(loadedBytesMap).reduce((a, b) => a + b, 0);
                const percent = Math.round((sumLoaded / totalSize) * 100);
                state.installingApps[id] = Math.max(5, Math.min(95, percent));
                
                const progressEl = document.querySelector(`[data-progress-bar="${id}"]`);
                if (progressEl) progressEl.style.width = `${state.installingApps[id]}%`;
                const textEl = document.querySelector(`[data-progress-text="${id}"]`);
                if (textEl) {
                    textEl.textContent = `Installing (${state.installingApps[id]}%)...`;
                }
            }
            
            const blob = new Blob(chunks, { type: fileEntry.type });
            const arrayBuffer = await blob.arrayBuffer();
            
            if (window.SystemFS) {
                await window.SystemFS.writeFile(
                    fileEntry.path,
                    window.SystemFS.getName(fileEntry.path),
                    window.SystemFS.getParentPath(fileEntry.path),
                    arrayBuffer,
                    arrayBuffer.byteLength,
                    fileEntry.type,
                    false,
                    { silent: true }
                );
            }
        };

        for (const fileEntry of config.files) {
            const textEl = document.querySelector(`[data-progress-text="${id}"]`);
            if (textEl) {
                textEl.textContent = `Downloading ${window.SystemFS.getName(fileEntry.path)}...`;
            }
            await downloadFileWithProgress(fileEntry);
        }

        state.installingApps[id] = 100;
        const progressEl = document.querySelector(`[data-progress-bar="${id}"]`);
        if (progressEl) progressEl.style.width = "100%";
        
        setTimeout(() => {
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

            if (window.EventBus) window.EventBus.emit("app:installed", id);
            if (window.renderDesktopIcons) window.renderDesktopIcons();
            if (window.renderStartMenu) window.renderStartMenu();
            if (window.renderTaskbar) window.renderTaskbar();
            window.renderStore();

            if (window.showDesktopToast) window.showDesktopToast("Installation complete.");
        }, 500);

    } catch (error) {
        console.error(`${id} installation failed:`, error);
        delete state.installingApps[id];
        window.renderStore();
        if (window.showDesktopToast) window.showDesktopToast(`${id} installation failed: ${error.message}`);
    }
};

const runFakeInstall = (id) => {
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

            if (window.EventBus) window.EventBus.emit("app:installed", id);
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

window.installApp = (id) => {
    if (!state.installingApps) state.installingApps = {};
    if (state.installingApps[id] !== undefined) return;

    installAppFiles(id);
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

    const localCleanupDirs = {
        ut99: "/apps/ut99/runtime",
        doomsource: "/apps/doomsource",
        duke32: "/apps/duke32",
        quake: "/apps/quake",
        diablo: "/apps/diablo",
        openrct2: "/apps/openrct2/runtime"
    };

    if (localCleanupDirs[id] && window.SystemFS) {
        window.SystemFS.deleteFileRecursive(localCleanupDirs[id], { silent: true })
            .catch(err => console.error(`Failed to clean up ${id} local files:`, err));
    }

    if (state.openApps.has(id) && window.closeDesktopWindow) {
        window.closeDesktopWindow(id);
    }

    if (window.EventBus) window.EventBus.emit("app:uninstalled", id);

    if (window.renderDesktopIcons) window.renderDesktopIcons();
    if (window.renderStartMenu) window.renderStartMenu();
    if (window.renderTaskbar) window.renderTaskbar();
    window.renderStore();
    
    const storeApps = window.storeApps || [];
    const app = storeApps.find(a => a.id === id);
    if (window.showDesktopToast) window.showDesktopToast(`${app ? app.title : id} uninstalled.`);
};
