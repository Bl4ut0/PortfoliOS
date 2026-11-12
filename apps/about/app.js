/**
 * PortfoliOS: About This Computer (Core System Application)
 * Displays Windows-style system specifications, storage allocation/usage breakdown,
 * BIOS configuration summary, and active workspace profile details.
 */
(function () {
    const APP_ID = "about";
    let renderGeneration = 0;
    let unsubscribers = [];
    let latestCopyReport = "";

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatSize(bytes, options) {
        if (window.SystemInfo?.formatBytes) {
            return window.SystemInfo.formatBytes(bytes, options);
        }
        if (!Number.isFinite(bytes) || bytes < 0) return "Unknown";
        if (bytes === 0) return options?.zero || "0 bytes";
        if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${bytes} bytes`;
    }

    function getGpuPrefLabel(pref) {
        if (pref === "high-performance") return "High Performance";
        if (pref === "low-power") return "Power Saving";
        return "System Default";
    }

    function buildSpecsText(device, estimate, profile) {
        const lines = [
            "PortfoliOS — System & Storage Specifications",
            "============================================",
            `OS Edition: PortfoliOS (${device.os.experience || "Desktop"})`,
            `Release Build: ${device.os.release ? `v${device.os.release}` : "Unknown"}`,
            `BIOS Version: ${device.os.biosVersion ? `v${device.os.biosVersion}` : "Unknown"}${device.os.biosDate ? ` (${device.os.biosDate})` : ""}`,
            `Active Profile: ${device.profile.name || device.profile.id || "Guest"} (${device.profile.type || "Standard session"})`,
            "",
            "Storage (Workspace)",
            "-----------------------",
            estimate.supported
                ? `Allocated Capacity: ${formatSize(estimate.quota)}`
                : "Allocated Capacity: Managed dynamically by browser",
            estimate.supported
                ? `Used Space: ${formatSize(estimate.usage)} (${(estimate.percent || 0).toFixed(1)}%)`
                : `Workspace Usage: ${formatSize(profile.totalBytes)}`,
            estimate.supported
                ? `Available Space: ${formatSize(estimate.free)}`
                : "Available Space: Dynamic",
            `Profile Files (SystemFS): ${formatSize(profile.totalBytes)} across ${profile.fileCount} file(s) in ${profile.folderCount} folder(s)`,
            `Persistence Policy: ${estimate.persisted === true ? "Persistent storage granted" : (estimate.persisted === false ? "Best-effort browser quota" : "Not reported")}`,
            "",
            "Device & Runtime",
            "----------------",
            `Logical Processors: ${device.processor.logical ? `${device.processor.logical} logical cores` : "Not reported"}`,
            `WebAssembly Runtime: ${device.processor.wasm ? "64-bit WASM" : "Unavailable"} | SIMD128: ${device.processor.simd ? "Supported" : "No"} | Threads: ${device.processor.threads ? "Enabled" : "Unavailable"}`,
            `WASM Memory Pool: ${device.memory.wasmAllocationMb ? `${device.memory.wasmAllocationMb} MB (BIOS)` : "Default"}${device.memory.deviceGb ? ` | Host RAM Class: ~${device.memory.deviceGb} GB` : ""}`,
            `Graphics (WebGL): ${device.graphics?.renderer || (device.graphics?.webgl2 ? "WebGL 2.0" : (device.graphics?.webgl ? "WebGL 1.0" : "Unavailable"))}`,
            `Graphics (WebGPU): ${device.graphics?.webgpu?.available ? device.graphics.webgpu.description : (device.graphics?.webgpu?.reason || "Unavailable")}`,
            `Display: ${device.display.width && device.display.height ? `${device.display.width} x ${device.display.height} (${device.display.scale}x scale)` : "Not reported"}`,
            `Host Browser: ${device.browser.name || "Web Browser"}${device.browser.platform ? ` on ${device.browser.platform}` : ""}`
        ];
        return lines.join("\n");
    }

    async function renderAboutContent(windowEl, { refreshHardware = false } = {}) {
        const generation = ++renderGeneration;
        const bodyEl = windowEl.querySelector("[data-about-content]");
        if (!bodyEl) return;

        const owner = window.state?.currentUserId;
        try {
            if (!window.SystemInfo) {
                bodyEl.innerHTML = `<div class="about-empty">System Information service is unavailable.</div>`;
                return;
            }

            const [device, estimate, profile] = await Promise.all([
                window.SystemInfo.getDeviceInfo({ refresh: refreshHardware }),
                window.SystemInfo.getStorageEstimate(),
                window.SystemInfo.getProfileUsage()
            ]);

            if (!windowEl.isConnected || generation !== renderGeneration || owner !== window.state?.currentUserId) {
                return;
            }

            latestCopyReport = buildSpecsText(device, estimate, profile);

            const pct = estimate.supported ? Math.min(100, Math.max(0, estimate.percent || 0)) : 0;
            const barStateClass = pct >= 90 ? "is-critical" : (pct >= 75 ? "is-warning" : "");
            const usedDisplay = estimate.supported ? formatSize(estimate.usage, { zero: "0 MB" }) : formatSize(profile.totalBytes, { zero: "0 MB" });
            const freeDisplay = estimate.supported ? formatSize(estimate.free, { zero: "0 MB" }) : "Dynamic";
            const quotaDisplay = estimate.supported ? formatSize(estimate.quota) : "Browser Managed";
            const nonProfileBytes = estimate.supported ? Math.max(0, (estimate.usage || 0) - profile.totalBytes) : null;

            const persistenceBadge = estimate.persisted === true
                ? `<span class="about-pill is-good"><i class="fa-solid fa-shield-check fa-check"></i> Persistent Storage</span>`
                : `<span class="about-pill"><i class="fa-solid fa-database"></i> Browser-Managed Quota</span>`;

            const gpuPref = getGpuPrefLabel(window.PortfoliOS_BIOS?.getGpuPreference?.());
            const webglSummary = device.graphics?.renderer
                ? `${device.graphics.renderer}`
                : (device.graphics?.webgl2 ? "WebGL 2.0 Hardware Context" : (device.graphics?.webgl ? "WebGL 1.0 Context" : "Not available"));
            const webgpuSummary = device.graphics?.webgpu?.available
                ? `Available (${device.graphics.webgpu.description})`
                : (device.graphics?.webgpu?.reason || "Not supported");

            const cpuSummary = device.processor.logical
                ? `${device.processor.logical} Logical Processors · WASM-64${device.processor.simd ? " + SIMD128" : ""}`
                : `WASM-64 Virtual Processor${device.processor.simd ? " (SIMD128)" : ""}`;

            const ramSummary = [
                device.memory.wasmAllocationMb ? `${device.memory.wasmAllocationMb} MB WASM Pool (BIOS)` : null,
                device.memory.deviceGb ? `~${device.memory.deviceGb} GB Host Class` : null,
                device.memory.heapLimit ? `${formatSize(device.memory.heapLimit)} JS Heap Limit` : null
            ].filter(Boolean).join(" · ") || "Managed by browser";

            const displaySummary = device.display.width && device.display.height
                ? `${device.display.width} × ${device.display.height} (${Number(device.display.scale || 1).toFixed(2).replace(/\.00$/, "")}x scale${device.display.colorDepth ? `, ${device.display.colorDepth}-bit` : ""})`
                : "Not reported";

            const folderRowsHtml = profile.folders.map((folder) => `
                <button type="button" class="about-folder-chip" data-about-open-path="${escapeHtml(folder.path)}" title="Open ${escapeHtml(folder.label)} in File Explorer">
                    <span class="about-folder-chip-icon">${window.SystemInfo?.getIconSvg?.(folder.svgKey) || `<i class="${escapeHtml(folder.icon)}" aria-hidden="true"></i>`}</span>
                    <span class="about-folder-chip-text">
                        <strong>${escapeHtml(folder.label)}</strong>
                        <span>${folder.files === 1 ? "1 file" : `${folder.files} files`} · ${escapeHtml(formatSize(folder.bytes, { zero: "0 B" }))}</span>
                    </span>
                </button>
            `).join("");

            bodyEl.innerHTML = `
                <section class="about-hero-card" aria-label="System identity">
                    <div class="about-hero-brand">
                        <div class="about-brand-tile" aria-hidden="true">
                            <span class="about-mark-chevron">&gt;</span><span class="about-mark-cursor">_</span>
                        </div>
                        <div class="about-hero-titles">
                            <h2>PortfoliOS Virtual Workstation</h2>
                            <p>${escapeHtml(device.profile.name || "Guest Access")} · ${escapeHtml(device.profile.type || "Workspace session")} · Build ${escapeHtml(device.os.release ? `v${device.os.release}` : "Current")}</p>
                        </div>
                    </div>
                    <div class="about-hero-actions">
                        <button type="button" class="about-btn" data-about-action="copy-specs" title="Copy specifications to clipboard">
                            <i class="fa-regular fa-copy" aria-hidden="true"></i> Copy specs
                        </button>
                        <button type="button" class="about-btn" data-about-action="open-storage" title="Open This PC in File Explorer">
                            <i class="fa-solid fa-hard-drive" aria-hidden="true"></i> Open This PC
                        </button>
                        <button type="button" class="about-btn" data-about-action="open-bios" title="Open PortfoliOS BIOS Setup Utility">
                            <i class="fa-solid fa-microchip" aria-hidden="true"></i> BIOS Setup
                        </button>
                        <button type="button" class="about-btn" data-about-action="refresh" title="Refresh storage and hardware status">
                            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Refresh
                        </button>
                    </div>
                </section>

                <section class="about-card" aria-label="Storage allocation and usage">
                    <div class="about-card-header">
                        <div>
                            <h3><i class="fa-solid fa-hard-drive" aria-hidden="true"></i> Storage — Workspace</h3>
                            <p>Allocated browser storage quota, active SystemFS workspace files, and cached runtimes.</p>
                        </div>
                        ${persistenceBadge}
                    </div>

                    <div class="about-drive-summary">
                        <div class="about-drive-metrics">
                            <div class="about-metric-box">
                                <span class="about-metric-label">Allocated Space</span>
                                <strong class="about-metric-value">${escapeHtml(quotaDisplay)}</strong>
                            </div>
                            <div class="about-metric-box">
                                <span class="about-metric-label">Space Taken</span>
                                <strong class="about-metric-value">${escapeHtml(usedDisplay)}${estimate.supported ? ` (${pct.toFixed(1)}%)` : ""}</strong>
                            </div>
                            <div class="about-metric-box">
                                <span class="about-metric-label">Available Free</span>
                                <strong class="about-metric-value is-accent">${escapeHtml(freeDisplay)}</strong>
                            </div>
                        </div>

                        <div class="about-meter-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Storage quota utilization">
                            <div class="about-meter-fill ${barStateClass}" style="width: ${estimate.supported ? Math.max(pct, estimate.usage > 0 ? 1.5 : 0).toFixed(2) : 0}%"></div>
                        </div>

                        <div class="about-storage-legend">
                            <span><i class="fa-solid fa-folder-tree" aria-hidden="true"></i> Profile Workspace (SystemFS): <strong>${escapeHtml(formatSize(profile.totalBytes, { zero: "0 B" }))}</strong> (${profile.fileCount} files)</span>
                            <span><i class="fa-solid fa-trash-can" aria-hidden="true"></i> Recycle Bin: <strong>${escapeHtml(formatSize(profile.trashBytes, { zero: "Empty" }))}</strong>${profile.trashCount ? ` (${profile.trashCount} items)` : ""}</span>
                            ${nonProfileBytes !== null ? `<span><i class="fa-solid fa-cubes" aria-hidden="true"></i> App Engines &amp; Offline Cache: <strong>${escapeHtml(formatSize(nonProfileBytes, { zero: "0 B" }))}</strong></span>` : ""}
                        </div>
                    </div>

                    <div class="about-folder-grid" aria-label="Profile folders">
                        ${folderRowsHtml}
                        <button type="button" class="about-folder-chip" data-about-open-path="/Recycle Bin" title="Open Recycle Bin in File Explorer">
                            <span class="about-folder-chip-icon">${window.SystemInfo?.getIconSvg?.("trash") || '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>'}</span>
                            <span class="about-folder-chip-text">
                                <strong>Recycle Bin</strong>
                                <span>${profile.trashCount === 0 ? "Empty" : `${profile.trashCount} items · ${escapeHtml(formatSize(profile.trashBytes, { zero: "0 B" }))}`}</span>
                            </span>
                        </button>
                    </div>
                </section>

                <div class="about-two-col">
                    <section class="about-card" aria-label="Device specifications">
                        <div class="about-card-header">
                            <div>
                                <h3><i class="fa-solid fa-sliders" aria-hidden="true"></i> Device Specifications</h3>
                                <p>Detected host capabilities and virtual hardware configuration.</p>
                            </div>
                        </div>
                        <dl class="about-spec-list">
                            <div class="about-spec-row">
                                <dt>Processor</dt>
                                <dd>${escapeHtml(cpuSummary)}</dd>
                            </div>
                            <div class="about-spec-row">
                                <dt>Memory Allocation</dt>
                                <dd>${escapeHtml(ramSummary)}</dd>
                            </div>
                            <div class="about-spec-row">
                                <dt>Multi-Threading</dt>
                                <dd>${device.processor.threads ? "Enabled (SharedArrayBuffer + Cross-Origin Isolated)" : "Single-threaded mode"}</dd>
                            </div>
                            <div class="about-spec-row">
                                <dt>Graphics (WebGL)</dt>
                                <dd>${escapeHtml(webglSummary)}</dd>
                            </div>
                            <div class="about-spec-row">
                                <dt>WebGPU &amp; Adapter</dt>
                                <dd>${escapeHtml(webgpuSummary)} · BIOS Pref: ${escapeHtml(gpuPref)}</dd>
                            </div>
                            <div class="about-spec-row">
                                <dt>Display Output</dt>
                                <dd>${escapeHtml(displaySummary)}</dd>
                            </div>
                        </dl>
                    </section>

                    <section class="about-card" aria-label="PortfoliOS specifications">
                        <div class="about-card-header">
                            <div>
                                <h3><i class="fa-solid fa-laptop-code" aria-hidden="true"></i> PortfoliOS Specifications</h3>
                                <p>Operating system build, firmware revision, and session environment.</p>
                            </div>
                        </div>
                        <dl class="about-spec-list">
                            <div class="about-spec-row">
                                <dt>Edition</dt>
                                <dd>PortfoliOS (${escapeHtml(device.os.experience || "Desktop")} Experience)</dd>
                            </div>
                            <div class="about-spec-row">
                                <dt>OS Release</dt>
                                <dd>${escapeHtml(device.os.release ? `v${device.os.release}` : "Unknown")}</dd>
                            </div>
                            <div class="about-spec-row">
                                <dt>BIOS / UEFI</dt>
                                <dd>${escapeHtml(device.os.biosVersion ? `v${device.os.biosVersion}` : "Standard")}${device.os.biosDate ? ` (${escapeHtml(device.os.biosDate)})` : ""}</dd>
                            </div>
                            <div class="about-spec-row">
                                <dt>Offline Shell Cache</dt>
                                <dd>${device.os.offlineCache ? "Active (Service Worker controlling session)" : "Online direct mode"}</dd>
                            </div>
                            <div class="about-spec-row">
                                <dt>Host Runtime</dt>
                                <dd>${escapeHtml([device.browser.name, device.browser.platform].filter(Boolean).join(" on ") || "Web Browser")}</dd>
                            </div>
                            <div class="about-spec-row">
                                <dt>Locale &amp; Network</dt>
                                <dd>${escapeHtml([device.browser.language, device.browser.timeZone, device.browser.online ? "Online" : "Offline"].filter(Boolean).join(" · "))}</dd>
                            </div>
                        </dl>
                    </section>
                </div>

                <section class="about-related-links" aria-label="Related system tools">
                    <button type="button" class="about-link-btn" data-open-app="taskmgr">
                        <i class="fa-solid fa-microchip" aria-hidden="true"></i> Task Manager
                    </button>
                    <button type="button" class="about-link-btn" data-open-app="security-center">
                        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Security Center
                    </button>
                    <button type="button" class="about-link-btn" data-open-settings-panel="cloud-sync">
                        <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Cloud Sync Settings
                    </button>
                    <button type="button" class="about-link-btn" data-open-app="settings">
                        <i class="fa-solid fa-sliders" aria-hidden="true"></i> System Settings
                    </button>
                </section>
            `;
        } catch (error) {
            if (!windowEl.isConnected || generation !== renderGeneration) return;
            console.error("About This Computer failed to render:", error);
            bodyEl.innerHTML = `<div class="about-empty">Unable to read system details right now. Try refreshing.</div>`;
        }
    }

    window.appRegistry[APP_ID] = {
        title: "About This Computer",
        icon: "apps/about/icon.svg",
        windowClass: "about-window utility-window",
        renderBody: () => `
            <div class="about-shell">
                <div class="about-scroll" data-about-content>
                    <div class="about-empty">Loading system specifications...</div>
                </div>
            </div>
        `,
        onOpen: (windowEl) => {
            const initial = renderAboutContent(windowEl);
            if (windowEl.dataset.aboutInitialized === "1") return initial;
            windowEl.dataset.aboutInitialized = "1";

            windowEl.addEventListener("click", async (event) => {
                const actionBtn = event.target.closest("[data-about-action]");
                if (actionBtn) {
                    const action = actionBtn.dataset.aboutAction;
                    if (action === "refresh") {
                        await renderAboutContent(windowEl, { refreshHardware: true });
                        window.showDesktopToast?.("System & storage details refreshed.");
                    } else if (action === "copy-specs") {
                        if (latestCopyReport && window.copyText) {
                            await window.copyText(latestCopyReport);
                        } else if (latestCopyReport && navigator.clipboard?.writeText) {
                            await navigator.clipboard.writeText(latestCopyReport);
                            window.showDesktopToast?.("Copied system specifications.");
                        }
                    } else if (action === "open-storage") {
                        const explorerEl = await window.openDesktopWindow?.("files");
                        if (explorerEl && window.appRegistry?.files?.openPath) {
                            await window.appRegistry.files.openPath("this-pc", explorerEl);
                        }
                    } else if (action === "open-bios") {
                        window.openBiosSetup?.("main");
                    }
                    return;
                }

                const pathBtn = event.target.closest("[data-about-open-path]");
                if (pathBtn) {
                    const targetPath = pathBtn.dataset.aboutOpenPath;
                    if (targetPath && window.openDesktopFile) {
                        try {
                            if (targetPath !== "/Recycle Bin") {
                                await window.SystemFS?.ensureDirectory?.(targetPath);
                            }
                            await window.openDesktopFile(targetPath);
                        } catch (err) {
                            window.showDesktopToast?.(err.message || "Could not open folder.");
                        }
                    }
                }
            });

            if (window.EventBus && unsubscribers.length === 0) {
                unsubscribers.push(
                    window.EventBus.on("fs:changed", () => renderAboutContent(windowEl)),
                    window.EventBus.on("fs:ready", () => renderAboutContent(windowEl)),
                    window.EventBus.on("bios:saved", () => renderAboutContent(windowEl, { refreshHardware: true })),
                    window.EventBus.on("state:changed:currentUserId", () => renderAboutContent(windowEl))
                );
            }
            return initial;
        },
        onFocus: (windowEl) => {
            renderAboutContent(windowEl);
        },
        onClose: (windowEl) => {
            renderGeneration++;
            unsubscribers.forEach((off) => {
                try { off?.(); } catch (_) {}
            });
            unsubscribers = [];
            windowEl.dataset.aboutInitialized = "";
        }
    };
})();
