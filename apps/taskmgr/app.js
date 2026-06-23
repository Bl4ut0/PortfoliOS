(function() {
    let statsInterval = null;
    let cpuHistory = Array(30).fill(10); // Start with some initial history data
    let startTime = Date.now();

    // Diagnostics metrics
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fps = 60;
    let latency = 0;
    let longTasksMs = 0;
    let lastSampleTime = performance.now();
    let rafId = null;
    let perfObserver = null;

    function startDiagnosticsLoop() {
        lastFrameTime = performance.now();
        frameCount = 0;
        longTasksMs = 0;
        lastSampleTime = performance.now();

        const tick = (now) => {
            frameCount++;
            const delta = now - lastFrameTime;
            lastFrameTime = now;

            const frameLatency = Math.max(0, delta - (1000 / 60));
            latency = (latency * 0.9) + (frameLatency * 0.1);

            const sampleDelta = now - lastSampleTime;
            if (sampleDelta >= 1000) {
                fps = Math.round((frameCount * 1000) / sampleDelta);
                frameCount = 0;
                lastSampleTime = now;
            }

            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        if (typeof PerformanceObserver !== "undefined") {
            try {
                perfObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        longTasksMs += entry.duration;
                    }
                });
                perfObserver.observe({ entryTypes: ["longtask"] });
            } catch (e) {
                console.warn("PerformanceObserver 'longtask' is not supported in this browser.");
            }
        }
    }

    function stopDiagnosticsLoop() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (perfObserver) {
            perfObserver.disconnect();
            perfObserver = null;
        }
    }

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

    function calculateSystemMetrics(windowEl) {
        const openApps = Array.from(state.openApps || []);
        const cores = navigator.hardwareConcurrency || 4;
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

        // Calculate CPU busy load based on performance diagnostics
        // Long Tasks duration in current sampling window (1200ms)
        const busyTimePercent = Math.min(100, Math.round((longTasksMs / 1200) * 100));
        // Reset longTasksMs accumulator for the next interval
        longTasksMs = 0;

        // Base CPU load based on open applications (weighted by cores)
        let baseCpu = 2; // idle load
        openApps.forEach(appId => {
            const isHeavy = ["doomsource", "diablo", "quake", "duke32"].includes(appId);
            baseCpu += isHeavy ? (40 / cores) : (5 / cores);
        });

        // Event loop latency factor
        // E.g., latency of 15ms adds Math.min(30, 15 * 2) = 30% load
        const latencyFactor = Math.min(35, latency * 2);

        // Combine all metrics: actual thread busy load, app base load, and event loop lag
        let cpuUsage = Math.round(baseCpu + busyTimePercent + latencyFactor);
        
        // Add a slight natural-looking jitter
        const jitter = Math.floor(Math.random() * 5) - 2;
        cpuUsage = Math.min(99, Math.max(1, cpuUsage + jitter));
        
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
            return { x, y };
        });

        const polyline = svg.querySelector("polyline");
        if (polyline) {
            polyline.setAttribute("points", points.map(p => `${p.x},${p.y}`).join(" "));
        }

        const path = svg.querySelector("path.chart-area");
        if (path && points.length > 0) {
            const bottomY = padding + graphH;
            const pathData = `M ${points[0].x} ${bottomY} ` + 
                             points.map(p => `L ${p.x} ${p.y}`).join(" ") + 
                             ` L ${points[points.length-1].x} ${bottomY} Z`;
            path.setAttribute("d", pathData);
        }
    }

    function updateUI(windowEl) {
        const metrics = calculateSystemMetrics(windowEl);
        
        // Update hardware cores readout
        const cores = navigator.hardwareConcurrency || 4;
        const physicalCores = Math.max(1, Math.floor(cores / 2));
        const coresEl = windowEl.querySelector(".taskmgr-hardware-cores");
        if (coresEl) {
            coresEl.textContent = `${physicalCores} Core${physicalCores > 1 ? 's' : ''} (${cores} Threads)`;
        }

        // Update real diagnostics readouts
        const fpsEl = windowEl.querySelector(".taskmgr-fps-value");
        if (fpsEl) fpsEl.textContent = `${fps} FPS`;

        const lagEl = windowEl.querySelector(".taskmgr-lag-value");
        if (lagEl) lagEl.textContent = `${Math.round(latency)} ms`;
        
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
                             <svg width="280" height="120" class="svg-graph" viewBox="0 0 280 120" preserveAspectRatio="none">
                                 <defs>
                                     <linearGradient id="cpu-grad" x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="0%" stop-color="var(--theme-primary, #22d3ee)" stop-opacity="0.32" />
                                         <stop offset="100%" stop-color="var(--theme-primary, #22d3ee)" stop-opacity="0.0" />
                                     </linearGradient>
                                 </defs>
                                 <!-- Grid Lines -->
                                 <line x1="10" y1="10" x2="270" y2="10" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2" />
                                 <line x1="10" y1="35" x2="270" y2="35" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2" />
                                 <line x1="10" y1="60" x2="270" y2="60" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2" />
                                 <line x1="10" y1="85" x2="270" y2="85" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2" />
                                 <line x1="10" y1="110" x2="270" y2="110" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2" />
                                 
                                 <!-- Vertical Grid Lines -->
                                 <line x1="53" y1="10" x2="53" y2="110" stroke="rgba(255,255,255,0.03)" stroke-dasharray="2" />
                                 <line x1="96" y1="10" x2="96" y2="110" stroke="rgba(255,255,255,0.03)" stroke-dasharray="2" />
                                 <line x1="139" y1="10" x2="139" y2="110" stroke="rgba(255,255,255,0.03)" stroke-dasharray="2" />
                                 <line x1="182" y1="10" x2="182" y2="110" stroke="rgba(255,255,255,0.03)" stroke-dasharray="2" />
                                 <line x1="225" y1="10" x2="225" y2="110" stroke="rgba(255,255,255,0.03)" stroke-dasharray="2" />
                                 
                                 <path class="chart-area" fill="url(#cpu-grad)" d="" />
                                 <polyline fill="none" stroke="var(--theme-primary, #22d3ee)" stroke-width="2" points="" />
                             </svg>
                         </div>
                         <div class="taskmgr-hardware-details">
                             <div class="hw-item">
                                 <span>Processor:</span>
                                 <strong>Simulated vCPU @ 3.40GHz</strong>
                             </div>
                              <div class="hw-item">
                                  <span>Cores:</span>
                                  <strong class="taskmgr-hardware-cores">-- Cores (-- Threads)</strong>
                              </div>
                              <div class="hw-item">
                                  <span>Uptime:</span>
                                  <strong class="taskmgr-uptime">--:--:--</strong>
                              </div>
                              <div class="hw-item">
                                  <span>Virtual RAM:</span>
                                  <strong>1.00 GB Web Buffer</strong>
                              </div>
                              <div class="hw-item">
                                  <span>Frame Rate:</span>
                                  <strong class="taskmgr-fps-value">-- FPS</strong>
                              </div>
                              <div class="hw-item">
                                  <span>Event Loop Lag:</span>
                                  <strong class="taskmgr-lag-value">-- ms</strong>
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
                              <div class="stat-value-row">
                                  <strong class="taskmgr-stat-mem-percent">0%</strong>
                                  <span class="taskmgr-stat-mem-text">0 MB / 1024 MB</span>
                              </div>
                          </div>
                     </div>
                     <div class="taskmgr-actions">
                         <button class="btn-optimize-mem" title="Clear resources & close minimized applications">
                             <i class="fa-solid fa-gauge-high"></i> Optimize Memory
                         </button>
                     </div>
                </footer>
            </div>
        `,

        onOpen: (windowEl) => {
            // Clean up any existing intervals/loops to prevent duplicates/leaks
            stopDiagnosticsLoop();
            if (statsInterval) {
                clearInterval(statsInterval);
                statsInterval = null;
            }

            // Start diagnostics loops
            startDiagnosticsLoop();

            // Setup initial render
            updateUI(windowEl);

            // Interval to keep stats updating
            statsInterval = setInterval(() => {
                updateUI(windowEl);
            }, 1200);

            // Guard event listeners so they are only bound once
            if (!windowEl.dataset.taskmgrInitialized) {
                windowEl.dataset.taskmgrInitialized = "true";

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
                    optimizeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Optimizing...';

                    setTimeout(() => {
                        optimizeBtn.disabled = false;
                        optimizeBtn.innerHTML = '<i class="fa-solid fa-gauge-high"></i> Optimize Memory';
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
            }
        },

        onClose: () => {
            // Stop diagnostics loops
            stopDiagnosticsLoop();

            if (statsInterval) {
                clearInterval(statsInterval);
                statsInterval = null;
            }
        }
    };
})();
