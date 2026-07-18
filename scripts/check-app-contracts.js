"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const WINDOW_PRESETS = new Set([
    "app-window",
    "utility-window",
    "service-window",
    "document-window",
    "media-window",
    "game-window"
]);
const LIFECYCLE_HOOKS = ["onOpen", "onRestore", "onFocus", "onMinimize", "onMaximize", "onClose"];
const failures = [];

function fail(scope, message) {
    failures.push(`${scope}: ${message}`);
}

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function loadCatalog() {
    const storage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    };
    const sandbox = {
        window: {
            state: { currentUserId: "audit" },
            Storage: { local: { get: () => null, set: () => {}, remove: () => {} } }
        },
        localStorage: storage,
        console
    };
    sandbox.window.window = sandbox.window;
    vm.runInNewContext(read("data/systems.js"), sandbox, { filename: "data/systems.js" });
    vm.runInNewContext(read("data/mobile-apps.js"), sandbox, { filename: "data/mobile-apps.js" });
    vm.runInNewContext(read("data/apps.js"), sandbox, { filename: "data/apps.js" });
    return sandbox.window;
}

function findDuplicates(values) {
    const seen = new Set();
    const duplicates = new Set();
    values.forEach((value) => {
        if (seen.has(value)) duplicates.add(value);
        seen.add(value);
    });
    return [...duplicates];
}

function createIframeGameRegistration(config) {
    return {
        title: config.title,
        icon: config.icon,
        windowClass: config.windowClass,
        renderBody: () => "<div class=\"game-shell\"></div>",
        onOpen: () => {},
        onRestore: () => {},
        onFocus: () => {},
        onMinimize: () => {},
        onMaximize: () => {},
        onClose: () => {}
    };
}

function evaluateAppWindow(appId, source) {
    const storage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    };
    const quietConsole = { log: () => {}, info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    const windowObject = {
        appRegistry: {},
        createIframeGameApp: createIframeGameRegistration,
        addEventListener: () => {},
        removeEventListener: () => {},
        setTimeout: () => 1,
        clearTimeout: () => {},
        setInterval: () => 1,
        clearInterval: () => {},
        location: { origin: "http://127.0.0.1:8000", href: "http://127.0.0.1:8000/" },
        localStorage: storage
    };
    const sandbox = {
        window: windowObject,
        localStorage: storage,
        console: quietConsole,
        performance: { now: () => 0, memory: null },
        navigator: { hardwareConcurrency: 8 },
        requestAnimationFrame: () => 1,
        cancelAnimationFrame: () => {},
        setTimeout: () => 1,
        clearTimeout: () => {},
        setInterval: () => 1,
        clearInterval: () => {},
        PerformanceObserver: class {
            observe() {}
            disconnect() {}
        },
        Blob: global.Blob,
        URL,
        AbortController,
        TextDecoder,
        TextEncoder,
        ArrayBuffer,
        Uint8Array
    };
    windowObject.window = windowObject;
    vm.runInNewContext(source, sandbox, { filename: `apps/${appId}/app.js` });
    return windowObject;
}

function evaluateRegistration(appId, source) {
    return evaluateAppWindow(appId, source).appRegistry[appId];
}

