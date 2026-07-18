(function() {
    const APP_ID = "media";
    const PICTURES_ROOT = "/Pictures";
    const imageExtensions = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i;
    let rootEl = null;
    let eventController = null;
    let unsubscribeFs = null;
    let objectUrls = new Map();
    let selectedPath = "";
    let renderGeneration = 0;

    const escapeHtml = (value) => window.PortfolioOSMobileFramework?.escapeHtml?.(value)
        || String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
        })[character]);

    function isHiddenOrSystemArtwork(record) {
        const path = String(record?.path || "").replace(/\\/g, "/");
        const hasHiddenSegment = path.split("/").filter(Boolean).some((segment) => segment.startsWith("."));
        const metadataKind = String(record?.metadata?.kind || "").toLowerCase();
        return hasHiddenSegment
            || path.toLowerCase().startsWith("/music/.artwork/")
            || ["album-artwork", "music-artwork-root"].includes(metadataKind);
    }

    function isImage(record) {
        return record && !record.isDirectory
            && !isHiddenOrSystemArtwork(record)
            && (String(record.type || "").startsWith("image/") || imageExtensions.test(record.name || ""));
    }

    function toBlob(record) {
        if (record?.data instanceof Blob) return record.data;
        if (record?.data instanceof ArrayBuffer || ArrayBuffer.isView(record?.data)) {
            return new Blob([record.data], { type: record.type || "application/octet-stream" });
        }
        return null;
    }

    function revokeUrls() {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        objectUrls.clear();
    }

    function urlFor(record) {
        if (objectUrls.has(record.path)) return objectUrls.get(record.path);
        const blob = toBlob(record);
        if (!blob) return "";
        const url = URL.createObjectURL(blob);
        objectUrls.set(record.path, url);
        return url;
    }

    function formatDate(value) {
        try {
            return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(value || Date.now());
        } catch (error) {
            return "Local image";
        }
    }

    function setNotice(message = "", isError = false) {
        const notice = rootEl?.querySelector("[data-gallery-notice]");
        if (!notice) return;
        notice.textContent = message;
        notice.classList.toggle("is-error", isError);
        notice.hidden = !message;
    }

    async function uniquePath(name) {
        const clean = String(name || "image")
            .replace(/[\\/:*?"<>|]/g, "-")
            .replace(/\s+/g, " ")
            .trim() || "image";
        const dot = clean.lastIndexOf(".");
        const base = dot > 0 ? clean.slice(0, dot) : clean;
        const extension = dot > 0 ? clean.slice(dot) : "";
        let candidate = `${PICTURES_ROOT}/${clean}`;
        let index = 2;
        while (await window.SystemFS.readFile(candidate)) {
            candidate = `${PICTURES_ROOT}/${base} ${index}${extension}`;
            index += 1;
        }
        return candidate;
    }

    async function refresh() {
        if (!rootEl || !window.SystemFS) return;
        const generation = ++renderGeneration;
        const grid = rootEl.querySelector("[data-gallery-grid]");
        if (!grid) return;
        grid.innerHTML = '<div class="mobile-gallery-empty"><i class="fa-solid fa-spinner fa-spin"></i><span>Scanning local pictures</span></div>';
        try {
            const records = (await window.SystemFS.getAllFiles())
                .filter(isImage)
                .sort((a, b) => Number(b.lastModified || 0) - Number(a.lastModified || 0));
            if (generation !== renderGeneration || !rootEl?.isConnected) return;
            revokeUrls();
            grid.innerHTML = records.length ? records.map((record) => {
                const url = urlFor(record);
                return `
                    <button type="button" class="mobile-gallery-item" data-gallery-open="${escapeHtml(record.path)}" aria-label="Open ${escapeHtml(record.name)}">
                        ${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(record.name)}" loading="lazy">` : '<i class="fa-solid fa-image"></i>'}
                        <span>${escapeHtml(record.name)}</span>
                    </button>
                `;
            }).join("") : `
                <div class="mobile-gallery-empty"><i class="fa-regular fa-images"></i><strong>No pictures yet</strong><span>Add photos or open an image from Files.</span></div>
            `;
            const count = rootEl.querySelector("[data-gallery-count]");
            if (count) count.textContent = `${records.length} image${records.length === 1 ? "" : "s"}`;
        } catch (error) {
            if (generation !== renderGeneration) return;
            grid.innerHTML = '<div class="mobile-gallery-empty"><i class="fa-solid fa-triangle-exclamation"></i><strong>Gallery unavailable</strong></div>';
            setNotice(error.message || "Pictures could not be loaded.", true);
        }
    }

    async function openImage(path) {
        const record = await window.SystemFS?.readFile(path);
        if (!isImage(record) || !rootEl) return false;
        const url = urlFor(record);
        if (!url) return false;
        selectedPath = record.path;
        const viewer = rootEl.querySelector("[data-gallery-viewer]");
        const image = viewer?.querySelector("img");
        const name = viewer?.querySelector("[data-gallery-viewer-name]");
        const detail = viewer?.querySelector("[data-gallery-viewer-detail]");
        if (image) {
            image.src = url;
            image.alt = record.name;
        }
        if (name) name.textContent = record.name;
        if (detail) detail.textContent = `${formatDate(record.lastModified)} · ${Math.max(1, Math.round((record.size || 0) / 1024))} KB`;
        viewer?.removeAttribute("hidden");
        rootEl.querySelector("[data-gallery-main]")?.setAttribute("hidden", "");
        viewer?.querySelector("[data-gallery-close]")?.focus({ preventScroll: true });
        return true;
    }

    function closeViewer() {
        if (!rootEl || !selectedPath) return false;
        selectedPath = "";
        rootEl.querySelector("[data-gallery-viewer]")?.setAttribute("hidden", "");
        rootEl.querySelector("[data-gallery-main]")?.removeAttribute("hidden");
        return true;
    }

    async function importImages(files) {
        const images = [...(files || [])].filter((file) => file.type.startsWith("image/") || imageExtensions.test(file.name));
        if (!images.length) {
            setNotice("Choose one or more supported image files.", true);
            return;
        }
        await window.SystemFS.ensureDirectory(PICTURES_ROOT, { silent: true });
        for (const file of images) {
            const path = await uniquePath(file.name);
            await window.SystemFS.writeFile(path, window.SystemFS.getName(path), PICTURES_ROOT, file, file.size, file.type || "application/octet-stream", false, {
                metadata: { kind: "picture", originalName: file.name }
            });
        }
        setNotice(`Added ${images.length} image${images.length === 1 ? "" : "s"} to Pictures.`);
        await refresh();
    }

    async function applyIntent(context = {}) {
        const intent = window.MobileFileIntents?.consume?.(APP_ID, context) || context.intent || context;
        if (intent?.path) return openImage(intent.path);
        return false;
    }

    async function mount(root, context = {}) {
        rootEl = root;
        eventController?.abort();
        eventController = new AbortController();
        const { signal } = eventController;
        root.addEventListener("click", async (event) => {
            const item = event.target.closest("[data-gallery-open]");
            if (item) {
                await openImage(item.dataset.galleryOpen);
                return;
            }
            if (event.target.closest("[data-gallery-close]")) {
                closeViewer();
                return;
            }
            if (event.target.closest("[data-gallery-import]")) root.querySelector("[data-gallery-input]")?.click();
            if (event.target.closest("[data-gallery-files]")) {
                const intent = {
                    type: "file",
                    action: "browse",
                    targetApp: "files",
                    sourceApp: APP_ID,
                    path: PICTURES_ROOT,
                    name: "Pictures",
                    mimeType: "inode/directory",
                    kind: "directory",
                    issuedAt: Date.now()
                };
                window.openMobileApp?.("files", { intent, launchContext: { intent } });
            }
        }, { signal });
        root.addEventListener("change", async (event) => {
            if (!event.target.matches("[data-gallery-input]")) return;
            await importImages(event.target.files);
            event.target.value = "";
        }, { signal });
        unsubscribeFs?.();
        unsubscribeFs = window.EventBus?.on("fs:changed", ({ path = "", parent = "" } = {}) => {
            if (path.startsWith(PICTURES_ROOT) || parent.startsWith(PICTURES_ROOT)) refresh();
        }) || null;
        if (!await applyIntent(context)) await refresh();
    }

    window.mobileAppRegistry[APP_ID] = {
        title: "Gallery",
        icon: "fa-solid fa-images",
        viewClass: "mobile-media-app",
        render: () => `
            <section class="mobile-gallery-main" data-gallery-main>
                <header class="mobile-gallery-hero">
                    <span><i class="fa-solid fa-images"></i></span>
                    <div><p>On this device</p><h2>Gallery</h2><small data-gallery-count>0 images</small></div>
                </header>
                <div class="mobile-gallery-actions">
                    <button type="button" data-gallery-import><i class="fa-solid fa-plus"></i><span>Add images</span></button>
                    <button type="button" data-gallery-files><i class="fa-solid fa-folder-open"></i><span>Pictures folder</span></button>
                    <input type="file" data-gallery-input accept="image/*,.svg" multiple hidden>
                </div>
                <p class="mobile-gallery-notice" data-gallery-notice role="status" hidden></p>
                <div class="mobile-gallery-grid" data-gallery-grid></div>
            </section>
            <section class="mobile-gallery-viewer" data-gallery-viewer hidden>
                <header><button type="button" data-gallery-close aria-label="Back to Gallery"><i class="fa-solid fa-arrow-left"></i></button><div><strong data-gallery-viewer-name>Image</strong><small data-gallery-viewer-detail></small></div></header>
                <div><img alt=""></div>
            </section>
        `,
        onOpen: mount,
        onResume: async (root, context = {}) => {
            rootEl = root;
            if (!await applyIntent(context) && !selectedPath) await refresh();
        },
        onBack: () => closeViewer(),
        onClose: () => {
            renderGeneration++;
            eventController?.abort();
            eventController = null;
            unsubscribeFs?.();
            unsubscribeFs = null;
            revokeUrls();
            selectedPath = "";
            rootEl = null;
        }
    };
})();
