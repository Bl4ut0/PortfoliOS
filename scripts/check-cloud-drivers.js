/**
 * PortfoliOS: Cloud Authentication & Sync Driver Unit and Integration Tests
 * Validates registry operations, OAuth 2.0 PKCE generation, API contracts,
 * sandbox containment, and strict memory-only token policies.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const authSource = fs.readFileSync(path.join(root, 'core', 'cloud-auth.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(root, 'core', 'cloud-sync.js'), 'utf8');

// Global mock state
const events = [];
const mockEventBus = {
    emit: (name, data) => events.push({ name, data }),
    on: () => {}
};

// Create an isolated browser-like sandbox
const sandbox = {
    globalThis: null,
    window: null,
    crypto: globalThis.crypto,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
    EventBus: mockEventBus,
    URL,
    URLSearchParams,
    Blob,
    Response,
    Request,
    console,
    fetch: null
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

vm.createContext(sandbox);

// 1. Load cloud-auth.js into sandbox
vm.runInContext(authSource, sandbox, { filename: 'core/cloud-auth.js' });
// 2. Load cloud-sync.js into sandbox
vm.runInContext(syncSource, sandbox, { filename: 'core/cloud-sync.js' });

const { CloudAuth, CloudSync } = sandbox;

(async () => {
    console.log('Running Cloud Auth & Sync Driver Tests...');

    // =========================================================================
    // SECTION 1: CloudAuth Registry & PKCE Helpers
    // =========================================================================
    assert(CloudAuth, 'CloudAuth must be exported to window');
    const authDrivers = CloudAuth.list();
    assert.equal(authDrivers.length, 4, 'CloudAuth must have 4 built-in drivers');

    const expectedAuthIds = ['dropbox', 'google', 'microsoft', 'nextcloud'];
    assert.deepEqual(Array.from(authDrivers.map(d => d.id)).sort(), expectedAuthIds);

    // Active driver management
    assert.equal(CloudAuth.getActiveDriver().id, 'google', 'Default active auth driver is google');
    CloudAuth.setActiveDriver('microsoft');
    assert.equal(CloudAuth.getActiveDriver().id, 'microsoft');
    assert(events.some(e => e.name === 'cloud-auth:driver-changed' && e.data.driverId === 'microsoft'));
    assert.throws(() => CloudAuth.setActiveDriver('non-existent'), /not registered/);
    CloudAuth.setActiveDriver('google'); // Reset

    // Cryptographic PKCE validation
    const randStr = CloudAuth.generateRandomString(64);
    assert.equal(randStr.length, 64);
    assert(/^[A-Za-z0-9\-._~]+$/.test(randStr), 'PKCE verifier must use unreserved RFC 7636 characters');

    const testBuf = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    const encoded = CloudAuth.base64UrlEncode(testBuf);
    assert.equal(encoded, 'aGVsbG8'); // base64url for "hello"

    const baseDriver = new CloudAuth.BaseAuthDriver({ id: 'custom-base' });
    const pkcePair = await baseDriver.createPkcePair();
    assert(pkcePair.verifier && pkcePair.verifier.length >= 43);
    assert(pkcePair.challenge && pkcePair.challenge.length >= 43);

    // =========================================================================
    // SECTION 2: CloudAuth Drivers Behavior
    // =========================================================================

    // 2.1 GoogleAuthDriver
    const googleAuth = CloudAuth.get('google');
    assert.equal(googleAuth.id, 'google');
    assert.equal(googleAuth.supportsPkce, false);

    // Mock fetch for Google Userinfo
    sandbox.fetch = async (url, options) => {
        assert.equal(url, 'https://openidconnect.googleapis.com/v1/userinfo');
        assert.equal(options.headers.Authorization, 'Bearer google-mock-token');
        return new Response(JSON.stringify({
            sub: 'g-user-12345',
            name: 'Jane Doe',
            email: 'jane@example.com',
            picture: 'https://example.com/jane.jpg'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const gProfile = await googleAuth.fetchProfile('google-mock-token');
    assert.equal(gProfile.sub, 'g-user-12345');
    assert.equal(gProfile.email, 'jane@example.com');
    assert.equal(gProfile.name, 'Jane Doe');
    assert.equal(gProfile.provider, 'google');

    const gValid = await googleAuth.validateToken('google-mock-token');
    assert.equal(gValid.valid, true);
    assert.equal(gValid.profile.email, 'jane@example.com');

    // Test token failure
    sandbox.fetch = async () => new Response('Unauthorized', { status: 401 });
    const gInvalid = await googleAuth.validateToken('bad-token');
    assert.equal(gInvalid.valid, false);

    // 2.2 MicrosoftAuthDriver
    const msAuth = CloudAuth.get('microsoft');
    assert.equal(msAuth.id, 'microsoft');
    assert.equal(msAuth.supportsPkce, true);

    const msAuthUrl = msAuth.getAuthorizeUrl({
        clientId: 'ms-client-123',
        redirectUri: 'https://os.bl4ut0.dev/auth/callback',
        codeChallenge: 'mock-challenge-xyz'
    });
    const parsedMsUrl = new URL(msAuthUrl);
    assert.equal(parsedMsUrl.origin, 'https://login.microsoftonline.com');
    assert.equal(parsedMsUrl.searchParams.get('client_id'), 'ms-client-123');
    assert.equal(parsedMsUrl.searchParams.get('code_challenge'), 'mock-challenge-xyz');
    assert.equal(parsedMsUrl.searchParams.get('code_challenge_method'), 'S256');
    assert(parsedMsUrl.searchParams.get('scope').includes('Files.ReadWrite.AppFolder'));

    // Mock code exchange & graph userinfo
    sandbox.fetch = async (url) => {
        if (url.includes('graph.microsoft.com/v1.0/me')) {
            return new Response(JSON.stringify({
                id: 'ms-user-789',
                displayName: 'Microsoft User',
                mail: 'msuser@outlook.com',
                userPrincipalName: 'msuser@outlook.com'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not found', { status: 404 });
    };
    const msProfile = await msAuth.fetchProfile('ms-mock-token');
    assert.equal(msProfile.sub, 'ms-user-789');
    assert.equal(msProfile.name, 'Microsoft User');
    assert.equal(msProfile.email, 'msuser@outlook.com');
    assert.equal(msProfile.provider, 'microsoft');

    // 2.3 DropboxAuthDriver
    const dbAuth = CloudAuth.get('dropbox');
    assert.equal(dbAuth.id, 'dropbox');
    assert.equal(dbAuth.supportsPkce, true);

    const dbAuthUrl = dbAuth.getAuthorizeUrl({
        clientId: 'db-client-456',
        redirectUri: 'https://os.bl4ut0.dev/auth/callback',
        codeChallenge: 'db-challenge-abc'
    });
    const parsedDbUrl = new URL(dbAuthUrl);
    assert.equal(parsedDbUrl.origin, 'https://www.dropbox.com');
    assert.equal(parsedDbUrl.searchParams.get('client_id'), 'db-client-456');
    assert.equal(parsedDbUrl.searchParams.get('code_challenge'), 'db-challenge-abc');
    assert.equal(parsedDbUrl.searchParams.get('token_access_type'), 'online');

    sandbox.fetch = async (url) => {
        if (url.includes('api.dropboxapi.com/2/users/get_current_account')) {
            return new Response(JSON.stringify({
                account_id: 'db-acc-001',
                name: { display_name: 'Dropbox User' },
                email: 'dbuser@example.com',
                profile_photo_url: 'https://dropbox.example/avatar.png'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not found', { status: 404 });
    };
    const dbProfile = await dbAuth.fetchProfile('db-mock-token');
    assert.equal(dbProfile.sub, 'db-acc-001');
    assert.equal(dbProfile.name, 'Dropbox User');
    assert.equal(dbProfile.email, 'dbuser@example.com');
    assert.equal(dbProfile.provider, 'dropbox');

    // 2.4 NextcloudAuthDriver
    const ncAuth = CloudAuth.get('nextcloud');
    assert.equal(ncAuth.id, 'nextcloud');
    const ncAuthUrl = ncAuth.getAuthorizeUrl({
        serverUrl: 'https://cloud.homelab.local',
        clientId: 'nc-client-999',
        redirectUri: 'https://os.bl4ut0.dev/auth/nextcloud'
    });
    assert(ncAuthUrl.startsWith('https://cloud.homelab.local/apps/oauth2/authorize'));

    sandbox.fetch = async (url) => {
        if (url.includes('/ocs/v2.php/cloud/user')) {
            return new Response(JSON.stringify({
                ocs: {
                    data: {
                        id: 'homelab-admin',
                        displayname: 'Homelab Admin',
                        email: 'admin@homelab.local'
                    }
                }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not found', { status: 404 });
    };
    const ncProfile = await ncAuth.fetchProfile('nc-mock-token', 'https://cloud.homelab.local');
    assert.equal(ncProfile.sub, 'homelab-admin');
    assert.equal(ncProfile.name, 'Homelab Admin');
    assert.equal(ncProfile.email, 'admin@homelab.local');
    assert.equal(ncProfile.provider, 'nextcloud');

    // =========================================================================
    // SECTION 3: CloudSync Registry
    // =========================================================================
    assert(CloudSync, 'CloudSync must be exported to window');
    const syncDrivers = CloudSync.list();
    assert.equal(syncDrivers.length, 4, 'CloudSync must have 4 built-in drivers');

    const expectedSyncIds = ['dropbox', 'google-drive', 'nextcloud-webdav', 'onedrive'];
    assert.deepEqual(Array.from(syncDrivers.map(d => d.id)).sort(), expectedSyncIds);

    assert.equal(CloudSync.getActiveDriver().id, 'google-drive');
    CloudSync.setActiveDriver('dropbox');
    assert.equal(CloudSync.getActiveDriver().id, 'dropbox');
    assert(events.some(e => e.name === 'cloud-sync:driver-changed' && e.data.driverId === 'dropbox'));
    CloudSync.setActiveDriver('google-drive'); // Reset

    // =========================================================================
    // SECTION 4: CloudSync Drivers Operations
    // =========================================================================

    // 4.1 Google Drive Sync Driver
    const gDrive = CloudSync.get('google-drive');
    assert.equal(gDrive.id, 'google-drive');

    // Mock Google Drive files query & create
    sandbox.fetch = async (url, options = {}) => {
        const u = String(url);
        if (u.includes('/drive/v3/files?') && u.includes('q=')) {
            // listFiles / ensureAppRoot
            return new Response(JSON.stringify({
                files: [{ id: 'g-file-01', name: 'manifest.json', size: '1024', mimeType: 'application/json', modifiedTime: '2026-11-05T00:00:00Z' }]
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (u.includes('/upload/drive/v3/files?uploadType=multipart')) {
            return new Response(JSON.stringify({ id: 'g-new-file', name: 'uploaded.txt', size: '20' }), { status: 200 });
        }
        if (u.includes('/drive/v3/about?fields=')) {
            return new Response(JSON.stringify({ storageQuota: { usage: '1000', limit: '5000' } }), { status: 200 });
        }
        if (u.includes('/drive/v3/files/') && options.method === 'DELETE') {
            return new Response(null, { status: 204 });
        }
        return new Response('Not found', { status: 404 });
    };

    const gFiles = await gDrive.listFiles('mock-token', 'parent-id');
    assert.equal(gFiles.length, 1);
    assert.equal(gFiles[0].name, 'manifest.json');
    assert.equal(gFiles[0].size, 1024);

    const gUploaded = await gDrive.uploadFile('mock-token', 'parent-id', 'uploaded.txt', 'hello world');
    assert.equal(gUploaded.id, 'g-new-file');

    const gQuota = await gDrive.getQuota('mock-token');
    assert.equal(gQuota.usedBytes, 1000);
    assert.equal(gQuota.totalBytes, 5000);
    assert.equal(gQuota.available, true);

    const gDeleted = await gDrive.deleteFile('mock-token', 'g-file-01');
    assert.equal(gDeleted, true);

    // 4.2 OneDrive Sync Driver (Microsoft Graph API)
    const msDrive = CloudSync.get('onedrive');
    assert.equal(msDrive.id, 'onedrive');

    sandbox.fetch = async (url, options = {}) => {
        const u = String(url);
        if (u.includes('/me/drive/special/approot')) {
            return new Response(JSON.stringify({ id: 'ms-approot-id', name: 'PortfoliOS' }), { status: 200 });
        }
        if (u.includes('/children') && !options.method) {
            return new Response(JSON.stringify({
                value: [{ id: 'ms-item-1', name: 'workspace.json', size: 512, file: { mimeType: 'application/json' }, lastModifiedDateTime: '2026-11-05T00:00:00Z' }]
            }), { status: 200 });
        }
        if (u.includes('/content') && options.method === 'PUT') {
            return new Response(JSON.stringify({ id: 'ms-uploaded-item', name: 'file.txt', size: 12 }), { status: 200 });
        }
        if (u.includes('/me/drive') && !u.includes('/items') && !u.includes('/special')) {
            return new Response(JSON.stringify({ quota: { used: 2048, total: 1048576 } }), { status: 200 });
        }
        if (options.method === 'DELETE') {
            return new Response(null, { status: 204 });
        }
        return new Response('Not found', { status: 404 });
    };

    const msRoot = await msDrive.ensureAppRoot('ms-token');
    assert.equal(msRoot.id, 'ms-approot-id');

    const msFiles = await msDrive.listFiles('ms-token', 'ms-approot-id');
    assert.equal(msFiles.length, 1);
    assert.equal(msFiles[0].name, 'workspace.json');
    assert.equal(msFiles[0].size, 512);

    const msUploaded = await msDrive.uploadFile('ms-token', 'ms-approot-id', 'file.txt', 'test content');
    assert.equal(msUploaded.id, 'ms-uploaded-item');

    const msQuota = await msDrive.getQuota('ms-token');
    assert.equal(msQuota.usedBytes, 2048);
    assert.equal(msQuota.totalBytes, 1048576);

    // 4.3 Dropbox Sync Driver (Dropbox API v2)
    const dbDrive = CloudSync.get('dropbox');
    assert.equal(dbDrive.id, 'dropbox');

    sandbox.fetch = async (url, options = {}) => {
        const u = String(url);
        if (u.includes('/files/create_folder_v2')) {
            return new Response(JSON.stringify({ metadata: { id: 'id:folder1', name: 'subfolder', path_lower: '/subfolder' } }), { status: 200 });
        }
        if (u.includes('/files/list_folder')) {
            return new Response(JSON.stringify({
                entries: [{
                    '.tag': 'file',
                    id: 'id:file123',
                    name: 'notes.txt',
                    path_display: '/notes.txt',
                    path_lower: '/notes.txt',
                    size: 42,
                    server_modified: '2026-11-05T12:00:00Z'
                }]
            }), { status: 200 });
        }
        if (u.includes('/files/upload')) {
            return new Response(JSON.stringify({ id: 'id:file-up', name: 'uploaded.txt', size: 10 }), { status: 200 });
        }
        if (u.includes('/users/get_space_usage')) {
            return new Response(JSON.stringify({ used: 500000, allocation: { '.tag': 'individual', allocated: 2000000 } }), { status: 200 });
        }
        if (u.includes('/files/delete_v2')) {
            return new Response(JSON.stringify({ metadata: { name: 'notes.txt' } }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
    };

    const dbDir = await dbDrive.ensureDirectory('db-token', '', 'subfolder');
    assert.equal(dbDir.path, '/subfolder');

    const dbFiles = await dbDrive.listFiles('db-token', '');
    assert.equal(dbFiles.length, 1);
    assert.equal(dbFiles[0].name, 'notes.txt');
    assert.equal(dbFiles[0].size, 42);

    const dbUpload = await dbDrive.uploadFile('db-token', '', 'uploaded.txt', '1234567890');
    assert.equal(dbUpload.id, 'id:file-up');

    const dbQuota = await dbDrive.getQuota('db-token');
    assert.equal(dbQuota.usedBytes, 500000);
    assert.equal(dbQuota.totalBytes, 2000000);

    // 4.4 Nextcloud WebDAV Sync Driver
    const ncDrive = CloudSync.get('nextcloud-webdav');
    assert.equal(ncDrive.id, 'nextcloud-webdav');

    const mockDavXml = `<?xml version="1.0" encoding="utf-8"?>
    <d:multistatus xmlns:d="DAV:">
        <d:response>
            <d:href>/remote.php/dav/files/alice/PortfoliOS/</d:href>
            <d:propstat>
                <d:prop>
                    <d:resourcetype><d:collection/></d:resourcetype>
                </d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
            </d:propstat>
        </d:response>
        <d:response>
            <d:href>/remote.php/dav/files/alice/PortfoliOS/budget.csv</d:href>
            <d:propstat>
                <d:prop>
                    <d:getcontentlength>150</d:getcontentlength>
                    <d:getcontenttype>text/csv</d:getcontenttype>
                    <d:getlastmodified>Thu, 05 Nov 2026 12:00:00 GMT</d:getlastmodified>
                    <d:resourcetype/>
                </d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
            </d:propstat>
        </d:response>
    </d:multistatus>`;

    sandbox.fetch = async (url, options = {}) => {
        if (options.method === 'PROPFIND') {
            return new Response(mockDavXml, { status: 207, headers: { 'Content-Type': 'application/xml' } });
        }
        if (options.method === 'MKCOL') {
            return new Response('', { status: 201 });
        }
        if (options.method === 'PUT') {
            return new Response(null, { status: 204 });
        }
        if (options.method === 'DELETE') {
            return new Response(null, { status: 204 });
        }
        return new Response('Not found', { status: 404 });
    };

    const ncCreatedDir = await ncDrive.ensureDirectory('dav-token', 'https://cloud.local', 'alice', 'PortfoliOS');
    assert.equal(ncCreatedDir.name, 'PortfoliOS');

    const ncListed = await ncDrive.listFiles('dav-token', 'https://cloud.local', 'alice', 'PortfoliOS');
    assert.equal(ncListed.length, 1);
    assert.equal(ncListed[0].name, 'budget.csv');
    assert.equal(ncListed[0].size, 150);
    assert.equal(ncListed[0].isDirectory, false);

    const ncUploaded = await ncDrive.uploadFile('dav-token', 'https://cloud.local', 'alice', 'PortfoliOS/test.txt', 'data');
    assert.equal(ncUploaded.name, 'test.txt');

    // =========================================================================
    // SECTION 5: Security & Token Boundary Invariants
    // =========================================================================
    assert.strictEqual(authSource.includes('localStorage.setItem("token"'), false,
        'Auth drivers must NEVER persist raw tokens to localStorage');
    assert.strictEqual(syncSource.includes('localStorage.setItem("token"'), false,
        'Sync drivers must NEVER persist raw tokens to localStorage');
    assert.strictEqual(authSource.includes('sessionStorage.setItem("token"'), false,
        'Auth drivers must NEVER persist raw tokens to sessionStorage');
    assert.strictEqual(syncSource.includes('sessionStorage.setItem("token"'), false,
        'Sync drivers must NEVER persist raw tokens to sessionStorage');

    console.log('PASS: Cloud Auth & Sync Driver test suite completed successfully.');
})();
