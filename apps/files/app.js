(function() {
    const THIS_PC_PATH = "this-pc";
    let currentPath = THIS_PC_PATH;
    let searchQuery = "";
    let unsubscribeFs = null;
    let unsubscribeFsReady = null;
    let unsubscribeProfile = null;
    let searchTimeout = null;
    let renderGeneration = 0;

    function isThisPcView() {
        return currentPath === THIS_PC_PATH;
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

    function escapeHtml(value) {
        return String(value)
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

    function childPath(name, overrideParent = null) {
        const base = overrideParent || (isThisPcView() ? "/Downloads" : currentPath);
        return base === "/" ? `/${name}` : `${base}/${name}`;
    }

    function isOfficeFile(name = "") {
        return /\.(?:odt|doc|docx|ods|xls|xlsx|csv)$/i.test(name);
    }

    function isTextFile(name = "", type = "") {
        return String(type).startsWith("text/") || /\.(?:txt|md|json|js|css|html?|xml|log|csv)$/i.test(name);
    }

    function isAudioFile(name = "", type = "") {
        return String(type).startsWith("audio/") || /\.(?:mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i.test(name);
    }

    function isPdfFile(name = "") {
        return /\.pdf$/i.test(name);
    }

    function isRasterImage(name = "", type = "") {
        return (String(type).startsWith("image/") && !/\.svg$/i.test(name)) || /\.(?:png|jpe?g|webp|gif|bmp|ico|tiff?)$/i.test(name);
    }

    function isVectorImage(name = "", type = "") {
        return type === "image/svg+xml" || /\.(?:svg|vectorcraft)$/i.test(name);
    }

    function isRawImage(name = "") {
        return /\.(?:raw|dng|cr2|nef|arw|orf|rw2|pef|lightcraft)$/i.test(name);
    }

    function isDesignFile(name = "") {
        return /\.(?:craft|designcraft)$/i.test(name);
    }

    function isVideoFile(name = "", type = "") {
        return String(type).startsWith("video/") || /\.(?:mp4|webm|mkv|mov|avi|film|filmcraft)$/i.test(name);
    }

    function isEffectFile(name = "") {
        return /\.(?:fx|effectcraft)$/i.test(name);
    }

    function isWordDocument(name = "") {
        return /\.(?:docx?|odt|rtf)$/i.test(name);
    }

    function isSpreadsheet(name = "") {
        return /\.(?:xlsx?|ods|csv|tsv)$/i.test(name);
    }

    function isPresentation(name = "") {
        return /\.(?:pptx?|odp)$/i.test(name);
    }

    function isMarkdownFile(name = "") {
        return /\.(?:md|markdown)$/i.test(name);
    }

    function isCadFile(name = "") {
        return /\.(?:solidcraft|step|stp|iges|igs|stl|3mf|obj|gltf|glb|dxf)$/i.test(name);
    }

    function isGenOfficeFile(name = "") {
        return /\.(?:docx?|xlsx?|pptx?|odt|ods|odp|rtf|csv|tsv|md|markdown|html?|pdf)$/i.test(name);
    }

    function clearSearchInput(windowEl) {
        const searchInput = windowEl.querySelector(".files-search-input");
        if (searchInput) searchInput.value = "";
        searchQuery = "";
    }

    async function navigateToFolder(targetPath, windowEl) {
        const owner = state.currentUserId;
        if (targetPath && targetPath !== THIS_PC_PATH && targetPath !== "/" && targetPath !== "/Recycle Bin") {
            const existing = await window.SystemFS.readFile(targetPath);
            if (owner !== state.currentUserId) return;
            if (!existing) {
                await window.SystemFS.ensureDirectory(targetPath, { silent: true });
                if (owner !== state.currentUserId) return;
            }
        }
        currentPath = targetPath || THIS_PC_PATH;
        clearSearchInput(windowEl);
        return renderFilesGrid(windowEl);
    }

    function updateToolbarState(windowEl) {
        const inOverview = isThisPcView() && searchQuery.trim() === "";
        const newFolderBtn = windowEl.querySelector(".btn-new-folder");
        const newFileBtn = windowEl.querySelector(".btn-new-file");
        const uploadBtn = windowEl.querySelector(".btn-upload");

        if (newFolderBtn) {
            newFolderBtn.disabled = inOverview;
            newFolderBtn.title = inOverview ? "Open a drive or folder to create a folder" : "New Folder";
        }
        if (newFileBtn) {
            newFileBtn.disabled = inOverview;
            newFileBtn.title = inOverview ? "Open a drive or folder to create a file" : "New Text File";
        }
        if (uploadBtn) {
            uploadBtn.disabled = inOverview;
            uploadBtn.title = inOverview ? "Open a drive or folder to upload files" : "Upload File";
        }
    }

    function renderBreadcrumbs(windowEl) {
        const breadcrumbsContainer = windowEl.querySelector(".files-breadcrumbs");
        if (!breadcrumbsContainer) return;

        breadcrumbsContainer.innerHTML = "";

        // This PC (My Computer) segment
        const thisPcBtn = document.createElement("button");
        thisPcBtn.type = "button";
        thisPcBtn.className = "breadcrumb-segment";
        thisPcBtn.innerHTML = '<i class="fa-solid fa-computer"></i> This PC';
        thisPcBtn.addEventListener("click", () => {
            currentPath = THIS_PC_PATH;
            clearSearchInput(windowEl);
            renderFilesGrid(windowEl);
        });
        breadcrumbsContainer.appendChild(thisPcBtn);

        if (isThisPcView()) return;

        const addSeparator = () => {
            const separator = document.createElement("span");
            separator.className = "breadcrumb-separator";
            separator.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            breadcrumbsContainer.appendChild(separator);
        };

        addSeparator();
        const diskBtn = document.createElement("button");
        diskBtn.type = "button";
        diskBtn.className = "breadcrumb-segment";
        diskBtn.innerHTML = '<i class="fa-solid fa-layer-group"></i> Workspace';
        diskBtn.title = "Workspace root (/)";
        diskBtn.addEventListener("click", () => {
            currentPath = "/";
            clearSearchInput(windowEl);
            renderFilesGrid(windowEl);
        });
        breadcrumbsContainer.appendChild(diskBtn);

        if (currentPath !== "/") {
            const parts = currentPath.split("/").filter(Boolean);
            let accumulatedPath = "";
            parts.forEach((part) => {
                accumulatedPath += "/" + part;
                addSeparator();

                const segmentBtn = document.createElement("button");
                segmentBtn.type = "button";
                segmentBtn.className = "breadcrumb-segment";
                segmentBtn.textContent = window.SystemFS.getDisplayName({ path: accumulatedPath, name: part, isDirectory: true });
                const pathForSegment = accumulatedPath;
                segmentBtn.addEventListener("click", () => {
                    currentPath = pathForSegment;
                    clearSearchInput(windowEl);
                    renderFilesGrid(windowEl);
                });
                breadcrumbsContainer.appendChild(segmentBtn);
            });
        }
    }

    const BASE_SIDEBAR_SHORTCUTS = [
        { path: THIS_PC_PATH, label: "This PC", icon: "fa-solid fa-computer" },
        { path: "/Desktop", label: "Desktop", icon: "fa-solid fa-desktop" },
        { path: "/documents", label: "Documents", icon: "fa-solid fa-file-lines" },
        { path: "/Pictures", label: "Pictures", icon: "fa-solid fa-image" },
        { path: "/music", label: "Music", icon: "fa-solid fa-music" },
        { path: "/Downloads", label: "Downloads", icon: "fa-solid fa-download" },
        { path: "/ROMs", label: "ROMs", icon: "fa-solid fa-gamepad" },
        { path: "/Saved Games", label: "Saved Games", icon: "fa-solid fa-gamepad" },
        { path: "/Recycle Bin", label: "Recycle Bin", icon: "fa-solid fa-trash-can" }
    ];

    function getPinnedShortcuts() {
        try {
            const key = window.getPreferencesKey ? window.getPreferencesKey("FilesPinnedShortcuts") : "FilesPinnedShortcuts";
            const raw = window.Storage ? window.Storage.local.get(key) : localStorage.getItem(key);
            if (raw) {
                const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (_) {}
        return [...BASE_SIDEBAR_SHORTCUTS];
    }

    function savePinnedShortcuts(shortcuts) {
        try {
            const key = window.getPreferencesKey ? window.getPreferencesKey("FilesPinnedShortcuts") : "FilesPinnedShortcuts";
            const str = JSON.stringify(shortcuts);
            if (window.Storage) {
                window.Storage.local.set(key, str);
            } else {
                localStorage.setItem(key, str);
            }
            if (window.savePreferencesToFilesystem) {
                window.savePreferencesToFilesystem();
            }
        } catch (_) {}
    }

    function isPathPinned(path) {
        if (!path) return false;
        const norm = path === THIS_PC_PATH ? THIS_PC_PATH : (window.SystemFS ? window.SystemFS.normalizePath(path) : path);
        const list = getPinnedShortcuts();
        return list.some(item => {
            const itemNorm = item.path === THIS_PC_PATH ? THIS_PC_PATH : (window.SystemFS ? window.SystemFS.normalizePath(item.path) : item.path);
            return itemNorm === norm;
        });
    }

    function pinToSidebar(path, label, windowEl) {
        if (!path || isPathPinned(path)) return;
        const normPath = path === THIS_PC_PATH ? THIS_PC_PATH : (window.SystemFS ? window.SystemFS.normalizePath(path) : path);
        let finalLabel = label;
        if (!finalLabel) {
            if (normPath === "/") {
                finalLabel = "Workspace";
            } else if (normPath === THIS_PC_PATH) {
                finalLabel = "This PC";
            } else {
                finalLabel = window.SystemFS ? window.SystemFS.getDisplayName({ path: normPath, name: window.SystemFS.getName(normPath), isDirectory: true }) : normPath;
            }
        }
        let icon = "fa-solid fa-folder";
        if (normPath === "/") icon = "fa-solid fa-layer-group";
        else if (normPath === THIS_PC_PATH) icon = "fa-solid fa-computer";
        else if (normPath === "/Desktop") icon = "fa-solid fa-desktop";
        else if (normPath === "/documents") icon = "fa-solid fa-file-lines";
        else if (normPath === "/Pictures") icon = "fa-solid fa-image";
        else if (normPath === "/music") icon = "fa-solid fa-music";
        else if (normPath === "/Downloads") icon = "fa-solid fa-download";
        else if (normPath === "/ROMs" || normPath === "/Saved Games") icon = "fa-solid fa-gamepad";
        else if (normPath === "/Recycle Bin") icon = "fa-solid fa-trash-can";

        const list = getPinnedShortcuts();
        list.push({ path: normPath, label: finalLabel, icon });
        savePinnedShortcuts(list);
        if (windowEl) {
            renderSidebarShortcuts(windowEl);
            updateSidebarActiveState(windowEl);
        }
        window.showDesktopToast?.(`Pinned "${finalLabel}" to sidebar`);
    }

    function unpinFromSidebar(path, windowEl) {
        if (!path) return;
        const normPath = path === THIS_PC_PATH ? THIS_PC_PATH : (window.SystemFS ? window.SystemFS.normalizePath(path) : path);
        const list = getPinnedShortcuts();
        const updated = list.filter(item => {
            const itemNorm = item.path === THIS_PC_PATH ? THIS_PC_PATH : (window.SystemFS ? window.SystemFS.normalizePath(item.path) : item.path);
            return itemNorm !== normPath;
        });
        savePinnedShortcuts(updated);
        if (windowEl) {
            renderSidebarShortcuts(windowEl);
            updateSidebarActiveState(windowEl);
        }
        window.showDesktopToast?.("Unpinned from sidebar");
    }

    function resetSidebarToDefaults(windowEl) {
        savePinnedShortcuts([...BASE_SIDEBAR_SHORTCUTS]);
        if (windowEl) {
            renderSidebarShortcuts(windowEl);
            updateSidebarActiveState(windowEl);
        }
        window.showDesktopToast?.("Sidebar reset to default navigation");
    }

    function renderSidebarShortcuts(windowEl) {
        const container = windowEl.querySelector(".files-sidebar-shortcuts");
        if (!container) return;
        const list = getPinnedShortcuts();
        container.innerHTML = "";

        list.forEach(item => {
            const row = document.createElement("div");
            row.className = "sidebar-item-row";
            row.dataset.path = item.path;

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sidebar-shortcut";
            btn.dataset.path = item.path;
            btn.dataset.appContext = "sidebar-shortcut";
            btn.dataset.fileName = item.label;
            btn.title = item.label;

            const iconEl = document.createElement("i");
            iconEl.className = item.icon || "fa-solid fa-folder";
            btn.appendChild(iconEl);

            const labelEl = document.createElement("span");
            labelEl.className = "sidebar-label";
            labelEl.textContent = " " + item.label;
            btn.appendChild(labelEl);

            btn.addEventListener("click", () => {
                const targetPath = item.path;
                if (targetPath === THIS_PC_PATH || targetPath === "/" || targetPath === "/Recycle Bin") {
                    currentPath = targetPath;
                    clearSearchInput(windowEl);
                    renderFilesGrid(windowEl);
                } else {
                    navigateToFolder(targetPath, windowEl);
                }
            });

            row.appendChild(btn);

            if (item.path !== THIS_PC_PATH) {
                const unpinBtn = document.createElement("button");
                unpinBtn.type = "button";
                unpinBtn.className = "sidebar-unpin-btn";
                unpinBtn.title = `Unpin ${item.label} from sidebar`;
                unpinBtn.setAttribute("aria-label", `Unpin ${item.label} from sidebar`);
                unpinBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                unpinBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    unpinFromSidebar(item.path, windowEl);
                });
                row.appendChild(unpinBtn);
            }

            container.appendChild(row);
        });

        updateSidebarActiveState(windowEl);
    }

    function updateSidebarActiveState(windowEl) {
        const shortcuts = windowEl.querySelectorAll(".sidebar-shortcut");
        const normCurrent = currentPath ? (window.SystemFS ? window.SystemFS.normalizePath(currentPath) : currentPath) : "";
        shortcuts.forEach(btn => {
            const btnPath = btn.dataset.path;
            if (btnPath === THIS_PC_PATH) {
                btn.classList.toggle("active", isThisPcView());
            } else if (btnPath === "/") {
                btn.classList.toggle("active", currentPath === "/");
            } else {
                const normBtn = window.SystemFS ? window.SystemFS.normalizePath(btnPath) : btnPath;
                btn.classList.toggle("active", normCurrent === normBtn || normCurrent.startsWith(normBtn + "/"));
            }
        });
    }

    async function getThisPcData() {
        if (window.SystemInfo) {
            const [estimate, profile] = await Promise.all([
                window.SystemInfo.getStorageEstimate(),
                window.SystemInfo.getProfileUsage()
            ]);
            return { estimate, profile };
        }

        // Fallback if SystemInfo has not loaded yet
        let estimate = { supported: false, usage: null, quota: null, free: null, percent: null, persisted: null };
        try {
            if (navigator.storage?.estimate) {
                const est = await navigator.storage.estimate();
                const usage = Number(est.usage) || 0;
                const quota = Number(est.quota) || 0;
                estimate = {
                    supported: quota > 0,
                    usage,
                    quota: quota || null,
                    free: quota ? Math.max(0, quota - usage) : null,
                    percent: quota ? Math.min(100, (usage / quota) * 100) : null,
                    persisted: navigator.storage?.persisted ? await navigator.storage.persisted() : null
                };
            }
        } catch (_) {}

        const all = await window.SystemFS.getAllFiles();
        const defaultFolders = [
            { path: "/Desktop", label: "Desktop", icon: "fa-solid fa-desktop", bytes: 0, files: 0 },
            { path: "/documents", label: "Documents", icon: "fa-solid fa-file-lines", bytes: 0, files: 0 },
            { path: "/Pictures", label: "Pictures", icon: "fa-solid fa-image", bytes: 0, files: 0 },
            { path: "/music", label: "Music", icon: "fa-solid fa-music", bytes: 0, files: 0 },
            { path: "/Downloads", label: "Downloads", icon: "fa-solid fa-download", bytes: 0, files: 0 },
            { path: "/ROMs", label: "ROMs", icon: "fa-solid fa-gamepad", bytes: 0, files: 0 },
            { path: "/Saved Games", label: "Saved Games", icon: "fa-solid fa-floppy-disk", bytes: 0, files: 0 }
        ];
        const map = new Map(defaultFolders.map(f => [f.path, f]));
        let totalBytes = 0, fileCount = 0, folderCount = 0, trashBytes = 0, trashCount = 0;
        for (const rec of all) {
            if (rec.isDirectory) { folderCount++; continue; }
            const sz = Number(rec.size) || 0;
            totalBytes += sz;
            fileCount++;
            const top = "/" + (String(rec.path || "").split("/")[1] || "");
            if (map.has(top)) {
                map.get(top).bytes += sz;
                map.get(top).files++;
            } else if (top === "/Recycle Bin") {
                trashBytes += sz;
                trashCount++;
            }
        }
        return {
            estimate,
            profile: { totalBytes, fileCount, folderCount, trashBytes, trashCount, folders: defaultFolders }
        };
    }

    async function renderThisPcView(windowEl, generation) {
        const grid = windowEl.querySelector(".files-grid");
        if (!grid) return;

        const owner = state.currentUserId;
        const { estimate, profile } = await getThisPcData();
        if (owner !== state.currentUserId || generation !== renderGeneration || !windowEl.isConnected) return;

        const pct = estimate.supported ? Math.min(100, Math.max(0, estimate.percent || 0)) : 0;
        const barStateClass = pct >= 90 ? "is-critical" : (pct >= 75 ? "is-warning" : "");
        const freeLabel = estimate.supported
            ? `${formatSize(estimate.free, { zero: "0 MB" })} free of ${formatSize(estimate.quota)}`
            : `${formatSize(profile.totalBytes, { zero: "0 bytes" })} in workspace (dynamic browser quota)`;
        const takenLabel = estimate.supported
            ? `${formatSize(estimate.usage, { zero: "0 MB" })} taken (${pct.toFixed(1)}%) · Workspace files: ${formatSize(profile.totalBytes, { zero: "0 B" })}`
            : `${profile.fileCount} file(s) across ${profile.folderCount} folder(s)`;
        const nonProfileBytes = estimate.supported ? Math.max(0, (estimate.usage || 0) - profile.totalBytes) : null;
        const user = window.getCurrentUser?.();

        const foldersWithTrash = [
            ...profile.folders,
            {
                path: "/Recycle Bin",
                label: "Recycle Bin",
                icon: "fa-solid fa-trash-can",
                svgKey: "trash",
                bytes: profile.trashBytes,
                files: profile.trashCount,
                isTrash: true
            }
        ];

        const folderCardsHtml = foldersWithTrash.map((folder) => {
            const metaText = folder.isTrash
                ? (folder.files === 0 ? "Empty" : `${folder.files} ${folder.files === 1 ? "item" : "items"} · ${formatSize(folder.bytes, { zero: "0 B" })}`)
                : (folder.files === 0 ? "Empty folder" : `${folder.files} ${folder.files === 1 ? "file" : "files"} · ${formatSize(folder.bytes, { zero: "0 B" })}`);
            const svgGlyph = window.SystemInfo?.getIconSvg?.(folder.svgKey) || `<i class="${escapeHtml(folder.icon)}" aria-hidden="true"></i>`;
            return `
                <div class="thispc-folder-card ${folder.isTrash ? "is-trash" : ""}"
                     tabindex="0"
                     role="button"
                     data-thispc-folder="${escapeHtml(folder.path)}"
                     data-path="${escapeHtml(folder.path)}"
                     data-file-name="${escapeHtml(folder.label)}"
                     data-is-directory="true"
                     data-app-context="thispc-folder"
                     aria-label="Open ${escapeHtml(folder.label)} (${escapeHtml(metaText)})">
                    <div class="thispc-folder-icon">
                        ${svgGlyph}
                    </div>
                    <div class="thispc-folder-meta">
                        <span class="thispc-folder-title">${escapeHtml(folder.label)}</span>
                        <span class="thispc-folder-sub">${escapeHtml(metaText)}</span>
                    </div>
                </div>
            `;
        }).join("");

        const driveGlyph = window.SystemInfo?.getIconSvg?.("drive") || '<i class="fa-solid fa-hard-drive" aria-hidden="true"></i>';

        grid.classList.add("is-this-pc");
        grid.innerHTML = `
            <section class="thispc-section" aria-label="Storage and drives">
                <div class="thispc-section-header">
                    <h3 class="thispc-section-title"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i> Storage and drives (1)</h3>
                    <div class="thispc-section-actions">
                        <button type="button" class="btn-toolbar" data-thispc-refresh title="Refresh storage state">
                            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Refresh
                        </button>
                        <button type="button" class="btn-toolbar" data-thispc-about title="Open About This Computer">
                            <i class="fa-solid fa-circle-info" aria-hidden="true"></i> About Computer
                        </button>
                    </div>
                </div>

                <div class="thispc-drives-row">
                    <div class="thispc-drive-card"
                         tabindex="0"
                         role="button"
                         data-thispc-drive="/"
                         data-path="/"
                         data-file-name="Workspace Storage"
                         data-is-directory="true"
                         data-app-context="thispc-drive"
                         aria-label="Workspace Storage, ${escapeHtml(freeLabel)}">
                        <div class="thispc-drive-icon">
                            ${driveGlyph}
                        </div>
                        <div class="thispc-drive-body">
                            <div class="thispc-drive-top">
                                <strong>Workspace Storage</strong>
                                <span class="thispc-drive-badge">${estimate.persisted === true ? "Persistent" : "SystemFS"}</span>
                            </div>
                            <div class="thispc-meter-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Workspace storage usage">
                                <div class="thispc-meter-fill ${barStateClass}" style="width: ${estimate.supported ? Math.max(pct, estimate.usage > 0 ? 1.5 : 0).toFixed(2) : 0}%"></div>
                            </div>
                            <div class="thispc-drive-free">${escapeHtml(freeLabel)}</div>
                            <div class="thispc-drive-used">${escapeHtml(takenLabel)}</div>
                        </div>
                    </div>

                    <div class="thispc-state-card" aria-label="Allocation breakdown">
                        <div class="thispc-state-row">
                            <span>Active Profile</span>
                            <strong>${escapeHtml(user?.displayName || state.currentUserId || "Guest")}</strong>
                        </div>
                        <div class="thispc-state-row">
                            <span>Allocated Quota</span>
                            <strong>${escapeHtml(estimate.supported ? formatSize(estimate.quota) : "Browser Dynamic")}</strong>
                        </div>
                        <div class="thispc-state-row">
                            <span>Space Taken</span>
                            <strong>${escapeHtml(estimate.supported ? formatSize(estimate.usage, { zero: "0 MB" }) : formatSize(profile.totalBytes, { zero: "0 B" }))}</strong>
                        </div>
                        <div class="thispc-state-row">
                            <span>Space Available</span>
                            <strong class="is-accent">${escapeHtml(estimate.supported ? formatSize(estimate.free, { zero: "0 MB" }) : "Available")}</strong>
                        </div>
                        ${nonProfileBytes !== null ? `
                        <div class="thispc-state-row">
                            <span>Engines &amp; Cache</span>
                            <strong>${escapeHtml(formatSize(nonProfileBytes, { zero: "0 B" }))}</strong>
                        </div>` : ""}
                    </div>
                </div>
            </section>

            <section class="thispc-section" aria-label="Folders">
                <div class="thispc-section-header">
                    <h3 class="thispc-section-title"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i> Folders (${foldersWithTrash.length})</h3>
                    <span class="thispc-hint">Double-click a drive or folder to browse</span>
                </div>
                <div class="thispc-folders-grid">
                    ${folderCardsHtml}
                </div>
            </section>
        `;

        // Bind interactions for This PC cards
        const driveCard = grid.querySelector("[data-thispc-drive]");
        if (driveCard) {
            driveCard.addEventListener("click", () => {
                grid.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
                driveCard.classList.add("selected");
            });
            driveCard.addEventListener("dblclick", () => navigateToFolder("/", windowEl));
            driveCard.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    navigateToFolder("/", windowEl);
                }
            });
        }

        grid.querySelectorAll("[data-thispc-folder]").forEach((card) => {
            const folderPath = card.dataset.thispcFolder;
            card.addEventListener("click", () => {
                grid.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
                card.classList.add("selected");
            });
            card.addEventListener("dblclick", () => navigateToFolder(folderPath, windowEl));
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    navigateToFolder(folderPath, windowEl);
                }
            });
        });

        grid.querySelector("[data-thispc-refresh]")?.addEventListener("click", () => {
            renderFilesGrid(windowEl);
        });
        grid.querySelector("[data-thispc-about]")?.addEventListener("click", () => {
            window.openDesktopWindow?.("about");
        });
    }

    async function renderFilesGrid(windowEl) {
        const generation = ++renderGeneration;
        const grid = windowEl.querySelector(".files-grid");
        if (!grid) return;

        renderBreadcrumbs(windowEl);
        updateSidebarActiveState(windowEl);
        updateToolbarState(windowEl);

        try {
            if (isThisPcView() && searchQuery.trim() === "") {
                await renderThisPcView(windowEl, generation);
                return;
            }

            grid.classList.remove("is-this-pc");
            const owner = state.currentUserId;
            let items = isThisPcView()
                ? await window.SystemFS.getAllFiles()
                : await window.SystemFS.readDir(currentPath);
            await Promise.all(items.map(async item => { item.desktopShortcut = await window.resolveDesktopShortcut?.(item); }));
            if (owner !== state.currentUserId) return;
            if (generation !== renderGeneration || !windowEl.isConnected) return;

            const fragment = document.createDocumentFragment();

            if (!isThisPcView() && searchQuery.trim() === "") {
                const upItem = document.createElement("div");
                upItem.className = "file-item up-item";
                const goingToThisPc = currentPath === "/";
                upItem.innerHTML = `
                    <div class="file-icon"><i class="fa-solid ${goingToThisPc ? "fa-computer" : "fa-arrow-turn-up"}"></i></div>
                    <div class="file-name">${goingToThisPc ? ".. (This PC)" : ".. (Up)"}</div>
                `;
                upItem.addEventListener("dblclick", () => {
                    if (currentPath === "/") {
                        currentPath = THIS_PC_PATH;
                    } else {
                        const parts = currentPath.split("/");
                        parts.pop();
                        currentPath = parts.join("/") || "/";
                    }
                    clearSearchInput(windowEl);
                    renderFilesGrid(windowEl);
                });
                fragment.appendChild(upItem);
            }

            // Filter out hidden files/folders (starting with dot)
            items = items.filter(item => !item.name.startsWith(".") && !String(item.path || "").split("/").some(seg => seg.startsWith(".")));

            // Apply search filter if active
            if (searchQuery.trim() !== "") {
                const query = searchQuery.toLowerCase().trim();
                items = items.filter(item => {
                    const display = window.SystemFS.getDisplayName(item).toLowerCase();
                    return item.name.toLowerCase().includes(query) || display.includes(query);
                });
            }

            // Case-insensitive natural directory-first sort
            items.sort((a, b) => {
                const aIsDir = !!a.isDirectory;
                const bIsDir = !!b.isDirectory;
                if (aIsDir !== bIsDir) {
                    return aIsDir ? -1 : 1;
                }
                const aName = window.SystemFS.getDisplayName(a) || a.name || "";
                const bName = window.SystemFS.getDisplayName(b) || b.name || "";
                return aName.localeCompare(bName, undefined, { sensitivity: "base", numeric: true });
            });

            if (items.length === 0) {
                const emptyEl = document.createElement("div");
                emptyEl.className = "empty-state-container";
                if (searchQuery.trim() !== "") {
                    emptyEl.innerHTML = `<div class="empty-state">No matching files found.</div>`;
                } else if (currentPath === "/") {
                    emptyEl.innerHTML = `<div class="empty-state">No files or folders here. Drag &amp; drop files to upload!</div>`;
                } else {
                    emptyEl.innerHTML = `<div class="empty-state">This directory is empty.</div>`;
                }
                grid.innerHTML = "";
                grid.appendChild(emptyEl);
                return;
            }

            items.forEach(item => {
                const el = document.createElement("div");
                el.className = `file-item ${item.isDirectory ? "dir-item" : "file-item-doc"}`;
                el.dataset.path = item.path;
                el.dataset.appContext = "file";
                el.dataset.fileName = item.name;
                el.dataset.fileType = item.type || "";
                el.dataset.isDirectory = String(!!item.isDirectory);
                const launcher = item.desktopShortcut && window.getDesktopLauncher(item.desktopShortcut.selectId || item.desktopShortcut.appId);
                const safeName = escapeHtml(launcher?.title || window.SystemFS.getDisplayName(item));

                let iconHtml = '<i class="fa-regular fa-file"></i>';
                if (item.metadata?.customIcon) {
                    const ci = item.metadata.customIcon;
                    if (/^(?:data:image\/|blob:|https?:|\/|\.)/.test(ci)) {
                        iconHtml = `<img src="${escapeHtml(ci)}" style="width:32px;height:32px;object-fit:contain;" alt="" />`;
                    } else {
                        iconHtml = `<i class="${escapeHtml(ci)}"></i>`;
                    }
                } else if (item.path === "/Recycle Bin" || item.metadata?.kind === "recycle-bin") {
                    iconHtml = '<i class="fa-solid fa-trash-can" style="color: #94a3b8;"></i>';
                } else if (item.isDirectory) {
                    iconHtml = '<i class="fa-solid fa-folder"></i>';
                } else if (launcher) {
                    iconHtml = window.getAppIconHtml(launcher.icon, "", item.desktopShortcut.selectId || item.desktopShortcut.appId);
                } else if (item.type.startsWith("image/")) {
                    iconHtml = '<i class="fa-regular fa-file-image"></i>';
                } else if (item.type.startsWith("audio/")) {
                    iconHtml = '<i class="fa-regular fa-file-audio"></i>';
                } else if (item.type.startsWith("text/")) {
                    iconHtml = '<i class="fa-regular fa-file-lines"></i>';
                } else if (/\.(?:docx?|odt|rtf)$/i.test(item.name)) {
                    iconHtml = '<i class="fa-solid fa-file-word" style="color: #2563eb;"></i>';
                } else if (/\.(?:xlsx?|ods|csv|tsv)$/i.test(item.name)) {
                    iconHtml = '<i class="fa-solid fa-file-excel" style="color: #16a34a;"></i>';
                } else if (/\.(?:pptx?|odp)$/i.test(item.name)) {
                    iconHtml = '<i class="fa-solid fa-file-powerpoint" style="color: #ea580c;"></i>';
                } else if (isCadFile(item.name)) {
                    iconHtml = '<i class="fa-solid fa-cube"></i>';
                }

                el.innerHTML = `
                    <div class="file-icon">${iconHtml}</div>
                    <div class="file-name" title="${safeName}">${safeName}</div>
                    <button class="delete-btn" title="Delete ${safeName}"><i class="fa-solid fa-trash"></i></button>
                `;

                el.addEventListener("dblclick", () => {
                    if (item.isDirectory) {
                        currentPath = item.path;
                        clearSearchInput(windowEl);
                        renderFilesGrid(windowEl);
                    } else {
                        openFile(item, windowEl);
                    }
                });

                const delBtn = el.querySelector(".delete-btn");
                delBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                        await deletePathRecursive(item.path);
                        renderFilesGrid(windowEl);
                    }
                });

                fragment.appendChild(el);
            });

            grid.innerHTML = "";
            grid.appendChild(fragment);
        } catch (err) {
            if (generation !== renderGeneration || !windowEl.isConnected) return;
            console.error("Failed to render files grid:", err);
            grid.classList.remove("is-this-pc");
            grid.innerHTML = `<div class="empty-state-container"><div class="empty-state">Filesystem unavailable. Try reopening File Explorer.</div></div>`;
        }
    }

    async function deletePathRecursive(path) {
        await window.SystemFS.deleteFileRecursive(path);
    }

    async function openFile(item, windowEl) {
        const owner = state.currentUserId;
        const shortcut = await window.resolveDesktopShortcut?.(item);
        SystemFS.assertProfile(owner);
        if (shortcut && window.appById?.(shortcut.appId)) {
            if (!window.isAppInstalled?.(shortcut.appId)) { window.showDesktopToast?.('Install this app from the Store first.'); return; }
            if (shortcut.selectId && window.systemById?.(shortcut.selectId)) window.renderDossier?.(shortcut.selectId);
            return window.openDesktopWindow(shortcut.appId);
        }
        const lowerName = item.name.toLowerCase();

        // 1. Check user-configured and system default file associations
        const associatedApp = window.getFileAssociation ? window.getFileAssociation(lowerName) : null;
        if (associatedApp === 'loop-studio' && !window.isAppInstalled?.('loop-studio')) {
            window.showDesktopToast?.('Install Loop Studio from the Store to open this project.'); return;
        }

        if (associatedApp && (!window.isAppInstalled || window.isAppInstalled(associatedApp))) {
            if (associatedApp === "imageviewer") {
                return window.openDesktopWindow("imageviewer", { path: item.path, record: item });
            } else if (["photocraft", "pdfcraft", "solidcraft", "vectorcraft", "lightcraft", "designcraft", "effectcraft", "filmcraft"].includes(associatedApp)) {
                return window.openDesktopWindow(associatedApp, { path: item.path });
            } else if (associatedApp === "vscode") {
                return window.openDesktopWindow("vscode", { path: item.path });
            } else if (associatedApp.startsWith("genoffice")) {
                return window.openDesktopWindow(associatedApp, item);
            } else if (associatedApp === "musicmini") {
                return playAudioInMusicMini(item);
            } else if (associatedApp === "office") {
                return window.openDesktopWindow("office", item);
            } else {
                return window.openDesktopWindow(associatedApp, { path: item.path, record: item });
            }
        }

        // 2. Fallbacks by file category
        if (isPdfFile(lowerName) && (!window.isAppInstalled || window.isAppInstalled("pdfcraft"))) {
            window.openDesktopWindow("pdfcraft", { path: item.path });
        } else if (isCadFile(lowerName) && (!window.isAppInstalled || window.isAppInstalled("solidcraft"))) {
            window.openDesktopWindow("solidcraft", { path: item.path });
        } else if (isVectorImage(lowerName, item.type) && (!window.isAppInstalled || window.isAppInstalled("vectorcraft"))) {
            window.openDesktopWindow("vectorcraft", { path: item.path });
        } else if (isRawImage(lowerName) && (!window.isAppInstalled || window.isAppInstalled("lightcraft"))) {
            window.openDesktopWindow("lightcraft", { path: item.path });
        } else if (isDesignFile(lowerName) && (!window.isAppInstalled || window.isAppInstalled("designcraft"))) {
            window.openDesktopWindow("designcraft", { path: item.path });
        } else if (isEffectFile(lowerName) && (!window.isAppInstalled || window.isAppInstalled("effectcraft"))) {
            window.openDesktopWindow("effectcraft", { path: item.path });
        } else if (isVideoFile(lowerName, item.type) && (!window.isAppInstalled || window.isAppInstalled("filmcraft"))) {
            window.openDesktopWindow("filmcraft", { path: item.path });
        } else if (isRasterImage(lowerName, item.type)) {
            if (!window.isAppInstalled || window.isAppInstalled("imageviewer")) {
                window.openDesktopWindow("imageviewer", { path: item.path, record: item });
            } else if (window.isAppInstalled("photocraft")) {
                window.openDesktopWindow("photocraft", { path: item.path });
            }
        } else if (isWordDocument(lowerName) && (!window.isAppInstalled || window.isAppInstalled("genoffice-docs"))) {
            window.openDesktopWindow("genoffice-docs", item);
        } else if (isSpreadsheet(lowerName) && (!window.isAppInstalled || window.isAppInstalled("genoffice-sheets"))) {
            window.openDesktopWindow("genoffice-sheets", item);
        } else if (isPresentation(lowerName) && (!window.isAppInstalled || window.isAppInstalled("genoffice-slides"))) {
            window.openDesktopWindow("genoffice-slides", item);
        } else if (isMarkdownFile(lowerName) && (!window.isAppInstalled || window.isAppInstalled("genoffice-notes"))) {
            window.openDesktopWindow("genoffice-notes", item);
        } else if (isGenOfficeFile(lowerName) && (!window.isAppInstalled || window.isAppInstalled("genoffice"))) {
            window.openDesktopWindow("genoffice", item);
        } else if (isOfficeFile(lowerName)) {
            window.openDesktopWindow("office", item);
        } else if (isTextFile(lowerName, item.type)) {
            if (item.path.startsWith('/documents/') && window.isAppInstalled?.('vscode')) window.openDesktopWindow('vscode', {path:item.path});
            else openTextEditor(item, windowEl);
        } else if (isAudioFile(lowerName, item.type)) {
            playAudioInMusicMini(item);
        } else {
            downloadFileToHost(item);
        }
    }

    async function readFileForAction(path, action) {
        const owner = state.currentUserId;
        try {
            const item = await window.SystemFS.readFile(path);
            window.SystemFS.assertProfile(owner);
            if (!item) {
                window.showDesktopToast?.("That file is no longer available.");
                return;
            }
            await action(item);
        } catch (error) {
            console.error("File action failed:", error);
            window.showDesktopToast?.(error.message || "The file action failed.");
        }
    }

    async function playAudioInMusicMini(item) {
        await window.openDesktopWindow?.("musicmini");
        const musicMiniApp = window.appRegistry?.musicmini;
        if (!musicMiniApp || typeof musicMiniApp.playPath !== "function") {
            window.showDesktopToast?.("Music Mini is not ready to play this file.");
            return;
        }
        await musicMiniApp.playPath(item.path);
    }

    function openTextEditor(item, windowEl) {
        let editorOverlay = windowEl.querySelector(".files-editor-overlay");
        if (!editorOverlay) {
            editorOverlay = document.createElement("div");
            editorOverlay.className = "files-editor-overlay";
            windowEl.querySelector(".files-shell").appendChild(editorOverlay);
        }

        let fileDataText = "";
        if (typeof item.data === "string") {
            fileDataText = item.data;
            setupEditorUI(editorOverlay, item, fileDataText, windowEl);
        } else if (item.data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
                setupEditorUI(editorOverlay, item, reader.result, windowEl);
            };
            reader.readAsText(item.data);
        } else {
            setupEditorUI(editorOverlay, item, fileDataText, windowEl);
        }
    }

    function setupEditorUI(overlay, item, text, windowEl) {
        overlay.innerHTML = `
            <div class="editor-header">
                <span>Editing: ${escapeHtml(item.name)}</span>
                <div class="editor-actions">
                    <button class="editor-btn save-btn"><i class="fa-solid fa-floppy-disk"></i> Save</button>
                    <button class="editor-btn close-btn"><i class="fa-solid fa-xmark"></i> Close</button>
                </div>
            </div>
            <textarea class="editor-textarea" spellcheck="false"></textarea>
        `;
        overlay.classList.add("active");
        const textarea = overlay.querySelector(".editor-textarea");
        textarea.value = text;

        overlay.querySelector(".save-btn").addEventListener("click", async () => {
            const updatedContent = textarea.value;
            await window.SystemFS.writeFile(item.path, item.name, item.parent, updatedContent, updatedContent.length, "text/plain", false);
            overlay.classList.remove("active");
            renderFilesGrid(windowEl);
            window.showDesktopToast?.(`Saved ${item.name} locally.`);
        });

        overlay.querySelector(".close-btn").addEventListener("click", () => {
            overlay.classList.remove("active");
        });
    }

    async function playAudioInWebamp(item) {
        await window.openDesktopWindow?.("webamp");
        const webampApp = window.appRegistry?.webamp;
        if (!webampApp || typeof webampApp.playTrack !== "function") {
            window.showDesktopToast?.("Install Webamp from the Store to play this file there.");
            return;
        }
        await webampApp.playTrack(item.data, item.name);
    }

    function downloadFileToHost(item) {
        let blob = item.data;
        if (!(blob instanceof Blob)) {
            blob = new Blob([blob], { type: item.type });
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function promptRename(path, isDir, windowEl) {
        const oldName = window.SystemFS.getName(path);
        const newName = prompt(`Rename ${isDir ? "folder" : "file"}:`, oldName);
        if (!newName || newName.trim() === "" || newName.trim() === oldName) return;
        try {
            await window.SystemFS.rename(path, newName.trim());
            renderFilesGrid(windowEl);
            window.showDesktopToast?.("Renamed successfully.");
        } catch (err) {
            alert(err.message || "Failed to rename.");
        }
    }

    async function promptDelete(path, isDir, windowEl, permanent = false) {
        const name = window.SystemFS.getName(path);
        const inTrash = currentPath === "/Recycle Bin" || path.startsWith("/Recycle Bin/");
        if (permanent || inTrash) {
            if (!confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone.`)) return;
            try {
                await window.SystemFS.deleteFileRecursive(path);
                renderFilesGrid(windowEl);
                window.showDesktopToast?.(`Permanently deleted ${name}.`);
            } catch (err) {
                alert(err.message || "Failed to delete.");
            }
        } else {
            try {
                await window.SystemFS.moveToTrash(path);
                renderFilesGrid(windowEl);
                window.showDesktopToast?.(`Moved "${name}" to Recycle Bin.`);
            } catch (err) {
                alert(err.message || "Failed to delete.");
            }
        }
    }

    async function showPropertiesModal(item, windowEl) {
        const record = await window.SystemFS.readFile(item.path) || item;
        const dialog = document.createElement("dialog");
        dialog.className = "file-properties-dialog";
        const isDir = Boolean(record.isDirectory);
        const name = record.name || window.SystemFS.getName(record.path);
        const path = record.path;
        const type = isDir ? "Folder" : (record.type || "File");
        const sizeFormatted = isDir ? "Directory" : (window.formatBytes ? window.formatBytes(record.size) : `${record.size || 0} bytes`);
        const modifiedDate = new Date(record.lastModified || Date.now()).toLocaleString();
        
        let currentIcon = record.metadata?.customIcon || (isDir ? "fa-solid fa-folder" : "fa-regular fa-file");
        let chosenIcon = currentIcon;

        const systemIcons = [
            "fa-solid fa-folder", "fa-solid fa-folder-open", "fa-solid fa-folder-tree", "fa-solid fa-box-archive",
            "fa-solid fa-file", "fa-solid fa-file-lines", "fa-solid fa-file-code", "fa-solid fa-file-image",
            "fa-solid fa-file-audio", "fa-solid fa-file-video", "fa-solid fa-file-pdf", "fa-solid fa-file-zipper",
            "fa-solid fa-star", "fa-solid fa-heart", "fa-solid fa-gear", "fa-solid fa-terminal",
            "fa-solid fa-globe", "fa-solid fa-lock", "fa-solid fa-shield-halved", "fa-solid fa-rocket",
            "fa-solid fa-gamepad", "fa-solid fa-palette", "fa-solid fa-database", "fa-solid fa-cloud"
        ];

        dialog.innerHTML = `
            <div class="properties-shell">
                <header class="properties-header">
                    <span class="properties-title"><i class="fa-solid fa-circle-info"></i> ${escapeHtml(name)} Properties</span>
                    <button type="button" class="properties-close" data-action="close">×</button>
                </header>
                <div class="properties-body">
                    <div class="properties-top-row">
                        <div class="properties-icon-preview" data-preview-icon>
                            <i class="${escapeHtml(currentIcon)}"></i>
                        </div>
                        <div class="properties-name-block">
                            <span class="properties-name-text">${escapeHtml(name)}</span>
                            <span class="properties-type-text">${escapeHtml(type)}</span>
                        </div>
                    </div>
                    <hr class="properties-divider">
                    <table class="properties-table">
                        <tr><td><strong>Location:</strong></td><td><code>${escapeHtml(path)}</code></td></tr>
                        <tr><td><strong>Size:</strong></td><td>${escapeHtml(sizeFormatted)}</td></tr>
                        <tr><td><strong>Last Modified:</strong></td><td>${escapeHtml(modifiedDate)}</td></tr>
                        <tr><td><strong>Accessed/Installed:</strong></td><td>${escapeHtml(new Date(record.lastModified || Date.now()).toLocaleDateString())}</td></tr>
                    </table>
                    <hr class="properties-divider">
                    <div class="properties-custom-icon-section">
                        <div class="properties-section-title">Customize Icon</div>
                        <div class="icon-picker-grid" data-icon-grid>
                            ${systemIcons.map(ic => `<button type="button" class="icon-option ${ic === currentIcon ? 'active' : ''}" data-icon="${ic}"><i class="${ic}"></i></button>`).join('')}
                        </div>
                        <div class="properties-icon-browse">
                            <button type="button" class="btn-toolbar" data-action="browse-icon"><i class="fa-solid fa-magnifying-glass"></i> Browse image from SystemFS...</button>
                        </div>
                    </div>
                </div>
                <footer class="properties-footer">
                    <button type="button" class="btn-toolbar" data-action="close">Cancel</button>
                    <button type="button" class="btn-toolbar btn-primary" data-action="save">Apply &amp; OK</button>
                </footer>
            </div>
        `;

        document.body.appendChild(dialog);
        dialog.showModal();

        const previewEl = dialog.querySelector("[data-preview-icon]");
        const updateIconPreview = (iconStr) => {
            chosenIcon = iconStr;
            if (/^(?:data:image\/|blob:|https?:|\/|\.)/.test(iconStr)) {
                previewEl.innerHTML = `<img src="${escapeHtml(iconStr)}" style="width:36px;height:36px;object-fit:contain;" alt="icon" />`;
            } else {
                previewEl.innerHTML = `<i class="${escapeHtml(iconStr)}"></i>`;
            }
        };

        dialog.querySelectorAll("[data-icon]").forEach(btn => {
            btn.addEventListener("click", () => {
                dialog.querySelectorAll("[data-icon]").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                updateIconPreview(btn.dataset.icon);
            });
        });

        dialog.querySelector('[data-action="browse-icon"]')?.addEventListener("click", async () => {
            const picked = await window.SystemFS.showOpenDialog({ folder: "/Pictures", types: [".svg", ".png", ".webp", ".ico", ".jpg"] });
            if (picked?.path) {
                dialog.querySelectorAll("[data-icon]").forEach(b => b.classList.remove("active"));
                updateIconPreview(picked.path);
            }
        });

        dialog.querySelector('[data-action="close"]')?.addEventListener("click", () => {
            dialog.close();
            dialog.remove();
        });

        dialog.querySelector('[data-action="save"]')?.addEventListener("click", async () => {
            try {
                const currentRecord = await window.SystemFS.readFile(path);
                if (currentRecord) {
                    const metadata = { ...(currentRecord.metadata || {}), customIcon: chosenIcon };
                    await window.SystemFS.writeFile(
                        currentRecord.path,
                        currentRecord.name,
                        currentRecord.parent,
                        currentRecord.data,
                        currentRecord.size,
                        currentRecord.type,
                        Boolean(currentRecord.isDirectory),
                        { silent: true, metadata }
                    );
                    window.EventBus?.emit("fs:changed", { action: "update", path });
                    renderFilesGrid(windowEl);
                    window.renderDesktopIcons?.();
                    window.showDesktopToast?.("Icon updated.");
                }
            } catch (err) {
                alert("Failed to update icon: " + err.message);
            }
            dialog.close();
            dialog.remove();
        });
    }

    function getFileContextMenuItems(target, windowEl) {
        if (target.dataset.appContext === "sidebar-shortcut" || target.closest?.('[data-app-context="sidebar-shortcut"]')) {
            const shortcutBtn = target.dataset.appContext === "sidebar-shortcut" ? target : target.closest('[data-app-context="sidebar-shortcut"]');
            const shortcutPath = shortcutBtn?.dataset.path;
            const shortcutLabel = shortcutBtn?.dataset.fileName || shortcutPath;
            const items = [
                {
                    label: `Open ${shortcutLabel}`,
                    icon: "fa-solid fa-folder-open",
                    action: () => {
                        if (shortcutPath === THIS_PC_PATH || shortcutPath === "/" || shortcutPath === "/Recycle Bin") {
                            currentPath = shortcutPath;
                            clearSearchInput(windowEl);
                            renderFilesGrid(windowEl);
                        } else {
                            navigateToFolder(shortcutPath, windowEl);
                        }
                    }
                }
            ];
            if (shortcutPath && shortcutPath !== THIS_PC_PATH) {
                items.push({
                    label: "Unpin from sidebar",
                    icon: "fa-solid fa-thumbtack",
                    action: () => unpinFromSidebar(shortcutPath, windowEl)
                });
            }
            items.push({ type: "separator" });
            items.push({
                label: "Reset sidebar to defaults",
                icon: "fa-solid fa-rotate-left",
                action: () => resetSidebarToDefaults(windowEl)
            });
            return items;
        }

        if (target.closest?.(".files-sidebar") && !target.closest?.(".files-storage-status")) {
            return [
                {
                    label: "Reset sidebar to defaults",
                    icon: "fa-solid fa-rotate-left",
                    action: () => resetSidebarToDefaults(windowEl)
                }
            ];
        }

        if (target.dataset.appContext === "thispc-drive") {
            const pinned = isPathPinned("/");
            return [
                { label: "Open Workspace", icon: "fa-solid fa-folder-open", action: () => navigateToFolder("/", windowEl) },
                {
                    label: pinned ? "Unpin from sidebar" : "Pin to sidebar",
                    icon: "fa-solid fa-thumbtack",
                    action: () => {
                        if (pinned) unpinFromSidebar("/", windowEl);
                        else pinToSidebar("/", "Workspace", windowEl);
                    }
                },
                { label: "Refresh storage", icon: "fa-solid fa-rotate-right", action: () => renderFilesGrid(windowEl) },
                { type: "separator" },
                { label: "Properties", icon: "fa-solid fa-circle-info", action: () => window.openDesktopWindow?.("about") }
            ];
        }

        if (target.dataset.appContext === "thispc-folder") {
            const folderPath = target.dataset.path;
            const pinned = isPathPinned(folderPath);
            if (folderPath === "/Recycle Bin") {
                return [
                    { label: "Open", icon: "fa-solid fa-folder-open", action: () => navigateToFolder("/Recycle Bin", windowEl) },
                    {
                        label: pinned ? "Unpin from sidebar" : "Pin to sidebar",
                        icon: "fa-solid fa-thumbtack",
                        action: () => {
                            if (pinned) unpinFromSidebar(folderPath, windowEl);
                            else pinToSidebar(folderPath, "Recycle Bin", windowEl);
                        }
                    },
                    {
                        label: "Empty Recycle Bin",
                        icon: "fa-solid fa-trash-can",
                        action: async () => {
                            if (confirm("Are you sure you want to permanently delete all items in the Recycle Bin?")) {
                                await window.SystemFS.emptyTrash();
                                renderFilesGrid(windowEl);
                                window.showDesktopToast?.("Recycle Bin emptied.");
                            }
                        }
                    },
                    { type: "separator" },
                    { label: "Properties", icon: "fa-solid fa-circle-info", action: () => showPropertiesModal({ path: "/Recycle Bin", name: "Recycle Bin", isDirectory: true }, windowEl) }
                ];
            }
            return [
                { label: "Open folder", icon: "fa-solid fa-folder-open", action: () => navigateToFolder(folderPath, windowEl) },
                {
                    label: pinned ? "Unpin from sidebar" : "Pin to sidebar",
                    icon: "fa-solid fa-thumbtack",
                    action: () => {
                        if (pinned) unpinFromSidebar(folderPath, windowEl);
                        else pinToSidebar(folderPath, target.dataset.fileName, windowEl);
                    }
                },
                { label: "Copy path", icon: "fa-regular fa-copy", action: () => window.copyText?.(folderPath) },
                { type: "separator" },
                {
                    label: "Properties",
                    icon: "fa-solid fa-circle-info",
                    action: async () => {
                        await window.SystemFS.ensureDirectory(folderPath, { silent: true });
                        const rec = await window.SystemFS.readFile(folderPath);
                        showPropertiesModal(rec || { path: folderPath, name: target.dataset.fileName, isDirectory: true }, windowEl);
                    }
                }
            ];
        }

        if (target.dataset.appContext === 'folder-background') {
            if (isThisPcView() && searchQuery.trim() === "") {
                return [
                    { label: "Refresh", icon: "fa-solid fa-rotate-right", action: () => renderFilesGrid(windowEl) },
                    { label: "Open Workspace", icon: "fa-solid fa-layer-group", action: () => navigateToFolder("/", windowEl) },
                    { type: "separator" },
                    { label: "Properties", icon: "fa-solid fa-circle-info", action: () => window.openDesktopWindow?.("about") }
                ];
            }
            if (currentPath === "/Recycle Bin") {
                return [
                    { label: "Empty Recycle Bin", icon: "fa-solid fa-trash-can", action: async () => {
                        if (confirm("Are you sure you want to permanently delete all items in the Recycle Bin?")) {
                            await window.SystemFS.emptyTrash();
                            renderFilesGrid(windowEl);
                            window.showDesktopToast?.("Recycle Bin emptied.");
                        }
                    }},
                    { label: "Refresh folder", icon: "fa-solid fa-rotate-right", action: () => renderFilesGrid(windowEl) }
                ];
            }
            return [
                {label:'New folder',icon:'fa-solid fa-folder-plus',action:()=>windowEl.querySelector('.btn-new-folder')?.click()},
                {label:'New text file',icon:'fa-solid fa-file-circle-plus',action:()=>windowEl.querySelector('.btn-new-file')?.click()},
                {label:'Upload from computer',icon:'fa-solid fa-file-arrow-up',action:()=>windowEl.querySelector('.btn-upload')?.click()},
                {label:'Refresh folder',icon:'fa-solid fa-rotate-right',action:()=>renderFilesGrid(windowEl)}
            ];
        }
        const path = target.dataset.path;
        const owner = state.currentUserId;
        const name = target.dataset.fileName || window.SystemFS.getName(path);
        const type = target.dataset.fileType || "";
        const isDirectory = target.dataset.isDirectory === "true";

        if (isDirectory) {
            const inTrash = currentPath === "/Recycle Bin" || path.startsWith("/Recycle Bin/");
            if (inTrash) {
                return [
                    { label: "Restore", icon: "fa-solid fa-rotate-left", action: async () => {
                        await window.SystemFS.restoreFromTrash(path);
                        renderFilesGrid(windowEl);
                        window.showDesktopToast?.(`Restored ${name}`);
                    }},
                    { label: "Delete permanently", icon: "fa-solid fa-trash", action: () => promptDelete(path, true, windowEl, true) },
                    { type: "separator" },
                    { label: "Properties", icon: "fa-solid fa-circle-info", action: () => readFileForAction(path, (rec) => showPropertiesModal(rec, windowEl)) }
                ];
            }
            const pinned = isPathPinned(path);
            return [
                {
                    label: "Open folder",
                    icon: "fa-solid fa-folder-open",
                    action: () => {
                        currentPath = path;
                        clearSearchInput(windowEl);
                        renderFilesGrid(windowEl);
                    }
                },
                {
                    label: pinned ? "Unpin from sidebar" : "Pin to sidebar",
                    icon: "fa-solid fa-thumbtack",
                    action: () => {
                        if (pinned) {
                            unpinFromSidebar(path, windowEl);
                        } else {
                            pinToSidebar(path, name, windowEl);
                        }
                    }
                },
                { label: "Copy path", icon: "fa-regular fa-copy", action: () => window.copyText?.(path) },
                { type: "separator" },
                { label: "Rename", icon: "fa-solid fa-pen-to-square", action: () => promptRename(path, true, windowEl) },
                { label: "Delete", icon: "fa-solid fa-trash-can", action: () => promptDelete(path, true, windowEl, false) },
                { type: "separator" },
                { label: "Properties", icon: "fa-solid fa-circle-info", action: () => readFileForAction(path, (rec) => showPropertiesModal(rec, windowEl)) }
            ];
        }

        const openWith = [];
        if (isCadFile(name) && (!window.isAppInstalled || window.isAppInstalled("solidcraft"))) {
            openWith.push({
                label: "SolidCraft",
                icon: "fa-solid fa-cube",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("solidcraft", { path: item.path }))
            });
        }
        if (isWordDocument(name) && (!window.isAppInstalled || window.isAppInstalled("genoffice-docs"))) {
            openWith.push({
                label: "GenDocs",
                icon: "fa-solid fa-file-word",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("genoffice-docs", item))
            });
        }
        if (isSpreadsheet(name) && (!window.isAppInstalled || window.isAppInstalled("genoffice-sheets"))) {
            openWith.push({
                label: "GenSheets",
                icon: "fa-solid fa-table",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("genoffice-sheets", item))
            });
        }
        if (isPresentation(name) && (!window.isAppInstalled || window.isAppInstalled("genoffice-slides"))) {
            openWith.push({
                label: "GenSlides",
                icon: "fa-solid fa-file-powerpoint",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("genoffice-slides", item))
            });
        }
        if (isMarkdownFile(name) && (!window.isAppInstalled || window.isAppInstalled("genoffice-notes"))) {
            openWith.push({
                label: "GenNotes",
                icon: "fa-brands fa-markdown",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("genoffice-notes", item))
            });
        }
        if (isGenOfficeFile(name) && (!window.isAppInstalled || window.isAppInstalled("genoffice"))) {
            openWith.push({
                label: "GenOffice",
                icon: "fa-solid fa-file-invoice",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("genoffice", item))
            });
        }
        if (isPdfFile(name) && (!window.isAppInstalled || window.isAppInstalled("pdfcraft"))) {
            openWith.push({
                label: "PDFCraft",
                icon: "fa-solid fa-file-pdf",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("pdfcraft", { path: item.path }))
            });
        }
        if ((isRasterImage(name, type) || isVectorImage(name, type)) && (!window.isAppInstalled || window.isAppInstalled("imageviewer"))) {
            openWith.push({
                label: "Image Viewer",
                icon: "fa-regular fa-image",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("imageviewer", { path: item.path, record: item }))
            });
        }
        if (isRasterImage(name, type) && (!window.isAppInstalled || window.isAppInstalled("photocraft"))) {
            openWith.push({
                label: "PhotoCraft",
                icon: "fa-solid fa-camera-retro",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("photocraft", { path: item.path }))
            });
        }
        if (isVectorImage(name, type) && (!window.isAppInstalled || window.isAppInstalled("vectorcraft"))) {
            openWith.push({
                label: "VectorCraft",
                icon: "fa-solid fa-bezier-curve",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("vectorcraft", { path: item.path }))
            });
        }
        if (isRawImage(name) && (!window.isAppInstalled || window.isAppInstalled("lightcraft"))) {
            openWith.push({
                label: "LightCraft",
                icon: "fa-solid fa-sliders",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("lightcraft", { path: item.path }))
            });
        }
        if (isDesignFile(name) && (!window.isAppInstalled || window.isAppInstalled("designcraft"))) {
            openWith.push({
                label: "DesignCraft",
                icon: "fa-solid fa-layer-group",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("designcraft", { path: item.path }))
            });
        }
        if (isVideoFile(name, type) && (!window.isAppInstalled || window.isAppInstalled("filmcraft"))) {
            openWith.push({
                label: "FilmCraft",
                icon: "fa-solid fa-film",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("filmcraft", { path: item.path }))
            });
        }
        if (isEffectFile(name) && (!window.isAppInstalled || window.isAppInstalled("effectcraft"))) {
            openWith.push({
                label: "EffectCraft",
                icon: "fa-solid fa-wand-magic-sparkles",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("effectcraft", { path: item.path }))
            });
        }
        if (isOfficeFile(name) || isTextFile(name, type)) {
            openWith.push({
                label: "PortfoliOS Office",
                icon: "fa-solid fa-file-signature",
                action: () => readFileForAction(path, (item) => window.openDesktopWindow("office", item))
            });
        }
        if (isTextFile(name, type)) {
            openWith.push({
                label: "Text Editor",
                icon: "fa-solid fa-pen-to-square",
                action: () => readFileForAction(path, (item) => openTextEditor(item, windowEl))
            });
        }
        if (isAudioFile(name, type)) {
            openWith.push({
                label: "Music Mini",
                icon: "fa-solid fa-record-vinyl",
                action: () => readFileForAction(path, playAudioInMusicMini)
            });
            if (!window.isAppInstalled || window.isAppInstalled("webamp")) {
                openWith.push({
                    label: "Webamp",
                    icon: "fa-solid fa-music",
                    action: () => readFileForAction(path, playAudioInWebamp)
                });
            }
        }

        const inTrash = currentPath === "/Recycle Bin" || path.startsWith("/Recycle Bin/");
        if (inTrash) {
            return [
                { label: "Restore", icon: "fa-solid fa-rotate-left", action: async () => {
                    await window.SystemFS.restoreFromTrash(path);
                    renderFilesGrid(windowEl);
                    window.showDesktopToast?.(`Restored ${name}`);
                }},
                { label: "Delete permanently", icon: "fa-solid fa-trash", action: () => promptDelete(path, false, windowEl, true) },
                { type: "separator" },
                { label: "Properties", icon: "fa-solid fa-circle-info", action: () => readFileForAction(path, (rec) => showPropertiesModal(rec, windowEl)) }
            ];
        }

        const items = [
            {
                label: isAudioFile(name, type) ? "Play" : "Open",
                icon: isAudioFile(name, type) ? "fa-solid fa-play" : "fa-solid fa-up-right-from-square",
                action: () => readFileForAction(path, (item) => openFile(item, windowEl))
            }
        ];
        if (name.endsWith('.portfolios-link.json')) items.push({
            label:'Send to Desktop (create shortcut)',icon:'fa-solid fa-desktop',
            action:()=>readFileForAction(path,async item=>{
                const link=await window.resolveDesktopShortcut(item);
                window.SystemFS.assertProfile(owner);
                if (!link) throw new Error('Invalid application shortcut.');
                return window.createDesktopAppShortcut(link.appId,link.selectId);
            })
        });
        if (openWith.length) {
            items.push({ label: "Open with", icon: "fa-solid fa-table-list", children: openWith });
        }
        if (isRasterImage(name, type) || isVectorImage(name, type)) {
            items.push({
                label: "Set as desktop wallpaper",
                icon: "fa-solid fa-image",
                action: () => readFileForAction(path, (item) => window.setCustomWallpaper?.(item, item.path))
            });
        }
        items.push(
            { type: "separator" },
            { label: "Download", icon: "fa-solid fa-download", action: () => readFileForAction(path, downloadFileToHost) },
            { label: "Copy path", icon: "fa-regular fa-copy", action: () => window.copyText?.(path) },
            { type: "separator" },
            { label: "Rename", icon: "fa-solid fa-pen-to-square", action: () => promptRename(path, false, windowEl) },
            { label: "Delete", icon: "fa-solid fa-trash-can", action: () => promptDelete(path, false, windowEl, false) },
            { type: "separator" },
            { label: "Properties", icon: "fa-solid fa-circle-info", action: () => readFileForAction(path, (rec) => showPropertiesModal(rec, windowEl)) }
        );
        return items;
    }

    function setupDragAndDrop(windowEl) {
        const dropZone = windowEl.querySelector(".files-grid-container");
        if (!dropZone) return;

        ["dragenter", "dragover"].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add("drag-hover");
            }, false);
        });

        ["dragleave", "drop"].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove("drag-hover");
            }, false);
        });

        dropZone.addEventListener("drop", async (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (!files.length) return;

            const folderCard = e.target.closest?.("[data-thispc-folder]");
            const dropFolder = folderCard && folderCard.dataset.thispcFolder !== "/Recycle Bin"
                ? folderCard.dataset.thispcFolder
                : (isThisPcView() ? "/Downloads" : currentPath);

            if (dropFolder !== "/") {
                await window.SystemFS.ensureDirectory(dropFolder, { silent: true });
            }

            let accepted = 0;
            let quarantined = 0;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const cleanName = sanitizeName(file.name);
                if (!cleanName) continue;
                const path = childPath(cleanName, dropFolder);
                if (!window.SecurityKernel?.importFile) throw new Error("Security Center is unavailable; import was blocked.");
                const outcome = await window.SecurityKernel.importFile({ path, name: cleanName, parent: dropFolder, data: file, size: file.size, type: file.type, source: "desktop-file-drop" });
                if (outcome.status === "accepted") accepted++;
                else quarantined++;
            }
            renderFilesGrid(windowEl);
            const where = isThisPcView() ? ` to ${dropFolder}` : "";
            window.showDesktopToast?.(`${accepted} file(s) saved${where}; ${quarantined} moved to Security Center.`);
        });
    }

    window.appRegistry.files = {
        title: "File Explorer",
        icon: "fa-solid fa-folder-open",
        windowClass: "files-window utility-window",
        renderBody: () => `
            <div class="files-shell">
                <div class="files-toolbar">
                    <button type="button" class="btn-toolbar btn-new-folder" title="New Folder"><i class="fa-solid fa-folder-plus"></i> New Folder</button>
                    <button type="button" class="btn-toolbar btn-new-file" title="New Text File"><i class="fa-solid fa-file-circle-plus"></i> New File</button>
                    <button type="button" class="btn-toolbar btn-upload" title="Upload File"><i class="fa-solid fa-file-arrow-up"></i> Upload</button>
                    <input type="file" class="files-file-input" multiple style="display: none;" />
                    
                    <div class="files-search-wrapper">
                        <i class="fa-solid fa-magnifying-glass search-icon"></i>
                        <input type="text" class="files-search-input" placeholder="Search This PC..." spellcheck="false" />
                    </div>

                    <div class="files-path-bar">
                        <div class="files-breadcrumbs"></div>
                    </div>
                </div>
                <div class="files-main">
                    <aside class="files-sidebar">
                        <div class="files-sidebar-shortcuts"></div>
                        <div class="files-storage-status">
                            <button type="button" data-open-app="about" title="Open About This Computer">
                                <i class="fa-solid fa-circle-info"></i> About Computer
                            </button>
                            <button type="button" data-open-settings-panel="cloud-sync" title="Open Cloud Sync settings">
                                <i class="fa-solid fa-cloud-arrow-up"></i> Cloud settings
                            </button>
                            <button type="button" data-open-app="security-center" title="Open Security Center">
                                <i class="fa-solid fa-shield-halved"></i> Security Center
                            </button>
                        </div>
                    </aside>
                    <div class="files-grid-container" data-app-context="folder-background">
                        <div class="files-grid"></div>
                    </div>
                </div>
            </div>
        `,
        openPath: async (path, windowEl) => {
            if (!path || path === THIS_PC_PATH) {
                currentPath = THIS_PC_PATH;
                clearSearchInput(windowEl);
                return renderFilesGrid(windowEl);
            }
            const normalized = window.SystemFS ? window.SystemFS.normalizePath(path) : path;
            if (normalized === "/") {
                currentPath = "/";
                clearSearchInput(windowEl);
                return renderFilesGrid(windowEl);
            }
            const owner = state.currentUserId;
            let item = await SystemFS.readFile(normalized);
            if (!item && normalized !== path) {
                item = await SystemFS.readFile(path);
            }
            SystemFS.assertProfile(owner);
            if (!item) throw new Error('That file or folder is no longer available.');
            if (!item.isDirectory) return openFile(item, windowEl);
            currentPath = item.path;
            clearSearchInput(windowEl);
            return renderFilesGrid(windowEl);
        },
        getContextMenuItems: (target, event, windowEl) => getFileContextMenuItems(target, windowEl),
        onOpen: (windowEl) => {
            const requestedPath = windowEl.launchParams?.path;
            if (requestedPath) {
                windowEl.launchParams = null;
            } else if (!currentPath) {
                currentPath = THIS_PC_PATH;
            }

            const initialRender = requestedPath
                ? window.appRegistry.files.openPath(requestedPath, windowEl)
                : renderFilesGrid(windowEl);

            if (windowEl.dataset.filesInitialized === "1") {
                return initialRender;
            }

            windowEl.dataset.filesInitialized = "1";
            setupDragAndDrop(windowEl);

            windowEl.addEventListener("launch-params", (e) => {
                const targetPath = e.detail?.path;
                if (targetPath) {
                    windowEl.launchParams = null;
                    window.appRegistry.files.openPath(targetPath, windowEl).catch((err) => {
                        window.showDesktopToast?.(err.message || "Could not open path.");
                    });
                }
            });

            if (window.EventBus && !unsubscribeFs) {
                unsubscribeFs = window.EventBus.on("fs:changed", (event) => {
                    if (isThisPcView() || event.parent === currentPath || event.path === currentPath || event.action === "sync" || event.action === "empty-trash") {
                        renderFilesGrid(windowEl);
                    }
                });
                unsubscribeFsReady = window.EventBus.on("fs:ready", () => renderFilesGrid(windowEl));
                unsubscribeProfile = window.EventBus.on("state:changed:currentUserId", () => {
                    currentPath = THIS_PC_PATH;
                    clearSearchInput(windowEl);
                    renderSidebarShortcuts(windowEl);
                    renderFilesGrid(windowEl);
                });
            }

            // Hook search input handler with debounce
            const searchInput = windowEl.querySelector(".files-search-input");
            if (searchInput) {
                searchInput.addEventListener("input", (e) => {
                    searchQuery = e.target.value;
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        renderFilesGrid(windowEl);
                    }, 250);
                });
            }

            // Render dynamic sidebar shortcuts
            renderSidebarShortcuts(windowEl);

            // New Folder button hook
            const newFolderBtn = windowEl.querySelector(".btn-new-folder");
            if (newFolderBtn) {
                newFolderBtn.addEventListener("click", async () => {
                    if (isThisPcView()) return;
                    const name = prompt("Enter folder name:");
                    if (!name) return;
                    const cleanName = sanitizeName(name);
                    if (!cleanName) return;
                    const path = childPath(cleanName);
                    await window.SystemFS.writeFile(path, cleanName, currentPath, null, 0, "directory", true);
                    renderFilesGrid(windowEl);
                });
            }

            const newFileBtn = windowEl.querySelector(".btn-new-file");
            if (newFileBtn) {
                newFileBtn.addEventListener("click", async () => {
                    if (isThisPcView()) return;
                    const name = prompt("Enter text file name:", "new-file.txt");
                    if (!name) return;
                    let cleanName = sanitizeName(name);
                    if (!cleanName) return;
                    if (!/\.[A-Za-z0-9]{1,8}$/.test(cleanName)) {
                        cleanName += ".txt";
                    }
                    const path = childPath(cleanName);
                    await window.SystemFS.writeFile(path, cleanName, currentPath, "", 0, "text/plain", false);
                    renderFilesGrid(windowEl);
                });
            }

            // Upload File button hook
            const uploadBtn = windowEl.querySelector(".btn-upload");
            const fileInput = windowEl.querySelector(".files-file-input");
            if (uploadBtn && fileInput) {
                uploadBtn.addEventListener("click", () => {
                    if (isThisPcView()) return;
                    fileInput.click();
                });
                fileInput.addEventListener("change", async () => {
                    const files = fileInput.files;
                    if (!files.length) return;
                    const targetParent = isThisPcView() ? "/Downloads" : currentPath;
                    if (targetParent !== "/") await window.SystemFS.ensureDirectory(targetParent, { silent: true });
                    let accepted = 0;
                    let quarantined = 0;
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const cleanName = sanitizeName(file.name);
                        if (!cleanName) continue;
                        const path = childPath(cleanName, targetParent);
                        if (!window.SecurityKernel?.importFile) throw new Error("Security Center is unavailable; import was blocked.");
                        const outcome = await window.SecurityKernel.importFile({ path, name: cleanName, parent: targetParent, data: file, size: file.size, type: file.type, source: "desktop-file-upload" });
                        if (outcome.status === "accepted") accepted++;
                        else quarantined++;
                    }
                    renderFilesGrid(windowEl);
                    window.showDesktopToast?.(`${accepted} file(s) saved; ${quarantined} moved to Security Center.`);
                    fileInput.value = "";
                });
            }
            return initialRender;
        },
        onClose: (windowEl) => {
            renderGeneration++;
            currentPath = THIS_PC_PATH;
            searchQuery = "";
            if (searchTimeout) {
                clearTimeout(searchTimeout);
                searchTimeout = null;
            }
            if (unsubscribeFs) {
                unsubscribeFs();
                unsubscribeFs = null;
            }
            if (unsubscribeFsReady) {
                unsubscribeFsReady();
                unsubscribeFsReady = null;
            }
            if (unsubscribeProfile) {
                unsubscribeProfile();
                unsubscribeProfile = null;
            }
            windowEl.dataset.filesInitialized = "";
        }
    };
})();