function evaluateMobileRegistration(appId, source) {
    const mobileQuietConsole = { log: () => {}, info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    const windowObject = {
        mobileAppRegistry: {},
        renderMobileProjectCard: () => "<section></section>",
        loadScript: async () => {}
    };
    windowObject.window = windowObject;
    vm.runInNewContext(source, { window: windowObject, console: mobileQuietConsole }, {
        filename: `mobile/apps/${appId}/app.js`
    });
    return windowObject.mobileAppRegistry[appId];
}

async function validateMobileStorageContract() {
    const filesystemScope = "core/filesystem.js";
    const filesystemSandbox = { window: {}, console: { log: () => {}, warn: () => {}, error: () => {} } };
    vm.runInNewContext(read(filesystemScope), filesystemSandbox, { filename: filesystemScope });

    const systemFS = filesystemSandbox.window.SystemFS;
    if (!systemFS || typeof systemFS.ensureDefaultFiles !== "function") {
        fail(filesystemScope, "shared SystemFS default storage initializer is unavailable");
        return;
    }

    const records = new Map();
    const writes = [];
    systemFS.readFile = async (filePath) => records.get(filePath) || null;
    systemFS.writeFile = async (filePath, name, parent, data, size, type, isDirectory, options = {}) => {
        const record = { path: filePath, name, parent, data, size, type, isDirectory, options };
        records.set(filePath, record);
        writes.push(record);
        return record;
    };

    try {
        await systemFS.ensureDefaultFiles();
        await systemFS.ensureDefaultFiles();
    } catch (error) {
        fail(filesystemScope, `default storage initialization failed in the audit sandbox: ${error.message}`);
        return;
    }

    const expectedRoots = ["/documents", "/music", "/Pictures", "/Downloads", "/ROMs", "/Saved Games"];
    expectedRoots.forEach((rootPath) => {
        const record = records.get(rootPath);
        if (!record || record.parent !== "/" || record.isDirectory !== true || record.type !== "directory") {
            fail(filesystemScope, `missing default root directory ${rootPath}`);
        }
        const rootWrites = writes.filter((write) => write.path === rootPath);
        if (rootWrites.length !== 1) {
            fail(filesystemScope, `${rootPath} must be created idempotently; observed ${rootWrites.length} writes across two startup passes`);
        }
    });
    if (records.has("/DCIM") || read(filesystemScope).includes('"/DCIM"')) {
        fail(filesystemScope, "the mobile storage contract must not create a /DCIM root");
    }

    const filesScope = "mobile/apps/files/app.js";
    let filesRegistration;
    try {
        filesRegistration = evaluateMobileRegistration("files", read(filesScope));
    } catch (error) {
        fail(filesScope, `Files could not register in the storage audit sandbox: ${error.message}`);
        return;
    }
    const renderedFiles = filesRegistration?.render?.() || "";
    ["/", "/Downloads", "/Pictures", "/documents", "/music"].forEach((location) => {
        const marker = `data-files-location="${location}"`;
        const occurrences = renderedFiles.split(marker).length - 1;
        if (occurrences !== 1) {
            fail(filesScope, `primary storage location ${location} must be rendered exactly once`);
        }
    });
    if (renderedFiles.includes('data-files-location="/DCIM"')) {
        fail(filesScope, "Files must not expose a /DCIM primary location");
    }
}

function validateMobileFrameworkContract(catalog) {
    const apps = Array.isArray(catalog.mobileAppCatalog) ? catalog.mobileAppCatalog : [];
    const evictionStateApps = new Set(["browser", "calculator", "documents", "files"]);
    const ids = apps.map((app) => app.id);
    findDuplicates(ids).forEach((id) => fail("data/mobile-apps.js", `duplicate mobile app ID "${id}"`));
    if (JSON.stringify(catalog.mobileAppIds || []) !== JSON.stringify(ids)) {
        fail("data/mobile-apps.js", "window.mobileAppIds must be derived from the independent mobile catalog");
    }

    const desktopCatalogSource = read("data/apps.js");
    const mobileCatalogSource = read("data/mobile-apps.js");
    if (mobileCatalogSource.includes("desktopApps") || desktopCatalogSource.includes("mobileAppCatalog")) {
        fail("catalog-boundary", "desktop and mobile catalogs must not derive from one another");
    }

    const mobileShell = read("mobile/shell.js");
    if (/desktopApps|renderSystemArticle|systems\.filter/.test(mobileShell)) {
        fail("mobile/shell.js", "the mobile shell must use its own catalog and renderer, not desktop or generic system launch logic");
    }
    ["ensureMobileAppLoaded", "runMobileAppLifecycle", "unloadMobileApp"].forEach((marker) => {
        const combined = `${read("mobile/app-framework.js")}\n${read("mobile/app-loader.js")}\n${mobileShell}`;
        if (!combined.includes(marker)) fail("mobile-framework", `missing independent mobile contract marker ${marker}`);
    });

    const systemIds = new Set((catalog.systems || []).map((system) => system.id));
    apps.forEach((catalogApp) => {
        const appId = String(catalogApp.id || "");
        if (!APP_ID_PATTERN.test(appId)) fail("data/mobile-apps.js", `invalid mobile app ID "${appId}"`);
        ["sourceId", "visibilitySourceId"].forEach((field) => {
            if (catalogApp[field] && !systemIds.has(catalogApp[field])) {
                fail(`mobile:${appId}`, `unknown neutral system data source "${catalogApp[field]}" in ${field}`);
            }
        });
        if (catalogApp.sourceId && catalogApp.visibilitySourceId) {
            fail(`mobile:${appId}`, "use sourceId for representative apps or visibilitySourceId for profile gating, not both");
        }
        ["title", "icon", "color", "category"].forEach((field) => {
            if (typeof catalogApp[field] !== "string" || !catalogApp[field].trim()) {
                fail(`mobile:${appId}`, `${field} must be a non-empty string`);
            }
        });

        const jsPath = path.join(ROOT, "mobile", "apps", appId, "app.js");
        const cssPath = path.join(ROOT, "mobile", "apps", appId, "app.css");
        if (!fs.existsSync(jsPath)) fail(`mobile:${appId}`, "missing mobile/apps/<id>/app.js");
        if (!fs.existsSync(cssPath)) fail(`mobile:${appId}`, "missing mobile/apps/<id>/app.css");
        if (!fs.existsSync(jsPath) || !fs.existsSync(cssPath)) return;

        let registration;
        try {
            registration = evaluateMobileRegistration(appId, fs.readFileSync(jsPath, "utf8"));
        } catch (error) {
            fail(`mobile:${appId}`, `module could not register: ${error.message}`);
            return;
        }
        if (!registration || typeof registration !== "object") {
            fail(`mobile:${appId}`, "module did not register its catalog ID");
            return;
        }
        ["title", "icon", "viewClass"].forEach((field) => {
            if (typeof registration[field] !== "string" || !registration[field].trim()) {
                fail(`mobile:${appId}`, `${field} must be a non-empty string`);
            }
        });
        if (typeof registration.render !== "function") fail(`mobile:${appId}`, "render must be a function");
        ["onOpen", "onResume", "onPause", "onBack", "onIntent", "serializeState", "restoreState", "onClose"].forEach((hook) => {
            if (registration[hook] != null && typeof registration[hook] !== "function") {
                fail(`mobile:${appId}`, `${hook} must be a function when provided`);
            }
        });
        const hasSerializeState = typeof registration.serializeState === "function";
        const hasRestoreState = typeof registration.restoreState === "function";
        if (hasSerializeState !== hasRestoreState) {
            fail(`mobile:${appId}`, "serializeState and restoreState must be implemented together");
        }
        if (evictionStateApps.has(appId) && (!hasSerializeState || !hasRestoreState)) {
            fail(`mobile:${appId}`, "stateful retained app must survive LRU eviction");
        }
        const css = fs.readFileSync(cssPath, "utf8");
        if (!css.includes(`.mobile-native-app.${registration.viewClass}`)) {
            fail(`mobile:${appId}`, `app.css must scope a .mobile-native-app.${registration.viewClass} root`);
        }
    });

    const mobileAppsRoot = path.join(ROOT, "mobile", "apps");
    if (fs.existsSync(mobileAppsRoot)) {
        fs.readdirSync(mobileAppsRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .forEach((entry) => {
                if (!ids.includes(entry.name)) fail(`mobile:${entry.name}`, "module folder is absent from mobileAppCatalog");
            });
    }
    return ids.length;
}

function validateIPTVContract() {
    const scope = "apps/iptv/app.js";
    const source = read(scope);
    const appWindow = evaluateAppWindow("iptv", source);
    const tools = appWindow.IPTVStreamTools;
    if (!tools) {
        fail(scope, "IPTV parsing and cache diagnostics were not registered");
        return;
    }

    const rendered = appWindow.appRegistry.iptv?.renderBody?.() || "";
    [
        "data-iptv-video",
        "data-iptv-source-mode=\"xtream\"",
        "data-iptv-source-mode=\"m3u\"",
        "data-iptv-source-mode=\"upload\"",
        "data-iptv-protocol-alert",
        "data-iptv-guide-list"
    ].forEach((marker) => {
        if (!rendered.includes(marker)) fail(scope, `rendered shell is missing ${marker}`);
    });

    const playlist = `#EXTM3U url-tvg="https://guide.example/epg.xml"
#EXTINF:-1 tvg-id="news.one" tvg-logo="https://img.example/news.png" group-title="News",News, One
https://stream.example/live/news.m3u8
#EXTINF:-1 group-title="Sports",Arena
/live/arena.ts`;
    const parsed = tools.parseM3U(playlist, "https://stream.example/list/playlist.m3u");
    if (parsed.channels.length !== 2
        || parsed.channels[0].name !== "News, One"
        || parsed.channels[0].streamKind !== "hls"
        || parsed.channels[1].streamUrl !== "https://stream.example/live/arena.ts"
        || parsed.channels[1].streamKind !== "mpegts"
        || parsed.epgUrl !== "https://guide.example/epg.xml") {
        fail(scope, `M3U metadata, relative URLs, or stream format detection regressed: ${JSON.stringify(parsed)}`);
    }

    const zonedTimestamp = tools.parseXmltvDate("20260101010000 +0200");
    if (zonedTimestamp !== Date.UTC(2025, 11, 31, 23, 0, 0)) {
        fail(scope, "XMLTV timezone offsets are not normalized to UTC correctly");
    }

    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const retained = { s: now - 1000, e: now + 1000, t: "Current" };
    const pruned = tools.pruneEpgCache({
        schemaVersion: 1,
        fetchedAt: now,
        channels: { channel: { name: "Channel" } },
        programmes: {
            channel: [
                { s: now - (14 * 60 * 60 * 1000), e: now - (13 * 60 * 60 * 1000), t: "Old" },
                retained,
                { s: now + (74 * 60 * 60 * 1000), e: now + (75 * 60 * 60 * 1000), t: "Too far" }
            ]
        }
    }, now);
    if (!pruned || pruned.programmeCount !== 1 || pruned.programmes.channel[0].t !== retained.t) {
        fail(scope, "EPG retention did not keep only the bounded current window");
    }

    const expired = tools.pruneEpgCache({
        schemaVersion: 1,
        fetchedAt: now - (25 * 60 * 60 * 1000),
        channels: {},
        programmes: {}
    }, now);
    if (expired !== null) {
        fail(scope, "EPG caches older than 24 hours must be evicted");
    }

    if (!source.includes("parseXmltvStream") || !source.includes("response.body")) {
        fail(scope, "large XMLTV sources must be parsed incrementally from the response stream");
    }
    if (/25 MB browser limit|80 MB browser limit/.test(source)) {
        fail(scope, "IPTV source files must not be rejected by the retired whole-file size limits");
    }
    if (/cdn\.jsdelivr\.net/.test(source) || !source.includes('type: "mse"')) {
        fail(scope, "playback engines must be local and raw TS playback must use MSE autodetection");
    }
}

function validateRegistration(appId, app) {
    if (!app || typeof app !== "object") {
        fail(appId, "app.js did not register the catalog ID in window.appRegistry");
        return null;
    }

    ["title", "icon", "windowClass"].forEach((field) => {
        if (typeof app[field] !== "string" || !app[field].trim()) {
            fail(appId, `${field} must be a non-empty string`);
        }
    });
    if (typeof app.renderBody !== "function") {
        fail(appId, "renderBody must be a function");
    }
    LIFECYCLE_HOOKS.forEach((hook) => {
        if (app[hook] != null && typeof app[hook] !== "function") {
            fail(appId, `${hook} must be a function when provided`);
        }
    });

    const classNames = typeof app.windowClass === "string" ? app.windowClass.trim().split(/\s+/) : [];
    if (!classNames.some((className) => WINDOW_PRESETS.has(className))) {
        fail(appId, "windowClass must include a shared window preset");
    }
    const appWindowClass = classNames.find((className) => className.endsWith("-window") && !WINDOW_PRESETS.has(className));
    if (!appWindowClass) {
        fail(appId, "windowClass must include an app-specific *-window class");
    }
    return appWindowClass || null;
}

function validateAppCss(appId, appWindowClass, css) {
    if (!appWindowClass) return;
    const selector = `.desktop-window.${appWindowClass}`;
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const blockMatch = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
    if (!blockMatch) {
        fail(appId, `app.css must define a ${selector} root block`);
        return;
    }

    const rootBlock = blockMatch[1];
    if (/(?:^|;)\s*(?:display|width|height|left|right|top|bottom)\s*:/m.test(rootBlock)) {
        fail(appId, "the app root must express layout through --app-window-* variables; the framework owns its geometry and display");
    }
    if (/(?:^|;)\s*(?:width|height|min-width|min-height)\s*:\s*\d+(?:\.\d+)?px\b/m.test(rootBlock)) {
        fail(appId, "fixed pixel window dimensions are not responsive; use framework variables and min()/clamp()");
    }
}

function collectJavaScriptFiles(directory) {
    if (!fs.existsSync(directory)) return [];
    const files = [];
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...collectJavaScriptFiles(absolutePath));
        else if (entry.isFile() && entry.name.endsWith(".js")) files.push(absolutePath);
    });
    return files;
}

