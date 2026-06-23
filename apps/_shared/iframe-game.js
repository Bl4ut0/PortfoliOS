/**
 * PortfoliOS: Shared Iframe Game App Helper
 * Factory function to create game apps running inside an iframe (e.g. Diablo, Duke Nukem, Quake)
 * which share common behaviors: pointer release, loading sync, delayed iframe src reset.
 */

window.createIframeGameApp = (config) => {
    const { id, title, icon, windowClass, iframeSrc, controlsHtml, saveDelay = 600 } = config;
    
    function releasePointerLock(windowEl) {
        const iframe = windowEl?.querySelector("iframe.game-frame");
        try {
            const targetOrigin = iframe ? new URL(iframe.dataset.src || iframe.src, window.location.href).origin : window.location.origin;
            iframe?.contentWindow?.postMessage({ type: "release-pointer-lock" }, targetOrigin);
        } catch (error) {}
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
            const iframe = windowEl.querySelector("iframe");
            if (typeof config.beforeLoad === "function" && iframe && !iframe.src) {
                try {
                    await config.beforeLoad(windowEl);
                } catch (error) {
                    console.warn(`PortfoliOS: ${id} beforeLoad hook failed`, error);
                }
            }
            if (iframe && !iframe.src) {
                iframe.src = iframe.dataset.src;
            }
            window.syncGameIframe?.(windowEl);
            window.showGameControls?.(windowEl);
            if (typeof config.onOpen === "function") {
                await config.onOpen(windowEl);
            }
        },
        onMinimize: releasePointerLock,
        onMaximize: (windowEl) => {
            window.syncGameIframe?.(windowEl);
            window.showGameControls?.(windowEl);
        },
        onClose: async (windowEl) => {
            releasePointerLock(windowEl);
            const iframe = windowEl.querySelector("iframe");
            if (iframe) {
                try {
                    const targetOrigin = new URL(iframe.dataset.src || iframe.src, window.location.href).origin;
                    iframe.contentWindow?.postMessage({ type: "save-sync" }, targetOrigin);
                } catch (e) {}
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
                window.setTimeout(() => {
                    iframe.src = "";
                }, saveDelay);
            }
        }
    };
};
