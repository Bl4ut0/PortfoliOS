/**
 * PortfoliOS: Pluggable Cloud Storage & Sync Architecture (CloudSync)
 * Provides an extensible registry and standard interface for cloud storage sync drivers.
 *
 * Supported Drivers:
 * - Google Drive (REST API v3, drive.file scope)
 * - Microsoft OneDrive (Microsoft Graph API v1.0, approot sandboxing)
 * - Dropbox (Dropbox API v2, sandboxed App folder)
 * - Nextcloud WebDAV (Self-hosted WebDAV standard)
 */
(function (global) {
    'use strict';

    async function safeJson(response, fallback = {}) {
        if (!response) return fallback;
        try {
            if (typeof response.json === 'function') {
                const data = await response.json();
                return data ?? fallback;
            }
        } catch {
            return fallback;
        }
        return fallback;
    }

    /**
     * Abstract Sync Driver Base
     */
    class BaseSyncDriver {
        constructor(config = {}) {
            this.id = config.id || 'base';
            this.name = config.name || 'Base Sync';
            this.authDriver = config.authDriver || 'base';
            this.icon = config.icon || 'fa-solid fa-cloud';
            this.description = config.description || '';
            this.rootFolderName = config.rootFolderName || 'PortfoliOS';
        }

        async ensureAppRoot(_token, _options) {
            throw new Error(`ensureAppRoot() not implemented by ${this.name} driver.`);
        }

        async ensureDirectory(_token, _parentId, _name) {
            throw new Error(`ensureDirectory() not implemented by ${this.name} driver.`);
        }

        async findFolderByName(_token, _name, _parentId) {
            throw new Error(`findFolderByName() not implemented by ${this.name} driver.`);
        }

        async listFiles(_token, _folderId) {
            throw new Error(`listFiles() not implemented by ${this.name} driver.`);
        }

        async uploadFile(_token, _folderId, _name, _data, _type, _options) {
            throw new Error(`uploadFile() not implemented by ${this.name} driver.`);
        }

        async downloadFile(_token, _fileId) {
            throw new Error(`downloadFile() not implemented by ${this.name} driver.`);
        }

        async deleteFile(_token, _fileId) {
            throw new Error(`deleteFile() not implemented by ${this.name} driver.`);
        }

        async getQuota(_token) {
            return { usedBytes: 0, totalBytes: 0, available: false };
        }
    }

    /**
     * 1. Google Drive Sync Driver (REST API v3)
     */
    class GoogleDriveSyncDriver extends BaseSyncDriver {
        constructor() {
            super({
                id: 'google-drive',
                name: 'Google Drive',
                authDriver: 'google',
                icon: 'fa-brands fa-google-drive',
                description: 'Sync files to your Google Drive in a dedicated PortfoliOS folder.',
                rootFolderName: 'PortfoliOS'
            });
            this.apiBase = 'https://www.googleapis.com/drive/v3';
            this.uploadBase = 'https://www.googleapis.com/upload/drive/v3/files';
        }

        escapeQueryValue(value) {
            return String(value || '')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'");
        }

        async findFolderByName(token, name, parentId = '') {
            const parentClause = parentId ? ` and '${parentId}' in parents` : '';
            const params = new URLSearchParams({
                q: `name='${this.escapeQueryValue(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`,
                fields: 'files(id,name)'
            });
            const response = await fetch(`${this.apiBase}/files?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Drive folder lookup failed (${response.status}): ${text}`);
            }
            const result = await safeJson(response, {});
            return result.files && result.files.length > 0 ? result.files[0] : null;
        }

        async ensureDirectory(token, parentId, name) {
            const existing = await this.findFolderByName(token, name, parentId);
            if (existing) return existing;

            const metadata = {
                name,
                mimeType: 'application/vnd.google-apps.folder'
            };
            if (parentId) metadata.parents = [parentId];

            const fetchFn = (global.PrivateSessions?.drive?.bind(global.PrivateSessions)) || fetch;
            const response = await fetchFn(`${this.apiBase}/files`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Drive folder creation failed (${response.status}): ${text}`);
            }
            return await safeJson(response, {});
        }

        async ensureAppRoot(token, options = {}) {
            const rootName = options.rootFolderName || this.rootFolderName;
            return await this.ensureDirectory(token, '', rootName);
        }

        async listFiles(token, folderId) {
            const params = new URLSearchParams({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id,name,mimeType,size,modifiedTime,md5Checksum)',
                pageSize: '1000'
            });
            const response = await fetch(`${this.apiBase}/files?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Drive file listing failed (${response.status}): ${text}`);
            }
            const data = await safeJson(response, { files: [] });
            return (data.files || []).map(file => ({
                id: file.id,
                name: file.name,
                size: Number(file.size || 0),
                type: file.mimeType,
                isDirectory: file.mimeType === 'application/vnd.google-apps.folder',
                modifiedTime: file.modifiedTime ? new Date(file.modifiedTime).getTime() : 0,
                md5Checksum: file.md5Checksum || null
            }));
        }

        async uploadFile(token, folderId, name, data, type = 'application/octet-stream', options = {}) {
            const boundary = '-------314159265358979323846';
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelim = `\r\n--${boundary}--`;

            const metadata = {
                name,
                mimeType: type,
                parents: folderId ? [folderId] : []
            };

            const existingId = options.existingFileId;
            const url = existingId
                ? `${this.uploadBase}/${existingId}?uploadType=multipart`
                : `${this.uploadBase}?uploadType=multipart`;
            const method = existingId ? 'PATCH' : 'POST';

            // Support Blob, ArrayBuffer, string
            let blobContent;
            if (data instanceof Blob) {
                blobContent = data;
            } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
                blobContent = new Blob([data], { type });
            } else {
                blobContent = new Blob([String(data)], { type });
            }

            const metadataBlob = new Blob([
                `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n${delimiter}Content-Type: ${type}\r\n\r\n`
            ], { type: 'text/plain' });

            const closingBlob = new Blob([closeDelim], { type: 'text/plain' });
            const payload = new Blob([metadataBlob, blobContent, closingBlob], { type: `multipart/related; boundary=${boundary}` });

            const fetchFn = (global.PrivateSessions?.drive?.bind(global.PrivateSessions)) || fetch;
            const response = await fetchFn(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: payload
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Drive file upload failed (${response.status}): ${text}`);
            }

            return await safeJson(response, {});
        }

        async downloadFile(token, fileId) {
            const response = await fetch(`${this.apiBase}/files/${fileId}?alt=media`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Drive file download failed (${response.status}): ${text}`);
            }
            return await response.blob();
        }

        async deleteFile(token, fileId) {
            const response = await fetch(`${this.apiBase}/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok && response.status !== 404) {
                const text = await response.text();
                throw new Error(`Drive file deletion failed (${response.status}): ${text}`);
            }
            return true;
        }

        async getQuota(token) {
            try {
                const response = await fetch(`${this.apiBase}/about?fields=storageQuota`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) return { usedBytes: 0, totalBytes: 0, available: false };
                const data = await safeJson(response, {});
                const quota = data.storageQuota || {};
                return {
                    usedBytes: Number(quota.usage || 0),
                    totalBytes: Number(quota.limit || 0),
                    available: true
                };
            } catch (_) {
                return { usedBytes: 0, totalBytes: 0, available: false };
            }
        }
    }

    /**
     * 2. Microsoft OneDrive Sync Driver (Microsoft Graph API v1.0)
     */
    class OneDriveSyncDriver extends BaseSyncDriver {
        constructor() {
            super({
                id: 'onedrive',
                name: 'Microsoft OneDrive',
                authDriver: 'microsoft',
                icon: 'fa-brands fa-microsoft',
                description: 'Sync files directly to Microsoft OneDrive using isolated AppFolder sandboxing.',
                rootFolderName: 'PortfoliOS'
            });
            this.graphBase = 'https://graph.microsoft.com/v1.0';
        }

        async ensureAppRoot(token) {
            // /me/drive/special/approot resolves or creates the sandboxed app folder automatically
            const response = await fetch(`${this.graphBase}/me/drive/special/approot`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`OneDrive AppRoot lookup failed (${response.status}): ${text}`);
            }
            const data = await safeJson(response, {});
            return { id: data.id, name: data.name || 'approot' };
        }

        async ensureDirectory(token, parentId, name) {
            const response = await fetch(`${this.graphBase}/me/drive/items/${parentId}/children`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    folder: {},
                    '@microsoft.graph.conflictBehavior': 'fail'
                })
            });

            if (response.status === 409) {
                // Already exists, search for it
                const list = await this.listFiles(token, parentId);
                const found = list.find(item => item.name === name && item.isDirectory);
                if (found) return found;
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`OneDrive folder creation failed (${response.status}): ${text}`);
            }
            const data = await safeJson(response, {});
            return { id: data.id, name: data.name };
        }

        async listFiles(token, folderId) {
            const response = await fetch(`${this.graphBase}/me/drive/items/${folderId}/children`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`OneDrive listing failed (${response.status}): ${text}`);
            }
            const data = await safeJson(response, { value: [] });
            return (data.value || []).map(item => ({
                id: item.id,
                name: item.name,
                size: Number(item.size || 0),
                type: item.file?.mimeType || 'application/octet-stream',
                isDirectory: Boolean(item.folder),
                modifiedTime: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime).getTime() : 0
            }));
        }

        async uploadFile(token, folderId, name, data, type = 'application/octet-stream') {
            const url = `${this.graphBase}/me/drive/items/${folderId}:/${encodeURIComponent(name)}:/content`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': type
                },
                body: data
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`OneDrive upload failed (${response.status}): ${text}`);
            }
            return await safeJson(response, {});
        }

        async downloadFile(token, fileId) {
            const response = await fetch(`${this.graphBase}/me/drive/items/${fileId}/content`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`OneDrive download failed (${response.status}): ${text}`);
            }
            return await response.blob();
        }

        async deleteFile(token, fileId) {
            const response = await fetch(`${this.graphBase}/me/drive/items/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok && response.status !== 404) {
                const text = await response.text();
                throw new Error(`OneDrive delete failed (${response.status}): ${text}`);
            }
            return true;
        }

        async getQuota(token) {
            try {
                const response = await fetch(`${this.graphBase}/me/drive`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) return { usedBytes: 0, totalBytes: 0, available: false };
                const data = await safeJson(response, {});
                const quota = data.quota || {};
                return {
                    usedBytes: Number(quota.used || 0),
                    totalBytes: Number(quota.total || 0),
                    available: true
                };
            } catch (_) {
                return { usedBytes: 0, totalBytes: 0, available: false };
            }
        }
    }

    /**
     * 3. Dropbox Sync Driver (Dropbox API v2)
     */
    class DropboxSyncDriver extends BaseSyncDriver {
        constructor() {
            super({
                id: 'dropbox',
                name: 'Dropbox',
                authDriver: 'dropbox',
                icon: 'fa-brands fa-dropbox',
                description: 'Sync files to a sandboxed PortfoliOS folder in Dropbox.',
                rootFolderName: 'PortfoliOS'
            });
            this.apiBase = 'https://api.dropboxapi.com/2';
            this.contentBase = 'https://content.dropboxapi.com/2';
        }

        async ensureAppRoot(_token) {
            // App folder sandbox: root is empty string ""
            return { id: '', path: '', name: 'PortfoliOS' };
        }

        async ensureDirectory(token, parentPath, name) {
            const fullPath = parentPath ? `${parentPath}/${name}` : `/${name}`;
            const response = await fetch(`${this.apiBase}/files/create_folder_v2`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: fullPath, autorename: false })
            });

            if (response.ok || response.status === 409) {
                return { id: fullPath, path: fullPath, name };
            }

            const text = await response.text();
            throw new Error(`Dropbox folder creation failed (${response.status}): ${text}`);
        }

        async listFiles(token, folderPath = '') {
            const response = await fetch(`${this.apiBase}/files/list_folder`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: folderPath, recursive: false })
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Dropbox file listing failed (${response.status}): ${text}`);
            }
            const data = await safeJson(response, { entries: [] });
            return (data.entries || []).map(entry => ({
                id: entry.id || entry.path_lower,
                path: entry.path_display || entry.path_lower,
                name: entry.name,
                size: Number(entry.size || 0),
                type: entry['.tag'] === 'folder' ? 'application/vnd.folder' : 'application/octet-stream',
                isDirectory: entry['.tag'] === 'folder',
                modifiedTime: entry.server_modified ? new Date(entry.server_modified).getTime() : 0
            }));
        }

        async uploadFile(token, folderPath, name, data) {
            const fullPath = folderPath ? `${folderPath}/${name}` : `/${name}`;
            const response = await fetch(`${this.contentBase}/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Dropbox-API-Arg': JSON.stringify({ path: fullPath, mode: 'overwrite', mute: true }),
                    'Content-Type': 'application/octet-stream'
                },
                body: data
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Dropbox upload failed (${response.status}): ${text}`);
            }
            return await safeJson(response, {});
        }

        async downloadFile(token, filePath) {
            const response = await fetch(`${this.contentBase}/files/download`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Dropbox-API-Arg': JSON.stringify({ path: filePath })
                }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Dropbox download failed (${response.status}): ${text}`);
            }
            return await response.blob();
        }

        async deleteFile(token, filePath) {
            const response = await fetch(`${this.apiBase}/files/delete_v2`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: filePath })
            });
            if (!response.ok && response.status !== 409) {
                const text = await response.text();
                throw new Error(`Dropbox delete failed (${response.status}): ${text}`);
            }
            return true;
        }

        async getQuota(token) {
            try {
                const response = await fetch(`${this.apiBase}/users/get_space_usage`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) return { usedBytes: 0, totalBytes: 0, available: false };
                const data = await safeJson(response, {});
                const used = Number(data.used || 0);
                const alloc = data.allocation?.allocated || 0;
                return {
                    usedBytes: used,
                    totalBytes: Number(alloc),
                    available: true
                };
            } catch (_) {
                return { usedBytes: 0, totalBytes: 0, available: false };
            }
        }
    }

    /**
     * 4. Nextcloud WebDAV Sync Driver (Homelab / Self-Hosted)
     */
    class NextcloudWebDavSyncDriver extends BaseSyncDriver {
        constructor() {
            super({
                id: 'nextcloud-webdav',
                name: 'Nextcloud WebDAV',
                authDriver: 'nextcloud',
                icon: 'fa-solid fa-server',
                description: 'Sync files to your personal self-hosted Nextcloud instance over WebDAV.',
                rootFolderName: 'PortfoliOS'
            });
        }

        sanitizeServerUrl(serverUrl) {
            const raw = String(serverUrl || '').trim();
            if (!raw) throw new Error('Nextcloud server URL is required.');
            let parsed;
            try {
                parsed = new URL(raw);
            } catch {
                throw new Error('Invalid Nextcloud server URL.');
            }
            const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
            if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
                throw new Error('Nextcloud server must use a secure HTTPS URL.');
            }
            return parsed.origin + parsed.pathname.replace(/\/+$/, '');
        }

        getDavUrl(serverUrl, user, subpath = '') {
            const cleanServer = this.sanitizeServerUrl(serverUrl);
            const cleanSub = String(subpath || '').replace(/^\/+/, '');
            return `${cleanServer}/remote.php/dav/files/${encodeURIComponent(user)}/${cleanSub}`;
        }

        async ensureDirectory(token, serverUrl, user, folderPath) {
            const url = this.getDavUrl(serverUrl, user, folderPath);
            const response = await fetch(url, {
                method: 'MKCOL',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok || response.status === 405) { // 405 Method Not Allowed typically means already exists in WebDAV
                const name = folderPath.split('/').filter(Boolean).pop() || folderPath;
                return { id: folderPath, path: folderPath, name };
            }
            const text = await response.text();
            throw new Error(`WebDAV folder creation failed (${response.status}): ${text}`);
        }

        async ensureAppRoot(token, options = {}) {
            const serverUrl = options.serverUrl;
            const user = options.user || 'user';
            const rootName = options.rootFolderName || this.rootFolderName;
            return await this.ensureDirectory(token, serverUrl, user, rootName);
        }

        async uploadFile(token, serverUrl, user, filePath, data, type = 'application/octet-stream') {
            const url = this.getDavUrl(serverUrl, user, filePath);
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': type
                },
                body: data
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`WebDAV file upload failed (${response.status}): ${text}`);
            }
            const name = filePath.split('/').filter(Boolean).pop() || filePath;
            return { id: filePath, path: filePath, name };
        }

        async listFiles(token, serverUrl, user, folderPath = '') {
            const url = this.getDavUrl(serverUrl, user, folderPath);
            const response = await fetch(url, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Depth': '1',
                    'Content-Type': 'application/xml'
                }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`WebDAV listFiles failed (${response.status}): ${text}`);
            }
            const xmlText = await response.text();
            const entries = [];
            const responseBlocks = xmlText.match(/<[a-zA-Z0-9_:]*response[\s\S]*?<\/[a-zA-Z0-9_:]*response>/gi) || [];

            for (const block of responseBlocks) {
                const hrefMatch = block.match(/<[a-zA-Z0-9_:]*href[^>]*>([^<]+)<\/[a-zA-Z0-9_:]*href>/i);
                if (!hrefMatch) continue;
                const rawHref = decodeURIComponent(hrefMatch[1].trim());
                const cleanHref = rawHref.replace(/\/+$/, '');
                const name = cleanHref.split('/').filter(Boolean).pop() || '';

                // Skip the target folder itself
                const targetFolderClean = folderPath.replace(/^\/+|\/+$/g, '');
                if (targetFolderClean && (cleanHref.endsWith(`/${targetFolderClean}`) || cleanHref.endsWith(`/${encodeURIComponent(targetFolderClean)}`))) {
                    continue;
                }

                const isDir = /<[a-zA-Z0-9_:]*collection\s*\/?>/i.test(block);
                const sizeMatch = block.match(/<[a-zA-Z0-9_:]*getcontentlength[^>]*>([^<]+)<\/[a-zA-Z0-9_:]*getcontentlength>/i);
                const size = sizeMatch ? Number(sizeMatch[1]) : 0;

                const typeMatch = block.match(/<[a-zA-Z0-9_:]*getcontenttype[^>]*>([^<]+)<\/[a-zA-Z0-9_:]*getcontenttype>/i);
                const type = isDir ? 'application/vnd.folder' : (typeMatch ? typeMatch[1] : 'application/octet-stream');

                const modMatch = block.match(/<[a-zA-Z0-9_:]*getlastmodified[^>]*>([^<]+)<\/[a-zA-Z0-9_:]*getlastmodified>/i);
                const modifiedTime = modMatch ? new Date(modMatch[1]).getTime() : 0;

                entries.push({
                    id: cleanHref,
                    path: cleanHref,
                    name,
                    size,
                    type,
                    isDirectory: isDir,
                    modifiedTime
                });
            }
            return entries;
        }

        async getQuota(token, serverUrl, user) {
            try {
                const url = this.getDavUrl(serverUrl, user, '');
                const response = await fetch(url, {
                    method: 'PROPFIND',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Depth': '0',
                        'Content-Type': 'application/xml'
                    }
                });
                if (!response.ok) return { usedBytes: 0, totalBytes: 0, available: false };
                const xmlText = await response.text();
                const usedMatch = xmlText.match(/<[a-zA-Z0-9_:]*quota-used-bytes[^>]*>([^<]+)<\/[a-zA-Z0-9_:]*quota-used-bytes>/i);
                const availMatch = xmlText.match(/<[a-zA-Z0-9_:]*quota-available-bytes[^>]*>([^<]+)<\/[a-zA-Z0-9_:]*quota-available-bytes>/i);
                const used = usedMatch ? Number(usedMatch[1]) : 0;
                const avail = availMatch ? Number(availMatch[1]) : 0;
                return {
                    usedBytes: used,
                    totalBytes: used + avail,
                    available: Boolean(usedMatch || availMatch)
                };
            } catch (_) {
                return { usedBytes: 0, totalBytes: 0, available: false };
            }
        }

        async downloadFile(token, serverUrl, user, filePath) {
            const url = this.getDavUrl(serverUrl, user, filePath);
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`WebDAV download failed (${response.status}): ${text}`);
            }
            return await response.blob();
        }

        async deleteFile(token, serverUrl, user, filePath) {
            const url = this.getDavUrl(serverUrl, user, filePath);
            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok && response.status !== 404) {
                const text = await response.text();
                throw new Error(`WebDAV delete failed (${response.status}): ${text}`);
            }
            return true;
        }
    }

    // ==========================================
    // Central Registry: window.CloudSync
    // ==========================================
    const drivers = new Map();
    let activeDriverId = 'google-drive';

    const CloudSync = {
        BaseSyncDriver,
        GoogleDriveSyncDriver,
        OneDriveSyncDriver,
        DropboxSyncDriver,
        NextcloudWebDavSyncDriver,

        register(driver) {
            if (!driver || !driver.id) {
                throw new Error('Driver must have a valid string "id".');
            }
            drivers.set(driver.id, driver);
            return driver;
        },

        get(id) {
            return drivers.get(id) || null;
        },

        list() {
            return Array.from(drivers.values()).map(d => ({
                id: d.id,
                name: d.name,
                authDriver: d.authDriver,
                icon: d.icon,
                description: d.description
            }));
        },

        getActiveDriver() {
            return this.get(activeDriverId) || this.get('google-drive');
        },

        setActiveDriver(id) {
            if (!drivers.has(id)) {
                throw new Error(`Sync driver "${id}" is not registered.`);
            }
            activeDriverId = id;
            if (global.EventBus) {
                global.EventBus.emit('cloud-sync:driver-changed', { driverId: id });
            }
        }
    };

    // Auto-register built-in drivers
    CloudSync.register(new GoogleDriveSyncDriver());
    CloudSync.register(new OneDriveSyncDriver());
    CloudSync.register(new DropboxSyncDriver());
    CloudSync.register(new NextcloudWebDavSyncDriver());

    global.CloudSync = CloudSync;
})(typeof window !== 'undefined' ? window : globalThis);
