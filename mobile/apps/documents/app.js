(function() {
    const APP_ID = "documents";
    const DOCUMENT_ROOT = "/documents";
    const editableKinds = new Set(["text", "markdown", "html"]);
    let rootEl = null;
    let currentRecord = null;
    let currentKind = "";
    let currentMode = "edit";
    let dirty = false;
    let autosaveTimer = null;
    let objectUrl = "";
    let eventController = null;
    let unsubscribeFs = null;
    let libraryGeneration = 0;
    let documentGeneration = 0;

    const escapeHtml = (value) => window.PortfolioOSMobileFramework?.escapeHtml?.(value)
        || String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
        })[character]);

    function render() {
        return `
            <div class="mobile-documents-shell">
                <section class="mobile-documents-library" data-docs-library>
                    <header class="mobile-documents-hero">
                        <span><i class="fa-solid fa-file-pen"></i></span>
                        <div>
                            <p>Local workspace</p>
                            <h2>Documents</h2>
                            <small>Text, Markdown, HTML, and PDF files stored in your browser.</small>
                        </div>
                    </header>

                    <div class="mobile-documents-primary-actions">
                        <button type="button" data-docs-new><i class="fa-solid fa-plus"></i><span>New document</span></button>
                        <button type="button" data-docs-import><i class="fa-solid fa-file-import"></i><span>Import or view PDF</span></button>
                        <input type="file" data-docs-input accept="text/plain,text/markdown,text/html,application/pdf,.txt,.md,.markdown,.html,.htm,.pdf" multiple hidden>
                    </div>

                    <div class="mobile-documents-notice" data-docs-notice role="status" aria-live="polite" hidden></div>
                    <div class="mobile-documents-section-heading">
                        <h3>On this device</h3>
                        <button type="button" data-docs-refresh aria-label="Refresh documents"><i class="fa-solid fa-rotate"></i></button>
                    </div>
                    <div class="mobile-documents-list" data-docs-list aria-label="Local documents"></div>
                </section>

                <section class="mobile-documents-workspace" data-docs-workspace hidden>
                    <header class="mobile-documents-toolbar">
                        <button type="button" data-docs-library-back aria-label="Back to documents"><i class="fa-solid fa-arrow-left"></i></button>
                        <div class="mobile-documents-title">
                            <strong data-docs-title>Document</strong>
                            <small data-docs-status>Saved locally</small>
                        </div>
                        <button type="button" data-docs-save aria-label="Save document"><i class="fa-solid fa-floppy-disk"></i></button>
                        <button type="button" data-docs-more aria-label="Document actions"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    </header>

                    <nav class="mobile-documents-modes" data-docs-modes aria-label="Document view">
                        <button type="button" data-docs-mode="edit" class="is-active">Edit</button>
                        <button type="button" data-docs-mode="preview">Preview</button>
                    </nav>

                    <div class="mobile-documents-editor" data-docs-editor>
                        <textarea data-docs-textarea spellcheck="true" aria-label="Document editor"></textarea>
                    </div>

                    <div class="mobile-documents-preview" data-docs-preview hidden>
                        <article data-docs-rendered></article>
                        <iframe data-docs-html-preview title="HTML document preview" sandbox hidden></iframe>
                    </div>

                    <div class="mobile-documents-pdf" data-docs-pdf hidden>
                        <object data-docs-pdf-object type="application/pdf" aria-label="PDF document">
                            <div class="mobile-documents-pdf-fallback">
                                <i class="fa-solid fa-file-pdf"></i>
                                <strong>Inline PDF preview is unavailable.</strong>
                                <span>Download or share the file to open it in another viewer.</span>
                            </div>
                        </object>
                    </div>
                </section>

                <section class="mobile-documents-sheet" data-docs-sheet hidden>
                    <button type="button" class="mobile-documents-sheet-scrim" data-docs-sheet-close aria-label="Close document actions"></button>
                    <div class="mobile-documents-sheet-card" role="dialog" aria-modal="true" aria-labelledby="mobile-documents-actions-title">
                        <div class="mobile-documents-sheet-handle" aria-hidden="true"></div>
                        <h2 id="mobile-documents-actions-title">Document actions</h2>
                        <button type="button" data-docs-action="download"><i class="fa-solid fa-download"></i><span>Download a copy</span></button>
                        <button type="button" data-docs-action="share"><i class="fa-solid fa-share-nodes"></i><span>Share</span></button>
                        <button type="button" data-docs-action="files"><i class="fa-solid fa-folder-open"></i><span>Show in Files</span></button>
                        <button type="button" data-docs-sheet-close>Cancel</button>
                    </div>
                </section>

                <section class="mobile-documents-dialog" data-docs-dialog hidden>
                    <button type="button" class="mobile-documents-dialog-scrim" data-docs-dialog-close aria-label="Cancel"></button>
                    <form class="mobile-documents-dialog-card" data-docs-dialog-form role="dialog" aria-modal="true" aria-labelledby="mobile-documents-dialog-title">
                        <h2 id="mobile-documents-dialog-title">New document</h2>
                        <label>
                            <span>Name</span>
                            <input type="text" data-docs-name value="Untitled" maxlength="80" required autocomplete="off">
                        </label>
                        <label>
                            <span>Format</span>
                            <select data-docs-format>
                                <option value="txt">Plain text (.txt)</option>
                                <option value="md">Markdown (.md)</option>
                                <option value="html">HTML (.html)</option>
                            </select>
                        </label>
                        <div class="mobile-documents-dialog-error" data-docs-dialog-error role="alert"></div>
                        <div class="mobile-documents-dialog-actions">
                            <button type="button" data-docs-dialog-close>Cancel</button>
                            <button type="submit" class="is-primary">Create</button>
                        </div>
                    </form>
                </section>
            </div>
        `;
    }

    function setNotice(message = "", isError = false) {
        const notice = rootEl?.querySelector("[data-docs-notice]");
        if (!notice) return;
        notice.textContent = message;
        notice.classList.toggle("is-error", isError);
        notice.hidden = !message;
    }

    function setStatus(message, state = "") {
        const status = rootEl?.querySelector("[data-docs-status]");
        if (!status) return;
        status.textContent = message;
        status.dataset.state = state;
    }

    function sanitizeName(value) {
        return String(value || "")
            .replace(/[\\/:*?"<>|]/g, "-")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80);
    }

    function extensionForKind(kind) {
        return kind === "markdown" ? ".md" : kind === "html" ? ".html" : kind === "pdf" ? ".pdf" : ".txt";
    }

    function mimeForKind(kind) {
        return kind === "markdown" ? "text/markdown" : kind === "html" ? "text/html" : kind === "pdf" ? "application/pdf" : "text/plain";
    }

    function formatDate(timestamp) {
        if (!timestamp) return "";
        try {
            return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(timestamp);
        } catch (error) {
            return "";
        }
    }

    function iconForKind(kind) {
        return kind === "pdf" ? "fa-solid fa-file-pdf"
            : kind === "markdown" ? "fa-brands fa-markdown"
                : kind === "html" ? "fa-solid fa-code"
                    : "fa-solid fa-file-lines";
    }

    function revokeObjectUrl() {
        if (!objectUrl) return;
        URL.revokeObjectURL(objectUrl);
        objectUrl = "";
    }

    async function recordText(record) {
        if (!record) return "";
        if (record.data instanceof Blob) return await record.data.text();
        if (typeof record.data === "string") return record.data;
        return await new Blob([record.data ?? ""]).text();
    }

    function documentMarkup(record) {
        const kind = window.MobileFileIntents?.classify?.(record) || "unknown";
        return `
            <button type="button" class="mobile-documents-row" data-docs-open="${escapeHtml(record.path)}">
                <span class="mobile-documents-file-icon" data-kind="${escapeHtml(kind)}"><i class="${iconForKind(kind)}"></i></span>
                <span class="mobile-documents-file-name">
                    <strong>${escapeHtml(record.name)}</strong>
                    <small>${escapeHtml(kind === "pdf" ? "PDF document" : `${kind || "text"} · Autosaves locally`)}</small>
                </span>
                <time>${escapeHtml(formatDate(record.lastModified))}</time>
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
        `;
    }

    async function refreshLibrary() {
        const generation = ++libraryGeneration;
        const list = rootEl?.querySelector("[data-docs-list]");
        if (!list) return;
        list.setAttribute("aria-busy", "true");
        list.innerHTML = '<div class="mobile-documents-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading documents…</div>';
        try {
            const all = await window.SystemFS.getAllFiles();
            if (generation !== libraryGeneration || !rootEl?.isConnected) return;
            const documents = all
                .filter((record) => !record.isDirectory
                    && String(record.path || "").startsWith(`${DOCUMENT_ROOT}/`)
                    && ["text", "markdown", "html", "pdf"].includes(window.MobileFileIntents?.classify?.(record)))
                .sort((a, b) => Number(b.lastModified || 0) - Number(a.lastModified || 0));
            list.innerHTML = documents.length
                ? documents.map(documentMarkup).join("")
                : '<div class="mobile-documents-empty"><i class="fa-regular fa-file-lines"></i><strong>No documents yet</strong><span>Create a local text document or import a PDF.</span></div>';
        } catch (error) {
            if (generation !== libraryGeneration) return;
            list.innerHTML = '<div class="mobile-documents-empty is-error"><i class="fa-solid fa-triangle-exclamation"></i><strong>Documents unavailable</strong><span>Local storage could not be read.</span></div>';
            setNotice(error.message || "Documents could not be loaded.", true);
        } finally {
            if (generation === libraryGeneration) list.removeAttribute("aria-busy");
        }
    }

    function showLibraryElements() {
        rootEl?.querySelector("[data-docs-library]")?.removeAttribute("hidden");
        const workspace = rootEl?.querySelector("[data-docs-workspace]");
        if (workspace) workspace.hidden = true;
    }

    function showWorkspaceElements() {
        const library = rootEl?.querySelector("[data-docs-library]");
        if (library) library.hidden = true;
        rootEl?.querySelector("[data-docs-workspace]")?.removeAttribute("hidden");
    }

    function inlineMarkdown(source) {
        return escapeHtml(source)
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/_([^_]+)_/g, "<em>$1</em>");
    }

    function markdownHtml(source) {
        let inList = false;
        const output = [];
        String(source || "").split(/\r?\n/).forEach((line) => {
            const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
            if (listMatch) {
                if (!inList) {
                    output.push("<ul>");
                    inList = true;
                }
                output.push(`<li>${inlineMarkdown(listMatch[1])}</li>`);
                return;
            }
            if (inList) {
                output.push("</ul>");
                inList = false;
            }
            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                const level = heading[1].length;
                output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
            } else if (/^>\s?/.test(line)) {
                output.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
            } else if (line.trim()) {
                output.push(`<p>${inlineMarkdown(line)}</p>`);
            } else {
                output.push("<br>");
            }
        });
        if (inList) output.push("</ul>");
        return output.join("");
    }

    function renderPreview() {
        const textarea = rootEl?.querySelector("[data-docs-textarea]");
        const article = rootEl?.querySelector("[data-docs-rendered]");
        const frame = rootEl?.querySelector("[data-docs-html-preview]");
        if (!textarea || !article || !frame) return;
        if (currentKind === "html") {
            article.hidden = true;
            frame.hidden = false;
            frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'">${textarea.value}`;
            return;
        }
        frame.hidden = true;
        frame.srcdoc = "";
        article.hidden = false;
        if (currentKind === "markdown") article.innerHTML = markdownHtml(textarea.value);
        else {
            article.replaceChildren();
            const pre = document.createElement("pre");
            pre.textContent = textarea.value;
            article.appendChild(pre);
        }
    }

    function setMode(mode) {
        if (!editableKinds.has(currentKind)) return;
        currentMode = mode === "preview" ? "preview" : "edit";
        const editor = rootEl?.querySelector("[data-docs-editor]");
        const preview = rootEl?.querySelector("[data-docs-preview]");
        rootEl?.querySelectorAll("[data-docs-mode]").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.docsMode === currentMode);
        });
        if (editor) editor.hidden = currentMode !== "edit";
        if (preview) preview.hidden = currentMode !== "preview";
        if (currentMode === "preview") renderPreview();
        else rootEl?.querySelector("[data-docs-textarea]")?.focus({ preventScroll: true });
    }

    async function openRecord(input) {
        const generation = ++documentGeneration;
        const record = await window.MobileFileIntents?.resolve?.(input) || input;
        if (!record || generation !== documentGeneration || !rootEl?.isConnected) return false;
        const kind = window.MobileFileIntents?.classify?.(record) || "unknown";
        if (!["text", "markdown", "html", "pdf"].includes(kind)) {
            setNotice("Documents supports text, Markdown, HTML, and PDF files.", true);
            return false;
        }

        if (currentRecord && currentRecord.path !== record.path) await flushAutosave();
        revokeObjectUrl();
        currentRecord = record;
        currentKind = kind;
        currentMode = "edit";
        dirty = false;
        showWorkspaceElements();

        const title = rootEl.querySelector("[data-docs-title]");
        const modes = rootEl.querySelector("[data-docs-modes]");
        const editor = rootEl.querySelector("[data-docs-editor]");
        const preview = rootEl.querySelector("[data-docs-preview]");
        const pdf = rootEl.querySelector("[data-docs-pdf]");
        const save = rootEl.querySelector("[data-docs-save]");
        if (title) title.textContent = record.name || "Document";
        if (modes) modes.hidden = kind === "pdf";
        if (save) save.hidden = kind === "pdf";
        if (editor) editor.hidden = kind === "pdf";
        if (preview) preview.hidden = true;
        if (pdf) pdf.hidden = kind !== "pdf";

        if (kind === "pdf") {
            objectUrl = URL.createObjectURL(window.MobileFileIntents.toBlob(record));
            const object = rootEl.querySelector("[data-docs-pdf-object]");
            if (object) object.data = objectUrl;
            setStatus("PDF · Stored locally", "saved");
        } else {
            const textarea = rootEl.querySelector("[data-docs-textarea]");
            if (textarea) textarea.value = await recordText(record);
            setMode("edit");
            setStatus("Saved locally", "saved");
        }
        return true;
    }

    async function saveCurrent(options = {}) {
        if (!currentRecord || !editableKinds.has(currentKind)) return false;
        window.clearTimeout(autosaveTimer);
        autosaveTimer = null;
        const textarea = rootEl?.querySelector("[data-docs-textarea]");
        if (!textarea) return false;
        const snapshot = textarea.value;
        if (!options.force && !dirty) return true;
        setStatus("Saving…", "saving");
        try {
            const record = await window.SystemFS.writeFile(
                currentRecord.path,
                currentRecord.name,
                currentRecord.parent || window.SystemFS.getParentPath(currentRecord.path),
                snapshot,
                new Blob([snapshot]).size,
                mimeForKind(currentKind),
                false,
                { metadata: { ...(currentRecord.metadata || {}), kind: "document", editor: currentKind } }
            );
            currentRecord = record;
            dirty = textarea.value !== snapshot;
            setStatus(dirty ? "Changes pending" : "Saved locally", dirty ? "dirty" : "saved");
            if (dirty) scheduleAutosave();
            return true;
        } catch (error) {
            dirty = true;
            setStatus("Save failed", "error");
            if (!options.quiet) setNotice(error.message || "The document could not be saved.", true);
            return false;
        }
    }

    function scheduleAutosave() {
        window.clearTimeout(autosaveTimer);
        autosaveTimer = window.setTimeout(() => saveCurrent({ quiet: true }), 700);
    }

    async function flushAutosave() {
        if (!dirty) {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
            return true;
        }
        return await saveCurrent({ force: true, quiet: true });
    }

    async function closeDocument() {
        await flushAutosave();
        documentGeneration++;
        revokeObjectUrl();
        currentRecord = null;
        currentKind = "";
        currentMode = "edit";
        dirty = false;
        showLibraryElements();
        await refreshLibrary();
    }

    function showNewDialog() {
        const dialog = rootEl?.querySelector("[data-docs-dialog]");
        if (!dialog) return;
        dialog.hidden = false;
        const input = dialog.querySelector("[data-docs-name]");
        const error = dialog.querySelector("[data-docs-dialog-error]");
        if (input) input.value = "Untitled";
        if (error) error.textContent = "";
        window.requestAnimationFrame(() => {
            input?.focus();
            input?.select();
        });
    }

    function closeNewDialog() {
        const dialog = rootEl?.querySelector("[data-docs-dialog]");
        if (dialog) dialog.hidden = true;
    }

    async function createDocument(event) {
        event.preventDefault();
        const dialog = rootEl?.querySelector("[data-docs-dialog]");
        const input = dialog?.querySelector("[data-docs-name]");
        const format = dialog?.querySelector("[data-docs-format]")?.value || "txt";
        const error = dialog?.querySelector("[data-docs-dialog-error]");
        try {
            let name = sanitizeName(input?.value);
            if (!name) throw new Error("Enter a document name.");
            const kind = format === "md" ? "markdown" : format === "html" ? "html" : "text";
            const expectedExtension = extensionForKind(kind);
            if (!/\.[a-z0-9]+$/i.test(name)) name += expectedExtension;
            const path = window.SystemFS.normalizePath(`${DOCUMENT_ROOT}/${name}`);
            if (await window.SystemFS.readFile(path)) throw new Error("A document with that name already exists.");
            const initial = kind === "markdown" ? `# ${name.replace(/\.[^.]+$/, "")}\n\n`
                : kind === "html" ? `<h1>${escapeHtml(name.replace(/\.[^.]+$/, ""))}</h1>\n<p>Start writing here.</p>`
                    : "";
            const record = await window.SystemFS.writeFile(
                path,
                name,
                DOCUMENT_ROOT,
                initial,
                new Blob([initial]).size,
                mimeForKind(kind),
                false,
                { metadata: { kind: "document", editor: kind } }
            );
            closeNewDialog();
            await openRecord(record);
        } catch (caught) {
            if (error) error.textContent = caught.message || "The document could not be created.";
        }
    }

    async function uniqueImportPath(name) {
        const safe = sanitizeName(name) || "document";
        const dotIndex = safe.lastIndexOf(".");
        const stem = dotIndex > 0 ? safe.slice(0, dotIndex) : safe;
        const extension = dotIndex > 0 ? safe.slice(dotIndex) : "";
        let path = window.SystemFS.normalizePath(`${DOCUMENT_ROOT}/${safe}`);
        let index = 2;
        while (await window.SystemFS.readFile(path)) {
            path = window.SystemFS.normalizePath(`${DOCUMENT_ROOT}/${stem} (${index})${extension}`);
            index++;
        }
        return path;
    }

    async function importDocuments(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        let lastRecord = null;
        let imported = 0;
        for (const file of files) {
            const previewRecord = { name: file.name, type: file.type };
            const kind = window.MobileFileIntents?.classify?.(previewRecord) || "unknown";
            if (!["text", "markdown", "html", "pdf"].includes(kind)) continue;
            const path = await uniqueImportPath(file.name);
            lastRecord = await window.SystemFS.writeFile(
                path,
                window.SystemFS.getName(path),
                DOCUMENT_ROOT,
                file,
                file.size,
                file.type || mimeForKind(kind),
                false,
                { lastModified: file.lastModified || Date.now(), metadata: { kind: kind === "pdf" ? "pdf" : "document", editor: kind } }
            );
            imported++;
        }
        if (!imported) {
            setNotice("Choose a text, Markdown, HTML, or PDF file.", true);
            return;
        }
        setNotice(`${imported} document${imported === 1 ? "" : "s"} imported.`);
        await refreshLibrary();
        if (files.length === 1 && lastRecord) await openRecord(lastRecord);
    }

    function closeSheet() {
        const sheet = rootEl?.querySelector("[data-docs-sheet]");
        if (sheet) sheet.hidden = true;
    }

    function showSheet() {
        if (!currentRecord) return;
        const sheet = rootEl?.querySelector("[data-docs-sheet]");
        if (!sheet) return;
        const share = sheet.querySelector('[data-docs-action="share"]');
        if (share) share.hidden = typeof navigator.share !== "function";
        sheet.hidden = false;
        window.requestAnimationFrame(() => sheet.querySelector("[data-docs-action]:not([hidden])")?.focus());
    }

    async function runDocumentAction(action) {
        if (!currentRecord) return;
        try {
            if (editableKinds.has(currentKind)) await flushAutosave();
            if (action === "download") await window.MobileFileIntents?.download?.(currentRecord);
            if (action === "share") {
                const shared = await window.MobileFileIntents?.share?.(currentRecord);
                if (!shared) setStatus("Sharing unsupported", "error");
            }
            if (action === "files") {
                const parent = await window.SystemFS.readFile(currentRecord.parent || DOCUMENT_ROOT);
                await window.MobileFileIntents?.open?.(parent || { path: DOCUMENT_ROOT, name: "documents", isDirectory: true, type: "directory" }, { sourceApp: APP_ID });
            }
            closeSheet();
        } catch (error) {
            if (error?.name !== "AbortError") setStatus(error.message || "Action failed", "error");
        }
    }

    function bindEvents() {
        eventController?.abort();
        eventController = new AbortController();
        const { signal } = eventController;

        rootEl.addEventListener("click", async (event) => {
            if (event.target.closest("[data-docs-new]")) return showNewDialog();
            if (event.target.closest("[data-docs-import]")) return rootEl.querySelector("[data-docs-input]")?.click();
            if (event.target.closest("[data-docs-refresh]")) return refreshLibrary();
            if (event.target.closest("[data-docs-library-back]")) return closeDocument();
            if (event.target.closest("[data-docs-save]")) return saveCurrent({ force: true });
            if (event.target.closest("[data-docs-more]")) return showSheet();
            if (event.target.closest("[data-docs-sheet-close]")) return closeSheet();
            if (event.target.closest("[data-docs-dialog-close]")) return closeNewDialog();

            const open = event.target.closest("[data-docs-open]");
            if (open) return openRecord(open.dataset.docsOpen);

            const mode = event.target.closest("[data-docs-mode]");
            if (mode) return setMode(mode.dataset.docsMode);

            const action = event.target.closest("[data-docs-action]");
            if (action) return runDocumentAction(action.dataset.docsAction);
        }, { signal });

        rootEl.querySelector("[data-docs-textarea]")?.addEventListener("input", () => {
            dirty = true;
            setStatus("Saving soon…", "dirty");
            scheduleAutosave();
        }, { signal });

        rootEl.querySelector("[data-docs-input]")?.addEventListener("change", async (event) => {
            try {
                await importDocuments(event.target.files);
            } catch (error) {
                setNotice(error.message || "The selected documents could not be imported.", true);
            } finally {
                event.target.value = "";
            }
        }, { signal });

        rootEl.querySelector("[data-docs-dialog-form]")?.addEventListener("submit", createDocument, { signal });
    }

    async function applyIntent(context) {
        const intent = window.MobileFileIntents?.consume?.(APP_ID, context);
        if (!intent) return false;
        return await openRecord(intent.record || intent.path);
    }

    async function mount(root, context = {}) {
        rootEl = root;
        bindEvents();
        unsubscribeFs?.();
        unsubscribeFs = window.EventBus?.on("fs:changed", (event = {}) => {
            if (!rootEl?.isConnected || currentRecord) return;
            if (event.path?.startsWith(DOCUMENT_ROOT) || event.parent === DOCUMENT_ROOT || event.action === "sync") refreshLibrary();
        }) || null;
        await window.SystemFS.ensureDirectory(DOCUMENT_ROOT, { silent: true });
        if (!await applyIntent(context)) {
            showLibraryElements();
            await refreshLibrary();
        }
    }

    async function onBack() {
        const dialog = rootEl?.querySelector("[data-docs-dialog]");
        if (dialog && !dialog.hidden) {
            closeNewDialog();
            return true;
        }
        const sheet = rootEl?.querySelector("[data-docs-sheet]");
        if (sheet && !sheet.hidden) {
            closeSheet();
            return true;
        }
        if (currentRecord) {
            await closeDocument();
            return true;
        }
        return false;
    }

    async function serializeState(root, context = {}) {
        if (context.signal?.aborted) return undefined;
        if (!currentRecord) {
            return {
                version: 1,
                view: "library",
                libraryScrollTop: Math.max(0, Number(rootEl?.querySelector("[data-docs-library]")?.scrollTop) || 0)
            };
        }

        await flushAutosave();
        if (context.signal?.aborted) return undefined;
        const textarea = rootEl?.querySelector("[data-docs-textarea]");
        return {
            version: 1,
            view: "document",
            path: currentRecord.path,
            kind: currentKind,
            mode: currentKind === "pdf" ? "pdf" : currentMode,
            draft: dirty && editableKinds.has(currentKind) && textarea ? textarea.value : null,
            selectionStart: editableKinds.has(currentKind) && textarea ? textarea.selectionStart : null,
            selectionEnd: editableKinds.has(currentKind) && textarea ? textarea.selectionEnd : null,
            editorScrollTop: editableKinds.has(currentKind) && textarea ? Math.max(0, Number(textarea.scrollTop) || 0) : 0
        };
    }

    async function restoreState(root, context = {}) {
        if (context.signal?.aborted) return;
        rootEl = root;
        const saved = context.state;
        if (!saved || typeof saved !== "object" || saved.version !== 1) return;

        if (saved.view !== "document") {
            const scrollTop = Number(saved.libraryScrollTop);
            if (Number.isFinite(scrollTop) && scrollTop > 0) {
                window.requestAnimationFrame(() => {
                    if (!context.signal?.aborted) rootEl?.querySelector("[data-docs-library]")?.scrollTo?.({ top: Math.min(scrollTop, 100000) });
                });
            }
            return;
        }

        const rawPath = typeof saved.path === "string" ? saved.path : "";
        const path = window.SystemFS?.normalizePath?.(rawPath) || rawPath;
        if (!path.startsWith(`${DOCUMENT_ROOT}/`) || path.length > 1024 || path.split("/").includes("..")) return;
        const opened = await openRecord(path);
        if (!opened || context.signal?.aborted || !editableKinds.has(currentKind)) return;

        const textarea = rootEl?.querySelector("[data-docs-textarea]");
        if (typeof saved.draft === "string" && textarea && saved.draft !== textarea.value) {
            textarea.value = saved.draft;
            dirty = true;
            setStatus("Recovered draft · Saving soon…", "dirty");
            scheduleAutosave();
        }
        setMode(saved.mode === "preview" ? "preview" : "edit");
        const selectionStart = Number(saved.selectionStart);
        const selectionEnd = Number(saved.selectionEnd);
        const editorScrollTop = Number(saved.editorScrollTop);
        window.requestAnimationFrame(() => {
            if (context.signal?.aborted || !textarea) return;
            if (Number.isFinite(selectionStart) && Number.isFinite(selectionEnd)) {
                const start = Math.max(0, Math.min(selectionStart, textarea.value.length));
                const end = Math.max(start, Math.min(selectionEnd, textarea.value.length));
                textarea.setSelectionRange(start, end);
            }
            if (Number.isFinite(editorScrollTop) && editorScrollTop > 0) textarea.scrollTo({ top: Math.min(editorScrollTop, 100000) });
        });
    }

    window.mobileAppRegistry[APP_ID] = {
        title: "Documents",
        icon: "fa-solid fa-file-pen",
        viewClass: "mobile-documents-app",
        render,
        onOpen: mount,
        onResume: async (root, context = {}) => {
            rootEl = root;
            if (!await applyIntent(context) && !currentRecord) await refreshLibrary();
        },
        onIntent: async (root, context = {}) => {
            if (context.signal?.aborted) return;
            rootEl = root;
            await applyIntent(context);
        },
        onPause: () => flushAutosave(),
        onBack,
        serializeState,
        restoreState,
        onClose: async () => {
            await flushAutosave();
            documentGeneration++;
            libraryGeneration++;
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
            revokeObjectUrl();
            eventController?.abort();
            eventController = null;
            unsubscribeFs?.();
            unsubscribeFs = null;
            currentRecord = null;
            currentKind = "";
            currentMode = "edit";
            dirty = false;
            rootEl = null;
        }
    };
})();
