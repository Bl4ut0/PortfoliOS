/**
 * PortfoliOS: Desktop Settings Component
 * Renders wallpaper picker cards and custom themes customization panels.
 */

window.renderWallpaperOptions = () => {
    const container = window.byId ? window.byId("wallpaper-options") : document.getElementById("wallpaper-options");
    if (!container) return;

    const wallpaperOptions = window.wallpaperOptions || [];

    container.innerHTML = wallpaperOptions.map((wallpaper) => `
        <button type="button" class="wallpaper-card ${state.wallpaper === wallpaper.id ? "active" : ""}"
            data-wallpaper-choice="${wallpaper.id}" title="Use ${wallpaper.label} wallpaper">
            <div class="wallpaper-preview" data-preview-wallpaper="${wallpaper.id}"></div>
            <div class="wallpaper-card-info">
                <i class="${wallpaper.icon}"></i>
                <span>${wallpaper.label}</span>
            </div>
        </button>
    `).join("");
};

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("wallpaper:changed", () => window.renderWallpaperOptions());
    window.EventBus.on("desktop:refresh", () => window.renderWallpaperOptions());
}
