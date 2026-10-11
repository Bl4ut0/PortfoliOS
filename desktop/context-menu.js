/**
 * PortfoliOS: Context Menu Component
 * Custom right-click context menu offering actions based on the target (desktop icon, window bar, link, input).
 */

window.closeContextMenu = (restoreFocus = false) => {
    const menu = window.byId ? window.byId("desktop-context-menu") : document.getElementById("desktop-context-menu");
    if (menu) { menu.hidden = true; if (restoreFocus && menu._returnFocus?.isConnected) menu._returnFocus.focus({preventScroll:true}); menu._contextItems = null; }
};

window.closeVolumePanel = () => {
    const panel = window.byId ? window.byId("volume-panel") : document.getElementById("volume-panel");
    if (panel) panel.hidden = true;
    const volToggle = window.byId ? window.byId("volume-toggle") : document.getElementById("volume-toggle");
    volToggle?.setAttribute("aria-expanded", "false");
};

window.toggleVolumePanel = () => {
    const panel = window.byId ? window.byId("volume-panel") : document.getElementById("volume-panel");
    if (!panel) return;
    const nextHidden = !panel.hidden;
    panel.hidden = nextHidden;
    const volToggle = window.byId ? window.byId("volume-toggle") : document.getElementById("volume-toggle");
    volToggle?.setAttribute("aria-expanded", String(!nextHidden));
    
    const calPanel = window.byId ? window.byId("calendar-panel") : document.getElementById("calendar-panel");
    const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
    if (calPanel) calPanel.hidden = true;
    if (startMenu) startMenu.hidden = true;
    window.closeContextMenu();
};

window.openDesktopSettings = async (panel = "desktop") => {
    if (window.openDesktopWindow) await window.openDesktopWindow("settings");
    if (window.openSettingsPanel) window.openSettingsPanel(panel);
    window.closeVolumePanel();
    window.closeContextMenu();
};

