(function() {
    window.mobileAppRegistry.guildcraft = {
        title: "GuildCraft",
        icon: "fa-solid fa-cubes",
        viewClass: "mobile-guildcraft-app",
        render: () => window.renderMobileProjectCard("guildcraft", {
            eyebrow: "Community operations",
            signalLabel: "Build status"
        })
    };
})();
