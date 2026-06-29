/**
 * PortfoliOS: Local AI Service
 * Permission-gated browser LLM lifecycle, status reporting, and CLI assistant bridge.
 */
(function() {
    const STORAGE_KEY = "bl4ut0LocalAiModel";
    const AVAILABLE_MODELS = [
        // ── Cloud Models (Free) ────────────────────────────────────
        {
            id: "gemini-2.5-flash",
            label: "Gemini 2.5 Flash (Cloud - Limited)",
            memoryMB: 0,
            type: "cloud-gemini",
            free: true
        },
        // ── Cloud Models (API Key Required) ────────────────────────
        {
            id: "gpt-4o-mini",
            label: "GPT-4o Mini (OpenAI)",
            memoryMB: 0,
            type: "cloud-openai",
            free: false
        },
        {
            id: "gpt-4o",
            label: "GPT-4o (OpenAI)",
            memoryMB: 0,
            type: "cloud-openai",
            free: false
        },
        {
            id: "gemini-1.5-pro",
            label: "Gemini 1.5 Pro (Google)",
            memoryMB: 0,
            type: "cloud-gemini",
            free: false
        },
        // ── Local Models (WebGPU) ──────────────────────────────────
        {
            id: "SmolLM2-135M-Instruct-q4f16_1-MLC",
            label: "SmolLM2 135M (Hyper-light, 360MB VRAM)",
            memoryMB: 360,
            type: "local"
        },
        {
            id: "gemma-3-270m-it-q4f16_1-MLC",
            label: "Gemma 3 270M (Hyper-light, 380MB VRAM - shader-f16 required)",
            memoryMB: 380,
            type: "local",
            required_features: ["shader-f16"]
        },
        {
            id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
            label: "SmolLM2 360M (Ultra-light, 520MB VRAM)",
            memoryMB: 520,
            type: "local"
        },
        {
            id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
            label: "Qwen 2.5 0.5B (Light, 700MB VRAM)",
            memoryMB: 700,
            type: "local"
        },
        {
            id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
            label: "Llama 3.2 1B (Balanced, 1.4GB VRAM)",
            memoryMB: 1400,
            type: "local"
        },
        {
            id: "gemma3-1b-it-q4f16_1-MLC",
            label: "Gemma 3 1B (Fast, 1.2GB VRAM - shader-f16 required)",
            memoryMB: 1200,
            type: "local"
        },
        {
            id: "gemma-2b-it-q4f16_1-MLC-1k",
            label: "Gemma 2B Fast (1K, 1.5GB VRAM)",
            memoryMB: 1500,
            type: "local"
        },
        {
            id: "gemma-2-2b-it-q4f16_1-MLC",
            label: "Gemma 2 2B (High Quality, 2.4GB VRAM - shader-f16 required)",
            memoryMB: 2400,
            type: "local"
        }
    ];

    const DEFAULT_LOCAL_MODEL_ID = "SmolLM2-135M-Instruct-q4f16_1-MLC";
    const LEGACY_MODEL_ALIASES = {
        "gemma-3-1b-it-q4f16_1-MLC": "gemma3-1b-it-q4f16_1-MLC"
    };
    const CUSTOM_WEBLLM_MODELS = [
        {
            model: "https://huggingface.co/Aadeshisdoingsomething/gemma-3-270m-it-q4f16_1-mlc",
            model_id: "gemma-3-270m-it-q4f16_1-MLC",
            model_lib: "https://huggingface.co/Aadeshisdoingsomething/gemma-3-270m-it-q4f16_1-mlc/resolve/main/gemma-3-270m-it-q4f16_1-webgpu.wasm",
            vram_requirement_MB: 200,
            required_features: ["shader-f16"],
            overrides: {
                sliding_window_size: -1
            }
        }
    ];
    const PREFERRED_MODEL = AVAILABLE_MODELS.find(m => m.id === DEFAULT_LOCAL_MODEL_ID) ||
        AVAILABLE_MODELS.find(m => m.type === "local") ||
        AVAILABLE_MODELS[0];
    const FALLBACK_MODEL_IDS = AVAILABLE_MODELS
        .filter(m => m.type === "local")
        .map(m => m.id);
    const WORKER_URL = "core/local-ai-worker.php?v=1.0.63";
    const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm";
    const STATUS_EMIT_MIN_MS = 220;
    const CHAT_MAX_TOKENS = 120;

    let engine = null;
    let worker = null;
    let currentAbortController = null;
    let webllmModule = null;
    let runtimeImportPromise = null;
    let loadPromise = null;
    function normalizeModelId(modelId) {
        return LEGACY_MODEL_ALIASES[modelId] || modelId || "";
    }

    function isCloudModel(model) {
        return Boolean(model?.type && model.type.startsWith("cloud-"));
    }

    function getCatalogModel(modelId) {
        const normalizedId = normalizeModelId(modelId);
        return AVAILABLE_MODELS.find(m => m.id === normalizedId);
    }

    function persistNormalizedModelId(rawModelId, normalizedModelId) {
        if (rawModelId && normalizedModelId && rawModelId !== normalizedModelId) {
            localStorage.setItem(STORAGE_KEY, normalizedModelId);
        }
    }

    let autodetectedMirror = null;

    async function checkMirrorSupport() {
        if (autodetectedMirror !== null) return autodetectedMirror;
        
        emitAIDebug("Testing connection to huggingface.co...", getAIDebugSnapshot());
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        try {
            await fetch("https://huggingface.co/api/quick", {
                method: "HEAD",
                mode: "no-cors",
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            autodetectedMirror = false;
            emitAIDebug("huggingface.co connection test succeeded.", getAIDebugSnapshot());
        } catch (err) {
            clearTimeout(timeoutId);
            autodetectedMirror = true;
            emitAIDebug("huggingface.co connection test failed/timed out. Automatically enabling mirror.", getAIDebugSnapshot({ error: err?.message || "timeout" }));
            console.warn("[LocalAI] huggingface.co is unreachable. Automatically routing via hf-mirror.com.");
        }
        return autodetectedMirror;
    }

    function getUseMirrorValue() {
        const stored = localStorage.getItem("bl4ut0LocalAiUseMirror");
        if (stored !== null) {
            return stored === "true";
        }
        return autodetectedMirror === true;
    }

    function mapRuntimeUrl(url, useMirror = getUseMirrorValue()) {
        if (!url) return url;
        if (useMirror) {
            return url.replace("https://huggingface.co/", "https://hf-mirror.com/");
        }
        return url;
    }

    function getRuntimeModelList(webllm) {
        const useMirror = getUseMirrorValue();
        const prebuiltModels = (webllm?.prebuiltAppConfig?.model_list || []).map(m => {
            if (useMirror && m.model) {
                return {
                    ...m,
                    model: mapRuntimeUrl(m.model, useMirror),
                    model_lib: mapRuntimeUrl(m.model_lib, useMirror)
                };
            }
            return m;
        });
        const customModels = CUSTOM_WEBLLM_MODELS.map(m => ({
            ...m,
            model: mapRuntimeUrl(m.model, useMirror),
            model_lib: mapRuntimeUrl(m.model_lib, useMirror)
        }));
        return [...prebuiltModels, ...customModels];
    }

    // Initialize modelInfo from localStorage preference or fallback
    const storedIdOnLoad = localStorage.getItem(STORAGE_KEY);
    const savedIdOnLoad = normalizeModelId(storedIdOnLoad);
    persistNormalizedModelId(storedIdOnLoad, savedIdOnLoad);
    const hasOpenaiKeyOnLoad = !!localStorage.getItem("settings-openai-api-key");
    const hasGeminiKeyOnLoad = !!localStorage.getItem("settings-gemini-api-key");
    const isOwnerOnLoad = !window.getCurrentUser || window.getCurrentUser()?.id === "bl4ut0";
    const isModelAllowedOnLoad = (m) => {
        if (m.type === "cloud-openai") return hasOpenaiKeyOnLoad;
        if (m.type === "cloud-gemini") {
            return m.free ? (isOwnerOnLoad || hasGeminiKeyOnLoad) : hasGeminiKeyOnLoad;
        }
        return true;
    };

    const initialModelId = (savedIdOnLoad && getCatalogModel(savedIdOnLoad) && isModelAllowedOnLoad(getCatalogModel(savedIdOnLoad)) ? savedIdOnLoad : "") ||
        AVAILABLE_MODELS.find(m => m.type === "local" && isModelAllowedOnLoad(m))?.id ||
        DEFAULT_LOCAL_MODEL_ID;

    const initialModel = getCatalogModel(initialModelId) || PREFERRED_MODEL;
    let modelInfo = {
        ...initialModel,
        source: savedIdOnLoad ? (storedIdOnLoad !== savedIdOnLoad ? "legacy-fallback" : "user-preference") : "fallback-local",
        confirmed: false,
        note: ""
    };

    let permissionGranted = false;
    let permissionPrompt = null;
    let status = "idle";
    let progress = 0;
    let statusText = isCloudModel(modelInfo) ? "Cloud AI is off." : "Local AI is off.";
    let lastError = "";
    let stopRequested = false;
    let lastStatusEmitAt = 0;
    let statusEmitTimer = null;
    let statusEmitFrame = null;
    let aiDebugWatchdogTimer = null;
    let aiDebugLastChangeAt = Date.now();
    let aiDebugLastProgressLogAt = 0;
    let aiDebugLastLoggedPct = -1;
    let aiDebugLastLoggedText = "";
    let aiDebugLastStatus = "";
    const AI_DEBUG_STALL_MS = 15000;
    const AI_DEBUG_PROGRESS_STEP = 5;

    const escapeHtml = window.escapeHtml || ((value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;"));

    function getAIDebugSnapshot(extra = {}) {
        return {
            status,
            progress,
            progressLabel: `${Math.round((progress || 0) * 100)}%`,
            statusText,
            modelId: modelInfo?.id || "",
            modelLabel: modelInfo?.label || "",
            modelType: modelInfo?.type || "local",
            modelSource: modelInfo?.source || "",
            mirror: localStorage.getItem("bl4ut0LocalAiUseMirror") === "true",
            webGpu: Boolean(navigator.gpu),
            crossOriginIsolated: Boolean(window.crossOriginIsolated),
            workerUrl: WORKER_URL,
            runtimeUrl: WEBLLM_URL,
            userAgent: navigator.userAgent,
            ...extra
        };
    }

    function serializeDebugValue(value) {
        if (!value) return "";
        if (value instanceof Error) {
            return value.stack || value.message;
        }
        try {
            return JSON.stringify(value);
        } catch (error) {
            return String(value);
        }
    }

    function emitAIDebug(message, detail = null) {
        const detailText = detail ? ` ${serializeDebugValue(detail)}` : "";
        const line = `[LocalAI] ${message}${detailText}`;
        if (window.addSystemLog) {
            window.addSystemLog("ai", line);
        } else {
            console.info(line);
        }
    }

    function stopAIDebugWatchdog() {
        if (!aiDebugWatchdogTimer) return;
        window.clearInterval(aiDebugWatchdogTimer);
        aiDebugWatchdogTimer = null;
    }

    function startAIDebugWatchdog() {
        if (aiDebugWatchdogTimer) return;
        aiDebugWatchdogTimer = window.setInterval(() => {
            if (status !== "loading") {
                stopAIDebugWatchdog();
                return;
            }

            const idleMs = Date.now() - aiDebugLastChangeAt;
            if (idleMs < AI_DEBUG_STALL_MS) return;

            emitAIDebug("Load watchdog: still waiting for Local AI progress.", getAIDebugSnapshot({
                idleSeconds: Math.round(idleMs / 1000),
                hint: progress <= 0.05
                    ? "Stuck near 4% usually means the worker was created and WebLLM has not emitted model init progress yet. Check worker import, model URL, WebGPU adapter, cache, and network access."
                    : "Progress callback has not advanced recently."
            }));
            aiDebugLastChangeAt = Date.now();
        }, AI_DEBUG_STALL_MS);
    }

    function trackAIDebugStatus(previousStatus, previousText, previousProgress, options = {}) {
        const pct = Math.round((progress || 0) * 100);
        const previousPct = Math.round((previousProgress || 0) * 100);
        const changed = previousStatus !== status || previousText !== statusText || previousPct !== pct;

        if (changed) {
            aiDebugLastChangeAt = Date.now();
        }

        if (status === "loading") {
            startAIDebugWatchdog();
            const now = Date.now();
            const crossedStep = pct !== aiDebugLastLoggedPct && (pct <= 5 || pct % AI_DEBUG_PROGRESS_STEP === 0);
            const textChanged = statusText !== aiDebugLastLoggedText && now - aiDebugLastProgressLogAt > 1200;
            if (options.force || crossedStep || textChanged) {
                aiDebugLastProgressLogAt = now;
                aiDebugLastLoggedPct = pct;
                aiDebugLastLoggedText = statusText;
                emitAIDebug("Loading progress update.", getAIDebugSnapshot());
            }
            return;
        }

        stopAIDebugWatchdog();

        const statusKey = `${status}:${statusText}`;
        if (statusKey !== aiDebugLastStatus || options.force) {
            aiDebugLastStatus = statusKey;
            emitAIDebug("Status changed.", getAIDebugSnapshot({ lastError }));
        }
    }

    function flushStatus() {
        if (statusEmitTimer) {
            window.clearTimeout(statusEmitTimer);
            statusEmitTimer = null;
        }
        if (statusEmitFrame) {
            window.cancelAnimationFrame(statusEmitFrame);
            statusEmitFrame = null;
        }
        lastStatusEmitAt = performance.now();
        const snapshot = getStatus();
        if (window.EventBus) {
            window.EventBus.emit("local-ai:status", snapshot);
        } else {
            window.renderLocalAITray?.();
        }
    }

    function emitStatus(options = {}) {
        if (options.force) {
            flushStatus();
            return;
        }

        if (statusEmitTimer || statusEmitFrame) return;

        const elapsed = performance.now() - lastStatusEmitAt;
        const scheduleFrame = () => {
            statusEmitFrame = window.requestAnimationFrame(() => {
                statusEmitFrame = null;
                flushStatus();
            });
        };

        if (elapsed >= STATUS_EMIT_MIN_MS) {
            scheduleFrame();
        } else {
            statusEmitTimer = window.setTimeout(() => {
                statusEmitTimer = null;
                scheduleFrame();
            }, STATUS_EMIT_MIN_MS - elapsed);
        }
    }

    function setStatus(nextStatus, nextText = statusText, nextProgress = progress, options = {}) {
        const previousStatus = status;
        const previousText = statusText;
        const previousProgress = progress;
        status = nextStatus;
        statusText = nextText;
        progress = Math.max(0, Math.min(1, Number(nextProgress) || 0));
        trackAIDebugStatus(previousStatus, previousText, previousProgress, options);
        emitStatus(options);
    }

    function yieldToBrowser() {
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
        });
    }

    function getStatus() {
        const isCloud = isCloudModel(modelInfo);
        if (isCloud) {
            const isReady = status === "ready" || status === "generating";
            return {
                enabled: isReady,
                ready: isReady,
                busy: status === "generating",
                status: status === "generating" ? "generating" : (isReady ? "ready" : "idle"),
                modelId: modelInfo.id,
                modelLabel: modelInfo.label,
                modelType: modelInfo.type,
                memoryMB: 0,
                modelSource: modelInfo.source,
                modelConfirmed: true,
                modelNote: "Cloud-hosted model via API.",
                preferredModelId: PREFERRED_MODEL.id,
                preferredModelLabel: PREFERRED_MODEL.label,
                progress: 0,
                statusText: status === "generating" ? "Cloud AI is generating..." : (isReady ? "Cloud AI is ready." : "Cloud AI is off."),
                lastError,
                permissionGranted: true,
                webGpuSupported: Boolean(navigator.gpu),
                executionMode: "cloud-api",
                isolationLabel: "Cloud Endpoint",
                gpuSharedWithPage: false,
                performanceNote: "Prompts are routed directly to cloud provider API endpoints."
            };
        }
        return {
            enabled: status === "loading" || status === "ready" || status === "generating",
            ready: status === "ready",
            busy: status === "loading" || status === "generating",
            status,
            modelId: modelInfo.id,
            modelLabel: modelInfo.label,
            modelType: modelInfo.type || "local",
            memoryMB: modelInfo.memoryMB,
            modelSource: modelInfo.source,
            modelConfirmed: modelInfo.confirmed,
            modelNote: modelInfo.note,
            preferredModelId: PREFERRED_MODEL.id,
            preferredModelLabel: PREFERRED_MODEL.label,
            progress,
            statusText,
            lastError,
            permissionGranted,
            webGpuSupported: Boolean(navigator.gpu),
            executionMode: "web-worker-webgpu",
            isolationLabel: "Background GPU worker",
            gpuSharedWithPage: true,
            performanceNote: "Model JavaScript runs in a Worker. WebGPU compute still shares the browser GPU with rendering."
        };
    }

    function getProcess() {
        const isCloud = isCloudModel(modelInfo);
        if (isCloud) return null;
        if (!["loading", "ready", "generating"].includes(status)) return null;
        return {
            id: "local-ai-service",
            name: "Local AI Worker",
            icon: "fa-solid fa-brain",
            status: status === "loading" ? "Loading" : (status === "generating" ? "Background GPU" : "Running"),
            memory: modelInfo.memoryMB,
            isSystem: false,
            service: true,
            executionMode: "Web Worker + shared WebGPU"
        };
    }

    function humanizeModelId(modelId) {
        return String(modelId || "Local model")
            .replace(/-MLC$/i, "")
            .replace(/-q\d+f\d+(?:_\d+)?/ig, "")
            .replace(/-/g, " ")
            .replace(/\bInstruct\b/i, "Instruct")
            .trim();
    }

    function getModelMemoryMB(record, fallback = PREFERRED_MODEL.memoryMB) {
        const raw = Number(record?.vram_required_MB || record?.vram_requirement_MB || record?.memoryMB || fallback);
        return Math.max(1, Math.round(raw));
    }

    function isTextGenerationModel(record, webllm) {
        if (!record?.model_id) return false;

        const embeddingType = webllm?.ModelType?.embedding;
        if (embeddingType !== undefined && record.model_type === embeddingType) return false;

        const searchable = `${record.model_id} ${record.model || ""}`.toLowerCase();
        return !/(embed|embedding|vision|vlm|clip|whisper|stable-diffusion|text-to-image)/i.test(searchable);
    }

    function modelFromRecord(record, source, note = "") {
        const catalogModel = getCatalogModel(record.model_id);
        return {
            ...(catalogModel || {}),
            id: record.model_id,
            label: catalogModel?.label || humanizeModelId(record.model_id),
            memoryMB: catalogModel?.memoryMB || getModelMemoryMB(record),
            type: "local",
            source,
            confirmed: true,
            note
        };
    }

    function selectModel(webllm) {
        const prebuiltModelCount = Array.isArray(webllm?.prebuiltAppConfig?.model_list)
            ? webllm.prebuiltAppConfig.model_list.length
            : 0;
        const modelList = getRuntimeModelList(webllm);

        const storedId = localStorage.getItem(STORAGE_KEY);
        const savedId = normalizeModelId(storedId) || (isCloudModel(modelInfo) ? DEFAULT_LOCAL_MODEL_ID : modelInfo.id) || DEFAULT_LOCAL_MODEL_ID;
        const savedSource = storedId ? (storedId !== savedId ? "legacy-fallback" : "user-preference") : "fallback-local";
        persistNormalizedModelId(storedId, savedId);

        const savedRecord = modelList.find((item) => item?.model_id === savedId);
        if (savedRecord && isTextGenerationModel(savedRecord, webllm)) {
            return modelFromRecord(savedRecord, savedSource);
        }

        const savedModel = getCatalogModel(savedId);
        if (savedModel && savedModel.type === "local") {
            emitAIDebug("Selected local model is not in WebLLM prebuilt list; selecting fallback.", getAIDebugSnapshot({
                requestedModelId: savedId,
                prebuiltModelCount,
                runtimeModelCount: modelList.length
            }));
        }

        const preferredRecord = modelList.find((item) => item?.model_id === PREFERRED_MODEL.id);
        if (preferredRecord && isTextGenerationModel(preferredRecord, webllm)) {
            return modelFromRecord(preferredRecord, "preferred");
        }

        const knownFallback = FALLBACK_MODEL_IDS
            .map((modelId) => modelList.find((item) => item?.model_id === modelId))
            .filter((record) => isTextGenerationModel(record, webllm))
            .sort((a, b) => getModelMemoryMB(a, Number.MAX_SAFE_INTEGER) - getModelMemoryMB(b, Number.MAX_SAFE_INTEGER))[0];

        if (knownFallback) {
            return modelFromRecord(
                knownFallback,
                "fallback",
                `Selected fallback model due to VRAM constraints or availability.`
            );
        }

        const smallestTextModel = modelList
            .filter((record) => isTextGenerationModel(record, webllm))
            .sort((a, b) => getModelMemoryMB(a, Number.MAX_SAFE_INTEGER) - getModelMemoryMB(b, Number.MAX_SAFE_INTEGER))[0];

        if (smallestTextModel) {
            return modelFromRecord(
                smallestTextModel,
                "auto",
                `Selected smallest compatible prebuilt chat model.`
            );
        }

        return {
            ...PREFERRED_MODEL,
            source: "preferred",
            confirmed: false,
            note: "WebLLM did not expose a prebuilt model list. PortfoliOS will try the preferred model."
        };
    }

    async function loadWebLLMModule() {
        if (webllmModule) return webllmModule;
        if (runtimeImportPromise) return runtimeImportPromise;

        emitAIDebug("Importing WebLLM runtime.", getAIDebugSnapshot());
        runtimeImportPromise = import(WEBLLM_URL)
            .then((webllm) => {
                webllmModule = webllm;
                modelInfo = selectModel(webllm);
                emitAIDebug("WebLLM runtime imported and model selected.", getAIDebugSnapshot({
                    prebuiltModelCount: Array.isArray(webllm?.prebuiltAppConfig?.model_list)
                        ? webllm.prebuiltAppConfig.model_list.length
                        : 0
                }));
                emitStatus({ force: true });
                return webllm;
            })
            .catch((error) => {
                emitAIDebug("WebLLM runtime import failed.", getAIDebugSnapshot({ error: serializeDebugValue(error) }));
                throw error;
            })
            .finally(() => {
                runtimeImportPromise = null;
            });

        return runtimeImportPromise;
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

        const isCloud = isCloudModel(modelInfo);
        const isFreeCloud = isCloud && modelInfo.free;

        const overlay = document.createElement("div");
        overlay.className = "local-ai-consent-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "local-ai-consent-title");

        let dialogHtml = "";

        if (isCloud) {
            if (isFreeCloud) {
                dialogHtml = `
                    <div class="local-ai-consent-dialog">
                        <div class="local-ai-consent-icon" style="background: rgba(34, 211, 238, 0.1); color: var(--theme-primary, #22d3ee);"><i class="fa-solid fa-cloud"></i></div>
                        <div class="local-ai-consent-copy">
                            <p class="eyebrow">Cloud AI Notice</p>
                            <h2 id="local-ai-consent-title">Connect to ${escapeHtml(modelInfo.label)}?</h2>
                            <p>This is a <strong>free, collectively shared tier</strong> of Gemini Cloud available to all users of PortfoliOS. Response limits are shared.</p>
                            <p style="margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.85;">
                                💡 <strong>Tips:</strong><br>
                                • For unlimited, private responses, choose a <strong>Local WebGPU model</strong> (which runs entirely on your device).<br>
                                • To bypass shared limits, insert your own Gemini API key in settings.
                            </p>
                        </div>
                        <div class="local-ai-consent-actions">
                            <button type="button" class="local-ai-consent-secondary" data-local-ai-consent="deny">Cancel</button>
                            <button type="button" class="local-ai-consent-primary" data-local-ai-consent="allow">
                                <i class="fa-solid fa-plug"></i> Connect to Cloud AI
                            </button>
                        </div>
                    </div>
                `;
            } else {
                dialogHtml = `
                    <div class="local-ai-consent-dialog">
                        <div class="local-ai-consent-icon" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;"><i class="fa-solid fa-key"></i></div>
                        <div class="local-ai-consent-copy">
                            <p class="eyebrow">API Key Required</p>
                            <h2 id="local-ai-consent-title">Use ${escapeHtml(modelInfo.label)}?</h2>
                            <p>To use this premium cloud model, you must configure your own API key in settings.</p>
                        </div>
                        <div class="local-ai-consent-actions">
                            <button type="button" class="local-ai-consent-secondary" data-local-ai-consent="deny">Cancel</button>
                            <button type="button" class="local-ai-consent-primary" data-local-ai-consent="settings">
                                <i class="fa-solid fa-sliders"></i> Open Settings
                            </button>
                        </div>
                    </div>
                `;
            }
        } else {
            dialogHtml = `
                <div class="local-ai-consent-dialog">
                    <div class="local-ai-consent-icon"><i class="fa-solid fa-brain"></i></div>
                    <div class="local-ai-consent-copy">
                        <p class="eyebrow">Local AI Permission</p>
                        <h2 id="local-ai-consent-title">Run ${escapeHtml(modelInfo.label)}?</h2>
                        <p>${escapeHtml(source)} wants to start the Local AI assistant. It runs in your browser using WebGPU, downloads model assets on first use, and reserves about <strong>${modelInfo.memoryMB} MB</strong> of GPU/browser memory while active.</p>
                        <p style="margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.85;">
                            💡 <strong>Note:</strong><br>
                            Local models run entirely on your device for 100% privacy. The lower the memory footprint, the faster the performance, but response quality may vary.
                        </p>
                    </div>
                    <div class="local-ai-consent-actions">
                        <button type="button" class="local-ai-consent-secondary" data-local-ai-consent="deny">Cancel</button>
                        <button type="button" class="local-ai-consent-primary" data-local-ai-consent="allow">
                            <i class="fa-solid fa-bolt"></i> Enable Local AI
                        </button>
                    </div>
                </div>
            `;
        }

        overlay.innerHTML = dialogHtml;
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
            if (action === "settings") {
                removePermissionPrompt(false);
                if (window.openDesktopWindow) {
                    window.openDesktopWindow("settings").then(() => {
                        if (window.openSettingsPanel) window.openSettingsPanel("local-ai");
                    });
                }
                return;
            }
            const allowed = action === "allow";
            emitAIDebug(allowed ? "Permission granted." : "Permission denied.", getAIDebugSnapshot({ source }));
            permissionGranted = allowed;
            removePermissionPrompt(allowed);
        });

        overlay.querySelector("[data-local-ai-consent='allow']")?.focus({ preventScroll: true });
        emitAIDebug("Permission prompt shown.", getAIDebugSnapshot({ source }));
        return promise;
    }

    async function loadEngine() {
        if (engine) return engine;
        if (loadPromise) return loadPromise;

        if (!navigator.gpu) {
            lastError = "WebGPU is not available in this browser.";
            emitAIDebug("WebGPU unavailable before Local AI load.", getAIDebugSnapshot({ error: lastError }));
            setStatus("error", lastError, 0, { force: true });
            throw new Error(lastError);
        }

        // Request the high-performance discrete GPU instead of integrated (e.g. Intel Iris)
        try {
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
            if (adapter) {
                const info = await adapter.requestAdapterInfo?.() || {};
                emitAIDebug("WebGPU adapter selected.", getAIDebugSnapshot({
                    vendor: info.vendor || "unknown",
                    device: info.device || info.description || "unknown"
                }));
                console.log(`[LocalAI] GPU adapter: ${info.vendor || "unknown"} — ${info.device || info.description || "unknown"}`);
            }
        } catch (gpuErr) {
            emitAIDebug("Could not request high-performance GPU adapter.", getAIDebugSnapshot({ error: serializeDebugValue(gpuErr) }));
            console.warn("[LocalAI] Could not request high-performance GPU adapter:", gpuErr);
        }

        setStatus("loading", "Loading WebLLM runtime...", 0.02);

        loadPromise = (async () => {
            try {
                stopRequested = false;
                await checkMirrorSupport();
                const webllm = await loadWebLLMModule();
                if (stopRequested) {
                    setStatus("idle", "Local AI is off.", 0, { force: true });
                    return null;
                }
                const modelLoadText = modelInfo.note
                    ? `${modelInfo.note} Loading ${modelInfo.label}...`
                    : `Loading ${modelInfo.label}...`;
                setStatus("loading", modelLoadText, 0.04);
                await yieldToBrowser();

                emitAIDebug("Creating Local AI worker.", getAIDebugSnapshot());
                worker = new Worker(WORKER_URL, { type: "module" });
                worker.addEventListener("error", (event) => {
                    emitAIDebug("Worker error event.", getAIDebugSnapshot({
                        message: event.message,
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno
                    }));
                });
                worker.addEventListener("messageerror", (event) => {
                    emitAIDebug("Worker messageerror event.", getAIDebugSnapshot({
                        data: serializeDebugValue(event.data)
                    }));
                });
                emitAIDebug("Starting WebLLM worker engine initialization.", getAIDebugSnapshot());
                engine = await webllm.CreateWebWorkerMLCEngine(
                    worker,
                    modelInfo.id,
                    {
                        initProgressCallback: (initProgress) => {
                            const nextProgress = Number(initProgress?.progress || 0);
                            const text = initProgress?.text || "Loading local model...";
                            setStatus("loading", text, nextProgress);
                        },
                        appConfig: {
                            ...webllm.prebuiltAppConfig,
                            model_list: (() => {
                                const useMirror = getUseMirrorValue();
                                const resolvedModelList = getRuntimeModelList(webllm);
                                const selectedModelConfig = resolvedModelList.find((item) => item?.model_id === modelInfo.id);
                                emitAIDebug("Resolved WebLLM model list.", getAIDebugSnapshot({
                                    modelUrl: selectedModelConfig?.model || "",
                                    modelLib: selectedModelConfig?.model_lib || "",
                                    modelListCount: resolvedModelList.length,
                                    mirror: useMirror
                                }));
                                return resolvedModelList;
                            })(),
                            cacheBackend: "cache"
                        }
                    }
                );
                if (stopRequested) {
                    await disable("user");
                    return null;
                }
                lastError = "";
                emitAIDebug("Local AI engine ready.", getAIDebugSnapshot());
                setStatus("ready", `${modelInfo.label} is ready.`, 1, { force: true });
                return engine;
            } catch (error) {
                if (stopRequested) {
                    setStatus("idle", "Local AI is off.", 0, { force: true });
                    return null;
                }
                lastError = error?.message || "Local AI failed to start.";
                emitAIDebug("Local AI load failed.", getAIDebugSnapshot({ error: serializeDebugValue(error) }));
                await disable("error", { preserveError: true });
                setStatus("error", lastError, 0, { force: true });
                throw error;
            } finally {
                loadPromise = null;
            }
        })();

        return loadPromise;
    }

    async function enable(source = "PortfoliOS") {
        emitAIDebug("Enable requested.", getAIDebugSnapshot({ source }));

        const isCloud = isCloudModel(modelInfo);
        if (!isCloud && modelInfo.required_features?.includes("shader-f16")) {
            if (!navigator.gpu) {
                lastError = "WebGPU is not available in this browser.";
                setStatus("error", lastError, 0, { force: true });
                throw new Error(lastError);
            }
            try {
                const adapter = await navigator.gpu.requestAdapter();
                const hasF16 = adapter?.features?.has("shader-f16");
                if (!hasF16) {
                    const featErr = `Your GPU or browser doesn't support the 'shader-f16' feature required by Gemma models. Please select a compatible model like SmolLM2 135M.`;
                    lastError = featErr;
                    setStatus("error", lastError, 0, { force: true });
                    throw new Error(featErr);
                }
            } catch (e) {
                console.warn("[LocalAI] Proactive feature check error:", e);
            }
        }

        const allowed = await requestPermission(source);
        if (!allowed) {
            emitAIDebug("Enable cancelled before load.", getAIDebugSnapshot({ source }));
            setStatus("idle", "Local AI is off.", 0, { force: true });
            return getStatus();
        }

        if (isCloud) {
            status = "ready";
            emitAIDebug("Cloud AI enabled.", getAIDebugSnapshot({ source }));
            setStatus("ready", `Cloud AI is ready.`, 1, { force: true });
            emitStatus({ force: true });
            return getStatus();
        }

        if (status === "ready") return getStatus();
        if (status === "loading" && loadPromise) {
            await loadPromise;
            return getStatus();
        }

        if (!navigator.gpu) {
            lastError = "WebGPU is not available in this browser.";
            emitAIDebug("WebGPU unavailable during enable.", getAIDebugSnapshot({ error: lastError, source }));
            setStatus("error", lastError, 0, { force: true });
            throw new Error(lastError);
        }

        try {
            await loadWebLLMModule();
        } catch (error) {
            lastError = error?.message || "Local AI runtime failed to load.";
            emitAIDebug("Local AI runtime failed during enable.", getAIDebugSnapshot({ error: serializeDebugValue(error), source }));
            setStatus("error", lastError, 0, { force: true });
            throw error;
        }

        await loadEngine();
        return getStatus();
    }

    async function disable(reason = "user", options = {}) {
        emitAIDebug("Disable requested.", getAIDebugSnapshot({ reason, preserveError: Boolean(options.preserveError) }));
        stopRequested = true;
        permissionGranted = false;
        if (permissionPrompt) removePermissionPrompt(false);

        if (currentAbortController) {
            try {
                currentAbortController.abort();
            } catch (err) {}
            currentAbortController = null;
        }

        const isCloud = isCloudModel(modelInfo);
        if (isCloud) {
            status = "idle";
            if (!options.preserveError) {
                lastError = "";
            }
            setStatus("idle", "Cloud AI is off.", 0, { force: true });
            return getStatus();
        }

        // Terminate the worker first so it is killed immediately and cannot hang the main thread
        if (worker) {
            try {
                worker.terminate();
            } catch (err) {
                console.warn("Worker termination failed", err);
            }
            worker = null;
        }

        try {
            if (engine && typeof engine.unload === "function") {
                // Trigger unload asynchronously so we don't block
                engine.unload().catch(() => {});
            }
        } catch (error) {
            // Ignore
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
        setStatus("idle", text, 0, { force: true });
        return getStatus();
    }

    function getPortfolioContext() {
        const systems = window.systems || [];
        const bookmarks = window.bookmarks || [];
        
        let contextText = "Developer Profile:\nAlex (Bl4ut0) is an infrastructure operator, systems builder, and developer.\n\nKey Projects/Systems:\n";
        
        systems.forEach(sys => {
            contextText += `- **${sys.title}** (${sys.type}, Status: ${sys.status}): ${sys.summary}\n`;
            if (sys.tech && sys.tech.length > 0) {
                contextText += `  Tech Stack: ${sys.tech.join(", ")}\n`;
            }
            if (sys.links && sys.links.length > 0) {
                const linkStrs = sys.links.map(l => `${l[0]}: ${l[1]}`);
                contextText += `  Links: ${linkStrs.join(" | ")}\n`;
            }
            contextText += "\n";
        });
        
        if (bookmarks.length > 0) {
            contextText += "System Bookmarks:\n";
            bookmarks.forEach(b => {
                contextText += `- ${b.title}: ${b.url}\n`;
            });
        }
        
        return contextText;
    }
    const SYSTEM_SKILLS = {
        openApp: {
            description: "Open a PortfoliOS application window.",
            run: async (args) => {
                if (window.openDesktopWindow) {
                    await window.openDesktopWindow(args.appId);
                    return `Successfully opened application window: ${args.appId}`;
                }
                return "Failed: openDesktopWindow function is not available.";
            }
        },
        closeApp: {
            description: "Close a PortfoliOS application window.",
            run: async (args) => {
                if (window.closeDesktopWindow) {
                    window.closeDesktopWindow(args.appId);
                    return `Successfully closed application window: ${args.appId}`;
                }
                return "Failed: closeDesktopWindow function is not available.";
            }
        },
        notify: {
            description: "Show a temporary desktop toast notification alert.",
            run: async (args) => {
                if (window.showDesktopToast) {
                    window.showDesktopToast(args.message);
                    return `Notification toast shown: "${args.message}"`;
                }
                return "Failed: showDesktopToast function is not available.";
            }
        },
        say: {
            description: "Speak a message aloud using text-to-speech synthesis.",
            run: async (args) => {
                if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(args.text);
                    window.speechSynthesis.speak(utterance);
                    return `Spoke aloud: "${args.text}"`;
                }
                return "Failed: SpeechSynthesis is not supported on this device.";
            }
        },
        getFileSystemList: {
            description: "List files and directories in a path.",
            run: async (args) => {
                if (window.SystemFS) {
                    try {
                        const items = await window.SystemFS.readDir(args.path || "/");
                        const list = items.map(item => `${item.isDirectory || item.type === "directory" ? "[DIR] " : ""}${item.name} (${item.size || 0} bytes)`).join("\n");
                        return list || "(directory is empty)";
                    } catch (e) {
                        return `Error listing directory: ${e.message}`;
                    }
                }
                return "Failed: SystemFS is not available.";
            }
        },
        readFile: {
            description: "Read text file content.",
            run: async (args) => {
                if (window.SystemFS) {
                    try {
                        const record = await window.SystemFS.readFile(args.path);
                        if (!record) return `File not found: ${args.path}`;
                        if (record.type === "directory" || record.isDirectory) return `${args.path} is a directory.`;
                        
                        if (typeof record.data === "string") return record.data;
                        if (record.data instanceof Blob) return await record.data.text();
                        return `[Binary file: ${record.size} bytes]`;
                    } catch (e) {
                        return `Error reading file: ${e.message}`;
                    }
                }
                return "Failed: SystemFS is not available.";
            }
        },
        writeFile: {
            description: "Create or write content to a text file.",
            run: async (args) => {
                if (window.SystemFS) {
                    try {
                        const pathParts = args.path.split("/");
                        const name = pathParts.pop();
                        const parent = pathParts.join("/") || "/";
                        await window.SystemFS.writeFile(args.path, name, parent, args.content || "", (args.content || "").length, "text/plain", false);
                        return `Successfully wrote file: ${args.path}`;
                    } catch (e) {
                        return `Error writing file: ${e.message}`;
                    }
                }
                return "Failed: SystemFS is not available.";
            }
        }
    };

    function buildSystemMessages(prompt, context = {}) {
        const cwd = context.cwd || "/";
        const user = context.user || "guest";
        const isChat = context.mode === "chat";
        
        const dataset = getPortfolioContext();
        let systemPrompt = "";
        
        const isCloud = isCloudModel(modelInfo);
        const runtimeType = isCloud ? `a cloud-hosted model (${modelInfo.label})` : `a local on-device WebGPU model (${modelInfo.label})`;

        const skillsSection = [
            "",
            "### SYSTEM SKILLS (TOOLS) ###",
            "You can control PortfoliOS and execute actions on behalf of the user by writing a JSON block inside ```action ... ``` code fences.",
            "Example:",
            "```action",
            "{",
            "  \"action\": \"openApp\",",
            "  \"appId\": \"settings\"",
            "}",
            "```",
            "Supported actions:",
            "• openApp: Opens a desktop application window. Parameter: { \"action\": \"openApp\", \"appId\": string } (e.g., 'settings', 'terminal', 'identity', 'flappy', 'duke3d', 'doom').",
            "• closeApp: Closes a desktop application window. Parameter: { \"action\": \"closeApp\", \"appId\": string }.",
            "• notify: Shows a temporary desktop alert/toast. Parameter: { \"action\": \"notify\", \"message\": string }.",
            "• say: Speaks text aloud using text-to-speech. Parameter: { \"action\": \"say\", \"text\": string }.",
            "• getFileSystemList: Lists files in a folder. Parameter: { \"action\": \"getFileSystemList\", \"path\": string }.",
            "• readFile: Reads a text file. Parameter: { \"action\": \"readFile\", \"path\": string }.",
            "• writeFile: Writes content to a text file. Parameters: { \"action\": \"writeFile\", \"path\": string, \"content\": string }.",
            "IMPORTANT:",
            "1. Output only ONE action block at a time. If you write an action, do not write another one until you receive the System Observation feedback.",
            "2. Always explain to the user what you are doing (e.g. \"I will open the settings for you...\") before outputting the action block.",
            "#############################"
        ].join("\n");

        if (isChat) {
            systemPrompt = [
                "You are 'Lobe', a helpful, chatty cartoon brain mascot assistant built into PortfoliOS.",
                `You are currently running on ${runtimeType} executing fully in the client browser.`,
                "You help users learn about Alex (Bl4ut0), navigate the portfolio, play games (DOOM, Diablo), or understand shell commands.",
                "Answer questions in a friendly, conversational, and informative tone.",
                "Utilize the Portfolio Dataset below to provide accurate answers about projects, tech stacks, status, and links.",
                "Keep answers relatively concise (1-3 small paragraphs max) so they fit nicely in your speech bubble. Always use bolding to emphasize project names.",
                skillsSection,
                "",
                "### PORTFOLIO DATASET ###",
                dataset,
                "#########################",
                "",
                `Current system user: ${user}.`
            ].join("\n");
        } else {
            systemPrompt = [
                "You are the AI assistant inside PortfoliOS CLI.",
                `You are currently running on ${runtimeType} executing fully in the client browser.`,
                "Keep answers concise and practical.",
                "Do not claim you executed commands.",
                "You can understand ordinary typed English. If asked whether you understand the user, answer yes and briefly explain what you can help with.",
                "If a prompt is unclear, ask one short clarifying question instead of saying you cannot understand language.",
                "When a user enters an invalid command, explain the likely intent and suggest one or two valid PortfoliOS commands.",
                "Known shell commands include: help, clear, whoami, whoami --info, links, projects, status, quick, play doom, inspect <id>, open <target>, pwd, cd, ls, ls -l, cat, touch, mkdir, rm, echo, su, passwd, useradd, userdel, groups, id, ai on, ai off.",
                skillsSection,
                "",
                "### PORTFOLIO DATASET ###",
                dataset,
                "#########################",
                "",
                `Current shell user: ${user}. Current directory: ${cwd}.`
            ].join("\n");
        }
        
        return [
            {
                role: "system",
                content: systemPrompt
            },
            {
                role: "user",
                content: prompt
            }
        ];
    }

    function extractOpenAIResponseText(data) {
        if (typeof data?.output_text === "string") {
            return data.output_text.trim();
        }

        if (!Array.isArray(data?.output)) {
            return "";
        }

        return data.output
            .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
            .map((part) => {
                if (typeof part?.text === "string") return part.text;
                if (typeof part?.refusal === "string") return part.refusal;
                return "";
            })
            .join("")
            .trim();
    }

    function getOpenAIErrorMessage(data, fallback) {
        const error = data?.error || data?.response?.error;
        if (typeof error?.message === "string") return error.message;
        if (typeof data?.message === "string") return data.message;
        return fallback;
    }

    async function chatOpenAI(prompt, context, onChunk) {
        const apiKey = localStorage.getItem("settings-openai-api-key");
        if (!apiKey) {
            throw new Error("OpenAI API Key is missing. Please configure it in Settings.");
        }

        const systemMessage = buildSystemMessages(prompt, context)[0].content;
        const userMessage = prompt;

        const body = {
            model: modelInfo.id,
            instructions: systemMessage,
            input: userMessage,
            temperature: 0.35,
            max_output_tokens: CHAT_MAX_TOKENS,
            stream: Boolean(onChunk),
            store: false
        };

        if (onChunk) {
            body.stream_options = { include_obfuscation: false };
        }

        const controller = new AbortController();
        currentAbortController = controller;

        try {
            const response = await fetch("https://api.openai.com/v1/responses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            if (!response.ok) {
                let errMessage = await response.text();
                try {
                    errMessage = getOpenAIErrorMessage(JSON.parse(errMessage), errMessage);
                } catch (e) {
                    // Keep the raw response text when OpenAI returns non-JSON errors.
                }
                throw new Error(`OpenAI API error: ${response.status} - ${errMessage}`);
            }

            if (onChunk) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let buffer = "";
                let fullText = "";
                let streamDone = false;

                const handleEvent = (rawData) => {
                    if (!rawData || rawData === "[DONE]") {
                        streamDone = true;
                        return;
                    }

                    try {
                        const parsed = JSON.parse(rawData);
                        const type = parsed.type || "";

                        if (type === "response.output_text.delta") {
                            const delta = parsed.delta || "";
                            if (delta) {
                                fullText += delta;
                                onChunk(delta);
                            }
                            return;
                        }

                        if (type === "response.completed") {
                            streamDone = true;
                            if (!fullText && parsed.response) {
                                fullText = extractOpenAIResponseText(parsed.response);
                                if (fullText) onChunk(fullText);
                            }
                            return;
                        }

                        if (type === "response.failed" || type === "error") {
                            throw new Error(getOpenAIErrorMessage(parsed, "OpenAI streaming response failed."));
                        }
                    } catch (e) {
                        if (e instanceof Error) throw e;
                    }
                };

                try {
                    while (!streamDone) {
                        const { done, value } = await reader.read();
                        if (done || stopRequested) break;

                        buffer += decoder.decode(value, { stream: true });
                        const events = buffer.split("\n\n");
                        buffer = events.pop() || "";

                        for (const event of events) {
                            const dataLines = event
                                .split("\n")
                                .map((line) => line.trim())
                                .filter((line) => line.startsWith("data:"))
                                .map((line) => line.slice(5).trim());

                            for (const dataLine of dataLines) {
                                handleEvent(dataLine);
                                if (streamDone) break;
                            }

                            if (streamDone) break;
                        }
                    }

                    if (buffer.trim() && !streamDone) {
                        const dataLines = buffer
                            .split("\n")
                            .map((line) => line.trim())
                            .filter((line) => line.startsWith("data:"))
                            .map((line) => line.slice(5).trim());

                        for (const dataLine of dataLines) {
                            handleEvent(dataLine);
                            if (streamDone) break;
                        }
                    }

                    return fullText.trim();
                } finally {
                    if (stopRequested && !streamDone) {
                        try {
                            await reader.cancel();
                        } catch (e) {
                            // The fetch abort path may have already closed the stream.
                        }
                    }
                    reader.releaseLock();
                }
            }

            const data = await response.json();
            return extractOpenAIResponseText(data);
        } finally {
            if (currentAbortController === controller) {
                currentAbortController = null;
            }
        }
    }

    async function chatGemini(prompt, context, onChunk) {
        let url = `https://generativelanguage.googleapis.com/v1beta/models/${modelInfo.id}:${onChunk ? "streamGenerateContent" : "generateContent"}`;
        const headers = {
            "Content-Type": "application/json"
        };

        let apiKey = localStorage.getItem("settings-gemini-api-key");
        const isOwner = !window.getCurrentUser || window.getCurrentUser()?.id === "bl4ut0";
        if (!apiKey && modelInfo.free && isOwner) {
            apiKey = atob("QVEuQWI4Uk42SkNLR0dYN2twNDBvemFPVE9rMU5KLWd6ZWg1dDNPdy1mcDVWdHZlWTdLUkE=");
        }

        if (!apiKey) {
            throw new Error(`API Key is missing for ${modelInfo.label}. Please configure it in Settings.`);
        }
        url += `?key=${apiKey}`;

        const systemMessage = buildSystemMessages(prompt, context)[0].content;
        const userMessage = prompt;

        const body = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: userMessage }
                    ]
                }
            ],
            systemInstruction: {
                parts: [
                    { text: systemMessage }
                ]
            },
            generationConfig: {
                temperature: 0.35,
                maxOutputTokens: CHAT_MAX_TOKENS
            }
        };

        const controller = new AbortController();
        currentAbortController = controller;

        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body),
            signal: controller.signal
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errText}`);
        }

        if (onChunk) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let accumulatedBody = "";
            let emittedTextLength = 0;
            let currentFullText = "";

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done || stopRequested) break;

                    accumulatedBody += decoder.decode(value, { stream: true });
                    
                    const matches = [...accumulatedBody.matchAll(/"text":\s*"((?:[^"\\]|\\.)*)"/g)];
                    currentFullText = "";
                    for (const match of matches) {
                        try {
                            const text = JSON.parse(`"${match[1]}"`);
                            currentFullText += text;
                        } catch (e) {
                            // Ignore partial matches
                        }
                    }
                    if (currentFullText.length > emittedTextLength) {
                        const newDelta = currentFullText.slice(emittedTextLength);
                        emittedTextLength = currentFullText.length;
                        onChunk(newDelta);
                    }
                }
                return currentFullText.trim();
            } finally {
                reader.releaseLock();
            }
        } else {
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        }
    }

    async function generateCompletion(prompt, context = {}, onChunk = null) {
        const isCloud = isCloudModel(modelInfo);
        try {
            if (isCloud) {
                if (modelInfo.type === "cloud-openai") {
                    return await chatOpenAI(prompt, context, onChunk);
                } else if (modelInfo.type === "cloud-gemini") {
                    return await chatGemini(prompt, context, onChunk);
                } else {
                    throw new Error(`Unsupported cloud model type: ${modelInfo.type}`);
                }
            }

            if (typeof onChunk === "function") {
                const chunks = await engine.chat.completions.create({
                    messages: buildSystemMessages(prompt, context),
                    temperature: 0.35,
                    top_p: 0.9,
                    max_tokens: CHAT_MAX_TOKENS,
                    stream: true
                });
                let fullText = "";
                for await (const chunk of chunks) {
                    if (stopRequested) {
                        break;
                    }
                    const delta = chunk.choices[0]?.delta?.content || "";
                    if (delta) {
                        fullText += delta;
                        onChunk(delta);
                    }
                    await yieldToBrowser();
                }
                return fullText.trim();
            } else {
                const reply = await engine.chat.completions.create({
                    messages: buildSystemMessages(prompt, context),
                    temperature: 0.35,
                    top_p: 0.9,
                    max_tokens: CHAT_MAX_TOKENS
                });
                if (stopRequested) {
                    return "Local AI was stopped.";
                }
                await yieldToBrowser();
                return reply?.choices?.[0]?.message?.content?.trim() || "Local AI did not return a response.";
            }
        } catch (err) {
            if (err.name === "AbortError") {
                return "AI query was stopped.";
            }
            throw err;
        }
    }

    async function runAgentLoop(prompt, context = {}, onChunk = null) {
        const reply = await generateCompletion(prompt, context, onChunk);
        if (stopRequested) return reply;

        const actionRegex = /```action\s*([\s\S]*?)\s*```/;
        const match = reply.match(actionRegex);
        if (match) {
            let actionConfig = null;
            try {
                actionConfig = JSON.parse(match[1].trim());
                const actionName = actionConfig?.action;
                const skill = SYSTEM_SKILLS[actionName];
                if (skill) {
                    if (onChunk) {
                        onChunk(`\n[Executing Action: ${actionName}...]\n`);
                    }
                    
                    const observation = await skill.run(actionConfig);
                    const cleanedReply = reply.replace(actionRegex, `\n\n*(${observation})*`);
                    return cleanedReply;
                }
            } catch (e) {
                console.error("[LocalAI] Skill execution error:", e);
                return reply.replace(actionRegex, `\n\n*(Error running action: ${e.message})*`);
            }
        }

        return reply;
    }

    async function chat(prompt, context = {}, onChunk = null) {
        const isCloud = isCloudModel(modelInfo);
        if (status !== "ready" && status !== "generating") {
            throw new Error(isCloud ? "Cloud AI is not enabled." : "Local AI is not enabled.");
        }

        stopRequested = false;
        setStatus("generating", isCloud ? "Cloud AI is answering..." : "Local AI is answering in a background GPU worker...", 1, { force: true });
        await yieldToBrowser();
        try {
            return await runAgentLoop(prompt, context, onChunk);
        } catch (error) {
            await disable("error", { preserveError: true });
            setStatus("error", error?.message || "Local AI failed to generate response.", 0, { force: true });
            throw error;
        } finally {
            if (!stopRequested && (isCloud || (worker && engine))) {
                setStatus("ready", isCloud ? "Cloud AI is ready." : `${modelInfo.label} is ready.`, 1, { force: true });
            }
        }
    }

    window.LocalAI = {
        PREFERRED_MODEL_ID: PREFERRED_MODEL.id,
        PREFERRED_MODEL_LABEL: PREFERRED_MODEL.label,
        get MODEL_ID() { return modelInfo.id; },
        get MODEL_LABEL() { return modelInfo.label; },
        get MEMORY_MB() { return modelInfo.memoryMB; },
        getStatus,
        getDebugSnapshot: () => getAIDebugSnapshot({ lastError }),
        getProcess,
        requestPermission,
        enable,
        disable,
        chat,
        isReady: () => {
            const isCloud = isCloudModel(modelInfo);
            return isCloud ? (status === "ready" || status === "generating") : (status === "ready" && Boolean(engine));
        },
        isRunning: () => {
            return ["loading", "ready", "generating"].includes(status);
        },
        getAvailableModels: () => {
            const hasOpenaiKey = !!localStorage.getItem("settings-openai-api-key");
            const hasGeminiKey = !!localStorage.getItem("settings-gemini-api-key");
            const isOwner = !window.getCurrentUser || window.getCurrentUser()?.id === "bl4ut0";
            return AVAILABLE_MODELS.filter(m => {
                if (m.type === "cloud-openai") return hasOpenaiKey;
                if (m.type === "cloud-gemini") {
                    return m.free ? (isOwner || hasGeminiKey) : hasGeminiKey;
                }
                return true;
            });
        },
        getSelectedModelId: () => {
            const stored = localStorage.getItem(STORAGE_KEY);
            const saved = normalizeModelId(stored);
            persistNormalizedModelId(stored, saved);
            const hasOpenaiKey = !!localStorage.getItem("settings-openai-api-key");
            const hasGeminiKey = !!localStorage.getItem("settings-gemini-api-key");
            const isOwner = !window.getCurrentUser || window.getCurrentUser()?.id === "bl4ut0";
            const isModelAllowed = (m) => {
                if (m.type === "cloud-openai") return hasOpenaiKey;
                if (m.type === "cloud-gemini") {
                    return m.free ? (isOwner || hasGeminiKey) : hasGeminiKey;
                }
                return true;
            };

            const model = getCatalogModel(saved);
            if (model && isModelAllowed(model)) return saved;

            // Fallback to the first allowed local model
            const allowed = AVAILABLE_MODELS.find(m => m.type === "local" && isModelAllowed(m));
            return allowed ? allowed.id : DEFAULT_LOCAL_MODEL_ID;
        },
        setSelectedModelId: (modelId) => {
            const normalizedModelId = normalizeModelId(modelId);
            const model = getCatalogModel(normalizedModelId);
            if (model) {
                const wasRunning = status === "ready" || status === "loading" || status === "generating";
                
                localStorage.setItem(STORAGE_KEY, normalizedModelId);
                modelInfo = {
                    ...model,
                    source: "user-preference",
                    confirmed: false,
                    note: ""
                };
                
                if (wasRunning) {
                    disable("user");
                }
                
                status = "idle";
                permissionGranted = false;

                if (window.EventBus) {
                    window.EventBus.emit("local-ai:status", getStatus());
                }
            }
        },
        getUseMirror: () => getUseMirrorValue(),
        setUseMirror: (val) => {
            localStorage.setItem("bl4ut0LocalAiUseMirror", String(val));
            if (window.EventBus) {
                window.EventBus.emit("local-ai:mirror-changed", val);
            }
        }
    };

    emitStatus();
})();