window.getContextMenuItems = (event) => {
    const windowBar = event.target.closest(".desktop-window .window-bar");
    const desktopWindow = event.target.closest(".desktop-window");
    const appContextTarget = event.target.closest("[data-app-context]");
    const desktopIcon = event.target.closest(".desktop-icon");
    const taskbarApp = event.target.closest("[data-taskbar-app]");
    const link = event.target.closest("a[href]");
    const input = event.target.closest("input, textarea");
    const selection = window.getSelection()?.toString().trim();
    // Preserve native editing/selection controls, including password fields.
    if (event.target.closest('input, textarea, [contenteditable="true"]')) return null;
    const storeCard = event.target.closest('[data-store-context]');
    const launcher = event.target.closest('#start-menu [data-open-app]');
    if (storeCard || launcher) {
        const id = storeCard?.dataset.storeContext || launcher.dataset.openApp;
        const selectId = launcher?.dataset.select || '';
        const installed = Boolean(window.isAppInstalled?.(id));
        const storeApp = (window.storeApps || []).find(app => app.id === id);
        if (!installed) return storeApp?.installable !== false && storeApp ? [{label:'Install',icon:'fa-solid fa-download',disabled:state.installingApps?.[id] !== undefined,action:()=>window.installApp(id)}] : [];
        return [
            {label:'Open',icon:'fa-solid fa-up-right-from-square',action:()=>{if(selectId)window.renderDossier?.(selectId);return window.openDesktopWindow(id);}},
            {label:'Send to Desktop (create shortcut)',icon:'fa-solid fa-desktop',action:()=>window.createDesktopAppShortcut(id,selectId)}
        ];
    }

    if (desktopWindow && appContextTarget) {
        const app = window.appRegistry?.[desktopWindow.dataset.window];
        if (typeof app?.getContextMenuItems === "function") {
            const appItems = app.getContextMenuItems(appContextTarget, event, desktopWindow);
            if (Array.isArray(appItems) && appItems.length) return appItems;
        }
    }

    if (windowBar && desktopWindow) {
        const name = desktopWindow.dataset.window;
        const app = window.appById ? window.appById(name) : null;
        return [
            { label: `Copy "${app?.title || name}"`, icon: "fa-regular fa-copy", action: () => window.copyText(app?.title || name) },
            { type: "separator" },
            { label: "Minimize", icon: "fa-solid fa-minus", action: () => window.minimizeDesktopWindow(name) },
            { label: desktopWindow.classList.contains("is-maximized") ? "Restore" : "Maximize", icon: "fa-regular fa-square", action: () => window.toggleMaximizeWindow(name) },
            { label: "Close", icon: "fa-solid fa-xmark", action: () => window.closeDesktopWindow(name) }
        ];
    }

    if (desktopIcon?.dataset.desktopPath && !desktopIcon.dataset.openApp) {
        const path = desktopIcon.dataset.desktopPath;
        return [
            {label:'Open',icon:'fa-solid fa-folder-open',action:()=>window.openDesktopFile(path)},
            {label:'Manage in File Explorer',icon:'fa-solid fa-folder',action:()=>window.openDesktopFile('/Desktop')}
        ];
    }
    if (desktopIcon?.hasAttribute('data-desktop-create-folder')) return [{label:'New folder',icon:'fa-solid fa-folder-plus',action:()=>window.createDesktopFolder()}];
    if (desktopIcon) {
        const appName = desktopIcon.dataset.openApp;
        const selectId = desktopIcon.dataset.select;
        const label = desktopIcon.textContent.trim();
        return [
            { label: "Open", icon: "fa-solid fa-up-right-from-square", action: () => {
                if (selectId && window.renderDossier) window.renderDossier(selectId);
                if (window.openDesktopWindow) window.openDesktopWindow(appName);
            } },
            ...(desktopIcon.dataset.desktopPath ? [{label:'Remove shortcut',icon:'fa-solid fa-trash-can',action:()=>window.removeDesktopShortcut(desktopIcon.dataset.desktopPath)}] : []),
            { label: `Copy "${label}"`, icon: "fa-regular fa-copy", action: () => window.copyText(label) },
            { type: "separator" },
            { label: "Settings", icon: "fa-solid fa-sliders", action: window.openDesktopSettings }
        ];
    }

    if (taskbarApp) {
        const name = taskbarApp.dataset.taskbarApp;
        return [
            { label: state.minimizedApps.has(name) ? "Restore" : "Focus", icon: "fa-solid fa-window-restore", action: () => window.openDesktopWindow(name) },
            { label: "Send to Desktop (create shortcut)", icon: "fa-solid fa-desktop", action: () => window.createDesktopAppShortcut(name) },
            { label: "Minimize", icon: "fa-solid fa-minus", action: () => window.minimizeDesktopWindow(name) },
            { label: "Close", icon: "fa-solid fa-xmark", action: () => window.closeDesktopWindow(name) }
        ];
    }

    if (link) {
        return [
            { label: "Copy link", icon: "fa-solid fa-link", action: () => window.copyText(link.href) },
            { label: "Open link", icon: "fa-solid fa-up-right-from-square", action: () => window.open(link.href, "_blank", "noopener,noreferrer") }
        ];
    }

    if (desktopWindow) {
        const name = desktopWindow.dataset.window;
        const app = window.appById ? window.appById(name) : null;
        return [
            { label: selection ? "Copy selection" : "Copy window title", icon: "fa-regular fa-copy", action: () => window.copyText(selection || app?.title || name) },
            { label: "Paste", icon: "fa-regular fa-clipboard", disabled: !input, action: () => window.pasteIntoInput(input) },
            { type: "separator" },
            { label: "Minimize", icon: "fa-solid fa-minus", action: () => window.minimizeDesktopWindow(name) },
            { label: "Maximize", icon: "fa-regular fa-square", action: () => window.toggleMaximizeWindow(name) },
            { label: "Close", icon: "fa-solid fa-xmark", action: () => window.closeDesktopWindow(name) }
        ];
    }

    return [
        {label:'New folder',icon:'fa-solid fa-folder-plus',action:()=>window.createDesktopFolder()},
        {label:'Open Desktop folder',icon:'fa-solid fa-folder-open',action:()=>window.openDesktopFile('/Desktop')},
        {type:'separator'},
        { label: "Task Manager", icon: "fa-solid fa-microchip", action: () => {
            if (window.openDesktopWindow) window.openDesktopWindow("taskmgr");
        } },
        { type: "separator" },
        { label: "Paste", icon: "fa-regular fa-clipboard", action: () => window.pasteIntoInput(document.activeElement) },
        { label: "Refresh desktop", icon: "fa-solid fa-rotate-right", action: () => { 
            if (window.renderDesktopIcons) window.renderDesktopIcons(); 
            if (window.renderTaskbar) window.renderTaskbar(); 
            if (window.showDesktopToast) window.showDesktopToast("Desktop refreshed"); 
        } },
        { label: "Reset icon positions", icon: "fa-solid fa-grip", action: async () => {
            if (window.clearDesktopIconPositions) {try {await window.clearDesktopIconPositions();} catch(error) {window.showDesktopToast?.(error.message);return;}}
            if (window.renderDesktopIcons) window.renderDesktopIcons();
            if (window.showDesktopToast) window.showDesktopToast("Icon positions reset");
        } },
        { type: "separator" },
        { label: "Settings", icon: "fa-solid fa-sliders", action: window.openDesktopSettings },
        { label: "Copy page link", icon: "fa-regular fa-copy", action: () => window.copyText(window.location.href) }
    ];
};

window.copyText = async (text) => {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        if (window.showDesktopToast) window.showDesktopToast("Copied");
    } catch (error) {
        if (window.showDesktopToast) window.showDesktopToast("Copy unavailable");
    }
};

window.pasteIntoInput = async (target) => {
    if (!target || !("value" in target)) {
        if (window.showDesktopToast) window.showDesktopToast("No text field focused");
        return;
    }
    try {
        const text = await navigator.clipboard.readText();
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        target.value = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.focus();
        if (window.showDesktopToast) window.showDesktopToast("Pasted");
    } catch (error) {
        if (window.showDesktopToast) window.showDesktopToast("Paste unavailable");
    }
};

