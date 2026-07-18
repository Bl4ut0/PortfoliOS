(function() {
    window.mobileAppRegistry.homelab = {
        title: "Home Lab",
        icon: "fa-solid fa-server",
        viewClass: "mobile-homelab-app",
        render: () => window.renderMobileProjectCard("homelab", {
            eyebrow: "Infrastructure",
            heading: "Connected Lab",
            signalLabel: "Operator signal"
        })
    };
})();
