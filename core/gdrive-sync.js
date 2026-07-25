/**
 * PortfoliOS: Google Drive Cloud Sync (GDriveSync)
 * Handles OAuth2 login, file sync manifest, and bi-directional file synchronization.
 */
window.GDriveSync = {
    token: null,
    tokenExpiresAt: 0,
    parentFolderId: null,
    rootFolderId: null,
    scopeFolderIds: {},
    googleProfile: null,
    defaultClientId: "271385155591-4g949illm5c7ke55rf9aupcko53iju53.apps.googleusercontent.com",
    productionOrigin: "https://os.bl4ut0.dev",
    rootFolderName: "PortfoliOS",
    scopes: "openid email profile https://www.googleapis.com/auth/drive.file",
    authFileName: "google-drive.json",

    getAuthRecordPath(userId = this.getCurrentSyncScope().userId) {
        return `/home/${userId}/.auth/${this.authFileName}`;
    },

    async readAuthRecord() {
        if (!window.SystemFS) return null;
        const record = await window.SystemFS.readFile(this.getAuthRecordPath());
        if (!record?.data) return null;
        const text = window.readFilesystemRecordText
            ? await window.readFilesystemRecordText(record)
            : (record.data instanceof Blob ? await record.data.text() : String(record.data));
        try {
            const parsed = JSON.parse(text);
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch (error) {
            console.warn("PortfoliOS: Cloud auth record could not be parsed.", error);
            return null;
        }
    },

    async persistAuthRecord() {
        if (!window.SystemFS || !this.token) return;
        const scope = this.getCurrentSyncScope();
        const authDir = `/home/${scope.userId}/.auth`;
        const record = {
            provider: "google-drive",
            accessToken: this.token,
            expiresAt: this.tokenExpiresAt,
            clientId: (window.Storage?.local.get("bl4ut0_gdrive_client_id") || this.defaultClientId),
            profile: this.googleProfile || this.getSavedGoogleProfile(),
            scopeId: scope.id,
            updatedAt: Date.now()
        };
        const json = JSON.stringify(record, null, 2);
        await window.SystemFS.ensureDirectory(authDir, {
            silent: true,
            metadata: { sync: false, kind: "auth-directory" }
        });
        await window.SystemFS.writeFile(
            this.getAuthRecordPath(scope.userId),
            this.authFileName,
            authDir,
            json,
            json.length,
            "application/json",
            false,
            { silent: true, metadata: { sync: false, kind: "oauth-session" } }
        );
    },

    async persistReconnectRecord(reason) {
        if (!window.SystemFS) return;
        const scope = this.getCurrentSyncScope();
        const authDir = `/home/${scope.userId}/.auth`;
        const record = {
            provider: "google-drive",
            requiresReconnect: true,
            reason,
            clientId: window.Storage?.local.get("bl4ut0_gdrive_client_id") || this.defaultClientId,
            profile: this.googleProfile || this.getSavedGoogleProfile(),
            scopeId: scope.id,
            updatedAt: Date.now()
        };
        const json = JSON.stringify(record, null, 2);
        await window.SystemFS.ensureDirectory(authDir, {
            silent: true,
            metadata: { sync: false, kind: "auth-directory" }
        });
        await window.SystemFS.writeFile(
            this.getAuthRecordPath(scope.userId),
            this.authFileName,
            authDir,
            json,
            json.length,
            "application/json",
            false,
            { silent: true, metadata: { sync: false, kind: "oauth-session" } }
        );
    },

    emitAuthChanged(status, detail = {}) {
        if (window.EventBus) {
            window.EventBus.emit("gdrive:auth-changed", {
                status,
                profile: this.googleProfile,
                expiresAt: this.tokenExpiresAt,
                ...detail
            });
        }
    },

    clearBrowserSession() {
        this.token = null;
        this.tokenExpiresAt = 0;
        this.parentFolderId = null;
        this.rootFolderId = null;
        this.scopeFolderIds = {};
        if (window.Storage) {
            window.Storage.local.remove("bl4ut0_gdrive_token");
            window.Storage.local.remove("bl4ut0_gdrive_token_expiry");
        }
        if (window.state) window.state.gdriveConnected = false;
    },

    async restoreSession({ promptOnInvalid = true } = {}) {
        let record = null;
        try {
            record = await this.readAuthRecord();
        } catch (error) {
            console.warn("PortfoliOS: SystemFS cloud session lookup failed.", error);
        }

        // Migrate the previous browser-only session into the user's SystemFS.
        if (!record && window.Storage) {
            const legacyToken = window.Storage.local.get("bl4ut0_gdrive_token");
            const legacyExpiry = Number(window.Storage.local.get("bl4ut0_gdrive_token_expiry") || 0);
            if (legacyToken) {
                record = {
                    accessToken: legacyToken,
                    expiresAt: legacyExpiry,
                    clientId: window.Storage.local.get("bl4ut0_gdrive_client_id") || this.defaultClientId,
                    profile: this.getSavedGoogleProfile(),
                    migrated: true
                };
            }
        }

        if (record?.requiresReconnect) {
            this.googleProfile = record.profile || this.getSavedGoogleProfile();
            this.clearBrowserSession();
            this.emitAuthChanged("invalid", { reason: record.reason });
            if (promptOnInvalid) this.showReconnectPrompt(record.reason || "Google Drive needs you to sign in again.");
            return { status: "invalid" };
        }

        if (!record?.accessToken) {
            this.clearBrowserSession();
            this.emitAuthChanged("disconnected");
            return { status: "disconnected" };
        }

        const expiresAt = Number(record.expiresAt || 0);
        if (!expiresAt || Date.now() >= expiresAt) {
            this.googleProfile = record.profile || this.getSavedGoogleProfile();
            this.clearBrowserSession();
            await this.persistReconnectRecord("Your Google Drive session expired.");
            this.emitAuthChanged("expired", { reason: "Your Google Drive session expired." });
            if (promptOnInvalid) this.showReconnectPrompt("Your Google Drive session expired.");
            return { status: "expired" };
        }

        this.token = record.accessToken;
        this.tokenExpiresAt = expiresAt;
        this.googleProfile = record.profile || this.getSavedGoogleProfile();
        if (record.clientId && window.Storage) {
            window.Storage.local.set("bl4ut0_gdrive_client_id", record.clientId);
            window.Storage.local.set("bl4ut0_gdrive_token", this.token);
            window.Storage.local.set("bl4ut0_gdrive_token_expiry", String(expiresAt));
        }
        if (window.state) window.state.gdriveConnected = true;
        if (record.migrated) await this.persistAuthRecord();
        this.emitAuthChanged("restored");
        return { status: "restored", profile: this.googleProfile };
    },

    async validateSession({ promptOnInvalid = true } = {}) {
        const token = this.getToken();
        if (!token) return { valid: false, reason: "missing" };
        try {
            await this.fetchGoogleProfile();
            await this.persistAuthRecord();
            this.emitAuthChanged("connected");
            return { valid: true, profile: this.googleProfile };
        } catch (error) {
            const message = String(error?.message || error);
            const invalid = /\b(401|403)\b/.test(message);
            if (!invalid) {
                this.emitAuthChanged("offline", { reason: message });
                return { valid: null, reason: "network" };
            }
            await this.invalidateSession("Google Drive rejected the saved session.");
            if (promptOnInvalid) this.showReconnectPrompt("Google Drive needs you to sign in again.");
            return { valid: false, reason: "invalid" };
        }
    },

    async invalidateSession(reason = "Google Drive needs you to sign in again.") {
        const profile = this.googleProfile || this.getSavedGoogleProfile();
        this.clearBrowserSession();
        this.googleProfile = profile;
        await this.persistReconnectRecord(reason);
        this.emitAuthChanged("invalid", { reason });
    },

    closeReconnectPrompt() {
        document.getElementById("gdrive-reconnect-prompt")?.remove();
    },

    showReconnectPrompt(reason = "Your saved Google Drive session is no longer valid.") {
        if (document.getElementById("gdrive-reconnect-prompt")) return;
        const profile = this.googleProfile || this.getSavedGoogleProfile();
        const account = profile?.email || profile?.name || "your Google account";
        const prompt = document.createElement("aside");
        prompt.id = "gdrive-reconnect-prompt";
        prompt.className = "gdrive-reconnect-prompt";
        prompt.setAttribute("role", "dialog");
        prompt.setAttribute("aria-modal", "true");
        prompt.setAttribute("aria-labelledby", "gdrive-reconnect-title");
        prompt.innerHTML = `
            <div class="gdrive-reconnect-icon"><i class="fa-brands fa-google-drive"></i></div>
            <div class="gdrive-reconnect-copy">
                <span>Cloud Sync paused</span>
                <h2 id="gdrive-reconnect-title">Sign in again to keep progress synced</h2>
                <p>${window.escapeHtml ? window.escapeHtml(reason) : reason}</p>
                <small>Reconnect ${window.escapeHtml ? window.escapeHtml(account) : account} to resume syncing your SystemFS files and saved progress.</small>
            </div>
            <div class="gdrive-reconnect-actions">
                <button type="button" data-gdrive-reconnect-later>Not now</button>
                <button type="button" class="primary" data-gdrive-reconnect-now>
                    <i class="fa-brands fa-google"></i> Sign in again
                </button>
            </div>
        `;
        prompt.addEventListener("click", async (event) => {
            if (event.target.closest("[data-gdrive-reconnect-later]")) {
                this.closeReconnectPrompt();
                return;
            }
            const reconnect = event.target.closest("[data-gdrive-reconnect-now]");
            if (!reconnect) return;
            reconnect.disabled = true;
            reconnect.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
            try {
                const clientId = window.Storage?.local.get("bl4ut0_gdrive_client_id") || this.defaultClientId;
                await this.loadGsiLibrary();
                await this.login(clientId);
                this.closeReconnectPrompt();
                window.showDesktopToast?.("Google Drive reconnected. Syncing progress...");
                window.triggerGDriveSync?.();
            } catch (error) {
                reconnect.disabled = false;
                reconnect.innerHTML = '<i class="fa-brands fa-google"></i> Sign in again';
                window.showDesktopToast?.("Google Drive sign-in was not completed.");
            }
        });
        document.body.appendChild(prompt);
    },

    getOAuthStatus() {
        const origin = window.location?.origin || this.productionOrigin;
        return {
            origin,
            productionOrigin: this.productionOrigin,
            returnMode: "Google Identity Services token callback",
            usesRedirectUri: false,
            folder: this.getCurrentFolderLabel()
        };
    },

    sanitizeFolderName(value, fallback = "Profile") {
        return String(value || fallback)
            .replace(/[\\/:*?"<>|]/g, "-")
            .replace(/[\u0000-\u001f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80) || fallback;
    },

    slugify(value, fallback = "profile") {
        return String(value || fallback)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48) || fallback;
    },

    escapeDriveQueryValue(value) {
        return String(value || "")
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'");
    },

    getCurrentSyncScope() {
        const userId = window.state?.currentUserId || "bl4ut0";
        if (userId === "private") {
            const profile = window.getSavedPrivateProfile ? window.getSavedPrivateProfile() : null;
            const displayName = this.sanitizeFolderName(profile?.name || profile?.email || "Private User", "Private User");
            const slug = this.slugify(displayName, "private-user");
            return {
                id: `private-${slug}`,
                userId: "private",
                label: displayName,
                folderName: `Private - ${displayName}`
            };
        }

        return {
            id: "owner-bl4ut0",
            userId: "bl4ut0",
            label: "Bl4ut0",
            folderName: "Owner - Bl4ut0"
        };
    },

    getCurrentFolderLabel() {
        const scope = this.getCurrentSyncScope();
        return `${this.rootFolderName}/${scope.folderName}`;
    },

    getSavedGoogleProfile() {
        try {
            const raw = window.Storage
                ? window.Storage.local.get("bl4ut0_gdrive_profile")
                : window.localStorage.getItem("bl4ut0_gdrive_profile");
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && (parsed.name || parsed.email || parsed.picture) ? parsed : null;
        } catch (error) {
            return null;
        }
    },

    async fetchGoogleProfile() {
        const token = this.token || this.getToken();
        if (!token) return null;

        const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to load Google profile: ${response.status} - ${errText}`);
        }
        const profile = await response.json();
        this.googleProfile = {
            name: profile.name || "",
            email: profile.email || "",
            picture: profile.picture || "",
            sub: profile.sub || ""
        };
        if (window.Storage) {
            window.Storage.local.set("bl4ut0_gdrive_profile", JSON.stringify(this.googleProfile));
        } else {
            window.localStorage.setItem("bl4ut0_gdrive_profile", JSON.stringify(this.googleProfile));
        }
        this.emitAuthChanged("profile-updated");
        return this.googleProfile;
    },

    async getGoogleProfile() {
        if (this.googleProfile) return this.googleProfile;
        const saved = this.getSavedGoogleProfile();
        if (saved) {
            this.googleProfile = saved;
            return saved;
        }
        try {
            return await this.fetchGoogleProfile();
        } catch (error) {
            console.warn("PortfoliOS: Google profile lookup failed.", error);
            return null;
        }
    },

    getScopedStorageKey(base, scope = this.getCurrentSyncScope()) {
        return `bl4ut0_${base}_${scope.id}`;
    },

    clearScopedSyncState(scopePrefix = "") {
        const matchesScope = (scopeId) => !scopePrefix || scopeId === scopePrefix || scopeId.startsWith(`${scopePrefix}-`);
        Object.keys(this.scopeFolderIds || {}).forEach((scopeId) => {
            if (matchesScope(scopeId)) delete this.scopeFolderIds[scopeId];
        });

        const shouldRemoveKey = (key) => {
            if (!key) return false;
            if (!scopePrefix) {
                return key === "bl4ut0_sync_manifest"
                    || key === "bl4ut0_last_sync_time"
                    || key.startsWith("bl4ut0_sync_manifest_")
                    || key.startsWith("bl4ut0_last_sync_time_");
            }
            return key.startsWith(`bl4ut0_sync_manifest_${scopePrefix}`)
                || key.startsWith(`bl4ut0_last_sync_time_${scopePrefix}`);
        };

        [window.localStorage, window.sessionStorage].forEach((storage) => {
            try {
                const keys = [];
                for (let i = 0; i < storage.length; i += 1) {
                    const key = storage.key(i);
                    if (shouldRemoveKey(key)) keys.push(key);
                }
                keys.forEach((key) => storage.removeItem(key));
            } catch (error) {}
        });
    },

    async findFolderByName(token, name, parentId = "") {
        const parentClause = parentId ? ` and '${parentId}' in parents` : "";
        const params = new URLSearchParams({
            q: `name='${this.escapeDriveQueryValue(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`,
            fields: "files(id,name)"
        });
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to search Drive folder: ${response.status} - ${errText}`);
        }
        const result = await response.json();
        return result.files && result.files.length > 0 ? result.files[0] : null;
    },

    async createDriveFolder(token, name, parentId = "") {
        const metadata = {
            name,
            mimeType: "application/vnd.google-apps.folder"
        };
        if (parentId) metadata.parents = [parentId];

        const response = await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(metadata)
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to create Drive folder: ${response.status} - ${errText}`);
        }
        return response.json();
    },
    
    async getOrCreateParentFolder(token) {
        if (this.rootFolderId) return this.rootFolderId;

        const existing = await this.findFolderByName(token, this.rootFolderName);
        if (existing) {
            this.rootFolderId = existing.id;
            this.parentFolderId = existing.id;
            return this.rootFolderId;
        }

        const created = await this.createDriveFolder(token, this.rootFolderName);
        this.rootFolderId = created.id;
        this.parentFolderId = created.id;
        return this.rootFolderId;
    },

    async getOrCreateSyncFolder(token) {
        const scope = this.getCurrentSyncScope();
        if (this.scopeFolderIds[scope.id]) return this.scopeFolderIds[scope.id];

        const rootFolderId = await this.getOrCreateParentFolder(token);
        const existing = await this.findFolderByName(token, scope.folderName, rootFolderId);
        if (existing) {
            this.scopeFolderIds[scope.id] = existing.id;
            return existing.id;
        }

        const created = await this.createDriveFolder(token, scope.folderName, rootFolderId);
        this.scopeFolderIds[scope.id] = created.id;
        return created.id;
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
                scope: this.scopes,
                include_granted_scopes: true,
                callback: async (response) => {
                    if (response.error) {
                        reject(response);
                    } else {
                        this.token = response.access_token;
                        this.tokenExpiresAt = Date.now() + (Number(response.expires_in || 3600) * 1000);
                        if (window.Storage) {
                            window.Storage.local.set("bl4ut0_gdrive_token", this.token);
                            window.Storage.local.set("bl4ut0_gdrive_token_expiry", String(this.tokenExpiresAt));
                            window.Storage.local.set("bl4ut0_gdrive_client_id", clientId);
                        }
                        if (window.state) {
                            window.state.gdriveConnected = true;
                        }
                        try {
                            await this.fetchGoogleProfile();
                        } catch (error) {
                            console.warn("PortfoliOS: Google profile lookup failed after login.", error);
                        }
                        await this.persistAuthRecord();
                        this.closeReconnectPrompt();
                        this.emitAuthChanged("connected");
                        resolve(this.token);
                    }
                }
            });
            client.requestAccessToken({ prompt: "consent" });
        });
    },
    
    getToken() {
        if (this.token && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
            if (window.state) window.state.gdriveConnected = true;
            return this.token;
        }
        if (!window.Storage) return null;
        const token = window.Storage.local.get("bl4ut0_gdrive_token");
        const expiry = Number(window.Storage.local.get("bl4ut0_gdrive_token_expiry") || 0);
        if (token && expiry && Date.now() < expiry) {
            this.token = token;
            this.tokenExpiresAt = expiry;
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
    
    async logout() {
        const authPath = this.getAuthRecordPath();
        this.clearBrowserSession();
        this.googleProfile = null;
        if (window.Storage) {
            window.Storage.local.remove("bl4ut0_gdrive_profile");
        }
        try {
            if (window.SystemFS) await window.SystemFS.deleteFile(authPath, { silent: true });
        } catch (error) {}
        this.clearScopedSyncState();
        this.closeReconnectPrompt();
        this.emitAuthChanged("disconnected");
    },
    
    async fetchRemoteFiles() {
        const token = this.token || this.getToken();
        if (!token) throw new Error("Not authenticated with Google Drive");
        const syncFolderId = await this.getOrCreateSyncFolder(token);
        const params = new URLSearchParams({
            q: `'${syncFolderId}' in parents and trashed=false`,
            fields: "files(id,name,mimeType,modifiedTime,appProperties)",
            pageSize: "1000"
        });
        const url = `https://www.googleapis.com/drive/v3/files?${params}`;
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
 
        const syncFolderId = await this.getOrCreateSyncFolder(token);
        const scope = this.getCurrentSyncScope();

        const metadata = {
            name: name,
            mimeType: mimeType,
            parents: [syncFolderId],
            appProperties: { path: path, scope: scope.id }
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
 
        const syncFolderId = await this.getOrCreateSyncFolder(token);
        const scope = this.getCurrentSyncScope();

        const metadata = {
            name: name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [syncFolderId],
            appProperties: { path: path, scope: scope.id }
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
        const scope = this.getCurrentSyncScope();
        const remoteFiles = await this.fetchRemoteFiles();
        const localFiles = await window.SystemFS.getAllFiles();

        const remoteMap = new Map();
        remoteFiles.forEach(f => remoteMap.set(f.appProperties.path, f));

        const localMap = new Map();
        localFiles.forEach(f => localMap.set(f.path, f));

        const allPaths = new Set([...remoteMap.keys(), ...localMap.keys()]);
        const isPathSyncable = (p) => {
            const local = localMap.get(p);
            if (local?.metadata?.sync === false) return false;
            if (["/apps", "/ROMs", "/etc"].some(root => p === root || p.startsWith(`${root}/`))) return false;
            const parts = p.split("/");
            if (parts.some(part => part.startsWith("."))) return false;
            if (p === "/home" || p.startsWith("/home/")) {
                const homeRoot = `/home/${scope.userId}`;
                return p === homeRoot || p.startsWith(`${homeRoot}/`);
            }
            return true;
        };
        const sortedPaths = Array.from(allPaths)
            .filter(isPathSyncable)
            .sort();
        let processed = 0;
        const total = sortedPaths.length;

        const manifestKey = this.getScopedStorageKey("sync_manifest", scope);
        const lastSyncKey = this.getScopedStorageKey("last_sync_time", scope);
        const manifestStr = window.Storage ? window.Storage.local.get(manifestKey) : null;
        const lastSyncTime = window.Storage ? window.Storage.local.get(lastSyncKey) : null;
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
                if (/\b(401|403)\b/.test(String(err?.message || err))) throw err;
            }

            processed++;
        }

        const finalLocalFiles = await window.SystemFS.getAllFiles();
        const finalPaths = finalLocalFiles.map(f => f.path).filter(isPathSyncable);
        
        if (window.Storage) {
            window.Storage.local.set(manifestKey, JSON.stringify(finalPaths));
            window.Storage.local.set(lastSyncKey, String(Date.now()));
        }

        if (onProgress) onProgress(total, total, "Complete");
        
        if (window.EventBus) {
            window.EventBus.emit("fs:changed", { action: "sync", paths: finalPaths });
        }
    }
};

if (window.EventBus) {
    window.EventBus.on("user:changed", async () => {
        window.GDriveSync.closeReconnectPrompt();
        window.GDriveSync.clearBrowserSession();
        window.GDriveSync.googleProfile = null;
        const restored = await window.GDriveSync.restoreSession({ promptOnInvalid: true });
        if (restored.status === "restored") {
            const result = await window.GDriveSync.validateSession({ promptOnInvalid: true });
            if (result.valid) window.triggerGDriveSync?.({ silent: true });
        }
    });
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || window.GDriveSync.getToken()) return;
    window.GDriveSync.restoreSession({ promptOnInvalid: false }).then((restored) => {
        if (restored.status === "restored") {
            window.GDriveSync.validateSession({ promptOnInvalid: true });
        }
    });
});
