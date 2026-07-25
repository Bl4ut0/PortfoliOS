/** PortfoliOS local-first Security Center. */
(function() {
    const APP_ID = "security-center";
    let unsubscribe = null;

    const escapeHtml = (value) => window.escapeHtml ? window.escapeHtml(value) : String(value ?? "");
    const date = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value) : "Not yet";

    async function render(windowEl) {
        const summary = await window.SecurityKernel?.getSummary?.() || { quarantineCount: 0, localOnly: true, tokenMode: "memory-only" };
        const quarantine = await window.SecurityKernel?.getQuarantine?.() || [];
        const body = windowEl.querySelector("[data-security-center-body]");
        if (!body) return;
        body.innerHTML = `
            <section class="security-center-hero">
                <div><i class="fa-solid fa-shield-halved"></i></div>
                <div><p>Local protection enabled</p><h2>Security Center</h2><small>Files are checked in this browser before they enter SystemFS or Cloud Sync. Nothing is uploaded for scanning.</small></div>
            </section>
            <section class="security-center-stats" aria-label="Security status">
                <article><span>Quarantined</span><strong>${summary.quarantineCount}</strong><small>Awaiting review</small></article>
                <article><span>Cloud token</span><strong>Memory only</strong><small>Sign in per session</small></article>
                <article><span>Last scan</span><strong>${escapeHtml(date(summary.lastScanAt))}</strong><small>Scanner v${escapeHtml(summary.scannerVersion || "1.0.0")}</small></article>
            </section>
            <section class="security-center-actions"><button type="button" data-security-scan><i class="fa-solid fa-magnifying-glass-shield"></i> Scan local workspace</button><button type="button" data-security-refresh><i class="fa-solid fa-rotate"></i> Refresh</button></section>
            <section class="security-center-policy"><h3>Active policy</h3><ul><li>Executable code and WebAssembly are blocked from user file imports.</li><li>HTML and SVG are isolated for review instead of entering the workspace.</li><li>Files over 64 MiB and large archives are quarantined for manual review.</li><li>Cloud Sync uploads only files that pass this local policy.</li></ul></section>
            <section class="security-center-quarantine"><header><h3>Quarantine</h3><span>${summary.quarantineCount} item${summary.quarantineCount === 1 ? "" : "s"}</span></header>
                <div class="security-center-list">${quarantine.length ? quarantine.map((record) => {
                    const security = record.metadata?.security || {};
                    return `<article><div><i class="fa-solid fa-triangle-exclamation"></i></div><div><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(security.reason || "Policy review required.")}</small><small>${escapeHtml(date(record.lastModified))} &middot; ${escapeHtml(security.source || "unknown source")}</small></div><button type="button" data-security-delete="${escapeHtml(record.path)}" aria-label="Delete ${escapeHtml(record.name)}"><i class="fa-solid fa-trash"></i></button></article>`;
                }).join("") : '<div class="security-center-empty"><i class="fa-solid fa-circle-check"></i><span>No files are quarantined.</span></div>'}</div>
            </section>`;
    }

    window.appRegistry[APP_ID] = {
        title: "Security Center",
        icon: "fa-solid fa-shield-halved",
        windowClass: "security-center-window utility-window",
        renderBody: () => '<div class="security-center-shell" data-security-center-body></div>',
        onOpen: async (windowEl) => {
            await window.SecurityKernel?.init?.();
            await render(windowEl);
            if (windowEl.dataset.securityInitialized === "1") return;
            windowEl.dataset.securityInitialized = "1";
            windowEl.addEventListener("click", async (event) => {
                const remove = event.target.closest("[data-security-delete]");
                if (remove) {
                    await window.SecurityKernel.deleteQuarantine(remove.dataset.securityDelete);
                    await render(windowEl);
                    return;
                }
                if (event.target.closest("[data-security-scan]")) {
                    const button = event.target.closest("[data-security-scan]");
                    button.disabled = true;
                    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scanning&hellip;';
                    const result = await window.SecurityKernel.scanWorkspace();
                    window.showDesktopToast?.(`Security scan finished: ${result.accepted} accepted, ${result.quarantined} quarantined.`);
                    await render(windowEl);
                    return;
                }
                if (event.target.closest("[data-security-refresh]")) await render(windowEl);
            });
            unsubscribe = window.EventBus?.on("security:quarantined", () => render(windowEl)) || null;
        },
        onClose: (windowEl) => {
            unsubscribe?.();
            unsubscribe = null;
            windowEl.dataset.securityInitialized = "";
        }
    };
})();
