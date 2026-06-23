/**
 * PortfoliOS: Window Manager
 * Manages desktop windows (open, close, minimize, maximize, drag, resize, z-index focus).
 */

window.focusNextOpenWindow = () => {
    const next = Array.from(state.openApps).find((id) => !state.minimizedApps.has(id));
    state.activeWindow = next || null;
    if (next) {
        const windowEl = document.querySelector(`[data-window="${next}"]`);
        if (windowEl) windowEl.style.zIndex = String(++state.zIndex);
    }
};

window.openDesktopWindow = async (name) => {
    if (window.isAppInstalled && !window.isAppInstalled(name)) {
        if (window.showDesktopToast) {
            window.showDesktopToast(`Application "${name}" is not installed. Please install it from the Store.`);
        }
        return;
    }

    if (window.modularApps && window.modularApps.includes(name) && window.ensureAppLoaded) {
        await window.ensureAppLoaded(name);
    }

    let windowEl = document.querySelector(`[data-window="${name}"]`);
    if (!windowEl && window.appRegistry && window.appRegistry[name]) {
        const app = window.appRegistry[name];
        windowEl = document.createElement("section");
        windowEl.className = `desktop-window ${app.windowClass || ""} is-hidden`;
        windowEl.dataset.window = name;
        windowEl.setAttribute("aria-label", `${app.title} window`);

        let iconHtml = "";
        if (app.icon.endsWith(".png") || app.icon.endsWith(".jpg") || app.icon.includes("/")) {
            iconHtml = `<img src="${app.icon}" class="window-title-icon" alt="" />`;
        } else {
            iconHtml = `<i class="${app.icon}"></i>`;
        }

        windowEl.innerHTML = `
            <div class="window-bar">
                <span>${iconHtml} ${app.title}</span>
                <div class="window-actions">
                    <button type="button" data-minimize-window="${name}" title="Minimize ${app.title}">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                    <button type="button" data-maximize-window="${name}" title="Maximize ${app.title}">
                        <i class="fa-regular fa-square"></i>
                    </button>
                    <button type="button" data-close-window="${name}" title="Close ${app.title}">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            ${app.renderBody()}
        `;

        const container = window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience");
        if (container) {
            container.appendChild(windowEl);
            const surface = document.querySelector(".desktop-wallpaper");
            const mobileQuery = window.matchMedia("(max-width: 820px)");
            window.setupSingleWindowManagement(windowEl, surface, mobileQuery);
        }
    }

    if (!windowEl) return;
    state.openApps.add(name);
    state.minimizedApps.delete(name);
    state.activeWindow = name;
    windowEl.classList.remove("is-hidden", "is-minimized");
    document.querySelectorAll(".desktop-window").forEach((item) => item.classList.remove("active"));
    windowEl.classList.add("active");
    windowEl.style.zIndex = String(++state.zIndex);
    
    if (window.renderTaskbar) window.renderTaskbar();
    if (window.EventBus) window.EventBus.emit("app:opened", name);

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

    if (window.appRegistry && window.appRegistry[name] && typeof window.appRegistry[name].onOpen === "function") {
        window.appRegistry[name].onOpen(windowEl);
    }
};

window.minimizeDesktopWindow = (name) => {
    const windowEl = document.querySelector(`[data-window="${name}"]`);
    if (!windowEl) return;
    state.minimizedApps.add(name);
    windowEl.classList.add("is-hidden", "is-minimized");
    windowEl.classList.remove("active");
    if (state.activeWindow === name) window.focusNextOpenWindow();
    
    if (window.appRegistry && window.appRegistry[name] && typeof window.appRegistry[name].onMinimize === "function") {
        window.appRegistry[name].onMinimize(windowEl);
    }
    
    if (window.renderTaskbar) window.renderTaskbar();
    if (window.EventBus) window.EventBus.emit("app:minimized", name);
};

window.closeDesktopWindow = (name) => {
    const windowEl = document.querySelector(`[data-window="${name}"]`);
    if (!windowEl) return;
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

    let closePromise = Promise.resolve();
    if (window.appRegistry && window.appRegistry[name] && typeof window.appRegistry[name].onClose === "function") {
        try {
            const result = window.appRegistry[name].onClose(windowEl);
            if (result instanceof Promise) {
                closePromise = result;
            }
        } catch (e) {
            console.error("Error in app onClose:", name, e);
        }
    }

    closePromise.then(() => {
        if (window.modularApps && window.modularApps.includes(name)) {
            const el = document.querySelector(`[data-window="${name}"]`);
            if (el) el.remove();
            const scriptEl = document.getElementById(`app-script-${name}`);
            if (scriptEl) {
                scriptEl.remove();
            }
            if (window.appRegistry) delete window.appRegistry[name];
        }
        if (window.renderTaskbar) window.renderTaskbar();
        if (window.EventBus) window.EventBus.emit("app:closed", name);
    }).catch((err) => {
        console.error("Error in onClose promise resolution:", name, err);
        if (window.modularApps && window.modularApps.includes(name)) {
            const el = document.querySelector(`[data-window="${name}"]`);
            if (el) el.remove();
            const scriptEl = document.getElementById(`app-script-${name}`);
            if (scriptEl) {
                scriptEl.remove();
            }
            if (window.appRegistry) delete window.appRegistry[name];
        }
        if (window.renderTaskbar) window.renderTaskbar();
        if (window.EventBus) window.EventBus.emit("app:closed", name);
    });
};

window.toggleMaximizeWindow = (name) => {
    const windowEl = document.querySelector(`[data-window="${name}"]`);
    if (!windowEl) return;
    window.openDesktopWindow(name);
    windowEl.classList.toggle("is-maximized");
    if (window.appRegistry && window.appRegistry[name] && typeof window.appRegistry[name].onMaximize === "function") {
        window.appRegistry[name].onMaximize(windowEl);
    }
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
        const minWidth = Math.min(320, Math.max(240, bounds.width - left - 16));
        const minHeight = windowEl.classList.contains("game-window") || (window.modularApps && window.modularApps.includes(windowEl.dataset.window)) ? 360 : 220;

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
