/**
 * PortfoliOS Mobile launcher.
 *
 * Home pages, the PortfoliOS feed, folders, widgets, the app drawer, and
 * per-user layout persistence live here. App task lifecycle remains in shell.js.
 */
(function() {
    const STORAGE_VERSION = 1;
    let currentUserId = "bl4ut0";
    let catalog = [];
    let layout = null;
    let pageIndex = 0;
    let drawerOpen = false;
    let folderId = null;
    let actionState = null;
    let drawerCategory = "all";
    let drawerQuery = "";
    let returnFocus = null;
    let bound = false;
    let suppressItemClickUntil = 0;

    function dataApi() {
        return window.MobileHomeData;
    }

    function config() {
        return window.mobileHomeConfig || dataApi()?.config || {};
    }

    function storageKey(userId = currentUserId) {
        return `bl4ut0_${userId}_mobile_home_v${STORAGE_VERSION}`;
    }

    function escapeHtml(value) {
        return window.PortfolioOSMobileFramework?.escapeHtml?.(value)
            || String(value ?? "").replace(/[&<>"']/g, (char) => ({
                "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
            })[char]);
    }

    function iconHtml(app) {
        return window.getAppIconHtml?.(app?.icon) || `<i class="${escapeHtml(app?.icon || "fa-solid fa-mobile-screen")}"></i>`;
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function setVisible(element, visible) {
        if (!element) return;
        element.hidden = !visible;
        element.inert = !visible;
        element.classList.toggle("is-hidden", !visible);
        element.setAttribute("aria-hidden", visible ? "false" : "true");
    }

    function loadLayout() {
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem(storageKey()) || "null");
        } catch (error) {}
        return dataApi()?.sanitizeLayout?.(saved, catalog)
            || { schema: STORAGE_VERSION, pages: [] };
    }

    function saveLayout() {
        try {
            localStorage.setItem(storageKey(), JSON.stringify(layout));
        } catch (error) {
            console.warn("PortfoliOS Mobile: Home layout could not be saved.", error);
        }
    }

    function visibleSystems() {
        if (typeof window.getVisibleSystems === "function") return window.getVisibleSystems();
        return (window.systems || []).filter((system) => !window.isVisibleForCurrentUser || window.isVisibleForCurrentUser(system.id));
    }

    function appById(appId) {
        return catalog.find((app) => app.id === appId) || null;
    }

    function renderAppTile(app, options = {}) {
        if (!app) return "";
        const page = Number.isInteger(options.page) ? String(options.page) : "";
        const origin = options.origin || "page";
        const dockClass = options.dock ? " mobile-dock-app" : "";
        const drawerClass = options.drawer ? " mobile-drawer-app" : "";
        return `
            <button class="mobile-app-icon mobile-launcher-tile${dockClass}${drawerClass}" type="button"
                data-mobile-open="${escapeHtml(app.id)}" data-mobile-home-item data-mobile-home-kind="app"
                data-mobile-home-id="${escapeHtml(app.id)}" data-mobile-home-origin="${escapeHtml(origin)}"
                ${page ? `data-mobile-home-item-page="${page}"` : ""}
                data-mobile-drawer-category="${escapeHtml(app.category)}"
                style="--tile-color:${escapeHtml(app.color)}" aria-label="Open ${escapeHtml(app.title)}">
                <span class="mobile-app-icon-shape">${iconHtml(app)}</span>
                ${options.dock ? "" : `<span>${escapeHtml(app.title)}</span>`}
            </button>
        `;
    }

    function renderFolderTile(item, page) {
        const folder = dataApi()?.visibleFolder?.(item.folderId, catalog);
        if (!folder) return "";
        const preview = folder.apps.slice(0, 4).map((app) => `<span style="--folder-tile:${escapeHtml(app.color)}">${iconHtml(app)}</span>`).join("");
        return `
            <button class="mobile-app-icon mobile-launcher-tile mobile-folder-tile" type="button"
                data-mobile-folder-open="${escapeHtml(folder.id)}" data-mobile-home-item data-mobile-home-kind="folder"
                data-mobile-home-id="${escapeHtml(folder.id)}" data-mobile-home-origin="page" data-mobile-home-item-page="${page}"
                aria-haspopup="dialog" aria-label="Open ${escapeHtml(folder.title)} folder">
                <span class="mobile-app-icon-shape mobile-folder-shape">${preview}</span>
                <span>${escapeHtml(folder.title)}</span>
            </button>
        `;
    }

    function liveSystemCounts() {
        const systems = visibleSystems();
        const live = systems.filter((system) => ["Online", "Active", "Stable", "Playable", "Dev"].includes(system.status)).length;
        return { live, total: systems.length };
    }

    function renderWidgetTile(item, page) {
        const widget = config().widgets?.[item.widgetId];
        if (!widget) return "";
        const common = `data-mobile-home-item data-mobile-home-kind="widget" data-mobile-home-id="${escapeHtml(widget.id)}" data-mobile-home-origin="page" data-mobile-home-item-page="${page}"`;
        if (widget.id === "portfolio-pulse") {
            const counts = liveSystemCounts();
            return `
                <button class="mobile-launcher-widget mobile-pulse-widget" type="button" data-view="quick" ${common}>
                    <span><i class="${escapeHtml(widget.icon)}"></i> PortfoliOS signals</span>
                    <strong>${counts.live} active nodes</strong>
                    <small>${counts.total} visible projects and services <i class="fa-solid fa-arrow-right"></i></small>
                </button>
            `;
        }
        if (widget.id === "now-playing") {
            return `
                <button class="mobile-launcher-widget mobile-media-widget" type="button" data-mobile-open="music" ${common}>
                    <span><i class="${escapeHtml(widget.icon)}"></i> Now playing</span>
                    <strong id="mobile-home-media-title">Your music is ready</strong>
                    <small id="mobile-home-media-artist">Open the touch-native player <i class="fa-solid fa-play"></i></small>
                </button>
            `;
        }
        return `
            <button class="mobile-launcher-widget mobile-glance-widget" type="button" data-view="quick" ${common}>
                <span><i class="${escapeHtml(widget.icon)}"></i> At a glance</span>
                <strong>Projects, services, and professional signals.</strong>
                <small>Open Quick Data <i class="fa-solid fa-arrow-right"></i></small>
            </button>
        `;
    }

    function renderPage(page, index) {
        const container = document.querySelector(`[data-mobile-home-page-content="${index}"]`);
        if (!container) return;
        container.innerHTML = page.items.map((item) => {
            if (item.type === "app") return renderAppTile(appById(item.appId), { page: index, origin: "page" });
            if (item.type === "folder") return renderFolderTile(item, index);
            if (item.type === "widget") return renderWidgetTile(item, index);
            return "";
        }).join("");
    }

    function renderDock() {
        const dock = byId("mobile-home-dock");
        if (!dock) return;
        dock.innerHTML = (config().dock || []).map((appId) => renderAppTile(appById(appId), { dock: true, origin: "dock" })).join("");
    }

    function renderFeed() {
        const feed = byId("mobile-portfolio-feed-content");
        if (!feed) return;
        const entries = dataApi()?.visibleFeed?.(catalog, visibleSystems()) || [];
        if (!entries.length) {
            feed.innerHTML = `<div class="mobile-feed-empty"><i class="fa-solid fa-satellite-dish"></i><strong>No visible signals</strong><span>Your profile has no PortfoliOS feed items yet.</span></div>`;
            return;
        }
        const [lead, ...rest] = entries;
        const actionAttributes = (entry) => entry.appId
            ? `data-mobile-open="${escapeHtml(entry.appId)}"`
            : `data-view="${escapeHtml(entry.view || "quick")}"`;
        feed.innerHTML = `
            <button class="mobile-feed-lead" type="button" ${actionAttributes(lead)} style="--feed-color:${escapeHtml(lead.color)}">
                <span class="mobile-feed-label"><i class="${escapeHtml(lead.icon)}"></i>${escapeHtml(lead.label)}</span>
                <strong>${escapeHtml(lead.headline)}</strong>
                <p>${escapeHtml(lead.body)}</p>
                <small>Open signal <i class="fa-solid fa-arrow-right"></i></small>
            </button>
            <div class="mobile-feed-list">
                ${rest.map((entry) => `
                    <button type="button" ${actionAttributes(entry)} style="--feed-color:${escapeHtml(entry.color)}">
                        <span><i class="${escapeHtml(entry.icon)}"></i></span>
                        <span><small>${escapeHtml(entry.label)}</small><strong>${escapeHtml(entry.headline)}</strong><p>${escapeHtml(entry.body)}</p></span>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                `).join("")}
            </div>
        `;
    }

    function renderDrawerCategories() {
        const categories = byId("mobile-app-drawer-categories");
        if (!categories) return;
        categories.innerHTML = (config().categories || []).map((category) => `
            <button type="button" data-mobile-drawer-category-select="${escapeHtml(category.id)}"
                class="${category.id === drawerCategory ? "is-active" : ""}" aria-pressed="${category.id === drawerCategory}">
                ${escapeHtml(category.label)}
            </button>
        `).join("");
    }

    function renderDrawer() {
        const grid = byId("mobile-app-drawer-grid");
        if (!grid) return;
        const results = dataApi()?.searchApps?.(catalog, drawerQuery, drawerCategory) || catalog;
        grid.innerHTML = results.map((app) => renderAppTile(app, { drawer: true, origin: "drawer" })).join("");
        const empty = byId("mobile-app-drawer-empty");
        if (empty) empty.hidden = results.length > 0;
        const count = byId("mobile-app-drawer-count");
        if (count) count.textContent = `${results.length} app${results.length === 1 ? "" : "s"}`;
        renderDrawerCategories();
    }

    function renderIndicators() {
        const indicator = byId("mobile-page-indicator");
        if (!indicator) return;
        indicator.innerHTML = `
            <button type="button" data-mobile-home-page-select="-1" aria-label="PortfoliOS News and Signals" title="News and Signals"><i class="fa-solid fa-newspaper"></i></button>
            ${layout.pages.map((page, index) => `<button type="button" data-mobile-home-page-select="${index}" aria-label="${escapeHtml(page.title)} Home page"></button>`).join("")}
        `;
    }

    function renderAll() {
        layout = dataApi()?.sanitizeLayout?.(layout, catalog) || layout;
        layout.pages.forEach(renderPage);
        renderDock();
        renderFeed();
        renderDrawer();
        renderIndicators();
        updateNowPlaying();
        applyState(false);
    }

    function pageLabel(index) {
        if (index === -1) return "PortfoliOS News and Signals";
        return `${layout.pages[index]?.title || `Home ${index + 1}`} page`;
    }

    function applyState(announce = true) {
        const device = byId("mobile-device");
        const home = byId("mobile-home");
        const pager = byId("mobile-home-pager");
        const track = byId("mobile-home-track");
        const drawer = byId("mobile-app-drawer");
        const folder = byId("mobile-folder-panel");
        const actions = byId("mobile-launcher-actions");
        const controls = document.querySelector(".mobile-launcher-controls");
        const dock = byId("mobile-home-dock");
        const dialogOpen = Boolean(folderId || actionState);
        const backgroundHidden = drawerOpen || dialogOpen;
        const trackIndex = pageIndex + 1;

        if (track) track.style.setProperty("--mobile-home-track-index", String(trackIndex));
        document.querySelectorAll("[data-mobile-home-panel-index]").forEach((panel) => {
            const active = Number(panel.dataset.mobileHomePanelIndex) === pageIndex;
            panel.inert = !active || backgroundHidden;
            panel.setAttribute("aria-hidden", active && !backgroundHidden ? "false" : "true");
        });
        if (pager) {
            pager.inert = backgroundHidden;
            pager.setAttribute("aria-hidden", backgroundHidden ? "true" : "false");
        }
        [controls, dock].forEach((element) => {
            if (!element) return;
            element.inert = backgroundHidden;
            element.setAttribute("aria-hidden", backgroundHidden ? "true" : "false");
        });
        setVisible(drawer, drawerOpen);
        setVisible(folder, Boolean(folderId));
        setVisible(actions, Boolean(actionState));

        if (device) {
            device.dataset.mobileLauncherView = drawerOpen ? "drawer" : "pages";
            device.dataset.mobileHomePage = pageIndex === -1 ? "feed" : String(pageIndex + 1);
            device.dataset.mobileLauncherLayer = actionState ? "actions" : folderId ? "folder" : "none";
        }
        if (home) home.dataset.mobileHomePage = pageIndex === -1 ? "feed" : String(pageIndex + 1);

        document.querySelectorAll("[data-mobile-home-page-select]").forEach((button) => {
            const active = Number(button.dataset.mobileHomePageSelect) === pageIndex;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-current", active ? "page" : "false");
        });

        const live = byId("mobile-home-live");
        if (announce && live) live.textContent = drawerOpen ? "All apps opened" : pageLabel(pageIndex);
    }

    function setPage(nextIndex, options = {}) {
        const maximum = Math.max(0, layout.pages.length - 1);
        const requested = Math.max(-1, Math.min(maximum, Number(nextIndex)));
        if (!Number.isFinite(requested)) return false;
        drawerOpen = false;
        folderId = null;
        actionState = null;
        const changed = pageIndex !== requested;
        pageIndex = requested;
        applyState(options.announce !== false);
        if (options.focus) {
            queueMicrotask(() => document.querySelector(`[data-mobile-home-panel-index="${pageIndex}"] button, [data-mobile-home-panel-index="${pageIndex}"] input`)?.focus?.({ preventScroll: true }));
        }
        return changed;
    }

    function stepPage(delta) {
        return setPage(pageIndex + Number(delta || 0));
    }

    function openDrawer(trigger = document.activeElement) {
        returnFocus = trigger instanceof Element ? trigger : null;
        drawerOpen = true;
        folderId = null;
        actionState = null;
        drawerQuery = "";
        drawerCategory = "all";
        const input = byId("mobile-app-drawer-search");
        if (input) input.value = "";
        renderDrawer();
        applyState();
        queueMicrotask(() => input?.focus?.({ preventScroll: true }));
        return true;
    }

    function closeDrawer(options = {}) {
        if (!drawerOpen) return false;
        drawerOpen = false;
        applyState();
        if (options.restoreFocus !== false) queueMicrotask(() => returnFocus?.isConnected && returnFocus.focus?.({ preventScroll: true }));
        return true;
    }

    function openFolder(requestedId, trigger = document.activeElement) {
        const folder = dataApi()?.visibleFolder?.(requestedId, catalog);
        if (!folder) return false;
        returnFocus = trigger instanceof Element ? trigger : null;
        folderId = folder.id;
        actionState = null;
        const title = byId("mobile-folder-title");
        const subtitle = byId("mobile-folder-subtitle");
        const grid = byId("mobile-folder-grid");
        if (title) title.textContent = folder.title;
        if (subtitle) subtitle.textContent = `${folder.apps.length} app${folder.apps.length === 1 ? "" : "s"}`;
        if (grid) grid.innerHTML = folder.apps.map((app) => renderAppTile(app, { origin: "folder" })).join("");
        applyState(false);
        queueMicrotask(() => byId("mobile-folder-close")?.focus?.({ preventScroll: true }));
        return true;
    }

    function closeDialog(options = {}) {
        if (!folderId && !actionState) return false;
        folderId = null;
        actionState = null;
        applyState(false);
        if (options.restoreFocus !== false) queueMicrotask(() => returnFocus?.isConnected && returnFocus.focus?.({ preventScroll: true }));
        return true;
    }

    function descriptorForElement(element) {
        const item = element instanceof Element ? element.closest("[data-mobile-home-item]") : null;
        if (!item) return null;
        return {
            kind: item.dataset.mobileHomeKind,
            id: item.dataset.mobileHomeId,
            origin: item.dataset.mobileHomeOrigin || "page",
            page: item.dataset.mobileHomeItemPage === undefined ? null : Number(item.dataset.mobileHomeItemPage),
            trigger: item
        };
    }

    function descriptorTitle(descriptor) {
        if (descriptor.kind === "app") return appById(descriptor.id)?.title || descriptor.id;
        if (descriptor.kind === "folder") return config().folders?.[descriptor.id]?.title || descriptor.id;
        if (descriptor.kind === "widget") return config().widgets?.[descriptor.id]?.title || descriptor.id;
        return "Home item";
    }

    function descriptorIcon(descriptor) {
        if (descriptor.kind === "app") return appById(descriptor.id)?.icon || "fa-solid fa-mobile-screen";
        if (descriptor.kind === "folder") return config().folders?.[descriptor.id]?.icon || "fa-solid fa-folder";
        if (descriptor.kind === "widget") return config().widgets?.[descriptor.id]?.icon || "fa-solid fa-table-cells-large";
        return "fa-solid fa-sliders";
    }

    function layoutItemFor(descriptor) {
        if (descriptor.kind === "app") return { type: "app", appId: descriptor.id };
        if (descriptor.kind === "folder") return { type: "folder", folderId: descriptor.id };
        if (descriptor.kind === "widget") return { type: "widget", widgetId: descriptor.id };
        return null;
    }

    function pageContaining(descriptor) {
        const key = dataApi()?.itemKey?.(layoutItemFor(descriptor));
        return layout.pages.findIndex((page) => page.items.some((item) => dataApi()?.itemKey?.(item) === key));
    }

    function renderActionButtons(descriptor) {
        const currentPage = pageContaining(descriptor);
        const openLabel = descriptor.kind === "folder" ? "Open folder" : descriptor.kind === "widget" ? "Open widget" : "Open app";
        const buttons = [
            `<button type="button" data-mobile-launcher-action="open"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>${openLabel}</span></button>`
        ];
        layout.pages.forEach((page, index) => {
            if (index === currentPage) return;
            buttons.push(`<button type="button" data-mobile-launcher-action="move" data-mobile-launcher-page="${index}"><i class="fa-solid fa-arrow-right-arrow-left"></i><span>${currentPage < 0 ? "Add to" : "Move to"} ${escapeHtml(page.title)}</span></button>`);
        });
        if (descriptor.kind === "app" && currentPage >= 0) {
            buttons.push(`<button type="button" data-mobile-launcher-action="remove" class="is-destructive"><i class="fa-solid fa-minus"></i><span>Remove from Home</span></button>`);
        }
        return buttons.join("");
    }

    function openItemActions(targetOrDescriptor) {
        const descriptor = targetOrDescriptor?.kind ? targetOrDescriptor : descriptorForElement(targetOrDescriptor);
        if (!descriptor?.kind || !descriptor.id) return false;
        suppressItemClickUntil = performance.now() + 900;
        const requestedReturnFocus = descriptor.trigger instanceof Element ? descriptor.trigger : document.activeElement;
        returnFocus = requestedReturnFocus?.closest?.("#mobile-launcher-actions-body")
            ? document.querySelector("[data-mobile-customize]")
            : requestedReturnFocus;
        folderId = null;
        actionState = { type: "item", descriptor };
        const title = byId("mobile-launcher-actions-title");
        const subtitle = byId("mobile-launcher-actions-subtitle");
        const icon = byId("mobile-launcher-actions-icon");
        const body = byId("mobile-launcher-actions-body");
        if (title) title.textContent = descriptorTitle(descriptor);
        if (subtitle) subtitle.textContent = "Home options";
        if (icon) icon.className = descriptorIcon(descriptor);
        if (body) body.innerHTML = renderActionButtons(descriptor);
        applyState(false);
        navigator.vibrate?.(12);
        queueMicrotask(() => byId("mobile-launcher-actions-close")?.focus?.({ preventScroll: true }));
        return true;
    }

    function openCustomize(trigger = document.activeElement) {
        returnFocus = trigger instanceof Element ? trigger : null;
        folderId = null;
        actionState = { type: "customize" };
        const title = byId("mobile-launcher-actions-title");
        const subtitle = byId("mobile-launcher-actions-subtitle");
        const icon = byId("mobile-launcher-actions-icon");
        const body = byId("mobile-launcher-actions-body");
        if (title) title.textContent = "Customize Home";
        if (subtitle) subtitle.textContent = "Move apps between pages or restore the default launcher.";
        if (icon) icon.className = "fa-solid fa-sliders";
        if (body) body.innerHTML = `
            ${layout.pages.map((page, index) => `
                <section class="mobile-customize-page">
                    <strong>${escapeHtml(page.title)}</strong>
                    ${page.items.map((item) => {
                        const descriptor = item.type === "app"
                            ? { kind: "app", id: item.appId, page: index }
                            : item.type === "folder"
                                ? { kind: "folder", id: item.folderId, page: index }
                                : { kind: "widget", id: item.widgetId, page: index };
                        return `<button type="button" data-mobile-edit-kind="${descriptor.kind}" data-mobile-edit-id="${escapeHtml(descriptor.id)}" data-mobile-edit-page="${index}"><i class="${escapeHtml(descriptorIcon(descriptor))}"></i><span>${escapeHtml(descriptorTitle(descriptor))}</span><i class="fa-solid fa-chevron-right"></i></button>`;
                    }).join("")}
                </section>
            `).join("")}
            <button type="button" data-mobile-launcher-action="drawer"><i class="fa-solid fa-grip"></i><span>Browse all apps</span></button>
            <button type="button" data-mobile-launcher-action="reset"><i class="fa-solid fa-arrow-rotate-left"></i><span>Restore default Home</span></button>
        `;
        applyState(false);
        queueMicrotask(() => byId("mobile-launcher-actions-close")?.focus?.({ preventScroll: true }));
        return true;
    }

    function moveDescriptor(descriptor, destination) {
        const item = layoutItemFor(descriptor);
        const key = dataApi()?.itemKey?.(item);
        if (!item || !key || !layout.pages[destination]) return false;
        layout.pages.forEach((page) => {
            page.items = page.items.filter((candidate) => dataApi()?.itemKey?.(candidate) !== key);
        });
        layout.pages[destination].items.push(item);
        saveLayout();
        renderAll();
        setPage(destination);
        return true;
    }

    function removeDescriptor(descriptor) {
        const item = layoutItemFor(descriptor);
        const key = dataApi()?.itemKey?.(item);
        if (!item || !key) return false;
        layout.pages.forEach((page) => {
            page.items = page.items.filter((candidate) => dataApi()?.itemKey?.(candidate) !== key);
        });
        saveLayout();
        renderAll();
        return true;
    }

    function openDescriptor(descriptor) {
        closeDialog({ restoreFocus: false });
        if (descriptor.kind === "app") {
            window.EventBus?.emit("mobile:open-app", { appId: descriptor.id, context: { source: "launcher-actions" } });
            return;
        }
        if (descriptor.kind === "folder") {
            openFolder(descriptor.id, descriptor.trigger);
            return;
        }
        if (descriptor.id === "now-playing") {
            window.EventBus?.emit("mobile:open-app", { appId: "music", context: { source: "launcher-widget" } });
            return;
        }
        if (descriptor.id === "portfolio-pulse") {
            window.EventBus?.emit("mobile:open-app", { appId: "status", context: { source: "launcher-widget" } });
            return;
        }
        document.querySelector('[data-view="quick"]')?.click?.();
    }

    function performAction(action, button) {
        if (action === "drawer") {
            closeDialog({ restoreFocus: false });
            openDrawer();
            return;
        }
        if (action === "reset") {
            layout = dataApi()?.sanitizeLayout?.(null, catalog) || layout;
            saveLayout();
            renderAll();
            closeDialog({ restoreFocus: false });
            setPage(0);
            return;
        }
        const descriptor = actionState?.descriptor;
        if (!descriptor) return;
        if (action === "open") openDescriptor(descriptor);
        if (action === "move") {
            closeDialog({ restoreFocus: false });
            moveDescriptor(descriptor, Number(button.dataset.mobileLauncherPage));
        }
        if (action === "remove") {
            closeDialog({ restoreFocus: false });
            removeDescriptor(descriptor);
        }
    }

    function handleHomeClick(event) {
        if (!(event.target instanceof Element)) return;
        const item = event.target.closest("[data-mobile-home-item]");
        if (item && performance.now() < suppressItemClickUntil) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        const drawerApp = event.target.closest("#mobile-app-drawer [data-mobile-open]");
        const folderApp = event.target.closest("#mobile-folder-panel [data-mobile-open]");
        if (drawerApp) closeDrawer({ restoreFocus: false });
        if (folderApp) closeDialog({ restoreFocus: false });

        const pageButton = event.target.closest("[data-mobile-home-page-select]");
        if (pageButton) {
            event.preventDefault();
            event.stopPropagation();
            setPage(Number(pageButton.dataset.mobileHomePageSelect), { focus: true });
            return;
        }
        const drawerOpenButton = event.target.closest("[data-mobile-drawer-open]");
        if (drawerOpenButton) {
            event.preventDefault();
            event.stopPropagation();
            openDrawer(drawerOpenButton);
            return;
        }
        const drawerCloseButton = event.target.closest("[data-mobile-drawer-close]");
        if (drawerCloseButton) {
            event.preventDefault();
            event.stopPropagation();
            closeDrawer();
            return;
        }
        const categoryButton = event.target.closest("[data-mobile-drawer-category-select]");
        if (categoryButton) {
            event.preventDefault();
            event.stopPropagation();
            drawerCategory = categoryButton.dataset.mobileDrawerCategorySelect || "all";
            renderDrawer();
            return;
        }
        const folderButton = event.target.closest("[data-mobile-folder-open]");
        if (folderButton) {
            event.preventDefault();
            event.stopPropagation();
            openFolder(folderButton.dataset.mobileFolderOpen, folderButton);
            return;
        }
        if (event.target.closest("[data-mobile-launcher-dialog-close]")) {
            event.preventDefault();
            event.stopPropagation();
            closeDialog();
            return;
        }
        const actionButton = event.target.closest("[data-mobile-launcher-action]");
        if (actionButton) {
            event.preventDefault();
            event.stopPropagation();
            performAction(actionButton.dataset.mobileLauncherAction, actionButton);
            return;
        }
        const editButton = event.target.closest("[data-mobile-edit-kind]");
        if (editButton) {
            event.preventDefault();
            event.stopPropagation();
            openItemActions({
                kind: editButton.dataset.mobileEditKind,
                id: editButton.dataset.mobileEditId,
                page: Number(editButton.dataset.mobileEditPage),
                origin: "customize",
                trigger: editButton
            });
            return;
        }
        const customizeButton = event.target.closest("[data-mobile-customize]");
        if (customizeButton) {
            event.preventDefault();
            event.stopPropagation();
            openCustomize(customizeButton);
        }
    }

    function handleHomeInput(event) {
        if (!(event.target instanceof HTMLInputElement) || !event.target.matches("[data-mobile-app-drawer-search]")) return;
        drawerQuery = event.target.value;
        renderDrawer();
    }

    function handleContextMenu(event) {
        const item = event.target instanceof Element ? event.target.closest("[data-mobile-home-item]") : null;
        if (!item) return;
        event.preventDefault();
        openItemActions(item);
    }

    function handleHomeKeydown(event) {
        const item = event.target instanceof Element ? event.target.closest("[data-mobile-home-item]") : null;
        if (!item) return;
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            openItemActions(item);
        }
    }

    function bindHomeEvents() {
        if (bound) return;
        const home = byId("mobile-home");
        if (!home) return;
        bound = true;
        home.addEventListener("click", handleHomeClick);
        home.addEventListener("input", handleHomeInput);
        home.addEventListener("contextmenu", handleContextMenu);
        home.addEventListener("keydown", handleHomeKeydown);
    }

    function mount(options = {}) {
        const nextUserId = options.userId || "bl4ut0";
        const userChanged = nextUserId !== currentUserId || !layout;
        currentUserId = nextUserId;
        catalog = Array.isArray(options.catalog) ? options.catalog : [];
        layout = userChanged ? loadLayout() : dataApi()?.sanitizeLayout?.(layout, catalog) || layout;
        if (userChanged) {
            pageIndex = 0;
            drawerOpen = false;
            folderId = null;
            actionState = null;
        }
        bindHomeEvents();
        renderAll();
        return getState();
    }

    function showHome(options = {}) {
        drawerOpen = false;
        folderId = null;
        actionState = null;
        if (options.primary) pageIndex = 0;
        applyState(options.announce !== false);
    }

    function goBack() {
        if (actionState || folderId) return closeDialog();
        if (drawerOpen) return closeDrawer();
        if (pageIndex !== 0) return setPage(0, { focus: true });
        return false;
    }

    function updateNowPlaying() {
        const state = window.MobileMediaService?.getState?.();
        const title = byId("mobile-home-media-title");
        const artist = byId("mobile-home-media-artist");
        if (!title || !artist) return;
        if (!state?.currentTrack) {
            title.textContent = "Your music is ready";
            artist.textContent = "Open the touch-native player";
            return;
        }
        title.textContent = state.currentTrack.title || state.currentTrack.name || "Unknown track";
        artist.textContent = `${state.currentTrack.artist || "Local music"} · ${state.isPlaying ? "Playing" : "Paused"}`;
    }

    function getState() {
        return {
            userId: currentUserId,
            pageIndex,
            pageCount: layout?.pages?.length || 0,
            drawerOpen,
            folderId,
            actionType: actionState?.type || null,
            drawerCategory,
            drawerQuery
        };
    }

    window.MobileHome = {
        mount,
        render: renderAll,
        showHome,
        goBack,
        setPage,
        stepPage,
        openDrawer,
        closeDrawer,
        openFolder,
        closeDialog,
        openItemActions,
        openCustomize,
        suppressNextItemClick: () => { suppressItemClickUntil = performance.now() + 900; },
        updateNowPlaying,
        getState
    };
})();
