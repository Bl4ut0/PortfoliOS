"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const syncSource = fs.readFileSync(path.join(root, "core", "gdrive-sync.js"), "utf8");
const records = new Map();
const storage = new Map();
const listeners = new Map();

const SystemFS = {
    async ensureDirectory(filePath, options = {}) {
        if (!records.has(filePath)) {
            records.set(filePath, {
                path: filePath,
                data: null,
                isDirectory: true,
                metadata: options.metadata || {}
            });
        }
    },
    async writeFile(filePath, name, parent, data, size, type, isDirectory, options = {}) {
        const record = { path: filePath, name, parent, data, size, type, isDirectory, metadata: options.metadata || {} };
        records.set(filePath, record);
        return record;
    },
    async readFile(filePath) {
        return records.get(filePath) || null;
    },
    async deleteFile(filePath) {
        records.delete(filePath);
    }
};

const localApi = {
    get: (key) => storage.has(key) ? storage.get(key) : null,
    set: (key, value) => storage.set(key, String(value)),
    remove: (key) => storage.delete(key)
};

const documentMock = {
    visibilityState: "hidden",
    addEventListener: () => {},
    getElementById: () => null,
    body: { appendChild: () => {} }
};

const windowObject = {
    state: { currentUserId: "bl4ut0", gdriveConnected: false },
    location: { origin: "https://os.bl4ut0.dev" },
    Storage: { local: localApi },
    SystemFS,
    localStorage: { getItem: localApi.get, setItem: localApi.set, removeItem: localApi.remove, get length() { return storage.size; }, key: i => Array.from(storage.keys())[i] || null },
    sessionStorage: { length: 0, key: () => null, removeItem: () => {} },
    EventBus: {
        on: (name, callback) => listeners.set(name, callback),
        emit: (name, data) => listeners.get(name)?.(data)
    },
    readFilesystemRecordText: async (record) => String(record.data || ""),
    getSavedPrivateProfile: () => null,
    escapeHtml: (value) => String(value),
    setTimeout,
    clearTimeout
};

const sandbox = {
    window: windowObject,
    document: documentMock,
    console,
    Blob,
    URLSearchParams,
    fetch: async () => ({ ok: true, json: async () => ({ sub: "google-test-user", name: "Test User", email: "test@example.com" }) }),
    setTimeout,
    clearTimeout
};
windowObject.window = windowObject;
windowObject.document = documentMock;

vm.runInNewContext(
    fs.readFileSync(path.join(root, "core", "gdrive-sync.js"), "utf8"),
    sandbox,
    { filename: "core/gdrive-sync.js" }
);

