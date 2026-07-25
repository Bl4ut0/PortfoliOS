"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
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
    localStorage: { getItem: localApi.get, setItem: localApi.set, removeItem: localApi.remove },
    sessionStorage: { length: 0, key: () => null, removeItem: () => {} },
    EventBus: {
        on: (name, callback) => listeners.set(name, callback),
        emit: () => {}
    },
    readFilesystemRecordText: async (record) => String(record.data || ""),
    getSavedPrivateProfile: () => null,
    escapeHtml: (value) => String(value),
    setTimeout
};

const sandbox = {
    window: windowObject,
    document: documentMock,
    console,
    Blob,
    URLSearchParams,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout
};
windowObject.window = windowObject;
windowObject.document = documentMock;

vm.runInNewContext(
    fs.readFileSync(path.join(root, "core", "gdrive-sync.js"), "utf8"),
    sandbox,
    { filename: "core/gdrive-sync.js" }
);

(async () => {
    const sync = windowObject.GDriveSync;
    sync.token = "test-access-token";
    sync.tokenExpiresAt = Date.now() + 60_000;
    sync.googleProfile = { name: "Test User", email: "test@example.com" };
    await sync.persistAuthRecord();

    const authPath = "/home/bl4ut0/.auth/google-drive.json";
    const saved = records.get(authPath);
    assert(saved, "auth record should be written to the current user's SystemFS home");
    assert.strictEqual(saved.metadata.sync, false, "auth records must never be uploaded to Drive");
    assert.match(saved.data, /test-access-token/, "auth record should contain the restorable access token");

    sync.clearBrowserSession();
    storage.delete("bl4ut0_gdrive_token");
    storage.delete("bl4ut0_gdrive_token_expiry");
    const restored = await sync.restoreSession({ promptOnInvalid: false });
    assert.strictEqual(restored.status, "restored");
    assert.strictEqual(sync.getToken(), "test-access-token");
    assert.strictEqual(windowObject.state.gdriveConnected, true);

    await sync.invalidateSession("Session rejected.");
    const invalidRecord = JSON.parse(records.get(authPath).data);
    assert.strictEqual(invalidRecord.requiresReconnect, true);
    assert.strictEqual(invalidRecord.accessToken, undefined);

    sync.clearBrowserSession();
    const invalid = await sync.restoreSession({ promptOnInvalid: false });
    assert.strictEqual(invalid.status, "invalid");
    assert.strictEqual(windowObject.state.gdriveConnected, false);

    console.log("Google Drive session audit passed: SystemFS persistence, restore, token isolation, and reconnect state checked.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
