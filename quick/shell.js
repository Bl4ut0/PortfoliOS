/**
 * PortfoliOS: Quick Access View Orchestrator
 * Renders a dashboard layout with route selection, search, and system card filters.
 */

window.isQuickLiveStatus = (item) => {
    return ["Online", "Active", "Stable", "Playable", "Dev"].includes(item.status);
};

window.getQuickRouteItems = () => {
    const route = (window.quickRouteById ? window.quickRouteById(state.quickRoute) : null) || (window.quickRoutes ? window.quickRoutes[0] : null);
    if (!route) return [];

    const query = state.quickSearch.trim().toLowerCase();
    const systems = window.systems || [];
    
    return route.ids
        .map((id) => window.systemById ? window.systemById(id) : systems.find(s => s.id === id))
        .filter(Boolean)
        .filter((item) => {
            if (state.quickFilter === "live") return window.isQuickLiveStatus(item);
            if (state.quickFilter === "planned") return !window.isQuickLiveStatus(item);
            return true;
        })
        .filter((item) => {
            if (!query) return true;
            const searchable = [
                item.title,
                item.type,
                item.status,
                item.summary,
                item.signal,
                item.tech.join(" ")
            ].join(" ").toLowerCase();
            return searchable.includes(query);
        });
};

window.renderQuickOverview = () => {
    const systems = window.systems || [];
    const quickRoutes = window.quickRoutes || [];
    const liveCount = systems.filter(window.isQuickLiveStatus).length;
    const plannedCount = systems.length - liveCount;
    
    const featured = ["devhub", "addons", "guildcraft", "homelab", "wardenit"]
        .map((id) => window.systemById ? window.systemById(id) : systems.find(s => s.id === id))
        .filter(Boolean);

    return `
        <div class="quick-detail-heading">
            <span class="project-icon-large">
                <i class="fa-solid fa-table-cells-large"></i>
            </span>
            <div>
                <span class="status-pill" data-status="Online">Index</span>
                <h2>Bl4ut0 Network</h2>
                <p>Projects, infrastructure, community routes, and professional nodes.</p>
            </div>
        </div>
        <div class="quick-metrics" aria-label="Portfolio summary">
            <span><strong>${systems.length}</strong><small>nodes</small></span>
            <span><strong>${liveCount}</strong><small>live/dev</small></span>
            <span><strong>${plannedCount}</strong><small>staged</small></span>
        </div>
        <div class="quick-route-cards">
            ${quickRoutes.filter((route) => route.id !== "overview").map((route) => `
                <button type="button" data-quick-route="${route.id}">
                    <i class="${route.icon}"></i>
                    <span>${route.label}</span>
                </button>
            `).join("")}
        </div>
        <div class="detail-block">
            <h3>Featured Nodes</h3>
            <div class="quick-node-grid">
                ${featured.map((item) => `
                    <button type="button" data-quick-select="${item.id}" style="--tile-color:${item.color}">
                        <i class="${item.icon}"></i>
                        <span>${item.title}</span>
                    </button>
                `).join("")}
            </div>
        </div>
    `;
};

window.renderQuick = () => {
    const quickRoutes = window.quickRoutes || [];
    const quickFilters = window.quickFilters || [];
    
    const route = (window.quickRouteById ? window.quickRouteById(state.quickRoute) : null) || quickRoutes[0];
    if (!route) return;

    const routeItems = window.getQuickRouteItems();
    const activeItem = state.quickActiveId === "overview" ? null : (window.systemById ? window.systemById(state.quickActiveId) : null);

    const routesContainer = window.byId ? window.byId("quick-routes") : document.getElementById("quick-routes");
    const filtersContainer = window.byId ? window.byId("quick-filters") : document.getElementById("quick-filters");
    const tabsContainer = window.byId ? window.byId("quick-tabs") : document.getElementById("quick-tabs");
    const detailContainer = window.byId ? window.byId("quick-detail") : document.getElementById("quick-detail");

    if (routesContainer) {
        routesContainer.innerHTML = quickRoutes.map((item) => `
            <button type="button" class="${item.id === state.quickRoute ? "active" : ""}" data-quick-route="${item.id}">
                <i class="${item.icon}"></i>
                ${item.label}
            </button>
        `).join("");
    }

    if (filtersContainer) {
        filtersContainer.innerHTML = quickFilters.map((filter) => `
            <button type="button" class="${filter.id === state.quickFilter ? "active" : ""}" data-quick-filter="${filter.id}">
                ${filter.label}
            </button>
        `).join("");
    }

    if (tabsContainer) {
        tabsContainer.innerHTML = routeItems.length
            ? routeItems.map((item) => `
                <button class="quick-item ${item.id === state.quickActiveId ? "active" : ""}" type="button"
                    data-quick-select="${item.id}" style="--tile-color:${item.color}">
                    ${window.getAppIconHtml(item.icon)}
                    <span>
                        <strong>${item.title}</strong>
                        <small>${item.status} / ${item.type}</small>
                    </span>
                </button>
            `).join("")
            : `<p class="quick-empty">No matching nodes in ${route.label}.</p>`;
    }

    if (detailContainer) {
        if (!activeItem || state.quickActiveId === "overview") {
            detailContainer.innerHTML = window.renderQuickOverview();
            return;
        }
        detailContainer.innerHTML = window.renderSystemArticle(activeItem, "quick");
    }
};

// Listen to state changes to update the UI
if (window.EventBus) {
    window.EventBus.on("state:changed:quickRoute", () => window.renderQuick());
    window.EventBus.on("state:changed:quickFilter", () => window.renderQuick());
    window.EventBus.on("state:changed:quickSearch", () => window.renderQuick());
    window.EventBus.on("state:changed:quickActiveId", () => window.renderQuick());
}
