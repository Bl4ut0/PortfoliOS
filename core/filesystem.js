/**
 * PortfoliOS: Virtual Filesystem (SystemFS)
 * IndexedDB-backed virtual filesystem shared by system apps and games.
 */
window.SystemFS = {
    db: null,
    initPromise: null,
    dbName: "PortfoliOS_FS",
    dbVersion: 2,
    savedGamesRoot: "/Saved Games",

    normalizePath(path = "/") {
        if (typeof path !== "string" || path.trim() === "") return "/";
        const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
        return parts.length ? `/${parts.join("/")}` : "/";
    },

    getParentPath(path) {
        const cleanPath = this.normalizePath(path);
        if (cleanPath === "/") return "/";
        const lastSlash = cleanPath.lastIndexOf("/");
        return lastSlash <= 0 ? "/" : cleanPath.slice(0, lastSlash);
    },

    getName(path) {
        const cleanPath = this.normalizePath(path);
        if (cleanPath === "/") return "/";
        return cleanPath.slice(cleanPath.lastIndexOf("/") + 1);
    },

    getType(data, type, isDirectory) {
        if (type) return type;
        if (isDirectory) return "directory";
        if (typeof data === "string") return "text/plain";
        if (data && typeof data.type === "string" && data.type) return data.type;
        return "application/octet-stream";
    },

    getSize(data, size) {
        if (Number.isFinite(size)) return size;
        if (typeof data === "string") return data.length;
        if (data && Number.isFinite(data.size)) return data.size;
        if (data && Number.isFinite(data.byteLength)) return data.byteLength;
        return 0;
    },

    transactionDone(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
            transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
        });
    },

    async init() {
        if (this.db) return this.db;
        if (this.initPromise) return this.initPromise;

        if (navigator.storage && navigator.storage.persist) {
            try {
                const persisted = await navigator.storage.persist();
                if (persisted) {
                    console.log("PortfoliOS: Persistent storage granted.");
                } else {
                    console.warn("PortfoliOS: Persistent storage request denied.");
                }
            } catch (err) {
                console.error("Storage persist request failed", err);
            }
        }

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                this.initPromise = null;
                console.error("IndexedDB load failed", request.error);
                reject(request.error || new Error("IndexedDB load failed"));
            };

            request.onblocked = () => {
                console.warn("PortfoliOS: Filesystem upgrade blocked by another open tab.");
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                let store;

                if (!db.objectStoreNames.contains("files")) {
                    store = db.createObjectStore("files", { keyPath: "path" });
                } else {
                    store = event.currentTarget.transaction.objectStore("files");
                }

                if (!store.indexNames.contains("parent")) {
                    store.createIndex("parent", "parent", { unique: false });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                this.db.onversionchange = () => {
                    this.db.close();
                    this.db = null;
                    this.initPromise = null;
                };

                try {
                    await this.cleanupLegacyPaths();
                    await this.ensureDefaultFiles();
                    if (window.EventBus) {
                        window.EventBus.emit("fs:ready", { dbName: this.dbName });
                    }
                } catch (err) {
                    console.error("Filesystem startup maintenance failed", err);
                }

                resolve(this.db);
            };
        });

        return this.initPromise;
    },

    async ensureReady() {
        if (this.db) return this.db;
        return this.init();
    },

    async cleanupLegacyPaths() {
        const files = await this.getAllFiles();
        if (!files.length) return;

        const transaction = this.db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");

        files.forEach((file) => {
            if (!file || !file.path) return;

            if (file.path === "/DOOM.WAD") {
                store.delete(file.path);
                console.log("PortfoliOS: Cleaned up legacy visible DOOM.WAD.");
                return;
            }

            const cleanPath = this.normalizePath(file.path);
            const cleanParent = this.normalizePath(file.parent || this.getParentPath(cleanPath));
            const cleanName = file.name || this.getName(cleanPath);

            if (cleanPath !== file.path || cleanParent !== file.parent || cleanName !== file.name) {
                store.put({
                    ...file,
                    path: cleanPath,
                    parent: cleanParent,
                    name: cleanName,
                    lastModified: file.lastModified || Date.now()
                });
                if (cleanPath !== file.path) {
                    store.delete(file.path);
                    console.log(`PortfoliOS: Migrated legacy path ${file.path} -> ${cleanPath}`);
                }
            }
        });

        await this.transactionDone(transaction);
    },

    async ensureDefaultFiles() {
        if (!await this.readFile("/documents")) {
            await this.writeFile("/documents", "documents", "/", null, 0, "directory", true, { silent: true });
        }

        if (!await this.readFile("/music")) {
            await this.writeFile("/music", "music", "/", null, 0, "directory", true, { silent: true });
        }

        if (!await this.readFile("/ROMs")) {
            await this.writeFile("/ROMs", "ROMs", "/", null, 0, "directory", true, {
                silent: true,
                metadata: { sync: false, kind: "rom-root" }
            });
        }

        if (!await this.readFile(this.savedGamesRoot)) {
            await this.writeFile(this.savedGamesRoot, "Saved Games", "/", null, 0, "directory", true, { silent: true });
        }

        if (!await this.readFile("/documents/welcome.txt")) {
            await this.writeFile(
                "/documents/welcome.txt",
                "welcome.txt",
                "/documents",
                "Welcome to PortfoliOS!\n\nThis is a shared virtual filesystem running locally on your machine via IndexedDB.\n\nYou can drag and drop files from your real computer into the File Explorer to upload them, create new folders, and edit text files.",
                undefined,
                "text/plain",
                false,
                { silent: true }
            );
        }
    },

    async ensureDirectory(path, options = {}) {
        const cleanPath = this.normalizePath(path);
        if (cleanPath === "/") return null;

        const existing = await this.readFile(cleanPath);
        if (existing) {
            if (!existing.isDirectory) {
                throw new Error(`Cannot create directory because a file already exists at ${cleanPath}`);
            }
            return existing;
        }

        const parent = this.getParentPath(cleanPath);
        await this.ensureDirectory(parent, options);
        return this.writeFile(cleanPath, this.getName(cleanPath), parent, null, 0, "directory", true, {
            ...options,
            skipParentEnsure: true
        });
    },

    async ensureSavedGameDirectory(gameName) {
        await this.ensureDirectory(this.savedGamesRoot, { silent: true });
        if (!gameName) return this.savedGamesRoot;

        const cleanName = String(gameName)
            .replace(/[\\/:*?"<>|]/g, "-")
            .replace(/\s+/g, " ")
            .trim();
        const directoryName = cleanName || "Game";
        const path = `${this.savedGamesRoot}/${directoryName}`;
        await this.ensureDirectory(path, { silent: true });
        return path;
    },

    async readFile(path) {
        await this.ensureReady();
        const cleanPath = this.normalizePath(path);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const request = store.get(cleanPath);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error(`Failed to read ${cleanPath}`));
        });
    },

    async writeFile(path, name, parent, data, size, type, isDirectory = false, options = {}) {
        await this.ensureReady();

        const cleanPath = this.normalizePath(path);
        if (cleanPath === "/") {
            throw new Error("Cannot overwrite filesystem root");
        }

        const cleanParent = this.normalizePath(parent || this.getParentPath(cleanPath));
        const cleanName = name || this.getName(cleanPath);

        if (!options.skipParentEnsure) {
            await this.ensureDirectory(cleanParent, { silent: true });
        }

        const record = {
            path: cleanPath,
            name: cleanName,
            parent: cleanParent,
            data,
            isDirectory,
            size: this.getSize(data, size),
            type: this.getType(data, type, isDirectory),
            lastModified: options.lastModified || Date.now(),
            metadata: options.metadata || {}
        };

        const transaction = this.db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");
        store.put(record);
        await this.transactionDone(transaction);

        if (!options.silent && window.EventBus) {
            window.EventBus.emit("fs:changed", { action: "write", path: cleanPath, parent: cleanParent });
        }

        return record;
    },

    async deleteFile(path, options = {}) {
        await this.ensureReady();

        const cleanPath = this.normalizePath(path);
        if (cleanPath === "/") {
            throw new Error("Cannot delete filesystem root");
        }

        const record = await this.readFile(cleanPath);
        const parent = record ? record.parent : this.getParentPath(cleanPath);

        const transaction = this.db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");
        store.delete(cleanPath);
        await this.transactionDone(transaction);

        if (!options.silent && window.EventBus) {
            window.EventBus.emit("fs:changed", { action: "delete", path: cleanPath, parent });
        }
    },

    async deleteFileRecursive(path, options = {}) {
        await this.ensureReady();

        const cleanPath = this.normalizePath(path);
        if (cleanPath === "/") {
            throw new Error("Cannot delete filesystem root");
        }

        const record = await this.readFile(cleanPath);
        const parent = record ? record.parent : this.getParentPath(cleanPath);

        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["files"], "readwrite");
            const store = transaction.objectStore("files");
            const request = store.openCursor();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error(`Failed to delete ${cleanPath}`));
            transaction.onabort = () => reject(transaction.error || new Error(`Delete aborted for ${cleanPath}`));

            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;

                const item = cursor.value;
                if (item.path === cleanPath || item.path.startsWith(`${cleanPath}/`)) {
                    cursor.delete();
                }
                cursor.continue();
            };

            request.onerror = () => reject(request.error || new Error(`Failed to scan ${cleanPath}`));
        });

        if (!options.silent && window.EventBus) {
            window.EventBus.emit("fs:changed", { action: "deleteRecursive", path: cleanPath, parent });
        }
    },

    async readDir(parentDir = "/") {
        await this.ensureReady();

        const cleanParent = this.normalizePath(parentDir);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const files = [];
            const finish = () => {
                files.sort((a, b) => {
                    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
                });
                resolve(files);
            };

            if (store.indexNames.contains("parent")) {
                const index = store.index("parent");
                const request = index.openCursor(IDBKeyRange.only(cleanParent));
                request.onsuccess = () => {
                    const cursor = request.result;
                    if (cursor) {
                        files.push(cursor.value);
                        cursor.continue();
                    } else {
                        finish();
                    }
                };
                request.onerror = () => reject(request.error || new Error(`Failed to list ${cleanParent}`));
                return;
            }

            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    if (cursor.value.parent === cleanParent) {
                        files.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    finish();
                }
            };
            request.onerror = () => reject(request.error || new Error(`Failed to list ${cleanParent}`));
        });
    },

    async getAllFiles() {
        await this.ensureReady();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const files = [];
            const request = store.openCursor();

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    files.push(cursor.value);
                    cursor.continue();
                } else {
                    files.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base" }));
                    resolve(files);
                }
            };

            request.onerror = () => reject(request.error || new Error("Failed to read filesystem records"));
        });
    },

    clearCache() {
        this.initPromise = this.db ? Promise.resolve(this.db) : null;
    }
};
