(function() {
    const APP_ID = "local-ai";

    function esc(value) {
        return window.escapeHtml ? window.escapeHtml(value) : String(value ?? "");
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
        const canStart = status.webGpuSupported && !status.busy && !status.ready;
        return `
            <div class="local-ai-app" data-local-ai-app>
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
                            <strong>${status.webGpuSupported ? "WebGPU" : "Unavailable"}</strong>
                        </div>
                    </div>
                    ${status.lastError ? `<p class="local-ai-error">${esc(status.lastError)}</p>` : ""}
                </section>

                <section class="local-ai-guidance">
                    <h3>How It Works</h3>
                    <ul>
                        <li>It never starts automatically.</li>
                        <li>First use asks for permission and downloads model assets into browser cache.</li>
                        <li>Task Manager or the tray can end the worker at any time.</li>
                        <li>After it is ended, PortfoliOS asks permission before starting it again.</li>
                    </ul>
                </section>

                <div class="local-ai-actions">
                    <button type="button" class="local-ai-primary" data-local-ai-enable ${canStart ? "" : "disabled"}>
                        <i class="fa-solid fa-bolt"></i>
                        Enable Local AI
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
