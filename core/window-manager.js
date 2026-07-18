/**
 * PortfoliOS: Window Manager
 * Manages desktop windows (open, close, minimize, maximize, drag, resize, z-index focus).
 */

window.getDesktopWindowElement = (appId) => {
    const rawId = String(appId || "");
    const escapedId = window.CSS?.escape
        ? window.CSS.escape(rawId)
        : rawId.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    return document.querySelector(`[data-window="${escapedId}"]`);
};

window.focusNextOpenWindow = () => {
    const next = Array.from(state.openApps).find((id) => !state.minimizedApps.has(id));
    state.activeWindow = next || null;
    if (next) {
        const windowEl = window.getDesktopWindowElement(next);
        if (windowEl) windowEl.style.zIndex = String(++state.zIndex);
    }
};

window.appClosePromises = window.appClosePromises || {};
window.appLifecyclePromises = window.appLifecyclePromises || {};

window.openDesktopWindow = async (name, params = null) => {
    if (window.appClosePromises[name]) {
        await window.appClosePromises[name];
    }

    if (window.isAppInstalled && !window.isAppInstalled(name)) {
        if (window.showDesktopToast) {
            window.showDesktopToast(`Application "${name}" is not installed. Please install it from the Store.`);
        }
        return;
    }

    const isModular = window.isModularApp?.(name) === true;
    if (isModular) {
        try {
            if (!window.ensureAppLoaded) throw new Error("The modular app loader is unavailable.");
            await window.ensureAppLoaded(name);
        } catch (error) {
            console.error(`PortfoliOS: Failed to load app "${name}".`, error);
            window.showDesktopToast?.(`Application "${name}" could not be loaded. Check the console for details.`);
            return;
        }
    }

    let windowEl = window.getDesktopWindowElement(name);
    const wasOpen = state.openApps.has(name);
    const wasMinimized = state.minimizedApps.has(name);
    const wasActive = state.activeWindow === name && !wasMinimized;
    let wasCreated = false;

    if (!windowEl && window.appRegistry && window.appRegistry[name]) {
        const app = window.appRegistry[name];
        if (window.validateAppRegistration && !window.validateAppRegistration(name, app)) {
            window.showDesktopToast?.(`Application "${name}" failed validation.`);
            return;
        }

        let bodyHtml = "";
        try {
            bodyHtml = app.renderBody();
        } catch (error) {
            console.error(`PortfoliOS: Failed to render app "${name}".`, error);
            window.showDesktopToast?.(`Application "${name}" failed to render.`);
            return;
        }

        if (typeof bodyHtml !== "string") {
            console.error(`PortfoliOS: App "${name}" renderBody must return an HTML string.`);
            window.showDesktopToast?.(`Application "${name}" returned an invalid view.`);
            return;
        }

        const safeTitle = window.escapeHtml ? window.escapeHtml(app.title) : app.title;
        windowEl = document.createElement("section");
        windowEl.className = `desktop-window ${app.windowClass || ""} is-hidden`;
        windowEl.dataset.window = name;
        windowEl.setAttribute("aria-label", `${app.title} window`);

        let iconHtml = "";
        if (/\.(?:png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(app.icon) || app.icon.includes("/")) {
            const safeIcon = window.escapeHtml ? window.escapeHtml(app.icon) : app.icon;
            iconHtml = `<img src="${safeIcon}" class="window-title-icon" alt="" />`;
        } else {
            const safeIconClass = window.escapeHtml ? window.escapeHtml(app.icon) : app.icon;
            iconHtml = `<i class="${safeIconClass}"></i>`;
        }

        windowEl.innerHTML = `
            <div class="window-bar">
                <span>${iconHtml} ${safeTitle}</span>
                <div class="window-actions">
                    <button type="button" data-minimize-window="${name}" title="Minimize ${safeTitle}" aria-label="Minimize ${safeTitle}">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                    <button type="button" data-maximize-window="${name}" title="Maximize ${safeTitle}" aria-label="Maximize ${safeTitle}">
                        <i class="fa-regular fa-square"></i>
                    </button>
                    <button type="button" data-close-window="${name}" title="Close ${safeTitle}" aria-label="Close ${safeTitle}">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            ${bodyHtml}
        `;

        const container = document.querySelector(".desktop-wallpaper")
            || (window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience"));
        if (container) {
            container.appendChild(windowEl);
            wasCreated = true;
            const surface = container.classList.contains("desktop-wallpaper")
                ? container
                : document.querySelector(".desktop-wallpaper") || container;
            const mobileQuery = window.matchMedia("(max-width: 820px)");
            window.setupSingleWindowManagement(windowEl, surface, mobileQuery);
        } else {
            console.error(`PortfoliOS: No desktop surface is available for app "${name}".`);
            window.showDesktopToast?.(`Application "${name}" could not find the desktop surface.`);
            return;
        }
    }

    if (!windowEl) {
        console.error(`PortfoliOS: No window or modular registration exists for app "${name}".`);
        window.showDesktopToast?.(`Application "${name}" is unavailable.`);
        return;
    }
    state.openApps.add(name);
    state.minimizedApps.delete(name);
    state.activeWindow = name;
    windowEl.classList.remove("is-hidden", "is-minimized");
    document.querySelectorAll(".desktop-window").forEach((item) => item.classList.remove("active"));
    windowEl.classList.add("active");
    windowEl.style.zIndex = String(++state.zIndex);
    window.clampDesktopWindowToBounds?.(windowEl);
    
    if (window.renderTaskbar) window.renderTaskbar();
    if (window.EventBus) {
        if (!wasOpen) window.EventBus.emit("app:opened", name);
        else if (wasMinimized) window.EventBus.emit("app:restored", name);
        else if (!wasActive) window.EventBus.emit("app:focused", name);
    }

    if (name === "store" && window.renderStore) {
        window.renderStore();
    }

    if (name === "browser" && window.renderBrowserPage) {
        window.renderBrowserPage(state.browserBookmark);
    }

    if (name === "cli" && window.startCliIntro) {
        if (!state.cliIntroStarted) {
            state.cliIntroStarted = true;
            window.startCliIntro();
        }
        const termInput = window.byId ? window.byId("terminal-input") : document.getElementById("terminal-input");
        window.setTimeout(() => termInput?.focus({ preventScroll: true }), 50);
    }

    if (windowEl && params) {
        windowEl.launchParams = params;
        windowEl.dispatchEvent(new CustomEvent("launch-params", { detail: params }));
    }

    if (wasCreated || !wasOpen) {
        const lifecyclePromise = window.runAppLifecycleHook
            ? window.runAppLifecycleHook(name, "onOpen", windowEl, { reason: "open" })
            : Promise.resolve();
        window.appLifecyclePromises[name] = lifecyclePromise;
        try {
            await lifecyclePromise;
        } finally {
            if (window.appLifecyclePromises[name] === lifecyclePromise) {
                delete window.appLifecyclePromises[name];
            }
        }
    } else {
        if (window.appLifecyclePromises[name]) {
            await window.appLifecyclePromises[name];
        }
        if (wasMinimized) {
            await window.runAppLifecycleHook?.(name, "onRestore", windowEl, { reason: "restore" });
        } else if (!wasActive) {
            await window.runAppLifecycleHook?.(name, "onFocus", windowEl, { reason: "focus" });
        }
    }

    return windowEl;
};

window.minimizeDesktopWindow = (name) => {
    const windowEl = window.getDesktopWindowElement(name);
    if (!windowEl) return;
    state.minimizedApps.add(name);
    windowEl.classList.add("is-hidden", "is-minimized");
    windowEl.classList.remove("active");
    if (state.activeWindow === name) window.focusNextOpenWindow();
    
    window.runAppLifecycleHook?.(name, "onMinimize", windowEl);
    
    if (window.renderTaskbar) window.renderTaskbar();
    if (window.EventBus) window.EventBus.emit("app:minimized", name);
};

window.closeDesktopWindow = (name) => {
    if (window.appClosePromises[name]) return window.appClosePromises[name];

    const windowEl = window.getDesktopWindowElement(name);
    if (!windowEl) return Promise.resolve();
    state.openApps.delete(name);
    state.minimizedApps.delete(name);
    
    // Hide the window immediately so the UI is responsive
    windowEl.classList.add("is-hidden");
    windowEl.classList.remove("active", "is-maximized");
    if (state.activeWindow === name) window.focusNextOpenWindow();
    
    if (name === "browser") {
        const iframe = windowEl.querySelector(".browser-frame");
        if (iframe) {
            iframe.src = "";
        }
    }

    if (window.renderTaskbar) window.renderTaskbar();

    const closePromise = (async () => {
        try {
            await (window.runAppLifecycleHook
                ? window.runAppLifecycleHook(name, "onClose", windowEl, { rethrow: true, reason: "close" })
                : Promise.resolve());
        } catch (error) {
            console.error(`PortfoliOS: App "${name}" failed while closing.`, error);
        } finally {
            if (window.isModularApp?.(name)) {
                window.unloadModularApp?.(name);
            }
            delete window.appLifecyclePromises[name];
            if (window.EventBus) window.EventBus.emit("app:closed", name);
            delete window.appClosePromises[name];
        }
    })();

    window.appClosePromises[name] = closePromise;
    return closePromise;
};

window.toggleMaximizeWindow = async (name) => {
    await window.openDesktopWindow(name);
    const windowEl = window.getDesktopWindowElement(name);
    if (!windowEl) return;

    const surface = document.querySelector(".desktop-wallpaper") || windowEl.parentElement || document.body;
    const willMaximize = !windowEl.classList.contains("is-maximized");
    if (willMaximize) {
        window.freezeWindowGeometry(windowEl, surface);
        windowEl.classList.add("is-maximized");
    } else {
        windowEl.classList.remove("is-maximized");
        window.clampDesktopWindowToBounds?.(windowEl, surface);
    }

    await window.runAppLifecycleHook?.(name, "onMaximize", windowEl, { isMaximized: willMaximize });
    if (window.EventBus) window.EventBus.emit("app:maximized", name);
};

window.handleTaskbarApp = (name) => {
    if (!state.openApps.has(name) || state.minimizedApps.has(name)) {
        window.openDesktopWindow(name);
        return;
    }

    if (state.activeWindow === name) {
        window.minimizeDesktopWindow(name);
        return;
    }

    window.openDesktopWindow(name);
};

window.switchView = (view) => {
    const targetView = view === "cli" ? "desktop" : view;
    state.view = targetView;
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.viewPanel === targetView);
    });
    document.querySelectorAll(".mode-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.view === targetView);
    });
    
    const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
    const calendarPanel = window.byId ? window.byId("calendar-panel") : document.getElementById("calendar-panel");
    if (startMenu) startMenu.hidden = true;
    if (calendarPanel) calendarPanel.hidden = true;
    if (window.closeVolumePanel) window.closeVolumePanel();
    
    document.body.dataset.view = targetView;
    try {
        const url = new URL(window.location.href);
        url.searchParams.set("view", targetView);
        window.history.replaceState({ ...(window.history.state || {}), view: targetView }, "", url);
    } catch (error) {}
    if (view === "cli") {
        window.openDesktopWindow("cli");
    }
    if (targetView === "quick" && window.renderQuick) {
        window.renderQuick();
        const quickSearch = window.byId ? window.byId("quick-search") : document.getElementById("quick-search");
        quickSearch?.focus({ preventScroll: true });
    }
    if (window.EventBus) window.EventBus.emit("view:changed", view);
};

