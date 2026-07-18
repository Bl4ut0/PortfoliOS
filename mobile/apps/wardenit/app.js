(function() {
    window.mobileAppRegistry.wardenit = {
        title: "WardenIT",
        icon: "fa-solid fa-briefcase",
        viewClass: "mobile-wardenit-app",
        render: () => window.renderMobileProjectCard("wardenit", {
            eyebrow: "Professional dossier",
            signalLabel: "Experience signal"
        })
    };
})();
