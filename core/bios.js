/**
 * PortfoliOS: Authentic BIOS / UEFI CMOS Setup Utility & System Configuration Engine
 * Provides virtual hardware definitions (WASM RAM limit, WebGPU preference, storage management, boot behavior)
 */
(function() {
    const STORAGE_KEY = "bl4ut0_bios_settings";
    const BIOS_VERSION = "2026.11.02.04";
    const BUILD_DATE = "11/02/2026";

    const DEFAULT_SETTINGS = {
        ramAllocation: 1024,
        preferredGpu: "high-performance",
        wasmThreads: true,
        wasmSimd: true,
        audioSampleRate: 48000,
        bootTarget: "prompt",
        fastBoot: false,
        bootBeep: true,
        quarantineLevel: "strict",
        localAiExecution: "webgpu"
    };

    let activeSettings = { ...DEFAULT_SETTINGS };
    let isInitialized = false;
    let isOpen = false;
    let activeTabId = "main";
    let activeItemIndex = 0;
    let clockInterval = null;
    let storageStats = { used: "Estimating...", quota: "Estimating...", percentage: "0%" };

    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                activeSettings = { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (e) {
            console.warn("PortfoliOS BIOS: Failed to load stored settings, using defaults.", e);
            activeSettings = { ...DEFAULT_SETTINGS };
        }
        isInitialized = true;
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(activeSettings));
            if (window.EventBus) {
                window.EventBus.emit("bios:saved", { ...activeSettings });
            }
        } catch (e) {
            console.error("PortfoliOS BIOS: Failed to save settings to storage.", e);
        }
    }

    function beep(freq = 880, duration = 0.08, type = "square") {
        if (!activeSettings.bootBeep && freq !== 1200 && freq !== 1600 && freq !== 440) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
            setTimeout(() => { try { ctx.close(); } catch (_) {} }, (duration + 0.1) * 1000);
        } catch (_) {}
    }

    async function updateStorageStats() {
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const est = await navigator.storage.estimate();
                const usedMb = ((est.usage || 0) / (1024 * 1024)).toFixed(1);
                const quotaGb = ((est.quota || 0) / (1024 * 1024 * 1024)).toFixed(1);
                const pct = est.quota ? (((est.usage || 0) / est.quota) * 100).toFixed(1) : 0;
                storageStats = {
                    used: `${usedMb} MB`,
                    quota: `${quotaGb} GB`,
                    percentage: `${pct}%`
                };
            } else {
                storageStats = { used: "Available", quota: "Dynamic", percentage: "N/A" };
            }
        } catch (e) {
            storageStats = { used: "Unknown", quota: "Unknown", percentage: "0%" };
        }
        if (isOpen && activeTabId === "storage") {
            renderActiveTab();
        }
    }

    const TABS = [
        { id: "main", label: "Main" },
        { id: "advanced", label: "Advanced" },
        { id: "storage", label: "Storage" },
        { id: "boot", label: "Boot" },
        { id: "security", label: "Security" },
        { id: "exit", label: "Save & Exit" }
    ];

    function getItemsForTab(tabId) {
        if (tabId === "main") {
            const now = new Date();
            const timeStr = now.toTimeString().split(" ")[0];
            const dateStr = now.toLocaleDateString();
            const currentUser = window.state?.currentUserId || localStorage.getItem("bl4ut0CurrentUser") || "bl4ut0";
            return [
                { id: "biosVer", label: "PortfoliOS BIOS Version", value: `v${BIOS_VERSION}`, isInfo: true, help: "Identifies the active PortfoliOS Virtual Computer BIOS architecture release." },
                { id: "buildDate", label: "BIOS Build Date", value: BUILD_DATE, isInfo: true, help: "Official release and security baseline compile date." },
                { id: "cpuModel", label: "Emulated CPU", value: "WASM-64 (SIMD128)", isInfo: true, help: "Virtual CPU capability: 64-bit WebAssembly with hardware 128-bit vector extensions." },
                { id: "hostPlatform", label: "Host Browser Platform", value: String(navigator.platform || "Web Browser").slice(0, 18), isInfo: true, help: "Underlying client operating system and host browser runtime." },
                { id: "systemTime", label: "System Time", value: `[ ${timeStr} ]`, isInfo: true, help: "Virtual system real-time clock (RTC) synchronized with local device time." },
                { id: "systemDate", label: "System Date", value: `[ ${dateStr} ]`, isInfo: true, help: "Virtual system Gregorian calendar clock." },
                { id: "activeProfile", label: "Active Profile", value: `[ ${currentUser} ]`, isInfo: true, help: "Currently authenticated PortfoliOS user account and workspace root." }
            ];
        }

        if (tabId === "advanced") {
            const ramMap = { 512: "512 MB", 1024: "1024 MB (1 GB - Default)", 2048: "2048 MB (2 GB)", 4096: "4096 MB (4 GB - 64-bit)" };
            const gpuMap = { "high-performance": "High Performance (Discrete)", "low-power": "Low Power (Integrated)", "default": "Auto / System Default" };
            return [
                {
                    id: "ramAllocation",
                    label: "Default RAM Allocation",
                    value: `[ ${ramMap[activeSettings.ramAllocation] || "1024 MB"} ]`,
                    options: [512, 1024, 2048, 4096],
                    help: "Configures default maximum WebAssembly linear memory pool for games, creative suites, and heavy compilers (default 1024 MB)."
                },
                {
                    id: "preferredGpu",
                    label: "Preferred GPU Adapter",
                    value: `[ ${gpuMap[activeSettings.preferredGpu] || "High Performance"} ]`,
                    options: ["high-performance", "low-power", "default"],
                    help: "Selects preferred WebGPU / WebGL hardware acceleration profile for 3D viewports, canvas engines, and shaders."
                },
                {
                    id: "wasmThreads",
                    label: "WebAssembly Multi-Threading",
                    value: `[ ${activeSettings.wasmThreads ? "Enabled" : "Disabled"} ]`,
                    options: [true, false],
                    help: "Enables multi-core worker threads in WebAssembly cores where SharedArrayBuffer and crossOriginIsolated are supported."
                },
                {
                    id: "wasmSimd",
                    label: "WASM SIMD Acceleration",
                    value: `[ ${activeSettings.wasmSimd ? "Enabled" : "Disabled"} ]`,
                    options: [true, false],
                    help: "128-bit Single Instruction Multiple Data vector acceleration for emulation, video decoding, and audio synthesis."
                },
                {
                    id: "audioSampleRate",
                    label: "Audio Output Sample Rate",
                    value: `[ ${activeSettings.audioSampleRate === 44100 ? "44.1 kHz" : "48.0 kHz (Default)"} ]`,
                    options: [48000, 44100],
                    help: "AudioContext output hardware sampling rate for media playback and synthesizers."
                }
            ];
        }

        if (tabId === "storage") {
            return [
                { id: "quotaUsed", label: "Browser Storage Used", value: `[ ${storageStats.used} ]`, isInfo: true, help: "Estimated total bytes consumed by PortfoliOS across IndexedDB, CacheStorage, and local databases." },
                { id: "quotaTotal", label: "Storage Quota Available", value: `[ ${storageStats.quota} ]`, isInfo: true, help: "Maximum browser persistent storage quota allocated by host operating system." },
                { id: "quotaPct", label: "Quota Utilization", value: `[ ${storageStats.percentage} ]`, isInfo: true, help: "Percentage of total allocated browser storage currently in use." },
                { id: "systemFsStatus", label: "SystemFS (IndexedDB)", value: "[ Online / Active ]", isInfo: true, help: "Primary persistent virtual file system housing user documents, saves, and app workspaces." },
                { id: "clearWebCache", label: "Clear Browser Web Cache", value: "[ Execute ]", isAction: true, help: "Purges Service Worker cached assets and temporary media chunks to reclaim disk space." },
                { id: "reindexFs", label: "Re-index SystemFS Database", value: "[ Verify ]", isAction: true, help: "Verifies IndexedDB table integrity and re-establishes filesystem references." },
                { id: "resetPrefs", label: "Reset Local Preferences", value: "[ Reset ]", isAction: true, help: "Restores default theme, resolution, wallpaper, and sound volume without deleting user documents." }
            ];
        }

        if (tabId === "boot") {
            const targetMap = { prompt: "Prompt Screen (Default)", desktop: "Direct Desktop", mobile: "Direct Mobile", quick: "Direct Quick" };
            return [
                {
                    id: "bootTarget",
                    label: "Boot Target Experience",
                    value: `[ ${targetMap[activeSettings.bootTarget] || "Prompt Screen"} ]`,
                    options: ["prompt", "desktop", "mobile", "quick"],
                    help: "Sets startup destination: show the classic boot prompt or launch directly into a selected workspace."
                },
                {
                    id: "fastBoot",
                    label: "Fast Boot (Skip Intro)",
                    value: `[ ${activeSettings.fastBoot ? "Enabled" : "Disabled (Default)"} ]`,
                    options: [false, true],
                    help: "Skips typewriter intro animation on the boot console for instantaneous workspace startup."
                },
                {
                    id: "bootBeep",
                    label: "PC Speaker POST Beep",
                    value: `[ ${activeSettings.bootBeep ? "Enabled (Default)" : "Disabled"} ]`,
                    options: [true, false],
                    help: "Plays an authentic 8-bit IBM PC speaker POST beep upon system startup and BIOS exit."
                }
            ];
        }

        if (tabId === "security") {
            const secMap = { strict: "Strict (Quarantine)", permissive: "Permissive" };
            const aiMap = { webgpu: "WebGPU / Local WASM", wasm: "WASM Only", disabled: "Disabled" };
            return [
                {
                    id: "quarantineLevel",
                    label: "SecurityKernel Sandboxing",
                    value: `[ ${secMap[activeSettings.quarantineLevel] || "Strict"} ]`,
                    options: ["strict", "permissive"],
                    help: "Controls SecurityKernel active-document quarantine and script execution boundaries."
                },
                {
                    id: "localAiExecution",
                    label: "Local AI Execution Backend",
                    value: `[ ${aiMap[activeSettings.localAiExecution] || "WebGPU"} ]`,
                    options: ["webgpu", "wasm", "disabled"],
                    help: "Configures hardware execution backend for the on-device Lobe / Survival AI neural engine."
                }
            ];
        }

        if (tabId === "exit") {
            return [
                { id: "saveReboot", label: "Save Changes and Reboot", value: "[ Enter ]", isAction: true, help: "Commits all configured BIOS options to browser storage and reboots PortfoliOS." },
                { id: "discardExit", label: "Discard Changes and Exit", value: "[ Enter ]", isAction: true, help: "Discards any pending configuration modifications and exits BIOS Setup." },
                { id: "loadDefaults", label: "Load Optimized Defaults", value: "[ Enter ]", isAction: true, help: "Restores factory default virtual hardware, WebAssembly RAM (1024 MB), and boot configuration." }
            ];
        }

        return [];
    }

    function ensureDOMElements() {
        if (!document.getElementById("bios-stylesheet")) {
            const link = document.createElement("link");
            link.id = "bios-stylesheet";
            link.rel = "stylesheet";
            link.href = "styles/bios.css";
            document.head.appendChild(link);
        }

        let screen = document.getElementById("bios-screen");
        if (!screen) {
            screen = document.createElement("div");
            screen.id = "bios-screen";
            screen.className = "is-hidden";
            screen.setAttribute("role", "dialog");
            screen.setAttribute("aria-label", "PortfoliOS BIOS Setup Utility");
            screen.innerHTML = `
                <header class="bios-header">
                    <span class="bios-header-title">PortfoliOS BIOS Setup Utility</span>
                    <span class="bios-header-build">Ver. ${BIOS_VERSION} - ${BUILD_DATE}</span>
                </header>
                <nav class="bios-nav-tabs" aria-label="BIOS Setup Screens"></nav>
                <main class="bios-content-area">
                    <section class="bios-options-pane" aria-label="Configuration Options">
                        <div class="bios-pane-header">System Configuration</div>
                        <div class="bios-options-list" role="listbox"></div>
                    </section>
                    <aside class="bios-help-pane" aria-label="Item Specific Help">
                        <div class="bios-pane-header">Item Specific Help</div>
                        <div class="bios-help-content">
                            <div class="bios-help-title">Help Information</div>
                            <div class="bios-help-desc">Select an item on the left using the arrow keys or click to view its description.</div>
                            <div class="bios-help-extra">Use [Enter] or [+]/[-] to modify values.</div>
                        </div>
                    </aside>
                </main>
                <footer class="bios-footer">
                    <div class="bios-legend-row">
                        <span class="bios-legend-item"><span>[←→]</span> Select Screen</span>
                        <span class="bios-legend-item"><span>[↑↓]</span> Select Item</span>
                        <span class="bios-legend-item"><span>[Enter/Space]</span> Select / Action</span>
                        <span class="bios-legend-item"><span>[+/-]</span> Change Value</span>
                        <span class="bios-legend-item"><span>[F9]</span> Setup Defaults</span>
                        <span class="bios-legend-item"><span>[F10]</span> Save &amp; Exit</span>
                        <span class="bios-legend-item"><span>[ESC]</span> Exit</span>
                    </div>
                    <div class="bios-touch-bar" aria-label="Quick Actions">
                        <button type="button" class="bios-touch-btn" data-bios-action="prev-tab">◄ Tab</button>
                        <button type="button" class="bios-touch-btn" data-bios-action="next-tab">Tab ►</button>
                        <button type="button" class="bios-touch-btn" data-bios-action="prev-item">▲ Up</button>
                        <button type="button" class="bios-touch-btn" data-bios-action="next-item">▼ Down</button>
                        <button type="button" class="bios-touch-btn" data-bios-action="cycle-prev">- Val</button>
                        <button type="button" class="bios-touch-btn" data-bios-action="cycle-next">+ Val</button>
                        <button type="button" class="bios-touch-btn" data-bios-action="defaults">F9 Defaults</button>
                        <button type="button" class="bios-touch-btn btn-action-primary" data-bios-action="save">F10 Save</button>
                        <button type="button" class="bios-touch-btn" data-bios-action="exit">ESC Exit</button>
                    </div>
                </footer>
            `;
            document.body.appendChild(screen);

            // Tab clicks
            screen.querySelector(".bios-nav-tabs")?.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-tab-id]");
                if (btn) {
                    activeTabId = btn.dataset.tabId;
                    activeItemIndex = 0;
                    beep(1200, 0.02, "sine");
                    renderActiveTab();
                }
            });

            // Touch bar action clicks
            screen.querySelector(".bios-touch-bar")?.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-bios-action]");
                if (!btn) return;
                const action = btn.dataset.biosAction;
                if (action === "prev-tab") switchTab(-1);
                else if (action === "next-tab") switchTab(1);
                else if (action === "prev-item") navigateItems(-1);
                else if (action === "next-item") navigateItems(1);
                else if (action === "cycle-prev") cycleItemValue(-1);
                else if (action === "cycle-next") cycleItemValue(1);
                else if (action === "defaults") promptLoadDefaults();
                else if (action === "save") promptSaveAndExit();
                else if (action === "exit") promptDiscardAndExit();
            });

            // Options list clicks
            screen.querySelector(".bios-options-list")?.addEventListener("click", (e) => {
                const row = e.target.closest("[data-item-index]");
                if (!row) return;
                const idx = Number(row.dataset.itemIndex);
                if (idx === activeItemIndex) {
                    cycleItemValue(1);
                } else {
                    activeItemIndex = idx;
                    beep(1200, 0.02, "sine");
                    renderActiveTab();
                }
            });
        }
        return screen;
    }

    function renderTabs() {
        const screen = ensureDOMElements();
        const nav = screen.querySelector(".bios-nav-tabs");
        if (!nav) return;
        nav.innerHTML = TABS.map(tab => `
            <button type="button" class="bios-tab-button ${tab.id === activeTabId ? "active" : ""}" data-tab-id="${tab.id}">
                ${tab.label}
            </button>
        `).join("");
    }

    function renderActiveTab() {
        const screen = ensureDOMElements();
        renderTabs();

        const items = getItemsForTab(activeTabId);
        if (activeItemIndex >= items.length) activeItemIndex = Math.max(0, items.length - 1);

        const listEl = screen.querySelector(".bios-options-list");
        if (listEl) {
            listEl.innerHTML = items.map((item, idx) => `
                <div class="bios-option-row ${idx === activeItemIndex ? "active" : ""} ${item.isAction ? "is-action" : ""} ${item.isInfo ? "is-info" : ""}" data-item-index="${idx}" role="option" aria-selected="${idx === activeItemIndex}">
                    <span class="bios-option-label">${idx === activeItemIndex ? "▸ " : "  "}${item.label}</span>
                    <span class="bios-option-value">${item.value}</span>
                </div>
            `).join("");
        }

        const activeItem = items[activeItemIndex];
        const helpTitle = screen.querySelector(".bios-help-title");
        const helpDesc = screen.querySelector(".bios-help-desc");
        const helpExtra = screen.querySelector(".bios-help-extra");

        if (activeItem && helpTitle && helpDesc && helpExtra) {
            helpTitle.textContent = activeItem.label;
            helpDesc.textContent = activeItem.help || "No additional information available for this item.";
            helpExtra.textContent = activeItem.isAction
                ? "Press [Enter] to execute this action."
                : activeItem.isInfo
                    ? "Display-only hardware parameter."
                    : "Press [Enter] or [+]/[-] to change value.";
        }
    }

    function switchTab(direction) {
        const currentIndex = TABS.findIndex(t => t.id === activeTabId);
        let nextIndex = currentIndex + direction;
        if (nextIndex < 0) nextIndex = TABS.length - 1;
        if (nextIndex >= TABS.length) nextIndex = 0;
        activeTabId = TABS[nextIndex].id;
        activeItemIndex = 0;
        beep(1200, 0.02, "sine");
        renderActiveTab();
    }

    function navigateItems(direction) {
        const items = getItemsForTab(activeTabId);
        if (!items.length) return;
        activeItemIndex += direction;
        if (activeItemIndex < 0) activeItemIndex = items.length - 1;
        if (activeItemIndex >= items.length) activeItemIndex = 0;
        beep(1200, 0.02, "sine");
        renderActiveTab();
    }

    function cycleItemValue(direction = 1) {
        const items = getItemsForTab(activeTabId);
        const item = items[activeItemIndex];
        if (!item) return;

        if (item.isAction) {
            executeAction(item.id);
            return;
        }

        if (item.isInfo || !Array.isArray(item.options) || !item.options.length) {
            beep(440, 0.05, "sawtooth");
            return;
        }

        const currentVal = activeSettings[item.id];
        let valIndex = item.options.indexOf(currentVal);
        if (valIndex === -1) valIndex = 0;
        let nextIndex = valIndex + direction;
        if (nextIndex < 0) nextIndex = item.options.length - 1;
        if (nextIndex >= item.options.length) nextIndex = 0;

        activeSettings[item.id] = item.options[nextIndex];
        beep(1600, 0.03, "square");
        renderActiveTab();
    }

    async function executeAction(actionId) {
        if (actionId === "saveReboot") {
            promptSaveAndExit();
        } else if (actionId === "discardExit") {
            promptDiscardAndExit();
        } else if (actionId === "loadDefaults") {
            promptLoadDefaults();
        } else if (actionId === "clearWebCache") {
            beep(1400, 0.05, "sine");
            try {
                if (window.caches) {
                    const keys = await caches.keys();
                    for (const k of keys) {
                        if (!k.includes("portfolio-shell-")) {
                            await caches.delete(k);
                        }
                    }
                }
                showNotice("Cache Purge Complete", "Temporary Web Storage caches cleared successfully.");
                await updateStorageStats();
            } catch (e) {
                showNotice("Cache Error", "Could not clear all cache storage.");
            }
        } else if (actionId === "reindexFs") {
            beep(1400, 0.05, "sine");
            try {
                if (window.SystemFS) {
                    await window.SystemFS.ensureReady();
                }
                showNotice("SystemFS Verified", "IndexedDB file tables verified and active.");
            } catch (e) {
                showNotice("SystemFS Notice", "Database re-index check completed.");
            }
        } else if (actionId === "resetPrefs") {
            beep(1400, 0.05, "sine");
            try {
                if (window.resetThemeColors) window.resetThemeColors();
                showNotice("Preferences Reset", "Theme and interface settings returned to defaults.");
            } catch (e) {
                showNotice("Notice", "Local preferences reset.");
            }
        }
    }

    function showModal(title, prompt, onYes) {
        const screen = ensureDOMElements();
        let modal = screen.querySelector(".bios-modal-overlay");
        if (modal) modal.remove();

        modal = document.createElement("div");
        modal.className = "bios-modal-overlay";
        modal.innerHTML = `
            <div class="bios-modal-box">
                <div class="bios-modal-title">${title}</div>
                <div class="bios-modal-prompt">${prompt}</div>
                <div class="bios-modal-buttons">
                    <button type="button" class="bios-modal-btn active" data-modal-choice="yes">[ Yes ]</button>
                    <button type="button" class="bios-modal-btn" data-modal-choice="no">[ No ]</button>
                </div>
            </div>
        `;
        screen.appendChild(modal);
        beep(880, 0.06, "square");

        let choiceYes = true;
        const updateModalButtons = () => {
            modal.querySelector("[data-modal-choice='yes']")?.classList.toggle("active", choiceYes);
            modal.querySelector("[data-modal-choice='no']")?.classList.toggle("active", !choiceYes);
        };

        const modalKeyHandler = (e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();
                choiceYes = !choiceYes;
                beep(1200, 0.02, "sine");
                updateModalButtons();
            } else if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                cleanup();
                if (choiceYes) onYes?.();
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cleanup();
            }
        };

        const cleanup = () => {
            window.removeEventListener("keydown", modalKeyHandler, true);
            modal.remove();
        };

        window.addEventListener("keydown", modalKeyHandler, true);

        modal.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-modal-choice]");
            if (btn) {
                const isYes = btn.dataset.modalChoice === "yes";
                cleanup();
                if (isYes) onYes?.();
            }
        });
    }

    function showNotice(title, message) {
        showModal(title, message, null);
        const noBtn = document.querySelector(".bios-modal-overlay [data-modal-choice='no']");
        if (noBtn) noBtn.style.display = "none";
        const yesBtn = document.querySelector(".bios-modal-overlay [data-modal-choice='yes']");
        if (yesBtn) yesBtn.textContent = "[ OK ]";
    }

    function promptSaveAndExit() {
        showModal("Save Configuration", "Save configuration changes and reboot now?", () => {
            saveSettings();
            beep(880, 0.12, "square");
            close();
            location.reload();
        });
    }

    function promptDiscardAndExit() {
        showModal("Discard Changes", "Discard configuration changes and exit setup?", () => {
            loadSettings();
            beep(600, 0.08, "square");
            close();
        });
    }

    function promptLoadDefaults() {
        showModal("Load Defaults", "Load Optimized Factory Defaults?", () => {
            activeSettings = { ...DEFAULT_SETTINGS };
            beep(1400, 0.06, "square");
            renderActiveTab();
        });
    }

    function handleKeyDown(e) {
        if (!isOpen) return;

        // If modal open, modalKeyHandler handles it
        if (document.querySelector(".bios-modal-overlay")) return;

        if (e.key === "ArrowLeft") {
            e.preventDefault();
            switchTab(-1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            switchTab(1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            navigateItems(-1);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            navigateItems(1);
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            cycleItemValue(1);
        } else if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            cycleItemValue(1);
        } else if (e.key === "-" || e.key === "_") {
            e.preventDefault();
            cycleItemValue(-1);
        } else if (e.key === "F9") {
            e.preventDefault();
            promptLoadDefaults();
        } else if (e.key === "F10") {
            e.preventDefault();
            promptSaveAndExit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            promptDiscardAndExit();
        }
    }

    function open(options = {}) {
        if (!isInitialized) loadSettings();
        isOpen = true;
        activeTabId = options.tab || "main";
        activeItemIndex = 0;

        const screen = ensureDOMElements();
        screen.classList.remove("is-hidden");
        screen.focus?.();

        beep(880, 0.08, "square");
        updateStorageStats();
        renderActiveTab();

        window.removeEventListener("keydown", handleKeyDown);
        window.addEventListener("keydown", handleKeyDown);

        if (clockInterval) clearInterval(clockInterval);
        clockInterval = setInterval(() => {
            if (isOpen && activeTabId === "main") {
                renderActiveTab();
            }
        }, 1000);
    }

    function close() {
        isOpen = false;
        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }
        window.removeEventListener("keydown", handleKeyDown);
        const screen = document.getElementById("bios-screen");
        if (screen) screen.classList.add("is-hidden");
    }

    loadSettings();

    window.PortfoliOS_BIOS = {
        version: BIOS_VERSION,
        buildDate: BUILD_DATE,
        get: (key) => activeSettings[key] ?? DEFAULT_SETTINGS[key],
        set: (key, val) => { activeSettings[key] = val; },
        getAll: () => ({ ...activeSettings }),
        save: saveSettings,
        resetDefaults: () => { activeSettings = { ...DEFAULT_SETTINGS }; saveSettings(); },
        open,
        close,
        beep,
        getStorageStats: () => ({ ...storageStats }),
        getRamAllocation: () => Number(activeSettings.ramAllocation) || 1024,
        getWasmMemoryLimit: () => (Number(activeSettings.ramAllocation) || 1024) * 1024 * 1024,
        getGpuPreference: () => activeSettings.preferredGpu || "high-performance",
        getAudioSampleRate: () => Number(activeSettings.audioSampleRate) || 48000
    };

    window.getWasmMemoryLimit = () => window.PortfoliOS_BIOS.getWasmMemoryLimit();
    window.openBiosSetup = (tab) => open({ tab });
    window.closeBiosSetup = close;

    // Global shortcut: F9 opens BIOS anywhere in the platform unless typing in an input
    window.addEventListener("keydown", (e) => {
        if (e.key === "F9") {
            const isEditing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
            if (!isEditing && !isOpen) {
                e.preventDefault();
                open();
            }
        }
    });
})();
