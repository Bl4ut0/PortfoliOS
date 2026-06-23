/**
 * PortfoliOS: Desktop Icons and Grid Layout
 * Renders the desktop shortcut icons on a snapping grid and handles icon drag-and-drop.
 */

window.getDesktopLauncher = (id) => {
    const system = window.systemById ? window.systemById(id) : null;
    if (system) {
        return {
            id: system.id,
            title: system.title,
            icon: system.icon,
            color: system.color,
            launchApp: system.launchApp || "dossier",
            selectId: system.id
        };
    }

    const app = window.appById ? window.appById(id) : null;
    if (!app) return null;
    return {
        id: app.id,
        title: app.title,
        icon: app.icon,
        color: app.id === "linux" ? "#34d399" : (app.id === "store" ? "#a78bfa" : "#22d3ee"),
        launchApp: app.id,
        selectId: ""
    };
};

window.findFreeGridCell = (occupied, maxRows) => {
    let col = 0;
    let row = 0;
    while (occupied.has(`${col},${row}`)) {
        row++;
        if (row >= maxRows) {
            row = 0;
            col++;
        }
    }
    return { col, row };
};

window.findNearestFreeCell = (targetCol, targetRow, occupied, maxRows, maxCols) => {
    let minDistance = Infinity;
    let bestCell = { col: targetCol, row: targetRow };
    for (let c = 0; c < 100; c++) {
        for (let r = 0; r < maxRows; r++) {
            if (!occupied.has(`${c},${r}`)) {
                const dist = Math.abs(c - targetCol) + Math.abs(r - targetRow);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestCell = { col: c, row: r };
                }
            }
        }
    }
    return bestCell;
};

window.renderDesktopIcons = () => {
    const desktopIcons = window.byId ? window.byId("desktop-icons") : document.getElementById("desktop-icons");
    if (!desktopIcons) return;

    const containerRect = desktopIcons.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const cellWidth = 8.3 * rem;
    const cellHeight = 6.4 * rem;

    let maxRows = 5;
    let maxCols = 10;
    if (containerRect.height > 0) {
        maxRows = Math.max(1, Math.floor(containerRect.height / cellHeight));
    }
    if (containerRect.width > 0) {
        maxCols = Math.max(1, Math.floor(containerRect.width / cellWidth));
    }

    const apps = window.desktopPinnedIds
        .filter(id => window.isAppInstalled(id))
        .map(window.getDesktopLauncher)
        .filter(Boolean);
        
    const occupied = new Set();
    const resolvedPositions = [];
    const appsToPlaceLater = [];

    // Pass 1: Place apps with saved custom positions
    apps.forEach(item => {
        const key = item.selectId ? `desktop_pos_${item.launchApp}_${item.selectId}` : `desktop_pos_${item.launchApp}`;
        let savedRaw = null;
        if (window.Storage) {
            savedRaw = window.Storage.local.get(key);
        } else {
            savedRaw = localStorage.getItem(key);
        }
        
        if (savedRaw) {
            try {
                const pos = JSON.parse(savedRaw);
                let col = Math.round(pos.left / cellWidth);
                let row = Math.round(pos.top / cellHeight);

                col = Math.max(0, Math.min(col, maxCols - 1));
                row = Math.max(0, Math.min(row, maxRows - 1));

                const gridKey = `${col},${row}`;
                if (!occupied.has(gridKey)) {
                    occupied.add(gridKey);
                    resolvedPositions.push({
                        item,
                        left: `${col * cellWidth}px`,
                        top: `${row * cellHeight}px`
                    });
                    return;
                }
            } catch (e) {
                // invalid position, place later
            }
        }
        appsToPlaceLater.push(item);
    });

    // Pass 2: Place remaining apps in default grid slots
    appsToPlaceLater.forEach(item => {
        const index = window.desktopPinnedIds.indexOf(item.id);
        let col = 0;
        let row = 0;
        if (index !== -1) {
            col = Math.floor(index / maxRows);
            row = index % maxRows;
        }

        let gridKey = `${col},${row}`;
        if (occupied.has(gridKey)) {
            const freeCell = window.findFreeGridCell(occupied, maxRows);
            col = freeCell.col;
            row = freeCell.row;
            gridKey = `${col},${row}`;
        }

        occupied.add(gridKey);
        resolvedPositions.push({
            item,
            left: `${col * cellWidth}px`,
            top: `${row * cellHeight}px`
        });
    });

    desktopIcons.innerHTML = resolvedPositions.map(({ item, left, top }) => {
        const isActive = item.selectId && item.selectId === state.activeId;
        return `
            <button class="desktop-icon ${isActive ? "active" : ""}" ${item.selectId ? `data-select="${item.selectId}"` : ""}
                data-open-app="${item.launchApp}" style="--tile-color:${item.color}; position: absolute; left: ${left}; top: ${top};" title="Open ${item.title}">
                ${window.getAppIconHtml(item.icon)}
                <span>${item.title}</span>
            </button>
        `;
    }).join("");
};

