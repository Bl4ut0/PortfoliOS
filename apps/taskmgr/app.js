(function() {
    let statsInterval = null;
    let cpuHistory = Array(30).fill(10); // Start with some initial history data
    let startTime = Date.now();

    // Map of apps to their simulated memory footprints (in MB)
    const APP_MEM_FOOTPRINT = {
        doomsource: 128,
        diablo: 256,
        quake: 180,
        duke32: 160,
        files: 15,
        webamp: 12,
        browser: 45,
        store: 20,
        cli: 8,
        taskmgr: 12,
        profile: 10,
        dossier: 10,
        network: 8,
        linux: 14,
        settings: 5
    };

    function formatUptime() {
        const diffMs = Date.now() - startTime;
        const diffSecs = Math.floor(diffMs / 1000);
        const hrs = Math.floor(diffSecs / 3600);
        const mins = Math.floor((diffSecs % 3600) / 60);
        const secs = diffSecs % 60;
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function calculateSystemMetrics() {
        const openApps = Array.from(state.openApps || []);
        let totalMem = 55; // Base OS memory

        const processList = [{
            id: "system_kernel",
            name: "System Kernel",
            status: "Running",
            memory: 55,
            isSystem: true
        }];

        openApps.forEach(appId => {
            const mem = APP_MEM_FOOTPRINT[appId] || 10;
            totalMem += mem;

            const isMinimized = state.minimizedApps?.has(appId);
            const status = isMinimized ? "Minimized" : (state.activeWindow === appId ? "Active" : "Background");

            // Look up human-friendly title from desktopApps registry
            const appDef = window.desktopApps?.find(a => a.id === appId);
            const title = appDef ? appDef.title : appId;

            processList.push({
                id: appId,
                name: title,
                status: status,
                memory: mem,
                isSystem: false
            });
        });

        // Fluctuations
        const cpuUsage = Math.min(100, Math.max(2, Math.floor(Math.random() * 12) + (openApps.length * 3)));
        
        return {
            totalMem,
            memPercent: Math.min(100, Math.round((totalMem / 1024) * 100)),
            cpuUsage,
            processList
        };
    }

    function drawCpuGraph(windowEl, cpuUsage) {
        const svg = windowEl.querySelector(".taskmgr-cpu-chart svg");
        if (!svg) return;

        cpuHistory.push(cpuUsage);
        if (cpuHistory.length > 30) {
            cpuHistory.shift();
        }

        const width = 280;
        const height = 120;
        const padding = 10;
        const graphW = width - (padding * 2);
        const graphH = height - (padding * 2);

        // Map values to coordinates
        const points = cpuHistory.map((val, idx) => {
            const x = padding + (idx * (graphW / 29));
            const y = padding + graphH - (val * (graphH / 100));
            return `${x},${y}`;
        });

        const polyline = svg.querySelector("polyline");
        if (polyline) {
            polyline.setAttribute("points", points.join(" "));
        }
    }

    function updateUI(windowEl) {
        const metrics = calculateSystemMetrics();
        
        // Update dashboard counters
        const memPercentEl = windowEl.querySelector(".taskmgr-stat-mem-percent");
        const memTextEl = windowEl.querySelector(".taskmgr-stat-mem-text");
        const cpuPercentEl = windowEl.querySelector(".taskmgr-stat-cpu-percent");
        const uptimeEl = windowEl.querySelector(".taskmgr-uptime");

        if (memPercentEl) memPercentEl.textContent = `${metrics.memPercent}%`;
        if (memTextEl) memTextEl.textContent = `${metrics.totalMem} MB / 1024 MB`;
        if (cpuPercentEl) cpuPercentEl.textContent = `${metrics.cpuUsage}%`;
        if (uptimeEl) uptimeEl.textContent = formatUptime();

        // Update progress bar
        const memProgress = windowEl.querySelector(".taskmgr-progress-fill");
        if (memProgress) {
            memProgress.style.width = `${metrics.memPercent}%`;
            // Color adaptations
            if (metrics.memPercent > 80) {
                memProgress.style.backgroundColor = "var(--danger-color, #ef4444)";
            } else if (metrics.memPercent > 60) {
                memProgress.style.backgroundColor = "#f59e0b";
            } else {
                memProgress.style.backgroundColor = "var(--theme-accent, #34d399)";
            }
        }

        // Update Table Rows
        const tbody = windowEl.querySelector(".taskmgr-tbody");
        if (tbody) {
            tbody.innerHTML = metrics.processList.map(proc => `
                <tr data-process-id="${proc.id}">
                    <td>
                        <div class="proc-name-cell">
                            <i class="${proc.isSystem ? 'fa-solid fa-gears' : 'fa-solid fa-window-maximize'}"></i>
                            <span>${proc.name}</span>
                        </div>
                    </td>
                    <td><span class="status-indicator ${proc.status.toLowerCase()}">${proc.status}</span></td>
                    <td>${proc.memory} MB</td>
                    <td>
                        ${proc.isSystem 
                            ? '<span class="system-badge">System</span>' 
                            : `<button class="btn-end-task" data-kill="${proc.id}" title="Force terminate application">End Task</button>`
                        }
                    </td>
                </tr>
            `).join("");
        }

        // Draw CPU graph
        drawCpuGraph(windowEl, metrics.cpuUsage);
    }

    window.appRegistry.taskmgr = {
        title: "Task Manager",
        icon: "fa-solid fa-microchip",
        windowClass: "taskmgr-window",
        renderBody: () => `
            <div class="taskmgr-container">
                <nav class="taskmgr-tabs">
                    <button class="taskmgr-tab active" data-target="processes">
                        <i class="fa-solid fa-list"></i> Processes
                    </button>
                    <button class="taskmgr-tab" data-target="performance">
                        <i class="fa-solid fa-chart-line"></i> Performance
                    </button>
                </nav>

                <div class="taskmgr-tab-content active" data-tab="processes">
                    <div class="taskmgr-table-wrapper">
                        <table class="taskmgr-table">
                            <thead>
                                <tr>
                                    <th>Task / Process Name</th>
                                    <th>Status</th>
                                    <th>Memory</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody class="taskmgr-tbody">
                                <!-- Populated dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="taskmgr-tab-content" data-tab="performance">
                    <div class="taskmgr-perf-grid">
                        <div class="taskmgr-cpu-chart">
                            <span class="chart-label">CPU History (% Utilization)</span>
                            <svg width="280" height="120" class="svg-graph">
                                <!-- Grid Lines -->
                                <line x1="10" y1="10" x2="270" y2="10" stroke="rgba(255,255,255,0.07)" stroke-dasharray="2" />
                                <line x1="10" y1="40" x2="270" y2="40" stroke="rgba(255,255,255,0.07)" stroke-dasharray="2" />
                                <line x1="10" y1="70" x2="270" y2="70" stroke="rgba(255,255,255,0.07)" stroke-dasharray="2" />
                                <line x1="10" y1="100" x2="270" y2="100" stroke="rgba(255,255,255,0.07)" stroke-dasharray="2" />
                                
                                <polyline fill="none" stroke="var(--theme-primary, #22d3ee)" stroke-width="2.5" points="" />
                            </svg>
                        </div>
                        <div class="taskmgr-hardware-details">
                            <div class="hw-item">
                                <span>Processor:</span>
                                <strong>Simulated vCPU @ 3.40GHz</strong>
                            </div>
                            <div class="hw-item">
                                <span>Cores:</span>
                                <strong>8 Cores (16 Threads)</strong>
                            </div>
                            <div class="hw-item">
                                <span>Uptime:</span>
                                <strong class="taskmgr-uptime">--:--:--</strong>
                            </div>
                            <div class="hw-item">
                                <span>Virtual RAM:</span>
                                <strong>1.00 GB Web Buffer</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <footer class="taskmgr-footer">
                    <div class="taskmgr-global-stats">
                        <div class="stat-group">
                            <span class="label">CPU Usage</span>
                            <strong class="taskmgr-stat-cpu-percent">0%</strong>
                        </div>
                        <div class="stat-group">
                            <span class="label">Memory (RAM)</span>
                            <strong class="taskmgr-stat-mem-percent">0%</strong>
                            <small class="taskmgr-stat-mem-text">0 MB / 1024 MB</small>
                        </div>
                    </div>
                    <div class="taskmgr-actions">
                        <button class="btn-optimize-mem" title="Clear resources & close minimized applications">Optimize Memory</button>
                    </div>
                </footer>
            </div>
        `,

        onOpen: (windowEl) => {
            // Setup initial render
            updateUI(windowEl);

            // Interval to keep stats updating
            statsInterval = setInterval(() => {
                updateUI(windowEl);
            }, 1200);

            // Event listener: Tabs switching
            const tabs = windowEl.querySelectorAll(".taskmgr-tab");
            tabs.forEach(tab => {
                tab.addEventListener("click", () => {
                    tabs.forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");
                    
                    const target = tab.dataset.target;
                    windowEl.querySelectorAll(".taskmgr-tab-content").forEach(content => {
                        content.classList.toggle("active", content.dataset.tab === target);
                    });
                });
            });

            // Event delegation: End Task
            const tbody = windowEl.querySelector(".taskmgr-tbody");
            tbody.addEventListener("click", (event) => {
                const killBtn = event.target.closest("[data-kill]");
                if (!killBtn) return;
                
                const appId = killBtn.dataset.kill;
                if (window.closeDesktopWindow) {
                    window.closeDesktopWindow(appId);
                    if (window.showDesktopToast) {
                        const appDef = window.desktopApps?.find(a => a.id === appId);
                        const appName = appDef ? appDef.title : appId;
                        window.showDesktopToast(`Terminated process: ${appName}`);
                    }
                    updateUI(windowEl);
                }
            });

            // Optimize memory trigger
            const optimizeBtn = windowEl.querySelector(".btn-optimize-mem");
            optimizeBtn.addEventListener("click", () => {
                const minimized = Array.from(state.minimizedApps || []);
                let closedCount = 0;

                minimized.forEach(appId => {
                    // Prevent closing task manager itself or essential explorer
                    if (appId !== "taskmgr" && appId !== "files" && window.closeDesktopWindow) {
                        window.closeDesktopWindow(appId);
                        closedCount++;
                    }
                });

                // Clear files app cache if files registry exists
                if (window.SystemFS && typeof window.SystemFS.clearCache === "function") {
                    window.SystemFS.clearCache();
                }

                optimizeBtn.disabled = true;
                optimizeBtn.textContent = "Optimizing...";

                setTimeout(() => {
                    optimizeBtn.disabled = false;
                    optimizeBtn.textContent = "Optimize Memory";
                    if (window.showDesktopToast) {
                        window.showDesktopToast(closedCount > 0 
                            ? `Optimized! Closed ${closedCount} background task(s) and cleared caches.`
                            : "Memory optimized. Caches cleared successfully."
                        );
                    }
                    cpuHistory = Array(30).fill(5); // Temporarily drop CPU load display
                    updateUI(windowEl);
                }, 1000);
            });
        },

        onClose: () => {
            if (statsInterval) {
                clearInterval(statsInterval);
                statsInterval = null;
            }
        }
    };
})();
