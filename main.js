/**
 * PortfoliOS: System Bootstrap Entry Point
 * Listens for DOMContentLoaded and invokes the core boot orchestrator.
 */
window.addEventListener("DOMContentLoaded", () => {
    // Register Service Worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", (event) => {
            const data = event.data || {};
            if (data.source !== "portfolio-service-worker" || data.type !== "system-log") return;
            const level = data.level === "error" ? "error" : data.level === "warning" ? "warning" : "info";
            window.addSystemLog?.(level, data.message || "Service Worker message", data.detail || null);
        });

        navigator.serviceWorker.register("/sw.js?v=1.1.15")
            .then((reg) => console.log("PortfoliOS: Service Worker registered. Scope:", reg.scope))
            .catch((err) => console.warn("PortfoliOS: Service Worker registration failed:", err));
    }

    if (window.boot) {
        window.boot();
    } else {
        console.error("PortfoliOS: Core boot function not found.");
    }
});
