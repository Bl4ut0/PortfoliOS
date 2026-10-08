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

    workspacePrefix(userId = window.state?.currentUserId) {
        return userId === "private" || /^private_[a-zA-Z0-9_-]+$/.test(userId || "") ? "/.workspaces/" + userId : "";
    },

    isSharedPath(path) {
        return ["/apps", "/ROMs", "/etc", "/home"].some(root => path === root || path.startsWith(root + "/"));
    },

    storagePath(path, prefix = this.workspacePrefix()) {
        if (path.startsWith("/.workspaces")) throw new Error("Workspace storage paths are internal.");
        const publicGuest = window.state?.currentUserId === "bl4ut0" && (path === "/home/guest" || path.startsWith("/home/guest/"));
        if (!publicGuest && path.startsWith("/home/") && !path.startsWith("/home/" + (window.state?.currentUserId || "bl4ut0") + "/") && path !== "/home/" + (window.state?.currentUserId || "bl4ut0")) {
            throw new Error("That home belongs to another profile.");
        }
        if (!prefix && (path === '/ROMs' || path.startsWith('/ROMs/'))) return '/.public' + path;
        return prefix && !this.isSharedPath(path) ? prefix + (path === "/" ? "" : path) : path;
    },

    visibleRecord(record, prefix = this.workspacePrefix()) {
        if (!record) return null;
        if (record.path.startsWith('/.public/')) {
            if (prefix) return null;
            return { ...record, path:record.path.slice('/.public'.length), parent:record.parent.slice('/.public'.length) || '/' };
        }
        if (!prefix && (record.path === '/ROMs' || record.path.startsWith('/ROMs/'))) return null;
        if (record.path.startsWith("/.workspaces/")) {
            if (!prefix || !(record.path === prefix || record.path.startsWith(prefix + "/"))) return null;
            const path = record.path.slice(prefix.length) || "/";
            if (path === "/") return null;
            return { ...record, path, parent: record.parent.slice(prefix.length) || "/" };
        }
        const publicGuest = window.state?.currentUserId === "bl4ut0" && (record.path === "/home/guest" || record.path.startsWith("/home/guest/"));
        if (!publicGuest && record.path.startsWith("/home/") && record.path !== "/home/" + (window.state?.currentUserId || "bl4ut0") && !record.path.startsWith("/home/" + (window.state?.currentUserId || "bl4ut0") + "/")) return null;
        return prefix && !this.isSharedPath(record.path) ? null : record;
    },

    normalizePath(path = "/") {
        if (typeof path !== "string" || path.trim() === "") return "/";
        const parts = [];
        path.replace(/\\/g, "/").split("/").forEach((part) => {
            if (!part || part === ".") return;
            if (part === "..") {
                parts.pop();
                return;
            }
            parts.push(part);
        });
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
                    await this.migrateLegacyPrivateWorkspace();
                    await this.resetPublicWorkspace();
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

    async resetPublicWorkspace() {
        // Work directly on physical records so the remembered private user is
        // irrelevant. Never delete private homes, workspaces, or shared caches.
        const tx = this.db.transaction(['files'], 'readwrite');
        const done = this.transactionDone(tx);
        const cursorRequest = tx.objectStore('files').openCursor();
        cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const path = cursor.value.path;
            const publicHome = ['/home/bl4ut0', '/home/guest'].some(root => path === root || path.startsWith(root + '/'));
            const publicRom = path === '/.public' || path.startsWith('/.public/');
            if (publicHome || publicRom || (!path.startsWith('/.') && !this.isSharedPath(path))) cursor.delete();
            cursor.continue();
        };
        await done;
    },

    async cleanupLegacyPaths() {
        const files = await this.getAllFiles();
        if (!files.length) return;

        const transaction = this.db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");

        files.forEach((file) => {
            if (!file || !file.path) return;

            if (file.path === "/DOOM.WAD") {
                store.delete(this.storagePath(file.path));
                console.log("PortfoliOS: Cleaned up legacy visible DOOM.WAD.");
                return;
            }

            const cleanPath = this.normalizePath(file.path);
            const cleanParent = this.normalizePath(file.parent || this.getParentPath(cleanPath));
            const cleanName = file.name || this.getName(cleanPath);

            if (cleanPath !== file.path || cleanParent !== file.parent || cleanName !== file.name) {
                store.put({
                    ...file,
                    path: this.storagePath(cleanPath),
                    parent: this.storagePath(cleanParent),
                    name: cleanName,
                    lastModified: file.lastModified || Date.now()
                });
                if (cleanPath !== file.path) {
                    store.delete(this.storagePath(file.path));
                    console.log(`PortfoliOS: Migrated legacy path ${file.path} -> ${cleanPath}`);
                }
            }
        });

        await this.transactionDone(transaction);
    },

    async migrateProfileWorkspace(fromId, toId) {
        await this.ensureReady();
        await new Promise((resolve, reject) => {
            const tx = this.db.transaction(["files"], "readwrite");
            const store = tx.objectStore("files");
            const request = store.openCursor();
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                const record = cursor.value;
                const home = "/home/" + fromId;
                const workspace = "/.workspaces/" + fromId;
                let copy = null;
                if (record.path === home || record.path.startsWith(home + "/")) {
                    copy = { ...record, path: record.path.replace(home, "/home/" + toId), parent: record.parent.replace(home, "/home/" + toId) };
                } else if (record.path.startsWith(workspace + "/")) {
                    copy = { ...record, path: record.path.replace(workspace, "/.workspaces/" + toId), parent: record.parent.replace(workspace, "/.workspaces/" + toId) };
                } else if (fromId === "private" && !record.path.startsWith("/.") && !this.isSharedPath(record.path)) {
                    copy = { ...record, path: "/.workspaces/" + toId + record.path, parent: "/.workspaces/" + toId + (record.parent === "/" ? "" : record.parent) };
                }
                if (copy) {
                    // The new namespace's preferences are generated from migrated local keys.
                    if (copy.path.endsWith("/settings.json")) { cursor.continue(); return; }
                    const existing = store.get(copy.path);
                    existing.onsuccess = () => { if (!existing.result) store.put(copy); };
                }
                cursor.continue();
            };
        });
    },

    async migrateLegacyPrivateWorkspace() {
        if (window.state?.currentUserId !== "private" || !window.localStorage?.getItem("bl4ut0_private_user_profile") || window.localStorage.getItem("bl4ut0_private_workspace_migrated")) return;
        await this.ensureReady();
        await new Promise((resolve, reject) => {
            const tx = this.db.transaction(["files"], "readwrite");
            const store = tx.objectStore("files");
            const request = store.openCursor();
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                const record = cursor.value;
                if (!record.path.startsWith("/.") && !this.isSharedPath(record.path)) {
                    const copy = { ...record, path: "/.workspaces/private" + record.path, parent: "/.workspaces/private" + (record.parent === "/" ? "" : record.parent) };
                    const existing = store.get(copy.path);
                    existing.onsuccess = () => { if (!existing.result) store.put(copy); };
                }
                cursor.continue();
            };
        });
        window.localStorage.setItem("bl4ut0_private_workspace_migrated", "1");
    },

    async ensureDefaultFiles() {
        if (!await this.readFile("/documents")) {
            await this.writeFile("/documents", "documents", "/", null, 0, "directory", true, { silent: true });
        }

        if (!await this.readFile("/music")) {
            await this.writeFile("/music", "music", "/", null, 0, "directory", true, { silent: true });
        }

        if (!await this.readFile("/Pictures")) {
            await this.writeFile("/Pictures", "Pictures", "/", null, 0, "directory", true, { silent: true });
        }

        if (!await this.readFile("/Downloads")) {
            await this.writeFile("/Downloads", "Downloads", "/", null, 0, "directory", true, { silent: true });
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
            const prefix = this.workspacePrefix();
            const request = store.get(this.storagePath(cleanPath, prefix));
            request.onsuccess = () => resolve(this.visibleRecord(request.result, prefix));
            request.onerror = () => reject(request.error || new Error(`Failed to read ${cleanPath}`));
        });
    },

    async writeFile(path, name, parent, data, size, type, isDirectory = false, options = {}) {
        const writingUser = window.state?.currentUserId;
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

        if (window.state?.currentUserId !== writingUser) throw new Error("Profile changed before the file could be saved. Please retry in the intended workspace.");
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
        const prefix = this.workspacePrefix();
        store.put({ ...record, path: this.storagePath(cleanPath, prefix), parent: this.storagePath(cleanParent, prefix) });
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
        store.delete(this.storagePath(cleanPath));
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
        const storedPath = this.storagePath(cleanPath);

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
                if (item.path === storedPath || item.path.startsWith(`${storedPath}/`)) {
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
        const prefix = this.workspacePrefix();
        const storedParent = this.storagePath(cleanParent, prefix);

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

            if (cleanParent !== "/" && store.indexNames.contains("parent")) {
                const index = store.index("parent");
                const request = index.openCursor(IDBKeyRange.only(storedParent));
                request.onsuccess = () => {
                    const cursor = request.result;
                    if (cursor) {
                        const visible = this.visibleRecord(cursor.value, prefix);
                        if (visible) files.push(visible);
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
                    if (cursor.value.parent === storedParent || (cleanParent === "/" && cursor.value.parent === "/")) {
                        const visible = this.visibleRecord(cursor.value, prefix);
                    if (visible) files.push(visible);
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
        const prefix = this.workspacePrefix();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const files = [];
            const request = store.openCursor();

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const visible = this.visibleRecord(cursor.value, prefix);
                    if (visible) files.push(visible);
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
