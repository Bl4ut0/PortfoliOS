(function() {
    let webampInstance = null;

    async function loadWebampLibrary() {
        if (window.Webamp) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.id = "webamp-library-script";
            script.src = "https://unpkg.com/webamp@1.4.2/built/webamp.bundle.min.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Webamp library from CDN"));
            document.head.appendChild(script);
        });
    }

    async function initWebamp(windowEl) {
        try {
            await loadWebampLibrary();
            
            const mountPoint = windowEl.querySelector(".webamp-mount");
            const statusEl = windowEl.querySelector(".webamp-status");
            if (!mountPoint) return;

            const initialTracks = [
                {
                    metaData: {
                        title: "Elysium Theme",
                        artist: "PortfoliOS Core"
                    },
                    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                }
            ];

            webampInstance = new window.Webamp({
                initialTracks,
                zIndex: 9999
            });

            await webampInstance.renderWhenReady(mountPoint);
            if (statusEl) statusEl.style.display = "none";
            
            webampInstance.onClose(() => {
                closeDesktopWindow("webamp");
            });

        } catch (err) {
            console.error("Webamp loading failed:", err);
            const statusEl = windowEl.querySelector(".webamp-status");
            if (statusEl) {
                statusEl.textContent = "Failed to load player. Ensure you are connected to the internet.";
            }
        }
    }

    window.appRegistry.webamp = {
        title: "webamp.exe",
        icon: "fa-solid fa-music",
        windowClass: "webamp-window",
        renderBody: () => `
            <div class="webamp-shell">
                <div class="webamp-status"><i class="fa-solid fa-spinner fa-spin"></i> Initializing Webamp player...</div>
                <div class="webamp-mount"></div>
            </div>
        `,
        onOpen: (windowEl) => {
            if (!webampInstance) {
                initWebamp(windowEl);
            }
        },
        onClose: (windowEl) => {
            if (webampInstance) {
                try {
                    webampInstance.dispose();
                } catch (e) {}
                webampInstance = null;
            }
            document.getElementById("webamp-library-script")?.remove();
            delete window.Webamp;
        },
        playTrack: async (data, name) => {
            if (!webampInstance) return;
            let blob = data;
            if (!(blob instanceof Blob)) {
                blob = new Blob([blob], { type: "audio/mp3" });
            }
            const url = URL.createObjectURL(blob);
            webampInstance.setTracksToPlay([{
                metaData: {
                    title: name,
                    artist: "Local Storage"
                },
                url: url
            }]);
        }
    };
})();
