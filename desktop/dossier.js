/**
 * PortfoliOS: Profile/Dossier Viewer
 * Renders detail cards, project summaries, tech tags, and external repository links for system nodes.
 */

window.renderDossier = (id) => {
    const systems = window.getVisibleSystems ? window.getVisibleSystems() : (window.systems || []);
    const requested = window.systemById ? window.systemById(id) : systems.find((system) => system.id === id);
    const item = (requested && (!window.isVisibleForCurrentUser || window.isVisibleForCurrentUser(requested.id)))
        ? requested
        : systems[0];
    if (!item) return;

    state.activeId = item.id;
    document.documentElement.style.setProperty("--active-color", item.color);

    const dosFile = window.byId ? window.byId("dossier-file") : document.getElementById("dossier-file");
    const dosIcon = window.byId ? window.byId("dossier-icon") : document.getElementById("dossier-icon");
    const dosStatus = window.byId ? window.byId("dossier-status") : document.getElementById("dossier-status");
    const dosTitle = window.byId ? window.byId("dossier-title") : document.getElementById("dossier-title");
    const dosType = window.byId ? window.byId("dossier-type") : document.getElementById("dossier-type");
    const dosSummary = window.byId ? window.byId("dossier-summary") : document.getElementById("dossier-summary");
    const dosSignal = window.byId ? window.byId("dossier-signal") : document.getElementById("dossier-signal");
    const dosTech = window.byId ? window.byId("dossier-tech") : document.getElementById("dossier-tech");
    const dosLinks = window.byId ? window.byId("dossier-links") : document.getElementById("dossier-links");

    if (dosFile) dosFile.textContent = `dossier/${item.id}.md`;
    if (dosIcon) dosIcon.innerHTML = `<i class="${item.icon}"></i>`;
    if (dosStatus) {
        dosStatus.textContent = item.status;
        dosStatus.dataset.status = item.status;
    }
    if (dosTitle) dosTitle.textContent = item.title;
    if (dosType) dosType.textContent = item.type;
    if (dosSummary) dosSummary.textContent = item.summary;
    if (dosSignal) dosSignal.textContent = item.signal;
    
    if (dosTech) {
        dosTech.innerHTML = item.tech.map((tag) => `<span>${tag}</span>`).join("");
    }
    
    if (dosLinks) {
        dosLinks.innerHTML = item.links.length
            ? item.links.map(([label, href, icon]) => `
                <a href="${href}" target="_blank" rel="noreferrer">
                    <i class="${icon}"></i>
                    ${label}
                </a>
            `).join("")
            : `<span class="status-pill" data-status="Planned">Internal route</span>`;
    }

    document.querySelectorAll("[data-select]").forEach((element) => {
        element.classList.toggle("active", element.dataset.select === item.id);
    });
};

window.renderSystemArticle = (item, mode = "quick") => {
    const launchButtonHtml = item.launchApp
        ? `<button type="button" class="wiki-action-btn primary" data-launch-app="${item.launchApp}">
               <i class="fa-solid fa-play"></i> Launch Application
           </button>`
        : "";

    const linksHtml = item.links && item.links.length
        ? item.links.map(([label, href, icon]) => `
            <a href="${href}" target="_blank" rel="noreferrer" class="wiki-action-btn">
                <i class="${icon}"></i>
                <span>${label}</span>
            </a>
        `).join("")
        : "";

    const category = item.category || item.type || "System";
    const summary = item.summary || "";
    const overview = item.overview || "";

    const capabilitiesHtml = item.capabilities && item.capabilities.length
        ? `
        <section class="wiki-section">
            <h3 class="wiki-section-heading">
                <i class="fa-solid fa-list-check"></i>
                Key Capabilities & Features
            </h3>
            <div class="wiki-capabilities-grid">
                ${item.capabilities.map((cap) => `
                    <div class="wiki-capability-card">
                        <i class="fa-solid fa-circle-check"></i>
                        <span>${cap}</span>
                    </div>
                `).join("")}
            </div>
        </section>
        `
        : "";

    const architectureHtml = item.architecture
        ? `
        <section class="wiki-section">
            <h3 class="wiki-section-heading">
                <i class="fa-solid fa-network-wired"></i>
                Technical Architecture
            </h3>
            <div class="wiki-prose">
                <p>${item.architecture}</p>
            </div>
        </section>
        `
        : "";

    const engineeringHtml = item.engineeringNotes
        ? `
        <section class="wiki-section wiki-callout">
            <div class="wiki-callout-header">
                <i class="fa-solid fa-microchip"></i>
                <h4>Engineering & Design Notes</h4>
            </div>
            <div class="wiki-prose">
                <p>${item.engineeringNotes}</p>
            </div>
        </section>
        `
        : "";

    const techTagsHtml = item.tech && item.tech.length
        ? `
        <section class="wiki-section">
            <h3 class="wiki-section-heading">
                <i class="fa-solid fa-layer-group"></i>
                Technology Stack & Specifications
            </h3>
            <div class="wiki-tech-tags">
                ${item.tech.map((tag) => `<span class="wiki-tag">${tag}</span>`).join("")}
            </div>
            ${item.signal ? `
                <div class="wiki-signal-row">
                    <span class="wiki-signal-label"><i class="fa-solid fa-satellite-dish"></i> Telemetry / Status:</span>
                    <span class="wiki-signal-value">${item.signal}</span>
                </div>
            ` : ""}
        </section>
        `
        : "";

    return `
        <div class="wiki-article ${mode}-wiki-article" data-wiki-id="${item.id}">
            <nav class="wiki-breadcrumbs" aria-label="Wiki breadcrumbs">
                <span class="crumb-root"><i class="fa-solid fa-book-bookmark"></i> Wiki</span>
                <span class="crumb-sep">/</span>
                <span class="crumb-category">${category}</span>
                <span class="crumb-sep">/</span>
                <span class="crumb-current">${item.title}</span>
            </nav>

            <header class="wiki-header">
                <div class="wiki-header-main">
                    <span class="wiki-hero-icon" style="--node-color:${item.color}">
                        ${window.getAppIconHtml ? window.getAppIconHtml(item.icon, "", item.id) : `<i class="${item.icon}"></i>`}
                    </span>
                    <div class="wiki-header-text">
                        <div class="wiki-status-row">
                            <span class="status-pill" data-status="${item.status}">${item.status}</span>
                            <span class="wiki-category-badge">${category}</span>
                        </div>
                        <h1 class="wiki-title">${item.title}</h1>
                        <p class="wiki-type">${item.type}</p>
                    </div>
                </div>

                ${(launchButtonHtml || linksHtml) ? `
                    <div class="wiki-action-bar">
                        ${launchButtonHtml}
                        ${linksHtml}
                    </div>
                ` : ""}
            </header>

            <section class="wiki-section wiki-overview">
                ${summary ? `<p class="wiki-summary-lead">${summary}</p>` : ""}
                ${overview ? `<div class="wiki-prose"><p>${overview}</p></div>` : ""}
            </section>

            ${capabilitiesHtml}
            ${architectureHtml}
            ${engineeringHtml}
            ${techTagsHtml}
        </div>
    `;
};
