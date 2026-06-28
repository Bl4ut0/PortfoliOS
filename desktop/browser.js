/**
 * PortfoliOS: In-App Web Browser Component
 * Emulates a mini web browser, displaying bookmarks, and loading iframe-friendly targets.
 */

window.renderBrowser = () => {
    const rawBookmarks = window.browserBookmarks || [];
    const browserBookmarks = rawBookmarks.filter(b => !window.isVisibleForCurrentUser || window.isVisibleForCurrentUser(b.systemId));
    const bookmarksContainer = window.byId ? window.byId("browser-bookmarks") : document.getElementById("browser-bookmarks");
    if (bookmarksContainer) {
        bookmarksContainer.innerHTML = browserBookmarks.map((bookmark) => `
            <button type="button" class="${bookmark.id === state.browserBookmark ? "active" : ""}"
                data-browser-bookmark="${bookmark.id}">
                ${window.getAppIconHtml(bookmark.icon)}
                ${bookmark.label}
            </button>
        `).join("");
    }
    window.renderBrowserPage(state.browserBookmark);
};

window.renderBrowserPage = (id) => {
    const rawBookmarks = window.browserBookmarks || [];
    const browserBookmarks = rawBookmarks.filter(b => !window.isVisibleForCurrentUser || window.isVisibleForCurrentUser(b.systemId));
    const systems = window.systems || [];
    
    let bookmark = window.bookmarkById ? window.bookmarkById(id) : null;
    if (!bookmark || !browserBookmarks.some(b => b.id === bookmark.id)) {
        bookmark = browserBookmarks[0];
    }
    if (!bookmark) return;
    
    const item = (window.systemById ? window.systemById(bookmark.systemId) : null) || systems[0];
    if (!item) return;

    const isExternal = bookmark.url.startsWith("http");
    const canEmbed = Boolean(bookmark.embeddable && isExternal);
    const browserPage = window.byId ? window.byId("browser-page") : document.getElementById("browser-page");
    if (!browserPage) return;

    state.browserBookmark = bookmark.id;
    state.activeId = item.id;
    
    const addressBar = window.byId ? window.byId("browser-address") : document.getElementById("browser-address");
    if (addressBar) addressBar.textContent = bookmark.url;
    
    browserPage.classList.toggle("has-frame", canEmbed);

    const browserWindow = document.querySelector('[data-window="browser"]');
    const isBrowserOpen = browserWindow && !browserWindow.classList.contains("is-hidden");

    browserPage.innerHTML = canEmbed ? `
        <iframe class="browser-frame" ${isBrowserOpen ? `src="${bookmark.url}"` : `data-src="${bookmark.url}"`} title="${bookmark.label} embedded preview"
            loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    ` : `
        <div class="browser-fallback is-primary">
            <div class="browser-page-header">
                <span class="project-icon-large" style="color:${item.color}">
                    <i class="${bookmark.icon}"></i>
                </span>
                <div>
                    <p class="eyebrow">${isExternal ? "Top-Level Launch" : "Internal Route"}</p>
                    <h2>${bookmark.label}</h2>
                    <p>${bookmark.url}</p>
                </div>
            </div>
            <p>${isExternal
                ? "This site needs top-level browser navigation or blocks iframes, so the OS keeps the context here and opens the live site in a real tab."
                : item.summary}</p>
            <div class="detail-block">
                <h3>Connected node</h3>
                <p>${item.signal}</p>
            </div>
            <div class="browser-support-grid">
                <span><i class="fa-solid fa-user"></i> Per-user client session</span>
                <span><i class="fa-solid fa-window-maximize"></i> External tab supported</span>
                <span><i class="fa-solid fa-shield-halved"></i> No shared streamed browser</span>
            </div>
            <div class="dossier-links">
                ${isExternal ? `
                <a href="${bookmark.url}" target="_blank" rel="noreferrer">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    Open live site
                </a>
            ` : `<span class="status-pill" data-status="${item.status}">${item.status}</span>`}
            </div>
        </div>
    `;
    
    document.querySelectorAll("[data-browser-bookmark]").forEach((button) => {
        button.classList.toggle("active", button.dataset.browserBookmark === bookmark.id);
    });
};
