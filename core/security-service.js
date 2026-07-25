/**
 * PortfoliOS SecurityKernel
 * Local-only file policy, integrity scanning, and quarantine service.
 * Files never leave the browser for inspection.
 */
(function() {
    const MAX_SCAN_BYTES = 64 * 1024 * 1024;
    const QUARANTINE_ROOT = "/.quarantine";
    const ACTIVE_EXTENSIONS = new Set([
        ".exe", ".dll", ".msi", ".com", ".scr", ".bat", ".cmd", ".ps1", ".vbs", ".vbe",
        ".js", ".mjs", ".cjs", ".wasm", ".jar", ".sh", ".bash", ".zsh", ".py", ".php"
    ]);
    const ACTIVE_MIME_TYPES = new Set([
        "application/javascript", "text/javascript", "application/x-javascript", "application/wasm",
        "application/x-msdownload", "application/x-msi", "application/x-sh", "application/x-bat"
    ]);
    const RISKY_DOCUMENT_EXTENSIONS = new Set([".html", ".htm", ".svg"]);
    const state = { initialized: false, lastScanAt: 0, lastResult: null };

    const extensionOf = (value = "") => {
        const match = String(value).toLowerCase().match(/(\.[a-z0-9]{1,12})$/);
        return match ? match[1] : "";
    };

    const safeName = (value = "file") => String(value || "file")
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/[\u0000-\u001f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "file";

    async function toBlob(data, type = "application/octet-stream") {
        if (data instanceof Blob) return data;
        return new Blob([data ?? ""], { type });
    }

    function bytesStartWith(bytes, values) {
        return values.every((value, index) => bytes[index] === value);
    }

    function sniffType(bytes, declaredType = "", name = "") {
        if (bytesStartWith(bytes, [0x4d, 0x5a])) return "application/x-msdownload";
        if (bytesStartWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) return "application/x-elf";
        if (bytesStartWith(bytes, [0x00, 0x61, 0x73, 0x6d])) return "application/wasm";
        if (bytesStartWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
        if (bytesStartWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
        if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
        if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
        const text = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 2048))).trimStart().toLowerCase();
        if (text.startsWith("<!doctype html") || text.startsWith("<html")) return "text/html";
        if (text.startsWith("<svg")) return "image/svg+xml";
        return declaredType || (extensionOf(name) === ".txt" ? "text/plain" : "application/octet-stream");
    }

    async function sha256(blob) {
        if (!window.crypto?.subtle) return "unavailable";
        const bytes = await blob.arrayBuffer();
        const digest = await window.crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    async function inspect({ name, type, data, size, source = "local-import" }) {
        const blob = await toBlob(data, type);
        const fileSize = Number(size ?? blob.size ?? 0);
        const normalizedName = safeName(name);
        const extension = extensionOf(normalizedName);
        const firstBytes = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
        const detectedType = sniffType(firstBytes, type, normalizedName);
        const result = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            name: normalizedName,
            source,
            declaredType: type || "application/octet-stream",
            detectedType,
            size: fileSize,
            scannedAt: Date.now(),
            scannerVersion: "1.0.0",
            verdict: "clean",
            reason: "Policy scan passed.",
            hash: null
        };

        if (fileSize > MAX_SCAN_BYTES) {
            result.verdict = "quarantined";
            result.reason = "File exceeds the local scanner size limit (64 MiB).";
        } else if (ACTIVE_EXTENSIONS.has(extension) || ACTIVE_MIME_TYPES.has(detectedType) || ACTIVE_MIME_TYPES.has(result.declaredType)) {
            result.verdict = "blocked";
            result.reason = "Executable or active code is not accepted into the local workspace.";
        } else if (RISKY_DOCUMENT_EXTENSIONS.has(extension) || ["text/html", "image/svg+xml"].includes(detectedType)) {
            result.verdict = "quarantined";
            result.reason = "Active document content requires review before it can enter the workspace.";
        } else if (detectedType === "application/zip" && fileSize > 32 * 1024 * 1024) {
            result.verdict = "quarantined";
            result.reason = "Large archive requires review to reduce archive-bomb risk.";
        }

        if (fileSize <= MAX_SCAN_BYTES) result.hash = await sha256(blob);
        state.lastScanAt = result.scannedAt;
        state.lastResult = result;
        return { result, blob };
    }

    async function ensureQuarantineRoot() {
        await window.SystemFS.ensureDirectory(QUARANTINE_ROOT, {
            silent: true,
            metadata: { sync: false, kind: "security-quarantine" }
        });
    }

    async function quarantine({ path, name, parent, data, size, type, source, scan }) {
        await ensureQuarantineRoot();
        const safePath = window.SystemFS.normalizePath(path || `/${safeName(name)}`);
        const quarantinePath = `${QUARANTINE_ROOT}/${scan.id}-${safeName(name)}`;
        const record = await window.SystemFS.writeFile(
            quarantinePath,
            safeName(name),
            QUARANTINE_ROOT,
            data,
            size,
            type || scan.detectedType,
            false,
            {
                silent: true,
                metadata: {
                    sync: false,
                    kind: "quarantine",
                    security: scan,
                    originalPath: safePath,
                    originalParent: parent || window.SystemFS.getParentPath(safePath)
                }
            }
        );
        window.EventBus?.emit("security:quarantined", { record, scan });
        return { status: "quarantined", record, scan };
    }

    async function importFile({ path, name, parent, data, size, type, source = "local-import", options = {} }) {
        if (!window.SystemFS) throw new Error("SystemFS is unavailable.");
        const safePath = window.SystemFS.normalizePath(path || `${parent || "/"}/${safeName(name)}`);
        const safeParent = window.SystemFS.normalizePath(parent || window.SystemFS.getParentPath(safePath));
        const scanned = await inspect({ name: name || window.SystemFS.getName(safePath), type, data, size, source });
        if (scanned.result.verdict !== "clean") {
            return quarantine({ path: safePath, name, parent: safeParent, data: scanned.blob, size, type, source, scan: scanned.result });
        }
        const record = await window.SystemFS.writeFile(
            safePath,
            safeName(name || window.SystemFS.getName(safePath)),
            safeParent,
            scanned.blob,
            size ?? scanned.blob.size,
            scanned.result.detectedType,
            false,
            {
                ...options,
                metadata: {
                    ...(options.metadata || {}),
                    security: scanned.result
                }
            }
        );
        window.EventBus?.emit("security:accepted", { record, scan: scanned.result });
        return { status: "accepted", record, scan: scanned.result };
    }

    async function scanExisting(record, source = "local-rescan") {
        if (!record || record.isDirectory) return { status: "accepted", record, scan: record?.metadata?.security || null };
        const existing = record.metadata?.security;
        if (existing?.verdict === "clean" && existing.hash && existing.scannerVersion === "1.0.0") {
            return { status: "accepted", record, scan: existing };
        }
        const scanned = await inspect({ ...record, source });
        if (scanned.result.verdict !== "clean") {
            await window.SystemFS.deleteFile(record.path, { silent: true });
            return quarantine({ ...record, data: scanned.blob, scan: scanned.result, source });
        }
        const updated = await window.SystemFS.writeFile(
            record.path, record.name, record.parent, scanned.blob, scanned.blob.size,
            scanned.result.detectedType, false,
            { silent: true, lastModified: record.lastModified, metadata: { ...(record.metadata || {}), security: scanned.result } }
        );
        return { status: "accepted", record: updated, scan: scanned.result };
    }

    async function getQuarantine() {
        if (!window.SystemFS) return [];
        const records = await window.SystemFS.readDir(QUARANTINE_ROOT);
        return records.filter((record) => record.metadata?.kind === "quarantine").sort((a, b) => Number(b.lastModified) - Number(a.lastModified));
    }

    async function deleteQuarantine(path) {
        if (!String(path || "").startsWith(`${QUARANTINE_ROOT}/`)) throw new Error("Only quarantined files can be removed here.");
        await window.SystemFS.deleteFile(path);
        window.EventBus?.emit("security:quarantine-removed", { path });
    }

    async function scanWorkspace() {
        const files = await window.SystemFS.getAllFiles();
        let accepted = 0;
        let quarantined = 0;
        for (const record of files) {
            if (record.isDirectory || protectedPath(record.path) || record.metadata?.sync === false) continue;
            const outcome = await scanExisting(record, "workspace-scan");
            if (outcome.status === "accepted") accepted++;
            else quarantined++;
        }
        const summary = { accepted, quarantined, scannedAt: Date.now() };
        window.EventBus?.emit("security:workspace-scanned", summary);
        return summary;
    }

    async function getSummary() {
        const quarantine = await getQuarantine();
        return {
            scannerVersion: "1.0.0",
            localOnly: true,
            tokenMode: "memory-only",
            quarantineCount: quarantine.length,
            lastScanAt: state.lastScanAt,
            lastResult: state.lastResult
        };
    }

    function protectedPath(path) {
        const normalized = window.SystemFS?.normalizePath?.(path) || String(path || "");
        const parts = normalized.split("/").filter(Boolean);
        if (parts.some((part) => part.startsWith("."))) return true;
        return ["/apps", "/ROMs", "/etc"].some((root) => normalized === root || normalized.startsWith(`${root}/`))
            || normalized === QUARANTINE_ROOT || normalized.startsWith(`${QUARANTINE_ROOT}/`);
    }

    function assertAgentAccess(path, operation = "read") {
        const normalized = window.SystemFS?.normalizePath?.(path) || String(path || "");
        if (protectedPath(normalized)) {
            throw new Error(`Agent ${operation} access is denied for protected system data.`);
        }
        return normalized;
    }

    window.SecurityKernel = {
        init: async () => {
            if (state.initialized) return;
            if (!window.SystemFS) throw new Error("SystemFS is unavailable.");
            await ensureQuarantineRoot();
            state.initialized = true;
            window.setTimeout(() => {
                scanWorkspace().catch((error) => console.warn("PortfoliOS: background security scan failed.", error));
            }, 0);
        },
        inspect,
        importFile,
        scanExisting,
        scanWorkspace,
        getQuarantine,
        deleteQuarantine,
        getSummary,
        assertAgentAccess,
        isProtectedPath: protectedPath,
        isQuarantinePath: (path) => String(path || "").startsWith(`${QUARANTINE_ROOT}/`),
        policy: { maxScanBytes: MAX_SCAN_BYTES, quarantineRoot: QUARANTINE_ROOT }
    };
})();