(async () => {
    assert.strictEqual(syncSource.includes("accessToken: this.token"), false, "Cloud Sync must not serialize the raw access token into SystemFS");
    assert.strictEqual(syncSource.includes('local.set("bl4ut0_gdrive_token"'), false, "Cloud Sync must not persist the raw token in browser storage");
    const sync = windowObject.GDriveSync;
    assert.strictEqual(sync.canPresentReconnectPrompt(), false, "the reconnect prompt must stay hidden behind the experience selector");
    windowObject.state.systemStarted = true;
    windowObject.state.view = "quick";
    assert.strictEqual(sync.canPresentReconnectPrompt(), false, "the reconnect prompt must never be shown in Quick");
    windowObject.state.view = "desktop";
    assert.strictEqual(sync.canPresentReconnectPrompt(), false, 'Public Desktop must never request Drive reconnect');
    windowObject.state.view = 'mobile';
    assert.strictEqual(sync.showReconnectPrompt('expired'), false, 'Public Mobile must never show Drive reconnect');
    windowObject.state.currentUserId = 'private_example';
    windowObject.state.view = 'desktop';
    assert.strictEqual(sync.canPresentReconnectPrompt(), true, 'Private Desktop can request Drive reconnect');
    windowObject.state.currentUserId = 'bl4ut0';
    windowObject.state.systemStarted = false;
    const freshInstall = await sync.restoreSession({ promptOnInvalid: false });
    assert.strictEqual(freshInstall.status, "disconnected", "a fresh browser without a saved account must remain disconnected");
    sync.token = "test-access-token";
    sync.tokenExpiresAt = Date.now() + 60_000;
    sync.googleProfile = { name: "Test User", email: "test@example.com" };
    await sync.persistAuthRecord();

    const authPath = "/home/bl4ut0/.auth/google-drive.json";
    const saved = records.get(authPath);
    assert(saved, "auth record should be written to the current user's SystemFS home");
    assert.strictEqual(saved.metadata.sync, false, "auth records must never be uploaded to Drive");
    const savedAuth = JSON.parse(saved.data);
    assert.strictEqual(savedAuth.accessToken, undefined, "SystemFS auth records must never retain a bearer token");
    assert.strictEqual(savedAuth.sessionMode, "memory-only", "Cloud Sync must declare its local-only memory session policy");

    sync.clearBrowserSession();
    storage.delete("bl4ut0_gdrive_token");
    storage.delete("bl4ut0_gdrive_token_expiry");
    const restored = await sync.restoreSession({ promptOnInvalid: false });
    assert.strictEqual(restored.status, "invalid");
    assert.strictEqual(sync.getToken(), null);
    assert.strictEqual(windowObject.state.gdriveConnected, false);

    await sync.invalidateSession("Session rejected.");
    const invalidRecord = JSON.parse(records.get(authPath).data);
    assert.strictEqual(invalidRecord.requiresReconnect, true);
    assert.strictEqual(invalidRecord.accessToken, undefined);

    sync.clearBrowserSession();
    const invalid = await sync.restoreSession({ promptOnInvalid: false });
    assert.strictEqual(invalid.status, "invalid");
    assert.strictEqual(windowObject.state.gdriveConnected, false);

    windowObject.google = {
        accounts: {
            oauth2: {
                initTokenClient: (config) => ({
                    requestAccessToken: () => config.error_callback({ type: "popup_closed" })
                })
            }
        }
    };
    await assert.rejects(
        sync.login("test-client-id", { timeoutMs: 100 }),
        /closed before it finished/,
        "closing the Google popup must release the connecting state"
    );

    windowObject.google.accounts.oauth2.initTokenClient = () => ({
        requestAccessToken: () => {}
    });
    await assert.rejects(
        sync.login("test-client-id", { timeoutMs: 10 }),
        /timed out/,
        "a missing Google callback must not leave login pending forever"
    );

    const persistAuthRecord = sync.persistAuthRecord;
    sync.persistAuthRecord = async () => {
        throw new Error("SystemFS session save failed.");
    };
    windowObject.google.accounts.oauth2.initTokenClient = (config) => ({
        requestAccessToken: () => config.callback({
            access_token: "new-access-token",
            expires_in: 3600
        })
    });
    await assert.rejects(
        sync.login("test-client-id", { timeoutMs: 100 }),
        /SystemFS session save failed/,
        "async callback failures must reject the outer login promise"
    );
    assert.strictEqual(windowObject.state.gdriveConnected, false, "a session that could not be saved must not appear connected");
    sync.persistAuthRecord = persistAuthRecord;


    // Exercise real profile activation, the user-change event, and a new-page boot.
    sandbox.localStorage = windowObject.localStorage;
    sandbox.document.querySelector = () => null;
    vm.runInNewContext(fs.readFileSync(path.join(root, "data/users.js"), "utf8"), sandbox, { filename: "data/users.js" });
    windowObject.applyCurrentUserProfile = () => {};
    await sync.login("test-client-id", { timeoutMs: 1000 });
    assert.strictEqual(windowObject.state.currentUserId, "private_google-test-user", "Google sign-in must activate the private workspace before backup");
    assert.strictEqual(sync.getToken(), "new-access-token", "switching to the signed-in workspace must retain the live Google token");
    const privateProfile = windowObject.getSavedPrivateProfile();
    assert.strictEqual(privateProfile.sub, "google-test-user");
    assert.strictEqual(privateProfile.email, "test@example.com");
    assert(records.has("/home/private_google-test-user/settings.json"), "private preferences must enter SystemFS before backup");
    assert(records.has("/home/private_google-test-user/.auth/google-drive.json"), "connection metadata must belong to the private workspace");
    localApi.set('bl4ut0_bl4ut0_Wallpaper', 'custom');
    localApi.set('bl4ut0_installed_apps', '["diablo"]');
    localApi.set('desktop_pos_bl4ut0_store', '{"x":999}');
    localApi.set('bl4ut0_bl4ut0_mobile_home_v1', '{"custom":true}');
    localApi.set('bl4ut0_private_google-test-user_Wallpaper', 'private-custom');
    const reloadWindow = { Storage: { local: localApi } };
    vm.runInNewContext(fs.readFileSync(path.join(root, "core/state.js"), "utf8"), { window: reloadWindow, localStorage: windowObject.localStorage, console });
    assert.strictEqual(reloadWindow.state.currentUserId, "private_google-test-user", "a reload must restore the remembered Google private workspace");
    assert.strictEqual(localApi.get('bl4ut0_installed_apps'), null, 'reload removes public installed apps');
    assert.strictEqual(localApi.get('bl4ut0_bl4ut0_Wallpaper'), null, 'reload removes public preferences');
    assert.strictEqual(localApi.get('desktop_pos_bl4ut0_store'), null, 'reload removes public icon layout');
    assert.strictEqual(localApi.get('bl4ut0_bl4ut0_mobile_home_v1'), null, 'reload removes public mobile layout');
    assert.strictEqual(localApi.get('bl4ut0_private_google-test-user_Wallpaper'), 'private-custom', 'reload preserves private preferences');
    assert.strictEqual(reloadWindow.state.gdriveConnected, false, "remembered identity must not impersonate a live Google authorization");
    sandbox.fetch = async () => ({ ok: true, json: async () => ({ sub: "another-user", email: "other@example.com" }) });
    windowObject.google.accounts.oauth2.initTokenClient = config => ({ requestAccessToken: options => {
        assert.strictEqual(options.prompt, "select_account");
        config.callback({ access_token: "second-account-token", expires_in: 3600 });
    } });
    await sync.login("test-client-id", { timeoutMs: 1000, selectAccount: true });
    assert.strictEqual(sync.getToken(), "second-account-token");
    assert.strictEqual(windowObject.state.currentUserId, "private_another-user", "a second Google identity needs its own profile");
    assert.strictEqual(windowObject.getSavedPrivateProfile("private_google-test-user").sub, "google-test-user", "a second account must preserve the first workspace");
    assert(records.has("/home/private_another-user/settings.json"), "preferences must be scoped to the second profile");
    windowObject.setCurrentUser("private_google-test-user");
    storage.set("bl4ut0_private_google-test-user_ThemeId", "light");
    storage.set("bl4ut0_private_another-user_ThemeId", "dark");
    await windowObject.savePreferencesToFilesystem();
    const ownSettings = JSON.parse(records.get("/home/private_google-test-user/settings.json").data);
    assert.strictEqual(ownSettings["bl4ut0_private_google-test-user_ThemeId"], "light");
    assert.strictEqual(ownSettings["bl4ut0_private_another-user_ThemeId"], undefined);
    assert.strictEqual(sync.getToken(), "new-access-token", "switching back must reuse the first account's live in-memory authorization");
    windowObject.setCurrentUser("bl4ut0");
    const ownerReload = { Storage: { local: localApi } };
    vm.runInNewContext(fs.readFileSync(path.join(root, "core/state.js"), "utf8"), { window: ownerReload, localStorage: windowObject.localStorage, console });
    assert.strictEqual(ownerReload.state.currentUserId, "bl4ut0", "explicit return to public access must survive reload");
    storage.set("bl4ut0_private_profiles", "{}");
    storage.set("bl4ut0_private_user_profile", "broken-json");
    storage.set("bl4ut0CurrentUser", "private");
    const malformedReload = { Storage: { local: localApi } };
    vm.runInNewContext(fs.readFileSync(path.join(root, "core/state.js"), "utf8"), { window: malformedReload, localStorage: windowObject.localStorage, console });
    assert.strictEqual(malformedReload.state.currentUserId, "bl4ut0", "malformed profile metadata must not activate a private workspace");


    // The isolated shell must use a nonce-bound in-memory popup channel.
    let brokerChannel;
    windowObject.crossOriginIsolated = true;
    windowObject.crypto = { randomUUID: () => "12345678-1234-1234-1234-123456789abc" };
    windowObject.BroadcastChannel = class {
        constructor(name) { this.name = name; brokerChannel = this; }
        close() { this.closed = true; }
    };
    windowObject.open = url => {
        assert(url.startsWith("/auth/google.php#"));
        assert(!url.includes("access_token"), "the popup URL must never contain a bearer token");
        const params = new URLSearchParams(url.split("#")[1]);
        assert.strictEqual(params.get("prompt"), "select_account");
        setTimeout(() => {
            brokerChannel.onmessage({ data: { type: "google-auth-result", nonce: "wrong-nonce", response: { access_token: "wrong" } } });
            brokerChannel.onmessage({ data: { type: "google-auth-result", nonce: params.get("nonce"), response: { access_token: "broker-token", expires_in: 3600 } } });
        }, 0);
        return {};
    };
    await sync.login("test-client-id", { timeoutMs: 1000, selectAccount: true });
    assert.strictEqual(sync.getToken(), "broker-token");
    assert.strictEqual(brokerChannel.closed, true, "the successful channel must be closed");
    windowObject.open = () => null;
    await assert.rejects(sync.login("test-client-id", { timeoutMs: 100 }), /blocked/);
    assert.strictEqual(brokerChannel.closed, true, "a blocked popup must close its channel");
    windowObject.open = () => ({});
    await assert.rejects(sync.login("test-client-id", { timeoutMs: 10 }), /timed out/);
    assert.strictEqual(brokerChannel.closed, true, "an abandoned popup must close its channel");
    windowObject.crossOriginIsolated = false;

    // A first backup on a device must restore existing cloud preferences rather
    // than overwriting them with recently generated defaults.
    const currentId = windowObject.state.currentUserId;
    const settingsPath = "/home/" + currentId + "/settings.json";
    sync.fetchRemoteFiles = async () => [{ id: "remote-settings", name: "settings.json", mimeType: "application/json", modifiedTime: new Date().toISOString(), appProperties: { path: settingsPath } }];
    windowObject.SystemFS.getAllFiles = async () => [{ path: settingsPath, name: "settings.json", data: "{}", lastModified: Date.now(), type: "application/json" }];
    sync.downloadFile = async () => new Blob(['{}'], { type: "application/json" });
    let importedPath = null;
    windowObject.SecurityKernel = { scanExisting: async record => ({ status: "accepted", record }), importFile: async input => { importedPath = input.path; return { status: "accepted" }; } };
    sync.updateFile = async () => { throw new Error("Default preferences must not overwrite cloud settings on first sync"); };
    await sync.sync();
    assert.strictEqual(importedPath, settingsPath);
    assert.strictEqual(sync.syncInProgress, false);


    const manifestKey = sync.getScopedStorageKey("sync_manifest");
    const successKey = sync.getScopedStorageKey("last_sync_time");
    storage.delete(manifestKey);
    storage.delete(successKey);
    sync.downloadFile = async () => { throw new Error("Simulated interrupted download"); };
    const originalError = console.error;
    console.error = () => {};
    try { await assert.rejects(sync.sync(), /Backup incomplete/); } finally { console.error = originalError; }
    assert.strictEqual(storage.get(successKey), undefined, "a partial backup must not advance the success timestamp");
    assert.strictEqual(storage.get(manifestKey), undefined, "a partial backup must not advance the deletion manifest");
    assert.strictEqual(sync.syncInProgress, false, "a failed backup must release the profile-switch lock");

    const nativeTimeout = windowObject.setTimeout;
    const nativeClear = windowObject.clearTimeout;
    let scheduledSync;
    let automaticBackups = 0;
    windowObject.setTimeout = callback => { scheduledSync = callback; return 42; };
    windowObject.clearTimeout = () => {};
    windowObject.triggerGDriveSync = () => { automaticBackups++; };
    sync.scheduleAutomaticSync();
    scheduledSync();
    assert.strictEqual(automaticBackups, 1, "a connected private workspace must schedule automatic backup");
    sync.scheduleAutomaticSync();
    windowObject.setCurrentUser("bl4ut0");
    scheduledSync();
    assert.strictEqual(automaticBackups, 1, "a queued backup must never run under another selected account");
    windowObject.setTimeout = nativeTimeout;
    windowObject.clearTimeout = nativeClear;

    windowObject.clearTimeout(sync.pendingSyncTimer);
    console.log("Google Drive session audit passed: private account activation, multi-account switching, reloads, isolated popup channels, preference restore, and memory-only credentials checked.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
