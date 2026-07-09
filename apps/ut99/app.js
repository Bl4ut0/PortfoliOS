(function() {
    const APP_ID = "ut99";
    const RUNTIME_URL = "/apps/ut99/runtime/index.php/?v=1.0.93";
    const MANIFEST_URL = "/apps/ut99/runtime/index.php/gamedata/manifest.json";
    const PRACTICE_MAPS = [
        "Maps/DM-Deck16][.unr",
        "Maps/DM-Turbine.unr",
        "Maps/DM-Codex.unr",
        "Maps/DM-Phobos.unr"
    ];
    const PRACTICE_PACKAGES = [
        "Activates", "AmbAncient", "AmbModern", "AmbOutside", "Ancient",
        "Botmca9", "Botpack", "Core", "DecayedS", "DoorsAnc", "DoorsMod",
        "Engine", "GenFX", "GenFluid", "GenIn", "Godown", "HubEffects",
        "Indus1", "Indus6", "Liquids", "Metalmys", "Mine", "Mission",
        "NaliCast", "noxxsnd", "RainFX", "Run", "ShaneDay", "ShaneSky",
        "SkyBox", "SkyCity", "Slums", "SpaceFX", "UT", "UTcrypt",
        "UTtech1", "UTtech2", "UTtech3", "UnrealI", "UnrealShare", "XbpFX"
    ];
    let unregisterAudio = null;
    let runtimeAbort = null;
    let pointerCaptureAbort = null;
    let pointerCaptureWindow = null;
    let pointerCaptureLastX = null;
    let pointerCaptureLastY = null;
    let pointerCaptureNativeRelease = false;
    let pointerCaptureLastNoticeAt = 0;

    function getRuntimeFrame(windowEl) {
        return windowEl?.querySelector("iframe.ut99-frame") || null;
    }

    function setBootVisible(windowEl, visible) {
        const boot = windowEl?.querySelector("[data-ut99-boot]");
        if (!boot) return;
        boot.hidden = !visible;
        boot.classList.toggle("is-hidden", !visible);
    }

    function isBootCompleteStatus(message) {
        return !message || /running|all downloads complete/i.test(message);
    }

    function setBootStatus(windowEl, text) {
        const boot = windowEl?.querySelector("[data-ut99-boot]");
        const status = windowEl?.querySelector("[data-ut99-loader-status]");
        const progress = windowEl?.querySelector("[data-ut99-loader-progress]");
        if (!boot || !status) return;

        const message = String(text || "").trim();
        const progressMatch = message.match(/(\d+)%/);
        if (progress) {
            const width = progressMatch ? Math.max(8, Math.min(100, Number(progressMatch[1]))) : 14;
            progress.style.width = `${width}%`;
        }

        if (/exception|error|failed|database/i.test(message)) {
            windowEl.dataset.ut99BootComplete = "false";
            boot.classList.add("is-error");
            setBootVisible(windowEl, true);
            status.textContent = message || "Runtime error";
            return;
        }

        if (isBootCompleteStatus(message)) {
            windowEl.dataset.ut99BootComplete = "true";
            window.clearTimeout(Number(windowEl.dataset.ut99BootTimer || 0));
            setBootVisible(windowEl, false);
            return;
        }

        if (windowEl.dataset.ut99BootComplete === "true") {
            return;
        }

        boot.classList.remove("is-error");
        status.textContent = message || "Starting Unreal Tournament";
        setBootVisible(windowEl, true);
    }

    function logUt99(level, message, detail = null) {
        const text = String(message || "").trim();
        if (!text) return;
        const type = level === "error" ? "error" : level === "warning" ? "warning" : "info";
        window.addSystemLog?.(type, `[UT99] ${text}`, detail);
    }

    async function reportRuntimeAssetScope(windowEl) {
        if (windowEl.dataset.ut99AssetScopeReported === "true") return;
        windowEl.dataset.ut99AssetScopeReported = "true";

        try {
            const response = await fetch(`${MANIFEST_URL}?v=${Date.now()}`, { cache: "no-store" });
            if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
            const manifest = await response.json();
            const files = Object.keys(manifest || {});
            const maps = files.filter((file) => file.startsWith("Maps/")).sort();
            const packages = new Set(files.map((file) => {
                const name = file.split("/").pop() || file;
                return name.replace(/\.[^.]+$/, "").toLowerCase();
            }));
            const missingPracticeMaps = PRACTICE_MAPS.filter((file) => !manifest[file]);
            const missingPracticePackages = PRACTICE_PACKAGES.filter((name) => !packages.has(name.toLowerCase()));

            if (missingPracticeMaps.length || missingPracticePackages.length) {
                logUt99(
                    "warning",
                    `Practice Session may be missing assets. Manifest contains ${files.length} file(s), ${maps.length} map(s). Missing maps: ${missingPracticeMaps.join(", ") || "none"}. Missing packages: ${missingPracticePackages.join(", ") || "none"}.`
                );
            } else {
                logUt99("info", `Runtime manifest loaded with ${files.length} file(s), ${maps.length} map(s). Practice maps and dependencies appear present.`);
            }
        } catch (error) {
            logUt99("warning", "Could not inspect UT99 runtime manifest for practice-session support.", error);
        }
    }

    function focusRuntimeFrame(windowEl, delay = 40) {
        const iframe = getRuntimeFrame(windowEl);
        if (!iframe) return;
        window.setTimeout(() => {
            try {
                iframe.focus({ preventScroll: true });
                iframe.contentWindow?.focus();
            } catch (error) {}
            window.postMessageToIframe?.(iframe, { type: "focus-game" });
        }, delay);
    }

    function primeRuntimeInput(windowEl, delay = 0) {
        const iframe = getRuntimeFrame(windowEl);
        if (!iframe) return;
        focusRuntimeFrame(windowEl, delay);
        window.setTimeout(() => {
            window.postMessageToIframe?.(iframe, { type: "ut99-dismiss-intro" });
        }, delay + 40);
    }

    function postRuntimeVolume(windowEl, volume = window.PortfolioOSAppFramework?.getDesktopVolume?.() ?? 70) {
        const iframe = getRuntimeFrame(windowEl);
        window.postMessageToIframe?.(iframe, {
            type: "volume",
            value: Math.max(0, Math.min(100, Number(volume) || 0))
        });
    }

    function isRuntimeFullscreen(windowEl) {
        const fullscreenEl = document.fullscreenElement;
        return Boolean(fullscreenEl && windowEl && (fullscreenEl === windowEl || windowEl.contains(fullscreenEl)));
    }

    function isPointerOverRuntimeSurface(windowEl, event) {
        if (isRuntimeFullscreen(windowEl)) return true;
        const stage = windowEl?.querySelector(".ut99-stage");
        const rect = stage?.getBoundingClientRect?.();
        if (!rect) return false;
        return event.clientX >= rect.left
            && event.clientX <= rect.right
            && event.clientY >= rect.top
            && event.clientY <= rect.bottom;
    }

    function clampPointerValue(value, min, max) {
        if (!Number.isFinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    }

    function getRuntimePointerPayload(windowEl, event, options = {}) {
        const captureMode = Boolean(options.captureMode);
        if (!captureMode && !isPointerOverRuntimeSurface(windowEl, event)) return null;
        const iframe = getRuntimeFrame(windowEl);
        if (!iframe) return null;

        const rect = iframe.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;

        const rawLocalX = event.clientX - rect.left;
        const rawLocalY = event.clientY - rect.top;
        if (!captureMode && (rawLocalX < 0 || rawLocalX > rect.width || rawLocalY < 0 || rawLocalY > rect.height)) return null;

        const localX = captureMode ? clampPointerValue(rawLocalX, 0, rect.width) : rawLocalX;
        const localY = captureMode ? clampPointerValue(rawLocalY, 0, rect.height) : rawLocalY;

        return {
            type: "ut99-pointer-sync",
            localX,
            localY,
            clientX: event.clientX,
            clientY: event.clientY,
            viewportWidth: rect.width,
            viewportHeight: rect.height,
            buttons: event.buttons || 0,
            movementX: Number(event.movementX) || 0,
            movementY: Number(event.movementY) || 0,
            fullscreen: isRuntimeFullscreen(windowEl),
            captureMode: captureMode ? "soft" : "",
            relative: Boolean(options.relative),
            forceRebase: Boolean(options.forceRebase)
        };
    }

    function syncRuntimePointer(windowEl, event, options = {}) {
        if (pointerCaptureWindow === windowEl && !options.captureMode) return;
        const iframe = getRuntimeFrame(windowEl);
        const payload = getRuntimePointerPayload(windowEl, event, options);
        if (!iframe || !payload) return;
        window.postMessageToIframe?.(iframe, payload);
    }

    function getPointerCaptureShield() {
        let shield = document.getElementById("ut99-pointer-capture-shield");
        if (shield) return shield;
        shield = document.createElement("div");
        shield.id = "ut99-pointer-capture-shield";
        shield.className = "ut99-pointer-capture-shield";
        shield.hidden = true;
        shield.setAttribute("aria-hidden", "true");
        document.body.appendChild(shield);
        return shield;
    }

    function isShieldPointerLocked(shield = null) {
        const activeShield = shield || document.getElementById("ut99-pointer-capture-shield");
        return Boolean(activeShield && document.pointerLockElement === activeShield);
    }

    function showPointerCaptureNotice(message) {
        const now = Date.now();
        if (now - pointerCaptureLastNoticeAt < 1600) return;
        pointerCaptureLastNoticeAt = now;
        window.showDesktopToast?.(message);
    }

    function requestShieldPointerLock(shield) {
        if (!shield?.requestPointerLock || isShieldPointerLocked(shield)) return;

        const fallbackRequest = () => {
            try {
                const request = shield.requestPointerLock();
                request?.catch?.((error) => {
                    logUt99("warning", "UT99 pointer capture was blocked by the browser.", error);
                    showPointerCaptureNotice("Click UT99 to recapture cursor. Ctrl+Alt releases.");
                });
            } catch (error) {
                logUt99("warning", "UT99 pointer capture was blocked by the browser.", error);
                showPointerCaptureNotice("Click UT99 to recapture cursor. Ctrl+Alt releases.");
            }
        };

        try {
            const request = shield.requestPointerLock({ unadjustedMovement: true });
            request?.catch?.(() => fallbackRequest());
        } catch (error) {
            fallbackRequest();
        }
    }

    function shouldRouteCapturedPointer(windowEl, event, shield = null) {
        return isShieldPointerLocked(shield) || isPointerOverRuntimeSurface(windowEl, event);
    }

    function resetCapturedPointerAnchor(event = null) {
        pointerCaptureLastX = Number.isFinite(event?.clientX) ? event.clientX : null;
        pointerCaptureLastY = Number.isFinite(event?.clientY) ? event.clientY : null;
    }

    function postCapturedPointerMove(windowEl, event, options = {}) {
        const iframe = getRuntimeFrame(windowEl);
        if (!iframe) return;
        const nativeLocked = isShieldPointerLocked();
        if (!nativeLocked && !isPointerOverRuntimeSurface(windowEl, event)) return;
        const movementX = Number(event.movementX);
        const movementY = Number(event.movementY);
        const fallbackX = pointerCaptureLastX === null ? 0 : event.clientX - pointerCaptureLastX;
        const fallbackY = pointerCaptureLastY === null ? 0 : event.clientY - pointerCaptureLastY;
        pointerCaptureLastX = event.clientX;
        pointerCaptureLastY = event.clientY;

        const payload = getRuntimePointerPayload(windowEl, event, {
            captureMode: nativeLocked,
            relative: nativeLocked,
            forceRebase: Boolean(options.forceRebase) || !nativeLocked
        });
        if (!payload) return;
        payload.movementX = nativeLocked && Number.isFinite(movementX) && movementX !== 0 ? movementX : (nativeLocked ? fallbackX : 0);
        payload.movementY = nativeLocked && Number.isFinite(movementY) && movementY !== 0 ? movementY : (nativeLocked ? fallbackY : 0);
        payload.buttons = event.buttons || 0;
        window.postMessageToIframe?.(iframe, payload);
    }

    function postCapturedPointerButton(windowEl, event, eventType) {
        const iframe = getRuntimeFrame(windowEl);
        if (!iframe) return;
        window.postMessageToIframe?.(iframe, {
            type: "ut99-pointer-button",
            eventType,
            button: Number(event.button) || 0,
            buttons: event.buttons || 0,
            captureMode: "soft"
        });
    }

    function postCapturedKeyEvent(windowEl, event, eventType) {
        const iframe = getRuntimeFrame(windowEl);
        if (!iframe) return;
        const keyCode = Number(event.keyCode || event.which || 0);
        window.postMessageToIframe?.(iframe, {
            type: "ut99-key-event",
            eventType,
            key: event.key || "",
            code: event.code || "",
            keyCode,
            which: keyCode,
            charCode: Number(event.charCode || 0),
            altKey: Boolean(event.altKey),
            ctrlKey: Boolean(event.ctrlKey),
            shiftKey: Boolean(event.shiftKey),
            metaKey: Boolean(event.metaKey),
            repeat: Boolean(event.repeat),
            captureMode: "soft"
        });
    }

    function releaseUt99PointerCapture(reason = "release", options = {}) {
        const activeWindow = pointerCaptureWindow;
        const shield = document.getElementById("ut99-pointer-capture-shield");
        const shouldExitNativeLock = isShieldPointerLocked(shield);
        if (pointerCaptureAbort) {
            pointerCaptureAbort.abort();
            pointerCaptureAbort = null;
        }
        pointerCaptureWindow = null;
        resetCapturedPointerAnchor();
        document.documentElement.classList.remove("ut99-pointer-capture-active");
        activeWindow?.classList.remove("is-ut99-pointer-captured");
        if (shield) shield.hidden = true;
        if (shouldExitNativeLock) {
            pointerCaptureNativeRelease = true;
            try {
                document.exitPointerLock?.();
            } catch (error) {}
            window.setTimeout(() => {
                pointerCaptureNativeRelease = false;
            }, 0);
        }
        if (!options.silent) {
            window.showDesktopToast?.(reason === "ctrl-alt" ? "Cursor released to PortfoliOS." : "UT99 cursor capture released.");
        }
    }

    function activateUt99PointerCapture(windowEl, startEvent = null) {
        if (!windowEl || !windowEl.isConnected) return;
        if (pointerCaptureWindow && pointerCaptureWindow !== windowEl) {
            releaseUt99PointerCapture("switch", { silent: true });
        }
        if (pointerCaptureAbort) {
            focusRuntimeFrame(windowEl, 0);
            return;
        }

        pointerCaptureWindow = windowEl;
        resetCapturedPointerAnchor(startEvent);
        const shield = getPointerCaptureShield();
        const abort = new AbortController();
        pointerCaptureAbort = abort;
        const signal = abort.signal;

        document.documentElement.classList.add("ut99-pointer-capture-active");
        windowEl.classList.add("is-ut99-pointer-captured");
        shield.hidden = false;
        requestShieldPointerLock(shield);
        focusRuntimeFrame(windowEl, 0);

        const stopDesktopInteraction = (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
        };

        const handleMove = (event) => {
            stopDesktopInteraction(event);
            if (!pointerCaptureWindow) return;
            postCapturedPointerMove(pointerCaptureWindow, event);
        };

        const handleDown = (event) => {
            stopDesktopInteraction(event);
            if (!pointerCaptureWindow) return;
            if (!shouldRouteCapturedPointer(pointerCaptureWindow, event, shield)) return;
            requestShieldPointerLock(shield);
            try {
                shield.setPointerCapture?.(event.pointerId);
            } catch (error) {}
            postCapturedPointerMove(pointerCaptureWindow, event);
            postCapturedPointerButton(pointerCaptureWindow, event, "mousedown");
            focusRuntimeFrame(pointerCaptureWindow, 0);
        };

        const handleUp = (event) => {
            stopDesktopInteraction(event);
            if (!pointerCaptureWindow) return;
            if (!shouldRouteCapturedPointer(pointerCaptureWindow, event, shield)) return;
            postCapturedPointerMove(pointerCaptureWindow, event);
            postCapturedPointerButton(pointerCaptureWindow, event, "mouseup");
            if (event.button === 0) {
                postCapturedPointerButton(pointerCaptureWindow, event, "click");
            }
        };

        const handleKeyEvent = (event) => {
            if (event.ctrlKey && event.altKey) {
                stopDesktopInteraction(event);
                const iframe = getRuntimeFrame(pointerCaptureWindow);
                window.postMessageToIframe?.(iframe, { type: "release-pointer-lock" });
                releaseUt99PointerCapture("ctrl-alt");
                return;
            }
            stopDesktopInteraction(event);
            if (!pointerCaptureWindow) return;
            postCapturedKeyEvent(pointerCaptureWindow, event, event.type);
        };

        const handlePointerLockChange = () => {
            if (!pointerCaptureWindow || isShieldPointerLocked(shield)) return;
            if (pointerCaptureNativeRelease) return;
            focusRuntimeFrame(pointerCaptureWindow, 0);
            showPointerCaptureNotice("Click UT99 to recapture cursor. Ctrl+Alt releases.");
        };

        const handlePointerLockError = () => {
            if (!pointerCaptureWindow) return;
            logUt99("warning", "UT99 pointer capture was blocked by the browser.");
            showPointerCaptureNotice("Click UT99 to recapture cursor. Ctrl+Alt releases.");
        };

        shield.addEventListener("pointermove", handleMove, { signal, capture: true });
        shield.addEventListener("pointerdown", handleDown, { signal, capture: true });
        shield.addEventListener("pointerup", handleUp, { signal, capture: true });
        shield.addEventListener("pointercancel", handleUp, { signal, capture: true });
        ["mousedown", "mouseup", "click", "dblclick", "contextmenu", "wheel", "dragstart"].forEach((eventName) => {
            shield.addEventListener(eventName, stopDesktopInteraction, { signal, capture: true });
        });
        document.addEventListener("keydown", handleKeyEvent, { signal, capture: true });
        document.addEventListener("keypress", handleKeyEvent, { signal, capture: true });
        document.addEventListener("keyup", handleKeyEvent, { signal, capture: true });
        document.addEventListener("pointerlockchange", handlePointerLockChange, { signal });
        document.addEventListener("pointerlockerror", handlePointerLockError, { signal });

        window.showDesktopToast?.("UT99 cursor captured. Press Ctrl+Alt to release.");
    }

    async function requestRuntimeFullscreen(windowEl) {
        const stage = windowEl?.querySelector(".ut99-stage");
        if (!stage || document.fullscreenElement) return;
        try {
            await stage.requestFullscreen();
            windowEl.classList.add("is-runtime-fullscreen");
            focusRuntimeFrame(windowEl, 80);
            const stage = windowEl?.querySelector(".ut99-stage");
            const rect = stage?.getBoundingClientRect?.();
            if (rect) {
                window.postMessageToIframe?.(getRuntimeFrame(windowEl), {
                    type: "ut99-pointer-sync",
                    localX: rect.width / 2,
                    localY: rect.height / 2,
                    viewportWidth: rect.width,
                    viewportHeight: rect.height,
                    buttons: 0,
                    movementX: 0,
                    movementY: 0,
                    fullscreen: true,
                    forceRebase: true
                });
            }
        } catch (error) {
            logUt99("warning", "Browser blocked UT99 fullscreen request.", error);
        }
    }

    function syncRuntimeFullscreenState(windowEl) {
        const fullscreenEl = document.fullscreenElement;
        const active = Boolean(fullscreenEl && windowEl && (fullscreenEl === windowEl || windowEl.contains(fullscreenEl)));
        windowEl?.classList.toggle("is-runtime-fullscreen", active);
        if (!active) {
            window.clampDesktopWindowToBounds?.(windowEl);
        }
    }

    function loadRuntime(windowEl) {
        const iframe = getRuntimeFrame(windowEl);
        if (!iframe) return;

        const needsLoad = !iframe.src || iframe.src === "about:blank";
        if (needsLoad) {
            windowEl.dataset.ut99Loaded = "false";
            windowEl.dataset.ut99BootComplete = "false";
            setBootStatus(windowEl, "Launching runtime");
            iframe.src = iframe.dataset.src;
        } else if (windowEl.dataset.ut99Loaded === "true") {
            setBootVisible(windowEl, false);
        }

        focusRuntimeFrame(windowEl, 80);
        window.clearTimeout(Number(windowEl.dataset.ut99FallbackTimer || 0));
        windowEl.dataset.ut99FallbackTimer = String(window.setTimeout(() => {
            if (windowEl.dataset.ut99Loaded !== "true") {
                setBootStatus(windowEl, "Starting WebAssembly runtime");
                focusRuntimeFrame(windowEl);
            }
        }, 12000));
    }

    function bindRuntime(windowEl) {
        if (windowEl.dataset.ut99Bound === "true") return;
        windowEl.dataset.ut99Bound = "true";

        if (runtimeAbort) runtimeAbort.abort();
        runtimeAbort = new AbortController();
        const signal = runtimeAbort.signal;

        const iframe = getRuntimeFrame(windowEl);
        iframe?.addEventListener("load", () => {
            if (iframe.src && iframe.src !== "about:blank") {
                windowEl.dataset.ut99Loaded = "true";
                window.clearTimeout(Number(windowEl.dataset.ut99FallbackTimer || 0));
                postRuntimeVolume(windowEl);
                focusRuntimeFrame(windowEl);
                setBootStatus(windowEl, "Loading game data");
            }
        });

        const stage = windowEl.querySelector(".ut99-stage");
        iframe?.addEventListener("pointerenter", (event) => syncRuntimePointer(windowEl, event, { forceRebase: true }));
        iframe?.addEventListener("pointermove", (event) => syncRuntimePointer(windowEl, event));
        iframe?.addEventListener("pointerdown", (event) => {
            syncRuntimePointer(windowEl, event, { forceRebase: true });
            primeRuntimeInput(windowEl, 0);
        });
        stage?.addEventListener("pointerenter", (event) => syncRuntimePointer(windowEl, event, { forceRebase: true }), true);
        stage?.addEventListener("pointermove", (event) => syncRuntimePointer(windowEl, event), true);
        stage?.addEventListener("pointerdown", (event) => {
            syncRuntimePointer(windowEl, event, { forceRebase: true });
            primeRuntimeInput(windowEl, 0);
        }, true);
        document.addEventListener("pointermove", (event) => syncRuntimePointer(windowEl, event), { signal, capture: true });
        document.addEventListener("mousemove", (event) => syncRuntimePointer(windowEl, event), { signal, capture: true });

        window.addEventListener("message", (event) => {
            if (!iframe || event.source !== iframe.contentWindow) return;
            const data = event.data || {};
            if (data.source !== "portfolio-ut99-runtime" && data.source !== "portfolio-game-runtime") return;
            if (data.type === "ut99-status") {
                setBootStatus(windowEl, data.status);
            }
            if (data.type === "ut99-log") {
                logUt99(data.level, data.message, data.detail || null);
            }
            if (data.type === "ut99-request-fullscreen") {
                requestRuntimeFullscreen(windowEl);
            }
            if (data.type === "ut99-pointer-capture") {
                activateUt99PointerCapture(windowEl);
            }
            if (data.type === "game-pointer-release") {
                releaseUt99PointerCapture(data.reason || "runtime", { silent: true });
            }
        }, { signal });

        document.addEventListener("fullscreenchange", () => {
            if (!windowEl.isConnected || windowEl.classList.contains("is-hidden")) return;
            syncRuntimeFullscreenState(windowEl);
            focusRuntimeFrame(windowEl, 120);
        }, { signal });
    }

    window.appRegistry[APP_ID] = {
        title: "ut99.exe",
        icon: "fa-solid fa-crosshairs",
        windowClass: "ut99-window game-window",
        renderBody: () => `
            <div class="ut99-shell">
                <div class="ut99-stage">
                    <iframe
                        data-src="${RUNTIME_URL}"
                        class="ut99-frame game-frame"
                        title="Unreal Tournament 99 WebAssembly runtime"
                        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups"
                        allow="fullscreen; pointer-lock; autoplay"
                        tabindex="0"
                        allowfullscreen>
                    </iframe>
                    <div class="ut99-boot" data-ut99-boot>
                        <div class="ut99-boot-inner">
                            <i class="fa-solid fa-crosshairs"></i>
                            <strong>Unreal Tournament</strong>
                            <span data-ut99-loader-status>Launching runtime</span>
                            <div class="ut99-loader-track" aria-hidden="true">
                                <span data-ut99-loader-progress></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        onOpen: (windowEl) => {
            bindRuntime(windowEl);
            if (!unregisterAudio && window.registerAppAudioAdapter) {
                unregisterAudio = window.registerAppAudioAdapter(APP_ID, {
                    setVolume(volume) {
                        const activeWindow = document.querySelector('[data-window="ut99"]');
                        postRuntimeVolume(activeWindow, volume);
                    }
                });
            }
            loadRuntime(windowEl);
            reportRuntimeAssetScope(windowEl);
            window.syncGameIframe?.(windowEl);
            postRuntimeVolume(windowEl);
        },
        onMinimize: (windowEl) => {
            const iframe = getRuntimeFrame(windowEl);
            releaseUt99PointerCapture("minimize", { silent: true });
            window.postMessageToIframe?.(iframe, { type: "release-pointer-lock" });
        },
        onMaximize: (windowEl) => {
            window.syncGameIframe?.(windowEl);
            window.clampDesktopWindowToBounds?.(windowEl);
            focusRuntimeFrame(windowEl, 120);
            postRuntimeVolume(windowEl);
        },
        onClose: (windowEl) => {
            releaseUt99PointerCapture("close", { silent: true });
            window.clearTimeout(Number(windowEl?.dataset.ut99FallbackTimer || 0));
            window.clearTimeout(Number(windowEl?.dataset.ut99BootTimer || 0));
            if (runtimeAbort) {
                runtimeAbort.abort();
                runtimeAbort = null;
            }
            if (unregisterAudio) {
                unregisterAudio();
                unregisterAudio = null;
            }
            const iframe = getRuntimeFrame(windowEl);
            if (iframe) iframe.src = "about:blank";
        }
    };
})();
