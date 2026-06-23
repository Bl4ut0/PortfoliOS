/**
 * PortfoliOS utility app template.
 * Copy this folder, rename APP_ID/windowClass/CSS selectors, and add the ID to
 * window.modularApps in core/app-loader.js plus the Store/Desktop catalog.
 */
(function() {
    const APP_ID = "myapp";
    let unregisterAudio = null;

    function setVolume(volume) {
        // Wire Web Audio, media elements, or iframe volume handling here.
        console.debug(`${APP_ID} volume`, volume);
    }

    window.appRegistry[APP_ID] = {
        title: "myapp.exe",
        icon: "fa-solid fa-window-restore",
        windowClass: "myapp-window utility-window",
        renderBody: () => `
            <div class="myapp-shell">
                <header class="myapp-toolbar">
                    <button type="button" class="myapp-action">
                        <i class="fa-solid fa-rotate"></i>
                        Refresh
                    </button>
                </header>
                <main class="myapp-body" tabindex="0">
                    <h2>My App</h2>
                    <p>Replace this template with the app experience.</p>
                </main>
            </div>
        `,
        onOpen: (windowEl) => {
            unregisterAudio = window.registerAppAudioAdapter?.(APP_ID, { setVolume }) || null;
            windowEl.querySelector(".myapp-body")?.focus({ preventScroll: true });
        },
        onMinimize: () => {
            // Pause timers, animations, polling, or audio when useful.
        },
        onMaximize: () => {
            // Re-measure canvas/editor surfaces if this app has fixed-format content.
        },
        onClose: () => {
            unregisterAudio?.();
            unregisterAudio = null;
        },
        setVolume
    };
})();
