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
            ${window.getAppIconHtml(app.icon, "taskbar-icon", app.id)}
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
    window.renderRelayTray?.();
};


window.closeRelayTrayPanel = () => {
    const panel = window.byId ? window.byId("relay-tray-panel") : document.getElementById("relay-tray-panel");
    const toggle = window.byId ? window.byId("relay-tray-toggle") : document.getElementById("relay-tray-toggle");
    if (panel) panel.hidden = true;
    if (toggle) toggle.setAttribute("aria-expanded", "false");
};

window.toggleRelayTrayPanel = () => {
    const panel = window.byId ? window.byId("relay-tray-panel") : document.getElementById("relay-tray-panel");
    const toggle = window.byId ? window.byId("relay-tray-toggle") : document.getElementById("relay-tray-toggle");
    if (!panel || !toggle || toggle.hidden || toggle.style.display === "none") return;
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    toggle.setAttribute("aria-expanded", String(nextOpen));
    if (nextOpen) {
        const startMenu = window.byId ? window.byId("start-menu") : document.getElementById("start-menu");
        const calPanel = window.byId ? window.byId("calendar-panel") : document.getElementById("calendar-panel");
        if (startMenu) startMenu.hidden = true;
        if (calPanel) calPanel.hidden = true;
        if (window.closeVolumePanel) window.closeVolumePanel();
        if (window.closeLocalAITrayPanel) window.closeLocalAITrayPanel();
        window.BrainHelper?.closeBubble?.();
        window.checkRelayStatus?.(true);
    }
};

let relayCheckInProgress = false;
let lastRelayCheck = 0;
window.checkRelayStatus = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRelayCheck < 5000) return;
    if (relayCheckInProgress) return;
    relayCheckInProgress = true;
    lastRelayCheck = now;

    const toggle = window.byId ? window.byId("relay-tray-toggle") : document.getElementById("relay-tray-toggle");
    const panel = window.byId ? window.byId("relay-tray-panel") : document.getElementById("relay-tray-panel");

    const hasExtension = Boolean(window.PortfoliOSNativeRelay);
    let hasHost = false;

    if (hasExtension) {
        try {
            hasHost = Boolean(await Promise.race([
                window.PortfoliOSNativeRelay.isAvailable(),
                new Promise(resolve => setTimeout(() => resolve(false), 2500))
            ]));
        } catch (_) {
            hasHost = false;
        }
    }

    if (toggle) {
        toggle.classList.remove("is-connected", "is-partial", "is-disconnected");
        if (hasExtension && hasHost) {
            toggle.classList.add("is-connected");
            toggle.title = "Native Relay: Connected (Extension + Host active)";
        } else if (hasExtension) {
            toggle.classList.add("is-partial");
            toggle.title = "Native Relay: Extension active, Host runner disconnected";
        } else {
            toggle.classList.add("is-disconnected");
            toggle.title = "Native Relay: Disconnected (Extension not detected)";
        }
    }

    if (panel) {
        const overallBadge = panel.querySelector("#relay-overall-badge");
        const extStatus = panel.querySelector("#relay-ext-status");
        const extDesc = panel.querySelector("#relay-ext-desc");
        const extLink = panel.querySelector("#relay-ext-link");
        const hostStatus = panel.querySelector("#relay-host-status");
        const hostDesc = panel.querySelector("#relay-host-desc");
        const hostLink = panel.querySelector("#relay-host-link");

        if (overallBadge) {
            overallBadge.className = "relay-tray-badge";
            if (hasExtension && hasHost) {
                overallBadge.classList.add("is-online");
                overallBadge.textContent = "Connected";
            } else if (hasExtension) {
                overallBadge.classList.add("is-warning");
                overallBadge.textContent = "Host Offline";
            } else {
                overallBadge.classList.add("is-offline");
                overallBadge.textContent = "Disconnected";
            }
        }

        if (extStatus) {
            extStatus.className = "relay-status-pill";
            if (hasExtension) {
                extStatus.classList.add("is-online");
                extStatus.textContent = "Active";
                if (extDesc) extDesc.textContent = "Chrome extension bridge detected and responding.";
                if (extLink) extLink.style.display = "none";
            } else {
                extStatus.classList.add("is-offline");
                extStatus.textContent = "Not Installed";
                if (extDesc) extDesc.textContent = "Requires the PortfoliOS Native Relay Chrome extension.";
                if (extLink) extLink.style.display = "inline-flex";
            }
        }

        if (hostStatus) {
            hostStatus.className = "relay-status-pill";
            if (hasHost) {
                hostStatus.classList.add("is-online");
                hostStatus.textContent = "Connected";
                if (hostDesc) hostDesc.textContent = "Native Messaging runner (com.bl4ut0.portfolios.relay) active.";
                if (hostLink) hostLink.style.display = "none";
            } else {
                hostStatus.classList.add(hasExtension ? "is-warning" : "is-offline");
                hostStatus.textContent = hasExtension ? "Host Offline" : "Unavailable";
                if (hostDesc) hostDesc.textContent = hasExtension
                    ? "Host bridge not detected. Install the PortfoliOS Native Relay MSI (uninstalls cleanly from Windows Settings)."
                    : "Download and install the PortfoliOS Native Relay MSI on your machine.";
                if (hostLink) hostLink.style.display = "inline-flex";
            }
        }
    }

    relayCheckInProgress = false;
};