window.getDesktopBounds = (surface) => {
    const taskbar = document.querySelector(".os-taskbar");
    const taskbarHeight = taskbar ? taskbar.offsetHeight : 0;
    return {
        width: surface.offsetWidth,
        height: surface.offsetHeight,
        usableHeight: Math.max(260, surface.offsetHeight - taskbarHeight - 10)
    };
};

window.freezeWindowGeometry = (windowEl, surface) => {
    const scale = window.getDesktopScale ? window.getDesktopScale() : 1;
    const rect = windowEl.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    windowEl.style.left = `${(rect.left - surfaceRect.left) / scale}px`;
    windowEl.style.top = `${(rect.top - surfaceRect.top) / scale}px`;
    windowEl.style.width = `${rect.width / scale}px`;
    windowEl.style.height = `${rect.height / scale}px`;
    windowEl.style.right = "auto";
    windowEl.style.bottom = "auto";
};

window.clampDesktopWindowToBounds = (windowEl, surface = null) => {
    if (!windowEl || windowEl.classList.contains("is-hidden") || windowEl.classList.contains("is-maximized")) return;

    const desktopSurface = surface
        || document.querySelector(".desktop-wallpaper")
        || windowEl.parentElement
        || document.body;
    const bounds = window.getDesktopBounds(desktopSurface);
    const scale = window.getDesktopScale ? window.getDesktopScale() : 1;
    const rect = windowEl.getBoundingClientRect();
    const surfaceRect = desktopSurface.getBoundingClientRect();
    const currentLeft = Number.isFinite(parseFloat(windowEl.style.left))
        ? parseFloat(windowEl.style.left)
        : (rect.left - surfaceRect.left) / scale;
    const currentTop = Number.isFinite(parseFloat(windowEl.style.top))
        ? parseFloat(windowEl.style.top)
        : (rect.top - surfaceRect.top) / scale;
    const currentWidth = rect.width / scale;
    const currentHeight = rect.height / scale;
    const maxWidth = Math.max(240, bounds.width - 16);
    const maxHeight = Math.max(180, bounds.usableHeight - 16);
    const nextWidth = Math.min(currentWidth, maxWidth);
    const nextHeight = Math.min(currentHeight, maxHeight);
    const maxLeft = Math.max(8, bounds.width - nextWidth - 8);
    const maxTop = Math.max(8, bounds.usableHeight - nextHeight);
    const nextLeft = Math.max(8, Math.min(maxLeft, currentLeft));
    const nextTop = Math.max(8, Math.min(maxTop, currentTop));

    if (Math.abs(nextLeft - currentLeft) > 0.5) windowEl.style.left = `${nextLeft}px`;
    if (Math.abs(nextTop - currentTop) > 0.5) windowEl.style.top = `${nextTop}px`;
    if (Math.abs(nextWidth - currentWidth) > 0.5) windowEl.style.width = `${nextWidth}px`;
    if (Math.abs(nextHeight - currentHeight) > 0.5) windowEl.style.height = `${nextHeight}px`;
    if (
        Math.abs(nextLeft - currentLeft) > 0.5
        || Math.abs(nextTop - currentTop) > 0.5
        || Math.abs(nextWidth - currentWidth) > 0.5
        || Math.abs(nextHeight - currentHeight) > 0.5
    ) {
        windowEl.style.right = "auto";
        windowEl.style.bottom = "auto";
    }
};

