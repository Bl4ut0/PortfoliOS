(function() {
    const APP_ID = "local-ai";

    function esc(value) {
        if (window.escapeHtml) return window.escapeHtml(value);
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderStatusClass(status) {
        if (status.ready) return "ready";
        if (status.busy) return "loading";
        if (status.status === "error") return "error";
        return "idle";
    }

    function renderBodyFromStatus(status) {
        const statusClass = renderStatusClass(status);
        const progressPct = Math.round((status.progress || 0) * 100);
        
        const isCloudModel = status.modelType && status.modelType.startsWith("cloud-");
        const canStart = !isCloudModel && status.webGpuSupported && !status.busy && !status.ready;

        const modelNote = status.modelNote
            ? `<p class="local-ai-note">${esc(status.modelNote)}</p>`
            : "";
        
        const models = window.LocalAI?.getAvailableModels?.() || [];
        const selectedModelId = window.LocalAI?.getSelectedModelId?.() || "";
        let selectHtml = "";
        
        if (models.length > 0) {
            const localModels = models.filter(m => !m.type || m.type === "local");
            const openaiModels = models.filter(m => m.type === "cloud-openai");
            const geminiModels = models.filter(m => m.type === "cloud-gemini");

            let currentOptionsHtml = "";
            
            if (localModels.length > 0) {
                currentOptionsHtml += `<optgroup label="Local Models (WebGPU)">`;
                currentOptionsHtml += localModels.map(m => 
                    `<option value="${m.id}" ${m.id === selectedModelId ? "selected" : ""}>${esc(m.label)}</option>`
                ).join("");
                currentOptionsHtml += `</optgroup>`;
            }
            if (openaiModels.length > 0) {
                currentOptionsHtml += `<optgroup label="Cloud Models (OpenAI)">`;
                currentOptionsHtml += openaiModels.map(m => 
                    `<option value="${m.id}" ${m.id === selectedModelId ? "selected" : ""}>${esc(m.label)}</option>`
                ).join("");
                currentOptionsHtml += `</optgroup>`;
            }
            if (geminiModels.length > 0) {
                currentOptionsHtml += `<optgroup label="Cloud Models (Google Gemini)">`;
                currentOptionsHtml += geminiModels.map(m => 
                    `<option value="${m.id}" ${m.id === selectedModelId ? "selected" : ""}>${esc(m.label)}</option>`
                ).join("");
                currentOptionsHtml += `</optgroup>`;
            }

            const selectDisabled = !isCloudModel && (status.busy || status.ready) ? "disabled" : "";

            selectHtml = `
                <div class="local-ai-model-selector">
                    <label for="local-ai-model-select" class="local-ai-select-label">
                        <i class="fa-solid fa-gear"></i> Choose AI Model:
                    </label>
                    <p class="local-ai-select-desc">
                        Select a model size matching your device's VRAM for local execution, or connect to a cloud model.
                    </p>
                    <select id="local-ai-model-select" class="local-ai-select" ${selectDisabled}>
                        ${currentOptionsHtml}
                    </select>
                </div>
            `;
        }
        return `
            <div class="local-ai-app" data-local-ai-app>
                ${selectHtml}

                <section class="local-ai-hero">
                    <div class="local-ai-orb ${statusClass}">
                        <i class="fa-solid fa-brain"></i>
                    </div>
                    <div>
                        <p class="eyebrow">Browser-local assistant</p>
                        <h2>Local AI</h2>
                        <p>Optional on-device guidance for the CLI and future PortfoliOS tools.</p>
                    </div>
                </section>

                <section class="local-ai-status-card ${statusClass}">
                    <div class="local-ai-status-row">
                        <span>Status</span>
                        <strong>${esc(status.statusText)}</strong>
                    </div>
                    <div class="local-ai-progress-track" aria-label="Local AI loading progress">
                        <span style="width: ${progressPct}%"></span>
                    </div>
                    <div class="local-ai-metrics">
                        <div>
                            <span>Model</span>
                            <strong>${esc(status.modelLabel)}</strong>
                        </div>
                        <div>
                            <span>Memory</span>
                            <strong>~${status.memoryMB} MB</strong>
                        </div>
                        <div>
                            <span>Runtime</span>
                            <strong>${status.webGpuSupported ? esc(status.isolationLabel || "Worker + WebGPU") : "Unavailable"}</strong>
                        </div>
                    </div>
                    ${modelNote}
                    ${status.lastError ? `<p class="local-ai-error">${esc(status.lastError)}</p>` : ""}
                </section>

                <section class="local-ai-guidance">
                    <h3>How It Works</h3>
                    <ul>
                        <li>It never starts automatically.</li>
                        <li>First use asks for permission and downloads model assets into browser cache.</li>
                        <li>Task Manager or the tray can end the worker at any time.</li>
                        <li>Model orchestration runs in a worker; GPU compute still shares the browser GPU.</li>
                        <li>After it is ended, PortfoliOS asks permission before starting it again.</li>
                    </ul>
                </section>

                <div class="local-ai-actions">
                    <button type="button" class="local-ai-primary" data-local-ai-enable ${canStart ? "" : "disabled"}>
                        <i class="fa-solid fa-bolt"></i>
                        ${status.webGpuSupported ? "Enable Local AI" : "WebGPU Unavailable"}
                    </button>
                    <button type="button" class="local-ai-secondary" data-local-ai-stop ${status.enabled ? "" : "disabled"}>
                        <i class="fa-solid fa-stop"></i>
                        Stop AI Task
                    </button>
                </div>
            </div>
        `;
    }

    function renderWindow(windowEl) {
        const body = windowEl.querySelector("[data-local-ai-app]");
        const status = window.LocalAI?.getStatus ? window.LocalAI.getStatus() : {
            status: "idle",
            statusText: "Local AI service is unavailable.",
            modelLabel: "Unknown",
            memoryMB: 0,
            progress: 0,
            webGpuSupported: false
        };

        if (body) {
            body.outerHTML = renderBodyFromStatus(status);
        }
        bindActions(windowEl);
    }

    function bindActions(windowEl) {
        const enableBtn = windowEl.querySelector("[data-local-ai-enable]");
        const stopBtn = windowEl.querySelector("[data-local-ai-stop]");
        const modelSelect = windowEl.querySelector("#local-ai-model-select");

        if (modelSelect && window.createCustomDropdown) {
            if (!modelSelect.dataset.customized) {
                window.createCustomDropdown(modelSelect);
            } else {
                modelSelect.updateCustomDropdown?.();
            }
        }

        modelSelect?.addEventListener("change", (event) => {
            if (window.LocalAI?.setSelectedModelId) {
                window.LocalAI.setSelectedModelId(event.target.value);
                renderWindow(windowEl);
            }
        });

        enableBtn?.addEventListener("click", async () => {
            if (!window.LocalAI) return;
            enableBtn.disabled = true;
            enableBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Starting...';
            try {
                await window.LocalAI.enable("Local AI app");
            } catch (error) {
                console.error("Local AI start failed.", error);
                window.showDesktopToast?.("Local AI failed to start.");
            } finally {
                renderWindow(windowEl);
            }
        }, { once: true });

        stopBtn?.addEventListener("click", async () => {
            if (!window.LocalAI) return;
            stopBtn.disabled = true;
            await window.LocalAI.disable("user");
            window.showDesktopToast?.("Local AI stopped.");
            renderWindow(windowEl);
        }, { once: true });
    }

    window.appRegistry[APP_ID] = {
        title: "Local AI",
        icon: "fa-solid fa-brain",
        windowClass: "local-ai-window",
        renderBody: () => renderBodyFromStatus(window.LocalAI?.getStatus ? window.LocalAI.getStatus() : {}),
        onOpen: (windowEl) => {
            bindActions(windowEl);
            if (windowEl.dataset.localAiBound) return;
            windowEl.dataset.localAiBound = "true";
            const unsubscribe = window.EventBus?.on("local-ai:status", () => renderWindow(windowEl));
            windowEl.dataset.localAiHasUnsubscribe = unsubscribe ? "true" : "";
            windowEl.localAiUnsubscribe = unsubscribe;
        },
        onClose: (windowEl) => {
            if (typeof windowEl.localAiUnsubscribe === "function") {
                windowEl.localAiUnsubscribe();
                windowEl.localAiUnsubscribe = null;
            }
        }
    };
})();
