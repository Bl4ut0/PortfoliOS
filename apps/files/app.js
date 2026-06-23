(function() {
    let currentPath = "/";
    let searchQuery = "";
    let unsubscribeFs = null;
    let unsubscribeFsReady = null;
    let searchTimeout = null;

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

    function childPath(name) {
        return currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
    }

    function renderBreadcrumbs(windowEl) {
        const breadcrumbsContainer = windowEl.querySelector(".files-breadcrumbs");
        if (!breadcrumbsContainer) return;

        breadcrumbsContainer.innerHTML = "";

        // Root segment
        const rootBtn = document.createElement("button");
        rootBtn.className = "breadcrumb-segment";
        rootBtn.innerHTML = '<i class="fa-solid fa-computer"></i> Root';
        rootBtn.addEventListener("click", () => {
            currentPath = "/";
            const searchInput = windowEl.querySelector(".files-search-input");
            if (searchInput) {
                searchInput.value = "";
                searchQuery = "";
            }
            renderFilesGrid(windowEl);
        });
        breadcrumbsContainer.appendChild(rootBtn);

        if (currentPath !== "/") {
            const parts = currentPath.split("/").filter(Boolean);
            let accumulatedPath = "";
            parts.forEach((part) => {
                accumulatedPath += "/" + part;
                
                const separator = document.createElement("span");
                separator.className = "breadcrumb-separator";
                separator.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
                breadcrumbsContainer.appendChild(separator);

                const segmentBtn = document.createElement("button");
                segmentBtn.className = "breadcrumb-segment";
                segmentBtn.textContent = part;
                const pathForSegment = accumulatedPath;
                segmentBtn.addEventListener("click", () => {
                    currentPath = pathForSegment;
                    const searchInput = windowEl.querySelector(".files-search-input");
                    if (searchInput) {
                        searchInput.value = "";
                        searchQuery = "";
                    }
                    renderFilesGrid(windowEl);
                });
                breadcrumbsContainer.appendChild(segmentBtn);
            });
        }
    }

    function updateSidebarActiveState(windowEl) {
        const shortcuts = windowEl.querySelectorAll(".sidebar-shortcut");
        shortcuts.forEach(btn => {
            const btnPath = btn.dataset.path;
            if (btnPath === "/") {
                if (currentPath === "/") {
                    btn.classList.add("active");
                } else {
                    btn.classList.remove("active");
                }
            } else {
                if (currentPath === btnPath || currentPath.startsWith(btnPath + "/")) {
                    btn.classList.add("active");
                } else {
                    btn.classList.remove("active");
                }
            }
        });
    }

    async function renderFilesGrid(windowEl) {
        const grid = windowEl.querySelector(".files-grid");
        if (!grid) return;

        // Render breadcrumbs and update sidebar highlights
        renderBreadcrumbs(windowEl);
        updateSidebarActiveState(windowEl);

        try {
            let items = await window.SystemFS.readDir(currentPath);
            
            // Build the new grid items off-screen using a fragment
            const fragment = document.createDocumentFragment();

            if (currentPath !== "/" && searchQuery.trim() === "") {
                const upItem = document.createElement("div");
                upItem.className = "file-item up-item";
                upItem.innerHTML = `
                    <div class="file-icon"><i class="fa-solid fa-arrow-turn-up"></i></div>
                    <div class="file-name">.. (Up)</div>
                `;
                upItem.addEventListener("dblclick", () => {
                    const parts = currentPath.split("/");
                    parts.pop();
                    currentPath = parts.join("/") || "/";
                    const searchInput = windowEl.querySelector(".files-search-input");
                    if (searchInput) {
                        searchInput.value = "";
                        searchQuery = "";
                    }
                    renderFilesGrid(windowEl);
                });
                fragment.appendChild(upItem);
            }

            // Filter out hidden files/folders (starting with dot)
            items = items.filter(item => !item.name.startsWith("."));
            
            // Apply search filter if active
            if (searchQuery.trim() !== "") {
                const query = searchQuery.toLowerCase().trim();
                items = items.filter(item => item.name.toLowerCase().includes(query));
            }

            if (items.length === 0) {
                const emptyEl = document.createElement("div");
                emptyEl.className = "empty-state-container";
                if (searchQuery.trim() !== "") {
                    emptyEl.innerHTML = `<div class="empty-state">No matching files found.</div>`;
                } else if (currentPath === "/") {
                    emptyEl.innerHTML = `<div class="empty-state">No files or folders here. Drag & drop files to upload!</div>`;
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
                const safeName = escapeHtml(item.name);

                let iconHtml = '<i class="fa-regular fa-file"></i>';
                if (item.isDirectory) {
                    iconHtml = '<i class="fa-solid fa-folder"></i>';
                } else if (item.type.startsWith("image/")) {
                    iconHtml = '<i class="fa-regular fa-file-image"></i>';
                } else if (item.type.startsWith("audio/")) {
                    iconHtml = '<i class="fa-regular fa-file-audio"></i>';
                } else if (item.type.startsWith("text/")) {
                    iconHtml = '<i class="fa-regular fa-file-lines"></i>';
                }

                el.innerHTML = `
                    <div class="file-icon">${iconHtml}</div>
                    <div class="file-name" title="${safeName}">${safeName}</div>
                    <button class="delete-btn" title="Delete ${safeName}"><i class="fa-solid fa-trash"></i></button>
                `;

                el.addEventListener("dblclick", () => {
                    if (item.isDirectory) {
                        currentPath = item.path;
                        const searchInput = windowEl.querySelector(".files-search-input");
                        if (searchInput) {
                            searchInput.value = "";
                            searchQuery = "";
                        }
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

            // Perform single DOM update to swap the items without flicker
            grid.innerHTML = "";
            grid.appendChild(fragment);
        } catch (err) {
            console.error("Failed to render files grid:", err);
            grid.innerHTML = `<div class="empty-state-container"><div class="empty-state">Filesystem unavailable. Try reopening File Explorer.</div></div>`;
        }
    }

    async function deletePathRecursive(path) {
        await window.SystemFS.deleteFileRecursive(path);
    }

    function openFile(item, windowEl) {
        if (item.type.startsWith("text/") || item.name.endsWith(".txt") || item.name.endsWith(".json") || item.name.endsWith(".md") || item.name.endsWith(".js") || item.name.endsWith(".css")) {
            openTextEditor(item, windowEl);
        } else if (item.type.startsWith("audio/") || item.name.endsWith(".mp3") || item.name.endsWith(".wav") || item.name.endsWith(".ogg")) {
            playAudioInWebamp(item);
        } else {
            downloadFileToHost(item);
        }
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
            window.showDesktopToast?.(`Saved ${item.name}`);
        });

        overlay.querySelector(".close-btn").addEventListener("click", () => {
            overlay.classList.remove("active");
        });
    }

    async function playAudioInWebamp(item) {
        if (!window.state.openApps.has("webamp")) {
            await openDesktopWindow("webamp");
        }
        setTimeout(() => {
            const webampApp = window.appRegistry.webamp;
            if (webampApp && typeof webampApp.playTrack === "function") {
                webampApp.playTrack(item.data, item.name);
            }
        }, 400);
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

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const cleanName = sanitizeName(file.name);
                if (!cleanName) continue;
                const path = childPath(cleanName);
                await window.SystemFS.writeFile(path, cleanName, currentPath, file, file.size, file.type, false);
            }
            renderFilesGrid(windowEl);
            window.showDesktopToast?.(`Uploaded ${files.length} file(s) to ${currentPath}`);
        });
    }

    function updateSyncPanelUI(panel) {
        const isConnected = window.GDriveSync.getToken() !== null;
        const statusText = panel.querySelector(".status-text");
        const indicator = panel.querySelector(".status-indicator");
        const connectBtn = panel.querySelector(".btn-connect-gdrive");
        const disconnectBtn = panel.querySelector(".btn-disconnect-gdrive");
        const startSyncBtn = panel.querySelector(".btn-start-sync");
        const clientIdInput = panel.querySelector(".sync-client-id-input");

        clientIdInput.value = localStorage.getItem("bl4ut0_gdrive_client_id") || "";

        if (isConnected) {
            statusText.textContent = "Connected to Google Drive";
            indicator.className = "status-indicator connected";
            connectBtn.style.display = "none";
            disconnectBtn.style.display = "inline-flex";
            startSyncBtn.style.display = "inline-flex";
        } else {
            statusText.textContent = "Not Connected";
            indicator.className = "status-indicator disconnected";
            connectBtn.style.display = "inline-flex";
            disconnectBtn.style.display = "none";
            startSyncBtn.style.display = "none";
        }
    }

    async function runSyncProcess(panel, windowEl) {
        const progressContainer = panel.querySelector(".sync-progress-container");
        const progressText = panel.querySelector(".sync-progress-status");
        const progressBar = panel.querySelector(".sync-progress-bar");
        const startSyncBtn = panel.querySelector(".btn-start-sync");
        const disconnectBtn = panel.querySelector(".btn-disconnect-gdrive");

        progressContainer.style.display = "block";
        startSyncBtn.disabled = true;
        disconnectBtn.disabled = true;

        try {
            await window.GDriveSync.sync((processed, total, path) => {
                if (total === 0) {
                    progressText.textContent = "Syncing... (No files)";
                    progressBar.style.width = "100%";
                } else {
                    const percent = Math.round((processed / total) * 100);
                    progressText.textContent = `Syncing [${processed}/${total}]: ${path.split("/").pop()}`;
                    progressBar.style.width = `${percent}%`;
                }
            });
            window.showDesktopToast?.("File Sync Complete!");
            progressText.textContent = "Sync complete!";
            progressBar.style.width = "100%";
            renderFilesGrid(windowEl);
        } catch (err) {
            console.error("Sync failed:", err);
            progressText.textContent = "Sync failed. Check settings.";
            progressBar.style.width = "0%";
            alert("Synchronization failed: " + err.message);
        } finally {
            startSyncBtn.disabled = false;
            disconnectBtn.disabled = false;
            setTimeout(() => {
                progressContainer.style.display = "none";
            }, 3000);
        }
    }

    window.appRegistry.files = {
        title: "File Explorer",
        icon: "fa-solid fa-folder-open",
        windowClass: "files-window",
        renderBody: () => `
            <div class="files-shell">
                <div class="files-toolbar">
                    <button class="btn-toolbar btn-new-folder" title="New Folder"><i class="fa-solid fa-folder-plus"></i> New Folder</button>
                    <button class="btn-toolbar btn-new-file" title="New Text File"><i class="fa-solid fa-file-circle-plus"></i> New File</button>
                    <button class="btn-toolbar btn-upload" title="Upload File"><i class="fa-solid fa-file-arrow-up"></i> Upload</button>
                    <button class="btn-toolbar btn-sync" title="Cloud Sync Settings"><i class="fa-solid fa-cloud"></i> Sync</button>
                    <input type="file" class="files-file-input" multiple style="display: none;" />
                    
                    <div class="files-search-wrapper">
                        <i class="fa-solid fa-magnifying-glass search-icon"></i>
                        <input type="text" class="files-search-input" placeholder="Search files..." spellcheck="false" />
                    </div>

                    <div class="files-path-bar">
                        <div class="files-breadcrumbs"></div>
                    </div>
                </div>
                <div class="files-main">
                    <aside class="files-sidebar">
                        <button class="sidebar-shortcut" data-path="/"><i class="fa-solid fa-computer"></i> Root (/)</button>
                        <button class="sidebar-shortcut" data-path="/documents"><i class="fa-solid fa-file-lines"></i> Documents</button>
                        <button class="sidebar-shortcut" data-path="/music"><i class="fa-solid fa-music"></i> Music</button>
                        <button class="sidebar-shortcut" data-path="/Saved Games"><i class="fa-solid fa-gamepad"></i> Saved Games</button>
                    </aside>
                    <div class="files-grid-container">
                        <div class="files-grid"></div>
                    </div>
                </div>
                <!-- Collapsible Sync Settings Panel -->
                <div class="files-sync-panel">
                    <div class="sync-panel-header">
                        <span><i class="fa-solid fa-cloud"></i> Google Drive Cloud Sync</span>
                        <button class="btn-close-sync" title="Close Panel"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="sync-panel-body">
                        <div class="sync-connection-status">
                            <span class="status-indicator disconnected"></span>
                            <span class="status-text">Not Connected</span>
                        </div>
                        <div class="sync-config-section">
                            <label for="sync-client-id">Google Client ID:</label>
                            <input type="text" id="sync-client-id" class="sync-client-id-input" placeholder="Enter your OAuth2 Client ID" />
                            <p class="sync-help-text">Please enter your Google OAuth 2.0 Client ID to enable personal cloud backup.</p>
                        </div>
                        <div class="sync-actions-row">
                            <button class="btn-sync-action btn-connect-gdrive"><i class="fa-solid fa-link"></i> Connect Account</button>
                            <button class="btn-sync-action btn-disconnect-gdrive" style="display: none;"><i class="fa-solid fa-link-slash"></i> Disconnect</button>
                            <button class="btn-sync-action btn-start-sync" style="display: none;"><i class="fa-solid fa-rotate"></i> Sync Now</button>
                        </div>
                        <div class="sync-progress-container" style="display: none;">
                            <div class="sync-progress-status">Syncing...</div>
                            <div class="sync-progress-bar-wrapper">
                                <div class="sync-progress-bar"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        onOpen: (windowEl) => {
            if (!currentPath) currentPath = "/";
            renderFilesGrid(windowEl);

            if (windowEl.dataset.filesInitialized === "1") {
                return;
            }

            windowEl.dataset.filesInitialized = "1";
            setupDragAndDrop(windowEl);

            if (window.EventBus && !unsubscribeFs) {
                unsubscribeFs = window.EventBus.on("fs:changed", (event) => {
                    if (event.parent === currentPath || event.path === currentPath || event.action === "sync") {
                        renderFilesGrid(windowEl);
                    }
                });
                unsubscribeFsReady = window.EventBus.on("fs:ready", () => renderFilesGrid(windowEl));
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

            // Hook sidebar click handlers
            windowEl.querySelectorAll(".sidebar-shortcut").forEach(el => {
                el.addEventListener("click", () => {
                    currentPath = el.dataset.path;
                    if (searchInput) {
                        searchInput.value = "";
                        searchQuery = "";
                    }
                    renderFilesGrid(windowEl);
                });
            });

            // New Folder button hook
            const newFolderBtn = windowEl.querySelector(".btn-new-folder");
            if (newFolderBtn) {
                newFolderBtn.addEventListener("click", async () => {
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
                uploadBtn.addEventListener("click", () => fileInput.click());
                fileInput.addEventListener("change", async () => {
                    const files = fileInput.files;
                    if (!files.length) return;
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const cleanName = sanitizeName(file.name);
                        if (!cleanName) continue;
                        const path = childPath(cleanName);
                        await window.SystemFS.writeFile(path, cleanName, currentPath, file, file.size, file.type, false);
                    }
                    renderFilesGrid(windowEl);
                    window.showDesktopToast?.(`Uploaded ${files.length} file(s).`);
                    fileInput.value = "";
                });
            }

            // Sync Settings Panel Hooks
            const syncBtn = windowEl.querySelector(".btn-sync");
            const syncPanel = windowEl.querySelector(".files-sync-panel");
            const closeSyncBtn = windowEl.querySelector(".btn-close-sync");
            
            if (syncBtn && syncPanel && closeSyncBtn) {
                syncBtn.addEventListener("click", () => {
                    syncPanel.classList.toggle("active");
                    updateSyncPanelUI(syncPanel);
                });
                closeSyncBtn.addEventListener("click", () => {
                    syncPanel.classList.remove("active");
                });

                const connectBtn = syncPanel.querySelector(".btn-connect-gdrive");
                connectBtn.addEventListener("click", async () => {
                    const clientId = syncPanel.querySelector(".sync-client-id-input").value.trim();
                    if (!clientId) {
                        alert("Please enter a valid Google Client ID first.");
                        return;
                    }
                    try {
                        connectBtn.disabled = true;
                        connectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
                        await window.GDriveSync.loadGsiLibrary();
                        await window.GDriveSync.login(clientId);
                        window.showDesktopToast?.("Google Drive Connected!");
                        await runSyncProcess(syncPanel, windowEl);
                    } catch (err) {
                        console.error(err);
                        alert("Connection failed. Please check your credentials.");
                    } finally {
                        connectBtn.disabled = false;
                        connectBtn.innerHTML = '<i class="fa-solid fa-link"></i> Connect Account';
                        updateSyncPanelUI(syncPanel);
                    }
                });

                const disconnectBtn = syncPanel.querySelector(".btn-disconnect-gdrive");
                disconnectBtn.addEventListener("click", () => {
                    window.GDriveSync.logout();
                    window.showDesktopToast?.("Google Drive Disconnected.");
                    updateSyncPanelUI(syncPanel);
                });

                const startSyncBtn = syncPanel.querySelector(".btn-start-sync");
                startSyncBtn.addEventListener("click", () => {
                    runSyncProcess(syncPanel, windowEl);
                });

                // Set initial UI state
                updateSyncPanelUI(syncPanel);
            }
        },
        onClose: (windowEl) => {
            if (unsubscribeFs) {
                unsubscribeFs();
                unsubscribeFs = null;
            }
            if (unsubscribeFsReady) {
                unsubscribeFsReady();
                unsubscribeFsReady = null;
            }
            windowEl.dataset.filesInitialized = "";
        }
    };
})();
