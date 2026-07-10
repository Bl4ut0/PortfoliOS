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
const LEGACY_APP_DIRS = new Set(["local-ai"]);
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

function evaluateRegistration(appId, source) {
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
    return windowObject.appRegistry[appId];
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

async function run() {
    await validateFrameworkContract();
    await validateLoaderContract();
    await validateWindowManagerContract();
    await validateIframeGameContract();
    let catalog;
    try {
        catalog = loadCatalog();
    } catch (error) {
        fail("data/apps.js", `catalog could not be evaluated: ${error.message}`);
        catalog = { desktopApps: [], storeApps: [], modularApps: [] };
    }

    const desktopApps = Array.isArray(catalog.desktopApps) ? catalog.desktopApps : [];
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
        try {
            registration = evaluateRegistration(appId, fs.readFileSync(jsPath, "utf8"));
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
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !LEGACY_APP_DIRS.has(entry.name))
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

    console.log(`App contract audit passed: ${modularIds.length} modular apps, 2 templates, lifecycle/window/loader/iframe behavior, and ${syntaxFileCount} first-party scripts checked.`);
}

run().catch((error) => {
    console.error(`App contract audit crashed: ${error.stack || error.message}`);
    process.exitCode = 1;
});
