/**
 * PortfoliOS: Toast Notification Component
 * Displays temporary alert overlays on the desktop.
 */

window.showDesktopToast = (message) => {
    const toast = window.byId ? window.byId("desktop-toast") : document.getElementById("desktop-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(window.showDesktopToast.timer);
    window.showDesktopToast.timer = window.setTimeout(() => {
        toast.hidden = true;
    }, 1800);
};
