/**
 * PortfoliOS shared file intents.
 *
 * SystemFS remains the source of truth. This module only classifies records and
 * hands a small launch intent to the appropriate mobile application.
 */
(function() {
    const pendingByApp = new Map();

    const extensionMimeTypes = {
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".markdown": "text/markdown",
        ".html": "text/html",
        ".htm": "text/html",
        ".css": "text/css",
        ".csv": "text/csv",
        ".json": "application/json",
        ".js": "text/javascript",
        ".xml": "application/xml",
        ".pdf": "application/pdf",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".oga": "audio/ogg",
        ".opus": "audio/ogg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
        ".webm": "audio/webm",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".avif": "image/avif"
    };

    function extensionOf(name = "") {
        const match = String(name).toLowerCase().match(/(\.[a-z0-9]+)$/);
        return match ? match[1] : "";
    }

    function mimeTypeFor(record = {}) {
        if (record.isDirectory) return "inode/directory";
        const declared = String(record.type || record.mimeType || "").trim().toLowerCase();
        if (declared && declared !== "application/octet-stream") return declared;
        return extensionMimeTypes[extensionOf(record.name || record.path)] || declared || "application/octet-stream";
    }

    function classify(record = {}) {
        if (record.isDirectory) return "directory";
        const name = String(record.name || record.path || "").toLowerCase();
        const extension = extensionOf(name);
        const mimeType = mimeTypeFor(record);

        if (mimeType === "application/pdf" || extension === ".pdf") return "pdf";
        if (mimeType === "text/markdown" || extension === ".md" || extension === ".markdown") return "markdown";
        if (mimeType === "text/html" || extension === ".html" || extension === ".htm") return "html";
        if (mimeType.startsWith("audio/")) return "audio";
        if (mimeType.startsWith("image/")) return "image";
        if (mimeType.startsWith("text/") || ["application/json", "application/xml", "application/javascript"].includes(mimeType)) {
            return "text";
        }
        return "unknown";
    }

    function appForKind(kind) {
        if (kind === "directory") return "files";
        if (["text", "markdown", "html", "pdf"].includes(kind)) return "documents";
        if (kind === "audio") return "music";
        if (kind === "image") return "media";
        return null;
    }

    async function resolve(input) {
        if (!input) return null;
        const path = typeof input === "string" ? input : input.path;
        if (!path) return typeof input === "object" ? input : null;
        if (!window.SystemFS?.readFile) return typeof input === "object" ? input : null;
        return await window.SystemFS.readFile(path) || (typeof input === "object" ? input : null);
    }

    function contextIntent(context) {
        if (!context || typeof context !== "object") return null;
        const candidates = [
            context.intent,
            context.fileIntent,
            context.launchContext?.intent,
            context.launchContext?.fileIntent,
            context.action === "open-file" || context.action === "browse" ? context : null
        ];
        return candidates.find((candidate) => candidate && typeof candidate === "object") || null;
    }

    function consume(appId, context = {}) {
        const direct = contextIntent(context);
        if (direct && (!direct.targetApp || direct.targetApp === appId)) {
            pendingByApp.delete(appId);
            return direct;
        }
        const pending = pendingByApp.get(appId) || null;
        if (pending) pendingByApp.delete(appId);
        return pending;
    }

    async function open(input, options = {}) {
        const record = await resolve(input);
        if (!record) throw new Error("The selected file is no longer available.");

        const kind = classify(record);
        const targetApp = options.targetApp || appForKind(kind);
        if (!targetApp) return false;

        const intent = {
            type: "file",
            action: kind === "directory" ? "browse" : "open-file",
            targetApp,
            sourceApp: options.sourceApp || null,
            path: record.path || null,
            name: record.name || (record.path ? window.SystemFS?.getName?.(record.path) : "") || "File",
            mimeType: mimeTypeFor(record),
            kind,
            record,
            issuedAt: Date.now()
        };

        pendingByApp.set(targetApp, intent);
        window.EventBus?.emit("mobile:file-intent", intent);

        if (typeof window.openMobileApp !== "function") {
            pendingByApp.delete(targetApp);
            return false;
        }

        try {
            const launched = await window.openMobileApp(targetApp, {
                intent,
                launchContext: { intent }
            });
            return launched !== false;
        } catch (error) {
            console.warn(`PortfoliOS file intent: ${targetApp} could not be opened.`, error);
            return false;
        } finally {
            if (pendingByApp.get(targetApp) === intent) pendingByApp.delete(targetApp);
        }
    }

    function toBlob(record) {
        if (!record) return new Blob([]);
        if (record.data instanceof Blob) return record.data;
        return new Blob([record.data ?? ""], { type: mimeTypeFor(record) });
    }

    async function download(input) {
        const record = await resolve(input);
        if (!record || record.isDirectory) return false;
        const url = URL.createObjectURL(toBlob(record));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = record.name || window.SystemFS?.getName?.(record.path) || "download";
        anchor.hidden = true;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    }

    async function share(input) {
        if (typeof navigator.share !== "function") return false;
        const record = await resolve(input);
        if (!record || record.isDirectory || typeof File !== "function") return false;
        const blob = toBlob(record);
        const file = new File([blob], record.name || "file", {
            type: mimeTypeFor(record),
            lastModified: record.lastModified || Date.now()
        });
        const shareData = { title: file.name, files: [file] };
        if (typeof navigator.canShare === "function" && !navigator.canShare(shareData)) return false;
        await navigator.share(shareData);
        return true;
    }

    window.MobileFileIntents = {
        classify,
        mimeTypeFor,
        appForKind,
        canOpen: (record) => Boolean(appForKind(classify(record))),
        consume,
        download,
        open,
        resolve,
        share,
        toBlob
    };
})();
