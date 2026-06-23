(function() {
    const DIABLO_SAVE_DIR = "/Saved Games/Diablo";

    function dataToBlob(data) {
        if (data instanceof Blob) return data;
        if (data instanceof ArrayBuffer) {
            return new Blob([data], { type: "application/octet-stream" });
        }
        if (ArrayBuffer.isView(data)) {
            return new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)], {
                type: "application/octet-stream"
            });
        }
        return new Blob([data || ""], { type: "application/octet-stream" });
    }

    function getDiabloStorageSnapshot() {
        return new Promise((resolve) => {
            const iframe = document.createElement("iframe");
            let settled = false;

            const cleanup = (result) => {
                if (settled) return;
                settled = true;
                window.removeEventListener("message", handleMessage);
                iframe.remove();
                resolve(result);
            };

            const handleMessage = (event) => {
                if (event.source !== iframe.contentWindow) return;
                if (event.origin !== window.location.origin) return;
                if (!event.data || event.data.method !== "storage") return;
                cleanup(event.data.files || new Map());
            };

            iframe.hidden = true;
            iframe.src = "diablo/storage.html";
            iframe.addEventListener("load", () => {
                try {
                    iframe.contentWindow.postMessage({ method: "transfer" }, window.location.origin);
                } catch (error) {
                    cleanup(new Map());
                }
            });
            iframe.addEventListener("error", () => cleanup(new Map()));
            window.addEventListener("message", handleMessage);
            document.body.appendChild(iframe);
            window.setTimeout(() => cleanup(new Map()), 5000);
        });
    }

    function storageEntries(files) {
        if (files instanceof Map) return Array.from(files.entries());
        if (Array.isArray(files)) return files;
        if (files && typeof files === "object") return Object.entries(files);
        return [];
    }

    async function syncDiabloSavesToSystemFS() {
        if (!window.SystemFS) return;

        const files = await getDiabloStorageSnapshot();
        const saveEntries = storageEntries(files).filter(([name]) => /\.sv$/i.test(String(name)));
        if (!saveEntries.length) return;

        const saveDir = await window.SystemFS.ensureSavedGameDirectory("Diablo");
        for (const [name, data] of saveEntries) {
            const fileName = String(name).replace(/^.*[/\\]/, "");
            const blob = dataToBlob(data);
            await window.SystemFS.writeFile(
                `${saveDir}/${fileName}`,
                fileName,
                saveDir,
                blob,
                blob.size,
                "application/octet-stream",
                false,
                {
                    metadata: {
                        game: "diablo",
                        storageKey: String(name)
                    }
                }
            );
        }
    }

    window.appRegistry.diablo = window.createIframeGameApp({
        id: "diablo",
        title: "diablo.exe",
        icon: "fa-solid fa-skull",
        windowClass: "diablo-window game-window",
        iframeSrc: "diablo/index.html?v=1.0.24",
        saveDelay: 800,
        controlsHtml: `
            <li><kbd>Mouse</kbd><span>move, interact, attack</span></li>
            <li><kbd>Right</kbd><span>cast selected spell</span></li>
            <li><kbd>I</kbd><span>inventory</span><kbd>C</kbd><span>character</span></li>
            <li><kbd>1-8</kbd><span>belt items</span><kbd>Tab</kbd><span>map</span></li>
        `,
        onSaveSync: syncDiabloSavesToSystemFS
    });
})();
