(function () {
  const esc = (value) => window.PortfolioOSMobileFramework.escapeHtml(value);
  function refresh(root) {
    const systems = window.getVisibleSystems?.() || [];
    root.querySelector("[data-dossier-list]").innerHTML =
      systems
        .map((item) => {
          const target = (window.mobileAppCatalog || []).find(
            (app) => app.sourceId === item.id,
          );
          return (
            "<article><h3>" +
            esc(item.title) +
            "</h3><p>" +
            esc(item.summary || item.signal || "") +
            "</p>" +
            (target
              ? '<button type="button" data-dossier-open="' +
                esc(target.id) +
                '">Open project</button>'
              : "") +
            "</article>"
          );
        })
        .join("") ||
      "<p>No portfolio projects are available in this profile. Use Files and Documents for your personal workspace.</p>";
  }
  window.mobileAppRegistry.dossier = {
    title: "Dossier",
    icon: "fa-solid fa-folder-open",
    viewClass: "mobile-dossier-app",
    render: () =>
      "<h2>Project dossier</h2><p>Projects visible to the active account.</p><section data-dossier-list></section>",
    onOpen: (root, { signal } = {}) => {
      refresh(root);
      root.addEventListener(
        "click",
        (event) => {
          const button = event.target.closest("[data-dossier-open]");
          if (button) window.MobileOS.openApp(button.dataset.dossierOpen);
        },
        { signal },
      );
    },
    onResume: refresh,
  };
})();
