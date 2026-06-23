/**
 * PortfoliOS: Virtual Filesystem (SystemFS)
 * IndexedDB-backed virtual file system with support for directory index and file event emission.
 */
window.SystemFS = {
    db: null,
    
    async init() {
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
        
        return new Promise((resolve, reject) => {
            // Version upgraded to 2 to support index creation
            const request = indexedDB.open("PortfoliOS_FS", 2);
            
            request.onerror = (e) => {
                console.error("IndexedDB load failed", e);
                reject(e);
            };
            
            request.onsuccess = async (e) => {
                this.db = e.target.result;
                
                // Clean up legacy duplicate/invalid paths
                try {
                    const allFiles = await this.getAllFiles();
                    const transaction = this.db.transaction(["files"], "readwrite");
                    const store = transaction.objectStore("files");
                    for (const file of allFiles) {
                        if (!file.path || !file.path.startsWith("/") || (file.path.endsWith("/") && file.path !== "/")) {
                            store.delete(file.path);
                            console.log(`PortfoliOS: Cleaned up legacy path: ${file.path}`);
                        } else if (file.path === "/DOOM.WAD") {
                            store.delete(file.path);
                            console.log("PortfoliOS: Cleaned up legacy visible DOOM.WAD.");
                        }
                    }
                } catch (err) {
                    console.error("Database path cleanup failed", err);
                }

                try {
                    const rootItems = await this.readDir("/");
                    if (rootItems.length === 0) {
                        // Seed default directories
                        await this.writeFile("/documents", "documents", "/", null, 0, "directory", true);
                        await this.writeFile("/music", "music", "/", null, 0, "directory", true);
                        await this.writeFile("/documents/welcome.txt", "welcome.txt", "/documents", "Welcome to PortfoliOS!\n\nThis is a shared virtual filesystem running locally on your machine via IndexedDB.\n\nYou can drag and drop files from your real computer into the File Explorer to upload them, create new folders, and edit text files.", 0, "text/plain", false);
                    }
                } catch (err) {
                    console.error("Filesystem seeding failed", err);
                }
                resolve(this.db);
            };
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                let store;
                if (!db.objectStoreNames.contains("files")) {
                    store = db.createObjectStore("files", { keyPath: "path" });
                } else {
                    store = e.currentTarget.transaction.objectStore("files");
                }
                
                // Create index on parent field for O(1) directory listings
                if (!store.indexNames.contains("parent")) {
                    store.createIndex("parent", "parent", { unique: false });
                }
            };
        });
    },
    
    readFile(path) {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve(null);
            const transaction = this.db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const request = store.get(path);
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    },
    
    writeFile(path, name, parent, data, size, type, isDirectory = false) {
        let cleanPath = path;
        let cleanParent = parent;
        if (cleanPath && !cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;
        if (cleanPath && cleanPath.endsWith("/") && cleanPath !== "/") cleanPath = cleanPath.slice(0, -1);
        if (cleanParent && !cleanParent.startsWith("/")) cleanParent = "/" + cleanParent;
        if (cleanParent && cleanParent.endsWith("/") && cleanParent !== "/") cleanParent = cleanParent.slice(0, -1);

        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Database not initialized"));
            const transaction = this.db.transaction(["files"], "readwrite");
            const store = transaction.objectStore("files");
            const record = {
                path: cleanPath,
                name,
                parent: cleanParent,
                data,
                isDirectory,
                size: size !== undefined ? size : (data ? (typeof data === "string" ? data.length : data.size || 0) : 0),
                type: type || (isDirectory ? "directory" : (typeof data === "string" ? "text/plain" : data.type || "application/octet-stream")),
                lastModified: Date.now()
            };
            const request = store.put(record);
            request.onsuccess = () => {
                if (window.EventBus) {
                    window.EventBus.emit("fs:changed", { action: "write", path: cleanPath, parent: cleanParent });
                }
                resolve(record);
            };
            request.onerror = (e) => reject(e);
        });
    },
    
    deleteFile(path) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Database not initialized"));
            
            // Get record first to determine parent for event emission
            this.readFile(path).then(record => {
                const parent = record ? record.parent : "/";
                const transaction = this.db.transaction(["files"], "readwrite");
                const store = transaction.objectStore("files");
                const request = store.delete(path);
                request.onsuccess = () => {
                    if (window.EventBus) {
                        window.EventBus.emit("fs:changed", { action: "delete", path, parent });
                    }
                    resolve();
                };
                request.onerror = (e) => reject(e);
            }).catch(reject);
        });
    },
    
    deleteFileRecursive(path) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Database not initialized"));
            
            this.readFile(path).then(record => {
                const parent = record ? record.parent : "/";
                const transaction = this.db.transaction(["files"], "readwrite");
                const store = transaction.objectStore("files");
                
                store.delete(path);

                const request = store.openCursor();
                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const rec = cursor.value;
                        if (rec.path.startsWith(path + "/")) {
                            cursor.delete();
                        }
                        cursor.continue();
                    } else {
                        if (window.EventBus) {
                            window.EventBus.emit("fs:changed", { action: "deleteRecursive", path, parent });
                        }
                        resolve();
                    }
                };
                request.onerror = (e) => reject(e);
            }).catch(reject);
        });
    },
    
    readDir(parentDir) {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve([]);
            const transaction = this.db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const files = [];
            
            // Check if index exists for fast query
            if (store.indexNames.contains("parent")) {
                const index = store.index = store.index("parent");
                const request = index.openCursor(IDBKeyRange.only(parentDir));
                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        files.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(files);
                    }
                };
                request.onerror = (e) => reject(e);
            } else {
                // Fallback to cursor scan if index not created yet
                const request = store.openCursor();
                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const record = cursor.value;
                        if (record.parent === parentDir) {
                            files.push(record);
                        }
                        cursor.continue();
                    } else {
                        resolve(files);
                    }
                };
                request.onerror = (e) => reject(e);
            }
        });
    },
    
    getAllFiles() {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve([]);
            const transaction = this.db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const files = [];
            const request = store.openCursor();
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    files.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(files);
                }
            };
            request.onerror = (e) => reject(e);
        });
    }
};
