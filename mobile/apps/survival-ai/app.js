(function() {
    window.mobileAppRegistry["survival-ai"] = {
        title: "Survival AI",
        icon: "fa-solid fa-brain",
        viewClass: "mobile-survival-ai-app",
        render: () => window.renderMobileProjectCard("survival-ai", {
            eyebrow: "Local-first research",
            signalLabel: "Research track"
        })
    };
})();