function validateSyntax(modularIds) {
    const sourceDirectories = ["core", "data", "desktop", "mobile", "quick", "scripts"];
    const files = sourceDirectories.flatMap((directory) => collectJavaScriptFiles(path.join(ROOT, directory)));
    ["main.js", "flappy.js", "volume-hook.js", "deploy.js"].forEach((file) => {
        const absolutePath = path.join(ROOT, file);
        if (fs.existsSync(absolutePath)) files.push(absolutePath);
    });
    modularIds.forEach((appId) => files.push(path.join(ROOT, "apps", appId, "app.js")));
    files.push(...collectJavaScriptFiles(path.join(ROOT, "apps", "_shared")));
    files.push(path.join(ROOT, "apps", "_template", "app.js"));
    files.push(path.join(ROOT, "apps", "_template-game", "app.js"));

    [...new Set(files)].forEach((file) => {
        const source = fs.readFileSync(file, "utf8");
        try {
            if (/^\s*(?:import|export)\b/m.test(source)) {
                const result = spawnSync(process.execPath, ["--check", "--input-type=module"], {
                    input: source,
                    encoding: "utf8"
                });
                if (result.status !== 0) {
                    throw new Error((result.stderr || result.stdout || "module syntax check failed").trim());
                }
            } else {
                new vm.Script(source, { filename: path.relative(ROOT, file) });
            }
        } catch (error) {
            fail(path.relative(ROOT, file), `syntax error: ${error.message}`);
        }
    });
    return new Set(files).size;
}

