/**
 * PortfoliOS: System Bootstrap Entry Point
 * Listens for DOMContentLoaded and invokes the core boot orchestrator.
 */
window.addEventListener("DOMContentLoaded", () => {
    if (window.boot) {
        window.boot();
    } else {
        console.error("PortfoliOS: Core boot function not found.");
    }
});