window.initDesktopIconDragging = () => {
    const container = window.byId ? window.byId("desktop-icons") : document.getElementById("desktop-icons");
    if (!container) return;

    container.addEventListener("pointerdown", (event) => {
        const icon = event.target.closest(".desktop-icon");
        if (!icon || event.button !== 0 || event.target.closest("a, button:not(.desktop-icon)")) return;
        event.preventDefault();

        const scale = window.getDesktopScale ? window.getDesktopScale() : 1;
        const startX = event.clientX;
        const startY = event.clientY;

        const startLeft = parseFloat(icon.style.left) || 0;
        const startTop = parseFloat(icon.style.top) || 0;

        const iconW = icon.offsetWidth;
        const iconH = icon.offsetHeight;
        const containerW = container.offsetWidth;
        const containerH = container.offsetHeight;

        let hasMoved = false;

        const move = (moveEvent) => {
            const dx = (moveEvent.clientX - startX) / scale;
            const dy = (moveEvent.clientY - startY) / scale;

            if (Math.abs(dx * scale) > 4 || Math.abs(dy * scale) > 4) {
                hasMoved = true;
                icon.dataset.preventClick = "true";
                icon.classList.add("is-dragging");
            }

            if (hasMoved) {
                const nextLeft = Math.max(0, Math.min(containerW - iconW, startLeft + dx));
                const nextTop = Math.max(0, Math.min(containerH - iconH, startTop + dy));
                icon.style.left = `${nextLeft}px`;
                icon.style.top = `${nextTop}px`;
            }
        };

        const stop = () => {
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", stop);
            document.removeEventListener("pointercancel", stop);

            if (hasMoved) {
                icon.classList.remove("is-dragging");
                const appName = icon.dataset.openApp;
                const selectId = icon.dataset.select || "";
                const key = selectId ? `desktop_pos_${appName}_${selectId}` : `desktop_pos_${appName}`;
                
                const finalLeft = parseFloat(icon.style.left);
                const finalTop = parseFloat(icon.style.top);

                const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
                const cellWidth = 8.3 * rem;
                const cellHeight = 6.4 * rem;

                const maxRows = Math.max(1, Math.floor(containerH / cellHeight));
                const maxCols = Math.max(1, Math.floor(containerW / cellWidth));

                const otherIcons = Array.from(container.querySelectorAll(".desktop-icon")).filter(el => el !== icon);
                const occupied = new Set();
                otherIcons.forEach(el => {
                    const leftVal = parseFloat(el.style.left) || 0;
                    const topVal = parseFloat(el.style.top) || 0;
                    const c = Math.round(leftVal / cellWidth);
                    const r = Math.round(topVal / cellHeight);
                    occupied.add(`${c},${r}`);
                });

                const targetCol = Math.max(0, Math.min(Math.round(finalLeft / cellWidth), maxCols - 1));
                const targetRow = Math.max(0, Math.min(Math.round(finalTop / cellHeight), maxRows - 1));

                const resolved = window.findNearestFreeCell(targetCol, targetRow, occupied, maxRows, maxCols);

                const snappedLeft = resolved.col * cellWidth;
                const snappedTop = resolved.row * cellHeight;

                icon.style.left = `${snappedLeft}px`;
                icon.style.top = `${snappedTop}px`;

                if (window.Storage) {
                    window.Storage.local.set(key, JSON.stringify({ left: snappedLeft, top: snappedTop }));
                } else {
                    localStorage.setItem(key, JSON.stringify({ left: snappedLeft, top: snappedTop }));
                }
                
                setTimeout(() => {
                    delete icon.dataset.preventClick;
                }, 50);
            }
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", stop);
        document.addEventListener("pointercancel", stop);
    });
};

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("app:installed", () => window.renderDesktopIcons());
    window.EventBus.on("app:uninstalled", () => window.renderDesktopIcons());
    window.EventBus.on("desktop:refresh", () => window.renderDesktopIcons());
}
