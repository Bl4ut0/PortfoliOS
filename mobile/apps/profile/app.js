(function () {
  const esc = (value) => window.PortfolioOSMobileFramework.escapeHtml(value);
  function refresh(root) {
    const user = window.getCurrentUser?.();
    root.querySelector("[data-identity-name]").textContent =
      user?.displayName || "Public profile";
    root.querySelector("[data-identity-meta]").textContent = user?.handle || "";
    root.querySelector("[data-identity-status]").textContent =
      window.getAssistantSessionStatus?.() || "";
    window.setProfileAvatar?.(
      root.querySelector("img"),
      user?.avatar,
      "Profile picture",
    );
  }
  window.mobileAppRegistry.profile = {
    title: "Identity",
    icon: "fa-solid fa-id-card",
    viewClass: "mobile-profile-app",
    render: () =>
      '<img alt="Profile picture"><h2 data-identity-name></h2><p data-identity-meta></p><p data-identity-status></p><button type="button" data-identity-settings>Account &amp; Drive settings</button>',
    onOpen: (root, { signal } = {}) => {
      refresh(root);
      root.addEventListener(
        "click",
        (event) => {
          if (event.target.closest("[data-identity-settings]"))
            window.MobileOS.openApp("settings");
        },
        { signal },
      );
    },
    onResume: refresh,
  };
})();
