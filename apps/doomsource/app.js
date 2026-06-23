(function() {
    let isDoomActive = false;
    let topDockDismissTimer = null;
    window.doomWadBuffer = null;

    let doomInstance = null;
    let doomAudioContext = null;
    let doomMasterGain = null;
    let audioConnectPatched = false;
    let audioConnectOriginal = null;
    let isDownloading = false;

    // ── Save persistence constants ──
    const DOOM_SAVE_DIR = "/Saved Games";
    // PrBoom save slots use prbmsav0.dsg .. prbmsav7.dsg (or boomsav/doomsav variants)
    // We capture whatever filename the G_SaveGame event provides
    let saveEventHandler = null;

    // ── Save persistence helpers ──

    /** Ensure the save directory exists in SystemFS */
    async function ensureSaveDir() {
        try {
            const dir = await window.SystemFS.readFile(DOOM_SAVE_DIR);
            if (!dir) {
                await window.SystemFS.writeFile(DOOM_SAVE_DIR, "Saved Games", "/", null, 0, "directory", true);
            }
        } catch (e) {
            try {
                await window.SystemFS.writeFile(DOOM_SAVE_DIR, "Saved Games", "/", null, 0, "directory", true);
            } catch (err) {
                console.error("PortfoliOS: Could not create DOOM save directory", err);
            }
        }
    }

    /** Migrates old saves from /.doom-saves to /Saved Games */
    async function migrateOldSaves() {
        try {
            const oldItems = await window.SystemFS.readDir("/.doom-saves");
            if (oldItems && oldItems.length > 0) {
                console.log(`PortfoliOS: Found ${oldItems.length} old saves in /.doom-saves. Migrating...`);
                await ensureSaveDir();
                for (const item of oldItems) {
                    if (item.isDirectory) continue;
                    try {
                        const record = await window.SystemFS.readFile(item.path);
                        if (record && record.data) {
                            const newPath = DOOM_SAVE_DIR + "/" + item.name;
                            await window.SystemFS.writeFile(newPath, item.name, DOOM_SAVE_DIR, record.data, record.size, record.type, false);
                            await window.SystemFS.deleteFile(item.path);
                            console.log(`PortfoliOS: Migrated save "${item.name}" to "${DOOM_SAVE_DIR}"`);
                        }
                    } catch (err) {
                        console.error(`PortfoliOS: Failed to migrate save "${item.name}"`, err);
                    }
                }
                try {
                    await window.SystemFS.deleteFile("/.doom-saves");
                    console.log("PortfoliOS: Cleaned up old /.doom-saves folder");
                } catch (e) {}
            }
        } catch (e) {
            // /.doom-saves folder does not exist
        }
    }

    /** Write a single save file to SystemFS */
    async function writeSaveToSystemFS(filename, buffer) {
        try {
            await ensureSaveDir();
            const basename = filename.replace(/^.*[/\\]/, "");
            const path = DOOM_SAVE_DIR + "/" + basename;
            const blob = new Blob([buffer], { type: "application/octet-stream" });
            console.log("PortfoliOS: Starting write of DOOM save to SystemFS:", path);
            await window.SystemFS.writeFile(path, basename, DOOM_SAVE_DIR, blob, blob.size, "application/octet-stream", false);
            console.log("PortfoliOS: DOOM save successfully written →", path, "size:", blob.size);
        } catch (err) {
            console.error("PortfoliOS: Failed to write DOOM save", filename, err);
        }
    }

    /** Read all saves from SystemFS and return them as [{name, data}] */
    async function readSavesFromSystemFS() {
        try {
            const items = await window.SystemFS.readDir(DOOM_SAVE_DIR);
            const saves = [];
            for (const item of items) {
                if (item.isDirectory) continue;
                const record = await window.SystemFS.readFile(item.path);
                if (record && record.data) {
                    let arrayBuffer;
                    if (record.data instanceof Blob) {
                        if (record.data.size > 1024 * 1024) {
                            console.warn("PortfoliOS: Skipping corrupted large save file", item.name, record.data.size);
                            continue;
                        }
                        arrayBuffer = await record.data.arrayBuffer();
                    } else if (record.data instanceof ArrayBuffer) {
                        if (record.data.byteLength > 1024 * 1024) {
                            console.warn("PortfoliOS: Skipping corrupted large save file", item.name, record.data.byteLength);
                            continue;
                        }
                        arrayBuffer = record.data;
                    } else if (record.data.buffer) {
                        if (record.data.byteLength > 1024 * 1024) {
                            console.warn("PortfoliOS: Skipping corrupted large save file", item.name, record.data.byteLength);
                            continue;
                        }
                        arrayBuffer = record.data.buffer;
                    } else {
                        continue;
                    }
                    saves.push({ name: item.name, data: new Uint8Array(arrayBuffer) });
                }
            }
            return saves;
        } catch (e) {
            // Directory may not exist yet — that's fine
            return [];
        }
    }

    /** Restore saved games into the Emscripten FS before the engine boots */
    async function restoreDoomSaves(FS) {
        const saves = await readSavesFromSystemFS();
        if (saves.length === 0) return;
        console.log(`PortfoliOS: Restoring ${saves.length} DOOM save(s)...`);
        for (const save of saves) {
            try {
                // Write to every path PrBoom might look for saves
                const paths = [
                    "/" + save.name,
                    "./" + save.name,
                    "/home/web_user/.local/share/prboom/" + save.name,
                    "/home/web_user/.prboom/" + save.name,
                    "/root/.local/share/prboom/" + save.name,
                    "/root/.prboom/" + save.name,
                ];
                for (const p of paths) {
                    try { FS.writeFile(p, save.data); } catch (e) {}
                }
                console.log("PortfoliOS: Restored save →", save.name);
            } catch (err) {
                console.warn("PortfoliOS: Could not restore save", save.name, err);
            }
        }
    }

    /** Sync all save files from Emscripten FS back to SystemFS (called on close) */
    async function syncAllSavesToSystemFS() {
        if (!doomInstance) return;
        try {
            const FS = doomInstance.FS || window.Module?.FS;
            if (!FS) return;

            // Scan typical save paths for .dsg files
            const searchDirs = [
                "/",
                "/home/web_user",
                "/home/web_user/.local/share/prboom",
                "/home/web_user/.prboom",
                "/root",
                "/root/.local/share/prboom",
                "/root/.prboom"
            ];
            const savedNames = new Set();

            for (const dir of searchDirs) {
                let entries;
                try { entries = FS.readdir(dir); } catch (e) { continue; }
                for (const entry of entries) {
                    if (entry === "." || entry === "..") continue;
                    // PrBoom save files end in .dsg
                    if (!entry.toLowerCase().endsWith(".dsg")) continue;
                    if (savedNames.has(entry)) continue;
                    savedNames.add(entry);
                    try {
                        const data = FS.readFile(dir + "/" + entry);
                        if (data && data.length > 0) {
                            await writeSaveToSystemFS(entry, data);
                        }
                    } catch (e) {
                        console.warn("PortfoliOS: Could not read save file from FS", dir + "/" + entry, e);
                    }
                }
            }
            if (savedNames.size > 0) {
                console.log(`PortfoliOS: Final DOOM save sync complete — ${savedNames.size} file(s).`);
            }
        } catch (err) {
            console.error("PortfoliOS: Final DOOM save sync failed", err);
        }
    }

    /** Start listening for G_SaveGame events from the engine */
    function startSaveListener() {
        if (saveEventHandler) return;
        saveEventHandler = (e) => {
            const { filename, buffer } = e.detail || {};
            console.log("PortfoliOS: G_SaveGame event received for filename:", filename, "size:", buffer ? (buffer.byteLength || buffer.length) : null);
            if (filename && buffer) {
                writeSaveToSystemFS(filename, buffer);
            }
        };
        document.addEventListener("G_SaveGame", saveEventHandler);
    }

    /** Stop listening for G_SaveGame events */
    function stopSaveListener() {
        if (saveEventHandler) {
            document.removeEventListener("G_SaveGame", saveEventHandler);
            saveEventHandler = null;
        }
    }

    // Volume control patching
    function patchAudioConnectForVolume() {
        if (audioConnectPatched || typeof AudioNode === "undefined") return;
        audioConnectOriginal = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function patchedPortfolioAudioConnect(destination, ...args) {
            if (
                doomAudioContext &&
                doomMasterGain &&
                this !== doomMasterGain &&
                this.context === doomAudioContext &&
                destination === doomAudioContext.destination
            ) {
                return audioConnectOriginal.call(this, doomMasterGain, ...args);
            }
            return audioConnectOriginal.call(this, destination, ...args);
        };
        audioConnectPatched = true;
    }

    function setVolume(volumeValue) {
        if (!doomAudioContext) return;
        patchAudioConnectForVolume();
        if (!doomMasterGain) {
            doomMasterGain = doomAudioContext.createGain();
            doomMasterGain.connect(doomAudioContext.destination);
        }
        doomMasterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volumeValue / 100)), doomAudioContext.currentTime);
    }

    function setDoomRuntimeState(label, detail = "") {
        const runtimeState = byId("doom-runtime-state");
        const statusEl = byId("doom-source-loader-status");
        const runtimePanel = byId("doom-runtime-panel");
        if (runtimeState) runtimeState.textContent = label;
        if (statusEl && detail) statusEl.textContent = detail;
        
        if (runtimePanel) {
            runtimePanel.classList.remove("is-dismissed");
            window.clearTimeout(setDoomRuntimeState.dismissTimer);
            if (label === "RUNNING") {
                setDoomRuntimeState.dismissTimer = window.setTimeout(() => {
                    runtimePanel.classList.add("is-dismissed");
                }, 5200);
            }
        }
    }

    function showDoomRuntimeError(message) {
        const loader = byId("doom-source-loader");
        const statusEl = byId("doom-source-loader-status");
        const progressBar = byId("doom-source-progress-bar");
        const runtimePanel = byId("doom-runtime-panel");
        const retryButton = byId("doom-source-retry");
        const canvasEl = byId("canvas");

        runtimePanel?.classList.remove("is-booting", "is-running");
        runtimePanel?.classList.remove("is-dismissed");
        runtimePanel?.classList.add("is-error");
        setDoomRuntimeState("ERROR");
        if (statusEl) statusEl.textContent = message || "DOOM runtime error.";
        if (progressBar) progressBar.style.width = "0%";
        if (retryButton) retryButton.hidden = false;
        if (loader) loader.classList.remove("is-hidden");
        if (canvasEl) canvasEl.style.display = "none";
    }

    async function downloadWadWithProgress(url, statusEl, progressBarEl) {
        statusEl.textContent = "Downloading DOOM.WAD...";
        progressBarEl.style.width = "0%";

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch WAD: ${response.statusText}`);
        }

        const contentLength = response.headers.get("content-length");
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        
        const reader = response.body.getReader();
        const chunks = [];
        let receivedBytes = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            receivedBytes += value.length;

            if (totalBytes > 0) {
                const percent = Math.round((receivedBytes / totalBytes) * 100);
                statusEl.textContent = `Downloading DOOM.WAD (${percent}%)...`;
                progressBarEl.style.width = `${percent}%`;
            } else {
                statusEl.textContent = `Downloading DOOM.WAD (${formatBytes(receivedBytes)})...`;
            }
        }

        const wadBuffer = new Uint8Array(receivedBytes);
        let offset = 0;
        for (const chunk of chunks) {
            wadBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        return wadBuffer;
    }

    async function loadDoomEngine() {
        const canvasEl = byId("canvas");
        const loader = byId("doom-source-loader");
        const statusEl = byId("doom-source-loader-status");
        const progressBar = byId("doom-source-progress-bar");
        const runtimePanel = byId("doom-runtime-panel");
        const retryButton = byId("doom-source-retry");

        if (isDownloading) return;
        isDownloading = true;

        try {
            if (loader) loader.classList.remove("is-hidden");
            if (retryButton) retryButton.hidden = true;
            runtimePanel?.classList.add("is-booting");
            runtimePanel?.classList.remove("is-running", "is-error");
            setDoomRuntimeState("BOOTING", "Preparing browser runtime...");

            // Web Audio context setup
            if (!doomAudioContext) {
                doomAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            setVolume(state.volume || 70);
            if (doomAudioContext.state === "suspended") {
                doomAudioContext.resume().catch((error) => {
                    console.warn("DOOM audio will resume after the browser allows it:", error);
                });
            }

            // 1. Download/Fetch DOOM.WAD (check SystemFS local storage first)
            if (!window.doomWadBuffer) {
                setDoomRuntimeState("CHECK FS", "Checking local storage for DOOM.WAD...");
                let wadRecord = null;
                try {
                    wadRecord = await window.SystemFS.readFile("/.DOOM.WAD");
                } catch (e) {
                    console.warn("Could not read DOOM.WAD from local storage", e);
                }

                if (wadRecord && wadRecord.data) {
                    setDoomRuntimeState("LOAD WAD", "Loading DOOM.WAD from local storage...");
                    const data = wadRecord.data;
                    if (data instanceof Blob) {
                        window.doomWadBuffer = await data.arrayBuffer();
                    } else if (typeof data === "string") {
                        const encoder = new TextEncoder();
                        window.doomWadBuffer = encoder.encode(data);
                    } else {
                        window.doomWadBuffer = data;
                    }
                } else {
                    setDoomRuntimeState("FETCH WAD", "Downloading DOOM.WAD from server...");
                    if (progressBar) progressBar.style.width = "5%";
                    const wadBuffer = await downloadWadWithProgress("DOOM.WAD", statusEl, progressBar);
                    window.doomWadBuffer = wadBuffer;

                    // Save it to SystemFS so subsequent boots are instant (hidden Unix dotfile)
                    try {
                        const blob = new Blob([wadBuffer], { type: "application/octet-stream" });
                        await window.SystemFS.writeFile("/.DOOM.WAD", ".DOOM.WAD", "/", blob, blob.size, "application/octet-stream", false);
                        console.log("PortfoliOS: DOOM.WAD saved to SystemFS as hidden asset.");
                    } catch (err) {
                        console.error("Failed to save DOOM.WAD to SystemFS", err);
                    }
                }
            }

            // 2. Load Emscripten runtime JS wrapper
            if (statusEl) statusEl.textContent = "Loading doom.js wrapper...";
            if (progressBar) progressBar.style.width = "82%";
            
            if (!window.Module) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement("script");
                    script.id = "doom-engine-script";
                    script.src = "doom.js?v=1.0.27";
                    script.onload = () => {
                        if (typeof window.Module !== "function") {
                            reject(new Error("doom.js loaded, but no Module factory found."));
                            return;
                        }
                        resolve();
                    };
                    script.onerror = () => reject(new Error("Failed to load doom.js program wrapper."));
                    document.head.appendChild(script);
                });
            }

            // 3. Initialize module options
            setDoomRuntimeState("EXEC", "Executing doom.wasm...");
            if (progressBar) progressBar.style.width = "96%";

            window.SDL2 = {
                audioContext: doomAudioContext
            };

            // Pre-load saved games from SystemFS so they're ready for the preRun step
            setDoomRuntimeState("SAVES", "Restoring saved games...");
            await migrateOldSaves();
            const pendingSaves = await readSavesFromSystemFS();

            const moduleOpts = {
                preRun: [],
                arguments: ["-iwad", "doom.wad"],
                canvas: canvasEl,
                print: (text) => {
                    if (text) setDoomRuntimeState("RUNNING", text);
                },
                printErr: (text) => {
                    if (text) console.warn(text);
                },
                setStatus: (text) => {
                    if (text && statusEl) statusEl.textContent = text;
                },
                locateFile: (path) => {
                    if (path.endsWith(".wasm")) {
                        return "doom.wasm";
                    }
                    return path;
                },
                SDL2: window.SDL2
            };

            moduleOpts.preRun.push(function () {
                const FS = moduleOpts.FS || window.Module.FS;
                if (!FS) {
                    console.error("Emscripten FS not available at preRun.");
                    return;
                }

                // Hook FS.writeFile to log all write events
                const originalWriteFile = FS.writeFile;
                FS.writeFile = function(path, data, options) {
                    console.log("PortfoliOS Hook: FS.writeFile path:", path, "size:", data ? data.length : 0);
                    return originalWriteFile.call(FS, path, data, options);
                };

                // Hook FS.createDataFile to log data file creation
                const originalCreateDataFile = FS.createDataFile;
                FS.createDataFile = function(parent, name, data, canRead, canWrite, canModify) {
                    console.log("PortfoliOS Hook: FS.createDataFile parent:", parent, "name:", name, "size:", data ? data.length : 0);
                    return originalCreateDataFile.call(FS, parent, name, data, canRead, canWrite, canModify);
                };
                
                function createPath(pathStr) {
                    const parts = pathStr.split('/');
                    let current = '';
                    for (const part of parts) {
                        if (!part) continue;
                        current += '/' + part;
                        try {
                            FS.mkdir(current);
                        } catch (e) {}
                    }
                }

                createPath("/home/web_user/.local/share/prboom");
                createPath("/home/web_user/.prboom");
                createPath("/root/.local/share/prboom");
                createPath("/root/.prboom");

                const cfgData = [
                    "key_up 119",
                    "key_down 115",
                    "key_strafeleft 97",
                    "key_straferight 100",
                    "key_left 37",
                    "key_right 39",
                    "key_fire 113",
                    "key_use 101"
                ].join("\n") + "\n";
                const enc = new TextEncoder();
                const cfgBytes = enc.encode(cfgData);
                const writeCfg = (p) => { try { FS.writeFile(p, cfgBytes); } catch(e){} };
                
                writeCfg("/prboom.cfg");
                writeCfg("/default.cfg");
                writeCfg("/home/web_user/.local/share/prboom/prboom.cfg");
                writeCfg("/home/web_user/.prboom/prboom.cfg");
                writeCfg("/root/.local/share/prboom/prboom.cfg");

                FS.writeFile("./doom1-music.cfg", enc.encode(""));
                FS.writeFile("doom.wad", new Uint8Array(window.doomWadBuffer));

                // Restore saved games into the Emscripten FS
                if (pendingSaves.length > 0) {
                    console.log(`PortfoliOS: Injecting ${pendingSaves.length} DOOM save(s) into Emscripten FS...`);
                    for (const save of pendingSaves) {
                        const paths = [
                            "/" + save.name,
                            "./" + save.name,
                            "/home/web_user/" + save.name,
                            "/home/web_user/.local/share/prboom/" + save.name,
                            "/home/web_user/.prboom/" + save.name,
                            "/root/" + save.name,
                            "/root/.local/share/prboom/" + save.name,
                            "/root/.prboom/" + save.name,
                        ];
                        for (const p of paths) {
                            try {
                                FS.writeFile(p, save.data);
                                console.log("PortfoliOS: Successfully restored save to path:", p, "size:", save.data.byteLength);
                            } catch (e) {
                                console.warn("PortfoliOS: Failed to write save to path:", p, "error:", e.message || e);
                            }
                        }
                        console.log("PortfoliOS: Restored save →", save.name);
                    }
                }
            });

            // Start listening for in-game save events
            startSaveListener();

            const doomModule = window.Module;
            doomInstance = await doomModule(moduleOpts);
            isDoomActive = true;

            if (loader) loader.classList.add("is-hidden");
            if (canvasEl) canvasEl.style.display = "block";
            runtimePanel?.classList.remove("is-booting", "is-error");
            runtimePanel?.classList.add("is-running");
            setDoomRuntimeState("RUNNING", "DOOM is running.");
            
            window.setTimeout(focusDoomCanvas, 150);

        } catch (err) {
            console.error("Error loading DOOM:", err);
            showDoomRuntimeError(err.message || "DOOM failed to launch.");
        } finally {
            isDownloading = false;
        }
    }

    async function cleanupDoomGame() {
        // Pause audio and engine immediately so the game is silent and frozen during save sync
        if (doomAudioContext && doomAudioContext.state === "running") {
            try { doomAudioContext.suspend(); } catch (e) {}
        }
        if (doomInstance && typeof doomInstance.pauseMainLoop === "function") {
            try { doomInstance.pauseMainLoop(); } catch (e) {}
        }

        // Final save sync — capture any remaining save state before destroying the module
        await syncAllSavesToSystemFS();
        stopSaveListener();

        if (doomAudioContext) {
            if (doomAudioContext.state !== "closed") {
                try { doomAudioContext.close(); } catch (e) {}
            }
            doomAudioContext = null;
        }
        document.getElementById("doom-engine-script")?.remove();
        if (audioConnectOriginal) {
            AudioNode.prototype.connect = audioConnectOriginal;
        }
        
        isDoomActive = false;
        doomInstance = null;
        doomMasterGain = null;
        audioConnectPatched = false;
        audioConnectOriginal = null;
        isDownloading = false;

        delete window.Module;
        delete window.SDL2;
    }

    function pauseDoomGame() {
        if (doomInstance && typeof doomInstance.pauseMainLoop === "function") {
            try { doomInstance.pauseMainLoop(); } catch (e) {}
        }
        if (doomAudioContext && doomAudioContext.state === "running") {
            doomAudioContext.suspend().catch((e) => console.warn("Audio suspend failed:", e));
        }
    }

    function resumeDoomGame() {
        if (doomInstance && typeof doomInstance.resumeMainLoop === "function") {
            try { doomInstance.resumeMainLoop(); } catch (e) {}
        }
        if (doomAudioContext && doomAudioContext.state === "suspended") {
            doomAudioContext.resume().catch((e) => console.warn("Audio resume failed:", e));
        }
        focusDoomCanvas();
    }

    function focusDoomCanvas() {
        const canvasEl = byId("canvas");
        if (canvasEl && canvasEl.style.display === "block") {
            canvasEl.focus({ preventScroll: true });
        }
    }

    window.appRegistry.doomsource = {
        title: "doom.exe",
        icon: "doom-icon.png",
        windowClass: "doom-source-window",
        renderBody: () => `
            <div class="doom-source-shell">
                <div class="doom-source-container" id="doom-source-container">
                    <canvas id="canvas" width="640" height="400" tabindex="0" aria-label="DOOM game runtime canvas"></canvas>

                    <div class="doom-source-loader" id="doom-source-loader">
                        <div class="loader-inner">
                            <i class="fa-solid fa-spinner fa-spin loader-icon"></i>
                            <div class="loader-status" id="doom-source-loader-status">Initializing DOOM...</div>
                            <div class="loader-progress">
                                <div class="loader-progress-bar" id="doom-source-progress-bar"></div>
                            </div>
                            <button class="doom-retry-action" type="button" id="doom-source-retry" hidden>
                                <i class="fa-solid fa-rotate"></i>
                                Retry
                            </button>
                        </div>
                    </div>
                    
                    <aside class="doom-runtime-panel" id="doom-runtime-panel">
                        <div><span id="doom-runtime-state">READY</span></div>
                        <small>W/S move, A/D strafe. Left/Right look. Q shoots. E uses.</small>
                    </aside>
                </div>
            </div>
        `,
        onOpen: (windowEl) => {
            if (isDoomActive) {
                resumeDoomGame();
            } else {
                loadDoomEngine();
            }
        },
        onClose: (windowEl) => {
            return cleanupDoomGame();
        },
        onMinimize: (windowEl) => {
            pauseDoomGame();
        },
        onMaximize: (windowEl) => {
            focusDoomCanvas();
        },
        isDoomActive: () => isDoomActive,
        resumeDoomGame: resumeDoomGame,
        pauseDoomGame: pauseDoomGame,
        focusDoomCanvas: focusDoomCanvas,
        loadDoomEngine: loadDoomEngine,
        setVolume: setVolume
    };
})();
