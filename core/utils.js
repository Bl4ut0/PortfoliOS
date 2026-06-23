/**
 * PortfoliOS: Utility Functions
 * General helper functions used across various systems.
 */

window.byId = (id) => document.getElementById(id);

window.getDesktopScale = () => {
    const experience = document.getElementById("desktop-experience");
    if (!experience) return 1;
    const rect = experience.getBoundingClientRect();
    const offsetW = experience.offsetWidth;
    if (!offsetW) return 1;
    return rect.width / offsetW;
};

window.systemById = (id) => window.systems ? window.systems.find((item) => item.id === id) : null;
window.appById = (id) => window.desktopApps ? window.desktopApps.find((item) => item.id === id) : null;
window.bookmarkById = (id) => window.browserBookmarks ? window.browserBookmarks.find((item) => item.id === id) : null;
window.quickRouteById = (id) => window.quickRoutes ? window.quickRoutes.find((item) => item.id === id) : null;

window.getAppIconHtml = (iconClassOrUrl, extraClass = "") => {
    if (!iconClassOrUrl) return "";
    if (iconClassOrUrl.startsWith(".") || iconClassOrUrl.startsWith("/") || iconClassOrUrl.startsWith("http") || iconClassOrUrl.includes(".")) {
        return `<img src="${iconClassOrUrl}" class="app-icon-img ${extraClass}" alt="Icon" />`;
    }
    return `<i class="${iconClassOrUrl} ${extraClass}"></i>`;
};

window.formatBytes = (sizeBytes) => {
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "unknown";
    if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
    if (sizeBytes >= 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${sizeBytes} bytes`;
};

window.loadScript = (src) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
};
