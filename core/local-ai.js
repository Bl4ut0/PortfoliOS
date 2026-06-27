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
            id: "gemma-3-270m-it-q4f16_1-MLC",
            label: "Gemma 3 270M (Hyper-light, 200MB)",
            memoryMB: 200,
            type: "local"
        },
        {
            id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
            label: "SmolLM2 360M (Ultra-light, 376MB)",
            memoryMB: 376,
            type: "local"
        },
        {
            id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
            label: "Qwen 2.5 0.5B (Light, 420MB)",
            memoryMB: 420,
            type: "local"
        },
        {
            id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
            label: "Llama 3.2 1B (Balanced, 980MB)",
            memoryMB: 980,
            type: "local"
        },
        {
            id: "gemma-3-1b-it-q4f16_1-MLC",
            label: "Gemma 3 1B (Google, 600MB)",
            memoryMB: 600,
            type: "local"
        },
        {
            id: "gemma-2-2b-it-q4f16_1-MLC",
            label: "Gemma 2 2B (High Quality, 1.6GB)",
            memoryMB: 1600,
            type: "local"
        }
    ];

    const PREFERRED_MODEL = AVAILABLE_MODELS[0];
    const FALLBACK_MODEL_IDS = AVAILABLE_MODELS.map(m => m.id);
    const WORKER_URL = "core/local-ai-worker.js?v=1.0.39";
    const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm";
    const STATUS_EMIT_MIN_MS = 220;
    const CHAT_MAX_TOKENS = 120;

    let engine = null;
    let worker = null;
    let currentAbortController = null;
    let webllmModule = null;
    let runtimeImportPromise = null;
    let loadPromise = null;
    // Initialize modelInfo from localStorage preference if available, matching the user's choice
    const savedIdOnLoad = localStorage.getItem(STORAGE_KEY);
    const initialModel = (savedIdOnLoad && AVAILABLE_MODELS.find(m => m.id === savedIdOnLoad)) || PREFERRED_MODEL;
    let modelInfo = {
        ...initialModel,
        source: savedIdOnLoad ? "user-preference" : "preferred",
        confirmed: false,
        note: savedIdOnLoad ? "" : "Preferred low-memory model. Availability is confirmed when WebLLM loads."
    };

    let permissionGranted = false;
    let permissionPrompt = null;
    let status = "idle";
    let progress = 0;
    let statusText = (modelInfo.type && modelInfo.type.startsWith("cloud-")) ? "Cloud AI is off." : "Local AI is off.";
    let lastError = "";
    let stopRequested = false;
    let lastStatusEmitAt = 0;
    let statusEmitTimer = null;
    let statusEmitFrame = null;

    const escapeHtml = window.escapeHtml || ((value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;"));

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
        status = nextStatus;
        statusText = nextText;
        progress = Math.max(0, Math.min(1, Number(nextProgress) || 0));
        emitStatus(options);
    }

    function yieldToBrowser() {
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
        });
    }

    function getStatus() {
        const isCloud = modelInfo.type && modelInfo.type.startsWith("cloud-");
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
        const isCloud = modelInfo.type && modelInfo.type.startsWith("cloud-");
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
        const raw = Number(record?.vram_required_MB || record?.memoryMB || fallback);
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
        return {
            id: record.model_id,
            label: humanizeModelId(record.model_id),
            memoryMB: getModelMemoryMB(record),
            source,
            confirmed: true,
            note
        };
    }

    function selectModel(webllm) {
        const modelList = Array.isArray(webllm?.prebuiltAppConfig?.model_list)
            ? webllm.prebuiltAppConfig.model_list
            : [];

        const savedId = localStorage.getItem(STORAGE_KEY) || PREFERRED_MODEL.id;
        
        // If the user's selected model is in our custom AVAILABLE_MODELS list, respect it!
        const customModel = AVAILABLE_MODELS.find(m => m.id === savedId);
        if (customModel) {
            const savedRecord = modelList.find((item) => item?.model_id === savedId);
            return {
                ...customModel,
                source: savedRecord ? "user-preference" : "custom-choice",
                confirmed: true,
                note: savedRecord ? "" : "Selected model is hosted on MLC/HuggingFace."
            };
        }

        const savedRecord = modelList.find((item) => item?.model_id === savedId);
        if (savedRecord && isTextGenerationModel(savedRecord, webllm)) {
            return modelFromRecord(savedRecord, "user-preference");
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

        runtimeImportPromise = import(WEBLLM_URL)
            .then((webllm) => {
                webllmModule = webllm;
                modelInfo = selectModel(webllm);
                emitStatus({ force: true });
                return webllm;
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
                    <h2 id="local-ai-consent-title">Run ${escapeHtml(modelInfo.label)}?</h2>
                    <p>${escapeHtml(source)} wants to start the Local AI assistant. It runs in your browser using WebGPU, downloads model assets on first use, and reserves about <strong>${modelInfo.memoryMB} MB</strong> of GPU/browser memory while active.</p>
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
            setStatus("error", lastError, 0, { force: true });
            throw new Error(lastError);
        }

        // Request the high-performance discrete GPU instead of integrated (e.g. Intel Iris)
        try {
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
            if (adapter) {
                const info = await adapter.requestAdapterInfo?.() || {};
                console.log(`[LocalAI] GPU adapter: ${info.vendor || "unknown"} — ${info.device || info.description || "unknown"}`);
            }
        } catch (gpuErr) {
            console.warn("[LocalAI] Could not request high-performance GPU adapter:", gpuErr);
        }

        setStatus("loading", "Loading WebLLM runtime...", 0.02);

        loadPromise = (async () => {
            try {
                stopRequested = false;
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

                worker = new Worker(WORKER_URL, { type: "module" });
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
                            model_list: [
                                ...(webllm.prebuiltAppConfig.model_list || []),
                                {
                                    model: "https://huggingface.co/mlc-ai/gemma-3-1b-it-q4f16_1-MLC",
                                    model_id: "gemma-3-1b-it-q4f16_1-MLC",
                                    model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/gemma-3-1b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm",
                                    vram_requirement_MB: 600,
                                    required_features: ["shader-f16"]
                                },
                                {
                                    model: "https://huggingface.co/llinguini/gemma-3-270m-it-q4f16_1-MLC",
                                    model_id: "gemma-3-270m-it-q4f16_1-MLC",
                                    model_lib: "https://huggingface.co/llinguini/gemma-3-270m-it-q4f16_1-MLC/resolve/main/libs/gemma-3-270m-it-webgpu.wasm",
                                    vram_requirement_MB: 200,
                                    required_features: ["shader-f16"]
                                }
                            ],
                            cacheBackend: "cache"
                        }
                    }
                );
                if (stopRequested) {
                    await disable("user");
                    return null;
                }
                lastError = "";
                setStatus("ready", `${modelInfo.label} is ready.`, 1, { force: true });
                return engine;
            } catch (error) {
                if (stopRequested) {
                    setStatus("idle", "Local AI is off.", 0, { force: true });
                    return null;
                }
                lastError = error?.message || "Local AI failed to start.";
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
        const isCloud = modelInfo.type && modelInfo.type.startsWith("cloud-");
        if (isCloud) {
            status = "ready";
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
            setStatus("error", lastError, 0, { force: true });
            throw new Error(lastError);
        }

        try {
            await loadWebLLMModule();
        } catch (error) {
            lastError = error?.message || "Local AI runtime failed to load.";
            setStatus("error", lastError, 0, { force: true });
            throw error;
        }

        const allowed = await requestPermission(source);
        if (!allowed) {
            setStatus("idle", "Local AI is off.", 0, { force: true });
            return getStatus();
        }

        await loadEngine();
        return getStatus();
    }

    async function disable(reason = "user", options = {}) {
        stopRequested = true;
        permissionGranted = false;
        if (permissionPrompt) removePermissionPrompt(false);

        if (currentAbortController) {
            try {
                currentAbortController.abort();
            } catch (err) {}
            currentAbortController = null;
        }

        const isCloud = modelInfo.type && modelInfo.type.startsWith("cloud-");
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

    function buildSystemMessages(prompt, context = {}) {
        const cwd = context.cwd || "/";
        const user = context.user || "guest";
        const isChat = context.mode === "chat";
        
        const dataset = getPortfolioContext();
        let systemPrompt = "";
        
        if (isChat) {
            systemPrompt = [
                "You are 'Lobe', a helpful, chatty cartoon brain mascot assistant built into PortfoliOS.",
                "You help users learn about Alex (Bl4ut0), navigate the portfolio, play games (DOOM, Diablo), or understand shell commands.",
                "Answer questions in a friendly, conversational, and informative tone.",
                "Utilize the Portfolio Dataset below to provide accurate answers about projects, tech stacks, status, and links.",
                "Keep answers relatively concise (1-3 small paragraphs max) so they fit nicely in your speech bubble. Always use bolding to emphasize project names.",
                "",
                "### PORTFOLIO DATASET ###",
                dataset,
                "#########################",
                "",
                `Current system user: ${user}.`
            ].join("\n");
        } else {
            systemPrompt = [
                "You are the Local AI assistant inside PortfoliOS CLI.",
                "Keep answers concise and practical.",
                "Do not claim you executed commands.",
                "You can understand ordinary typed English. If asked whether you understand the user, answer yes and briefly explain what you can help with.",
                "If a prompt is unclear, ask one short clarifying question instead of saying you cannot understand language.",
                "When a user enters an invalid command, explain the likely intent and suggest one or two valid PortfoliOS commands.",
                "Known shell commands include: help, clear, whoami, whoami --info, links, projects, status, quick, play doom, inspect <id>, open <target>, pwd, cd, ls, ls -l, cat, touch, mkdir, rm, echo, su, passwd, useradd, userdel, groups, id, ai on, ai off.",
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
        if (!apiKey && modelInfo.free) {
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

    async function chat(prompt, context = {}, onChunk = null) {
        const isCloud = modelInfo.type && modelInfo.type.startsWith("cloud-");
        if (status !== "ready" && status !== "generating") {
            throw new Error(isCloud ? "Cloud AI is not enabled." : "Local AI is not enabled.");
        }

        stopRequested = false;
        setStatus("generating", isCloud ? "Cloud AI is answering..." : "Local AI is answering in a background GPU worker...", 1, { force: true });
        await yieldToBrowser();
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
        getProcess,
        requestPermission,
        enable,
        disable,
        chat,
        isReady: () => {
            const isCloud = modelInfo.type && modelInfo.type.startsWith("cloud-");
            return isCloud ? (status === "ready" || status === "generating") : (status === "ready" && Boolean(engine));
        },
        isRunning: () => {
            return ["loading", "ready", "generating"].includes(status);
        },
        getAvailableModels: () => AVAILABLE_MODELS,
        getSelectedModelId: () => localStorage.getItem(STORAGE_KEY) || PREFERRED_MODEL.id,
        setSelectedModelId: (modelId) => {
            const model = AVAILABLE_MODELS.find(m => m.id === modelId);
            if (model) {
                const wasRunningLocal = !modelInfo.type?.startsWith("cloud-") && (status === "ready" || status === "loading" || status === "generating");
                
                localStorage.setItem(STORAGE_KEY, modelId);
                modelInfo = {
                    ...model,
                    source: "user-preference",
                    confirmed: true,
                    note: model.type && model.type.startsWith("cloud-") ? "Cloud-hosted model via API." : ""
                };
                
                if (model.type && model.type.startsWith("cloud-")) {
                    if (wasRunningLocal) {
                        disable("user");
                    }
                    status = "ready";
                } else {
                    if (wasRunningLocal) {
                        disable("user");
                    } else if (!engine) {
                        status = "idle";
                    }
                }

                if (window.EventBus) {
                    window.EventBus.emit("local-ai:status", getStatus());
                }
            }
        }
    };

    emitStatus();
})();
