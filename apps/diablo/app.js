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

    async function restoreDiabloSavesFromSystemFS() {
        if (!window.SystemFS) return;

        const saveDir = "/Saved Games/Diablo";
        await window.SystemFS.ensureSavedGameDirectory("Diablo");

        let files;
        try {
            files = await window.SystemFS.readDir(saveDir);
        } catch (e) {
            console.error("Failed to read Diablo save directory:", e);
            return;
        }

        const saveFiles = files.filter(f => !f.isDirectory && /\.sv$/i.test(f.name));
        if (!saveFiles.length) return;

        return new Promise((resolve) => {
            const request = indexedDB.open("diablo_fs");
            request.onerror = (err) => {
                console.error("Failed to open diablo_fs IndexedDB:", err);
                resolve();
            };
            request.onsuccess = async () => {
                const db = request.result;
                if (!db.objectStoreNames.contains("kv")) {
                    db.close();
                    resolve();
                    return;
                }

                try {
                    const transaction = db.transaction(["kv"], "readwrite");
                    const store = transaction.objectStore("kv");

                    for (const file of saveFiles) {
                        const record = await window.SystemFS.readFile(file.path);
                        if (!record || !record.data) continue;

                        let arrayBuffer;
                        if (record.data instanceof Blob) {
                            arrayBuffer = await record.data.arrayBuffer();
                        } else if (record.data instanceof ArrayBuffer) {
                            arrayBuffer = record.data;
                        } else if (ArrayBuffer.isView(record.data)) {
                            arrayBuffer = record.data.buffer.slice(
                                record.data.byteOffset,
                                record.data.byteOffset + record.data.byteLength
                            );
                        }

                        if (!arrayBuffer) continue;
                        
                        const uint8Array = new Uint8Array(arrayBuffer);
                        const dbKey = file.name.toLowerCase();
                        store.put(uint8Array, dbKey);
                    }

                    transaction.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    transaction.onerror = (err) => {
                        console.error("Diablo restore saves transaction failed:", err);
                        db.close();
                        resolve();
                    };
                } catch (e) {
                    console.error("Diablo restore saves failed:", e);
                    db.close();
                    resolve();
                }
            };
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore("kv", { autoIncrement: true });
            };
        });
    }

    window.appRegistry.diablo = window.createIframeGameApp({
        id: "diablo",
        title: "diablo.exe",
        icon: "fa-solid fa-skull",
        windowClass: "diablo-window game-window",
        iframeSrc: "diablo/index.html?v=1.0.24",
        saveDelay: 800,
        controlsHtml: `
            <li class="control-key-item"><kbd>Mouse</kbd><span>move, interact, attack</span></li>
            <li class="control-key-item"><kbd>Right Click</kbd><span>cast selected spell</span></li>
            <li class="control-key-item"><kbd>I</kbd><span>inventory</span><kbd>C</kbd><span>character</span></li>
            <li class="control-key-item"><kbd>1-8</kbd><span>belt items</span><kbd>Tab</kbd><span>map</span></li>
        `,
        beforeLoad: restoreDiabloSavesFromSystemFS,
        onSaveSync: syncDiabloSavesToSystemFS
    });
})();
