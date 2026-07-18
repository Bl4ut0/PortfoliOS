(function() {
    const legacyBookmarkStorageKey = "bl4ut0_mobile_browser_bookmarks";
    let activeController = null;
    let activeRoot = null;
    let selectedId = null;
    let filter = "all";
    let query = "";
    let bookmarks = new Set();

    function escapeHtml(value) {
        return window.PortfolioOSMobileFramework?.escapeHtml?.(value)
            || String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
    }

    function safeUrl(rawUrl) {
        try {
            const url = new URL(String(rawUrl || ""), window.location.href);
            return ["http:", "https:"].includes(url.protocol) ? url.href : null;
        } catch (error) {
            return null;
        }
    }

    function iconHtml(icon) {
        return window.getAppIconHtml?.(icon)
            || `<i class="${escapeHtml(icon || "fa-solid fa-circle-nodes")}"></i>`;
    }

    function currentUserId() {
        const rawId = window.getCurrentUser?.()?.id || window.state?.currentUserId || "bl4ut0";
        return String(rawId).replace(/[^a-z0-9_-]/gi, "") || "bl4ut0";
    }

    function bookmarkStorageKey(userId = currentUserId()) {
        return `bl4ut0_${userId}_mobile_browser_bookmarks`;
    }

    function readStorageValue(key) {
        return window.Storage?.local?.get(key) ?? window.localStorage?.getItem(key);
    }

    function writeStorageValue(key, value) {
        if (window.Storage?.local?.set) window.Storage.local.set(key, value);
        else window.localStorage?.setItem(key, value);
    }

    function readStoredBookmarks() {
        try {
            const userId = currentUserId();
            const scopedKey = bookmarkStorageKey(userId);
            let raw = readStorageValue(scopedKey);
            if (raw == null && userId === "bl4ut0") {
                raw = readStorageValue(legacyBookmarkStorageKey);
                if (raw != null) writeStorageValue(scopedKey, raw);
            }
            const parsed = raw ? JSON.parse(raw) : ["devhub"];
            return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : ["devhub"]);
        } catch (error) {
            return new Set(["devhub"]);
        }
    }

    function saveBookmarks() {
        const value = JSON.stringify([...bookmarks]);
        try {
            writeStorageValue(bookmarkStorageKey(), value);
        } catch (error) {
            console.warn("PortfoliOS Mobile Browser: bookmarks could not be saved.", error);
        }
    }

    function getSystems() {
        const systems = window.getVisibleSystems?.() || window.systems || [];
        return systems.filter((item) =>
            item
            && typeof item.id === "string"
            && (!window.isVisibleForCurrentUser || window.isVisibleForCurrentUser(item.id))
        );
    }

    function isLive(item) {
        return ["online", "active", "stable", "playable", "dev"].includes(String(item.status || "").toLowerCase());
    }

    function getFilteredSystems() {
        const normalizedQuery = query.trim().toLowerCase();
        return getSystems()
            .filter((item) => filter !== "bookmarks" || bookmarks.has(item.id))
            .filter((item) => filter !== "live" || isLive(item))
            .filter((item) => {
                if (!normalizedQuery) return true;
                const searchable = [
                    item.title,
                    item.type,
                    item.status,
                    item.summary,
                    item.signal,
                    ...(item.tech || [])
                ].join(" ").toLowerCase();
                return searchable.includes(normalizedQuery);
            });
    }

    function renderQuickLinks() {
        const targets = window.openTargets || {};
        const links = [
            ["Dev Hub", targets.devhub || "https://bl4ut0.dev", "fa-solid fa-globe"],
            ["GitHub", targets.github || "https://github.com/Bl4ut0", "fa-brands fa-github"],
            ["CurseForge", targets.curseforge || "https://www.curseforge.com/members/bl4ut0/projects", "fa-solid fa-download"],
            ["GuildCraft", targets.guildcraft || "https://dev.guildcraft.io", "fa-solid fa-cubes"]
        ];
        return links.map(([label, href, icon]) => {
            const safeHref = safeUrl(href);
            if (!safeHref) return "";
            return `
                <a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">
                    <i class="${escapeHtml(icon)}"></i>
                    <span>${escapeHtml(label)}</span>
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
            `;
        }).join("");
    }

    function renderResults(root) {
        const results = root?.querySelector("[data-browser-results]");
        const count = root?.querySelector("[data-browser-count]");
        if (!results) return;
        const systems = getFilteredSystems();
        if (count) count.textContent = `${systems.length} ${systems.length === 1 ? "result" : "results"}`;

        results.innerHTML = systems.length ? systems.map((item) => `
            <article class="mobile-browser-result" style="--browser-result-accent:${escapeHtml(item.color || "#38bdf8")}">
                <button type="button" class="mobile-browser-result-main" data-browser-select="${escapeHtml(item.id)}">
                    <span class="mobile-browser-result-icon">${iconHtml(item.icon)}</span>
                    <span>
                        <strong>${escapeHtml(item.title)}</strong>
                        <small>${escapeHtml(item.status || "Unknown")} · ${escapeHtml(item.type || "Portfolio")}</small>
                        <em>${escapeHtml(item.summary || "")}</em>
                    </span>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
                <button type="button" class="mobile-browser-bookmark ${bookmarks.has(item.id) ? "is-bookmarked" : ""}"
                    data-browser-bookmark="${escapeHtml(item.id)}" aria-pressed="${bookmarks.has(item.id)}"
                    title="${bookmarks.has(item.id) ? "Remove bookmark" : "Add bookmark"}">
                    <i class="${bookmarks.has(item.id) ? "fa-solid" : "fa-regular"} fa-star"></i>
                </button>
            </article>
        `).join("") : `
            <div class="mobile-browser-empty">
                <i class="fa-solid fa-magnifying-glass"></i>
                <strong>No portfolio routes found</strong>
                <span>Try another search or filter.</span>
            </div>
        `;
    }

    function updateFilters(root) {
        root?.querySelectorAll("[data-browser-filter]").forEach((button) => {
            const selected = button.dataset.browserFilter === filter;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    function showExplorer(root) {
        selectedId = null;
        root?.querySelector("[data-browser-explorer]")?.classList.remove("is-hidden");
        root?.querySelector("[data-browser-detail]")?.classList.add("is-hidden");
        const search = root?.querySelector("[data-browser-search]");
        search?.focus({ preventScroll: true });
    }

    function showDetail(root, itemId) {
        const item = getSystems().find((system) => system.id === itemId);
        const detail = root?.querySelector("[data-browser-detail]");
        if (!item || !detail) {
            selectedId = null;
            if (detail) {
                detail.innerHTML = "";
                detail.classList.add("is-hidden");
            }
            root?.querySelector("[data-browser-explorer]")?.classList.remove("is-hidden");
            renderResults(root);
            return false;
        }
        selectedId = item.id;

        const links = (item.links || []).map(([label, href, icon]) => {
            const safeHref = safeUrl(href);
            if (!safeHref) return "";
            return `
                <a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">
                    <i class="${escapeHtml(icon || "fa-solid fa-link")}"></i>
                    <span>${escapeHtml(label)}</span>
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
            `;
        }).filter(Boolean).join("");
        const hasMobileApp = (window.mobileAppCatalog || []).some((app) => app.id === item.id && app.id !== "browser");

        detail.innerHTML = `
            <button type="button" class="mobile-browser-back" data-browser-back><i class="fa-solid fa-arrow-left"></i><span>Explore</span></button>
            <header class="mobile-browser-detail-heading" style="--browser-result-accent:${escapeHtml(item.color || "#38bdf8")}">
                <span>${iconHtml(item.icon)}</span>
                <div>
                    <small>${escapeHtml(item.type || "Portfolio")}</small>
                    <h2>${escapeHtml(item.title)}</h2>
                    <em>${escapeHtml(item.status || "Unknown")}</em>
                </div>
            </header>
            <p class="mobile-browser-detail-summary">${escapeHtml(item.summary || "")}</p>
            ${item.signal ? `<section><h3>Current signal</h3><p>${escapeHtml(item.signal)}</p></section>` : ""}
            ${(item.tech || []).length ? `<div class="mobile-browser-tags">${item.tech.map((tech) => `<span>${escapeHtml(tech)}</span>`).join("")}</div>` : ""}
            ${hasMobileApp ? `<button type="button" class="mobile-browser-open-app" data-mobile-open="${escapeHtml(item.id)}"><i class="fa-solid fa-mobile-screen-button"></i><span>Open mobile app</span></button>` : ""}
            <nav class="mobile-browser-detail-links" aria-label="${escapeHtml(item.title)} links">
                ${links || '<span class="mobile-browser-no-links">No public links are listed yet.</span>'}
            </nav>
            <p class="mobile-browser-link-note"><i class="fa-solid fa-shield-halved"></i> Public links open in a separate browser tab. This app does not embed third-party pages.</p>
        `;
        root.querySelector("[data-browser-explorer]")?.classList.add("is-hidden");
        detail.classList.remove("is-hidden");
        detail.scrollTop = 0;
        detail.querySelector("[data-browser-back]")?.focus({ preventScroll: true });
        return true;
    }

    function bind(root) {
        activeController?.abort();
        activeController = new AbortController();
        const { signal } = activeController;
        activeRoot = root;
        bookmarks = readStoredBookmarks();
        query = "";
        filter = "all";
        selectedId = null;

        root.addEventListener("input", (event) => {
            if (!event.target.matches("[data-browser-search]")) return;
            query = event.target.value;
            renderResults(root);
        }, { signal });

        root.addEventListener("click", (event) => {
            const filterButton = event.target.closest("[data-browser-filter]");
            if (filterButton) {
                filter = filterButton.dataset.browserFilter;
                updateFilters(root);
                renderResults(root);
                return;
            }

            const bookmarkButton = event.target.closest("[data-browser-bookmark]");
            if (bookmarkButton) {
                const id = bookmarkButton.dataset.browserBookmark;
                if (bookmarks.has(id)) bookmarks.delete(id);
                else bookmarks.add(id);
                saveBookmarks();
                renderResults(root);
                return;
            }

            const result = event.target.closest("[data-browser-select]");
            if (result) {
                showDetail(root, result.dataset.browserSelect);
                return;
            }

            if (event.target.closest("[data-browser-back]")) showExplorer(root);
        }, { signal });

        updateFilters(root);
        renderResults(root);
    }

    function serializeState() {
        return {
            version: 1,
            query,
            filter,
            selectedId,
            scrollTop: Math.max(0, Number(activeRoot?.parentElement?.scrollTop) || 0)
        };
    }

    function restoreState(root, context = {}) {
        if (context.signal?.aborted) return;
        const saved = context.state;
        if (!saved || typeof saved !== "object" || saved.version !== 1) return;
        activeRoot = root;

        query = typeof saved.query === "string" ? saved.query.slice(0, 160) : "";
        filter = ["all", "bookmarks", "live"].includes(saved.filter) ? saved.filter : "all";
        const search = root.querySelector("[data-browser-search]");
        if (search) search.value = query;
        updateFilters(root);
        renderResults(root);

        const detailRestored = typeof saved.selectedId === "string" && showDetail(root, saved.selectedId);
        if (!detailRestored) showExplorer(root);
        const scrollTop = Number(saved.scrollTop);
        if (Number.isFinite(scrollTop) && scrollTop > 0) {
            window.requestAnimationFrame(() => {
                if (context.signal?.aborted) return;
                root.parentElement?.scrollTo?.({ top: Math.min(scrollTop, 100000) });
            });
        }
    }

    window.mobileAppRegistry.browser = {
        title: "Browser",
        icon: "fa-solid fa-compass",
        viewClass: "mobile-browser-app",
        render: () => `
            <section class="mobile-browser-explorer" data-browser-explorer>
                <header class="mobile-browser-heading">
                    <span><i class="fa-solid fa-compass"></i></span>
                    <div><p>Portfolio network</p><h2>Explore</h2></div>
                </header>
                <label class="mobile-browser-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="search" inputmode="search" autocomplete="off" spellcheck="false" placeholder="Search projects, tools, or stacks" data-browser-search>
                </label>
                <nav class="mobile-browser-quick-links" aria-label="Public bookmarks">
                    ${renderQuickLinks()}
                </nav>
                <div class="mobile-browser-filter-row">
                    <div role="group" aria-label="Browser filters">
                        <button type="button" data-browser-filter="all" aria-pressed="true">All</button>
                        <button type="button" data-browser-filter="bookmarks" aria-pressed="false"><i class="fa-solid fa-star"></i> Saved</button>
                        <button type="button" data-browser-filter="live" aria-pressed="false">Live</button>
                    </div>
                    <small data-browser-count>0 results</small>
                </div>
                <div class="mobile-browser-results" data-browser-results aria-live="polite"></div>
            </section>
            <article class="mobile-browser-detail is-hidden" data-browser-detail></article>
        `,
        onOpen: bind,
        onResume: (root) => {
            bookmarks = readStoredBookmarks();
            if (selectedId) showDetail(root, selectedId);
            else renderResults(root);
        },
        onBack: () => {
            if (!selectedId || !activeRoot) return false;
            showExplorer(activeRoot);
            return true;
        },
        serializeState,
        restoreState,
        onClose: () => {
            activeController?.abort();
            activeController = null;
            activeRoot = null;
            selectedId = null;
        }
    };
})();