window.setupSingleWindowManagement = (windowEl, surface, mobileQuery) => {
    const bar = windowEl.querySelector(".window-bar");
    if (!bar) return;

    if (!windowEl.querySelector(".resize-handle")) {
        const handle = document.createElement("span");
        handle.className = "resize-handle";
        handle.setAttribute("aria-hidden", "true");
        windowEl.appendChild(handle);
    }

    bar.addEventListener("pointerdown", (event) => {
        if (mobileQuery.matches || event.button !== 0 || event.target.closest("button, a")) return;
        if (windowEl.classList.contains("is-maximized")) return;
        event.preventDefault();
        window.openDesktopWindow(windowEl.dataset.window);
        window.freezeWindowGeometry(windowEl, surface);
        windowEl.classList.add("is-dragging");

        const bounds = window.getDesktopBounds(surface);
        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = parseFloat(windowEl.style.left) || 0;
        const startTop = parseFloat(windowEl.style.top) || 0;
        const startWidth = windowEl.offsetWidth;
        const startHeight = windowEl.offsetHeight;

        const move = (moveEvent) => {
            const scale = window.getDesktopScale ? window.getDesktopScale() : 1;
            const dx = (moveEvent.clientX - startX) / scale;
            const dy = (moveEvent.clientY - startY) / scale;
            const nextLeft = Math.max(8 - startWidth + 100, Math.min(bounds.width - 100, startLeft + dx));
            const nextTop = Math.max(8, Math.min(bounds.usableHeight - 40, startTop + dy));
            windowEl.style.left = `${nextLeft}px`;
            windowEl.style.top = `${nextTop}px`;
        };

        const stop = () => {
            windowEl.classList.remove("is-dragging");
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", stop);
            document.removeEventListener("pointercancel", stop);
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", stop);
        document.addEventListener("pointercancel", stop);
    });

    windowEl.querySelector(".resize-handle").addEventListener("pointerdown", (event) => {
        if (mobileQuery.matches || event.button !== 0) return;
        if (windowEl.classList.contains("is-maximized")) return;
        event.preventDefault();
        event.stopPropagation();
        window.openDesktopWindow(windowEl.dataset.window);
        window.freezeWindowGeometry(windowEl, surface);
        windowEl.classList.add("is-resizing");

        const bounds = window.getDesktopBounds(surface);
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = windowEl.offsetWidth;
        const startHeight = windowEl.offsetHeight;
        const left = parseFloat(windowEl.style.left) || 0;
        const top = parseFloat(windowEl.style.top) || 0;
        const computedStyle = window.getComputedStyle(windowEl);
        const declaredMinWidth = parseFloat(computedStyle.minWidth);
        const declaredMinHeight = parseFloat(computedStyle.minHeight);
        const availableWidth = Math.max(240, bounds.width - left - 16);
        const availableHeight = Math.max(220, bounds.usableHeight - top);
        const minWidth = Math.min(
            Math.max(240, Number.isFinite(declaredMinWidth) ? declaredMinWidth : 240),
            availableWidth
        );
        const minHeight = Math.min(
            Math.max(220, Number.isFinite(declaredMinHeight) ? declaredMinHeight : 220),
            availableHeight
        );

        const move = (moveEvent) => {
            const scale = window.getDesktopScale ? window.getDesktopScale() : 1;
            const dx = (moveEvent.clientX - startX) / scale;
            const dy = (moveEvent.clientY - startY) / scale;
            const maxWidth = Math.max(minWidth, bounds.width - left - 8);
            const maxHeight = Math.max(minHeight, bounds.usableHeight - top);
            const nextWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + dx));
            const nextHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + dy));
            windowEl.style.width = `${nextWidth}px`;
            windowEl.style.height = `${nextHeight}px`;
        };

        const stop = () => {
            windowEl.classList.remove("is-resizing");
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", stop);
            document.removeEventListener("pointercancel", stop);
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", stop);
        document.addEventListener("pointercancel", stop);
    });
};

window.initWindowManagement = () => {
    const surface = document.querySelector(".desktop-wallpaper");
    const mobileQuery = window.matchMedia("(max-width: 820px)");
    if (!surface) return;

    document.querySelectorAll(".desktop-window").forEach((windowEl) => {
        window.setupSingleWindowManagement(windowEl, surface, mobileQuery);
    });
};
