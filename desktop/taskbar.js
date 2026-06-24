/**
 * PortfoliOS: Taskbar Component
 * Renders the active/minimized applications in the bottom taskbar and manages desktop window visibilities.
 */

window.renderTaskbar = () => {
    const taskbar = window.byId ? window.byId("taskbar-apps") : document.getElementById("taskbar-apps");
    if (!taskbar) return;
    
    const openApps = Array.from(state.openApps).map((id) => window.appById(id)).filter(Boolean);
    taskbar.innerHTML = openApps.length ? openApps.map((app) => `
        <button type="button" class="taskbar-app ${state.activeWindow === app.id && !state.minimizedApps.has(app.id) ? "active" : ""} ${state.minimizedApps.has(app.id) ? "is-minimized" : ""}"
            data-taskbar-app="${app.id}" title="${state.minimizedApps.has(app.id) ? "Restore" : "Focus"} ${app.title}">
            ${window.getAppIconHtml(app.icon, "taskbar-icon")}
            <span class="taskbar-app-title">${app.title}</span>
        </button>
    `).join("") : "";

    document.querySelectorAll(".desktop-window").forEach((windowEl) => {
        const name = windowEl.dataset.window;
        const shouldShow = state.openApps.has(name) && !state.minimizedApps.has(name);
        windowEl.classList.toggle("is-hidden", !shouldShow);
        windowEl.classList.toggle("active", shouldShow && state.activeWindow === name);
    });

    if (window.appRegistry && window.appRegistry.doomsource && typeof window.appRegistry.doomsource.isDoomActive === "function" && window.appRegistry.doomsource.isDoomActive()) {
        if (state.activeWindow === "doomsource" && state.openApps.has("doomsource") && !state.minimizedApps.has("doomsource")) {
            window.appRegistry.doomsource.resumeDoomGame();
        } else {
            window.appRegistry.doomsource.pauseDoomGame();
        }
    }

    window.renderLocalAITray?.();
};

window.closeLocalAITrayPanel = () => {
    const panel = window.byId ? window.byId("local-ai-tray-panel") : document.getElementById("local-ai-tray-panel");
    const toggle = window.byId ? window.byId("local-ai-tray-toggle") : document.getElementById("local-ai-tray-toggle");
    if (panel) panel.hidden = true;
    if (toggle) toggle.setAttribute("aria-expanded", "false");
};

window.toggleLocalAITrayPanel = () => {
    const panel = window.byId ? window.byId("local-ai-tray-panel") : document.getElementById("local-ai-tray-panel");
    const toggle = window.byId ? window.byId("local-ai-tray-toggle") : document.getElementById("local-ai-tray-toggle");
    if (!panel || !toggle || toggle.hidden) return;
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    toggle.setAttribute("aria-expanded", String(nextOpen));
    if (nextOpen) {
        const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
        const calPanel = window.byId ? window.byId("calendar-panel") : document.getElementById("calendar-panel");
        if (startMenu) startMenu.hidden = true;
        if (calPanel) calPanel.hidden = true;
        if (window.closeVolumePanel) window.closeVolumePanel();
    }
};

