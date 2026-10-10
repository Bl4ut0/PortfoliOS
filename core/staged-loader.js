/** Deduplicated, retryable stage loading. Prefetch downloads; it never executes a shell. */
(function () {
    const manifest = window.PortfolioLoadingManifest;
    const pending = new Map();
    const mounted = new Set();
    const url = path => path + "?v=" + manifest.release;
    const mark = name => {
        const end = "portfolio:" + name; performance.mark(end);
        let start = name === "selector-ready" ? "portfolio:boot-start" : name.endsWith(":workspace-ready") ? "portfolio:" + name.split(":")[0] + ":workspace-start" : name.endsWith(":login-ready") ? "portfolio:" + name.split(":")[0] + ":selected" : null;
        if (start && performance.getEntriesByName(start).length) performance.measure(end, start, end);
        window.addSystemLog?.("startup", name);
    };
    function once(key, work) {
        if (pending.has(key)) return pending.get(key);
        const promise = work().catch(error => { pending.delete(key); throw error; });
        pending.set(key, promise);
        return promise;
    }
    function script(path) {
        return once("script:" + path, () => new Promise((resolve, reject) => {
            const node = document.createElement("script");
            node.src = url(path); node.async = false;
            node.onload = () => resolve(node);
            node.onerror = () => { node.remove(); reject(new Error("Could not load " + path + ". Check your connection and try again.")); };
            document.head.appendChild(node);
        }));
    }
    function style(path) {
        return once("style:" + path, () => new Promise((resolve, reject) => {
            const node = document.createElement("link"); node.rel = "stylesheet"; node.href = path.startsWith("https:") ? path : url(path);
            node.onload = () => resolve(node);
            node.onerror = () => { node.remove(); reject(new Error("Could not load " + path + ". Check your connection and try again.")); };
            document.head.appendChild(node);
        }));
    }
    const preloaded = new Set();
    function preloadScripts(paths) {
        for (const path of paths) {
            if (path.startsWith("@")) { preloadScripts(manifest.services[path.slice(1)]); continue; }
            if (preloaded.has(path) || pending.has("script:" + path)) continue;
            preloaded.add(path);
            const link = document.createElement("link"); link.rel = "preload"; link.as = "script"; link.href = url(path);
            document.head.appendChild(link);
        }
    }
    async function scripts(paths) {
        // Download each required dependency group concurrently; evaluate in dependency order.
        preloadScripts(paths);
        for (const path of paths) {
            if (path.startsWith("@")) await scripts(manifest.services[path.slice(1)]);
            else await script(path);
            // Give input and painting a chance between dependency groups.
            if (navigator.scheduling?.isInputPending?.()) await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    function markup(path) {
        return once("html:" + path, async () => {
            const response = await fetch(url(path));
            if (!response.ok) throw new Error("Could not load " + path + " (" + response.status + "). Please try again.");
            return response.text();
        });
    }
    function prefetch(view) {
        const shell = manifest.shells[view];
        if (!shell || navigator.connection?.saveData) return;
        for (const path of [...shell.scripts, ...shell.styles, "core/workspace.html", view + "/workspace.html"]) {
            if (document.querySelector('link[data-prefetch-path="' + path + '"]')) continue;
            const link = document.createElement("link"); link.rel = "prefetch"; link.href = url(path); link.dataset.prefetchPath = path;
            link.as = path.endsWith(".js") ? "script" : path.endsWith(".css") ? "style" : "fetch"; document.head.appendChild(link);
        }
    }
    async function login(view) {
        await Promise.all([scripts(manifest.shared), style("styles/session.css"),
            ...(view === "mobile" ? [style("styles/layout.css"), style("styles/mobile.css")] : [])]);
        await window.GDriveSync.restoreSession({ promptOnInvalid: false });
        if (view === "mobile" && !document.getElementById("mobile-device")) {
            const host = document.createElement("div"); host.id = "session-phone"; host.className = "os-shell";
            host.innerHTML = '<main class="workspace"><section class="view active mobile-view"><div class="mobile-stage"><div class="mobile-device" id="mobile-device"></div></div></section></main>';
            document.body.appendChild(host);
        }
        mark(view + ":login-ready");
    }
    async function mount(view) {
        const shell = manifest.shells[view];
        if (!shell) throw new Error("Unknown experience.");
        if (mounted.has(view)) return;
        mark(view + ":mount-start");
        const [base, content] = await Promise.all([markup("core/workspace.html"), markup(view + "/workspace.html"), ...shell.styles.map(style)]);
        if (!document.querySelector(".os-shell:not(#session-phone)")) {
            const template = document.createElement("template"); template.innerHTML = base;
            document.body.appendChild(template.content.cloneNode(true));
        }
        if (!document.querySelector('[data-view-panel="' + view + '"]')) {
            const template = document.createElement("template"); template.innerHTML = content;
            document.querySelector(".os-shell:not(#session-phone) .workspace").appendChild(template.content.cloneNode(true));
        }
        document.querySelectorAll("[data-view-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
        const chooser = document.getElementById("session-chooser");
        if (chooser?.parentElement.closest("#session-phone")) {
            const devices = document.querySelectorAll("#mobile-device"); devices[devices.length - 1].appendChild(chooser);
        }
        document.getElementById("session-phone")?.remove();
        await scripts(shell.scripts);
        await window["mount" + view[0].toUpperCase() + view.slice(1)]?.();
        mounted.add(view);
        mark(view + ":mounted");
    }
    async function loadAppDependencies(id, experience = "desktop") {
        const paths = (experience === "mobile" ? manifest.mobileApps : manifest.desktopApps)[id] || [];
        await scripts(paths);
    }
    window.PortfolioLoader = { manifest, script, style, scripts, prefetch, login, mount, mounted, loadAppDependencies, mark, url };
})();
