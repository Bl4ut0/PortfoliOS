(function() {
    window.mobileAppRegistry.devhub = {
        title: "Dev Hub",
        icon: "fa-solid fa-terminal",
        viewClass: "mobile-devhub-app",
        render: () => window.renderMobileProjectCard("devhub", {
            eyebrow: "Developer network",
            heading: "Bl4ut0.dev",
            signalLabel: "Live surface"
        })
    };
})();
