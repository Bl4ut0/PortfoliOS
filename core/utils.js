/**
 * PortfoliOS: Utility Functions
 * General helper functions used across various systems.
 */

window.byId = (id) => document.getElementById(id);

window.getDesktopScale = () => {
    const experience = document.getElementById("desktop-experience");
    if (!experience) return 1;
    const rect = experience.getBoundingClientRect();
    const offsetW = experience.offsetWidth;
    if (!offsetW) return 1;
    return rect.width / offsetW;
};

window.systemById = (id) => window.systems ? window.systems.find((item) => item.id === id) : null;
window.appById = (id) => window.desktopApps ? window.desktopApps.find((item) => item.id === id) : null;
window.bookmarkById = (id) => window.browserBookmarks ? window.browserBookmarks.find((item) => item.id === id) : null;
window.quickRouteById = (id) => window.quickRoutes ? window.quickRoutes.find((item) => item.id === id) : null;

window.getAppIconHtml = (iconClassOrUrl, extraClass = "") => {
    if (!iconClassOrUrl) return "";
    if (iconClassOrUrl.startsWith(".") || iconClassOrUrl.startsWith("/") || iconClassOrUrl.startsWith("http") || iconClassOrUrl.includes(".")) {
        return `<img src="${iconClassOrUrl}" class="app-icon-img ${extraClass}" alt="Icon" />`;
    }
    return `<i class="${iconClassOrUrl} ${extraClass}"></i>`;
};

window.formatBytes = (sizeBytes) => {
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "unknown";
    if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
    if (sizeBytes >= 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${sizeBytes} bytes`;
};

window.loadScript = (src) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
};

window.createCustomDropdown = (selectEl) => {
    if (!selectEl || selectEl.dataset.customized) return;
    selectEl.dataset.customized = "true";

    // Create custom container
    const container = document.createElement("div");
    container.className = "custom-select-container";
    if (selectEl.id) container.dataset.selectId = selectEl.id;

    // Create trigger button
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.disabled = selectEl.disabled;

    const triggerText = document.createElement("span");
    triggerText.className = "custom-select-trigger-text";
    
    const arrow = document.createElement("i");
    arrow.className = "fa-solid fa-chevron-down custom-select-arrow";

    trigger.appendChild(triggerText);
    trigger.appendChild(arrow);
    container.appendChild(trigger);

    // Create options list
    const optionsList = document.createElement("div");
    optionsList.className = "custom-select-options-list";
    container.appendChild(optionsList);

    // Hide original select and insert custom container
    selectEl.style.display = "none";
    selectEl.parentNode.insertBefore(container, selectEl.nextSibling);

    // Function to rebuild options list
    const rebuildOptions = () => {
        optionsList.innerHTML = "";
        
        const createOptionItem = (opt) => {
            const idx = opt.index;
            const item = document.createElement("div");
            item.className = "custom-select-option";
            if (opt.selected) {
                item.classList.add("selected");
                triggerText.textContent = opt.textContent;
            }
            item.textContent = opt.textContent;
            item.dataset.value = opt.value;
            item.dataset.index = idx;

            item.addEventListener("click", (e) => {
                e.stopPropagation();
                selectEl.selectedIndex = idx;
                
                // Dispatch change event on original select
                const event = new Event("change", { bubbles: true });
                selectEl.dispatchEvent(event);

                // Update UI selection
                Array.from(optionsList.querySelectorAll(".custom-select-option")).forEach(child => child.classList.remove("selected"));
                item.classList.add("selected");
                triggerText.textContent = opt.textContent;

                // Close dropdown
                container.classList.remove("open");
            });

            optionsList.appendChild(item);
        };

        const processNode = (node) => {
            if (node.tagName === "OPTGROUP") {
                const header = document.createElement("div");
                header.className = "custom-select-group-header";
                header.textContent = node.label;
                optionsList.appendChild(header);

                Array.from(node.children).forEach(child => {
                    if (child.tagName === "OPTION") {
                        createOptionItem(child);
                    }
                });
            } else if (node.tagName === "OPTION") {
                createOptionItem(node);
            }
        };

        Array.from(selectEl.children).forEach(processNode);

        // Set fallback trigger text if no option is selected
        if (selectEl.selectedIndex === -1 && selectEl.options.length > 0) {
            triggerText.textContent = selectEl.options[0].textContent;
        }
    };

    rebuildOptions();

    // Toggle dropdown open state
    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        
        // Close all other custom dropdowns
        document.querySelectorAll(".custom-select-container").forEach(c => {
            if (c !== container) {
                c.classList.remove("open");
            }
        });

        // Determine if it should open upwards to prevent falling off the screen
        const rect = trigger.getBoundingClientRect();
        const listHeight = optionsList.offsetHeight || 210;
        // Subtract taskbar height/safety margin (60px) from window.innerHeight
        const spaceBelow = window.innerHeight - rect.bottom - 60;
        const spaceAbove = rect.top - 20;

        if (spaceBelow < listHeight && spaceAbove > spaceBelow) {
            container.classList.add("open-upwards");
        } else {
            container.classList.remove("open-upwards");
        }

        container.classList.toggle("open");
    });

    // Close on click outside
    document.addEventListener("click", () => {
        container.classList.remove("open");
    });

    // Handle disabled/enabled and programmatically updated values
    const syncState = () => {
        trigger.disabled = selectEl.disabled;
        rebuildOptions();
    };

    // Watch for class/disabled changes on the original select
    const observer = new MutationObserver(syncState);
    observer.observe(selectEl, { attributes: true, attributeFilter: ["disabled"] });

    // Expose a clean update method on the native select
    selectEl.updateCustomDropdown = syncState;
};
