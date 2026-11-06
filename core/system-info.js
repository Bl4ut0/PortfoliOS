/**
 * PortfoliOS: System Information Service
 * Read-only storage, profile-usage and host capability reporting shared by
 * File Explorer's This PC view and About This Computer. Every value comes from
 * a browser API or SystemFS record; unsupported values are reported as null so
 * callers can say "Not reported" instead of inventing hardware details.
 */
(function () {
    if (window.SystemInfo) return;

    const KNOWN_FOLDERS = [
        { path: "/Desktop", label: "Desktop", icon: "fa-solid fa-desktop", svgKey: "desktop" },
        { path: "/documents", label: "Documents", icon: "fa-solid fa-file-lines", svgKey: "documents" },
        { path: "/Pictures", label: "Pictures", icon: "fa-solid fa-image", svgKey: "pictures" },
        { path: "/music", label: "Music", icon: "fa-solid fa-music", svgKey: "music" },
        { path: "/Downloads", label: "Downloads", icon: "fa-solid fa-download", svgKey: "downloads" },
        { path: "/ROMs", label: "ROMs", icon: "fa-solid fa-gamepad", svgKey: "roms" },
        { path: "/Saved Games", label: "Saved Games", icon: "fa-solid fa-floppy-disk", svgKey: "saves" }
    ];

    const SVG_ICONS = {
        drive: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/></svg>',
        desktop: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
        documents: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>',
        pictures: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
        music: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
        downloads: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
        roms: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/></svg>',
        saves: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>',
        trash: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
        folder: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>'
    };

    // Minimal module using a v128 instruction (from the wasm-feature-detect suite).
    const WASM_SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

    let devicePromise = null;

    function formatBytes(bytes, { zero = "0 bytes" } = {}) {
        const value = Number(bytes);
        if (!Number.isFinite(value) || value < 0) return "Unknown";
        if (value === 0) return zero;
        const units = ["bytes", "KB", "MB", "GB", "TB"];
        let size = value;
        let unit = 0;
        while (size >= 1024 && unit < units.length - 1) {
            size /= 1024;
            unit++;
        }
        const digits = unit === 0 ? 0 : (size >= 100 ? 0 : size >= 10 ? 1 : 2);
        return `${size.toFixed(digits)} ${units[unit]}`;
    }

    async function getStorageEstimate() {
        const result = { supported: false, usage: null, quota: null, free: null, percent: null, persisted: null, details: null };
        try {
            if (navigator.storage?.estimate) {
                const estimate = await navigator.storage.estimate();
                const usage = Number(estimate.usage) || 0;
                const quota = Number(estimate.quota) || 0;
                result.supported = quota > 0;
                result.usage = usage;
                result.quota = quota || null;
                result.free = quota ? Math.max(0, quota - usage) : null;
                result.percent = quota ? Math.min(100, (usage / quota) * 100) : null;
                // usageDetails is Chromium-only; keep it optional.
                if (estimate.usageDetails && typeof estimate.usageDetails === "object") {
                    result.details = { ...estimate.usageDetails };
                }
            }
        } catch (error) {
            console.warn("SystemInfo: storage estimate unavailable.", error);
        }
        try {
            if (navigator.storage?.persisted) result.persisted = await navigator.storage.persisted();
        } catch (_) {
            result.persisted = null;
        }
        return result;
    }

    async function getProfileUsage() {
        const owner = window.state?.currentUserId;
        const files = await window.SystemFS.getAllFiles();
        window.SystemFS.assertProfile(owner);

        const folders = new Map(KNOWN_FOLDERS.map(folder => [folder.path, { ...folder, exists: false, bytes: 0, files: 0 }]));
        const summary = { owner, totalBytes: 0, fileCount: 0, folderCount: 0, otherBytes: 0, systemBytes: 0, trashBytes: 0, trashCount: 0 };

        for (const record of files) {
            const path = String(record.path || "");
            const top = "/" + (path.split("/")[1] || "");
            if (record.isDirectory) {
                summary.folderCount++;
                if (folders.has(path)) folders.get(path).exists = true;
                continue;
            }
            const size = Number(record.size) || 0;
            summary.totalBytes += size;
            summary.fileCount++;
            if (folders.has(top)) {
                const folder = folders.get(top);
                folder.exists = true;
                folder.bytes += size;
                folder.files++;
            } else if (top === "/Recycle Bin") {
                summary.trashBytes += size;
                summary.trashCount++;
            } else if (top.startsWith("/.") || ["/apps", "/etc", "/home"].includes(top)) {
                summary.systemBytes += size;
            } else {
                summary.otherBytes += size;
            }
        }
        summary.folders = [...folders.values()];
        return summary;
    }

    async function probeWebGpu() {
        if (!navigator.gpu?.requestAdapter) return { available: false, reason: "Not supported by this browser" };
        try {
            const powerPreference = window.PortfoliOS_BIOS?.getGpuPreference?.();
            const options = powerPreference && powerPreference !== "default" ? { powerPreference } : undefined;
            const adapter = await Promise.race([
                navigator.gpu.requestAdapter(options),
                new Promise(resolve => setTimeout(() => resolve(undefined), 2500))
            ]);
            if (adapter === undefined) return { available: false, reason: "Adapter request timed out" };
            if (!adapter) return { available: false, reason: "No compatible adapter" };
            const info = adapter.info || {};
            const description = [info.vendor, info.architecture, info.description].filter(Boolean).join(" · ");
            return { available: true, description: description || "Adapter available" };
        } catch (error) {
            return { available: false, reason: error?.message || "Adapter unavailable" };
        }
    }

    function probeWebGl() {
        const result = { webgl: false, webgl2: false, vendor: null, renderer: null };
        try {
            const canvas = document.createElement("canvas");
            let gl = canvas.getContext("webgl2");
            if (gl) result.webgl2 = true;
            else gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (!gl) return result;
            result.webgl = true;
            const debug = gl.getExtension("WEBGL_debug_renderer_info");
            result.vendor = debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
            result.renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            gl.getExtension("WEBGL_lose_context")?.loseContext();
        } catch (_) {
            // Leave defaults; some privacy modes block canvas contexts.
        }
        return result;
    }

    function describeBrowser() {
        const data = navigator.userAgentData;
        if (data?.brands?.length) {
            const brands = data.brands.filter(brand => !/not.?a.?brand/i.test(brand.brand));
            const preferred = brands.find(brand => !/^chromium$/i.test(brand.brand)) || brands[0];
            if (preferred) return `${preferred.brand} ${preferred.version}`;
        }
        const ua = navigator.userAgent || "";
        const patterns = [
            [/Edg\/([\d.]+)/, "Microsoft Edge"], [/OPR\/([\d.]+)/, "Opera"], [/Firefox\/([\d.]+)/, "Firefox"],
            [/Chrome\/([\d.]+)/, "Chrome"], [/Version\/([\d.]+).*Safari/, "Safari"]
        ];
        for (const [pattern, name] of patterns) {
            const match = ua.match(pattern);
            if (match) return `${name} ${match[1].split(".")[0]}`;
        }
        return null;
    }

    function getStaticInfo() {
        const bios = window.PortfoliOS_BIOS;
        const user = window.getCurrentUser?.() || null;
        const connection = navigator.connection || null;
        let timeZone = null;
        try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (_) {}
        let simd = false;
        try { simd = typeof WebAssembly === "object" && WebAssembly.validate(WASM_SIMD_PROBE); } catch (_) {}
        return {
            os: {
                name: "PortfoliOS",
                release: window.PortfolioLoadingManifest?.release || window.appAssetVersion || null,
                biosVersion: bios?.version || null,
                biosDate: bios?.buildDate || null,
                experience: window.state?.currentView === "mobile" ? "Mobile" : (window.state?.currentView === "quick" ? "Quick" : "Desktop"),
                offlineCache: Boolean(navigator.serviceWorker?.controller)
            },
            profile: {
                id: window.state?.currentUserId || null,
                name: user?.displayName || null,
                type: user?.accountType || null
            },
            processor: {
                logical: Number(navigator.hardwareConcurrency) || null,
                wasm: typeof WebAssembly === "object",
                simd,
                threads: Boolean(window.crossOriginIsolated && typeof SharedArrayBuffer === "function"),
                isolated: Boolean(window.crossOriginIsolated)
            },
            memory: {
                deviceGb: Number(navigator.deviceMemory) || null,
                heapLimit: Number(performance?.memory?.jsHeapSizeLimit) || null,
                wasmAllocationMb: bios?.getRamAllocation?.() || null
            },
            display: {
                width: screen?.width || null,
                height: screen?.height || null,
                scale: window.devicePixelRatio || 1,
                colorDepth: screen?.colorDepth || null
            },
            browser: {
                name: describeBrowser(),
                platform: navigator.userAgentData?.platform || navigator.platform || null,
                language: navigator.language || null,
                timeZone,
                online: navigator.onLine,
                network: connection?.effectiveType || null
            }
        };
    }

    async function getDeviceInfo({ refresh = false } = {}) {
        if (!devicePromise || refresh) {
            devicePromise = probeWebGpu().then(webgpu => ({ graphics: { ...probeWebGl(), webgpu } }));
        }
        const hardware = await devicePromise;
        // Profile, network and display can change during a session; read them fresh.
        return { ...getStaticInfo(), ...hardware };
    }

    window.SystemInfo = {
        knownFolders: KNOWN_FOLDERS.map(folder => ({ ...folder })),
        getIconSvg: (key) => SVG_ICONS[key] || SVG_ICONS.folder,
        formatBytes,
        getStorageEstimate,
        getProfileUsage,
        getDeviceInfo
    };
})();
