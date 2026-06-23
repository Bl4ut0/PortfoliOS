/**
 * PortfoliOS: Mobile View Orchestrator
 * Renders the simulated mobile phone screen app grid, status reads, and touch nav interactions.
 */

window.renderMobileApps = () => {
    const grid = window.byId ? window.byId("mobile-app-grid") : document.getElementById("mobile-app-grid");
    if (!grid) return;
    
    const systems = window.systems || [];
    const mobileApps = systems.filter(item => !item.desktopOnly);
    
    grid.innerHTML = mobileApps.map((item) => `
        <button class="mobile-app-icon" type="button" data-mobile-open="${item.id}" style="--tile-color:${item.color}">
            ${window.getAppIconHtml(item.icon)}
            <span>${item.title}</span>
        </button>
    `).join("");
};

window.openMobileApp = (id) => {
    const systems = window.systems || [];
    const item = (window.systemById ? window.systemById(id) : null) || systems[0];
    if (!item) return;

    state.mobileActiveId = item.id;
    state.activeId = item.id;
    
    const appTitle = window.byId ? window.byId("mobile-app-title") : document.getElementById("mobile-app-title");
    const mobileHome = window.byId ? window.byId("mobile-home") : document.getElementById("mobile-home");
    const mobileAppView = window.byId ? window.byId("mobile-app-view") : document.getElementById("mobile-app-view");
    const appContent = window.byId ? window.byId("mobile-app-content") : document.getElementById("mobile-app-content");

    if (appTitle) appTitle.textContent = item.title;
    if (mobileHome) mobileHome.classList.add("is-hidden");
    if (mobileAppView) mobileAppView.classList.remove("is-hidden");

    if (appContent) {
        if (item.id === "flappybird") {
            appContent.style.padding = "0";
            appContent.innerHTML = `<canvas id="flappy-canvas" style="display:block; width:100%; height:100%; background:#70c5ce; touch-action:none;"></canvas>`;
            
            const initFlappy = () => {
                if (typeof startFlappyBird === "function") {
                    startFlappyBird("flappy-canvas");
                }
            };

            if (typeof startFlappyBird !== "function" && window.loadScript) {
                window.loadScript("flappy.js")
                    .then(initFlappy)
                    .catch(err => {
                        console.error(err);
                        appContent.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444;">Failed to load Flappy Bird.</div>`;
                    });
            } else {
                initFlappy();
            }
        } else {
            appContent.style.padding = "";
            appContent.innerHTML = window.renderSystemArticle(item, "mobile");
        }
    }
};

window.showMobileHome = () => {
    state.mobileActiveId = null;
    
    const mobileHome = window.byId ? window.byId("mobile-home") : document.getElementById("mobile-home");
    const mobileAppView = window.byId ? window.byId("mobile-app-view") : document.getElementById("mobile-app-view");
    const appContent = window.byId ? window.byId("mobile-app-content") : document.getElementById("mobile-app-content");

    if (mobileHome) mobileHome.classList.remove("is-hidden");
    if (mobileAppView) mobileAppView.classList.add("is-hidden");
    if (appContent) appContent.innerHTML = "";
};
