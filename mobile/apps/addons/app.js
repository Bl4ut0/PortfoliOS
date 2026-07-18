(function() {
    window.mobileAppRegistry.addons = {
        title: "Addons",
        icon: "fa-solid fa-wand-magic-sparkles",
        viewClass: "mobile-addons-app",
        render: () => window.renderMobileProjectCard("addons", {
            eyebrow: "WoW engineering",
            signalLabel: "Release channel"
        })
    };
})();
