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

    // Friendly labels only: canonical paths and user-defined names stay unchanged.
    getDisplayName(record) {
        const labels = {
            "/apps": "Apps", "/documents": "Documents", "/Desktop": "Desktop",
            "/music": "Music", "/Pictures": "Pictures", "/Downloads": "Downloads",
            "/ROMs": "ROMs", "/Saved Games": "Saved Games", "/etc": "Etc", "/home": "Home"
        };
        return (record.isDirectory && labels[this.normalizePath(record.path)]) || record.name || this.getName(record.path);
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

        if (!await this.readFile('/Desktop')) {
            await this.writeFile('/Desktop', 'Desktop', '/', null, 0, 'directory', true, {silent:true});
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

    assertProfile(userId) {
        if (window.state?.currentUserId !== userId) throw new Error("Profile changed during the filesystem operation. Please retry in the intended workspace.");
    },

    async readFile(path) {
        const readingUser = window.state?.currentUserId;
        await this.ensureReady();
        this.assertProfile(readingUser);
        const cleanPath = this.normalizePath(path);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const prefix = this.workspacePrefix();
            const request = store.get(this.storagePath(cleanPath, prefix));
            request.onsuccess = () => {
                try { this.assertProfile(readingUser); resolve(this.visibleRecord(request.result, prefix)); }
                catch (error) { reject(error); }
            };
            request.onerror = () => reject(request.error || new Error(`Failed to read ${cleanPath}`));
        });
    },

    async writeFile(path, name, parent, data, size, type, isDirectory = false, options = {}) {
        const writingUser = window.state?.currentUserId;
        await this.ensureReady();
        this.assertProfile(writingUser);

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
            revision: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
            metadata: options.metadata || {}
        };

        const transaction = this.db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");
        const prefix = this.workspacePrefix();
        const done = this.transactionDone(transaction);
        const storedPath=this.storagePath(cleanPath,prefix);
        const put=()=>store.put({...record,path:storedPath,parent:this.storagePath(cleanParent,prefix)});
        let conflict;
        if(options.expectedRecord || options.expectedAbsent) {
            const expected=options.expectedRecord, request=store.get(storedPath);
            request.onsuccess=()=>{
                const current=request.result;
                const matches=options.expectedAbsent ? !current : current && (expected.revision ? current.revision===expected.revision : current.lastModified===expected.lastModified && current.size===expected.size && current.type===expected.type && (typeof expected.data!=='string' || current.data===expected.data));
                if(!matches) {conflict=new Error('The file changed during scanning. Retry backup to use the latest version.');transaction.abort();return;}
                try {this.assertProfile(writingUser);put();}catch(error){conflict=error;transaction.abort();}
            };
            request.onerror=()=>transaction.abort();
        } else put();
        try {await done;}catch(error){throw conflict || error;}
        this.assertProfile(writingUser);

        if (!options.silent && window.EventBus) {
            window.EventBus.emit("fs:changed", { action: "write", path: cleanPath, parent: cleanParent });
        }

        return record;
    },

    recordSyncDeletions(store, entries) {
        if(!entries.length || !window.PrivateSessions?.required())return;
        const path=this.storagePath('/.sync-deletions.json'), request=store.get(path);
        request.onsuccess=()=>{
            let data=request.result?.data ? JSON.parse(request.result.data) : {};
            for(const entry of entries) if(!entry.path.split('/').some(part=>part.startsWith('.')))data[entry.path]={revision:entry.revision,at:Date.now()};
            const text=JSON.stringify(data);
            store.put({path,parent:this.storagePath('/'),name:'.sync-deletions.json',data:text,size:text.length,type:'application/json',isDirectory:false,lastModified:Date.now(),revision:crypto.randomUUID(),metadata:{sync:false}});
        };
    },

    async deleteFile(path, options = {}) {
        const deletingUser = window.state?.currentUserId;
        await this.ensureReady();
        this.assertProfile(deletingUser);

        const cleanPath = this.normalizePath(path);
        if (cleanPath === "/") {
            throw new Error("Cannot delete filesystem root");
        }

        const record = await this.readFile(cleanPath);
        this.assertProfile(deletingUser);
        const parent = record ? record.parent : this.getParentPath(cleanPath);

        const transaction = this.db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");
        const done=this.transactionDone(transaction), storedPath=this.storagePath(cleanPath);
        let conflict;
        const request=store.get(storedPath);
        request.onsuccess=()=>{
            const current=request.result;
            if(options.expectedRecord && (!current || current.revision!==options.expectedRecord.revision)){conflict=new Error('The file changed before deletion. Retry sync.');transaction.abort();return;}
            if(current && options.trackSyncDeletion!==false)this.recordSyncDeletions(store,[{path:cleanPath,revision:current.revision}]);
            store.delete(storedPath);
        };
        try{await done;}catch(error){throw conflict || error;}
        this.assertProfile(deletingUser);

        if (!options.silent && window.EventBus) {
            window.EventBus.emit("fs:changed", { action: "delete", path: cleanPath, parent });
        }
    },

    async deleteFileRecursive(path, options = {}) {
        const deletingUser = window.state?.currentUserId;
        await this.ensureReady();
        this.assertProfile(deletingUser);

        const cleanPath = this.normalizePath(path);
        if (cleanPath === "/") {
            throw new Error("Cannot delete filesystem root");
        }

        const record = await this.readFile(cleanPath);
        this.assertProfile(deletingUser);
        const parent = record ? record.parent : this.getParentPath(cleanPath);
        const storedPath = this.storagePath(cleanPath);

        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["files"], "readwrite");
            const store = transaction.objectStore("files");
            const request = store.openCursor(), deleted=[];

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error(`Failed to delete ${cleanPath}`));
            transaction.onabort = () => reject(transaction.error || new Error(`Delete aborted for ${cleanPath}`));

            request.onsuccess = () => {
                if (window.state?.currentUserId !== deletingUser) { transaction.abort(); return; }
                const cursor = request.result;
                if (!cursor) {if(options.trackSyncDeletion!==false)this.recordSyncDeletions(store,deleted);return;}

                const item = cursor.value;
                if (item.path === storedPath || item.path.startsWith(`${storedPath}/`)) {
                    const visible=this.visibleRecord(item);if(visible)deleted.push({path:visible.path,revision:item.revision});
                    cursor.delete();
                }
                cursor.continue();
            };

            request.onerror = () => reject(request.error || new Error(`Failed to scan ${cleanPath}`));
        });

        this.assertProfile(deletingUser);
        if (!options.silent && window.EventBus) {
            window.EventBus.emit("fs:changed", { action: "deleteRecursive", path: cleanPath, parent });
        }
    },

    async readDir(parentDir = "/") {
        const readingUser = window.state?.currentUserId;
        await this.ensureReady();
        this.assertProfile(readingUser);

        const cleanParent = this.normalizePath(parentDir);
        const prefix = this.workspacePrefix();
        const storedParent = this.storagePath(cleanParent, prefix);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const files = [];
            const finish = () => {
                try { this.assertProfile(readingUser); } catch (error) { reject(error); return; }
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
                try { this.assertProfile(readingUser); } catch (error) { reject(error); return; }
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
                try { this.assertProfile(readingUser); } catch (error) { reject(error); return; }
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
        const readingUser = window.state?.currentUserId;
        await this.ensureReady();
        this.assertProfile(readingUser);
        const prefix = this.workspacePrefix();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const files = [];
            const request = store.openCursor();

            request.onsuccess = () => {
                try { this.assertProfile(readingUser); } catch (error) { reject(error); return; }
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

    canBrowsePath(path) {
        if (!path || path === "/") return true;
        const parts = path.split("/").filter(Boolean);
        if (parts.some((p) => p.startsWith("."))) return false;
        return !this.isSharedPath(path) || ["/documents", "/Pictures", "/Downloads", "/music", "/Saved Games"].some(root => path === root || path.startsWith(root + "/"));
    },

    async showFileDialog({mode='open', title=mode==='save'?'Save As':'Open File', folder='/documents', defaultName='untitled', types=[], acceptLabel=mode==='save'?'Save':'Open', signal}={}) {
        if(typeof document==='undefined') return null;
        const owner=window.state?.currentUserId;await this.ensureReady();this.assertProfile(owner);
        if(signal?.aborted) return null;
        const validName=name=>!!name && !name.startsWith('.') && !/[\\/:*?"<>|\u0000-\u001f]/.test(name);
        return new Promise(resolve=>{
            let alive=true, revision=0, currentFolder=this.canBrowsePath(folder)?this.normalizePath(folder):'/documents', selected=null, replacement=null;
            const dialog=document.createElement('dialog');dialog.className='systemfs-dialog systemfs-browser';dialog.setAttribute('aria-label',title);
            const esc=window.escapeHtml;
            dialog.innerHTML=`<header class="systemfs-dialog-header"><h2>${esc(title)}</h2><button type="button" data-action="cancel" aria-label="Close">×</button></header>
              <nav class="systemfs-dialog-nav" aria-label="Folder navigation"><button type="button" data-action="up" aria-label="Parent folder">↑</button><div class="systemfs-breadcrumbs" data-location></div><input class="systemfs-input systemfs-search" data-search type="search" aria-label="Search current folder" placeholder="Search this folder"></nav>
              <div class="systemfs-browser-body"><aside class="systemfs-places" aria-label="Places">${[['/','Workspace'],['/Desktop','Desktop'],['/documents','Documents'],['/Downloads','Downloads'],['/Pictures','Pictures'],['/music','Music'],['/Saved Games','Saved Games']].map(([path,label])=>`<button type="button" data-folder="${path}"><span aria-hidden="true">${path==='/'?'▣':'▸'}</span>${label}</button>`).join('')}</aside><section class="systemfs-browser-content" aria-label="Folder contents"><div class="systemfs-list-head"><span>Name</span><span>Type</span></div><div class="systemfs-dialog-list" data-list></div><p class="systemfs-item-count" data-count></p></section></div>
              <div class="systemfs-new-folder-row"><input class="systemfs-input" data-new-folder aria-label="New folder name" placeholder="New folder name"><button type="button" data-action="create-folder">New folder</button></div><label class="systemfs-filename-row">File name <input class="systemfs-input" data-filename aria-label="File name" value="${esc(mode==='open'?'':defaultName)}" ${mode==='open'?'readonly':''}></label><div data-device ${mode==='save'?'hidden':''}><label class="systemfs-device-upload">Upload from computer <input type="file" data-upload ${types.length?'accept="'+esc(types.join(','))+'"':''}></label><p data-drop class="systemfs-dropzone">Drop a file from your computer here</p></div><p data-warning role="status"></p><footer class="systemfs-dialog-footer"><span class="systemfs-file-filter">${esc(types.length?types.join(', '):'All files')}</span><button type="button" data-action="cancel">Cancel</button><button type="button" data-action="confirm" class="systemfs-btn-primary">${esc(acceptLabel)}</button></footer>`;
            (document.body.dataset.view==='mobile' ? document.getElementById('mobile-device') || document.body : document.body).append(dialog);
            const find=selector=>dialog.querySelector(selector), warning=find('[data-warning]'), nameInput=find('[data-filename]'), confirm=find('[data-action=confirm]');
            const current=()=>alive && owner===window.state?.currentUserId && !signal?.aborted;
            const close=result=>{if(!alive)return;alive=false;revision++;signal?.removeEventListener('abort',cancel);window.EventBus?.off?.('user:changed',cancel);dialog.close();dialog.remove();resolve(result);};
            const cancel=()=>close(null);
            const assert=()=>{if(!current()){cancel();throw new Error('The workspace changed.');}};
            const action=fn=>async()=>{try{assert();await fn();}catch(error){if(current())warning.textContent=error.message;}};
            async function navigate(target){
                assert();const path=SystemFS.normalizePath(target);if(!SystemFS.canBrowsePath(path))throw new Error('That location is restricted.');
                const token=++revision;currentFolder=path;selected=null;replacement=null;confirm.textContent=acceptLabel;warning.textContent='';const crumbs=find('[data-location]');crumbs.replaceChildren();
                let crumbPath='';for(const part of ['',...path.split('/').filter(Boolean)]){crumbPath=part?crumbPath+'/'+part:'/';if(crumbPath==='//')crumbPath='/';const target=part?SystemFS.normalizePath(crumbPath):'/';crumbPath=target==='/'?'':target;const button=document.createElement('button');button.type='button';button.dataset.folder=target;button.textContent=part?SystemFS.getDisplayName({path:target,name:part,isDirectory:true}):'Workspace';if(target===path)button.setAttribute('aria-current','location');crumbs.append(button);}
                dialog.querySelectorAll('.systemfs-places [data-folder]').forEach(button=>button.setAttribute('aria-current',button.dataset.folder===path?'location':'false'));find('[data-action=up]').disabled=path==='/';find('[data-list]').textContent='Loading…';
                const entries=await SystemFS.readDir(path);assert();if(token!==revision)return;
                const list=find('[data-list]');list.replaceChildren();const query=find('[data-search]').value.trim().toLowerCase();
                entries.filter(e=>!e.name.startsWith('.') && SystemFS.canBrowsePath(e.path) && SystemFS.getDisplayName(e).toLowerCase().includes(query)).sort((a,b)=>Number(b.isDirectory)-Number(a.isDirectory)||a.name.localeCompare(b.name)).forEach(file=>{
                    const button=document.createElement('button');button.type='button';button.className='systemfs-item-btn';const icon=document.createElement('span');icon.className='systemfs-row-icon';icon.setAttribute('aria-hidden','true');icon.textContent=file.isDirectory?'▰':'▤';const label=document.createElement('span');label.className='systemfs-row-name';label.textContent=SystemFS.getDisplayName(file);const kind=document.createElement('span');kind.className='systemfs-row-type';kind.textContent=file.isDirectory?'Folder':file.name.includes('.')?file.name.split('.').pop().toUpperCase()+' file':'File';button.append(icon,label,kind);button.dataset.path=file.path;
                    const match=!types.length||types.some(t=>file.name.toLowerCase().endsWith(t.toLowerCase()));button.disabled=mode==='open'&&!file.isDirectory&&!match;
                    button.addEventListener('click',action(async()=>{if(file.isDirectory){await navigate(file.path);return;}selected=file.path;nameInput.value=file.name;replacement=null;confirm.textContent=acceptLabel;list.querySelectorAll('[aria-pressed]').forEach(e=>e.removeAttribute('aria-pressed'));button.setAttribute('aria-pressed','true');}));
                    if(!file.isDirectory&&mode==='open'&&match)button.addEventListener('dblclick',action(async()=>{selected=file.path;await accept();}));list.append(button);
                });
                find('[data-count]').textContent=list.children.length+' items';if(!list.children.length)list.textContent=query?'No matching files.':'This folder is empty.';
            }
            async function accept(){
                assert();if(mode==='open'){if(!selected)throw new Error('Select a file to open.');const record=await SystemFS.readFile(selected);assert();if(!record||record.isDirectory)throw new Error('That file is no longer available.');close({path:record.path,name:record.name,parent:record.parent,record});return;}
                let name=nameInput.value.trim();if(!validName(name))throw new Error('Enter a filename without slashes or hidden prefixes.');if(types.length&&!types.some(t=>name.toLowerCase().endsWith(t.toLowerCase())))name+=types[0];
                const path=SystemFS.normalizePath(currentFolder+'/'+name);if(!SystemFS.canBrowsePath(path))throw new Error('Choose a workspace location.');
                const existing=await SystemFS.readFile(path);assert();if(existing?.isDirectory)throw new Error('A folder already uses this name.');if(existing&&replacement!==path){replacement=path;warning.textContent='This file exists. Choose Replace to overwrite it.';confirm.textContent='Replace';return;}
                close({path,name,parent:currentFolder,folder:currentFolder});
            }
            function device(file){if(!current()||!file)return;if(types.length&&!types.some(t=>file.name.toLowerCase().endsWith(t.toLowerCase()))){warning.textContent='Choose a supported file type.';return;}close({file});}
            dialog.addEventListener('click',event=>{const place=event.target.closest('[data-folder]');if(place){find('[data-search]').value='';action(()=>navigate(place.dataset.folder))();return;}const type=event.target.closest('[data-action]')?.dataset.action;if(type==='cancel')cancel();else if(type==='root')action(()=>navigate('/'))();else if(type==='up')action(()=>navigate(SystemFS.getParentPath(currentFolder)))();else if(type==='confirm')action(accept)();else if(type==='create-folder')action(async()=>{const name=find('[data-new-folder]').value.trim();if(!validName(name))throw new Error('Enter a folder name without slashes or hidden prefixes.');const path=SystemFS.normalizePath(currentFolder+'/'+name);if(!SystemFS.canBrowsePath(path))throw new Error('Choose a workspace location.');await SystemFS.ensureDirectory(path);assert();find('[data-new-folder]').value='';await navigate(path);})();});
            find('[data-search]').addEventListener('input',action(()=>navigate(currentFolder)));
            nameInput.addEventListener('input',()=>{replacement=null;confirm.textContent=acceptLabel;warning.textContent='';});
            dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});dialog.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target===nameInput){event.preventDefault();action(accept)();}});
            find('[data-upload]').addEventListener('change',event=>device(event.target.files[0]));find('[data-drop]').addEventListener('dragover',event=>event.preventDefault());find('[data-drop]').addEventListener('drop',event=>{event.preventDefault();device(event.dataTransfer?.files[0]);});
            signal?.addEventListener('abort',cancel,{once:true});window.EventBus?.on?.('user:changed',cancel);dialog.showModal();action(()=>navigate(currentFolder))();
        });
    },

    showOpenDialog(options = {}) {
        return this.showFileDialog({ ...options, mode: "open" });
    },

    showSaveDialog(options = {}) {
        return this.showFileDialog({ ...options, mode: "save" });
    },

    clearCache() {
        this.initPromise = this.db ? Promise.resolve(this.db) : null;
    }
};

window.SystemFSNav = {
    showFileDialog: (...args) => window.SystemFS.showFileDialog(...args),
    showOpenDialog: (...args) => window.SystemFS.showOpenDialog(...args),
    showSaveDialog: (...args) => window.SystemFS.showSaveDialog(...args)
};