window.showContextMenu = (event) => {
    const desktop = window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience");
    const menu = window.byId ? window.byId("desktop-context-menu") : document.getElementById("desktop-context-menu");
    if (!desktop || !menu || desktop.classList.contains('is-hidden') || !event.target.closest("#desktop-experience")) return;
    const items = window.getContextMenuItems(event);
    if (!items?.length) { window.closeContextMenu(); return; }
    event.preventDefault();
    menu._returnFocus = event.target.closest('button, a, [tabindex]') || document.activeElement;
    menu._contextOwner = state.currentUserId;
    const escapeHtml = window.escapeHtml || ((value) => String(value));
    const renderItems = (entries, parentPath = "") => entries.map((item, index) => {
        if (item.type === "separator") return '<div class="context-separator" role="separator"></div>';
        const itemPath = parentPath ? `${parentPath}.${index}` : String(index);
        const safeLabel = escapeHtml(item.label || "");
        const safeIcon = escapeHtml(item.icon || "fa-regular fa-circle");
        if (Array.isArray(item.children) && item.children.length) {
            return `<div class="context-menu-entry has-submenu">
                <button type="button" role="menuitem" aria-haspopup="menu">
                    <i class="${safeIcon}"></i><span>${safeLabel}</span><i class="fa-solid fa-chevron-right context-submenu-arrow"></i>
                </button>
                <div class="context-submenu" role="menu">${renderItems(item.children, itemPath)}</div>
            </div>`;
        }
        return `<button type="button" role="menuitem" data-context-path="${itemPath}" ${item.disabled ? "disabled" : ""}>
            <i class="${safeIcon}"></i><span>${safeLabel}</span>
        </button>`;
    }).join("");
    menu.innerHTML = renderItems(items);
    menu.classList.toggle("submenu-left", event.clientX > window.innerWidth / 2);
    menu.hidden = false;

    const scale = window.getDesktopScale ? window.getDesktopScale() : 1;
    const desktopRect = desktop.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const x = Math.min((event.clientX - desktopRect.left) / scale, (desktopRect.width - menuRect.width) / scale - 8);
    const y = Math.min((event.clientY - desktopRect.top) / scale, (desktopRect.height - menuRect.height) / scale - 8);
    menu.style.left = `${Math.max(8, x)}px`;
    menu.style.top = `${Math.max(8, y)}px`;
    menu._contextItems = items;
    menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
};

// Event Delegation for context menu item click
document.addEventListener("click", (event) => {
    const item = event.target.closest("#desktop-context-menu button[data-context-path]");
    if (!item) return;
    const menu = window.byId ? window.byId("desktop-context-menu") : document.getElementById("desktop-context-menu");
    if (!menu) return;
    const path = String(item.dataset.contextPath || "").split(".").map((part) => parseInt(part, 10));
    let contextItem = null;
    let entries = menu._contextItems;
    path.forEach((index) => {
        contextItem = entries?.[index] || null;
        entries = contextItem?.children;
    });
    const owner = menu._contextOwner;
    window.closeContextMenu(true);
    if (owner === state.currentUserId && !contextItem?.disabled && typeof contextItem?.action === "function") {
        Promise.resolve().then(() => { if (owner === state.currentUserId) return contextItem.action(); })
            .catch(error => {if(owner === state.currentUserId) window.showDesktopToast?.(error.message || 'Action failed');});
    }
});

// Trigger context menu on right click
document.addEventListener("contextmenu", (event) => {
    window.showContextMenu(event);
});

// One delegated menu for the Desktop shell; app-specific providers take precedence.
document.addEventListener('keydown', event => {
    const menu = document.getElementById('desktop-context-menu');
    if (!menu || menu.hidden) {
        if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
            const target = document.activeElement;
            if (!target?.closest('#desktop-experience')) return;
            const rect = target.getBoundingClientRect();
            window.showContextMenu({target,clientX:rect.left+16,clientY:rect.top+16,preventDefault:()=>event.preventDefault()});
        }
        return;
    }
    if (event.key === 'Escape' || event.key === 'Tab') {window.closeContextMenu(true);if(event.key==='Escape')event.preventDefault();return;}
    const active = document.activeElement, group = active?.closest('[role="menu"]') || menu;
    const buttons = [...group.querySelectorAll(':scope > button:not(:disabled), :scope > .context-menu-entry > button:not(:disabled)')];
    let next;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') next = buttons[(buttons.indexOf(active) + (event.key==='ArrowDown'?1:-1) + buttons.length) % buttons.length];
    if (event.key === 'Home') next = buttons[0];
    if (event.key === 'End') next = buttons.at(-1);
    if (event.key === 'ArrowRight') next = active?.parentElement.querySelector('.context-submenu button:not(:disabled)');
    if (event.key === 'ArrowLeft' && group !== menu) next = group.parentElement.querySelector(':scope > button');
    if (next) {event.preventDefault();next.focus({preventScroll:true});}
});
window.addEventListener('resize', () => window.closeContextMenu());
window.EventBus?.on('user:changed', () => window.closeContextMenu());
