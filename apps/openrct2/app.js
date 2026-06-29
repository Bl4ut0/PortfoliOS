(function() {
    const APP_ID = "openrct2";
    const SAVE_DIR_NAME = "OpenRCT2";
    const RUNTIME_URL = "apps/openrct2/runtime/index.php?v=1.0.56";
    const EMBED_URL = `${RUNTIME_URL}&embed=1`;
    const LINKS = {
        github: "https://github.com/OpenRCT2/OpenRCT2",
        docs: "https://docs.openrct2.io/en/latest/installing/installing-on-windows.html"
    };

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
        window.setTimeout(() => {
            iframe.focus({ preventScroll: true });
            iframe.contentWindow?.focus();
        }, 160);
    }

    function bindOpenRCT2Window(windowEl) {
        if (windowEl.dataset.openrct2Initialized === "1") return;
        windowEl.dataset.openrct2Initialized = "1";

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
        });

        const iframe = getFrame(windowEl);
        iframe?.addEventListener("load", () => {
            setRuntimeStatus(windowEl, "RUNNING");
            focusRuntime(windowEl);
        });
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
            bindOpenRCT2Window(windowEl);
            try {
                await ensureSaveWorkspace();
            } catch (error) {
                console.warn("OpenRCT2 workspace setup failed.", error);
            }
            window.syncGameIframe?.(windowEl);
            loadEmbeddedRuntime(windowEl);
            focusRuntime(windowEl);
        },
        onClose: (windowEl) => {
            const iframe = getFrame(windowEl);
            if (iframe) iframe.src = "about:blank";
        },
        onMaximize: focusRuntime
    };
})();
