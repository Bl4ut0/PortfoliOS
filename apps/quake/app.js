(function() {
    const QUAKE_SAVE_ROOT = "/Saved Games/Quake";

    function binaryStringToBlob(value) {
        const bytes = new Uint8Array(value.length);
        for (let i = 0; i < value.length; i++) {
            bytes[i] = value.charCodeAt(i) & 0xff;
        }
        return new Blob([bytes], { type: "application/octet-stream" });
    }

    async function dataToBinaryString(data) {
        if (typeof data === "string") return data;

        let buffer = null;
        if (data instanceof Blob) {
            buffer = await data.arrayBuffer();
        } else if (data instanceof ArrayBuffer) {
            buffer = data;
        } else if (ArrayBuffer.isView(data)) {
            buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        }

        if (!buffer) return "";
        const bytes = new Uint8Array(buffer);
        let output = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            output += String.fromCharCode(...bytes.slice(i, i + chunkSize));
        }
        return output;
    }

    function getQuakeSaveEntries() {
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const match = key && key.match(/^Quake\.([^/]+)\/(.+\.sav)$/i);
            if (!match) continue;

            entries.push({
                key,
                gameDir: match[1],
                fileName: match[2],
                value: localStorage.getItem(key) || ""
            });
        }
        return entries;
    }

    async function syncQuakeSavesToSystemFS() {
        if (!window.SystemFS) return;

        const entries = getQuakeSaveEntries();
        if (!entries.length) return;

        await window.SystemFS.ensureSavedGameDirectory("Quake");
        const gameDirs = new Set(entries.map((entry) => entry.gameDir));
        for (const gameDir of gameDirs) {
            await window.SystemFS.ensureDirectory(`${QUAKE_SAVE_ROOT}/${gameDir}`, { silent: true });
        }

        for (const entry of entries) {
            const parent = `${QUAKE_SAVE_ROOT}/${entry.gameDir}`;
            const blob = binaryStringToBlob(entry.value);
            await window.SystemFS.writeFile(
                `${parent}/${entry.fileName}`,
                entry.fileName,
                parent,
                blob,
                blob.size,
                "application/octet-stream",
                false,
                {
                    metadata: {
                        game: "quake",
                        storageKey: entry.key,
                        gameDir: entry.gameDir
                    }
                }
            );
        }
    }

    async function restoreQuakeSavesFromSystemFS() {
        if (!window.SystemFS) return;

        await window.SystemFS.ensureSavedGameDirectory("Quake");
        const gameDirs = await window.SystemFS.readDir(QUAKE_SAVE_ROOT);
        for (const dir of gameDirs) {
            if (!dir.isDirectory) continue;

            const files = await window.SystemFS.readDir(dir.path);
            for (const file of files) {
                if (file.isDirectory || !/\.sav$/i.test(file.name)) continue;
                const record = await window.SystemFS.readFile(file.path);
                if (!record) continue;

                const storageKey = record.metadata?.storageKey || `Quake.${dir.name}/${file.name}`;
                if (localStorage.getItem(storageKey) !== null) continue;
                const binaryString = await dataToBinaryString(record.data);
                localStorage.setItem(storageKey, binaryString);
            }
        }
    }

    window.appRegistry.quake = window.createIframeGameApp({
        id: "quake",
        title: "quake.exe",
        icon: "fa-solid fa-bolt",
        windowClass: "quake-window game-window",
        iframeSrc: "quake/index.html?v=1.0.22",
        saveDelay: 600,
        controlsHtml: `
            <li><kbd>WASD</kbd><span>move</span><kbd>Mouse</kbd><span>look</span></li>
            <li><kbd>Click</kbd><span>fire</span><kbd>Space</kbd><span>jump</span></li>
            <li><kbd>1-8</kbd><span>weapons</span><kbd>Esc</kbd><span>menu</span></li>
        `,
        beforeLoad: restoreQuakeSavesFromSystemFS,
        onSaveSync: syncQuakeSavesToSystemFS
    });
})();
