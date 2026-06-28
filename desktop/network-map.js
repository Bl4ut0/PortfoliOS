/**
 * PortfoliOS: Network Map Component
 * Renders the visual network graph showing nodes representing portfolio segments connected to the central Dev Hub.
 */

window.renderNetworkMap = () => {
    const map = window.byId ? window.byId("network-map") : document.getElementById("network-map");
    if (!map) return;

    const systems = window.getVisibleSystems ? window.getVisibleSystems() : (window.systems || []);
    const desktopApps = systems.filter(item => !item.mobileOnly);
    
    const nodes = desktopApps.map((item) => `
        <button class="map-node" data-select="${item.id}" data-open-app="${item.launchApp || "dossier"}"
            style="left:${item.position[0]}%; top:${item.position[1]}%; --node-color:${item.color}">
            ${window.getAppIconHtml(item.icon)}
            <span><strong>${item.title}</strong><small>${item.status}</small></span>
        </button>
    `).join("");

    const devhub = systems.find(s => s.id === "devhub");
    const center = devhub ? devhub.position : [50, 50];
    
    const lines = desktopApps
        .filter((item) => item.id !== "devhub")
        .map((item) => {
            const dx = item.position[0] - center[0];
            const dy = item.position[1] - center[1];
            const length = Math.sqrt((dx * dx) + (dy * dy));
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            return `<span class="map-line" style="left:${center[0]}%; top:${center[1]}%; width:${length}%; transform:rotate(${angle}deg)"></span>`;
        }).join("");

    map.innerHTML = lines + nodes;
};
