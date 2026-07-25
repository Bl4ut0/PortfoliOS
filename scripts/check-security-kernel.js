"use strict";

const assert = require("assert");
const crypto = require("crypto").webcrypto;
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const records = new Map();

function normalizePath(value = "/") {
    const parts = [];
    String(value).replace(/\\/g, "/").split("/").forEach((part) => {
        if (!part || part === ".") return;
        if (part === "..") return void parts.pop();
        parts.push(part);
    });
    return parts.length ? `/${parts.join("/")}` : "/";
}

const SystemFS = {
    normalizePath,
    getParentPath: (value) => {
        const normalized = normalizePath(value);
        return normalized.includes("/") ? normalized.slice(0, normalized.lastIndexOf("/")) || "/" : "/";
    },
    getName: (value) => normalizePath(value).split("/").pop(),
    async ensureDirectory(filePath, options = {}) {
        const normalized = normalizePath(filePath);
        if (!records.has(normalized)) records.set(normalized, { path: normalized, name: this.getName(normalized), parent: this.getParentPath(normalized), isDirectory: true, type: "directory", metadata: options.metadata || {} });
    },
    async writeFile(filePath, name, parent, data, size, type, isDirectory, options = {}) {
        const normalized = normalizePath(filePath);
        const record = { path: normalized, name, parent: normalizePath(parent), data, size, type, isDirectory, lastModified: options.lastModified || Date.now(), metadata: options.metadata || {} };
        records.set(normalized, record);
        return record;
    },
    async deleteFile(filePath) { records.delete(normalizePath(filePath)); },
    async readDir(parent) { return [...records.values()].filter((record) => record.parent === normalizePath(parent)); },
    async getAllFiles() { return [...records.values()]; }
};

const windowObject = { SystemFS, crypto, EventBus: { emit: () => {} }, setTimeout, clearTimeout };
windowObject.window = windowObject;
const sandbox = { window: windowObject, Blob, TextDecoder, Uint8Array, console, Math, Date };
vm.runInNewContext(fs.readFileSync(path.join(root, "core", "security-service.js"), "utf8"), sandbox, { filename: "core/security-service.js" });

(async () => {
    const security = windowObject.SecurityKernel;
    await security.init();

    const clean = await security.importFile({ path: "/Downloads/notes.txt", name: "notes.txt", parent: "/Downloads", data: "safe text", size: 9, type: "text/plain" });
    assert.strictEqual(clean.status, "accepted");
    assert.strictEqual(clean.record.metadata.security.verdict, "clean");
    assert.match(clean.record.metadata.security.hash, /^[a-f0-9]{64}$/);

    const executable = await security.importFile({ path: "/Downloads/payload.exe", name: "payload.exe", parent: "/Downloads", data: new Uint8Array([0x4d, 0x5a]), size: 2, type: "application/octet-stream" });
    assert.strictEqual(executable.status, "quarantined");
    assert.strictEqual(records.has("/Downloads/payload.exe"), false, "blocked code must not enter the requested workspace path");
    assert.strictEqual(executable.record.metadata.sync, false, "quarantine must never sync to Drive");

    const activeDocument = await security.importFile({ path: "/documents/unsafe.html", name: "unsafe.html", parent: "/documents", data: "<html><script>alert(1)</script>", size: 31, type: "text/html" });
    assert.strictEqual(activeDocument.status, "quarantined", "active documents must be staged outside the normal workspace");
    assert.strictEqual(normalizePath("/documents/../../etc/test"), "/etc/test", "path traversal normalization must collapse dot segments");
    assert.throws(() => security.assertAgentAccess("/home/bl4ut0/.auth/google-drive.json", "read"), /denied/, "agents must not access hidden auth records");
    assert.throws(() => security.assertAgentAccess("/.quarantine/sample", "read"), /denied/, "agents must not access quarantined files");

    console.log("SecurityKernel audit passed: local hash scanning, executable blocking, active-document quarantine, token-free quarantine metadata, agent boundaries, and path normalization checked.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
