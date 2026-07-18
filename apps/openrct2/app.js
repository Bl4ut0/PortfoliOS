(function() {
    const APP_ID = "openrct2";
    const SAVE_DIR_NAME = "OpenRCT2";
    const SAVE_ROOT = "/Saved Games/OpenRCT2";
    const RUNTIME_URL = "apps/openrct2/runtime/index.php?v=1.0.57";
    const EMBED_URL = `${RUNTIME_URL}&embed=1`;
    const LINKS = {
        github: "https://github.com/OpenRCT2/OpenRCT2",
        docs: "https://docs.openrct2.io/en/latest/installing/installing-on-windows.html"
    };
    let openGeneration = 0;
    let focusTimer = null;
    let runtimeAbort = null;

    async function ensureSaveWorkspace() {
        if (!window.SystemFS) return;
        await window.SystemFS.ensureSavedGameDirectory(SAVE_DIR_NAME);
    }

    function getFrame(windowEl) {
        return windowEl?.querySelector(".openrct2-frame");
    }

    function setRuntimeStatus(windowEl, label) {
        const status = windowEl?.querySelector(".openrct2-runtime-status");
        if (status) status.textContent = label;
    }

    function loadEmbeddedRuntime(windowEl, force = false) {
        const iframe = getFrame(windowEl);
        if (!iframe) return;

        if (!window.crossOriginIsolated) {
            setRuntimeStatus(windowEl, "ISOLATION REQUIRED");
            window.showDesktopToast?.("OpenRCT2 needs the isolated PortfoliOS shell. Refresh the desktop if the frame does not boot.");
        } else {
            setRuntimeStatus(windowEl, "BOOTING");
        }

        if (force || !iframe.src || iframe.src === "about:blank") {
            iframe.src = force ? `${EMBED_URL}&reload=${Date.now()}` : EMBED_URL;
        }
    }

    function focusRuntime(windowEl) {
        const iframe = getFrame(windowEl);
        if (!iframe) return;
        if (focusTimer) window.clearTimeout(focusTimer);
        focusTimer = window.setTimeout(() => {
            focusTimer = null;
            if (!windowEl?.isConnected || windowEl.classList.contains("is-hidden")) return;
            iframe.focus({ preventScroll: true });
            iframe.contentWindow?.focus();
        }, 160);
    }

    function clearFocusTimer() {
        if (!focusTimer) return;
        window.clearTimeout(focusTimer);
        focusTimer = null;
    }

    async function toArrayBuffer(data) {
        if (data instanceof Blob) return data.arrayBuffer();
        if (data instanceof ArrayBuffer) return data;
        if (ArrayBuffer.isView(data)) {
            return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        }
        return new ArrayBuffer(0);
    }

    async function readSavedGames() {
        if (!window.SystemFS) return [];
        const items = await window.SystemFS.readDir(SAVE_ROOT);
        const files = [];
        for (const item of items) {
            if (item.isDirectory) continue;
            const record = await window.SystemFS.readFile(item.path);
            const runtimePath = record?.metadata?.runtimePath;
            if (!record || !runtimePath) continue;
            files.push({ path: runtimePath, data: await toArrayBuffer(record.data) });
        }
        return files;
    }

    async function restoreSavedGames(iframe) {
        const files = await readSavedGames();
        window.postMessageToIframe?.(iframe, {
            source: "portfolio-openrct2-shell",
            type: "openrct2-import-saves",
            files
        });
    }

    function systemFileName(runtimePath) {
        return String(runtimePath || "save.park")
            .replace(/^\/+/, "")
            .replace(/[^a-z0-9._-]+/gi, "__")
            .slice(-180) || "save.park";
    }

    async function persistExportedGames(files) {
        if (!window.SystemFS || !Array.isArray(files)) return;
        await ensureSaveWorkspace();
        for (const file of files) {
            const runtimePath = String(file?.path || "");
            if (!/^\/(?:persistent|OpenRCT2)\//.test(runtimePath) || !file?.data) continue;
            const blob = new Blob([file.data], { type: "application/octet-stream" });
            const name = systemFileName(runtimePath);
            await window.SystemFS.writeFile(
                `${SAVE_ROOT}/${name}`,
                name,
                SAVE_ROOT,
                blob,
                blob.size,
                "application/octet-stream",
                false,
                { metadata: { game: APP_ID, runtimePath } }
            );
        }
    }

    async function exportSavedGames(windowEl) {
        const iframe = getFrame(windowEl);
        if (!iframe?.contentWindow || !iframe.src || iframe.src === "about:blank") return;

        const requestId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
        const files = await new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                window.removeEventListener("message", onMessage);
                window.clearTimeout(timer);
                resolve(value);
            };
            const onMessage = (event) => {
                if (event.origin !== window.location.origin || event.source !== iframe.contentWindow) return;
                const data = event.data || {};
                if (data.source === "portfolio-openrct2-runtime"
                    && data.type === "openrct2-export-saves-result"
                    && data.requestId === requestId) {
                    finish(data.files || []);
                }
            };
            const timer = window.setTimeout(() => finish([]), 3000);
            window.addEventListener("message", onMessage);
            window.postMessageToIframe?.(iframe, {
                source: "portfolio-openrct2-shell",
                type: "openrct2-export-saves",
                requestId
            });
        });
        await persistExportedGames(files);
    }

    function bindOpenRCT2Window(windowEl) {
        if (windowEl.dataset.openrct2Initialized === "1") return;
        windowEl.dataset.openrct2Initialized = "1";
        runtimeAbort?.abort();
        runtimeAbort = new AbortController();
        const { signal } = runtimeAbort;

        windowEl.addEventListener("click", (event) => {
            const action = event.target.closest("[data-openrct2-action]")?.dataset.openrct2Action;
            if (!action) return;

            if (action === "reload") {
                loadEmbeddedRuntime(windowEl, true);
            } else if (action === "external") {
                window.open(RUNTIME_URL, "_blank", "noopener");
            } else if (action === "saved-games") {
                window.openDesktopWindow?.("files");
                window.showDesktopToast?.("Saved Games / OpenRCT2 workspace is ready.");
            } else if (action === "github") {
                window.open(LINKS.github, "_blank", "noopener,noreferrer");
            } else if (action === "docs") {
                window.open(LINKS.docs, "_blank", "noopener,noreferrer");
            }
        }, { signal });

        const iframe = getFrame(windowEl);
        iframe?.addEventListener("load", () => {
            if (!iframe.src || iframe.src === "about:blank") return;
            setRuntimeStatus(windowEl, "SYNCING SAVES");
            focusRuntime(windowEl);
        }, { signal });

        window.addEventListener("message", async (event) => {
            if (!iframe || event.origin !== window.location.origin || event.source !== iframe.contentWindow) return;
            const data = event.data || {};
            if (data.source !== "portfolio-openrct2-runtime") return;

            if (data.type === "openrct2-save-ready") {
                setRuntimeStatus(windowEl, "RESTORING SAVES");
                try {
                    await restoreSavedGames(iframe);
                } catch (error) {
                    console.warn("OpenRCT2 save restore failed.", error);
                    window.postMessageToIframe?.(iframe, {
                        source: "portfolio-openrct2-shell",
                        type: "openrct2-import-saves",
                        files: []
                    });
                }
            } else if (data.type === "openrct2-import-complete") {
                setRuntimeStatus(windowEl, "RUNNING");
                focusRuntime(windowEl);
            }
        }, { signal });
    }

    window.appRegistry[APP_ID] = {
        title: "openrct2.exe",
        icon: "fa-solid fa-train",
        windowClass: "openrct2-window game-window",
        renderBody: () => `
            <div class="openrct2-game-shell">
                <div class="openrct2-game-toolbar">
                    <span class="openrct2-runtime-status">READY</span>
                    <div class="openrct2-toolbar-actions">
                        <button type="button" data-openrct2-action="reload" title="Reload runtime">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                        <button type="button" data-openrct2-action="saved-games" title="Open saves">
                            <i class="fa-solid fa-floppy-disk"></i>
                        </button>
                        <button type="button" data-openrct2-action="external" title="Open in browser tab">
                            <i class="fa-solid fa-up-right-from-square"></i>
                        </button>
                        <button type="button" data-openrct2-action="github" title="Open source">
                            <i class="fa-brands fa-github"></i>
                        </button>
                        <button type="button" data-openrct2-action="docs" title="Open guide">
                            <i class="fa-solid fa-book"></i>
                        </button>
                    </div>
                </div>
                <iframe
                    data-src="${EMBED_URL}"
                    class="openrct2-frame game-frame"
                    title="OpenRCT2 runtime"
                    allow="cross-origin-isolated; fullscreen; autoplay"
                    loading="eager">
                </iframe>
            </div>
        `,
        onOpen: async (windowEl) => {
            const generation = ++openGeneration;
            bindOpenRCT2Window(windowEl);
            try {
                await ensureSaveWorkspace();
            } catch (error) {
                if (generation !== openGeneration || !windowEl.isConnected) return;
                console.warn("OpenRCT2 workspace setup failed.", error);
            }
            if (generation !== openGeneration || !windowEl.isConnected) return;
            window.syncGameIframe?.(windowEl);
            loadEmbeddedRuntime(windowEl);
            focusRuntime(windowEl);
        },
        onClose: async (windowEl) => {
            openGeneration++;
            clearFocusTimer();
            try {
                await exportSavedGames(windowEl);
            } catch (error) {
                console.warn("OpenRCT2 save export failed.", error);
            }
            runtimeAbort?.abort();
            runtimeAbort = null;
            const iframe = getFrame(windowEl);
            if (iframe) iframe.src = "about:blank";
        },
        onMinimize: (windowEl) => {
            clearFocusTimer();
            window.postMessageToIframe?.(getFrame(windowEl), { type: "release-pointer-lock" });
        },
        onRestore: (windowEl) => {
            window.syncGameIframe?.(windowEl);
            focusRuntime(windowEl);
        },
        onFocus: focusRuntime,
        onMaximize: focusRuntime
    };
})();