window.renderLocalAITray = () => {
    const status = window.LocalAI?.getStatus?.();
    const toggle = window.byId ? window.byId("local-ai-tray-toggle") : document.getElementById("local-ai-tray-toggle");
    const panel = window.byId ? window.byId("local-ai-tray-panel") : document.getElementById("local-ai-tray-panel");
    if (!toggle || !panel) return;
    if (!status) {
        toggle.hidden = false;
        toggle.title = "Local AI";
        return;
    }

    toggle.hidden = false;
    toggle.classList.toggle("is-loading", status.status === "loading");
    toggle.classList.toggle("is-generating", status.status === "generating");
    toggle.classList.toggle("is-error", status.status === "error");
    toggle.classList.toggle("is-idle", status.status === "idle");
    toggle.title = `Local AI: ${status.statusText}`;

    const label = panel.querySelector("#local-ai-tray-status");
    const detail = panel.querySelector("#local-ai-tray-detail");
    const enableButton = panel.querySelector("[data-local-ai-tray-enable]");
    const stopButton = panel.querySelector("[data-local-ai-tray-stop]");
    const modelSelect = panel.querySelector("#local-ai-tray-model-select");

    // Populate model select in tray
    if (modelSelect && window.LocalAI) {
        const models = window.LocalAI.getAvailableModels() || [];
        const selectedModelId = window.LocalAI.getSelectedModelId() || "";
        
        const freeCloudModels = models.filter(m => m.type && m.type.startsWith("cloud-") && m.free);
        const premiumCloudModels = models.filter(m => m.type && m.type.startsWith("cloud-") && !m.free);
        const localModels = models.filter(m => !m.type || m.type === "local");

        let currentOptionsHtml = "";
        
        if (freeCloudModels.length > 0) {
            currentOptionsHtml += `<optgroup label="Cloud Models (Free)">`;
            currentOptionsHtml += freeCloudModels.map(m => 
                `<option value="${m.id}" ${m.id === selectedModelId ? "selected" : ""}>${m.label}</option>`
            ).join("");
            currentOptionsHtml += `</optgroup>`;
        }
        if (premiumCloudModels.length > 0) {
            currentOptionsHtml += `<optgroup label="Cloud Models (API Key Required)">`;
            currentOptionsHtml += premiumCloudModels.map(m => 
                `<option value="${m.id}" ${m.id === selectedModelId ? "selected" : ""}>${m.label}</option>`
            ).join("");
            currentOptionsHtml += `</optgroup>`;
        }
        if (localModels.length > 0) {
            currentOptionsHtml += `<optgroup label="Local Models (WebGPU)">`;
            currentOptionsHtml += localModels.map(m => 
                `<option value="${m.id}" ${m.id === selectedModelId ? "selected" : ""}>${m.label}</option>`
            ).join("");
            currentOptionsHtml += `</optgroup>`;
        }
        
        if (modelSelect.innerHTML !== currentOptionsHtml) {
            modelSelect.innerHTML = currentOptionsHtml;
            if (!modelSelect.dataset.customized && window.createCustomDropdown) {
                window.createCustomDropdown(modelSelect);
            } else {
                modelSelect.updateCustomDropdown?.();
            }
        } else if (!modelSelect.dataset.customized && window.createCustomDropdown) {
            window.createCustomDropdown(modelSelect);
        } else {
            modelSelect.updateCustomDropdown?.();
        }
        
        const isCloud = status.modelType && status.modelType.startsWith("cloud-");
        modelSelect.disabled = !isCloud && (status.busy || status.ready);
        modelSelect.onchange = (event) => {
            window.LocalAI.setSelectedModelId(event.target.value);
            // Re-render taskbar tray status to reflect new model memory
            window.renderLocalAITray();
            // Also notify Settings app if it is open
            if (window.EventBus) {
                window.EventBus.emit("local-ai:model-changed", event.target.value);
            }
        };
    }

    if (label) {
        label.textContent = status.status === "generating"
            ? "Active"
            : status.status === "loading"
                ? "Loading"
                : status.status === "error"
                    ? "Error"
                    : status.ready
                        ? "Ready"
                        : "Off";
    }
    if (detail) {
        const pct = Math.round((status.progress || 0) * 100);
        const isCloud = status.modelType && status.modelType.startsWith("cloud-");

        if (status.status === "loading") {
            detail.textContent = `${status.statusText} (${pct}%)`;
        } else if (status.status === "generating") {
            detail.textContent = isCloud
                ? `${status.modelLabel} is answering...`
                : `${status.modelLabel} is answering in a background GPU worker.`;
        } else if (status.ready) {
            detail.textContent = isCloud
                ? `${status.modelLabel} is ready.`
                : `${status.modelLabel} is using about ${status.memoryMB} MB.`;
        } else if (status.status === "error") {
            detail.textContent = status.lastError || status.statusText;
        } else {
            detail.textContent = status.webGpuSupported
                ? "AI is off. Select a model below and enable it here."
                : "WebGPU is not available in this browser.";
        }
    }

    // Toggle button visibilities so only Stop/Disconnect OR Enable/Connect is shown
    const isCloudModel = status.modelType && status.modelType.startsWith("cloud-");
    const isAiActive = status.enabled && status.status !== "error";
    if (enableButton) {
        if (isCloudModel) {
            enableButton.disabled = status.busy;
            enableButton.innerHTML = '<i class="fa-solid fa-plug"></i> Connect';
        } else {
            enableButton.disabled = !status.webGpuSupported || status.busy;
            enableButton.innerHTML = status.status === "error"
                ? '<i class="fa-solid fa-rotate-right"></i> Retry'
                : '<i class="fa-solid fa-bolt"></i> Enable';
        }
        enableButton.style.display = isAiActive ? "none" : "inline-flex";
    }
    if (stopButton) {
        stopButton.disabled = !status.enabled;
        stopButton.style.display = isAiActive ? "inline-flex" : "none";
        if (isCloudModel) {
            stopButton.innerHTML = '<i class="fa-solid fa-link-slash"></i> Disconnect';
        } else {
            stopButton.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';
        }
    }
};

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("app:opened", () => window.renderTaskbar());
    window.EventBus.on("app:minimized", () => window.renderTaskbar());
    window.EventBus.on("app:closed", () => window.renderTaskbar());
    window.EventBus.on("app:maximized", () => window.renderTaskbar());
    window.EventBus.on("desktop:refresh", () => window.renderTaskbar());
    window.EventBus.on("local-ai:status", () => window.renderLocalAITray());
}
