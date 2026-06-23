/**
 * PortfoliOS iframe game template.
 * Copy this folder and wire iframeSrc, controls, save import/export hooks, and
 * any game-specific postMessage protocol.
 */
(function() {
    const APP_ID = "mygame";
    const SAVE_DIR_NAME = "My Game";

    async function restoreSavesFromSystemFS() {
        if (!window.SystemFS) return;
        await window.SystemFS.ensureSavedGameDirectory(SAVE_DIR_NAME);

        // Read /Saved Games/My Game here and inject saves before iframe.src is set.
    }

    async function syncSavesToSystemFS(windowEl) {
        if (!window.SystemFS) return;
        const iframe = windowEl.querySelector("iframe.game-frame");
        const saveDir = await window.SystemFS.ensureSavedGameDirectory(SAVE_DIR_NAME);

        // Ask the runtime to flush saves, then mirror data into SystemFS.
        window.postMessageToIframe?.(iframe, { type: "save-sync" });
        console.debug(`${APP_ID} save directory`, saveDir);
    }

    window.appRegistry[APP_ID] = window.createIframeGameApp({
        id: APP_ID,
        title: "mygame.exe",
        icon: "fa-solid fa-gamepad",
        windowClass: "mygame-window game-window",
        iframeSrc: "mygame/index.html",
        saveDelay: 600,
        controlsHtml: `
            <li><kbd>Click</kbd><span>focus game input</span></li>
            <li><kbd>WASD</kbd><span>move</span><kbd>Mouse</kbd><span>look</span></li>
            <li><kbd>Ctrl</kbd><kbd>Alt</kbd><span>release cursor</span></li>
        `,
        beforeLoad: restoreSavesFromSystemFS,
        onSaveSync: syncSavesToSystemFS
    });
})();
