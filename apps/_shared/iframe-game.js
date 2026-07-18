/**
 * PortfoliOS: Shared Iframe Game App Helper
 * Factory function to create game apps running inside an iframe (e.g. Diablo, Duke Nukem, Quake)
 * which share common behaviors: pointer release, loading sync, delayed iframe src reset.
 */

window.createIframeGameApp = (config) => {
    const { id, title, icon, windowClass, iframeSrc, controlsHtml, saveDelay = 600 } = config;
    let openGeneration = 0;
    let openAbortController = null;

    function cancelPendingOpen() {
        openGeneration++;
        openAbortController?.abort();
        openAbortController = null;
    }

    function isOpenCurrent(generation, signal, windowEl) {
        return generation === openGeneration && !signal.aborted && windowEl?.isConnected;
    }
    
    function releasePointerLock(windowEl) {
        const iframe = windowEl?.querySelector("iframe.game-frame");
        window.postMessageToIframe?.(iframe, { type: "release-pointer-lock" });
    }

    return {
        title,
        icon,
        windowClass,
        renderBody: () => `
            <div class="game-shell">
                <iframe data-src="${iframeSrc}" class="game-frame" title="${title} runtime" sandbox="allow-scripts allow-same-origin allow-pointer-lock"></iframe>
                <aside class="game-control-card" data-game-controls>
                    <div class="game-control-header">
                        <span><i class="fa-solid fa-keyboard"></i> ${title} controls</span>
                        <button class="game-control-close" type="button" data-dismiss-game-controls title="Hide controls">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <ul class="game-control-list">
                        ${controlsHtml}
                        <li><kbd>Ctrl</kbd><kbd>Alt</kbd><span>release cursor</span></li>
                    </ul>
                </aside>
            </div>
        `,
        onOpen: async (windowEl) => {
            cancelPendingOpen();
            const generation = openGeneration;
            const abortController = new AbortController();
            openAbortController = abortController;
            const { signal } = abortController;
            const iframe = windowEl.querySelector("iframe");
            if (typeof config.beforeLoad === "function" && iframe && (!iframe.src || iframe.src === "about:blank")) {
                try {
                    await config.beforeLoad(windowEl, { signal });
                } catch (error) {
                    if (signal.aborted) return;
                    console.warn(`PortfoliOS: ${id} beforeLoad hook failed`, error);
                }
            }
            if (!isOpenCurrent(generation, signal, windowEl)) return;
            if (iframe && (!iframe.src || iframe.src === "about:blank")) {
                iframe.src = iframe.dataset.src;
            }
            window.syncGameIframe?.(windowEl);
            window.showGameControls?.(windowEl);
            try {
                if (typeof config.onOpen === "function") {
                    await config.onOpen(windowEl, { signal });
                }
            } finally {
                if (openAbortController === abortController) {
                    openAbortController = null;
                }
            }
        },
        onMinimize: releasePointerLock,
        onRestore: async (windowEl) => {
            window.syncGameIframe?.(windowEl);
            window.showGameControls?.(windowEl);
            if (typeof config.onRestore === "function") {
                await config.onRestore(windowEl);
            }
        },
        onFocus: async (windowEl) => {
            window.syncGameIframe?.(windowEl);
            if (typeof config.onFocus === "function") {
                await config.onFocus(windowEl);
            }
        },
        onMaximize: (windowEl) => {
            window.syncGameIframe?.(windowEl);
            window.showGameControls?.(windowEl);
        },
        onClose: async (windowEl) => {
            cancelPendingOpen();
            releasePointerLock(windowEl);
            const iframe = windowEl.querySelector("iframe");
            if (iframe) {
                window.postMessageToIframe?.(iframe, { type: "save-sync" });
                if (typeof config.onSaveSync === "function") {
                    try {
                        await config.onSaveSync(windowEl);
                    } catch (error) {
                        console.warn(`PortfoliOS: ${id} save sync hook failed`, error);
                    }
                }
                if (typeof config.onClose === "function") {
                    await config.onClose(windowEl);
                }
                iframe.style.visibility = "hidden";
                await new Promise((resolve) => window.setTimeout(resolve, saveDelay));
                if (iframe.isConnected) iframe.src = "";
            }
        }
    };
};
