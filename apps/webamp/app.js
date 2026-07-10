(function() {
    let webampInstance = null;
    let libraryPromise = null;
    let rejectLibraryLoad = null;
    let initPromise = null;
    let initGeneration = 0;
    const trackUrls = new Set();

    async function loadWebampLibrary() {
        if (window.Webamp) return window.Webamp;
        if (libraryPromise) return libraryPromise;

        document.getElementById("webamp-library-script")?.remove();
        libraryPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.id = "webamp-library-script";
            script.src = "https://unpkg.com/webamp@1.4.2/built/webamp.bundle.min.js";
            rejectLibraryLoad = reject;
            script.onload = () => {
                const Webamp = window.Webamp;
                libraryPromise = null;
                rejectLibraryLoad = null;
                if (Webamp) resolve(Webamp);
                else reject(new Error("Webamp loaded without exposing its player constructor."));
            };
            script.onerror = () => {
                libraryPromise = null;
                rejectLibraryLoad = null;
                reject(new Error("Failed to load Webamp library from CDN."));
            };
            document.head.appendChild(script);
        });
        return libraryPromise;
    }

    function cancelLibraryLoad() {
        rejectLibraryLoad?.(new Error("Webamp initialization was cancelled."));
        rejectLibraryLoad = null;
        libraryPromise = null;
        document.getElementById("webamp-library-script")?.remove();
    }

    async function initWebamp(windowEl) {
        if (webampInstance) return webampInstance;
        if (initPromise) return initPromise;

        const generation = ++initGeneration;
        initPromise = (async () => {
            try {
                const Webamp = await loadWebampLibrary();
                if (generation !== initGeneration || !windowEl.isConnected) return null;

                const mountPoint = windowEl.querySelector(".webamp-mount");
                const statusEl = windowEl.querySelector(".webamp-status");
                if (!mountPoint) return null;

                const initialTracks = [
                    {
                        metaData: {
                            title: "Elysium Theme",
                            artist: "PortfoliOS Core"
                        },
                        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                    }
                ];

                const instance = new Webamp({
                    initialTracks,
                    zIndex: 9999
                });
                webampInstance = instance;
                await instance.renderWhenReady(mountPoint);

                if (generation !== initGeneration || !windowEl.isConnected) {
                    try {
                        instance.dispose();
                    } catch (error) {}
                    if (webampInstance === instance) webampInstance = null;
                    return null;
                }

                if (statusEl) statusEl.style.display = "none";
                instance.onClose(() => window.closeDesktopWindow?.("webamp"));
                return instance;
            } catch (error) {
                if (generation !== initGeneration || !windowEl.isConnected) return null;
                console.error("Webamp loading failed:", error);
                const statusEl = windowEl.querySelector(".webamp-status");
                if (statusEl) {
                    statusEl.textContent = "Failed to load player. Ensure you are connected to the internet.";
                }
                return null;
            } finally {
                if (generation === initGeneration) initPromise = null;
            }
        })();

        return initPromise;
    }

    window.appRegistry.webamp = {
        title: "webamp.exe",
        icon: "fa-solid fa-music",
        windowClass: "webamp-window media-window",
        renderBody: () => `
            <div class="webamp-shell">
                <div class="webamp-status"><i class="fa-solid fa-spinner fa-spin"></i> Initializing Webamp player...</div>
                <div class="webamp-mount"></div>
            </div>
        `,
        onOpen: (windowEl) => {
            return initWebamp(windowEl);
        },
        onClose: (windowEl) => {
            initGeneration++;
            cancelLibraryLoad();
            if (webampInstance) {
                try {
                    webampInstance.dispose();
                } catch (error) {}
                webampInstance = null;
            }
            trackUrls.forEach((url) => URL.revokeObjectURL(url));
            trackUrls.clear();
            delete window.Webamp;
        },
        playTrack: async (data, name) => {
            const windowEl = document.querySelector('[data-window="webamp"]');
            const instance = webampInstance || (windowEl ? await initWebamp(windowEl) : null);
            if (!instance) return;
            let blob = data;
            if (!(blob instanceof Blob)) {
                blob = new Blob([blob], { type: "audio/mp3" });
            }
            const url = URL.createObjectURL(blob);
            trackUrls.add(url);
            instance.setTracksToPlay([{
                metaData: {
                    title: name,
                    artist: "Local Storage"
                },
                url: url
            }]);
        }
    };
})();
