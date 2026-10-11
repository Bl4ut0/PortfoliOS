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

    const PAK_PATH = "/apps/quake/id1/pak0.pak";
    async function prepareQuake(windowEl, {signal}) {
        const setup = windowEl.querySelector('[data-quake-setup]');
        const status = windowEl.querySelector('[data-quake-status]');
        const input = windowEl.querySelector('[data-quake-pak]');
        const owner = window.state.currentUserId;
        if (!input.dataset.bound) {
            input.dataset.bound = '1';
            input.addEventListener('change', async () => {
                const file = input.files[0]; if (!file) return;
                try {
                    const bytes = await file.arrayBuffer();
                    const header = new DataView(bytes);
                    if (bytes.byteLength < 12 || header.getUint32(0, true) !== 0x4b434150) throw Error('Choose a valid Quake PAK file.');
                    const offset = header.getUint32(4,true), length = header.getUint32(8,true);
                    if (!length || length % 64 || offset + length > bytes.byteLength) throw Error('The PAK directory is incomplete. Choose the original pak0.pak.');
                    const directory = new DataView(bytes, offset, length), names = new Set(), decoder = new TextDecoder();
                    for (let pos = 0; pos < length; pos += 64) {
                        const start = directory.getUint32(pos + 56, true), size = directory.getUint32(pos + 60, true);
                        if (start + size > bytes.byteLength) throw Error('The PAK contains a truncated entry. Choose the original pak0.pak.');
                        names.add(decoder.decode(new Uint8Array(bytes, offset + pos, 56)).split('\0')[0].toLowerCase());
                    }
                    if (!names.has('gfx.wad') || !names.has('progs.dat')) throw Error('Choose the base pak0.pak containing Quake game data.');
                    if (!windowEl.isConnected || window.state.currentUserId !== owner) return;
                    status.textContent = 'Installing local game data…';
                    await window.SystemFS.writeFile(PAK_PATH, 'pak0.pak', '/apps/quake/id1', bytes, bytes.byteLength, 'application/octet-stream', false,
                        {metadata:{sync:false,kind:'app-runtime',app:'quake'}});
                    if (!windowEl.isConnected || window.state.currentUserId !== owner) return;
                    await navigator.serviceWorker.ready;
                    if (!navigator.serviceWorker.controller) {status.textContent='Game data installed. Reload PortfoliOS to activate its runtime cache.';return;}
                    await window.appRegistry.quake.onOpen(windowEl);
                } catch(error) {status.textContent=error.message || 'Game data could not be installed.';}
            });
        }
        let available = Boolean(await window.SystemFS.readFile(PAK_PATH));
        if (!available) {
            try {const response = await fetch('/quake/id1/pak0.pak', {method:'HEAD',signal});available=response.ok && Number(response.headers.get('content-length'))>=12;} catch {}
        }
        if (signal.aborted || !windowEl.isConnected || window.state.currentUserId !== owner) return false;
        setup.hidden = available;
        if (!available) return false;
        await restoreQuakeSavesFromSystemFS();
    }

    window.appRegistry.quake = window.createIframeGameApp({
        id: "quake",
        title: "quake.exe",
        icon: "fa-solid fa-bolt",
        windowClass: "quake-window game-window",
        iframeSrc: "quake/index.php?v=1.0.22",
        saveDelay: 600,
        controlsHtml: `
            <li><kbd>WASD</kbd><span>move</span><kbd>Mouse</kbd><span>look</span></li>
            <li><kbd>Click</kbd><span>fire</span><kbd>Space</kbd><span>jump</span></li>
            <li><kbd>1-8</kbd><span>weapons</span><kbd>Esc</kbd><span>menu</span></li>
        `,
        beforeLoad: prepareQuake,
        onSaveSync: syncQuakeSavesToSystemFS
    });
    const renderGame = window.appRegistry.quake.renderBody;
    window.appRegistry.quake.renderBody = () => renderGame() + `
        <section class="quake-data-setup" data-quake-setup hidden>
            <h2>Set up Quake</h2>
            <p>Choose pak0.pak from your local Quake or shareware installation to start playing.</p>
            <label>Game data <input type="file" accept=".pak" data-quake-pak></label>
            <p data-quake-status role="status">Game data stays in this device's shared runtime cache and is excluded from Drive backup.</p>
        </section>`;
})();
