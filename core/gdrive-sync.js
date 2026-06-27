/**
 * PortfoliOS: Google Drive Cloud Sync (GDriveSync)
 * Handles OAuth2 login, file sync manifest, and bi-directional file synchronization.
 */
window.GDriveSync = {
    token: null,
    parentFolderId: null,
    defaultClientId: "271385155591-4g949illm5c7ke55rf9aupcko53iju53.apps.googleusercontent.com",
    productionOrigin: "https://os.bl4ut0.dev",

    getOAuthStatus() {
        const origin = window.location?.origin || this.productionOrigin;
        return {
            origin,
            productionOrigin: this.productionOrigin,
            returnMode: "Google Identity Services token callback",
            usesRedirectUri: false
        };
    },
    
    async getOrCreateParentFolder(token) {
        if (this.parentFolderId) return this.parentFolderId;

        // Search for existing "PortfoliOS" folder
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='PortfoliOS'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id)`;
        const searchResponse = await fetch(searchUrl, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!searchResponse.ok) {
            const errText = await searchResponse.text();
            throw new Error(`Failed to search parent folder: ${searchResponse.status} - ${errText}`);
        }
        const searchResult = await searchResponse.json();
        if (searchResult.files && searchResult.files.length > 0) {
            this.parentFolderId = searchResult.files[0].id;
            return this.parentFolderId;
        }

        // If not found, create the folder
        const createUrl = "https://www.googleapis.com/drive/v3/files";
        const metadata = {
            name: "PortfoliOS",
            mimeType: "application/vnd.google-apps.folder"
        };
        const createResponse = await fetch(createUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(metadata)
        });
        if (!createResponse.ok) {
            const errText = await createResponse.text();
            throw new Error(`Failed to create parent folder: ${createResponse.status} - ${errText}`);
        }
        const createResult = await createResponse.json();
        this.parentFolderId = createResult.id;
        return this.parentFolderId;
    },
    
    loadGsiLibrary() {
        if (window.google) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.id = "google-gsi-client";
            script.src = "https://accounts.google.com/gsi/client";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Google Identity Services library"));
            document.head.appendChild(script);
        });
    },
    
    login(clientId) {
        return new Promise((resolve, reject) => {
            if (!clientId) return reject(new Error("Google Client ID is required."));
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: "https://www.googleapis.com/auth/drive.file",
                include_granted_scopes: true,
                callback: (response) => {
                    if (response.error) {
                        reject(response);
                    } else {
                        this.token = response.access_token;
                        if (window.Storage) {
                            window.Storage.local.set("bl4ut0_gdrive_token", this.token);
                            window.Storage.local.set("bl4ut0_gdrive_token_expiry", String(Date.now() + (response.expires_in * 1000)));
                            window.Storage.local.set("bl4ut0_gdrive_client_id", clientId);
                        }
                        if (window.state) {
                            window.state.gdriveConnected = true;
                        }
                        resolve(this.token);
                    }
                }
            });
            client.requestAccessToken({ prompt: "consent" });
        });
    },
    
    getToken() {
        if (!window.Storage) return null;
        const token = window.Storage.local.get("bl4ut0_gdrive_token");
        const expiry = window.Storage.local.get("bl4ut0_gdrive_token_expiry");
        if (token && expiry && Date.now() < Number(expiry)) {
            this.token = token;
            if (window.state) {
                window.state.gdriveConnected = true;
            }
            return token;
        }
        if (window.state) {
            window.state.gdriveConnected = false;
        }
        return null;
    },
    
    logout() {
        this.token = null;
        this.parentFolderId = null;
        if (window.Storage) {
            window.Storage.local.remove("bl4ut0_gdrive_token");
            window.Storage.local.remove("bl4ut0_gdrive_token_expiry");
            window.Storage.local.remove("bl4ut0_sync_manifest");
            window.Storage.local.remove("bl4ut0_last_sync_time");
        }
        if (window.state) {
            window.state.gdriveConnected = false;
        }
    },
    
    async fetchRemoteFiles() {
        const token = this.token || this.getToken();
        if (!token) throw new Error("Not authenticated with Google Drive");
        const parentFolderId = await this.getOrCreateParentFolder(token);
        const url = `https://www.googleapis.com/drive/v3/files?q='${parentFolderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,modifiedTime,appProperties)&pageSize=1000`;
        const response = await fetch(url, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Google Drive API error: ${response.status} - ${errText}`);
        }
        const result = await response.json();
        return (result.files || []).filter(f => f.appProperties && f.appProperties.path).map(f => {
            let path = f.appProperties.path;
            if (!path.startsWith("/")) path = "/" + path;
            if (path.endsWith("/") && path !== "/") path = path.slice(0, -1);
            f.appProperties.path = path;
            return f;
        });
    },
    
    async downloadFile(fileId) {
        const token = this.token || this.getToken();
        if (!token) throw new Error("Not authenticated");
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const response = await fetch(url, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Download failed: ${response.status} - ${errText}`);
        }
        return await response.blob();
    },
    
    async uploadFile(path, name, mimeType, data) {
        const token = this.token || this.getToken();
        if (!token) throw new Error("Not authenticated");
 
        const parentFolderId = await this.getOrCreateParentFolder(token);

        const metadata = {
            name: name,
            mimeType: mimeType,
            parents: [parentFolderId],
            appProperties: { path: path }
        };

        const boundary = "foo_bar_baz_boundary";
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--\r\n`;

        let contentBlob = data;
        if (!(contentBlob instanceof Blob)) {
            contentBlob = new Blob([contentBlob || ""], { type: mimeType });
        }

        const metadataBlob = new Blob([
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            `Content-Type: ${mimeType}\r\n\r\n`
        ], { type: "text/plain" });

        const endBlob = new Blob([closeDelimiter], { type: "text/plain" });
        const bodyBlob = new Blob([metadataBlob, contentBlob, endBlob], { type: `multipart/related; boundary=${boundary}` });

        const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": `multipart/related; boundary=${boundary}`
            },
            body: bodyBlob
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Upload failed: ${response.status} - ${errText}`);
        }
        return await response.json();
    },
    
    async createRemoteFolder(path, name) {
        const token = this.token || this.getToken();
        if (!token) throw new Error("Not authenticated");
 
        const parentFolderId = await this.getOrCreateParentFolder(token);

        const metadata = {
            name: name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentFolderId],
            appProperties: { path: path }
        };

        const url = "https://www.googleapis.com/drive/v3/files";
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Folder creation failed: ${response.status} - ${errText}`);
        }
        return await response.json();
    },
    
    async updateFile(fileId, mimeType, data) {
        const token = this.token || this.getToken();
        if (!token) throw new Error("Not authenticated");

        let contentBlob = data;
        if (!(contentBlob instanceof Blob)) {
            contentBlob = new Blob([contentBlob || ""], { type: mimeType });
        }

        const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": mimeType
            },
            body: contentBlob
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Update failed: ${response.status} - ${errText}`);
        }
        return await response.json();
    },
    
    async deleteFile(fileId) {
        const token = this.token || this.getToken();
        if (!token) throw new Error("Not authenticated");

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
        const response = await fetch(url, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok && response.status !== 404) {
            const errText = await response.text();
            throw new Error(`Delete failed: ${response.status} - ${errText}`);
        }
    },
    
    async sync(onProgress) {
        const remoteFiles = await this.fetchRemoteFiles();
        const localFiles = await window.SystemFS.getAllFiles();

        const remoteMap = new Map();
        remoteFiles.forEach(f => remoteMap.set(f.appProperties.path, f));

        const localMap = new Map();
        localFiles.forEach(f => localMap.set(f.path, f));

        const allPaths = new Set([...remoteMap.keys(), ...localMap.keys()]);
        const sortedPaths = Array.from(allPaths)
            .filter(p => {
                if (p === "/ROMs" || p.startsWith("/ROMs/")) return false;
                const parts = p.split("/");
                return !parts.some(part => part.startsWith("."));
            })
            .sort();
        let processed = 0;
        const total = sortedPaths.length;

        const manifestStr = window.Storage ? window.Storage.local.get("bl4ut0_sync_manifest") : null;
        const lastSyncTime = window.Storage ? window.Storage.local.get("bl4ut0_last_sync_time") : null;
        const isFirstSync = !manifestStr || !lastSyncTime;
        const manifest = new Set(JSON.parse(manifestStr || "[]"));

        const getParentPath = (p) => {
            const parts = p.split("/");
            parts.pop();
            return parts.join("/") || "/";
        };

        for (const path of sortedPaths) {
            const local = localMap.get(path);
            const remote = remoteMap.get(path);

            if (onProgress) onProgress(processed, total, path);

            try {
                if (local && !remote) {
                    if (isFirstSync || !manifest.has(path)) {
                        if (local.isDirectory) {
                            await this.createRemoteFolder(path, local.name);
                        } else {
                            await this.uploadFile(path, local.name, local.type, local.data);
                        }
                    } else {
                        if (local.isDirectory) {
                            await window.SystemFS.deleteFileRecursive(path);
                        } else {
                            await window.SystemFS.deleteFile(path);
                        }
                    }
                } else if (remote && !local) {
                    if (isFirstSync || !manifest.has(path)) {
                        if (remote.mimeType === "application/vnd.google-apps.folder") {
                            await window.SystemFS.writeFile(path, remote.name, getParentPath(path), null, 0, "directory", true);
                        } else {
                            const fileBlob = await this.downloadFile(remote.id);
                            await window.SystemFS.writeFile(path, remote.name, getParentPath(path), fileBlob, fileBlob.size, remote.mimeType, false);
                        }
                    } else {
                        await this.deleteFile(remote.id);
                    }
                } else if (local && remote) {
                    if (!local.isDirectory) {
                        const localTime = local.lastModified;
                        const remoteTime = new Date(remote.modifiedTime).getTime();

                        if (localTime > remoteTime + 2000) {
                            await this.updateFile(remote.id, local.type, local.data);
                        } else if (remoteTime > localTime + 2000) {
                            const fileBlob = await this.downloadFile(remote.id);
                            await window.SystemFS.writeFile(path, remote.name, getParentPath(path), fileBlob, fileBlob.size, remote.mimeType, false);
                        }
                    }
                }
            } catch (err) {
                console.error(`Failed to sync ${path}:`, err);
            }

            processed++;
        }

        const finalLocalFiles = await window.SystemFS.getAllFiles();
        const finalPaths = finalLocalFiles.map(f => f.path);
        
        if (window.Storage) {
            window.Storage.local.set("bl4ut0_sync_manifest", JSON.stringify(finalPaths));
            window.Storage.local.set("bl4ut0_last_sync_time", String(Date.now()));
        }

        if (onProgress) onProgress(total, total, "Complete");
        
        if (window.EventBus) {
            window.EventBus.emit("fs:changed", { action: "sync", paths: finalPaths });
        }
    }
};
