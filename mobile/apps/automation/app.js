(function() {
    window.mobileAppRegistry.automation = {
        title: "Automation",
        icon: "fa-solid fa-gears",
        viewClass: "mobile-automation-app",
        render: () => window.renderMobileProjectCard("automation", {
            eyebrow: "Workflow engine",
            signalLabel: "Automation signal"
        })
    };
})();
