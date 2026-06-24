/**
 * PortfoliOS: Local AI Service
 * Permission-gated browser LLM lifecycle, status reporting, and CLI assistant bridge.
 */
(function() {
    const MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";
    const MODEL_LABEL = "SmolLM2 360M Instruct";
    const MEMORY_MB = 376;
    const WORKER_URL = "core/local-ai-worker.js?v=1.0.39";
    const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm";

    let engine = null;
    let worker = null;
    let loadPromise = null;
    let permissionGranted = false;
    let permissionPrompt = null;
    let status = "idle";
    let progress = 0;
    let statusText = "Local AI is off.";
    let lastError = "";
    let stopRequested = false;

    const escapeHtml = window.escapeHtml || ((value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;"));

    function emitStatus() {
        window.EventBus?.emit("local-ai:status", getStatus());
        window.renderLocalAITray?.();
    }

    function setStatus(nextStatus, nextText = statusText, nextProgress = progress) {
        status = nextStatus;
        statusText = nextText;
        progress = Math.max(0, Math.min(1, Number(nextProgress) || 0));
        emitStatus();
    }

    function getStatus() {
        return {
            enabled: status === "loading" || status === "ready" || status === "generating",
            ready: status === "ready",
            busy: status === "loading" || status === "generating",
            status,
            modelId: MODEL_ID,
            modelLabel: MODEL_LABEL,
            memoryMB: MEMORY_MB,
            progress,
            statusText,
            lastError,
            permissionGranted,
            webGpuSupported: Boolean(navigator.gpu)
        };
    }

    function getProcess() {
        if (!["loading", "ready", "generating"].includes(status)) return null;
        return {
            id: "local-ai-service",
            name: "Local AI Worker",
            icon: "fa-solid fa-brain",
            status: status === "loading" ? "Loading" : (status === "generating" ? "Active" : "Running"),
            memory: MEMORY_MB,
            isSystem: false,
            service: true
        };
    }

    function removePermissionPrompt(value) {
        if (!permissionPrompt) return;
        const { overlay, resolve } = permissionPrompt;
        permissionPrompt = null;
        overlay.remove();
        resolve(value);
    }

    function requestPermission(source = "PortfoliOS") {
        if (permissionGranted) return Promise.resolve(true);
        if (permissionPrompt) return permissionPrompt.promise;

        const overlay = document.createElement("div");
        overlay.className = "local-ai-consent-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "local-ai-consent-title");
        overlay.innerHTML = `
            <div class="local-ai-consent-dialog">
                <div class="local-ai-consent-icon"><i class="fa-solid fa-brain"></i></div>
                <div class="local-ai-consent-copy">
                    <p class="eyebrow">Local AI Permission</p>
                    <h2 id="local-ai-consent-title">Run ${escapeHtml(MODEL_LABEL)}?</h2>
                    <p>${escapeHtml(source)} wants to start the Local AI assistant. It runs in your browser using WebGPU, downloads model assets on first use, and reserves about <strong>${MEMORY_MB} MB</strong> of GPU/browser memory while active.</p>
                    <p>You can stop it any time from Task Manager or the Local AI tray indicator.</p>
                </div>
                <div class="local-ai-consent-actions">
                    <button type="button" class="local-ai-consent-secondary" data-local-ai-consent="deny">Not now</button>
                    <button type="button" class="local-ai-consent-primary" data-local-ai-consent="allow">
                        <i class="fa-solid fa-bolt"></i> Enable Local AI
                    </button>
                </div>
            </div>
        `;

        const host = document.querySelector(".desktop-wallpaper") || document.body;
        host.appendChild(overlay);

        let resolvePrompt;
        const promise = new Promise((resolve) => {
            resolvePrompt = resolve;
        });
        permissionPrompt = { overlay, resolve: resolvePrompt, promise };

        overlay.addEventListener("click", (event) => {
            const action = event.target.closest("[data-local-ai-consent]")?.dataset.localAiConsent;
            if (!action) return;
            const allowed = action === "allow";
            permissionGranted = allowed;
            removePermissionPrompt(allowed);
        });

        overlay.querySelector("[data-local-ai-consent='allow']")?.focus({ preventScroll: true });
        return promise;
    }

    async function loadEngine() {
        if (engine) return engine;
        if (loadPromise) return loadPromise;

        if (!navigator.gpu) {
            lastError = "WebGPU is not available in this browser.";
            setStatus("error", lastError, 0);
            throw new Error(lastError);
        }

        setStatus("loading", "Loading WebLLM runtime...", 0.02);

        loadPromise = (async () => {
            try {
                stopRequested = false;
                const webllm = await import(WEBLLM_URL);
                if (stopRequested) {
                    setStatus("idle", "Local AI is off.", 0);
                    return null;
                }
                worker = new Worker(WORKER_URL, { type: "module" });
                engine = await webllm.CreateWebWorkerMLCEngine(
                    worker,
                    MODEL_ID,
                    {
                        initProgressCallback: (initProgress) => {
                            const nextProgress = Number(initProgress?.progress || 0);
                            const text = initProgress?.text || "Loading local model...";
                            setStatus("loading", text, nextProgress);
                        },
                        appConfig: {
                            ...webllm.prebuiltAppConfig,
                            cacheBackend: "cache"
                        }
                    }
                );
                if (stopRequested) {
                    await disable("user");
                    return null;
                }
                lastError = "";
                setStatus("ready", "Local AI is ready.", 1);
                return engine;
            } catch (error) {
                if (stopRequested) {
                    setStatus("idle", "Local AI is off.", 0);
                    return null;
                }
                lastError = error?.message || "Local AI failed to start.";
                await disable("error", { preserveError: true });
                setStatus("error", lastError, 0);
                throw error;
            } finally {
                loadPromise = null;
            }
        })();

        return loadPromise;
    }

    async function enable(source = "PortfoliOS") {
        if (status === "ready") return getStatus();
        if (status === "loading" && loadPromise) {
            await loadPromise;
            return getStatus();
        }

        if (!navigator.gpu) {
            lastError = "WebGPU is not available in this browser.";
            setStatus("error", lastError, 0);
            throw new Error(lastError);
        }

        const allowed = await requestPermission(source);
        if (!allowed) {
            setStatus("idle", "Local AI is off.", 0);
            return getStatus();
        }

        await loadEngine();
        return getStatus();
    }

    async function disable(reason = "user", options = {}) {
        stopRequested = true;
        permissionGranted = false;
        if (permissionPrompt) removePermissionPrompt(false);

        try {
            if (engine && typeof engine.unload === "function") {
                await engine.unload();
            }
        } catch (error) {
            console.warn("Local AI unload failed.", error);
        }

        if (worker) {
            worker.terminate();
            worker = null;
        }
        engine = null;
        loadPromise = null;

        if (!options.preserveError) {
            lastError = "";
        }

        const text = reason === "taskmgr"
            ? "Local AI was ended from Task Manager."
            : reason === "tray"
                ? "Local AI was stopped from the tray."
                : "Local AI is off.";
        setStatus("idle", text, 0);
        return getStatus();
    }

    function buildCliMessages(prompt, context = {}) {
        const cwd = context.cwd || "/";
        const user = context.user || "guest";
        return [
            {
                role: "system",
                content: [
                    "You are the Local AI assistant inside PortfoliOS CLI.",
                    "Keep answers concise and practical.",
                    "Do not claim you executed commands.",
                    "When a user enters an invalid command, explain the likely intent and suggest one or two valid PortfoliOS commands.",
                    "Known shell commands include: help, clear, whoami, whoami --info, links, projects, status, quick, play doom, inspect <id>, open <target>, pwd, cd, ls, ls -l, cat, touch, mkdir, rm, echo, su, passwd, useradd, userdel, groups, id, ai on, ai off.",
                    `Current shell user: ${user}. Current directory: ${cwd}.`
                ].join("\n")
            },
            {
                role: "user",
                content: prompt
            }
        ];
    }

    async function chat(prompt, context = {}) {
        if (status !== "ready" || !engine) {
            throw new Error("Local AI is not enabled.");
        }

        setStatus("generating", "Local AI is answering...", 1);
        try {
            const reply = await engine.chat.completions.create({
                messages: buildCliMessages(prompt, context),
                temperature: 0.35,
                top_p: 0.9,
                max_tokens: 180
            });
            return reply?.choices?.[0]?.message?.content?.trim() || "Local AI did not return a response.";
        } finally {
            setStatus("ready", "Local AI is ready.", 1);
        }
    }

    window.LocalAI = {
        MODEL_ID,
        MODEL_LABEL,
        MEMORY_MB,
        getStatus,
        getProcess,
        requestPermission,
        enable,
        disable,
        chat,
        isReady: () => status === "ready" && Boolean(engine),
        isRunning: () => ["loading", "ready", "generating"].includes(status)
    };

    emitStatus();
})();
