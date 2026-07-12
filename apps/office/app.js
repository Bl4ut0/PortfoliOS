/**
 * PortfoliOS: LibreOffice WASM (Office Suite)
 * Simulated WebAssembly booted document processor & spreadsheet suite.
 */
(function() {
    const APP_ID = "office";
    
    // Memory database state for Calc sheets and Writer text
    let officeState = {
        isWasmBooted: false,
        activeView: "dashboard", // "dashboard" | "writer" | "calc"
        currentFile: null,       // { path, name, parent, data, type }
        recentDocs: [],
        
        // Writer styling preferences
        writerDarkModePage: false,

        // Calc grid data state
        activeCell: null,
        activeSheet: "Sheet1",
        sheets: {
            "Sheet1": {} // A1: { raw: "=SUM(B1:B3)", display: "15", bold: false, italic: false, align: "left" }
        }
    };

    let saveDialogPath = "/documents";

    function sanitizeFileName(name) {
        return String(name || "")
            .replace(/[\\/:*?"<>|]/g, "-")
            .replace(/[\u0000-\u001f]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function joinPath(parent, name) {
        const cleanParent = window.SystemFS?.normalizePath(parent) || parent || "/";
        return cleanParent === "/" ? `/${name}` : `${cleanParent}/${name}`;
    }

    function getSaveSpec() {
        return officeState.activeView === "calc"
            ? { extension: ".ods", defaultName: "Untitled.ods", mimeType: "application/json" }
            : { extension: ".odt", defaultName: "Untitled.odt", mimeType: "text/html" };
    }

    function getActiveFileData(windowEl) {
        const spec = getSaveSpec();
        if (officeState.activeView === "writer") {
            return {
                data: windowEl.querySelector(".writer-page")?.innerHTML || "",
                mimeType: spec.mimeType
            };
        }
        return {
            data: JSON.stringify(officeState.sheets),
            mimeType: spec.mimeType
        };
    }

    // Helper to translate col letters like "A" -> 1
    function colToNumber(col) {
        let num = 0;
        for (let i = 0; i < col.length; i++) {
            num = num * 26 + (col.charCodeAt(i) - 64);
        }
        return num;
    }

    // Helper to translate col number like 1 -> "A"
    function numberToCol(num) {
        let col = '';
        while (num > 0) {
            let temp = (num - 1) % 26;
            col = String.fromCharCode(65 + temp) + col;
            num = Math.floor((num - temp) / 26);
        }
        return col;
    }

    // Helper to get range of cells between "A1" and "B3"
    function getCellsInRange(start, end) {
        const startCol = start.match(/[A-Z]+/)[0];
        const startRow = parseInt(start.match(/[0-9]+/)[0]);
        const endCol = end.match(/[A-Z]+/)[0];
        const endRow = parseInt(end.match(/[0-9]+/)[0]);
        
        const colStartNum = colToNumber(startCol);
        const colEndNum = colToNumber(endCol);
        
        const cells = [];
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(colStartNum, colEndNum);
        const maxCol = Math.max(colStartNum, colEndNum);

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                cells.push(numberToCol(c) + r);
            }
        }
        return cells;
    }

    // Load recent files from localStorage
    function loadRecentDocs() {
        try {
            const raw = localStorage.getItem("bl4ut0_recent_office_docs");
            officeState.recentDocs = raw ? JSON.parse(raw) : [];
        } catch (e) {
            officeState.recentDocs = [];
        }
    }

    // Save recent files
    function saveRecentDocs(fileItem) {
        if (!fileItem) return;
        officeState.recentDocs = officeState.recentDocs.filter(d => d.path !== fileItem.path);
        officeState.recentDocs.unshift({
            name: fileItem.name,
            path: fileItem.path,
            type: fileItem.type || "text/plain",
            lastOpened: Date.now()
        });
        if (officeState.recentDocs.length > 8) {
            officeState.recentDocs.pop();
        }
        localStorage.setItem("bl4ut0_recent_office_docs", JSON.stringify(officeState.recentDocs));
    }

    // Build standard Calc columns A-P and rows 1-60
    const COLUMNS = Array.from({ length: 16 }, (_, i) => numberToCol(i + 1));
    const ROWS = Array.from({ length: 60 }, (_, i) => i + 1);

    // Simulated WebAssembly Log Sequence
    const BOOT_LOGS = [
        "Downloading WebAssembly binary distribution package (5.8 MiB)...",
        "Compiling LLVM bytecode to WebAssembly module (libreoffice_core.wasm)...",
        "Setting up sandboxed WebAssembly execution environment...",
        "Instantiating Emscripten runtime, allocating 128MB linear memory...",
        "Mounting virtual filesystem (IndexedDB SystemFS) onto /sys/local...",
        "Preloading shared libraries: libuno.so, libvcl.so, libedit.so...",
        "Linking Qt5 client side GUI drawing context...",
        "Bootstrapping LibreOffice WASM Framework... SUCCESS!",
        "Staging office environment... Welcome!"
    ];
    const officeBootTimers = new Set();
    let officeBootRun = 0;

    function cancelOfficeBoot() {
        officeBootRun++;
        officeBootTimers.forEach((timer) => clearTimeout(timer));
        officeBootTimers.clear();
    }

    function scheduleOfficeBoot(runId, callback, delay) {
        const timer = setTimeout(() => {
            officeBootTimers.delete(timer);
            if (runId === officeBootRun) callback();
        }, delay);
        officeBootTimers.add(timer);
    }

    // Trigger WASM simulated boot loader
    function bootOfficeWasm(windowEl, onComplete) {
        cancelOfficeBoot();
        const runId = officeBootRun;
        if (window.isOfficeWasmBooted) {
            // Already booted in this session, skip long boot
            const splash = windowEl.querySelector(".office-splash");
            if (splash) splash.remove();
            officeState.isWasmBooted = true;
            onComplete?.();
            return;
        }

        const splash = windowEl.querySelector(".office-splash");
        const progressBar = windowEl.querySelector(".office-splash-progress-bar");
        const logContainer = windowEl.querySelector(".office-splash-log");
        if (!splash || !progressBar || !logContainer) return;

        let currentStep = 0;
        const totalSteps = BOOT_LOGS.length;

        function step() {
            if (currentStep >= totalSteps) {
                progressBar.style.width = "100%";
                scheduleOfficeBoot(runId, () => {
                    splash.classList.add("fade-out");
                    scheduleOfficeBoot(runId, () => {
                        splash.remove();
                        window.isOfficeWasmBooted = true; // Set session global
                        officeState.isWasmBooted = true;
                        onComplete?.();
                    }, 500);
                }, 400);
                return;
            }

            const percent = Math.min(100, Math.round((currentStep / totalSteps) * 100));
            progressBar.style.width = `${percent}%`;

            const logLine = document.createElement("div");
            logLine.textContent = BOOT_LOGS[currentStep];
            logContainer.appendChild(logLine);
            
            // Auto scroll log to bottom
            logContainer.scrollTop = logContainer.scrollHeight;

            currentStep++;
            // Slightly random delay to feel like a real network/compilation phase
            const delay = 100 + Math.random() * 200;
            scheduleOfficeBoot(runId, step, delay);
        }

        scheduleOfficeBoot(runId, step, 100);
    }

    // Spreadsheet formula evaluation engine
    function getCellValue(cellRef) {
        const sheet = officeState.sheets[officeState.activeSheet] || {};
        const cell = sheet[cellRef] || {};
        if (cell.raw && cell.raw.startsWith("=")) {
            return cell.display || "";
        }
        return cell.raw || "";
    }

    function evaluateFormula(formulaStr) {
        try {
            if (!formulaStr.startsWith("=")) return formulaStr;
            const clean = formulaStr.slice(1).toUpperCase().trim();

            // 1. Evaluate ranges: SUM, AVERAGE, MIN, MAX
            const rangeMatch = clean.match(/^(SUM|AVERAGE|MIN|MAX)\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/);
            if (rangeMatch) {
                const [_, op, startCell, endCell] = rangeMatch;
                const cells = getCellsInRange(startCell, endCell);
                const values = cells.map(c => parseFloat(getCellValue(c))).filter(v => !isNaN(v));
                if (op === "SUM") return values.reduce((a, b) => a + b, 0);
                if (op === "AVERAGE") return values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : 0;
                if (op === "MIN") return values.length ? Math.min(...values) : 0;
                if (op === "MAX") return values.length ? Math.max(...values) : 0;
            }

            // 2. Evaluate cell coordinate math: e.g. A1 + B2
            let evalStr = clean;
            const cellRefs = clean.match(/[A-Z]+[0-9]+/g) || [];
            // Sort refs descending by length to avoid replacing substring (e.g. A10 replaced by A1)
            cellRefs.sort((a, b) => b.length - a.length);
            
            cellRefs.forEach(ref => {
                const val = parseFloat(getCellValue(ref)) || 0;
                evalStr = evalStr.replaceAll(ref, val);
            });

            // Clean evaluation string to only allow math chars
            if (/^[0-9.+\-*/() ]+$/.test(evalStr)) {
                const result = Function(`"use strict"; return (${evalStr})`)();
                return Number.isFinite(result) ? result : "#ERR";
            }
            return formulaStr;
        } catch (err) {
            console.warn("Formula eval error:", err);
            return "#ERR";
        }
    }

    // Refresh all cell display values (re-calculate sheets formulas)
    function recalculateCalcSheet() {
        const sheet = officeState.sheets[officeState.activeSheet] || {};
        
        // Loop multiple times to handle simple dependency order
        for (let pass = 0; pass < 3; pass++) {
            Object.keys(sheet).forEach(cellRef => {
                const cell = sheet[cellRef];
                if (cell && cell.raw && cell.raw.startsWith("=")) {
                    cell.display = String(evaluateFormula(cell.raw));
                }
            });
        }
    }

    // Synchronize UI view display
    function updateActiveView(windowEl, targetView) {
        officeState.activeView = targetView;

        // Hide all major screens
        windowEl.querySelectorAll(".office-screen").forEach(el => el.hidden = true);

        // Show toolbar and menus only if not on dashboard
        const header = windowEl.querySelector(".office-header");
        const statusbar = windowEl.querySelector(".office-statusbar");

        if (targetView === "dashboard") {
            header.style.display = "none";
            windowEl.querySelector(".office-dashboard").hidden = false;
            renderRecentDocsList(windowEl);
        } else if (targetView === "writer") {
            header.style.display = "block";
            windowEl.querySelector(".writer-container").hidden = false;
            
            // Toggle active toolbar items
            windowEl.querySelector(".office-toolbar-group.writer-tools").style.display = "flex";
            windowEl.querySelector(".office-toolbar-group.calc-tools").style.display = "none";
            
            updateDocumentTitle(windowEl);
        } else if (targetView === "calc") {
            header.style.display = "block";
            windowEl.querySelector(".calc-container").hidden = false;
            
            // Toggle active toolbar items
            windowEl.querySelector(".office-toolbar-group.writer-tools").style.display = "none";
            windowEl.querySelector(".office-toolbar-group.calc-tools").style.display = "flex";
            
            recalculateCalcSheet();
            renderSpreadsheetGrid(windowEl);
            updateDocumentTitle(windowEl);
        }
    }

    function updateDocumentTitle(windowEl) {
        const titleEl = windowEl.querySelector(".window-bar span");
        if (!titleEl) return;
        const app = window.appRegistry[APP_ID];
        const baseTitle = app.title;
        const fileName = officeState.currentFile ? officeState.currentFile.name : "(Unsaved File)";
        const mode = officeState.activeView === "writer" ? "Writer" : "Calc";
        
        let iconHtml = `<i class="${app.icon}"></i>`;
        if (officeState.activeView === "writer") {
            iconHtml = `<i class="fa-solid fa-file-word" style="color: #3b82f6;"></i>`;
        } else if (officeState.activeView === "calc") {
            iconHtml = `<i class="fa-solid fa-file-excel" style="color: #10b981;"></i>`;
        }

        titleEl.innerHTML = `${iconHtml} ${fileName} - LibreOffice WASM ${mode}`;
    }

    // Renders the dashboard's recent documents list
    function renderRecentDocsList(windowEl) {
        const recentContainer = windowEl.querySelector(".recent-docs-list-container");
        if (!recentContainer) return;

        loadRecentDocs();

        if (officeState.recentDocs.length === 0) {
            recentContainer.innerHTML = `<div style="color: var(--office-text-muted); font-size: 0.85rem; padding: 1rem 0;">No recently opened documents.</div>`;
            return;
        }

        let html = `<div class="recent-docs-list">`;
        officeState.recentDocs.forEach(doc => {
            const isCalc = doc.name.endsWith(".ods") || doc.name.endsWith(".xlsx") || doc.name.endsWith(".xls");
            const icon = isCalc ? "fa-regular fa-file-excel" : "fa-regular fa-file-word";
            const dateStr = new Date(doc.lastOpened).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
            
            html += `
                <div class="recent-doc-item" data-path="${doc.path}">
                    <div class="recent-doc-left">
                        <i class="${icon}"></i>
                        <div>
                            <span class="recent-doc-name">${doc.name}</span>
                            <span class="recent-doc-path">${doc.path}</span>
                        </div>
                    </div>
                    <span class="recent-doc-date">${dateStr}</span>
                </div>
            `;
        });
        html += `</div>`;
        recentContainer.innerHTML = html;

        // Attach double-click listener to items
        recentContainer.querySelectorAll(".recent-doc-item").forEach(item => {
            item.addEventListener("click", async () => {
                const path = item.dataset.path;
                try {
                    const record = await window.SystemFS.readFile(path);
                    if (record) {
                        loadOfficeFile(windowEl, record);
                    } else {
                        alert("File not found in Virtual Filesystem. It may have been deleted.");
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        });
    }

    // Handles actual file parsing and workspace loading
    async function loadOfficeFile(windowEl, fileItem) {
        officeState.currentFile = fileItem;
        const lowerName = fileItem.name.toLowerCase();

        if (lowerName.endsWith(".ods") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv")) {
            // Load Spreadsheet
            officeState.activeSheet = "Sheet1";
            officeState.sheets = { "Sheet1": {} };
            
            let dataStr = "";
            if (fileItem.data instanceof Blob) {
                dataStr = await fileItem.data.text();
            } else {
                dataStr = fileItem.data || "";
            }

            try {
                if (dataStr) {
                    // Check if saved state is JSON or CSV
                    if (dataStr.trim().startsWith("{")) {
                        const parsed = JSON.parse(dataStr);
                        if (parsed && typeof parsed === "object") {
                            officeState.sheets = parsed;
                        }
                    } else {
                        // Parse CSV simply into cells
                        const lines = dataStr.split("\n");
                        const sheet = officeState.sheets["Sheet1"];
                        lines.forEach((line, rIdx) => {
                            const cells = line.split(",");
                            cells.forEach((val, cIdx) => {
                                const ref = numberToCol(cIdx + 1) + (rIdx + 1);
                                sheet[ref] = { raw: val.trim(), display: val.trim() };
                            });
                        });
                    }
                }
            } catch (err) {
                console.error("Spreadsheet file parse error:", err);
            }
            
            updateActiveView(windowEl, "calc");
        } else {
            // Load Writer Document
            let text = "";
            if (fileItem.data instanceof Blob) {
                text = await fileItem.data.text();
            } else {
                text = fileItem.data || "";
            }

            const page = windowEl.querySelector(".writer-page");
            if (page) {
                // If it is stored as plain HTML, load directly. Otherwise convert text newlines to paragraphs
                if (text.trim().startsWith("<p") || text.trim().startsWith("<div") || text.trim().includes("</p>")) {
                    page.innerHTML = text;
                } else {
                    page.innerHTML = text.split("\n").map(p => p.trim() ? `<p>${p}</p>` : "<p><br></p>").join("");
                }
            }

            updateActiveView(windowEl, "writer");
        }
        
        saveRecentDocs(fileItem);
    }

    function setSaveDialogError(windowEl, message = "") {
        const errorEl = windowEl.querySelector(".office-save-error");
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.hidden = !message;
        }
    }

    function resetSaveDialogConfirmation(windowEl) {
        const dialog = windowEl.querySelector(".office-save-dialog");
        const saveButton = windowEl.querySelector(".office-save-confirm");
        if (dialog) delete dialog.dataset.overwritePath;
        if (saveButton) saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save';
        setSaveDialogError(windowEl);
    }

    function closeSaveDialog(windowEl) {
        const overlay = windowEl.querySelector(".office-save-overlay");
        if (!overlay) return;
        overlay.hidden = true;
        resetSaveDialogConfirmation(windowEl);
        windowEl.querySelector(".office-new-folder-row")?.setAttribute("hidden", "");
    }

    function renderSaveBreadcrumbs(windowEl) {
        const container = windowEl.querySelector(".office-save-breadcrumbs");
        if (!container) return;
        container.replaceChildren();

        const appendSegment = (label, path, icon = "") => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "office-save-breadcrumb";
            if (icon) button.innerHTML = `<i class="${icon}"></i><span>${label}</span>`;
            else button.textContent = label;
            button.addEventListener("click", () => {
                saveDialogPath = path;
                resetSaveDialogConfirmation(windowEl);
                renderSaveDirectory(windowEl);
            });
            container.appendChild(button);
        };

        appendSegment("SystemFS", "/", "fa-solid fa-hard-drive");
        let accumulatedPath = "";
        saveDialogPath.split("/").filter(Boolean).forEach((part) => {
            const separator = document.createElement("i");
            separator.className = "fa-solid fa-chevron-right office-save-breadcrumb-separator";
            container.appendChild(separator);
            accumulatedPath += `/${part}`;
            appendSegment(part, accumulatedPath);
        });
    }

    async function renderSaveDirectory(windowEl) {
        const list = windowEl.querySelector(".office-save-folder-list");
        const upButton = windowEl.querySelector(".office-save-up");
        const location = windowEl.querySelector(".office-save-location");
        if (!list) return;

        saveDialogPath = window.SystemFS.normalizePath(saveDialogPath);
        if (upButton) upButton.disabled = saveDialogPath === "/";
        if (location) location.textContent = saveDialogPath;
        renderSaveBreadcrumbs(windowEl);
        list.innerHTML = '<div class="office-save-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading folders...</div>';

        try {
            const items = await window.SystemFS.readDir(saveDialogPath);
            const directories = items.filter((item) => item.isDirectory && !item.name.startsWith("."));
            list.replaceChildren();

            if (!directories.length) {
                const empty = document.createElement("div");
                empty.className = "office-save-empty";
                empty.textContent = "No folders in this location.";
                list.appendChild(empty);
                return;
            }

            directories.forEach((directory) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "office-save-folder";
                button.innerHTML = '<i class="fa-solid fa-folder"></i><span></span><i class="fa-solid fa-chevron-right"></i>';
                button.querySelector("span").textContent = directory.name;
                button.addEventListener("click", () => {
                    saveDialogPath = directory.path;
                    resetSaveDialogConfirmation(windowEl);
                    renderSaveDirectory(windowEl);
                });
                list.appendChild(button);
            });
        } catch (error) {
            console.error("Failed to list SystemFS folders:", error);
            list.innerHTML = '<div class="office-save-empty">This location could not be opened.</div>';
            setSaveDialogError(windowEl, error.message || "This location could not be opened.");
        }
    }

    async function writeActiveOfficeFile(windowEl, path, name, parent) {
        const { data, mimeType } = getActiveFileData(windowEl);
        const record = await window.SystemFS.writeFile(path, name, parent, data, data.length, mimeType, false);
        officeState.currentFile = record;
        updateDocumentTitle(windowEl);
        saveRecentDocs(record);
        window.showDesktopToast?.(`Saved ${name} locally in ${parent}.`);
        return record;
    }

    async function commitSaveDialog(windowEl) {
        const dialog = windowEl.querySelector(".office-save-dialog");
        const input = windowEl.querySelector(".office-save-name");
        const saveButton = windowEl.querySelector(".office-save-confirm");
        if (!dialog || !input || !saveButton) return;

        const { extension } = getSaveSpec();
        let name = sanitizeFileName(input.value);
        if (!name) {
            setSaveDialogError(windowEl, "Enter a file name.");
            input.focus();
            return;
        }
        if (!name.toLowerCase().endsWith(extension)) name += extension;
        input.value = name;

        const path = joinPath(saveDialogPath, name);
        try {
            const existing = await window.SystemFS.readFile(path);
            if (existing?.isDirectory) {
                setSaveDialogError(windowEl, "A folder already uses that name.");
                return;
            }
            if (existing && dialog.dataset.overwritePath !== path) {
                dialog.dataset.overwritePath = path;
                saveButton.innerHTML = '<i class="fa-solid fa-rotate"></i> Replace';
                setSaveDialogError(windowEl, `${name} already exists here. Choose Replace to overwrite it.`);
                return;
            }

            saveButton.disabled = true;
            await writeActiveOfficeFile(windowEl, path, name, saveDialogPath);
            closeSaveDialog(windowEl);
        } catch (error) {
            console.error("Save failed:", error);
            setSaveDialogError(windowEl, error.message || "The file could not be saved.");
        } finally {
            saveButton.disabled = false;
        }
    }

    async function createSaveDialogFolder(windowEl) {
        const row = windowEl.querySelector(".office-new-folder-row");
        const input = windowEl.querySelector(".office-new-folder-name");
        if (!row || !input) return;
        const name = sanitizeFileName(input.value);
        if (!name) {
            setSaveDialogError(windowEl, "Enter a folder name.");
            input.focus();
            return;
        }

        const path = joinPath(saveDialogPath, name);
        try {
            if (await window.SystemFS.readFile(path)) {
                setSaveDialogError(windowEl, "A file or folder already uses that name.");
                return;
            }
            await window.SystemFS.ensureDirectory(path);
            input.value = "";
            row.hidden = true;
            resetSaveDialogConfirmation(windowEl);
            await renderSaveDirectory(windowEl);
        } catch (error) {
            console.error("Folder creation failed:", error);
            setSaveDialogError(windowEl, error.message || "The folder could not be created.");
        }
    }

    async function openSaveDialog(windowEl) {
        const overlay = windowEl.querySelector(".office-save-overlay");
        const input = windowEl.querySelector(".office-save-name");
        if (!overlay || !input) return;

        const spec = getSaveSpec();
        saveDialogPath = officeState.currentFile?.parent || "/documents";
        input.value = officeState.currentFile?.name || spec.defaultName;
        overlay.hidden = false;
        resetSaveDialogConfirmation(windowEl);
        await renderSaveDirectory(windowEl);
        input.focus({ preventScroll: true });
        input.select();
    }

    // Save active document back to SystemFS. Unsaved files use the in-app picker.
    async function saveActiveOfficeFile(windowEl) {
        if (officeState.activeView === "dashboard") return;
        if (!officeState.currentFile?.path) {
            await openSaveDialog(windowEl);
            return;
        }

        try {
            await writeActiveOfficeFile(
                windowEl,
                officeState.currentFile.path,
                officeState.currentFile.name,
                officeState.currentFile.parent
            );
        } catch (error) {
            console.error("Save failed:", error);
            window.showDesktopToast?.(error.message || "The file could not be saved.");
        }
    }

    // Create a new blank template file
    function createNewFile(windowEl, type) {
        officeState.currentFile = null;
        if (type === "writer") {
            const page = windowEl.querySelector(".writer-page");
            if (page) page.innerHTML = "<p>Start writing document here...</p>";
            updateActiveView(windowEl, "writer");
        } else if (type === "calc") {
            officeState.activeSheet = "Sheet1";
            officeState.sheets = { "Sheet1": {} };
            updateActiveView(windowEl, "calc");
        }
    }

    // Render the grid area for Calc
    function renderSpreadsheetGrid(windowEl) {
        const gridWrapper = windowEl.querySelector(".calc-grid-wrapper");
        if (!gridWrapper) return;

        let html = `<table class="calc-table">`;
        
        // 1. Column headers (Corner A B C D...)
        html += `<thead><tr><th class="corner-header"></th>`;
        COLUMNS.forEach(col => {
            html += `<th class="col-header" style="width: 5rem;">${col}</th>`;
        });
        html += `</tr></thead><tbody>`;

        // 2. Rows
        ROWS.forEach(row => {
            html += `<tr><th class="row-header">${row}</th>`;
            COLUMNS.forEach(col => {
                const cellRef = col + row;
                const sheet = officeState.sheets[officeState.activeSheet] || {};
                const cell = sheet[cellRef] || {};
                const displayVal = cell.display !== undefined ? cell.display : (cell.raw || "");
                
                let classes = [];
                if (cell.bold) classes.push("bold-cell");
                if (cell.italic) classes.push("italic-cell");
                if (cell.align) classes.push("align-" + cell.align);
                if (officeState.activeCell === cellRef) classes.push("selected");
                
                const styleClass = classes.join(" ");

                html += `
                    <td id="calc-cell-${cellRef}" class="${styleClass}" data-cell="${cellRef}">
                        <div class="calc-cell-display">${window.escapeHtml ? window.escapeHtml(displayVal) : displayVal}</div>
                    </td>
                `;
            });
            html += `</tr>`;
        });
        
        html += `</tbody></table>`;
        gridWrapper.innerHTML = html;

        // Attach click cell selector
        gridWrapper.querySelectorAll(".calc-table td").forEach(td => {
            td.addEventListener("mousedown", (e) => {
                const cellRef = td.dataset.cell;
                selectCalcCell(windowEl, cellRef);
            });

            // Double click to inline edit
            td.addEventListener("dblclick", () => {
                const cellRef = td.dataset.cell;
                beginInlineCellEdit(windowEl, td, cellRef);
            });
        });
    }

    // Selected cell event handler
    function selectCalcCell(windowEl, cellRef) {
        const oldActive = officeState.activeCell;
        officeState.activeCell = cellRef;

        const sheet = officeState.sheets[officeState.activeSheet] || {};
        const cell = sheet[cellRef] || {};

        // Highlight selected in HTML
        if (oldActive) {
            const prevTd = windowEl.querySelector(`#calc-cell-${oldActive}`);
            if (prevTd) prevTd.classList.remove("selected");
        }
        const currTd = windowEl.querySelector(`#calc-cell-${cellRef}`);
        if (currTd) currTd.classList.add("selected");

        // Update Formula Bar UI
        const addressEl = windowEl.querySelector(".calc-cell-address");
        const formulaInput = windowEl.querySelector(".calc-formula-input");
        if (addressEl) addressEl.textContent = cellRef;
        if (formulaInput) formulaInput.value = cell.raw || "";

        // Highlight ribbon state styling for active cell
        const btnBold = windowEl.querySelector(".btn-calc-bold");
        const btnItalic = windowEl.querySelector(".btn-calc-italic");
        btnBold?.classList.toggle("active", !!cell.bold);
        btnItalic?.classList.toggle("active", !!cell.italic);
    }

    // Inline edit cell input
    function beginInlineCellEdit(windowEl, tdEl, cellRef) {
        const sheet = officeState.sheets[officeState.activeSheet] || {};
        const cell = sheet[cellRef] || {};
        
        const displayDiv = tdEl.querySelector(".calc-cell-display");
        if (!displayDiv) return;

        const input = document.createElement("input");
        input.className = "calc-cell-editor";
        input.value = cell.raw || "";
        tdEl.appendChild(input);
        input.focus();
        input.select();

        let finished = false;
        function finishEdit() {
            if (finished) return;
            finished = true;
            
            const newVal = input.value.trim();
            saveCellData(windowEl, cellRef, newVal);
            input.remove();
        }

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                finishEdit();
                // Move cell down on Enter
                const colLetter = cellRef.match(/[A-Z]+/)[0];
                const rowNum = parseInt(cellRef.match(/[0-9]+/)[0]);
                if (rowNum < ROWS.length) {
                    selectCalcCell(windowEl, colLetter + (rowNum + 1));
                }
            } else if (e.key === "Escape") {
                finished = true;
                input.remove();
            }
        });

        input.addEventListener("blur", () => {
            finishEdit();
        });
    }

    // Update single cell database values
    function saveCellData(windowEl, cellRef, rawValue) {
        const sheet = officeState.sheets[officeState.activeSheet] || {};
        if (!sheet[cellRef]) sheet[cellRef] = {};
        
        sheet[cellRef].raw = rawValue;
        
        // Recompute formulas
        recalculateCalcSheet();
        
        // Redraw grid
        renderSpreadsheetGrid(windowEl);
        
        // Update formula input bar in case it was modified inline
        if (officeState.activeCell === cellRef) {
            const formulaInput = windowEl.querySelector(".calc-formula-input");
            if (formulaInput) formulaInput.value = rawValue;
        }
    }

    // Save styling parameters of spreadsheet cells
    function applyCalcCellFormat(windowEl, styleProp, value) {
        if (!officeState.activeCell) return;
        const cellRef = officeState.activeCell;
        const sheet = officeState.sheets[officeState.activeSheet] || {};
        if (!sheet[cellRef]) sheet[cellRef] = {};

        if (styleProp === "bold") {
            sheet[cellRef].bold = !sheet[cellRef].bold;
        } else if (styleProp === "italic") {
            sheet[cellRef].italic = !sheet[cellRef].italic;
        } else if (styleProp === "align") {
            sheet[cellRef].align = value;
        }

        renderSpreadsheetGrid(windowEl);
        selectCalcCell(windowEl, cellRef);
    }

    // Register modular app hooks
    window.appRegistry[APP_ID] = {
        title: "LibreOffice WASM",
        icon: "fa-solid fa-file-signature",
        windowClass: "office-window document-window",
        renderBody: () => `
            <div class="office-shell">
                <!-- WASM BOOT SPLASH SCREEN -->
                <div class="office-splash">
                    <div class="office-splash-logo">
                        <i class="fa-solid fa-file-signature"></i>
                        <h1>LibreOffice <span>WebAssembly</span></h1>
                    </div>
                    <div class="office-splash-card">
                        <div class="office-splash-progress-wrapper">
                            <div class="office-splash-progress-bar"></div>
                        </div>
                        <div class="office-splash-log"></div>
                    </div>
                </div>

                <!-- APPLICATION TOP BANNER (Header & Ribbon Menu) -->
                <header class="office-header" style="display: none;">
                    <div class="office-menubar">
                        <div class="office-menu-logo btn-menubar-dashboard">
                            <i class="fa-solid fa-file-signature"></i>
                            <span>LibreOffice WASM</span>
                        </div>
                        <div class="office-menubar-item btn-menubar-save"><i class="fa-regular fa-floppy-disk"></i> Save</div>
                        <div class="office-menubar-item btn-menubar-dashboard"><i class="fa-solid fa-house"></i> Close to Dashboard</div>
                    </div>

                    <!-- Dynamic app-centric Ribbon bar -->
                    <div class="office-toolbar">
                        <div class="office-toolbar-group">
                            <button type="button" class="office-tool-btn btn-toolbar-save" title="Save file to virtual drive">
                                <i class="fa-solid fa-floppy-disk"></i> Save
                            </button>
                            <span class="office-tool-separator"></span>
                        </div>

                        <!-- Writer Tools Ribbon -->
                        <div class="office-toolbar-group writer-tools" style="display: none;">
                            <button type="button" class="office-tool-btn btn-writer-bold" title="Bold text">
                                <i class="fa-solid fa-bold"></i>
                            </button>
                            <button type="button" class="office-tool-btn btn-writer-italic" title="Italic text">
                                <i class="fa-solid fa-italic"></i>
                            </button>
                            <button type="button" class="office-tool-btn btn-writer-underline" title="Underline text">
                                <i class="fa-solid fa-underline"></i>
                            </button>
                            <span class="office-tool-separator"></span>
                            
                            <!-- Font Family Select -->
                            <select class="office-tool-select select-writer-font" title="Font Family">
                                <option value="Georgia, serif">Georgia (Serif)</option>
                                <option value="'Inter', sans-serif" selected>Inter (Sans)</option>
                                <option value="'JetBrains Mono', monospace">JetBrains Mono (Monospace)</option>
                                <option value="cursive">Cursive</option>
                            </select>

                            <!-- Font Size -->
                            <select class="office-tool-select select-writer-size" title="Font Size">
                                <option value="1">10px</option>
                                <option value="2">12px</option>
                                <option value="3" selected>14px</option>
                                <option value="4">16px</option>
                                <option value="5">18px</option>
                                <option value="6">24px</option>
                                <option value="7">32px</option>
                            </select>
                            
                            <span class="office-tool-separator"></span>
                            
                            <!-- Forecolor (Text color) -->
                            <div class="office-color-picker-wrapper">
                                <button type="button" class="office-tool-btn" title="Text color">
                                    <i class="fa-solid fa-font" style="border-bottom: 3px solid #000;"></i>
                                </button>
                                <input type="color" class="input-writer-color" value="#000000">
                            </div>

                            <span class="office-tool-separator"></span>

                            <!-- Text Alignment -->
                            <button type="button" class="office-tool-btn btn-writer-align-left" title="Align Left">
                                <i class="fa-solid fa-align-left"></i>
                            </button>
                            <button type="button" class="office-tool-btn btn-writer-align-center" title="Align Center">
                                <i class="fa-solid fa-align-center"></i>
                            </button>
                            <button type="button" class="office-tool-btn btn-writer-align-right" title="Align Right">
                                <i class="fa-solid fa-align-right"></i>
                            </button>
                            
                            <span class="office-tool-separator"></span>
                            <button type="button" class="office-tool-btn btn-writer-dark-page" title="Toggle dark mode page">
                                <i class="fa-solid fa-circle-half-stroke"></i> Page Mode
                            </button>
                        </div>

                        <!-- Calc Tools Ribbon -->
                        <div class="office-toolbar-group calc-tools" style="display: none;">
                            <button type="button" class="office-tool-btn btn-calc-bold" title="Bold cell text">
                                <i class="fa-solid fa-bold"></i>
                            </button>
                            <button type="button" class="office-tool-btn btn-calc-italic" title="Italic cell text">
                                <i class="fa-solid fa-italic"></i>
                            </button>
                            <span class="office-tool-separator"></span>
                            
                            <button type="button" class="office-tool-btn btn-calc-align-left" title="Align cell Left">
                                <i class="fa-solid fa-align-left"></i>
                            </button>
                            <button type="button" class="office-tool-btn btn-calc-align-center" title="Align cell Center">
                                <i class="fa-solid fa-align-center"></i>
                            </button>
                            <button type="button" class="office-tool-btn btn-calc-align-right" title="Align cell Right">
                                <i class="fa-solid fa-align-right"></i>
                            </button>

                            <span class="office-tool-separator"></span>
                            <div style="font-size: 0.72rem; color: var(--office-text-muted);">
                                Formulas: <code style="color: #60a5fa;">=SUM(A1:A5)</code>, <code style="color: #60a5fa;">=A1*B1</code>
                            </div>
                        </div>

                        <div></div> <!-- Flex space -->
                    </div>
                </header>

                <!-- WORKSPACE PANELS -->
                <div class="office-workspace">
                    
                    <!-- 1. OFFICE DASHBOARD VIEW -->
                    <div class="office-dashboard office-screen">
                        <aside class="office-dashboard-sidebar">
                            <div>
                                <h3>Create New File</h3>
                                <button type="button" class="dashboard-nav-btn btn-new-doc-action">
                                    <i class="fa-solid fa-file-word" style="color: #3b82f6;"></i> Text Document (.odt)
                                </button>
                                <button type="button" class="dashboard-nav-btn btn-new-calc-action">
                                    <i class="fa-solid fa-file-excel" style="color: #10b981;"></i> Spreadsheet (.ods)
                                </button>
                            </div>
                            
                            <div class="dashboard-storage-status">
                                <div class="dashboard-storage-header">
                                    <strong><i class="fa-solid fa-hard-drive"></i> Local storage</strong>
                                    <span class="status-dot"></span>
                                </div>
                                <p>Documents save to <code>/documents</code> in this browser.</p>
                                <button type="button" class="dashboard-nav-btn" data-open-settings-panel="cloud-sync">
                                    <i class="fa-solid fa-cloud-arrow-up"></i> Cloud Sync Settings
                                </button>
                            </div>
                        </aside>
                        
                        <main class="office-dashboard-main">
                            <div class="office-dashboard-title">
                                <h2>OpenOffice.org / LibreOffice WebAssembly</h2>
                                <p>Edit office productivity documents client-side inside a sandboxed Emscripten container.</p>
                            </div>

                            <div class="office-templates-section">
                                <h3 style="font-size: 0.85rem; text-transform: uppercase; color: var(--office-text-muted); margin-bottom: 0.75rem;">New Templates</h3>
                                <div class="office-templates-grid">
                                    <div class="office-template-card writer btn-new-doc-action">
                                        <div class="office-template-icon"><i class="fa-solid fa-file-word"></i></div>
                                        <div class="office-template-info">
                                            <strong>Writer Document</strong>
                                            <span>Text document (.odt)</span>
                                        </div>
                                    </div>
                                    <div class="office-template-card calc btn-new-calc-action">
                                        <div class="office-template-icon"><i class="fa-solid fa-file-excel"></i></div>
                                        <div class="office-template-info">
                                            <strong>Calc Spreadsheet</strong>
                                            <span>Tabular calculations (.ods)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="office-recent-section">
                                <h3 style="font-size: 0.85rem; text-transform: uppercase; color: var(--office-text-muted); margin-bottom: 0.75rem;">Recent Documents</h3>
                                <div class="recent-docs-list-container">
                                    <!-- Rendered dynamically -->
                                </div>
                            </div>
                        </main>
                    </div>

                    <!-- 2. WRITER (WORD PROCESSOR) MAIN VIEW -->
                    <div class="writer-container office-screen" hidden>
                        <div class="writer-canvas">
                            <div class="writer-page" contenteditable="true" spellcheck="true" tabindex="0">
                                <p>Start writing document here...</p>
                            </div>
                        </div>
                    </div>

                    <!-- 3. CALC (SPREADSHEET) MAIN VIEW -->
                    <div class="calc-container office-screen" hidden>
                        <div class="calc-formula-bar">
                            <span class="calc-cell-address">A1</span>
                            <span class="calc-formula-fx">fx</span>
                            <input type="text" class="calc-formula-input" placeholder="Enter cell value or formula (e.g. =SUM(A1:A5))" spellcheck="false" />
                        </div>
                        <div class="calc-grid-wrapper">
                            <!-- Populated dynamically -->
                        </div>
                        <div class="calc-tabs-bar">
                            <div class="calc-tab-item active"><i class="fa-solid fa-table"></i> Sheet1</div>
                            <div class="calc-tab-add" title="Add sheet"><i class="fa-solid fa-plus"></i></div>
                        </div>
                    </div>

                </div>

                <!-- SYSTEMFS SAVE AS DIALOG -->
                <div class="office-save-overlay" hidden>
                    <section class="office-save-dialog" role="dialog" aria-modal="true" aria-labelledby="office-save-title">
                        <header class="office-save-dialog-header">
                            <div>
                                <span class="office-save-dialog-icon"><i class="fa-solid fa-floppy-disk"></i></span>
                                <div>
                                    <h2 id="office-save-title">Save As</h2>
                                    <p>Choose a folder in local SystemFS.</p>
                                </div>
                            </div>
                            <button type="button" class="office-save-icon-btn office-save-close" title="Close" aria-label="Close Save As dialog">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </header>

                        <div class="office-save-browser-toolbar">
                            <button type="button" class="office-save-icon-btn office-save-up" title="Up one folder" aria-label="Up one folder">
                                <i class="fa-solid fa-arrow-up"></i>
                            </button>
                            <nav class="office-save-breadcrumbs" aria-label="Save location"></nav>
                            <button type="button" class="office-save-new-folder" title="Create folder">
                                <i class="fa-solid fa-folder-plus"></i><span>New folder</span>
                            </button>
                        </div>

                        <div class="office-new-folder-row" hidden>
                            <input type="text" class="office-new-folder-name" placeholder="Folder name" autocomplete="off" />
                            <button type="button" class="office-save-create-folder">Create</button>
                            <button type="button" class="office-save-cancel-folder" aria-label="Cancel folder creation"><i class="fa-solid fa-xmark"></i></button>
                        </div>

                        <div class="office-save-folder-list" role="list"></div>

                        <footer class="office-save-dialog-footer">
                            <div class="office-save-location-row">
                                <i class="fa-solid fa-folder-open"></i>
                                <span>Location</span>
                                <code class="office-save-location">/documents</code>
                            </div>
                            <label class="office-save-name-row">
                                <span>File name</span>
                                <input type="text" class="office-save-name" autocomplete="off" spellcheck="false" />
                            </label>
                            <p class="office-save-error" role="alert" hidden></p>
                            <div class="office-save-actions">
                                <button type="button" class="office-save-secondary office-save-cancel">Cancel</button>
                                <button type="button" class="office-save-primary office-save-confirm"><i class="fa-solid fa-floppy-disk"></i> Save</button>
                            </div>
                        </footer>
                    </section>
                </div>

                <!-- OFFICE BOTTOM STATUS BAR -->
                <footer class="office-statusbar">
                    <span class="office-storage-status-badge"><i class="fa-solid fa-hard-drive"></i> Saved locally in IndexedDB</span>
                    <div class="office-statusbar-right">
                        <span class="office-doc-stats-badge">Words: 0 | Chars: 0</span>
                        <span>Thread Count: 4</span>
                        <span class="office-wasm-badge">WASM 32-bit</span>
                        <span>Mem: 128MB</span>
                    </div>
                </footer>
            </div>
        `,
        onOpen: (windowEl) => {
            // Load recent documents
            loadRecentDocs();

            // Run Simulated WASM compile bootloader
            bootOfficeWasm(windowEl, () => {
                // If loaded with a file item passed in parameters, open it
                if (windowEl.launchParams) {
                    loadOfficeFile(windowEl, windowEl.launchParams);
                    windowEl.launchParams = null; // Clear
                } else {
                    updateActiveView(windowEl, "dashboard");
                }
            });

            if (windowEl.dataset.officeInitialized === "1") return;
            windowEl.dataset.officeInitialized = "1";

            // Attach Custom event listener for external double-click file launches
            windowEl.addEventListener("launch-params", (e) => {
                if (officeState.isWasmBooted && e.detail) {
                    loadOfficeFile(windowEl, e.detail);
                    windowEl.launchParams = null;
                }
            });

            // 1. Dashboard View Action Bindings
            windowEl.querySelectorAll(".btn-new-doc-action").forEach(btn => {
                btn.addEventListener("click", () => createNewFile(windowEl, "writer"));
            });
            windowEl.querySelectorAll(".btn-new-calc-action").forEach(btn => {
                btn.addEventListener("click", () => createNewFile(windowEl, "calc"));
            });

            // 2. Toolbar & Menu Actions
            windowEl.querySelectorAll(".btn-menubar-dashboard").forEach(btn => {
                btn.addEventListener("click", () => updateActiveView(windowEl, "dashboard"));
            });

            const handleSave = () => saveActiveOfficeFile(windowEl);
            windowEl.querySelectorAll(".btn-menubar-save").forEach(btn => btn.addEventListener("click", handleSave));
            windowEl.querySelectorAll(".btn-toolbar-save").forEach(btn => btn.addEventListener("click", handleSave));

            // SystemFS Save As dialog actions
            const saveOverlay = windowEl.querySelector(".office-save-overlay");
            const saveNameInput = windowEl.querySelector(".office-save-name");
            const newFolderRow = windowEl.querySelector(".office-new-folder-row");
            const newFolderInput = windowEl.querySelector(".office-new-folder-name");

            windowEl.querySelector(".office-save-close")?.addEventListener("click", () => closeSaveDialog(windowEl));
            windowEl.querySelector(".office-save-cancel")?.addEventListener("click", () => closeSaveDialog(windowEl));
            windowEl.querySelector(".office-save-confirm")?.addEventListener("click", () => commitSaveDialog(windowEl));
            windowEl.querySelector(".office-save-up")?.addEventListener("click", () => {
                if (saveDialogPath === "/") return;
                saveDialogPath = window.SystemFS.getParentPath(saveDialogPath);
                resetSaveDialogConfirmation(windowEl);
                renderSaveDirectory(windowEl);
            });
            windowEl.querySelector(".office-save-new-folder")?.addEventListener("click", () => {
                if (!newFolderRow || !newFolderInput) return;
                newFolderRow.hidden = false;
                setSaveDialogError(windowEl);
                newFolderInput.focus({ preventScroll: true });
            });
            windowEl.querySelector(".office-save-cancel-folder")?.addEventListener("click", () => {
                if (newFolderRow) newFolderRow.hidden = true;
                if (newFolderInput) newFolderInput.value = "";
                setSaveDialogError(windowEl);
            });
            windowEl.querySelector(".office-save-create-folder")?.addEventListener("click", () => createSaveDialogFolder(windowEl));
            saveNameInput?.addEventListener("input", () => resetSaveDialogConfirmation(windowEl));
            saveNameInput?.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    commitSaveDialog(windowEl);
                }
            });
            newFolderInput?.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    createSaveDialogFolder(windowEl);
                }
            });
            saveOverlay?.addEventListener("click", (event) => {
                if (event.target === saveOverlay) closeSaveDialog(windowEl);
            });
            saveOverlay?.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    closeSaveDialog(windowEl);
                }
            });

            // 3. Writer Tooling Ribbons
            windowEl.querySelector(".btn-writer-bold").addEventListener("click", () => {
                document.execCommand("bold");
                windowEl.querySelector(".btn-writer-bold").classList.toggle("active");
            });
            windowEl.querySelector(".btn-writer-italic").addEventListener("click", () => {
                document.execCommand("italic");
                windowEl.querySelector(".btn-writer-italic").classList.toggle("active");
            });
            windowEl.querySelector(".btn-writer-underline").addEventListener("click", () => {
                document.execCommand("underline");
                windowEl.querySelector(".btn-writer-underline").classList.toggle("active");
            });

            // Font Name selection
            windowEl.querySelector(".select-writer-font").addEventListener("change", (e) => {
                document.execCommand("fontName", false, e.target.value);
            });

            // Font Size selection
            windowEl.querySelector(".select-writer-size").addEventListener("change", (e) => {
                document.execCommand("fontSize", false, e.target.value);
            });

            // Forecolor text picking
            windowEl.querySelector(".input-writer-color").addEventListener("change", (e) => {
                document.execCommand("foreColor", false, e.target.value);
            });

            // Writer Alignments
            windowEl.querySelector(".btn-writer-align-left").addEventListener("click", () => document.execCommand("justifyLeft"));
            windowEl.querySelector(".btn-writer-align-center").addEventListener("click", () => document.execCommand("justifyCenter"));
            windowEl.querySelector(".btn-writer-align-right").addEventListener("click", () => document.execCommand("justifyRight"));

            // Writer Toggle Dark Mode Page styling
            windowEl.querySelector(".btn-writer-dark-page").addEventListener("click", () => {
                officeState.writerDarkModePage = !officeState.writerDarkModePage;
                const page = windowEl.querySelector(".writer-page");
                page.classList.toggle("dark-page", officeState.writerDarkModePage);
                windowEl.querySelector(".btn-writer-dark-page").classList.toggle("active", officeState.writerDarkModePage);
            });

            // Writer Word Stats count binding
            const writerPage = windowEl.querySelector(".writer-page");
            const statTextBadge = windowEl.querySelector(".office-doc-stats-badge");
            
            function updateWordCount() {
                if (officeState.activeView !== "writer" || !writerPage) return;
                const text = writerPage.innerText || "";
                const chars = text.length;
                const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
                if (statTextBadge) statTextBadge.textContent = `Words: ${words} | Chars: ${chars}`;
            }

            writerPage.addEventListener("input", updateWordCount);
            writerPage.addEventListener("keyup", updateWordCount);

            // 4. Calc Tooling Ribbons
            windowEl.querySelector(".btn-calc-bold").addEventListener("click", () => {
                applyCalcCellFormat(windowEl, "bold");
            });
            windowEl.querySelector(".btn-calc-italic").addEventListener("click", () => {
                applyCalcCellFormat(windowEl, "italic");
            });
            windowEl.querySelector(".btn-calc-align-left").addEventListener("click", () => {
                applyCalcCellFormat(windowEl, "align", "left");
            });
            windowEl.querySelector(".btn-calc-align-center").addEventListener("click", () => {
                applyCalcCellFormat(windowEl, "align", "center");
            });
            windowEl.querySelector(".btn-calc-align-right").addEventListener("click", () => {
                applyCalcCellFormat(windowEl, "align", "right");
            });

            // Formula bar inputs key triggers
            const formulaInput = windowEl.querySelector(".calc-formula-input");
            formulaInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && officeState.activeCell) {
                    saveCellData(windowEl, officeState.activeCell, formulaInput.value);
                    formulaInput.blur();
                }
            });
        },
        onClose: (windowEl) => {
            cancelOfficeBoot();
            closeSaveDialog(windowEl);
            // reset state
            officeState.activeCell = null;
            officeState.currentFile = null;
            windowEl.dataset.officeInitialized = "";
        }
    };
})();
