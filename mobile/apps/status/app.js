(function() {
    window.mobileAppRegistry.status = {
        title: "Status",
        icon: "fa-solid fa-signal",
        viewClass: "mobile-status-app",
        render: () => window.renderMobileProjectCard("status", {
            eyebrow: "Service health",
            heading: "Status Console",
            signalLabel: "Availability"
        })
    };
})();
