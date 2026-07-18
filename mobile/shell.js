/**
 * PortfoliOS Mobile OS shell.
 *
 * Mobile tasks are retained until the user explicitly removes them from Recents.
 * Home and experience changes pause an app; returning resumes the same DOM and state.
 */
(function() {
    const PREFERENCE_VERSION = 2;
    const MAX_TASKS = 10;
    const tasks = new Map();
    const pendingLaunches = new Map();
    const notifications = [];
    let recentOrder = [];
    let activeTaskId = null;
    let lastForegroundTaskId = null;
    let currentSurface = "home";
    let navigationGeneration = 0;
    let currentExperience = document.body?.dataset.view || window.state?.view || "desktop";
    let shadeOpen = false;
    let clockTimer = null;
    let deferredInstallPrompt = null;
    let gesture = null;
    let visibilityPausedTaskId = null;
    let lockedTaskId = null;
    let shadeReturnFocus = null;
    let lockReturnFocus = null;
    let activeAppDialog = null;
    let appDialogReturnFocus = null;
    const modalInertedElements = new Set();
    let currentMobileUserId = window.state?.currentUserId || "bl4ut0";
    let prefs = loadPreferences(currentMobileUserId);

    function claimNavigation(reason) {
        navigationGeneration += 1;
        const device = document.getElementById("mobile-device");
        if (device) {
            device.dataset.mobileNavigationGeneration = String(navigationGeneration);
            device.dataset.mobileNavigationReason = reason;
        }
        return navigationGeneration;
    }

    function preferenceKey(userId = currentMobileUserId) {
        return `bl4ut0_${userId}_mobile_os_v${PREFERENCE_VERSION}`;
    }

    function defaultPreferences() {
        return {
            wallpaper: "aurora",
            accent: "cyan",
            theme: "dark",
            navMode: "buttons",
            reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true,
            brightness: 100,
            wifi: true,
            bluetooth: false,
            dnd: false,
            rotation: true
        };
    }

    function loadPreferences(userId = currentMobileUserId) {
        try {
            const saved = JSON.parse(localStorage.getItem(preferenceKey(userId)) || "null");
            return { ...defaultPreferences(), ...(saved && typeof saved === "object" ? saved : {}) };
        } catch (error) {
            return defaultPreferences();
        }
    }

    function savePreferences() {
        try {
            localStorage.setItem(preferenceKey(currentMobileUserId), JSON.stringify(prefs));
        } catch (error) {
            console.warn("PortfoliOS Mobile: settings could not be saved.", error);
        }
    }

    function elements() {
        return {
            device: document.getElementById("mobile-device"),
            screen: document.getElementById("mobile-screen"),
            home: document.getElementById("mobile-home"),
            taskStack: document.getElementById("mobile-task-stack"),
            recents: document.getElementById("mobile-recents"),
            recentsList: document.getElementById("mobile-recents-list"),
            lock: document.getElementById("mobile-lock-screen"),
            shade: document.getElementById("mobile-shade"),
            statusToggle: document.querySelector("[data-mobile-shade-toggle]"),
            notifications: document.getElementById("mobile-notifications"),
            notificationDot: document.getElementById("mobile-notification-dot"),
            nav: document.getElementById("mobile-nav")
        };
    }

    function isLockOpen() {
        const lockScreen = elements().lock;
        return Boolean(lockScreen && !lockScreen.classList.contains("is-hidden"));
    }

    function visibleAppDialog() {
        return [...document.querySelectorAll('#mobile-device .mobile-native-app [role="dialog"][aria-modal="true"]')]
            .find((dialog) => !dialog.closest("[hidden]") && !dialog.closest(".is-hidden")) || null;
    }

    function inertForModal(element) {
        if (!element || element.inert) return;
        element.inert = true;
        modalInertedElements.add(element);
    }

    function clearModalInert() {
        modalInertedElements.forEach((element) => { element.inert = false; });
        modalInertedElements.clear();
    }

    function activeModal() {
        if (isLockOpen()) return elements().lock;
        if (shadeOpen) return elements().shade;
        return visibleAppDialog();
    }

    function syncModalIsolation() {
        clearModalInert();
        const ui = elements();
        const appDialog = visibleAppDialog();
        if (appDialog !== activeAppDialog) {
            if (appDialog && !activeAppDialog) appDialogReturnFocus = document.activeElement;
            if (!appDialog && activeAppDialog) {
                const returnTarget = appDialogReturnFocus;
                queueMicrotask(() => returnTarget?.isConnected && returnTarget.focus?.({ preventScroll: true }));
                appDialogReturnFocus = null;
            }
            activeAppDialog = appDialog;
        }

        if (isLockOpen()) {
            inertForModal(ui.statusToggle);
            inertForModal(ui.shade);
            inertForModal(ui.nav);
            inertForModal(ui.home);
            inertForModal(ui.taskStack);
            inertForModal(ui.recents);
            return;
        }
        if (shadeOpen) {
            inertForModal(ui.statusToggle);
            inertForModal(ui.screen);
            inertForModal(ui.nav);
            return;
        }
        if (appDialog) {
            inertForModal(ui.statusToggle);
            inertForModal(ui.nav);
            inertForModal(appDialog.closest(".mobile-task")?.querySelector(".mobile-app-bar"));
            let branch = appDialog.closest("[data-docs-dialog], [data-docs-sheet], [data-files-dialog], [data-files-sheet]") || appDialog;
            const appRoot = appDialog.closest(".mobile-native-app");
            while (branch?.parentElement && branch !== appRoot) {
                [...branch.parentElement.children].forEach((sibling) => {
                    if (sibling !== branch) inertForModal(sibling);
                });
                branch = branch.parentElement;
            }
        }
    }

    function focusableWithin(root) {
        if (!root) return [];
        return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
            .filter((element) => !element.disabled && !element.hidden && !element.closest("[hidden]") && !element.inert);
    }

    function handleModalKeydown(event) {
        const modal = activeModal();
        if (!modal) return;
        if (event.key === "Escape") {
            if (shadeOpen) {
                event.preventDefault();
                setShadeOpen(false);
                return;
            }
            if (!isLockOpen()) {
                const container = modal.closest("[data-docs-dialog], [data-docs-sheet], [data-files-dialog], [data-files-sheet]");
                const closeButton = container?.querySelector("[data-docs-dialog-close], [data-docs-sheet-close], [data-files-dialog-cancel], [data-files-dismiss]");
                if (closeButton) {
                    event.preventDefault();
                    closeButton.click();
                }
            }
            return;
        }
        if (event.key !== "Tab") return;
        const focusable = focusableWithin(modal);
        if (!focusable.length) {
            event.preventDefault();
            modal.focus?.({ preventScroll: true });
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function escapeHtml(value) {
        return window.PortfolioOSMobileFramework?.escapeHtml?.(value)
            || String(value ?? "").replace(/[&<>"']/g, (char) => ({
                "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
            })[char]);
    }

    function getVisibleMobileCatalog() {
        return (window.mobileAppCatalog || []).filter((app) => {
            if (!app.sourceId || !window.isVisibleForCurrentUser) return true;
            return window.isVisibleForCurrentUser(app.sourceId);
        });
    }

    function iconHtml(app) {
        return window.getAppIconHtml?.(app.icon) || `<i class="${escapeHtml(app.icon)}"></i>`;
    }

    function setLayerVisibility(layer, visible) {
        if (!layer) return;
        layer.classList.toggle("is-hidden", !visible);
        layer.inert = !visible;
        layer.setAttribute("aria-hidden", visible ? "false" : "true");
    }

    function setSurface(surface) {
        const ui = elements();
        currentSurface = surface;
        if (window.state) window.state.mobileSurface = surface;
        setLayerVisibility(ui.home, surface === "home");
        setLayerVisibility(ui.taskStack, surface === "app");
        setLayerVisibility(ui.recents, surface === "recents");
        if (surface !== "app") {
            document.querySelectorAll(".mobile-task").forEach((host) => { host.hidden = true; });
        }
        ui.device?.setAttribute("data-mobile-surface", surface);
        syncModalIsolation();
    }

    function applyPreferences() {
        const ui = elements();
        if (!ui.device) return;
        ui.device.dataset.wallpaper = prefs.wallpaper;
        ui.device.dataset.mobileAccent = prefs.accent;
        ui.device.dataset.mobileTheme = prefs.theme;
        ui.device.dataset.navMode = prefs.navMode;
        ui.device.classList.toggle("reduce-mobile-motion", prefs.reducedMotion === true);
        ui.device.style.setProperty("--mobile-screen-brightness", String(Math.max(0.45, Number(prefs.brightness || 100) / 100)));
        ui.nav?.setAttribute("data-nav-mode", prefs.navMode);

        const brightness = document.querySelector("[data-mobile-brightness]");
        const volume = document.querySelector("[data-mobile-volume]");
        if (brightness) brightness.value = String(prefs.brightness);
        if (volume) volume.value = String(window.state?.volume ?? 70);

        document.querySelectorAll("[data-mobile-toggle]").forEach((button) => {
            const key = button.dataset.mobileToggle;
            const active = key === "wifi" ? navigator.onLine !== false : prefs[key] === true;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
            const detail = button.querySelector("small");
            if (detail) {
                if (key === "wifi") detail.textContent = navigator.onLine === false ? "Offline" : "Online";
                else if (key === "bluetooth") detail.textContent = active ? "Shell only" : "Off";
                else detail.textContent = active ? "On" : "Off";
            }
        });
        document.querySelector("[data-mobile-status-wifi]")?.classList.toggle("is-offline", navigator.onLine === false);
        window.EventBus?.emit("mobile:settings-changed", { ...prefs });
    }

    function setPreference(key, value) {
        if (!(key in defaultPreferences())) return false;
        prefs = { ...prefs, [key]: value };
        savePreferences();
        applyPreferences();
        return true;
    }

    async function toggleSetting(key) {
        if (key === "wifi") {
            toast(`Browser network: ${navigator.onLine === false ? "offline" : "online"}. Hardware Wi-Fi controls are unavailable on the web.`);
            return navigator.onLine !== false;
        }
        if (key === "rotation") {
            if (prefs.rotation === false) {
                window.screen?.orientation?.unlock?.();
                setPreference("rotation", true);
                toast("Auto-rotate follows the browser viewport.");
                return true;
            }
            const orientation = window.screen?.orientation;
            if (typeof orientation?.lock !== "function") {
                toast("This browser controls screen rotation; responsive layout remains on.");
                return true;
            }
            try {
                const type = orientation.type?.startsWith("landscape") ? "landscape" : "portrait";
                await orientation.lock(type);
                setPreference("rotation", false);
                toast(`Rotation locked to ${type}.`);
                return false;
            } catch (error) {
                toast("Rotation lock requires browser support or full screen; responsive layout remains on.");
                return true;
            }
        }
        if (!(key in prefs) || typeof prefs[key] !== "boolean") return false;
        setPreference(key, !prefs[key]);
        if (key === "bluetooth") toast("Bluetooth is a PortfoliOS shell simulation; browser hardware was not changed.");
        return prefs[key];
    }

    function renderMobileApps() {
        const catalog = getVisibleMobileCatalog();
        const grid = document.getElementById("mobile-app-grid");
        const dock = document.getElementById("mobile-home-dock");
        if (grid) {
            grid.innerHTML = catalog.filter((app) => !app.pinned).map((app) => `
                <button class="mobile-app-icon" type="button" data-mobile-open="${escapeHtml(app.id)}"
                    style="--tile-color:${escapeHtml(app.color)}" aria-label="Open ${escapeHtml(app.title)}">
                    <span class="mobile-app-icon-shape">${iconHtml(app)}</span>
                    <span>${escapeHtml(app.title)}</span>
                </button>
            `).join("");
        }
        if (dock) {
            dock.innerHTML = catalog.filter((app) => app.pinned).map((app) => `
                <button class="mobile-app-icon mobile-dock-app" type="button" data-mobile-open="${escapeHtml(app.id)}"
                    style="--tile-color:${escapeHtml(app.color)}" aria-label="Open ${escapeHtml(app.title)}">
                    <span class="mobile-app-icon-shape">${iconHtml(app)}</span>
                </button>
            `).join("");
        }
    }

    function touchRecent(appId) {
        recentOrder = [appId, ...recentOrder.filter((id) => id !== appId)];
    }

    function taskContext(task, detail = {}) {
        return {
            ...detail,
            appId: task.id,
            signal: task.abortController.signal,
            mobileOS: window.MobileOS
        };
    }

    function queueTaskLifecycle(task, hookName, detail = {}) {
        const invoke = async () => {
            if (hookName !== "onClose" && task.abortController.signal.aborted) return undefined;
            return await window.runMobileAppLifecycle?.(
                task.id,
                hookName,
                task.root,
                taskContext(task, detail)
            );
        };
        task.lifecycle = (task.lifecycle || Promise.resolve()).then(invoke, invoke);
        return task.lifecycle;
    }

    async function pauseTask(appId, reason = "background") {
        const task = tasks.get(appId);
        if (!task || task.status !== "running") return;
        task.status = "paused";
        task.host.dataset.taskStatus = "paused";
        task.host.hidden = true;
        await queueTaskLifecycle(task, "onPause", { reason });
    }

    async function suspendTasks(reason, exceptId = null) {
        const lifecycleCalls = [];
        for (const task of tasks.values()) {
            if (task.id === exceptId) continue;
            const wasRunning = task.status === "running";
            task.status = "paused";
            task.host.dataset.taskStatus = "paused";
            task.host.hidden = true;
            if (wasRunning) {
                lifecycleCalls.push(queueTaskLifecycle(task, "onPause", { reason }));
            }
        }
        await Promise.all(lifecycleCalls);
    }

    async function resumeTask(appId, context = {}, requestedGeneration = claimNavigation(`resume:${appId}`)) {
        const task = tasks.get(appId);
        if (!task
            || task.userId !== currentMobileUserId
            || !getVisibleMobileCatalog().some((app) => app.id === appId)) return false;
        visibilityPausedTaskId = null;
        if (task.readyPromise) await task.readyPromise;
        if (requestedGeneration !== navigationGeneration || tasks.get(appId) !== task || task.abortController.signal.aborted) return false;
        await suspendTasks("switch", appId);
        if (requestedGeneration !== navigationGeneration || tasks.get(appId) !== task || task.abortController.signal.aborted) return false;
        const wasForeground = task.status === "running" && activeTaskId === appId && currentSurface === "app";
        document.querySelectorAll(".mobile-task").forEach((host) => { host.hidden = host !== task.host; });
        task.host.hidden = false;
        task.status = "running";
        task.host.dataset.taskStatus = "running";
        task.lastActive = Date.now();
        activeTaskId = appId;
        lastForegroundTaskId = appId;
        touchRecent(appId);
        if (window.state) window.state.mobileActiveId = appId;
        setSurface("app");
        if (!wasForeground) await queueTaskLifecycle(task, "onResume", { reason: "resume", ...context });
        if (requestedGeneration !== navigationGeneration || tasks.get(appId) !== task || task.status !== "running") return false;
        if (context.intent) {
            await queueTaskLifecycle(task, "onIntent", context);
            if (requestedGeneration !== navigationGeneration || tasks.get(appId) !== task || task.status !== "running") return false;
        }
        task.root.focus?.({ preventScroll: true });
        return true;
    }

    function createTaskHost(appId, app, catalogApp) {
        const host = document.createElement("section");
        host.className = "mobile-task";
        host.dataset.mobileTask = appId;
        host.hidden = true;

        const bar = document.createElement("header");
        bar.className = "mobile-app-bar";
        bar.innerHTML = `
            <button type="button" data-mobile-back aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
            <span class="mobile-app-bar-icon" style="--tile-color:${escapeHtml(catalogApp.color)}">${iconHtml(catalogApp)}</span>
            <strong>${escapeHtml(app.title)}</strong>
            <button type="button" data-mobile-shade-toggle aria-label="Open quick settings"><i class="fa-solid fa-ellipsis-vertical"></i></button>
        `;

        const content = document.createElement("div");
        content.className = "mobile-app-content";
        content.classList.toggle("is-edge-to-edge", app.edgeToEdge === true);
        const root = document.createElement("article");
        root.className = `mobile-native-app ${app.viewClass}`;
        root.dataset.mobileApp = appId;
        root.tabIndex = -1;
        root.innerHTML = app.render();
        content.appendChild(root);
        host.append(bar, content);
        if (app.edgeToEdge === true) host.classList.add("is-edge-to-edge");
        return { host, root };
    }

    async function evictOldestTask() {
        if (tasks.size < MAX_TASKS) return;
        const candidate = [...tasks.values()]
            .filter((task) => task.id !== activeTaskId)
            .sort((a, b) => a.lastActive - b.lastActive)[0];
        if (candidate) await closeTask(candidate.id, "memory-pressure");
    }

    async function launchMobileTask(appId, launchContext, catalogApp, generation) {
        let app;
        try {
            app = await window.ensureMobileAppLoaded(appId);
        } catch (error) {
            if (generation !== navigationGeneration) return false;
            console.error(`PortfoliOS Mobile: could not load "${appId}".`, error);
            notify({ title: `${catalogApp.title} could not open`, body: error.message || "The app module failed to load.", icon: "fa-solid fa-triangle-exclamation" });
            return false;
        }
        if (generation !== navigationGeneration) return false;
        if (tasks.has(appId)) return resumeTask(appId, launchContext, generation);

        await evictOldestTask();
        if (generation !== navigationGeneration) return false;
        await suspendTasks("switch");
        if (generation !== navigationGeneration) return false;

        const { taskStack } = elements();
        if (!taskStack) return false;
        const taskParts = createTaskHost(appId, app, catalogApp);
        const task = {
            id: appId,
            app,
            catalogApp,
            ...taskParts,
            abortController: new AbortController(),
            lifecycle: Promise.resolve(),
            readyPromise: null,
            userId: currentMobileUserId,
            status: "running",
            createdAt: Date.now(),
            lastActive: Date.now()
        };
        tasks.set(appId, task);
        task.host.dataset.taskStatus = "running";
        taskStack.appendChild(task.host);
        document.querySelectorAll(".mobile-task").forEach((host) => { host.hidden = host !== task.host; });
        activeTaskId = appId;
        lastForegroundTaskId = appId;
        touchRecent(appId);
        if (window.state) window.state.mobileActiveId = appId;
        setSurface("app");
        task.host.hidden = false;

        const savedState = readTaskState(appId, task.userId);
        task.readyPromise = (async () => {
            await queueTaskLifecycle(task, "onOpen", { reason: "launch", ...launchContext });
            if (task.abortController.signal.aborted || tasks.get(appId) !== task) return;
            if (savedState !== null) await queueTaskLifecycle(task, "restoreState", { state: savedState });
            if (task.abortController.signal.aborted || tasks.get(appId) !== task) return;
            if (launchContext.intent) await queueTaskLifecycle(task, "onIntent", launchContext);
        })().finally(() => {
            task.readyPromise = null;
        });
        await task.readyPromise;
        if (generation !== navigationGeneration || tasks.get(appId) !== task || task.status !== "running") return false;
        task.root.focus?.({ preventScroll: true });
        return true;
    }

    async function openMobileApp(appId, launchContext = {}) {
        const catalogApp = getVisibleMobileCatalog().find((app) => app.id === appId);
        if (!catalogApp) return false;
        if (tasks.has(appId)) {
            const generation = claimNavigation(`resume:${appId}`);
            visibilityPausedTaskId = null;
            setShadeOpen(false);
            return resumeTask(appId, launchContext, generation);
        }

        const pending = pendingLaunches.get(appId);
        if (pending && !launchContext.intent) return pending;

        const generation = claimNavigation(`open:${appId}`);
        visibilityPausedTaskId = null;
        setShadeOpen(false);
        const launchPromise = launchMobileTask(appId, launchContext, catalogApp, generation);
        if (!launchContext.intent) pendingLaunches.set(appId, launchPromise);
        try {
            return await launchPromise;
        } finally {
            if (pendingLaunches.get(appId) === launchPromise) pendingLaunches.delete(appId);
        }
    }

    async function showMobileHome(reason = "home") {
        claimNavigation(`home:${reason}`);
        visibilityPausedTaskId = null;
        setShadeOpen(false);
        activeTaskId = null;
        if (window.state) window.state.mobileActiveId = null;
        setSurface("home");
        await suspendTasks(reason);
        document.getElementById("mobile-screen")?.scrollTo({ top: 0, behavior: prefs.reducedMotion ? "auto" : "smooth" });
    }

    function renderRecents() {
        const { recentsList } = elements();
        if (!recentsList) return;
        const ordered = recentOrder.map((id) => tasks.get(id)).filter(Boolean);
        recentsList.innerHTML = ordered.length ? ordered.map((task) => `
            <article class="mobile-recent-card" data-mobile-recent-card="${escapeHtml(task.id)}" style="--tile-color:${escapeHtml(task.catalogApp.color)}">
                <button class="mobile-recent-open" type="button" data-mobile-open="${escapeHtml(task.id)}">
                    <span class="mobile-recent-preview"><i class="${escapeHtml(task.catalogApp.icon)}"></i></span>
                    <span class="mobile-recent-meta"><i class="${escapeHtml(task.catalogApp.icon)}"></i><strong>${escapeHtml(task.app.title)}</strong><small>${task.status === "running" ? "Active" : "Ready to resume"}</small></span>
                </button>
                <button class="mobile-recent-close" type="button" data-mobile-close-task="${escapeHtml(task.id)}" aria-label="Close ${escapeHtml(task.app.title)}"><i class="fa-solid fa-xmark"></i></button>
            </article>
        `).join("") : `
            <div class="mobile-recents-empty"><i class="fa-regular fa-clone"></i><strong>No recent apps</strong><span>Apps stay here when you go Home.</span></div>
        `;
    }

    async function showMobileRecents() {
        claimNavigation("recents");
        visibilityPausedTaskId = null;
        setShadeOpen(false);
        activeTaskId = null;
        if (window.state) window.state.mobileActiveId = null;
        setSurface("recents");
        await suspendTasks("recents");
        renderRecents();
        document.querySelector(".mobile-recent-open, [data-mobile-home]")?.focus?.({ preventScroll: true });
    }

    function taskStateKey(appId, userId = currentMobileUserId) {
        return `${preferenceKey(userId)}:task:${appId}`;
    }

    function readTaskState(appId, userId = currentMobileUserId) {
        try {
            const raw = sessionStorage.getItem(taskStateKey(appId, userId));
            return raw == null ? null : JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }

    async function serializeTask(task) {
        const serialized = await queueTaskLifecycle(task, "serializeState", { reason: "persist" });
        if (serialized === undefined) return;
        try {
            sessionStorage.setItem(taskStateKey(task.id, task.userId), JSON.stringify(serialized));
        } catch (error) {}
    }

    async function closeTask(appId, reason = "dismiss") {
        const task = tasks.get(appId);
        if (!task) return false;
        await serializeTask(task);
        task.abortController.abort(reason);
        await queueTaskLifecycle(task, "onClose", { reason });
        task.host.remove();
        tasks.delete(appId);
        recentOrder = recentOrder.filter((id) => id !== appId);
        window.unloadMobileApp?.(appId);
        if (activeTaskId === appId) {
            activeTaskId = null;
            if (window.state) window.state.mobileActiveId = null;
            setSurface("home");
        }
        if (currentSurface === "recents") renderRecents();
        return true;
    }

    async function clearTasks() {
        for (const appId of [...recentOrder]) await closeTask(appId, "clear-recents");
        await showMobileHome("clear-recents");
    }

    async function goBack() {
        if (shadeOpen) {
            setShadeOpen(false);
            return;
        }
        if (!elements().lock?.classList.contains("is-hidden")) return;
        if (currentSurface === "recents") {
            await showMobileHome("back");
            return;
        }
        if (activeTaskId) {
            const task = tasks.get(activeTaskId);
            const generation = claimNavigation(`back:${activeTaskId}`);
            const handled = task ? await queueTaskLifecycle(task, "onBack", { reason: "system-back" }) : false;
            if (generation !== navigationGeneration) return;
            if (handled === true) return;
        }
        await showMobileHome("back");
    }

    function renderNotifications() {
        const ui = elements();
        if (!ui.notifications) return;
        ui.notifications.innerHTML = notifications.length ? notifications.map((item) => `
            <button class="mobile-notification" type="button" data-mobile-notification="${item.id}"${item.appId ? ` data-mobile-open="${escapeHtml(item.appId)}"` : ""}>
                <span><i class="${escapeHtml(item.icon || "fa-solid fa-circle-info")}"></i></span>
                <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><small>${escapeHtml(item.time)}</small></div>
            </button>
        `).join("") : `<p class="mobile-notifications-empty">No new notifications</p>`;
        if (ui.notificationDot) ui.notificationDot.hidden = notifications.length === 0;
    }

    function notify(payload = {}) {
        const item = {
            id: `mobile-note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: String(payload.title || "PortfoliOS"),
            body: String(payload.body || ""),
            icon: String(payload.icon || "fa-solid fa-circle-info"),
            appId: payload.appId || null,
            time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        };
        notifications.unshift(item);
        notifications.splice(12);
        renderNotifications();
        if (!prefs.dnd && payload.toast !== false) toast(item.title);
        return item.id;
    }

    function clearNotifications() {
        notifications.length = 0;
        renderNotifications();
    }

    function toast(message) {
        const { device } = elements();
        if (!device || !message) return;
        let host = device.querySelector(".mobile-toast");
        if (!host) {
            host = document.createElement("div");
            host.className = "mobile-toast";
            host.setAttribute("role", "status");
            device.appendChild(host);
        }
        host.textContent = String(message);
        host.classList.remove("is-visible");
        requestAnimationFrame(() => host.classList.add("is-visible"));
        clearTimeout(host._hideTimer);
        host._hideTimer = setTimeout(() => host.classList.remove("is-visible"), 2400);
    }

    function setShadeOpen(open) {
        const ui = elements();
        const wasOpen = shadeOpen;
        if (open && !wasOpen) shadeReturnFocus = document.activeElement;
        shadeOpen = Boolean(open);
        if (!ui.shade) return;
        ui.shade.hidden = !shadeOpen;
        ui.shade.classList.toggle("is-open", shadeOpen);
        ui.shade.setAttribute("aria-hidden", String(!shadeOpen));
        ui.statusToggle?.setAttribute("aria-expanded", String(shadeOpen));
        ui.device?.classList.toggle("mobile-shade-open", shadeOpen);
        syncModalIsolation();
        if (shadeOpen) {
            renderNotifications();
            updateNowPlaying();
            ui.shade.querySelector("button")?.focus?.({ preventScroll: true });
        } else if (wasOpen) {
            const returnTarget = shadeReturnFocus;
            shadeReturnFocus = null;
            if (!isLockOpen() && !visibleAppDialog()) {
                queueMicrotask(() => returnTarget?.isConnected && returnTarget.focus?.({ preventScroll: true }));
            }
        }
    }

    async function requestFullscreen() {
        const target = elements().device || document.documentElement;
        if (document.fullscreenElement) {
            await document.exitFullscreen?.();
            return false;
        }
        if (!target.requestFullscreen) {
            toast("Use Add to Home Screen for an app-like full-screen experience.");
            return false;
        }
        try {
            await target.requestFullscreen({ navigationUI: "hide" });
            return true;
        } catch (error) {
            toast("Full screen was blocked. Try Add to Home Screen instead.");
            return false;
        }
    }

    async function installMobileExperience() {
        if (!deferredInstallPrompt) {
            toast("Use your browser menu and choose Add to Home Screen.");
            return false;
        }
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        return true;
    }

    async function lock() {
        claimNavigation("lock");
        lockReturnFocus = document.activeElement;
        setShadeOpen(false);
        const lockScreen = elements().lock;
        if (!lockScreen) return false;
        lockedTaskId = activeTaskId && tasks.get(activeTaskId)?.status === "running" ? activeTaskId : null;
        lockScreen.hidden = false;
        lockScreen.classList.remove("is-hidden");
        lockScreen.inert = false;
        lockScreen.setAttribute("aria-hidden", "false");
        elements().device?.classList.add("is-locked");
        syncModalIsolation();
        lockScreen.querySelector("[data-mobile-unlock]")?.focus?.({ preventScroll: true });
        if (lockedTaskId) await pauseTask(lockedTaskId, "lock");
        return true;
    }

    async function unlock() {
        const lockScreen = elements().lock;
        if (!lockScreen) return false;
        lockScreen.hidden = true;
        lockScreen.classList.add("is-hidden");
        lockScreen.inert = true;
        lockScreen.setAttribute("aria-hidden", "true");
        elements().device?.classList.remove("is-locked");
        syncModalIsolation();
        const taskId = lockedTaskId;
        lockedTaskId = null;
        let resumed = true;
        if (taskId
            && window.state?.view === "mobile"
            && currentSurface === "app"
            && activeTaskId === taskId
            && tasks.has(taskId)) {
            resumed = await resumeTask(taskId, { reason: "unlock" });
        }
        const returnTarget = lockReturnFocus;
        lockReturnFocus = null;
        queueMicrotask(() => returnTarget?.isConnected && returnTarget.focus?.({ preventScroll: true }));
        return resumed;
    }

    function switchExperience(view) {
        if (!['desktop', 'mobile', 'quick'].includes(view)) return false;
        setShadeOpen(false);
        window.switchView?.(view);
        return true;
    }

    function updateClock() {
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        const date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
        ["mobile-status-time", "mobile-shade-time", "mobile-home-time", "mobile-lock-time"].forEach((id) => {
            const node = document.getElementById(id);
            if (node) node.textContent = time;
        });
        ["mobile-shade-date", "mobile-home-date", "mobile-lock-date"].forEach((id) => {
            const node = document.getElementById(id);
            if (node) node.textContent = date;
        });
    }

    function updateNowPlaying() {
        const state = window.MobileMediaService?.getState?.();
        const player = document.getElementById("mobile-now-playing");
        if (!player) return;
        const hasTrack = Boolean(state?.currentTrack);
        player.classList.toggle("is-hidden", !hasTrack);
        if (!hasTrack) return;
        const title = document.getElementById("mobile-now-playing-title");
        const artist = document.getElementById("mobile-now-playing-artist");
        if (title) title.textContent = state.currentTrack.title || state.currentTrack.name || "Unknown track";
        if (artist) artist.textContent = state.currentTrack.artist || "Local music";
        const toggleIcon = player.querySelector('[data-mobile-media-action="toggle"] i');
        if (toggleIcon) toggleIcon.className = state.isPlaying ? "fa-solid fa-pause" : "fa-solid fa-play";
    }

    async function handleViewChange(view) {
        const targetView = view === "cli" ? "desktop" : view;
        if (targetView === currentExperience) {
            updateClock();
            return;
        }
        currentExperience = targetView;
        claimNavigation(`view:${targetView}`);
        if (targetView !== "mobile") {
            visibilityPausedTaskId = null;
            setShadeOpen(false);
            await suspendTasks("experience-change");
            return;
        }
        const foregroundTask = lastForegroundTaskId ? tasks.get(lastForegroundTaskId) : null;
        if (currentSurface === "app"
            && foregroundTask?.userId === currentMobileUserId
            && getVisibleMobileCatalog().some((app) => app.id === lastForegroundTaskId)) {
            await resumeTask(lastForegroundTaskId, { reason: "experience-return" });
        }
        updateClock();
    }

    async function handleUserChange(user = {}) {
        const nextUserId = user.id || window.state?.currentUserId || "bl4ut0";
        claimNavigation(`user:${nextUserId}`);
        visibilityPausedTaskId = null;
        lockedTaskId = null;
        shadeReturnFocus = null;
        lockReturnFocus = null;
        setShadeOpen(false);
        activeTaskId = null;
        lastForegroundTaskId = null;
        if (window.state) window.state.mobileActiveId = null;
        setSurface("home");

        currentMobileUserId = nextUserId;
        prefs = loadPreferences(nextUserId);
        notifications.length = 0;
        window.MobileMediaService?.stop?.({ clearSelection: true });
        renderMobileApps();
        applyPreferences();
        renderNotifications();
        unlock();

        await suspendTasks("user-change");
        for (const appId of [...tasks.keys()]) await closeTask(appId, "user-change");
        recentOrder = [];
        renderRecents();
    }

    function beginGesture(event) {
        const device = elements().device;
        if (!device || elements().lock?.contains(event.target)) return;
        const recentCard = event.target instanceof Element ? event.target.closest("[data-mobile-recent-card]") : null;
        if (recentCard) {
            gesture = {
                id: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startTime: performance.now(),
                recentCard
            };
            return;
        }
        const rect = device.getBoundingClientRect();
        const topEdge = event.clientY - rect.top <= 34;
        const bottomEdge = rect.bottom - event.clientY <= 48;
        const leftEdge = event.clientX - rect.left <= 24;
        if (!topEdge && !bottomEdge && !leftEdge && !shadeOpen) return;
        gesture = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startTime: performance.now(),
            topEdge,
            bottomEdge,
            leftEdge,
            shadeWasOpen: shadeOpen
        };
    }

    function moveGesture(event) {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) event.preventDefault();
        if (gesture.recentCard && dy < 0) {
            gesture.recentCard.style.transform = `translateY(${Math.max(-140, dy)}px)`;
            gesture.recentCard.style.opacity = String(Math.max(0.25, 1 + dy / 180));
        }
    }

    async function endGesture(event) {
        if (!gesture || gesture.id !== event.pointerId) return;
        const current = gesture;
        gesture = null;
        const dx = event.clientX - current.startX;
        const dy = event.clientY - current.startY;
        const duration = performance.now() - current.startTime;
        if (current.recentCard) {
            const taskId = current.recentCard.dataset.mobileRecentCard;
            if (dy < -76) await closeTask(taskId, "dismiss");
            else {
                current.recentCard.style.transform = "";
                current.recentCard.style.opacity = "";
            }
            return;
        }
        if ((current.topEdge && dy > 48) || (current.shadeWasOpen && dy > 48)) {
            setShadeOpen(true);
            return;
        }
        if (current.shadeWasOpen && dy < -48) {
            setShadeOpen(false);
            return;
        }
        if (current.bottomEdge && dy < -58) {
            if (duration > 360 && Math.abs(dy) > 100) await showMobileRecents();
            else await showMobileHome("gesture");
            return;
        }
        if (current.leftEdge && dx > 64 && Math.abs(dy) < 80) await goBack();
    }

    function bindEvents() {
        document.addEventListener("click", async (event) => {
            if (!(event.target instanceof Element)) return;
            const openButton = event.target.closest("[data-mobile-open]");
            if (openButton) {
                await openMobileApp(openButton.dataset.mobileOpen);
                return;
            }
            if (event.target.closest("[data-mobile-shade-toggle]")) {
                setShadeOpen(!shadeOpen);
                return;
            }
            if (event.target.closest("[data-mobile-shade-close]")) {
                setShadeOpen(false);
                return;
            }
            if (event.target.closest("[data-mobile-home]")) {
                await showMobileHome();
                return;
            }
            if (event.target.closest("[data-mobile-back]")) {
                await goBack();
                return;
            }
            if (event.target.closest("[data-mobile-recents]")) {
                await showMobileRecents();
                return;
            }
            const closeTaskButton = event.target.closest("[data-mobile-close-task]");
            if (closeTaskButton) {
                await closeTask(closeTaskButton.dataset.mobileCloseTask);
                return;
            }
            if (event.target.closest("[data-mobile-clear-recents]")) {
                await clearTasks();
                return;
            }
            const toggleButton = event.target.closest("[data-mobile-toggle]");
            if (toggleButton) {
                await toggleSetting(toggleButton.dataset.mobileToggle);
                return;
            }
            if (event.target.closest("[data-mobile-fullscreen]")) {
                await requestFullscreen();
                return;
            }
            if (event.target.closest("[data-mobile-clear-notifications]")) {
                clearNotifications();
                return;
            }
            if (event.target.closest("[data-mobile-unlock]")) {
                await unlock();
                return;
            }
            const mediaAction = event.target.closest("[data-mobile-media-action]")?.dataset.mobileMediaAction;
            if (mediaAction) {
                if (mediaAction === "toggle") await window.MobileMediaService?.toggle?.();
                else if (mediaAction === "previous") await window.MobileMediaService?.previous?.();
                else if (mediaAction === "next") await window.MobileMediaService?.next?.();
                updateNowPlaying();
                return;
            }
            if (event.target.closest("[data-view]")) setShadeOpen(false);
        });

        document.addEventListener("input", (event) => {
            if (!(event.target instanceof HTMLInputElement)) return;
            if (event.target.matches("[data-mobile-brightness]")) setPreference("brightness", Number(event.target.value));
            if (event.target.matches("[data-mobile-volume]")) window.setDesktopVolume?.(event.target.value);
        });

        const device = elements().device;
        device?.addEventListener("pointerdown", beginGesture);
        device?.addEventListener("pointermove", moveGesture);
        device?.addEventListener("pointerup", endGesture);
        device?.addEventListener("pointercancel", () => { gesture = null; });
        document.addEventListener("keydown", handleModalKeydown, true);
        if (device && typeof MutationObserver === "function") {
            const modalObserver = new MutationObserver(syncModalIsolation);
            modalObserver.observe(device, { subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
        }

        window.addEventListener("online", applyPreferences);
        window.addEventListener("offline", applyPreferences);
        window.addEventListener("beforeinstallprompt", (event) => {
            event.preventDefault();
            deferredInstallPrompt = event;
            notify({ title: "Install PortfoliOS", body: "Add Mobile to your home screen for a standalone phone experience.", icon: "fa-solid fa-download", toast: false });
        });
        window.EventBus?.on("view:changed", handleViewChange);
        window.EventBus?.on("user:changed", handleUserChange);
        window.EventBus?.on("volume:changed", (value) => {
            const slider = document.querySelector("[data-mobile-volume]");
            if (slider) slider.value = String(value);
        });
        window.EventBus?.on("mobile:media-state", updateNowPlaying);
        window.EventBus?.on("mobile:open-app", ({ appId, context } = {}) => openMobileApp(appId, context || {}));
        document.addEventListener("visibilitychange", async () => {
            if (document.hidden) {
                visibilityPausedTaskId = activeTaskId;
                if (activeTaskId) await pauseTask(activeTaskId, "document-hidden");
                return;
            }
            if (!document.hidden && visibilityPausedTaskId) {
                const taskId = visibilityPausedTaskId;
                visibilityPausedTaskId = null;
                if (window.state?.view === "mobile" && currentSurface === "app" && activeTaskId === taskId) {
                    await resumeTask(taskId, { reason: "document-visible" });
                }
            }
        });
        window.addEventListener("pagehide", () => {
            tasks.forEach((task) => { serializeTask(task); });
        });
    }

    function bootMobileOS() {
        renderMobileApps();
        applyPreferences();
        renderNotifications();
        updateClock();
        clearInterval(clockTimer);
        clockTimer = setInterval(updateClock, 30000);
        setSurface("home");
        unlock();
        if (!sessionStorage.getItem("portfolio-mobile-welcomed")) {
            sessionStorage.setItem("portfolio-mobile-welcomed", "1");
            notify({
                title: "Mobile is ready",
                body: "Swipe down for quick settings or use Recents to switch between running apps.",
                icon: "fa-solid fa-mobile-screen-button",
                toast: false
            });
        }
    }

    window.MobileOS = {
        getPreferences: () => ({ ...prefs }),
        setPreference,
        toggleSetting,
        getTasks: () => recentOrder.map((id) => tasks.get(id)).filter(Boolean).map((task) => ({ id: task.id, title: task.app.title, status: task.status, lastActive: task.lastActive })),
        openApp: openMobileApp,
        closeTask,
        clearTasks,
        showHome: showMobileHome,
        showRecents: showMobileRecents,
        goBack,
        notify,
        toast,
        setShadeOpen,
        requestFullscreen,
        install: installMobileExperience,
        lock,
        unlock,
        switchExperience,
        updateNowPlaying
    };
    window.renderMobileApps = renderMobileApps;
    window.openMobileApp = openMobileApp;
    window.showMobileHome = showMobileHome;
    window.showMobileRecents = showMobileRecents;
    window.handleMobileViewChange = handleViewChange;

    bindEvents();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootMobileOS, { once: true });
    else bootMobileOS();
})();
