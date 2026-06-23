/**
 * PortfoliOS: Context Menu Component
 * Custom right-click context menu offering actions based on the target (desktop icon, window bar, link, input).
 */

window.closeContextMenu = () => {
    const menu = window.byId ? window.byId("desktop-context-menu") : document.getElementById("desktop-context-menu");
    if (menu) menu.hidden = true;
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

window.openDesktopSettings = () => {
    if (window.openDesktopWindow) window.openDesktopWindow("settings");
    window.closeVolumePanel();
    window.closeContextMenu();
};

window.getContextMenuItems = (event) => {
    const windowBar = event.target.closest(".desktop-window .window-bar");
    const desktopWindow = event.target.closest(".desktop-window");
    const desktopIcon = event.target.closest(".desktop-icon");
    const taskbarApp = event.target.closest("[data-taskbar-app]");
    const link = event.target.closest("a[href]");
    const input = event.target.closest("input, textarea");
    const selection = window.getSelection()?.toString().trim();

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

    if (desktopIcon) {
        const appName = desktopIcon.dataset.openApp;
        const selectId = desktopIcon.dataset.select;
        const label = desktopIcon.textContent.trim();
        return [
            { label: "Open", icon: "fa-solid fa-up-right-from-square", action: () => {
                if (selectId && window.renderDossier) window.renderDossier(selectId);
                if (window.openDesktopWindow) window.openDesktopWindow(appName);
            } },
            { label: `Copy "${label}"`, icon: "fa-regular fa-copy", action: () => window.copyText(label) },
            { type: "separator" },
            { label: "Desktop settings", icon: "fa-solid fa-sliders", action: window.openDesktopSettings }
        ];
    }

    if (taskbarApp) {
        const name = taskbarApp.dataset.taskbarApp;
        return [
            { label: state.minimizedApps.has(name) ? "Restore" : "Focus", icon: "fa-solid fa-window-restore", action: () => window.openDesktopWindow(name) },
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
        { label: "Reset icon positions", icon: "fa-solid fa-grip", action: () => {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith("desktop_pos_")) {
                    localStorage.removeItem(key);
                    i--;
                }
            }
            if (window.renderDesktopIcons) window.renderDesktopIcons();
            if (window.showDesktopToast) window.showDesktopToast("Icon positions reset");
        } },
        { type: "separator" },
        { label: "Desktop settings", icon: "fa-solid fa-sliders", action: window.openDesktopSettings },
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
    if (!desktop || !menu || !event.target.closest("#desktop-experience")) return;
    event.preventDefault();

    const items = window.getContextMenuItems(event);
    menu.innerHTML = items.map((item, index) => item.type === "separator"
        ? `<div class="context-separator" role="separator"></div>`
        : `<button type="button" role="menuitem" data-context-index="${index}" ${item.disabled ? "disabled" : ""}>
            <i class="${item.icon}"></i><span>${item.label}</span>
        </button>`
    ).join("");
    menu.hidden = false;

    const scale = window.getDesktopScale ? window.getDesktopScale() : 1;
    const desktopRect = desktop.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const x = Math.min((event.clientX - desktopRect.left) / scale, (desktopRect.width - menuRect.width) / scale - 8);
    const y = Math.min((event.clientY - desktopRect.top) / scale, (desktopRect.height - menuRect.height) / scale - 8);
    menu.style.left = `${Math.max(8, x)}px`;
    menu.style.top = `${Math.max(8, y)}px`;
    menu._contextItems = items;
};

// Event Delegation for context menu item click
document.addEventListener("click", (event) => {
    const item = event.target.closest("#desktop-context-menu button");
    if (!item) return;
    const menu = window.byId ? window.byId("desktop-context-menu") : document.getElementById("desktop-context-menu");
    if (!menu) return;
    const index = parseInt(item.dataset.contextIndex, 10);
    const contextItem = menu._contextItems?.[index];
    if (contextItem && typeof contextItem.action === "function") {
        contextItem.action();
    }
    menu.hidden = true;
});

// Trigger context menu on right click
document.addEventListener("contextmenu", (event) => {
    window.showContextMenu(event);
});
