(function() {
    async function syncDukeSavesToSystemFS(windowEl) {
        const iframe = windowEl.querySelector("iframe");
        if (!iframe || !iframe.contentWindow || !iframe.contentWindow.dukeFs) return;

        const fs = iframe.contentWindow.dukeFs;
        if (!fs.fs || typeof fs.fs.readdir !== "function" || typeof fs.fs.readFile !== "function") return;

        let filesList = [];
        try {
            filesList = fs.fs.readdir("/");
        } catch (e) {
            console.error("Failed to read Duke virtual directory:", e);
            return;
        }

        const saveFiles = filesList.filter(name => /\.gdm$/i.test(name));
        if (!saveFiles.length) return;

        const saveDir = await window.SystemFS.ensureSavedGameDirectory("Duke3D");

        for (const fileName of saveFiles) {
            let data;
            try {
                data = fs.fs.readFile(fileName); // Returns Uint8Array
            } catch (e) {
                console.error(`Failed to read Duke save ${fileName}:`, e);
                continue;
            }

            const blob = new Blob([data], { type: "application/octet-stream" });
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
                        game: "duke3d",
                        fileName: fileName
                    }
                }
            );
        }
    }

    window.restoreDukeSaves = async (fs) => {
        if (!window.SystemFS) return;

        const saveDir = "/Saved Games/Duke3D";
        await window.SystemFS.ensureSavedGameDirectory("Duke3D");

        let files;
        try {
            files = await window.SystemFS.readDir(saveDir);
        } catch (e) {
            console.error("Failed to read Duke save directory:", e);
            return;
        }

        const saveFiles = files.filter(f => !f.isDirectory && /\.gdm$/i.test(f.name));
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
            try {
                fs.createFile(file.name, uint8Array);
            } catch (e) {
                console.error(`Failed to write Duke save ${file.name} to virtual FS:`, e);
            }
        }
    };

    window.appRegistry.duke32 = window.createIframeGameApp({
        id: "duke32",
        title: "duke3d.exe",
        icon: "fa-solid fa-radiation",
        windowClass: "duke32-window game-window",
        iframeSrc: "duke32/index.html?v=1.0.25",
        saveDelay: 600,
        controlsHtml: `
            <li><kbd>Click</kbd><span>focus game input</span></li>
            <li><kbd>W</kbd><kbd>S</kbd><span>move</span><kbd>A</kbd><kbd>D</kbd><span>strafe</span></li>
            <li><kbd>Mouse</kbd><span>look while locked</span></li>
            <li><kbd>Arrows</kbd><span>turn and look</span></li>
            <li><kbd>Q</kbd><span>fire</span><kbd>E</kbd><span>open/use</span></li>
            <li><kbd>Ctrl</kbd><span>backup fire</span><kbd>Shift</kbd><span>run</span></li>
            <li><kbd>Enter</kbd><span>select</span><kbd>Esc</kbd><span>menu</span></li>
        `,
        onSaveSync: syncDukeSavesToSystemFS
    });
})();