async function validateFrameworkContract() {
    const quietConsole = { log: () => {}, info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    const sandbox = {
        window: {
            appRegistry: {},
            state: { volume: 70 },
            location: { origin: "http://127.0.0.1:8000", href: "http://127.0.0.1:8000/" }
        },
        document: {
            querySelector: () => null,
            getElementById: () => null
        },
        console: quietConsole,
        URL,
        Map,
        Promise
    };
    sandbox.window.window = sandbox.window;
    vm.runInNewContext(read("core/app-framework.js"), sandbox, { filename: "core/app-framework.js" });

    let receivedWindow = null;
    let receivedContext = null;
    const validApp = {
        title: "Audit Probe",
        icon: "fa-solid fa-vial",
        windowClass: "audit-probe-window utility-window",
        renderBody: () => "<div></div>",
        onMaximize: (windowEl, context) => {
            receivedWindow = windowEl;
            receivedContext = context;
        }
    };
    sandbox.window.appRegistry["audit-probe"] = validApp;

    if (!sandbox.window.validateAppRegistration("audit-probe", validApp)) {
        fail("core/app-framework.js", "a valid app registration was rejected");
    }
    if (sandbox.window.validateAppRegistration("invalid-probe", {
        ...validApp,
        windowClass: "invalid-probe-window"
    })) {
        fail("core/app-framework.js", "a registration without a shared preset was accepted");
    }

    const windowEl = { id: "probe-window" };
    await sandbox.window.runAppLifecycleHook("audit-probe", "onMaximize", windowEl, { isMaximized: true });
    if (receivedWindow !== windowEl || receivedContext?.isMaximized !== true) {
        fail("core/app-framework.js", "lifecycle context was not passed to the hook");
    }

    validApp.onClose = () => {
        throw new Error("expected audit rejection");
    };
    let rejectionObserved = false;
    try {
        await sandbox.window.runAppLifecycleHook("audit-probe", "onClose", windowEl, { rethrow: true });
    } catch (error) {
        rejectionObserved = error.message === "expected audit rejection";
    }
    if (!rejectionObserved) {
        fail("core/app-framework.js", "rethrow lifecycle failures were swallowed");
    }
}

async function validateLoaderContract() {
    const elements = new Map();
    let scriptAttempts = 0;
    const quietConsole = { log: () => {}, info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
    const validRegistration = {
        title: "Loader Probe",
        icon: "fa-solid fa-vial",
        windowClass: "loader-probe-window utility-window",
        renderBody: () => "<div></div>"
    };
    const windowObject = {
        appRegistry: {},
        modularApps: ["loader-probe"],
        state: { volume: 70 },
        location: { origin: "http://127.0.0.1:8000", href: "http://127.0.0.1:8000/" },
        CSS: { escape: (value) => String(value) }
    };
    const documentObject = {
        getElementById: (id) => elements.get(id) || null,
        querySelector: () => null,
        createElement: (tagName) => {
            const element = {
                tagName: tagName.toUpperCase(),
                id: "",
                remove() {
                    if (elements.get(this.id) === this) elements.delete(this.id);
                }
            };
            return element;
        },
        head: {
            appendChild: (element) => {
                elements.set(element.id, element);
                queueMicrotask(() => {
                    if (element.tagName === "LINK") {
                        element.onload?.();
                        return;
                    }

                    scriptAttempts++;
                    windowObject.appRegistry["loader-probe"] = scriptAttempts === 1
                        ? { ...validRegistration, windowClass: "loader-probe-window" }
                        : validRegistration;
                    element.onload?.();
                });
            }
        }
    };
    const sandbox = {
        window: windowObject,
        document: documentObject,
        console: quietConsole,
        URL,
        Map,
        Promise,
        queueMicrotask
    };
    windowObject.window = windowObject;
    vm.runInNewContext(read("core/app-framework.js"), sandbox, { filename: "core/app-framework.js" });
    vm.runInNewContext(read("core/app-loader.js"), sandbox, { filename: "core/app-loader.js" });

    let firstAttemptRejected = false;
    try {
        await windowObject.ensureAppLoaded("loader-probe");
    } catch (error) {
        firstAttemptRejected = /validation/.test(error.message);
    }
    if (!firstAttemptRejected) {
        fail("core/app-loader.js", "an invalid registration did not reject");
    }
    if (elements.has("app-script-loader-probe") || elements.has("app-style-loader-probe") || windowObject.appRegistry["loader-probe"]) {
        fail("core/app-loader.js", "failed assets or registration were not cleaned up for retry");
    }

    const loadedApp = await windowObject.ensureAppLoaded("loader-probe");
    if (loadedApp !== validRegistration || scriptAttempts !== 2) {
        fail("core/app-loader.js", "a corrected app did not load exactly once on retry");
    }

    let undeclaredRejected = false;
    try {
        await windowObject.ensureAppLoaded("not-declared");
    } catch (error) {
        undeclaredRejected = /not declared/.test(error.message);
    }
    if (!undeclaredRejected) {
        fail("core/app-loader.js", "an undeclared modular app did not reject clearly");
    }
}

async function validateWindowManagerContract() {
    const classes = new Set(["desktop-window", "lifecycle-probe-window", "utility-window", "is-hidden"]);
    const classList = {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name),
        toggle: (name, force) => {
            const shouldAdd = force == null ? !classes.has(name) : force;
            if (shouldAdd) classes.add(name);
            else classes.delete(name);
            return shouldAdd;
        }
    };
    const surface = { offsetWidth: 1200, offsetHeight: 800 };
    const windowEl = {
        dataset: { window: "lifecycle-probe" },
        classList,
        style: {},
        parentElement: surface,
        querySelector: () => null,
        setAttribute: () => {}
    };
    const state = {
        openApps: new Set(),
        minimizedApps: new Set(),
        activeWindow: null,
        zIndex: 10
    };
    const counts = { open: 0, restore: 0, focus: 0, minimize: 0, maximize: 0, close: 0 };
    const events = [];
    const windowObject = {
        appRegistry: {
            "lifecycle-probe": {
                title: "Lifecycle Probe",
                icon: "fa-solid fa-vial",
                windowClass: "lifecycle-probe-window utility-window",
                renderBody: () => "<div></div>",
                onOpen: async () => {
                    await Promise.resolve();
                    counts.open++;
                },
                onRestore: () => { counts.restore++; },
                onFocus: () => { counts.focus++; },
                onMinimize: () => { counts.minimize++; },
                onMaximize: (element, context) => {
                    if (context.isMaximized) counts.maximize++;
                },
                onClose: () => { counts.close++; }
            }
        },
        isAppInstalled: () => true,
        isModularApp: () => false,
        renderTaskbar: () => {},
        EventBus: { emit: (event) => events.push(event) },
        CSS: { escape: (value) => String(value) },
        location: { origin: "http://127.0.0.1:8000", href: "http://127.0.0.1:8000/" },
        setTimeout: () => 1
    };
    const documentObject = {
        body: surface,
        getElementById: () => null,
        querySelector: (selector) => {
            if (selector === '[data-window="lifecycle-probe"]') return windowEl;
            if (selector === ".desktop-wallpaper") return surface;
            return null;
        },
        querySelectorAll: (selector) => selector === ".desktop-window" ? [windowEl] : []
    };
    const sandbox = {
        window: windowObject,
        document: documentObject,
        state,
        console: { log: () => {}, info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
        URL,
        Map,
        Promise,
        CustomEvent: class {},
        getComputedStyle: () => ({ minWidth: "288px", minHeight: "352px" })
    };
    windowObject.window = windowObject;
    vm.runInNewContext(read("core/app-framework.js"), sandbox, { filename: "core/app-framework.js" });
    vm.runInNewContext(read("core/window-manager.js"), sandbox, { filename: "core/window-manager.js" });
    windowObject.clampDesktopWindowToBounds = () => {};
    windowObject.freezeWindowGeometry = () => {};

    const openedWindow = await windowObject.openDesktopWindow("lifecycle-probe");
    await windowObject.openDesktopWindow("lifecycle-probe");
    state.activeWindow = "another-app";
    await windowObject.openDesktopWindow("lifecycle-probe");
    windowObject.minimizeDesktopWindow("lifecycle-probe");
    await windowObject.openDesktopWindow("lifecycle-probe");
    await windowObject.toggleMaximizeWindow("lifecycle-probe");
    await windowObject.closeDesktopWindow("lifecycle-probe");

    const expectedCounts = { open: 1, restore: 1, focus: 1, minimize: 1, maximize: 1, close: 1 };
    if (openedWindow !== windowEl || Object.keys(expectedCounts).some((key) => counts[key] !== expectedCounts[key])) {
        fail("core/window-manager.js", `lifecycle transitions were incorrect: ${JSON.stringify(counts)}`);
    }
    ["app:opened", "app:focused", "app:minimized", "app:restored", "app:maximized", "app:closed"].forEach((event) => {
        if (!events.includes(event)) fail("core/window-manager.js", `missing ${event} transition event`);
    });
}

async function validateIframeGameContract() {
    let resolveBeforeLoad;
    let startupSignal = null;
    const iframe = {
        src: "about:blank",
        dataset: { src: "runtime/index.html" },
        style: {},
        contentWindow: { postMessage: () => {} }
    };
    const windowEl = {
        isConnected: true,
        querySelector: (selector) => selector.includes("iframe") ? iframe : null
    };
    const windowObject = {
        location: { origin: "http://127.0.0.1:8000", href: "http://127.0.0.1:8000/" },
        postMessageToIframe: () => true,
        syncGameIframe: () => {},
        showGameControls: () => {},
        setTimeout: (callback) => {
            callback();
            return 1;
        }
    };
    const sandbox = {
        window: windowObject,
        console: { log: () => {}, info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
        AbortController,
        Promise
    };
    windowObject.window = windowObject;
    vm.runInNewContext(read("apps/_shared/iframe-game.js"), sandbox, { filename: "apps/_shared/iframe-game.js" });

    const app = windowObject.createIframeGameApp({
        id: "iframe-probe",
        title: "Iframe Probe",
        icon: "fa-solid fa-gamepad",
        windowClass: "iframe-probe-window game-window",
        iframeSrc: "runtime/index.html",
        controlsHtml: "",
        beforeLoad: (element, { signal }) => {
            startupSignal = signal;
            return new Promise((resolve) => { resolveBeforeLoad = resolve; });
        }
    });

    const opening = app.onOpen(windowEl);
    await Promise.resolve();
    const closing = app.onClose(windowEl);
    resolveBeforeLoad();
    await Promise.all([opening, closing]);

    if (!startupSignal?.aborted || iframe.src === "runtime/index.html") {
        fail("apps/_shared/iframe-game.js", "closing during beforeLoad did not cancel iframe startup");
    }
}

function validateLocalAIInteractionContract() {
    const brainHelper = read("desktop/brain-helper.js");
    const localAI = read("core/local-ai.js");
    const taskbar = read("desktop/taskbar.js");
    const shell = read("desktop/shell.js");
    const terminal = read("desktop/terminal.js");
    const components = read("styles/components.css");
    const utils = read("core/utils.js");

    const containerRule = brainHelper.match(/\.brain-helper-container\s*\{([\s\S]*?)\}/)?.[1] || "";
    const visibleContainerRule = brainHelper.match(/\.brain-helper-container\.visible\s*\{([\s\S]*?)\}/)?.[1] || "";
    if (!/visibility\s*:\s*hidden/.test(containerRule) || !/visibility\s*:\s*visible/.test(visibleContainerRule)) {
        fail("desktop/brain-helper.js", "Lobe must leave the focus/accessibility tree while its HUD is hidden");
    }
    if (!/pointer-events\s*:\s*none/.test(visibleContainerRule)) {
        fail("desktop/brain-helper.js", "the visible Lobe container must remain click-through outside its interactive children");
    }
    if (!/\.brain-helper-container\.visible\s+\.brain-helper-mascot\s*\{[\s\S]*?pointer-events\s*:\s*auto/.test(brainHelper)) {
        fail("desktop/brain-helper.js", "the visible Lobe mascot must explicitly own its pointer hitbox");
    }
    if (!/\.brain-helper-container\.visible\s+\.brain-helper-bubble\.visible\s*\{[\s\S]*?pointer-events\s*:\s*auto/.test(brainHelper)) {
        fail("desktop/brain-helper.js", "the open Lobe bubble must explicitly own its pointer hitbox");
    }
    if (/textOutput\.innerHTML\s*\+\s*delta/.test(brainHelper)) {
        fail("desktop/brain-helper.js", "streamed model output must not be concatenated into live HTML");
    }
    if (!brainHelper.includes("brain-helper-stop") || !brainHelper.includes("cancelGeneration")) {
        fail("desktop/brain-helper.js", "Lobe must expose an answer-level cancel control");
    }
    if (!/cancelGeneration,\s*\n\s*chat,/.test(localAI) || !localAI.includes("interruptGenerate")) {
        fail("core/local-ai.js", "LocalAI must expose cancellation and interrupt local WebLLM generation");
    }
    if (/\b(?:stopButton|settingsButton)\.onclick\s*=/.test(taskbar)) {
        fail("desktop/taskbar.js", "tray actions must use the shell's single delegated click path");
    }
    if (!shell.includes('event.target.closest("[data-local-ai-tray-stop]")')) {
        fail("desktop/shell.js", "the delegated Local AI tray stop handler is missing");
    }
    if (!/event\.key === "Enter"[\s\S]*?requestSubmit\(\)/.test(terminal)) {
        fail("desktop/terminal.js", "the CLI must explicitly submit on Enter in embedded browsers");
    }
    const terminalButtonRule = components.match(/\.terminal-input-row button\s*\{([\s\S]*?)\}/)?.[1] || "";
    if (/width\s*:\s*1px|height\s*:\s*1px|clip\s*:\s*rect/.test(terminalButtonRule)) {
        fail("styles/components.css", "the CLI submit button must have a stable visible hitbox");
    }
    if (!utils.includes("if (selectEl.disabled || opt.disabled) return") || !utils.includes('trigger.setAttribute("aria-expanded", "false")')) {
        fail("core/utils.js", "custom dropdowns must reject stale disabled selections and expose open state");
    }
}

async function validateLocalAICliRuntimeContract() {
    const models = [
        { id: "SmolLM2-360M-Instruct-q4f16_1-MLC", label: "SmolLM2 360M", memoryMB: 376, type: "local" },
        { id: "gemma-3-1b-it-q4f16_1-MLC", label: "Gemma 3 1B", memoryMB: 600, type: "local" }
    ];
    let selectedModelId = models[0].id;
    let serviceStatus = "idle";
    let cancelCalls = 0;
    const getStatus = () => {
        const model = models.find((item) => item.id === selectedModelId) || models[0];
        return {
            status: serviceStatus,
            statusText: serviceStatus === "generating" ? "Local AI is answering..." : "Local AI is off.",
            modelId: model.id,
            modelLabel: model.label,
            modelType: model.type,
            memoryMB: model.memoryMB,
            modelNote: "",
            executionMode: "web-worker-webgpu",
            busy: serviceStatus === "generating",
            ready: serviceStatus === "ready"
        };
    };
    const localAI = {
        getStatus,
        getAvailableModels: () => models,
        getSelectedModelId: () => selectedModelId,
        setSelectedModelId: (modelId) => {
            selectedModelId = modelId;
            serviceStatus = "idle";
            return getStatus();
        },
        isReady: () => serviceStatus === "ready",
        enable: async () => {
            serviceStatus = "ready";
            return getStatus();
        },
        disable: async () => {
            serviceStatus = "idle";
            return getStatus();
        },
        cancelGeneration: async () => {
            cancelCalls += 1;
            serviceStatus = "ready";
            return true;
        }
    };
    const windowObject = {
        LocalAI: localAI,
        SimpleBrain: { query: () => null },
        EventBus: { on: () => {} },
        state: { currentUserId: "guest" },
        cliCommands: { help: "help", whoami: "profile", links: "links" },
        getCurrentUser: () => ({ id: "guest" }),
        addEventListener: () => {},
        setTimeout: () => 1,
        clearTimeout: () => {},
        SystemFS: {}
    };
    const sandbox = {
        window: windowObject,
        document: {
            readyState: "loading",
            addEventListener: () => {},
            getElementById: () => null
        },
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        console: { log: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        crypto: global.crypto,
        TextEncoder,
        Blob,
        Date,
        Map,
        Promise,
        setTimeout: () => 1,
        clearTimeout: () => {}
    };
    windowObject.window = windowObject;
    vm.createContext(sandbox);
    vm.runInContext(read("desktop/terminal.js"), sandbox, { filename: "desktop/terminal.js" });

    const statusText = await vm.runInContext('runLocalAICommand(["status"])', sandbox);
    if (!statusText.includes("State:   idle") || !statusText.includes("SmolLM2 360M")) {
        fail("desktop/terminal.js", "ai status did not report the mocked Local AI service state");
    }

    const modelsText = await vm.runInContext('runLocalAICommand(["models"])', sandbox);
    if (!modelsText.includes("Gemma 3 1B") || !modelsText.includes("ai use")) {
        fail("desktop/terminal.js", "ai models did not expose available model choices");
    }

    const selectionText = await vm.runInContext('runLocalAICommand(["use", "gemma", "1b"])', sandbox);
    if (selectedModelId !== models[1].id || !selectionText.includes("Selected Gemma 3 1B")) {
        fail("desktop/terminal.js", "ai use did not resolve and select a friendly model name");
    }

    const capabilityText = vm.runInContext("getLocalAICapabilitiesText()", sandbox);
    if (!capabilityText.includes("ai cancel") || !capabilityText.includes("jobs")) {
        fail("desktop/terminal.js", "AI CLI capability help is missing cancellation/job controls");
    }

    serviceStatus = "generating";
    const cancelText = await vm.runInContext('runLocalAICommand(["cancel"])', sandbox);
    if (cancelCalls !== 1 || !cancelText.includes("cancellation requested")) {
        fail("desktop/terminal.js", "ai cancel did not interrupt a non-terminal Local AI generation");
    }
}

async function validateLocalAIServiceRuntimeContract() {
    const storageValues = new Map();
    storageValues.set("bl4ut0LocalAiModel", "gemma-3-270m-it-q4f16_1-MLC");
    const storage = {
        getItem: (key) => storageValues.has(key) ? storageValues.get(key) : null,
        setItem: (key, value) => storageValues.set(key, String(value)),
        removeItem: (key) => storageValues.delete(key)
    };
    let streamMode = "complete";
    let fetchStarted = false;
    const encoder = new TextEncoder();
    const fetchMock = async (url, options = {}) => {
        fetchStarted = true;
        if (streamMode === "cancel") {
            return {
                ok: true,
                body: {
                    getReader: () => ({
                        read: () => new Promise((resolve, reject) => {
                            const abort = () => reject(new DOMException("Aborted", "AbortError"));
                            if (options.signal?.aborted) abort();
                            else options.signal?.addEventListener("abort", abort, { once: true });
                        }),
                        releaseLock: () => {}
                    })
                }
            };
        }

        let reads = 0;
        const payload = JSON.stringify([{
            candidates: [{ content: { parts: [{ text: "<image_soft_token>Hello from the model." }] } }]
        }]);
        return {
            ok: true,
            body: {
                getReader: () => ({
                    read: async () => reads++ === 0
                        ? { done: false, value: encoder.encode(payload) }
                        : { done: true, value: undefined },
                    releaseLock: () => {}
                })
            }
        };
    };

    function createConsentOverlay() {
        let clickHandler = null;
        const overlay = {
            className: "",
            innerHTML: "",
            setAttribute: () => {},
            remove: () => {},
            addEventListener: (type, handler) => {
                if (type === "click") clickHandler = handler;
            },
            querySelector: () => ({
                focus: () => clickHandler?.({
                    target: {
                        closest: () => ({ dataset: { localAiConsent: "allow" } })
                    }
                })
            })
        };
        return overlay;
    }

    const host = { appendChild: () => {} };
    const statusEvents = [];
    const windowObject = {
        EventBus: { emit: (name, value) => statusEvents.push({ name, value }) },
        addSystemLog: () => {},
        systems: [],
        bookmarks: [],
        crossOriginIsolated: false,
        requestAnimationFrame: (callback) => setTimeout(callback, 0),
        cancelAnimationFrame: (id) => clearTimeout(id),
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval
    };
    const sandbox = {
        window: windowObject,
        document: {
            body: host,
            createElement: () => createConsentOverlay(),
            querySelector: () => host
        },
        localStorage: storage,
        navigator: { gpu: null, userAgent: "contract-test" },
        performance: { now: () => Date.now() },
        fetch: fetchMock,
        console: { log: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        AbortController,
        DOMException,
        TextDecoder,
        TextEncoder,
        Uint8Array,
        ArrayBuffer,
        Blob,
        URL,
        atob,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval
    };
    windowObject.window = windowObject;
    vm.createContext(sandbox);
    vm.runInContext(read("core/local-ai.js"), sandbox, { filename: "core/local-ai.js" });

    const migratedModelId = windowObject.LocalAI.getSelectedModelId();
    const availableModelIds = windowObject.LocalAI.getAvailableModels().map((model) => model.id);
    if (migratedModelId !== "SmolLM2-360M-Instruct-q4f16_1-MLC" || availableModelIds.includes("gemma-3-270m-it-q4f16_1-MLC")) {
        fail("core/local-ai.js", "retired Gemma 3 270M selections must migrate to SmolLM2 and stay out of the catalog");
    }

    const cloudModelId = "gemini-2.5-flash";
    windowObject.LocalAI.setSelectedModelId(cloudModelId);
    const enabledStatus = await windowObject.LocalAI.enable("contract test");
    if (!enabledStatus.ready || enabledStatus.modelId !== cloudModelId) {
        fail("core/local-ai.js", "the mocked cloud model did not reach ready state");
        return;
    }

    const chunks = [];
    fetchStarted = false;
    const response = await windowObject.LocalAI.chat("hello", { mode: "cli" }, (delta) => chunks.push(delta));
    if (response.includes("<image_soft_token>") || chunks.join("").includes("<image_soft_token>")) {
        fail("core/local-ai.js", "internal model tokens escaped the final or streamed output sanitizer");
    }
    if (response !== "Hello from the model." || chunks.join("") !== "Hello from the model.") {
        fail("core/local-ai.js", "sanitized cloud streaming did not preserve normal response text");
    }

    streamMode = "cancel";
    fetchStarted = false;
    const pendingChat = windowObject.LocalAI.chat("wait", { mode: "cli" }, () => {});
    for (let attempt = 0; attempt < 20 && !fetchStarted; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
    const cancelled = await windowObject.LocalAI.cancelGeneration("contract-test");
    const cancelledResponse = await pendingChat;
    const finalStatus = windowObject.LocalAI.getStatus();
    if (!cancelled || cancelledResponse !== "AI response cancelled." || finalStatus.status !== "ready") {
        fail("core/local-ai.js", "answer cancellation did not preserve the ready cloud runtime");
    }
    if (!statusEvents.some((event) => event.name === "local-ai:status" && event.value?.canCancel)) {
        fail("core/local-ai.js", "generating status did not advertise answer-level cancellation");
    }
}

function validateCompletedMigrationContract() {
    const migratedTemplateApps = ["profile", "dossier", "browser", "network", "linux", "cli", "store", "settings"];
    const index = read("index.html");
    migratedTemplateApps.forEach((appId) => {
        const templatePattern = new RegExp(`<template\\s+id=["']app-template-${appId}["'][\\s\\S]*?data-window=["']${appId}["'][\\s\\S]*?</template>`);
        if (!templatePattern.test(index)) {
            fail(`index.html:${appId}`, "migrated shell markup must be inert inside its app template");
        }
    });

    const messagingFiles = [
        "volume-hook.js",
        "apps/romplayer/runtime.html",
        "apps/ut99/runtime/index.php",
        "apps/openrct2/runtime/index.js"
    ];
    messagingFiles.forEach((file) => {
        const source = read(file);
        if (/postMessage\([\s\S]{0,600}?,\s*["']\*["']\s*\)/.test(source)) {
            fail(file, "runtime messaging must never use a wildcard target origin");
        }
    });

    const volumeHook = read("volume-hook.js");
    if (!volumeHook.includes("event.source !== window.parent") || !volumeHook.includes("event.origin !== window.location.origin")) {
        fail("volume-hook.js", "runtime commands must validate both the parent window and same-origin sender");
    }

    const preferences = read("core/preferences.js");
    if (!preferences.includes('document.querySelectorAll("iframe.game-frame")') || !preferences.includes("iframe.contentWindow === event.source")) {
        fail("core/preferences.js", "runtime toast messages must be tied to a live game iframe");
    }

    const openrctApp = read("apps/openrct2/app.js");
    const openrctRuntime = read("apps/openrct2/runtime/index.js");
    ["openrct2-import-saves", "openrct2-export-saves", "runtimePath", "OpenRCT2"].forEach((marker) => {
        if (!openrctApp.includes(marker)) fail("apps/openrct2/app.js", `save bridge is missing ${marker}`);
    });
    ["initializeParentSaveBridge", "openrct2-save-ready", "openrct2-export-saves-result", "syncOpenRCT2FileSystem"].forEach((marker) => {
        if (!openrctRuntime.includes(marker)) fail("apps/openrct2/runtime/index.js", `save bridge is missing ${marker}`);
    });
}

async function run() {
    await validateFrameworkContract();
    await validateLoaderContract();
    await validateWindowManagerContract();
    await validateIframeGameContract();
    validateIPTVContract();
    validateLocalAIInteractionContract();
    await validateLocalAICliRuntimeContract();
    await validateLocalAIServiceRuntimeContract();
    await validateMobileStorageContract();
    validateCompletedMigrationContract();
    let catalog;
    try {
        catalog = loadCatalog();
    } catch (error) {
        fail("data/apps.js", `catalog could not be evaluated: ${error.message}`);
        catalog = { desktopApps: [], storeApps: [], modularApps: [] };
    }

    const desktopApps = Array.isArray(catalog.desktopApps) ? catalog.desktopApps : [];
    const mobileAppCount = validateMobileFrameworkContract(catalog);
    const storeApps = Array.isArray(catalog.storeApps) ? catalog.storeApps : [];
    const modularApps = desktopApps.filter((app) => app.modular === true);
    const modularIds = modularApps.map((app) => app.id);
    const desktopIds = desktopApps.map((app) => app.id);

    findDuplicates(desktopIds).forEach((id) => fail("data/apps.js", `duplicate desktop app ID "${id}"`));
    findDuplicates(storeApps.map((app) => app.id)).forEach((id) => fail("data/apps.js", `duplicate Store app ID "${id}"`));
    findDuplicates(modularIds).forEach((id) => fail("data/apps.js", `duplicate modular app ID "${id}"`));
    findDuplicates(catalog.desktopPinnedIds || []).forEach((id) => fail("data/apps.js", `duplicate desktop pin "${id}"`));
    findDuplicates(catalog.startMenuPinnedIds || []).forEach((id) => fail("data/apps.js", `duplicate Start pin "${id}"`));
    findDuplicates((catalog.startMenuGroups || []).flatMap((group) => group.ids || []))
        .forEach((id) => fail("data/apps.js", `Start group ID "${id}" appears in more than one group`));

    desktopApps.forEach((app) => {
        if (!APP_ID_PATTERN.test(String(app.id || ""))) fail("data/apps.js", `invalid desktop app ID "${app.id}"`);
        ["title", "icon"].forEach((field) => {
            if (typeof app[field] !== "string" || !app[field].trim()) {
                fail(`data/apps.js:${app.id || "unknown"}`, `${field} must be a non-empty string`);
            }
        });
        if (app.modular !== true) {
            fail(`data/apps.js:${app.id || "unknown"}`, "every desktop catalog app must declare modular: true");
        }
    });

    if (JSON.stringify(catalog.modularApps || []) !== JSON.stringify(modularIds)) {
        fail("data/apps.js", "window.modularApps must be derived from desktopApps where modular is true");
    }

    storeApps.filter((app) => app.installable !== false).forEach((storeApp) => {
        const desktopApp = desktopApps.find((app) => app.id === storeApp.id);
        if (!desktopApp) fail(`Store:${storeApp.id}`, "installable Store entry has no desktop app entry");
        else if (desktopApp.modular !== true) fail(`Store:${storeApp.id}`, "installable Store entry must point to a modular desktop app");
    });

    const defaultInstalledIds = new Set(catalog.standardInstalledAppIds || []);
    const installableStoreIds = new Set(storeApps.filter((app) => app.installable !== false).map((app) => app.id));
    modularIds.forEach((appId) => {
        if (!defaultInstalledIds.has(appId) && !installableStoreIds.has(appId)) {
            fail(appId, "modular app is unreachable; make it standard-installed or add an installable Store entry");
        }
    });

    modularApps.forEach((catalogApp) => {
        const appId = catalogApp.id;
        const jsPath = path.join(ROOT, "apps", appId, "app.js");
        const cssPath = path.join(ROOT, "apps", appId, "app.css");
        if (!fs.existsSync(jsPath)) fail(appId, "missing apps/<id>/app.js");
        if (!fs.existsSync(cssPath)) fail(appId, "missing apps/<id>/app.css");
        if (!fs.existsSync(jsPath) || !fs.existsSync(cssPath)) return;

        let registration = null;
        const source = fs.readFileSync(jsPath, "utf8");
        if (/window\.GDriveSync\b/.test(source) || /bl4ut0_gdrive_client_id/.test(source)) {
            fail(appId, "app-level cloud sync is forbidden; save through SystemFS and route users to Settings > Cloud Sync");
        }
        try {
            registration = evaluateRegistration(appId, source);
        } catch (error) {
            fail(appId, `app.js could not register in the audit sandbox: ${error.message}`);
        }
        const appWindowClass = validateRegistration(appId, registration);
        validateAppCss(appId, appWindowClass, fs.readFileSync(cssPath, "utf8"));
    });

    [
        { id: "myapp", directory: "_template" },
        { id: "mygame", directory: "_template-game" }
    ].forEach((template) => {
        const jsPath = path.join(ROOT, "apps", template.directory, "app.js");
        const cssPath = path.join(ROOT, "apps", template.directory, "app.css");
        try {
            const registration = evaluateRegistration(template.id, fs.readFileSync(jsPath, "utf8"));
            const appWindowClass = validateRegistration(`template:${template.id}`, registration);
            validateAppCss(`template:${template.id}`, appWindowClass, fs.readFileSync(cssPath, "utf8"));
        } catch (error) {
            fail(`template:${template.id}`, `template could not register in the audit sandbox: ${error.message}`);
        }
    });

    const appsDirectory = path.join(ROOT, "apps");
    fs.readdirSync(appsDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
        .filter((entry) => fs.existsSync(path.join(appsDirectory, entry.name, "app.js")))
        .forEach((entry) => {
            if (!modularIds.includes(entry.name)) {
                fail(entry.name, "app folder exists but desktopApps does not declare modular: true");
            }
        });

    const syntaxFileCount = validateSyntax(modularIds);
    if (failures.length) {
        console.error(`App contract audit failed with ${failures.length} issue(s):`);
        failures.forEach((failure) => console.error(`- ${failure}`));
        process.exitCode = 1;
        return;
    }

    console.log(`App contract audit passed: ${modularIds.length} desktop apps, ${mobileAppCount} independent mobile apps, 2 templates, lifecycle/window/loader/iframe/Local AI behavior, and ${syntaxFileCount} first-party scripts checked.`);
}

run()
    .then(() => {
        if (!process.exitCode) {
            require("./check-mobile-viewport.js");
            require("./check-mobile-home.js");
        }
    })
    .catch((error) => {
        console.error(`App contract audit crashed: ${error.stack || error.message}`);
        process.exitCode = 1;
    });
