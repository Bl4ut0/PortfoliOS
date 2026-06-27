(function() {
    const APP_ID = "romplayer";
    const ROM_ROOT = "/ROMs";
    const RUNTIME_URL = "apps/romplayer/runtime.html";
    const ARCHIVE_EXTENSIONS = ["zip"];

    let selectedSystemId = "nes";
    let currentItems = [];
    let runtimeMessageHandler = null;
    let unsubscribeFs = null;
    let unregisterAudio = null;

    const SYSTEMS = [
        {
            id: "nes",
            label: "NES",
            folder: "NES",
            core: "nes",
            icon: "fa-solid fa-gamepad",
            color: "#22d3ee",
            extensions: ["nes", "fds", "unif", "unf"]
        },
        {
            id: "snes",
            label: "SNES",
            folder: "SNES",
            core: "snes",
            icon: "fa-solid fa-dice-d6",
            color: "#a78bfa",
            extensions: ["smc", "sfc", "swc", "fig", "bs", "st"]
        },
        {
            id: "gb",
            label: "Game Boy",
            folder: "Game Boy",
            core: "gb",
            icon: "fa-solid fa-mobile-screen",
            color: "#34d399",
            extensions: ["gb", "gbc", "dmg"]
        },
        {
            id: "gba",
            label: "Game Boy Advance",
            folder: "Game Boy Advance",
            core: "gba",
            icon: "fa-solid fa-mobile-screen-button",
            color: "#14b8a6",
            extensions: ["gba"]
        },
        {
            id: "segaMD",
            label: "Sega Genesis",
            folder: "Sega Genesis",
            core: "segaMD",
            icon: "fa-solid fa-bolt",
            color: "#3b82f6",
            extensions: ["md", "smd", "gen", "bin", "68k", "sgd"]
        },
        {
            id: "segaMS",
            label: "Master System",
            folder: "Sega Master System",
            core: "segaMS",
            icon: "fa-solid fa-chess-board",
            color: "#60a5fa",
            extensions: ["sms", "sg"]
        },
        {
            id: "segaGG",
            label: "Game Gear",
            folder: "Sega Game Gear",
            core: "segaGG",
            icon: "fa-solid fa-tablet-screen-button",
            color: "#2dd4bf",
            extensions: ["gg"]
        },
        {
            id: "sega32x",
            label: "Sega 32X",
            folder: "Sega 32X",
            core: "sega32x",
            icon: "fa-solid fa-circle-nodes",
            color: "#f43f5e",
            extensions: ["32x"]
        },
        {
            id: "atari2600",
            label: "Atari 2600",
            folder: "Atari 2600",
            core: "atari2600",
            icon: "fa-solid fa-gamepad",
            color: "#f59e0b",
            extensions: ["a26", "bin"]
        },
        {
            id: "atari7800",
            label: "Atari 7800",
            folder: "Atari 7800",
            core: "atari7800",
            icon: "fa-solid fa-gamepad",
            color: "#f97316",
            extensions: ["a78", "bin"]
        },
        {
            id: "lynx",
            label: "Atari Lynx",
            folder: "Atari Lynx",
            core: "lynx",
            icon: "fa-solid fa-tablet",
            color: "#eab308",
            extensions: ["lnx"]
        },
        {
            id: "coleco",
            label: "ColecoVision",
            folder: "ColecoVision",
            core: "coleco",
            icon: "fa-solid fa-square",
            color: "#38bdf8",
            extensions: ["col", "cv", "rom", "bin"]
        },
        {
            id: "pce",
            label: "PC Engine",
            folder: "PC Engine",
            core: "pce",
            icon: "fa-solid fa-compact-disc",
            color: "#fb7185",
            extensions: ["pce"]
        },
        {
            id: "ngp",
            label: "Neo Geo Pocket",
            folder: "Neo Geo Pocket",
            core: "ngp",
            icon: "fa-solid fa-circle-dot",
            color: "#4ade80",
            extensions: ["ngp", "ngc"]
        },
        {
            id: "ws",
            label: "WonderSwan",
            folder: "WonderSwan",
            core: "ws",
            icon: "fa-solid fa-table-cells",
            color: "#c084fc",
            extensions: ["ws", "wsc", "pc2"]
        },
        {
            id: "vb",
            label: "Virtual Boy",
            folder: "Virtual Boy",
            core: "vb",
            icon: "fa-solid fa-vr-cardboard",
            color: "#ef4444",
            extensions: ["vb", "vboy", "bin"]
        }
    ];

    function escapeHtml(value) {
        return window.escapeHtml
            ? window.escapeHtml(value)
            : String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
    }

    function sanitizeName(name) {
        return String(name || "")
            .replace(/[\\/:*?"<>|]/g, "-")
            .replace(/[\u0000-\u001f]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function getSystem(systemId = selectedSystemId) {
        return SYSTEMS.find((system) => system.id === systemId) || SYSTEMS[0];
    }

    function getSystemPath(system = getSystem()) {
        return `${ROM_ROOT}/${system.folder}`;
    }

    function getExtension(name) {
        const cleanName = String(name || "").toLowerCase();
        const index = cleanName.lastIndexOf(".");
        return index >= 0 ? cleanName.slice(index + 1) : "";
    }

    function isCompatibleFile(system, fileName) {
        const extension = getExtension(fileName);
        return system.extensions.includes(extension) || ARCHIVE_EXTENSIONS.includes(extension);
    }

    function formatBytes(value) {
        const bytes = Number(value || 0);
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }

    function getAcceptedExtensions(system = getSystem()) {
        return [...system.extensions, ...ARCHIVE_EXTENSIONS]
            .map((extension) => `.${extension}`)
            .join(",");
    }

    async function ensureRomDirectories() {
        if (!window.SystemFS) return;
        await window.SystemFS.ensureDirectory(ROM_ROOT, {
            silent: true,
            metadata: { sync: false, kind: "rom-root" }
        });

        for (const system of SYSTEMS) {
            await window.SystemFS.ensureDirectory(getSystemPath(system), {
                silent: true,
                metadata: { sync: false, kind: "rom-system", system: system.id }
            });
        }
    }

    async function countSystemRoms(system) {
        try {
            const items = await window.SystemFS.readDir(getSystemPath(system));
            return items.filter((item) => !item.isDirectory && isCompatibleFile(system, item.name)).length;
        } catch (error) {
            return 0;
        }
    }

    async function readSelectedRoms() {
        const system = getSystem();
        const path = getSystemPath(system);
        const items = await window.SystemFS.readDir(path);
        return items
            .filter((item) => !item.isDirectory && isCompatibleFile(system, item.name))
            .map((item) => ({ ...item, systemId: system.id }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }

    async function renderSystems(windowEl) {
        const list = windowEl.querySelector(".romplayer-systems");
        if (!list) return;

        const rows = await Promise.all(SYSTEMS.map(async (system) => {
            const count = await countSystemRoms(system);
            return `
                <button class="romplayer-system ${system.id === selectedSystemId ? "active" : ""}"
                    type="button"
                    data-system-id="${escapeHtml(system.id)}"
                    style="--system-color:${escapeHtml(system.color)}"
                    title="${escapeHtml(getSystemPath(system))}">
                    <i class="${escapeHtml(system.icon)}"></i>
                    <span>${escapeHtml(system.label)}</span>
                    <b>${count}</b>
                </button>
            `;
        }));

        list.innerHTML = rows.join("");
    }

    function renderLibrary(windowEl) {
        const system = getSystem();
        const grid = windowEl.querySelector(".romplayer-library-grid");
        const title = windowEl.querySelector(".romplayer-current-system");
        const path = windowEl.querySelector(".romplayer-current-path");
        const input = windowEl.querySelector(".romplayer-file-input");
        const extList = windowEl.querySelector(".romplayer-extension-list");

        if (title) title.textContent = system.label;
        if (path) path.textContent = getSystemPath(system);
        if (input) input.accept = getAcceptedExtensions(system);
        if (extList) extList.textContent = [...system.extensions, ...ARCHIVE_EXTENSIONS].map((ext) => `.${ext}`).join(" ");
        if (!grid) return;

        if (!currentItems.length) {
            grid.innerHTML = `
                <div class="romplayer-empty">
                    <i class="${escapeHtml(system.icon)}"></i>
                    <span>No compatible files in ${escapeHtml(getSystemPath(system))}</span>
                </div>
            `;
            return;
        }

        grid.innerHTML = currentItems.map((item) => {
            const safeName = escapeHtml(item.name);
            const safePath = escapeHtml(item.path);
            return `
                <article class="romplayer-rom" title="${safeName}">
                    <div class="romplayer-rom-icon" style="--system-color:${escapeHtml(system.color)}">
                        <i class="${escapeHtml(system.icon)}"></i>
                    </div>
                    <div class="romplayer-rom-body">
                        <h4>${safeName}</h4>
                        <span>${escapeHtml(system.label)} - ${escapeHtml(formatBytes(item.size))}</span>
                    </div>
                    <button class="romplayer-play" type="button" data-rom-path="${safePath}" title="Play ${safeName}">
                        <i class="fa-solid fa-play"></i>
                    </button>
                </article>
            `;
        }).join("");
    }

    async function render(windowEl) {
        if (!windowEl || !window.SystemFS) return;

        const grid = windowEl.querySelector(".romplayer-library-grid");
        if (grid) {
            grid.innerHTML = `
                <div class="romplayer-empty">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Scanning ${escapeHtml(getSystemPath())}</span>
                </div>
            `;
        }

        try {
            await ensureRomDirectories();
            currentItems = await readSelectedRoms();
            await renderSystems(windowEl);
            renderLibrary(windowEl);
        } catch (error) {
            console.error("PortfoliOS: ROM Player render failed", error);
            if (grid) {
                grid.innerHTML = `
                    <div class="romplayer-empty is-error">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>ROM library unavailable</span>
                    </div>
                `;
            }
        }
    }

    function setRuntimeState(windowEl, label, detail = "") {
        const stateEl = windowEl?.querySelector(".romplayer-runtime-state");
        const detailEl = windowEl?.querySelector(".romplayer-runtime-detail");
        if (stateEl) stateEl.textContent = label;
        if (detailEl) detailEl.textContent = detail;
    }

    async function toBlob(data, type) {
        if (data instanceof Blob) return data;
        if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
            return new Blob([data], { type: type || "application/octet-stream" });
        }
        if (typeof data === "string") {
            return new Blob([data], { type: type || "application/octet-stream" });
        }
        if (data && data.buffer instanceof ArrayBuffer) {
            return new Blob([data.buffer], { type: type || "application/octet-stream" });
        }
        return new Blob([data || ""], { type: type || "application/octet-stream" });
    }

    async function launchRecord(windowEl, record) {
        const system = getSystem(record.metadata?.system || record.systemId || selectedSystemId);
        const iframe = windowEl.querySelector(".romplayer-frame");
        if (!iframe) return;

        const romBlob = await toBlob(record.data, record.type);
        const payload = {
            core: system.core,
            systemId: system.id,
            systemLabel: system.label,
            name: record.name,
            path: record.path,
            rom: romBlob,
            volume: (window.PortfolioOSAppFramework?.getDesktopVolume?.() ?? 70) / 100
        };

        setRuntimeState(windowEl, "LOADING", `${system.label}: ${record.name}`);
        
        // Auto-collapse sidebar on game launch for full window view
        const shell = windowEl.querySelector(".romplayer-shell");
        if (shell) {
            shell.classList.add("is-collapsed");
            const btn = windowEl.querySelector("[data-rom-action='toggle-collapse']");
            if (btn) {
                btn.title = "Expand sidebar & ROM list (show library)";
            }
        }

        iframe.classList.add("is-loading");
        iframe.onload = () => {
            iframe.classList.remove("is-loading");
            window.postMessageToIframe?.(iframe, {
                source: "romplayer",
                type: "launch",
                payload
            });
        };
        iframe.src = `${RUNTIME_URL}?v=${Date.now()}`;
    }

    async function launchPath(windowEl, path) {
        try {
            const record = await window.SystemFS.readFile(path);
            if (!record || record.isDirectory) return;
            await launchRecord(windowEl, record);
        } catch (error) {
            console.error("PortfoliOS: Failed to launch ROM", error);
            setRuntimeState(windowEl, "ERROR", "Could not load selected file.");
        }
    }

    function stopRuntime(windowEl) {
        const iframe = windowEl.querySelector(".romplayer-frame");
        if (iframe) {
            iframe.onload = null;
            iframe.src = "about:blank";
        }
        setRuntimeState(windowEl, "IDLE", "No game running.");
        
        // Auto-expand sidebar when emulator stops
        const shell = windowEl.querySelector(".romplayer-shell");
        if (shell) {
            shell.classList.remove("is-collapsed");
            const btn = windowEl.querySelector("[data-rom-action='toggle-collapse']");
            if (btn) {
                btn.title = "Collapse sidebar & ROM list (full window view)";
            }
        }
    }

    async function importFiles(windowEl, files) {
        const system = getSystem();
        const targetPath = getSystemPath(system);
        const imported = [];
        const skipped = [];

        for (const file of Array.from(files || [])) {
            const cleanName = sanitizeName(file.name);
            if (!cleanName || !isCompatibleFile(system, cleanName)) {
                skipped.push(file.name);
                continue;
            }

            const path = `${targetPath}/${cleanName}`;
            const record = await window.SystemFS.writeFile(
                path,
                cleanName,
                targetPath,
                file,
                file.size,
                file.type || "application/octet-stream",
                false,
                {
                    metadata: {
                        app: APP_ID,
                        kind: "rom",
                        sync: false,
                        system: system.id
                    }
                }
            );
            imported.push(record);
        }

        await render(windowEl);

        if (imported.length === 1) {
            await launchRecord(windowEl, imported[0]);
        }

        if (imported.length && window.showDesktopToast) {
            window.showDesktopToast(`Imported ${imported.length} ROM file(s) to ${targetPath}.`);
        }
        if (skipped.length && window.showDesktopToast) {
            window.showDesktopToast(`Skipped ${skipped.length} incompatible file(s).`);
        }
    }

    function setupDragAndDrop(windowEl) {
        const dropZone = windowEl.querySelector(".romplayer-dropzone");
        if (!dropZone) return;

        ["dragenter", "dragover"].forEach((eventName) => {
            dropZone.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopPropagation();
                dropZone.classList.add("is-dragging");
            });
        });

        ["dragleave", "drop"].forEach((eventName) => {
            dropZone.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopPropagation();
                dropZone.classList.remove("is-dragging");
            });
        });

        dropZone.addEventListener("drop", (event) => {
            const files = event.dataTransfer?.files;
            if (files?.length) {
                importFiles(windowEl, files);
            }
        });
    }

    function handleRuntimeMessage(event) {
        if (event.origin !== window.location.origin) return;
        const data = event.data || {};
        if (data.source !== "romplayer-runtime") return;

        const windowEl = document.querySelector('[data-window="romplayer"]');
        if (!windowEl) return;

        if (data.type === "ready") {
            setRuntimeState(windowEl, "READY", data.detail || "Emulator runtime ready.");
        } else if (data.type === "started") {
            setRuntimeState(windowEl, "RUNNING", data.detail || "Game started.");
        } else if (data.type === "error") {
            setRuntimeState(windowEl, "ERROR", data.detail || "Runtime error.");
        }
    }

    window.appRegistry[APP_ID] = {
        title: "ROM Player",
        icon: "fa-solid fa-gamepad",
        windowClass: "romplayer-window game-window",
        renderBody: () => `
            <div class="romplayer-shell">
                <header class="romplayer-toolbar">
                    <div class="romplayer-title">
                        <i class="fa-solid fa-gamepad"></i>
                        <span>ROM Player</span>
                    </div>
                    <div class="romplayer-path">
                        <i class="fa-solid fa-folder-tree"></i>
                        <span class="romplayer-current-path">${escapeHtml(getSystemPath())}</span>
                    </div>
                    <div class="romplayer-actions">
                        <button class="romplayer-icon-button" type="button" data-rom-action="open-files" title="Open File Explorer">
                            <i class="fa-solid fa-folder-open"></i>
                        </button>
                        <button class="romplayer-icon-button" type="button" data-rom-action="refresh" title="Refresh library">
                            <i class="fa-solid fa-rotate"></i>
                        </button>
                        <button class="romplayer-icon-button" type="button" data-rom-action="upload" title="Import to selected system">
                            <i class="fa-solid fa-file-arrow-up"></i>
                        </button>
                        <button class="romplayer-icon-button romplayer-btn-collapse" type="button" data-rom-action="toggle-collapse" title="Collapse sidebar & ROM list (full window view)">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <button class="romplayer-icon-button" type="button" data-rom-action="stop" title="Stop emulator">
                            <i class="fa-solid fa-stop"></i>
                        </button>
                        <input class="romplayer-file-input" type="file" multiple hidden>
                    </div>
                </header>
                <div class="romplayer-body">
                    <aside class="romplayer-sidebar">
                        <div class="romplayer-sidebar-heading">Systems</div>
                        <div class="romplayer-systems"></div>
                    </aside>
                    <main class="romplayer-dropzone">
                        <div class="romplayer-library-header">
                            <div>
                                <h3 class="romplayer-current-system">${escapeHtml(getSystem().label)}</h3>
                                <span class="romplayer-extension-list"></span>
                            </div>
                        </div>
                        <div class="romplayer-library-grid"></div>
                    </main>
                    <aside class="romplayer-stage">
                        <iframe class="romplayer-frame" title="EmulatorJS runtime" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-downloads"></iframe>
                        <div class="romplayer-runtime-panel">
                            <span class="romplayer-runtime-state">IDLE</span>
                            <b class="romplayer-runtime-detail">No game running.</b>
                        </div>
                    </aside>
                </div>
            </div>
        `,
        onOpen: async (windowEl) => {
            if (!runtimeMessageHandler) {
                runtimeMessageHandler = handleRuntimeMessage;
                window.addEventListener("message", runtimeMessageHandler);
            }

            if (!unregisterAudio && window.registerAppAudioAdapter) {
                unregisterAudio = window.registerAppAudioAdapter(APP_ID, {
                    setVolume(volume) {
                        const iframe = document.querySelector('[data-window="romplayer"] .romplayer-frame');
                        window.postMessageToIframe?.(iframe, {
                            source: "romplayer",
                            type: "volume",
                            value: Math.max(0, Math.min(1, volume / 100))
                        });
                    }
                });
            }

            if (windowEl.dataset.romplayerInitialized !== "1") {
                windowEl.dataset.romplayerInitialized = "1";
                setupDragAndDrop(windowEl);

                windowEl.addEventListener("click", (event) => {
                    const systemButton = event.target.closest("[data-system-id]");
                    if (systemButton) {
                        selectedSystemId = systemButton.dataset.systemId;
                        render(windowEl);
                        return;
                    }

                    const playButton = event.target.closest("[data-rom-path]");
                    if (playButton) {
                        launchPath(windowEl, playButton.dataset.romPath);
                        return;
                    }

                    const actionButton = event.target.closest("[data-rom-action]");
                    if (!actionButton) return;

                    const action = actionButton.dataset.romAction;
                    if (action === "upload") {
                        windowEl.querySelector(".romplayer-file-input")?.click();
                    } else if (action === "refresh") {
                        render(windowEl);
                    } else if (action === "toggle-collapse") {
                        const shell = windowEl.querySelector(".romplayer-shell");
                        if (shell) {
                            const isCollapsed = shell.classList.toggle("is-collapsed");
                            const btn = windowEl.querySelector("[data-rom-action='toggle-collapse']");
                            if (btn) {
                                btn.title = isCollapsed 
                                    ? "Expand sidebar & ROM list (show library)" 
                                    : "Collapse sidebar & ROM list (full window view)";
                            }
                        }
                    } else if (action === "stop") {
                        stopRuntime(windowEl);
                    } else if (action === "open-files" && window.openDesktopWindow) {
                        window.openDesktopWindow("files");
                    }
                });

                const input = windowEl.querySelector(".romplayer-file-input");
                if (input) {
                    input.addEventListener("change", async () => {
                        if (input.files?.length) {
                            await importFiles(windowEl, input.files);
                        }
                        input.value = "";
                    });
                }
            }

            if (window.EventBus && !unsubscribeFs) {
                unsubscribeFs = window.EventBus.on("fs:changed", (event) => {
                    const changedPath = event?.path || event?.parent || "";
                    if (!changedPath || changedPath === ROM_ROOT || changedPath.startsWith(`${ROM_ROOT}/`) || event?.action === "sync") {
                        render(windowEl);
                    }
                });
            }

            await render(windowEl);
        },
        onClose: (windowEl) => {
            stopRuntime(windowEl);
            if (runtimeMessageHandler) {
                window.removeEventListener("message", runtimeMessageHandler);
                runtimeMessageHandler = null;
            }
            if (unsubscribeFs) {
                unsubscribeFs();
                unsubscribeFs = null;
            }
            if (unregisterAudio) {
                unregisterAudio();
                unregisterAudio = null;
            }
            if (windowEl) windowEl.dataset.romplayerInitialized = "";
        }
    };
})();
