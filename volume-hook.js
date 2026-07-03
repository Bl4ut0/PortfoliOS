(function () {
    function clampVolume(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0.7;
        const normalized = numeric > 1 ? numeric / 100 : numeric;
        return Math.max(0, Math.min(1, normalized));
    }

    function getStoredVolume() {
        try {
            const ownerVolume = window.localStorage.getItem("bl4ut0_bl4ut0_Volume");
            if (ownerVolume !== null && ownerVolume !== "") return clampVolume(ownerVolume);

            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (/^bl4ut0_[a-z0-9_-]+_Volume$/i.test(key || "")) {
                    const value = window.localStorage.getItem(key);
                    if (value !== null && value !== "") return clampVolume(value);
                }
            }

            const legacyVolume = window.localStorage.getItem("bl4ut0Volume");
            if (legacyVolume !== null && legacyVolume !== "") return clampVolume(legacyVolume);

            return 0.7;
        } catch (error) {
            return 0.7;
        }
    }

    function postGameMessage(payload) {
        if (!window.parent || window.parent === window) return;
        window.parent.postMessage({
            ...payload,
            source: "portfolio-game-runtime",
            path: window.location.pathname
        }, "*");
    }

    function isUt99Runtime() {
        return /\/apps\/ut99\/runtime\//i.test(window.location.pathname);
    }

    function postUt99RuntimeMessage(payload) {
        if (!isUt99Runtime() || !window.parent || window.parent === window) return;
        try {
            window.parent.postMessage({
                ...payload,
                source: "portfolio-ut99-runtime",
                path: window.location.pathname
            }, "*");
        } catch (error) {}
    }

    function formatDebugArg(arg) {
        if (arg instanceof Error) return arg.message + (arg.stack ? "\n" + arg.stack : "");
        if (typeof arg === "object" && arg !== null) {
            try {
                return JSON.stringify(arg);
            } catch (error) {
                return String(arg);
            }
        }
        return String(arg);
    }

    function postUt99DebugLog(level, message, detail = null) {
        if (!isUt99Runtime()) return;
        const text = String(message || "").trim();
        if (!text) return;
        const normalizedLevel = normalizeUt99DebugLevel(level, text);
        postUt99RuntimeMessage({
            type: "ut99-log",
            level: normalizedLevel,
            message: text,
            detail,
            time: Date.now()
        });
    }

    function normalizeUt99DebugLevel(level, message) {
        if (/^(trying binaryen method|asynchronously preparing wasm|binaryen method succeeded|CACHEAPPDATA:|MEMFS is sync'd|Log:|Init:|Localization:|ScriptLog:)/i.test(message)) {
            return "info";
        }
        if (/^WARNING:/i.test(message)) {
            return "warning";
        }
        return level;
    }

    let ut99DebugBridgeInstalled = false;
    function installUt99DebugBridge() {
        if (!isUt99Runtime() || ut99DebugBridgeInstalled) return;
        ut99DebugBridgeInstalled = true;

        const wrapConsole = (method, level) => {
            const original = console[method]?.bind(console);
            if (!original) return;
            console[method] = (...args) => {
                original(...args);
                const message = args.map(formatDebugArg).join(" ");
                postUt99DebugLog(level, message);
            };
        };

        wrapConsole("log", "info");
        wrapConsole("info", "info");
        wrapConsole("warn", "warning");
        wrapConsole("error", "error");

        window.addEventListener("error", (event) => {
            postUt99DebugLog(
                "error",
                `Runtime error: ${event.message || "unknown error"} at ${event.filename || "runtime"}:${event.lineno || 0}:${event.colno || 0}`,
                event.error?.stack || null
            );
        });

        window.addEventListener("unhandledrejection", (event) => {
            const reason = event.reason;
            postUt99DebugLog(
                "error",
                `Runtime promise rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
                reason instanceof Error ? reason.stack : null
            );
        });

        postUt99DebugLog("info", "UT99 runtime debug bridge active.");
    }

    function focusRuntimeCanvas() {
        try {
            window.focus();
        } catch (error) {}

        const canvas = document.getElementById("canvas") || document.querySelector("canvas");
        const target = canvas || document.body;
        if (!target) return;

        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "0");
        try {
            target.focus({ preventScroll: true });
        } catch (error) {
            try {
                target.focus();
            } catch (fallbackError) {}
        }
    }

    function configureUt99InputDefaults() {
        if (!isUt99Runtime()) return;

        const pointerLock = document.getElementById("pointerLock");
        if (pointerLock) {
            pointerLock.checked = false;
            pointerLock.defaultChecked = false;
            pointerLock.removeAttribute("checked");
        }

        const canvas = document.getElementById("canvas") || document.querySelector("canvas");
        if (!canvas) return;
        if (!canvas.hasAttribute("tabindex")) canvas.setAttribute("tabindex", "0");
        canvas.style.cursor = ut99SoftPointerActive ? "none" : "default";
    }

    function dispatchGameKey(key, code, keyCode) {
        const canvas = document.getElementById("canvas") || document.querySelector("canvas");
        const target = canvas || document;
        const base = {
            key,
            code,
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
            composed: true
        };

        for (const eventName of ["keydown", "keypress", "keyup"]) {
            try {
                const event = new KeyboardEvent(eventName, base);
                Object.defineProperty(event, "keyCode", { get: () => keyCode });
                Object.defineProperty(event, "which", { get: () => keyCode });
                target.dispatchEvent(event);
            } catch (error) {}
        }
    }

    function dispatchGameKeyEvent(payload = {}) {
        const eventName = /^(keydown|keypress|keyup)$/.test(payload.eventType || "")
            ? payload.eventType
            : "keydown";
        const canvas = document.getElementById("canvas") || document.querySelector("canvas");
        const target = canvas || document;
        const keyCode = Number(payload.keyCode || payload.which || 0);
        const base = {
            key: payload.key || "",
            code: payload.code || "",
            keyCode,
            which: keyCode,
            charCode: Number(payload.charCode || 0),
            altKey: Boolean(payload.altKey),
            ctrlKey: Boolean(payload.ctrlKey),
            shiftKey: Boolean(payload.shiftKey),
            metaKey: Boolean(payload.metaKey),
            repeat: Boolean(payload.repeat),
            bubbles: true,
            cancelable: true,
            composed: true
        };

        try {
            const event = new KeyboardEvent(eventName, base);
            Object.defineProperty(event, "keyCode", { get: () => keyCode });
            Object.defineProperty(event, "which", { get: () => keyCode });
            target.dispatchEvent(event);
        } catch (error) {}
    }

    let ut99PointerSyncing = false;
    let ut99PointerCalibrated = false;
    let ut99PointerLocalX = 0;
    let ut99PointerLocalY = 0;
    let ut99LastPointerRebaseAt = 0;
    const UT99_POINTER_REBASE_INTERVAL = 120;

    function clampUt99Pointer(value, min, max) {
        if (!Number.isFinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    }

    function createUt99MouseEvent(type, rect, localX, localY, movementX, movementY, buttons, button = 0) {
        const clientX = rect.left + localX;
        const clientY = rect.top + localY;
        const event = new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            clientX,
            clientY,
            screenX: window.screenX + clientX,
            screenY: window.screenY + clientY,
            button,
            buttons
        });

        try {
            Object.defineProperty(event, "movementX", { configurable: true, get: () => movementX });
            Object.defineProperty(event, "movementY", { configurable: true, get: () => movementY });
        } catch (error) {}

        return event;
    }

    function dispatchUt99PointerSync(payload = {}) {
        if (!isUt99Runtime() || ut99PointerSyncing) return;
        if (document.pointerLockElement) return;

        const canvas = document.getElementById("canvas") || document.querySelector("canvas");
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const localX = Number(payload.localX);
        const localY = Number(payload.localY);
        const viewportWidth = Number(payload.viewportWidth);
        const viewportHeight = Number(payload.viewportHeight);
        const hasLocalPosition = Number.isFinite(localX) && Number.isFinite(localY);
        const movementX = Number(payload.movementX) || 0;
        const movementY = Number(payload.movementY) || 0;
        const relativeMode = payload.captureMode === "soft" || payload.relative === true;
        const rawX = Number(payload.clientX);
        const rawY = Number(payload.clientY);
        if (!relativeMode && !hasLocalPosition && (!Number.isFinite(rawX) || !Number.isFinite(rawY))) return;

        let nextLocalX;
        let nextLocalY;
        if (relativeMode && ut99PointerCalibrated && !payload.forceRebase) {
            nextLocalX = clampUt99Pointer(ut99PointerLocalX + movementX, 0, rect.width);
            nextLocalY = clampUt99Pointer(ut99PointerLocalY + movementY, 0, rect.height);
        } else {
            const desiredLocalX = hasLocalPosition && Number.isFinite(viewportWidth) && viewportWidth > 0
                ? (localX / viewportWidth) * rect.width
                : (Number.isFinite(rawX) ? rawX - rect.left : rect.width / 2);
            const desiredLocalY = hasLocalPosition && Number.isFinite(viewportHeight) && viewportHeight > 0
                ? (localY / viewportHeight) * rect.height
                : (Number.isFinite(rawY) ? rawY - rect.top : rect.height / 2);
            nextLocalX = clampUt99Pointer(desiredLocalX, 0, rect.width);
            nextLocalY = clampUt99Pointer(desiredLocalY, 0, rect.height);
        }
        const buttons = Number(payload.buttons) || 0;
        const now = Date.now();
        const shouldRebase = Boolean(payload.forceRebase)
            || !ut99PointerCalibrated
            || (!ut99SoftPointerActive && now - ut99LastPointerRebaseAt > UT99_POINTER_REBASE_INTERVAL);

        ut99PointerSyncing = true;
        try {
            if (shouldRebase) {
                const slamX = -Math.max(rect.width * 4, 4096);
                const slamY = -Math.max(rect.height * 4, 4096);
                canvas.dispatchEvent(createUt99MouseEvent("mouseover", rect, nextLocalX, nextLocalY, 0, 0, buttons));
                canvas.dispatchEvent(createUt99MouseEvent("mousemove", rect, 0, 0, slamX, slamY, buttons));
                canvas.dispatchEvent(createUt99MouseEvent("mousemove", rect, nextLocalX, nextLocalY, nextLocalX, nextLocalY, buttons));
                ut99LastPointerRebaseAt = now;
            } else {
                canvas.dispatchEvent(createUt99MouseEvent(
                    "mousemove",
                    rect,
                    nextLocalX,
                    nextLocalY,
                    nextLocalX - ut99PointerLocalX,
                    nextLocalY - ut99PointerLocalY,
                    buttons
                ));
            }

            ut99PointerCalibrated = true;
            ut99PointerLocalX = nextLocalX;
            ut99PointerLocalY = nextLocalY;
        } catch (error) {}
        ut99PointerSyncing = false;
    }

    function dispatchUt99PointerButton(payload = {}) {
        if (!isUt99Runtime() || ut99PointerSyncing) return;
        const canvas = document.getElementById("canvas") || document.querySelector("canvas");
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const eventType = /^(mousedown|mouseup|click|contextmenu)$/.test(payload.eventType || "")
            ? payload.eventType
            : "click";
        const localX = ut99PointerCalibrated ? ut99PointerLocalX : rect.width / 2;
        const localY = ut99PointerCalibrated ? ut99PointerLocalY : rect.height / 2;

        ut99PointerSyncing = true;
        try {
            canvas.dispatchEvent(createUt99MouseEvent(
                eventType,
                rect,
                clampUt99Pointer(localX, 0, rect.width),
                clampUt99Pointer(localY, 0, rect.height),
                0,
                0,
                Number(payload.buttons) || 0,
                Number(payload.button) || 0
            ));
        } catch (error) {}
        ut99PointerSyncing = false;
    }

    function syncUt99PointerFromEvent(event) {
        if (!isUt99Runtime() || !event?.isTrusted) return;
        const canvas = document.getElementById("canvas") || document.querySelector("canvas");
        if (event.target === canvas) return;
        dispatchUt99PointerSync({
            clientX: event.clientX,
            clientY: event.clientY,
            buttons: event.buttons || 0,
            movementX: Number(event.movementX) || 0,
            movementY: Number(event.movementY) || 0,
            forceRebase: event.type === "pointerenter"
        });
    }

    let ut99IntroDismissed = false;
    let ut99PointerLockPatched = false;
    let ut99FullscreenPatched = false;
    let ut99SoftPointerActive = false;

    function patchUt99PointerLock() {
        if (!isUt99Runtime() || ut99PointerLockPatched || typeof Element === "undefined") return;
        const originalRequestPointerLock = Element.prototype.requestPointerLock;
        if (typeof originalRequestPointerLock !== "function") return;
        ut99PointerLockPatched = true;

        Element.prototype.requestPointerLock = function patchedUt99RequestPointerLock(...args) {
            ut99SoftPointerActive = true;
            configureUt99InputDefaults();
            focusRuntimeCanvas();
            postUt99RuntimeMessage({
                type: "ut99-pointer-capture",
                mode: "soft"
            });
            if (document.pointerLockElement) {
                try {
                    document.exitPointerLock?.();
                } catch (error) {}
            }
            return Promise.resolve();
        };
    }

    function patchUt99Fullscreen() {
        if (!isUt99Runtime() || ut99FullscreenPatched || typeof Element === "undefined") return;
        const originalRequestFullscreen = Element.prototype.requestFullscreen;
        if (typeof originalRequestFullscreen !== "function") return;
        ut99FullscreenPatched = true;

        Element.prototype.requestFullscreen = function patchedUt99RequestFullscreen(...args) {
            if (isUt99Runtime()) {
                postUt99RuntimeMessage({
                    type: "ut99-request-fullscreen"
                });
                return Promise.resolve();
            }
            return originalRequestFullscreen.apply(this, args);
        };
    }

    function dismissUt99IntroOnce() {
        if (!isUt99Runtime() || ut99IntroDismissed) return;
        ut99IntroDismissed = true;
        patchUt99PointerLock();
        patchUt99Fullscreen();
        configureUt99InputDefaults();
        focusRuntimeCanvas();
        window.setTimeout(() => dispatchGameKey("Escape", "Escape", 27), 45);
    }

    window.osVolume = getStoredVolume();
    window.osGainNodes = [];
    window.osAudioElements = [];

    function applyOsVolume(value) {
        window.osVolume = clampVolume(value);
        window.osGainNodes.forEach((gain) => {
            if (gain?.gain) gain.gain.value = window.osVolume;
        });
        window.osAudioElements.forEach((audio) => {
            audio.volume = window.osVolume;
        });
    }

    // Intercept Web Audio API before the embedded game creates its audio context.
    const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
    if (OriginalAudioContext) {
        window.AudioContext = new Proxy(OriginalAudioContext, {
            construct(target, args) {
                const ctx = new target(...args);
                const originalDestination = ctx.destination;
                const gain = ctx.createGain();
                gain.gain.value = window.osVolume;
                gain.connect(originalDestination);

                window.osGainNodes.push(gain);

                Object.defineProperty(ctx, "destination", {
                    configurable: true,
                    get: () => gain
                });
                return ctx;
            }
        });
        window.webkitAudioContext = window.AudioContext;
    }

    // Intercept HTML5 Audio constructor.
    const OriginalAudio = window.Audio;
    if (OriginalAudio) {
        window.Audio = new Proxy(OriginalAudio, {
            construct(target, args) {
                const audio = new target(...args);
                audio.volume = window.osVolume;
                window.osAudioElements.push(audio);
                return audio;
            }
        });
    }

    // Intercept HTMLAudioElement cloneNode.
    const OriginalNodeClone = Node.prototype.cloneNode;
    Node.prototype.cloneNode = function (deep) {
        const clone = OriginalNodeClone.call(this, deep);
        if (clone instanceof HTMLAudioElement) {
            clone.volume = window.osVolume;
            window.osAudioElements.push(clone);
        }
        return clone;
    };

    let hadPointerLock = false;
    let lastExplicitPointerReleaseAt = 0;
    let lastExplicitPointerReleaseReason = "";

    function releasePointerLock(reason) {
        const hadNativePointerLock = Boolean(document.pointerLockElement);
        const hadSoftPointerLock = Boolean(ut99SoftPointerActive);
        if (!hadNativePointerLock && !hadSoftPointerLock) return;
        lastExplicitPointerReleaseAt = Date.now();
        lastExplicitPointerReleaseReason = reason;
        ut99SoftPointerActive = false;
        configureUt99InputDefaults();
        if (hadNativePointerLock) {
            try {
                document.exitPointerLock?.();
            } catch (error) {}
        }
        if (isUt99Runtime()) {
            postUt99RuntimeMessage({ type: "game-pointer-release", reason });
        } else {
            postGameMessage({ type: "game-pointer-release", reason });
        }
    }

    function showPointerReleaseHint(reason) {
        if (isUt99Runtime()) {
            postUt99RuntimeMessage({ type: "game-pointer-release-hint", reason });
        } else {
            postGameMessage({ type: "game-pointer-release-hint", reason });
        }
    }

    window.addEventListener("message", (event) => {
        if (!event.data) return;
        if (event.data.type === "volume") {
            applyOsVolume(event.data.value);
        }
        if (event.data.type === "release-pointer-lock") {
            releasePointerLock("parent-request");
        }
        if (event.data.type === "focus-game") {
            configureUt99InputDefaults();
            focusRuntimeCanvas();
        }
        if (event.data.type === "ut99-dismiss-intro") {
            dismissUt99IntroOnce();
        }
        if (event.data.type === "ut99-pointer-sync") {
            configureUt99InputDefaults();
            dispatchUt99PointerSync(event.data);
        }
        if (event.data.type === "ut99-pointer-button") {
            configureUt99InputDefaults();
            dispatchUt99PointerButton(event.data);
        }
        if (event.data.type === "ut99-key-event") {
            configureUt99InputDefaults();
            dispatchGameKeyEvent(event.data);
        }
    });

    window.addEventListener("load", () => {
        installUt99DebugBridge();
        patchUt99PointerLock();
        patchUt99Fullscreen();
        configureUt99InputDefaults();
        focusRuntimeCanvas();
    });
    window.addEventListener("DOMContentLoaded", () => {
        installUt99DebugBridge();
        patchUt99PointerLock();
        patchUt99Fullscreen();
        configureUt99InputDefaults();
    });
    document.addEventListener("pointerdown", () => {
        configureUt99InputDefaults();
        focusRuntimeCanvas();
        dismissUt99IntroOnce();
    }, true);
    document.addEventListener("pointerenter", syncUt99PointerFromEvent, true);
    document.addEventListener("pointermove", syncUt99PointerFromEvent, true);
    document.addEventListener("mousemove", syncUt99PointerFromEvent, true);
    window.setInterval(configureUt99InputDefaults, 1000);

    window.addEventListener("unhandledrejection", (event) => {
        if (!isUt99Runtime()) return;
        const reason = String(event.reason?.message || event.reason || "");
        if (!/pointer lock/i.test(reason)) return;
        event.preventDefault();
        console.warn("PortfoliOS: suppressed UT99 pointer lock rejection.", event.reason);
    });

    installUt99DebugBridge();
    patchUt99PointerLock();
    patchUt99Fullscreen();
    configureUt99InputDefaults();

    window.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.altKey) {
            event.preventDefault();
            event.stopImmediatePropagation();
            releasePointerLock("ctrl-alt");
            return;
        }
    }, true);

    document.addEventListener("pointerlockchange", () => {
        const hasPointerLock = Boolean(document.pointerLockElement);
        if (hadPointerLock && !hasPointerLock) {
            const explicitRelease = Date.now() - lastExplicitPointerReleaseAt < 1200;
            if (!explicitRelease && isUt99Runtime()) {
                showPointerReleaseHint("browser-pointerlock-exit");
            } else if (!explicitRelease) {
                postGameMessage({ type: "game-pointer-release", reason: "pointerlockchange" });
            }
            lastExplicitPointerReleaseReason = "";
        }
        hadPointerLock = hasPointerLock;
    });
})();
