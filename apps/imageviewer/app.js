/**
 * PortfoliOS: Simple Image Viewer & Photo Gallery
 * Lightweight, fast image viewer for photos, art, and illustrations.
 */
(function() {
    const APP_ID = "imageviewer";
    const SUPPORTED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp", ".ico"];

    function isImageFile(name = "") {
        const lower = name.toLowerCase();
        return SUPPORTED_EXTS.some(ext => lower.endsWith(ext));
    }

    function formatBytes(bytes = 0) {
        if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    }

    function renderBody() {
        return `
            <div class="imageviewer-shell" data-iv-shell tabindex="0">
                <header class="iv-toolbar" role="toolbar" aria-label="Image actions">
                    <div class="iv-toolbar-group">
                        <button type="button" class="iv-btn" data-iv-action="open" title="Open Image from Workspace">
                            <i class="fa-solid fa-folder-open"></i> Open
                        </button>
                        <button type="button" class="iv-btn" data-iv-action="prev" title="Previous Image (Left Arrow)" disabled>
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <span class="iv-counter" data-iv-counter></span>
                        <button type="button" class="iv-btn" data-iv-action="next" title="Next Image (Right Arrow)" disabled>
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>

                    <div class="iv-toolbar-group">
                        <button type="button" class="iv-btn" data-iv-action="zoom-out" title="Zoom Out (-)">
                            <i class="fa-solid fa-magnifying-glass-minus"></i>
                        </button>
                        <span class="iv-zoom-level" data-iv-zoom-level>Fit</span>
                        <button type="button" class="iv-btn" data-iv-action="zoom-in" title="Zoom In (+)">
                            <i class="fa-solid fa-magnifying-glass-plus"></i>
                        </button>
                        <button type="button" class="iv-btn" data-iv-action="fit" title="Fit to Window">
                            <i class="fa-solid fa-compress"></i> Fit
                        </button>
                        <button type="button" class="iv-btn" data-iv-action="actual" title="Actual Size (100%)">
                            <i class="fa-solid fa-expand"></i> 1:1
                        </button>
                        <button type="button" class="iv-btn" data-iv-action="rotate" title="Rotate 90° clockwise">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                    </div>

                    <div class="iv-toolbar-group">
                        <button type="button" class="iv-btn" data-iv-action="wallpaper" title="Set as Desktop Wallpaper">
                            <i class="fa-solid fa-image"></i> Set Wallpaper
                        </button>
                        <button type="button" class="iv-btn" data-iv-action="photocraft" title="Edit Layers in PhotoCraft">
                            <i class="fa-solid fa-paintbrush"></i> Edit
                        </button>
                        <button type="button" class="iv-btn" data-iv-action="download" title="Download image to device">
                            <i class="fa-solid fa-download"></i>
                        </button>
                    </div>
                </header>

                <main class="iv-viewport" data-iv-viewport role="region" aria-label="Image view">
                    <div class="iv-empty-state" data-iv-empty>
                        <i class="fa-regular fa-image iv-empty-icon" aria-hidden="true"></i>
                        <h3>No Image Open</h3>
                        <p>Select an image from your files or drop a photo from your computer here.</p>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                            <button type="button" class="iv-btn iv-btn-primary" data-iv-action="open">
                                <i class="fa-solid fa-folder-open"></i> Choose Image
                            </button>
                        </div>
                    </div>
                    <div class="iv-canvas-wrapper" data-iv-wrapper style="display: none;">
                        <img class="iv-image" data-iv-img alt="Viewer content" draggable="false" />
                    </div>
                </main>

                <footer class="iv-statusbar">
                    <div class="iv-status-left">
                        <span class="iv-filename" data-iv-name>Ready</span>
                        <span class="iv-dims" data-iv-dims></span>
                    </div>
                    <div class="iv-status-right">
                        <span class="iv-size" data-iv-size></span>
                        <span class="iv-path" data-iv-path></span>
                    </div>
                </footer>
            </div>
        `;
    }

    const instances = new WeakMap();

    class ImageViewerInstance {
        constructor(windowEl) {
            this.windowEl = windowEl;
            this.shell = windowEl.querySelector("[data-iv-shell]");
            this.viewport = windowEl.querySelector("[data-iv-viewport]");
            this.wrapper = windowEl.querySelector("[data-iv-wrapper]");
            this.img = windowEl.querySelector("[data-iv-img]");
            this.emptyState = windowEl.querySelector("[data-iv-empty]");

            this.prevBtn = windowEl.querySelector('[data-iv-action="prev"]');
            this.nextBtn = windowEl.querySelector('[data-iv-action="next"]');
            this.counterEl = windowEl.querySelector("[data-iv-counter]");
            this.zoomLevelEl = windowEl.querySelector("[data-iv-zoom-level]");

            this.nameEl = windowEl.querySelector("[data-iv-name]");
            this.dimsEl = windowEl.querySelector("[data-iv-dims]");
            this.sizeEl = windowEl.querySelector("[data-iv-size]");
            this.pathEl = windowEl.querySelector("[data-iv-path]");

            this.currentRecord = null;
            this.currentPath = null;
            this.currentBlob = null;
            this.currentObjectUrl = null;

            this.siblingImages = [];
            this.currentIndex = -1;

            this.scale = 1.0;
            this.isFit = true;
            this.rotation = 0;
            this.panX = 0;
            this.panY = 0;

            this.isDragging = false;
            this.dragStartX = 0;
            this.dragStartY = 0;
            this.initialPanX = 0;
            this.initialPanY = 0;

            this.bindEvents();
        }

        bindEvents() {
            this.onClick = (e) => {
                const btn = e.target.closest("[data-iv-action]");
                if (!btn || btn.disabled) return;
                const action = btn.dataset.ivAction;

                if (action === "open") this.promptOpen();
                else if (action === "prev") this.navigateSibling(-1);
                else if (action === "next") this.navigateSibling(1);
                else if (action === "zoom-in") this.zoom(1.25);
                else if (action === "zoom-out") this.zoom(0.8);
                else if (action === "fit") this.fitToWindow();
                else if (action === "actual") this.actualSize();
                else if (action === "rotate") this.rotate90();
                else if (action === "wallpaper") this.setAsWallpaper();
                else if (action === "photocraft") this.editInPhotoCraft();
                else if (action === "download") this.download();
            };

            this.onWheel = (e) => {
                if (!this.currentBlob) return;
                e.preventDefault();
                const factor = e.deltaY < 0 ? 1.15 : 0.87;
                this.zoom(factor);
            };

            this.onMouseDown = (e) => {
                if (!this.currentBlob || e.button !== 0) return;
                this.isDragging = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                this.initialPanX = this.panX;
                this.initialPanY = this.panY;
                this.viewport.classList.add("is-dragging");
                e.preventDefault();
            };

            this.onMouseMove = (e) => {
                if (!this.isDragging) return;
                this.panX = this.initialPanX + (e.clientX - this.dragStartX);
                this.panY = this.initialPanY + (e.clientY - this.dragStartY);
                this.applyTransform();
            };

            this.onMouseUp = () => {
                if (this.isDragging) {
                    this.isDragging = false;
                    this.viewport.classList.remove("is-dragging");
                }
            };

            this.onDblClick = (e) => {
                if (!this.currentBlob || e.target.closest(".iv-toolbar")) return;
                if (this.isFit) {
                    this.actualSize();
                } else {
                    this.fitToWindow();
                }
            };

            this.onKeyDown = (e) => {
                if (!this.currentBlob) return;
                if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    this.navigateSibling(-1);
                } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    this.navigateSibling(1);
                } else if (e.key === "+" || e.key === "=") {
                    e.preventDefault();
                    this.zoom(1.25);
                } else if (e.key === "-" || e.key === "_") {
                    e.preventDefault();
                    this.zoom(0.8);
                } else if (e.key === "0") {
                    e.preventDefault();
                    this.fitToWindow();
                } else if (e.key === "1") {
                    e.preventDefault();
                    this.actualSize();
                } else if (e.key === "r" || e.key === "R") {
                    e.preventDefault();
                    this.rotate90();
                }
            };

            this.onDragOver = (e) => {
                e.preventDefault();
            };

            this.onDrop = async (e) => {
                e.preventDefault();
                const file = e.dataTransfer?.files?.[0];
                if (file && isImageFile(file.name)) {
                    await this.loadFile(file);
                }
            };

            this.shell.addEventListener("click", this.onClick);
            this.viewport.addEventListener("wheel", this.onWheel, { passive: false });
            this.viewport.addEventListener("mousedown", this.onMouseDown);
            window.addEventListener("mousemove", this.onMouseMove);
            window.addEventListener("mouseup", this.onMouseUp);
            this.viewport.addEventListener("dblclick", this.onDblClick);
            this.shell.addEventListener("keydown", this.onKeyDown);
            this.viewport.addEventListener("dragover", this.onDragOver);
            this.viewport.addEventListener("drop", this.onDrop);

            // Re-fit on window resize
            this.resizeObserver = new ResizeObserver(() => {
                if (this.isFit && this.currentBlob) {
                    this.fitToWindow();
                }
            });
            this.resizeObserver.observe(this.viewport);
        }

        async loadFromOptions(options = {}) {
            if (options.file instanceof Blob) {
                await this.loadFile(options.file);
            } else if (options.record && (options.record.data instanceof Blob || options.record.data)) {
                await this.loadRecord(options.record, options.path || options.record.path);
            } else if (options.path && window.SystemFS) {
                await this.loadPath(options.path);
            }
        }

        async loadPath(path) {
            try {
                if (!window.SystemFS) throw new Error("SystemFS is unavailable.");
                const record = await window.SystemFS.readFile(path);
                if (!record) throw new Error("File not found: " + path);
                await this.loadRecord(record, path);
            } catch (err) {
                console.error("ImageViewer failed to load path:", err);
                if (window.showDesktopToast) window.showDesktopToast("Could not open image: " + err.message);
            }
        }

        async loadRecord(record, path) {
            this.currentRecord = record;
            this.currentPath = path || record.path;
            const data = record.data;
            const blob = data instanceof Blob ? data : new Blob([data], { type: record.type || "image/jpeg" });
            blob.name = record.name;
            await this.displayBlob(blob, record.name, this.currentPath, record.size);
            if (this.currentPath) {
                await this.scanDirectory(this.currentPath);
            }
        }

        async loadFile(file) {
            this.currentRecord = null;
            this.currentPath = null;
            await this.displayBlob(file, file.name, "Local file", file.size);
        }

        async displayBlob(blob, name, pathString, size) {
            this.currentBlob = blob;
            if (this.currentObjectUrl) {
                try { URL.revokeObjectURL(this.currentObjectUrl); } catch (_) {}
            }
            this.currentObjectUrl = URL.createObjectURL(blob);

            this.emptyState.classList.add("is-hidden");
            this.wrapper.style.display = "flex";

            this.nameEl.textContent = name || "Image";
            this.sizeEl.textContent = formatBytes(size || blob.size);
            this.pathEl.textContent = pathString || "";

            // Update window title bar
            const titleSpan = this.windowEl.querySelector(".window-bar span");
            if (titleSpan) {
                titleSpan.textContent = `Image Viewer - ${name || "Untitled"}`;
            }

            await new Promise((resolve) => {
                this.img.onload = () => {
                    this.dimsEl.textContent = `${this.img.naturalWidth} × ${this.img.naturalHeight} px`;
                    this.rotation = 0;
                    this.fitToWindow();
                    resolve();
                };
                this.img.onerror = () => {
                    this.dimsEl.textContent = "Error loading preview";
                    resolve();
                };
                this.img.src = this.currentObjectUrl;
            });
        }

        async scanDirectory(filePath) {
            if (!window.SystemFS || !filePath) return;
            try {
                const parentPath = window.SystemFS.getParentPath(filePath);
                const files = await window.SystemFS.readDir(parentPath);
                this.siblingImages = (files || [])
                    .filter(f => !f.isDirectory && isImageFile(f.name))
                    .map(f => f.path)
                    .sort((a, b) => a.localeCompare(b));

                this.currentIndex = this.siblingImages.indexOf(filePath);
                this.updateNavButtons();
            } catch (err) {
                this.siblingImages = [];
                this.currentIndex = -1;
                this.updateNavButtons();
            }
        }

        updateNavButtons() {
            const total = this.siblingImages.length;
            if (total <= 1 || this.currentIndex === -1) {
                this.prevBtn.disabled = true;
                this.nextBtn.disabled = true;
                this.counterEl.textContent = "";
            } else {
                this.prevBtn.disabled = this.currentIndex <= 0;
                this.nextBtn.disabled = this.currentIndex >= total - 1;
                this.counterEl.textContent = `${this.currentIndex + 1} / ${total}`;
            }
        }

        async navigateSibling(direction) {
            if (this.siblingImages.length <= 1) return;
            const nextIdx = this.currentIndex + direction;
            if (nextIdx < 0 || nextIdx >= this.siblingImages.length) return;
            const nextPath = this.siblingImages[nextIdx];
            await this.loadPath(nextPath);
        }

        fitToWindow() {
            if (!this.img.naturalWidth || !this.img.naturalHeight) return;
            const vWidth = this.viewport.clientWidth - 32;
            const vHeight = this.viewport.clientHeight - 32;
            if (vWidth <= 0 || vHeight <= 0) return;

            const isRotated90 = (this.rotation % 180 !== 0);
            const w = isRotated90 ? this.img.naturalHeight : this.img.naturalWidth;
            const h = isRotated90 ? this.img.naturalWidth : this.img.naturalHeight;

            const scaleX = vWidth / w;
            const scaleY = vHeight / h;
            this.scale = Math.min(scaleX, scaleY, 1.0); // Don't upscale tiny images beyond 100% on fit
            this.panX = 0;
            this.panY = 0;
            this.isFit = true;
            this.applyTransform();
        }

        actualSize() {
            this.scale = 1.0;
            this.panX = 0;
            this.panY = 0;
            this.isFit = false;
            this.applyTransform();
        }

        zoom(factor) {
            this.scale = Math.max(0.05, Math.min(20.0, this.scale * factor));
            this.isFit = false;
            this.applyTransform();
        }

        rotate90() {
            this.rotation = (this.rotation + 90) % 360;
            if (this.isFit) {
                this.fitToWindow();
            } else {
                this.applyTransform();
            }
        }

        applyTransform() {
            this.wrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale}) rotate(${this.rotation}deg)`;
            const pct = Math.round(this.scale * 100);
            this.zoomLevelEl.textContent = this.isFit ? `Fit (${pct}%)` : `${pct}%`;
        }

        async promptOpen() {
            if (!window.SystemFS) return;
            try {
                const res = await window.SystemFS.showOpenDialog({
                    title: "Open Image",
                    startPath: this.currentPath ? window.SystemFS.getParentPath(this.currentPath) : "/Pictures",
                    types: SUPPORTED_EXTS,
                    acceptLabel: "Open"
                });
                if (!res) return;
                if (res.file) {
                    await this.loadFile(res.file);
                } else if (res.record || res.path) {
                    await this.loadRecord(res.record, res.path);
                }
            } catch (err) {
                console.error("Open image dialog error:", err);
            }
        }

        async setAsWallpaper() {
            if (!this.currentBlob) return;
            if (window.setCustomWallpaper) {
                await window.setCustomWallpaper(this.currentRecord || this.currentBlob, this.currentPath);
            }
        }

        async editInPhotoCraft() {
            if (!this.currentPath) {
                if (window.showDesktopToast) window.showDesktopToast("Save or import image to workspace to edit in PhotoCraft.");
                return;
            }
            if (window.openDesktopWindow) {
                window.openDesktopWindow("photocraft", { path: this.currentPath });
            }
        }

        download() {
            if (!this.currentBlob) return;
            const a = document.createElement("a");
            a.href = this.currentObjectUrl;
            a.download = this.nameEl.textContent || "image";
            document.body.appendChild(a);
            a.click();
            a.remove();
        }

        destroy() {
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            this.shell.removeEventListener("click", this.onClick);
            this.viewport.removeEventListener("wheel", this.onWheel);
            this.viewport.removeEventListener("mousedown", this.onMouseDown);
            window.removeEventListener("mousemove", this.onMouseMove);
            window.removeEventListener("mouseup", this.onMouseUp);
            this.viewport.removeEventListener("dblclick", this.onDblClick);
            this.shell.removeEventListener("keydown", this.onKeyDown);
            this.viewport.removeEventListener("dragover", this.onDragOver);
            this.viewport.removeEventListener("drop", this.onDrop);

            if (this.currentObjectUrl) {
                try { URL.revokeObjectURL(this.currentObjectUrl); } catch (_) {}
                this.currentObjectUrl = null;
            }
        }
    }

    window.appRegistry[APP_ID] = {
        title: "Image Viewer",
        icon: "apps/imageviewer/icon.svg",
        windowClass: "imageviewer-window media-window",
        renderBody,
        onOpen: async (windowEl, options = {}) => {
            const instance = new ImageViewerInstance(windowEl);
            instances.set(windowEl, instance);
            if (options) {
                await instance.loadFromOptions(options);
            }
            windowEl.focus?.();
        },
        onClose: (windowEl) => {
            const instance = instances.get(windowEl);
            if (instance) {
                instance.destroy();
                instances.delete(windowEl);
            }
        }
    };
})();
