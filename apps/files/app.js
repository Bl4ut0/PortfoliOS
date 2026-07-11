(function() {
    let currentPath = "/";
    let searchQuery = "";
    let unsubscribeFs = null;
    let unsubscribeFsReady = null;
    let searchTimeout = null;
    let renderGeneration = 0;

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
        const generation = ++renderGeneration;
        const grid = windowEl.querySelector(".files-grid");
        if (!grid) return;

        // Render breadcrumbs and update sidebar highlights
        renderBreadcrumbs(windowEl);
        updateSidebarActiveState(windowEl);

        try {
            let items = await window.SystemFS.readDir(currentPath);
            if (generation !== renderGeneration || !windowEl.isConnected) return;
            
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
            if (generation !== renderGeneration || !windowEl.isConnected) return;
            console.error("Failed to render files grid:", err);
            grid.innerHTML = `<div class="empty-state-container"><div class="empty-state">Filesystem unavailable. Try reopening File Explorer.</div></div>`;
        }
    }

    async function deletePathRecursive(path) {
        await window.SystemFS.deleteFileRecursive(path);
    }

    function openFile(item, windowEl) {
        const lowerName = item.name.toLowerCase();
        if (lowerName.endsWith(".odt") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx") || lowerName.endsWith(".ods") || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx")) {
            window.openDesktopWindow("office", item);
        } else if (item.type.startsWith("text/") || lowerName.endsWith(".txt") || lowerName.endsWith(".json") || lowerName.endsWith(".md") || lowerName.endsWith(".js") || lowerName.endsWith(".css")) {
            openTextEditor(item, windowEl);
        } else if (item.type.startsWith("audio/") || lowerName.endsWith(".mp3") || lowerName.endsWith(".wav") || lowerName.endsWith(".ogg")) {
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
            window.showDesktopToast?.(`Saved ${files.length} file(s) locally in ${currentPath}.`);
        });
    }

    window.appRegistry.files = {
        title: "File Explorer",
        icon: "fa-solid fa-folder-open",
        windowClass: "files-window utility-window",
        renderBody: () => `
            <div class="files-shell">
                <div class="files-toolbar">
                    <button class="btn-toolbar btn-new-folder" title="New Folder"><i class="fa-solid fa-folder-plus"></i> New Folder</button>
                    <button class="btn-toolbar btn-new-file" title="New Text File"><i class="fa-solid fa-file-circle-plus"></i> New File</button>
                    <button class="btn-toolbar btn-upload" title="Upload File"><i class="fa-solid fa-file-arrow-up"></i> Upload</button>
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
                        <button class="sidebar-shortcut" data-path="/ROMs"><i class="fa-solid fa-gamepad"></i> ROMs</button>
                        <button class="sidebar-shortcut" data-path="/Saved Games"><i class="fa-solid fa-gamepad"></i> Saved Games</button>
                        <div class="files-storage-status">
                            <span><i class="fa-solid fa-hard-drive"></i> Saved locally</span>
                            <button type="button" data-open-settings-panel="cloud-sync" title="Open Cloud Sync settings">
                                <i class="fa-solid fa-cloud-arrow-up"></i> Cloud settings
                            </button>
                        </div>
                    </aside>
                    <div class="files-grid-container">
                        <div class="files-grid"></div>
                    </div>
                </div>
            </div>
        `,
        onOpen: (windowEl) => {
            if (!currentPath) currentPath = "/";
            const initialRender = renderFilesGrid(windowEl);

            if (windowEl.dataset.filesInitialized === "1") {
                return initialRender;
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
                    window.showDesktopToast?.(`Saved ${files.length} file(s) locally.`);
                    fileInput.value = "";
                });
            }
            return initialRender;
        },
        onClose: (windowEl) => {
            renderGeneration++;
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
            windowEl.dataset.filesInitialized = "";
        }
    };
})();
