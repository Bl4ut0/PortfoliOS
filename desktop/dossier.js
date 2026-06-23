/**
 * PortfoliOS: Profile/Dossier Viewer
 * Renders detail cards, project summaries, tech tags, and external repository links for system nodes.
 */

window.renderDossier = (id) => {
    const systems = window.systems || [];
    const item = (window.systemById ? window.systemById(id) : null) || systems[0];
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
    const links = item.links.length
        ? item.links.map(([label, href, icon]) => `
            <a href="${href}" target="_blank" rel="noreferrer">
                <i class="${icon}"></i>
                ${label}
            </a>
        `).join("")
        : `<span class="status-pill" data-status="Planned">Internal route</span>`;

    return `
        <div class="${mode}-detail-heading">
            <span class="project-icon-large" style="color:${item.color}">
                ${window.getAppIconHtml(item.icon)}
            </span>
            <div>
                <span class="status-pill" data-status="${item.status}">${item.status}</span>
                <h2>${item.title}</h2>
                <p>${item.type}</p>
            </div>
        </div>
        <p>${item.summary}</p>
        <div class="detail-block">
            <h3>Stack</h3>
            <div class="tag-list">${item.tech.map((tag) => `<span>${tag}</span>`).join("")}</div>
        </div>
        <div class="detail-block">
            <h3>Signal</h3>
            <p>${item.signal}</p>
        </div>
        <div class="dossier-links">${links}</div>
    `;
};
