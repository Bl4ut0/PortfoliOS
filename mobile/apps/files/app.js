(function() {
    const APP_ID = "files";
    let rootEl = null;
    let currentPath = "/";
    let selectedPath = "";
    let renderGeneration = 0;
    let eventController = null;
    let unsubscribeFs = null;

    const escapeHtml = (value) => window.PortfolioOSMobileFramework?.escapeHtml?.(value)
        || String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
        })[character]);

    function render() {
        return `
            <div class="mobile-files-shell">
                <header class="mobile-files-toolbar">
                    <button type="button" class="mobile-files-up" data-files-up aria-label="Open parent folder">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div class="mobile-files-path" data-files-breadcrumbs aria-label="Current folder"></div>
                    <button type="button" data-files-upload aria-label="Upload files">
                        <i class="fa-solid fa-arrow-up-from-bracket"></i>
                    </button>
                    <input type="file" data-files-input multiple hidden>
                </header>

                <nav class="mobile-files-locations" aria-label="Storage locations">
                    <button type="button" data-files-location="/"><i class="fa-solid fa-hard-drive"></i><span>Storage</span></button>
                    <button type="button" data-files-location="/documents"><i class="fa-solid fa-file-lines"></i><span>Documents</span></button>
                    <button type="button" data-files-location="/music"><i class="fa-solid fa-music"></i><span>Music</span></button>
                </nav>

                <div class="mobile-files-actions" aria-label="Create items">
                    <button type="button" data-files-create="folder"><i class="fa-solid fa-folder-plus"></i>Folder</button>
                    <button type="button" data-files-create="text"><i class="fa-solid fa-file-circle-plus"></i>Text document</button>
                </div>

                <div class="mobile-files-notice" data-files-notice role="status" aria-live="polite"></div>
                <section class="mobile-files-list" data-files-list aria-label="Files and folders"></section>
            </div>

            <section class="mobile-files-sheet" data-files-sheet hidden aria-label="File actions">
                <button type="button" class="mobile-files-sheet-scrim" data-files-dismiss aria-label="Close file actions"></button>
                <div class="mobile-files-sheet-card" role="dialog" aria-modal="true" aria-labelledby="mobile-files-sheet-title">
                    <div class="mobile-files-sheet-handle" aria-hidden="true"></div>
                    <h2 id="mobile-files-sheet-title" data-files-sheet-title>File</h2>
                    <div class="mobile-files-sheet-actions" data-files-sheet-actions></div>
                    <button type="button" class="mobile-files-sheet-cancel" data-files-dismiss>Cancel</button>
                </div>
            </section>

            <section class="mobile-files-dialog" data-files-dialog hidden>
                <button type="button" class="mobile-files-dialog-scrim" data-files-dialog-cancel aria-label="Cancel"></button>
                <form class="mobile-files-dialog-card" data-files-dialog-form role="dialog" aria-modal="true" aria-labelledby="mobile-files-dialog-title">
                    <h2 id="mobile-files-dialog-title" data-files-dialog-title>Create item</h2>
                    <p data-files-dialog-copy></p>
                    <label data-files-dialog-label>
                        <span>Name</span>
                        <input type="text" data-files-dialog-input maxlength="96" autocomplete="off" required>
                    </label>
                    <div class="mobile-files-dialog-error" data-files-dialog-error role="alert"></div>
                    <div class="mobile-files-dialog-actions">
                        <button type="button" data-files-dialog-cancel>Cancel</button>
                        <button type="submit" class="is-primary" data-files-dialog-submit>Create</button>
                    </div>
                </form>
            </section>
        `;
    }

    function normalizePath(path) {
        return window.SystemFS?.normalizePath?.(path || "/") || path || "/";
    }

    function parentPath(path = currentPath) {
        return window.SystemFS?.getParentPath?.(path) || path.replace(/\/[^/]+\/?$/, "") || "/";
    }

    function setNotice(message = "", isError = false) {
        const notice = rootEl?.querySelector("[data-files-notice]");
        if (!notice) return;
        notice.textContent = message;
        notice.classList.toggle("is-error", isError);
        notice.hidden = !message;
    }

    function sanitizeName(value) {
        return String(value || "")
            .replace(/[\\/:*?"<>|]/g, "-")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 96);
    }

    function formatSize(size) {
        const bytes = Number(size) || 0;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function formatDate(timestamp) {
        if (!timestamp) return "";
        try {
            return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
        } catch (error) {
            return "";
        }
    }

    function iconFor(record) {
        if (record.isDirectory) return "fa-solid fa-folder";
        const kind = window.MobileFileIntents?.classify?.(record) || "unknown";
        return {
            text: "fa-solid fa-file-lines",
            markdown: "fa-brands fa-markdown",
            html: "fa-solid fa-code",
            pdf: "fa-solid fa-file-pdf",
            audio: "fa-solid fa-file-audio",
            image: "fa-solid fa-file-image"
        }[kind] || "fa-regular fa-file";
    }

    function renderBreadcrumbs() {
        const container = rootEl?.querySelector("[data-files-breadcrumbs]");
        const up = rootEl?.querySelector("[data-files-up]");
        if (!container) return;
        const segments = currentPath.split("/").filter(Boolean);
        const crumbs = [{ label: "Storage", path: "/" }];
        let path = "";
        segments.forEach((segment) => {
            path += `/${segment}`;
            crumbs.push({ label: segment, path });
        });
        container.innerHTML = crumbs.map((crumb, index) => `
            ${index ? '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>' : ""}
            <button type="button" data-files-path="${escapeHtml(crumb.path)}" ${index === crumbs.length - 1 ? 'aria-current="page"' : ""}>
                ${escapeHtml(crumb.label)}
            </button>
        `).join("");
        if (up) up.disabled = currentPath === "/";
    }

    function itemMarkup(record) {
        const secondary = record.isDirectory
            ? "Folder"
            : [formatSize(record.size), formatDate(record.lastModified)].filter(Boolean).join(" · ");
        return `
            <article class="mobile-files-row" data-files-row="${escapeHtml(record.path)}">
                <button type="button" class="mobile-files-open" data-files-open="${escapeHtml(record.path)}">
                    <span class="mobile-files-icon"><i class="${iconFor(record)}"></i></span>
                    <span class="mobile-files-name">
                        <strong>${escapeHtml(record.name)}</strong>
                        <small>${escapeHtml(secondary)}</small>
                    </span>
                </button>
                <button type="button" class="mobile-files-more" data-files-more="${escapeHtml(record.path)}" aria-label="Actions for ${escapeHtml(record.name)}">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
            </article>
        `;
    }

    async function refresh() {
        const generation = ++renderGeneration;
        const list = rootEl?.querySelector("[data-files-list]");
        if (!list) return;
        renderBreadcrumbs();
        list.setAttribute("aria-busy", "true");
        list.innerHTML = '<div class="mobile-files-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading files…</div>';
        try {
            const records = await window.SystemFS.readDir(currentPath);
            if (generation !== renderGeneration || !rootEl?.isConnected) return;
            const visible = records.filter((record) => !String(record.name || "").startsWith("."));
            list.innerHTML = visible.length
                ? visible.map(itemMarkup).join("")
                : '<div class="mobile-files-empty"><i class="fa-regular fa-folder-open"></i><strong>This folder is empty</strong><span>Upload a file or create something new.</span></div>';
        } catch (error) {
            if (generation !== renderGeneration) return;
            list.innerHTML = '<div class="mobile-files-empty is-error"><i class="fa-solid fa-triangle-exclamation"></i><strong>Storage unavailable</strong><span>Reopen Files and try again.</span></div>';
            setNotice(error.message || "The folder could not be opened.", true);
        } finally {
            if (generation === renderGeneration) list.removeAttribute("aria-busy");
        }
    }

    async function navigate(path) {
        const nextPath = normalizePath(path);
        const record = nextPath === "/" ? { isDirectory: true } : await window.SystemFS.readFile(nextPath);
        if (nextPath !== "/" && (!record || !record.isDirectory)) {
            setNotice("That folder is no longer available.", true);
            return false;
        }
        currentPath = nextPath;
        selectedPath = "";
        closeSheet();
        setNotice();
        await refresh();
        rootEl?.querySelector("[data-files-list]")?.scrollTo?.({ top: 0 });
        return true;
    }

    async function openRecord(path) {
        const record = await window.SystemFS.readFile(path);
        if (!record) {
            setNotice("That item is no longer available.", true);
            await refresh();
            return;
        }
        if (record.isDirectory) {
            await navigate(record.path);
            return;
        }
        const opened = await window.MobileFileIntents?.open?.(record, { sourceApp: APP_ID });
        if (!opened) {
            setNotice("No mobile app can open this file yet. You can download it instead.", true);
            showSheet(record);
        }
    }

    function closeSheet() {
        const sheet = rootEl?.querySelector("[data-files-sheet]");
        if (sheet) sheet.hidden = true;
        selectedPath = "";
    }

    function showSheet(record) {
        const sheet = rootEl?.querySelector("[data-files-sheet]");
        const title = sheet?.querySelector("[data-files-sheet-title]");
        const actions = sheet?.querySelector("[data-files-sheet-actions]");
        if (!sheet || !actions) return;
        selectedPath = record.path;
        if (title) title.textContent = record.name || "File";
        const canOpen = record.isDirectory || window.MobileFileIntents?.canOpen?.(record);
        actions.innerHTML = `
            ${canOpen ? '<button type="button" data-files-sheet-action="open"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Open</span></button>' : ""}
            ${!record.isDirectory && typeof navigator.share === "function" ? '<button type="button" data-files-sheet-action="share"><i class="fa-solid fa-share-nodes"></i><span>Share</span></button>' : ""}
            ${!record.isDirectory ? '<button type="button" data-files-sheet-action="download"><i class="fa-solid fa-download"></i><span>Download</span></button>' : ""}
            <button type="button" class="is-danger" data-files-sheet-action="delete"><i class="fa-solid fa-trash"></i><span>Delete</span></button>
        `;
        sheet.hidden = false;
        window.requestAnimationFrame(() => actions.querySelector("button")?.focus());
    }

    function closeDialog() {
        const dialog = rootEl?.querySelector("[data-files-dialog]");
        if (!dialog) return;
        dialog.hidden = true;
        dialog.dataset.mode = "";
        dialog.dataset.path = "";
    }

    function showDialog(mode, record = null) {
        const dialog = rootEl?.querySelector("[data-files-dialog]");
        if (!dialog) return;
        const title = dialog.querySelector("[data-files-dialog-title]");
        const copy = dialog.querySelector("[data-files-dialog-copy]");
        const label = dialog.querySelector("[data-files-dialog-label]");
        const input = dialog.querySelector("[data-files-dialog-input]");
        const submit = dialog.querySelector("[data-files-dialog-submit]");
        const error = dialog.querySelector("[data-files-dialog-error]");
        dialog.dataset.mode = mode;
        dialog.dataset.path = record?.path || "";
        if (error) error.textContent = "";
        if (input) input.required = mode !== "delete";

        if (mode === "delete") {
            if (title) title.textContent = `Delete ${record?.name || "item"}?`;
            if (copy) copy.textContent = record?.isDirectory
                ? "This folder and everything inside it will be permanently removed from local storage."
                : "This file will be permanently removed from local storage.";
            if (label) label.hidden = true;
            if (submit) {
                submit.textContent = "Delete";
                submit.classList.add("is-danger");
            }
        } else {
            if (title) title.textContent = mode === "folder" ? "New folder" : "New text document";
            if (copy) copy.textContent = `Create it inside ${currentPath}.`;
            if (label) label.hidden = false;
            if (input) input.value = mode === "folder" ? "New folder" : "note.txt";
            if (submit) {
                submit.textContent = "Create";
                submit.classList.remove("is-danger");
            }
        }
        dialog.hidden = false;
        window.requestAnimationFrame(() => (mode === "delete" ? submit : input)?.focus());
        if (mode !== "delete") input?.select();
    }

    async function uniquePath(directory, originalName) {
        const safeName = sanitizeName(originalName) || "file";
        const dotIndex = safeName.lastIndexOf(".");
        const stem = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
        const extension = dotIndex > 0 ? safeName.slice(dotIndex) : "";
        let candidate = normalizePath(`${directory}/${safeName}`);
        let index = 2;
        while (await window.SystemFS.readFile(candidate)) {
            candidate = normalizePath(`${directory}/${stem} (${index})${extension}`);
            index++;
        }
        return candidate;
    }

    async function submitDialog(event) {
        event.preventDefault();
        const dialog = rootEl?.querySelector("[data-files-dialog]");
        const input = dialog?.querySelector("[data-files-dialog-input]");
        const error = dialog?.querySelector("[data-files-dialog-error]");
        if (!dialog) return;
        const mode = dialog.dataset.mode;

        try {
            if (mode === "delete") {
                const path = dialog.dataset.path;
                const record = await window.SystemFS.readFile(path);
                if (record?.isDirectory) await window.SystemFS.deleteFileRecursive(path);
                else await window.SystemFS.deleteFile(path);
                closeDialog();
                closeSheet();
                setNotice(`${record?.name || "Item"} deleted.`);
                await refresh();
                return;
            }

            let name = sanitizeName(input?.value);
            if (!name || name === "." || name === "..") throw new Error("Enter a valid name.");
            if (mode === "text" && !/\.[a-z0-9]+$/i.test(name)) name += ".txt";
            const path = normalizePath(`${currentPath}/${name}`);
            if (await window.SystemFS.readFile(path)) throw new Error("An item with that name already exists.");

            const record = mode === "folder"
                ? await window.SystemFS.writeFile(path, name, currentPath, null, 0, "directory", true)
                : await window.SystemFS.writeFile(path, name, currentPath, "", 0, "text/plain", false);
            closeDialog();
            setNotice(`${name} created.`);
            await refresh();
            if (mode === "folder") await navigate(record.path);
            else await window.MobileFileIntents?.open?.(record, { sourceApp: APP_ID });
        } catch (caught) {
            if (error) error.textContent = caught.message || "The item could not be created.";
        }
    }

    async function importFiles(files) {
        const selected = Array.from(files || []);
        if (!selected.length) return;
        setNotice(`Importing ${selected.length} file${selected.length === 1 ? "" : "s"}…`);
        let imported = 0;
        for (const file of selected) {
            const path = await uniquePath(currentPath, file.name);
            await window.SystemFS.writeFile(
                path,
                window.SystemFS.getName(path),
                currentPath,
                file,
                file.size,
                file.type || "application/octet-stream",
                false,
                { lastModified: file.lastModified || Date.now() }
            );
            imported++;
        }
        setNotice(`${imported} file${imported === 1 ? "" : "s"} imported.`);
        await refresh();
    }

    async function handleSheetAction(action) {
        const path = selectedPath;
        if (!path) return;
        const record = await window.SystemFS.readFile(path);
        if (!record) {
            closeSheet();
            setNotice("That item is no longer available.", true);
            await refresh();
            return;
        }
        if (action === "open") {
            closeSheet();
            await openRecord(path);
            return;
        }
        if (action === "delete") {
            showDialog("delete", record);
            return;
        }
        try {
            const completed = action === "share"
                ? await window.MobileFileIntents?.share?.(record)
                : await window.MobileFileIntents?.download?.(record);
            if (!completed) setNotice(action === "share" ? "File sharing is not supported by this browser." : "Download failed.", true);
            closeSheet();
        } catch (error) {
            if (error?.name !== "AbortError") setNotice(error.message || `Could not ${action} the file.`, true);
        }
    }

    function bindEvents() {
        eventController?.abort();
        eventController = new AbortController();
        const { signal } = eventController;

        rootEl.addEventListener("click", async (event) => {
            const open = event.target.closest("[data-files-open]");
            if (open) return openRecord(open.dataset.filesOpen);

            const more = event.target.closest("[data-files-more]");
            if (more) {
                const record = await window.SystemFS.readFile(more.dataset.filesMore);
                if (record) showSheet(record);
                return;
            }

            const location = event.target.closest("[data-files-location], [data-files-path]");
            if (location) return navigate(location.dataset.filesLocation || location.dataset.filesPath);

            if (event.target.closest("[data-files-up]")) return navigate(parentPath());
            if (event.target.closest("[data-files-upload]")) return rootEl.querySelector("[data-files-input]")?.click();

            const create = event.target.closest("[data-files-create]");
            if (create) return showDialog(create.dataset.filesCreate);

            if (event.target.closest("[data-files-dismiss]")) return closeSheet();
            if (event.target.closest("[data-files-dialog-cancel]")) return closeDialog();

            const sheetAction = event.target.closest("[data-files-sheet-action]");
            if (sheetAction) return handleSheetAction(sheetAction.dataset.filesSheetAction);
        }, { signal });

        rootEl.querySelector("[data-files-input]")?.addEventListener("change", async (event) => {
            try {
                await importFiles(event.target.files);
            } catch (error) {
                setNotice(error.message || "The selected files could not be imported.", true);
            } finally {
                event.target.value = "";
            }
        }, { signal });

        rootEl.querySelector("[data-files-dialog-form]")?.addEventListener("submit", submitDialog, { signal });
    }

    async function applyIntent(context) {
        const intent = window.MobileFileIntents?.consume?.(APP_ID, context);
        if (!intent) return false;
        const path = intent.kind === "directory" || intent.action === "browse"
            ? intent.path
            : window.SystemFS?.getParentPath?.(intent.path);
        if (!path) return false;
        await navigate(path);
        return true;
    }

    async function mount(root, context = {}) {
        rootEl = root;
        bindEvents();
        unsubscribeFs?.();
        unsubscribeFs = window.EventBus?.on("fs:changed", (event = {}) => {
            if (!rootEl?.isConnected) return;
            if (event.parent === currentPath || event.path === currentPath || String(event.path || "").startsWith(`${currentPath}/`)) {
                refresh();
            }
        }) || null;
        if (!await applyIntent(context)) await navigate(currentPath);
    }

    async function onBack() {
        const dialog = rootEl?.querySelector("[data-files-dialog]");
        if (dialog && !dialog.hidden) {
            closeDialog();
            return true;
        }
        const sheet = rootEl?.querySelector("[data-files-sheet]");
        if (sheet && !sheet.hidden) {
            closeSheet();
            return true;
        }
        if (currentPath !== "/") {
            await navigate(parentPath());
            return true;
        }
        return false;
    }

    function serializeState() {
        const list = rootEl?.querySelector("[data-files-list]");
        return {
            version: 1,
            currentPath: normalizePath(currentPath),
            scrollTop: Math.max(0, Number(list?.scrollTop) || 0)
        };
    }

    async function restoreState(root, context = {}) {
        if (context.signal?.aborted) return;
        rootEl = root;
        const saved = context.state;
        if (!saved || typeof saved !== "object" || saved.version !== 1) return;

        const rawPath = typeof saved.currentPath === "string" ? saved.currentPath : "/";
        const pathParts = rawPath.replace(/\\/g, "/").split("/").filter(Boolean);
        const restoredPath = rawPath.startsWith("/") && rawPath.length <= 1024 && !pathParts.includes("..")
            ? normalizePath(rawPath)
            : "/";
        const restored = await navigate(restoredPath);
        if (context.signal?.aborted) return;
        if (!restored && restoredPath !== "/") await navigate("/");
        if (context.signal?.aborted) return;

        const scrollTop = Number(saved.scrollTop);
        if (Number.isFinite(scrollTop) && scrollTop > 0) {
            window.requestAnimationFrame(() => {
                if (!context.signal?.aborted) rootEl?.querySelector("[data-files-list]")?.scrollTo?.({ top: Math.min(scrollTop, 100000) });
            });
        }
    }

    window.mobileAppRegistry[APP_ID] = {
        title: "Files",
        icon: "fa-solid fa-folder",
        viewClass: "mobile-files-app",
        render,
        onOpen: mount,
        onResume: async (root, context = {}) => {
            rootEl = root;
            if (!await applyIntent(context)) await refresh();
        },
        onIntent: async (root, context = {}) => {
            if (context.signal?.aborted) return;
            rootEl = root;
            await applyIntent(context);
        },
        onBack,
        serializeState,
        restoreState,
        onClose: () => {
            renderGeneration++;
            eventController?.abort();
            eventController = null;
            unsubscribeFs?.();
            unsubscribeFs = null;
            rootEl = null;
            selectedPath = "";
        }
    };
})();