window.renderRelayTray = () => {
    const isPrivate = window.isPrivateUser ? window.isPrivateUser() : false;
    const toggle = window.byId ? window.byId("relay-tray-toggle") : document.getElementById("relay-tray-toggle");
    const panel = window.byId ? window.byId("relay-tray-panel") : document.getElementById("relay-tray-panel");
    if (!toggle) return;

    if (!isPrivate) {
        toggle.classList.add("is-hidden");
        toggle.style.display = "none";
        if (panel) panel.hidden = true;
        return;
    }

    toggle.classList.remove("is-hidden");
    toggle.style.display = "";
    void window.checkRelayStatus?.();
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
        window.BrainHelper?.closeBubble?.();
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

    const isCloudModel = status.modelType && status.modelType.startsWith("cloud-");
    const serviceName = isCloudModel ? "Cloud AI" : "Local AI";

    toggle.hidden = false;
    toggle.classList.toggle("is-loading", status.status === "loading");
    toggle.classList.toggle("is-generating", status.status === "generating");
    toggle.classList.toggle("is-error", status.status === "error");
    toggle.classList.toggle("is-idle", status.status === "idle");
    toggle.title = `${serviceName}: ${status.statusText}`;

    const toggleIcon = toggle.querySelector("i");
    if (toggleIcon) {
        toggleIcon.className = isCloudModel ? "fa-solid fa-cloud" : "fa-solid fa-brain";
    }

    const headerTitle = panel.querySelector(".local-ai-tray-header span");
    if (headerTitle) {
        headerTitle.innerHTML = isCloudModel
            ? '<i class="fa-solid fa-cloud"></i> Cloud AI'
            : '<i class="fa-solid fa-brain"></i> Local AI';
    }

    const label = panel.querySelector("#local-ai-tray-status");
    const detail = panel.querySelector("#local-ai-tray-detail");
    const enableButton = panel.querySelector("[data-local-ai-tray-enable]");
    const stopButton = panel.querySelector("[data-local-ai-tray-stop]");
    const settingsButton = panel.querySelector("[data-local-ai-tray-settings]");
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
        
        modelSelect.disabled = status.busy;
        modelSelect.onchange = (event) => {
            window.LocalAI.setSelectedModelId(event.target.value);
            window.renderLocalAITray();
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
        stopButton.disabled = false;
        stopButton.style.display = isAiActive ? "inline-flex" : "none";
        if (status.status === "generating") {
            stopButton.innerHTML = '<i class="fa-solid fa-square"></i> Cancel reply';
            stopButton.title = "Cancel the current AI response";
        } else if (isCloudModel) {
            stopButton.innerHTML = '<i class="fa-solid fa-link-slash"></i> Disconnect';
            stopButton.title = "Disconnect Cloud AI";
        } else {
            stopButton.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';
            stopButton.title = "Stop Local AI and release its model";
        }
    }

    if (settingsButton) settingsButton.disabled = false;
};

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("app:opened", () => window.renderTaskbar());
    window.EventBus.on("app:minimized", () => window.renderTaskbar());
    window.EventBus.on("app:closed", () => window.renderTaskbar());
    window.EventBus.on("app:maximized", () => window.renderTaskbar());
    window.EventBus.on("desktop:refresh", () => window.renderTaskbar());
    window.EventBus.on("local-ai:status", () => window.renderLocalAITray());
    window.EventBus.on("local-ai:model-changed", () => window.renderLocalAITray());
    window.EventBus.on("local-ai:mirror-changed", () => window.renderLocalAITray());

    window.EventBus.on("user:changed", () => {
        window.renderTaskbar();
        window.renderRelayTray?.();
    });
    window.EventBus.on("state:changed:currentUserId", () => {
        window.renderTaskbar();
        window.renderRelayTray?.();
    });

}
