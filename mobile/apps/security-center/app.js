(function () {
  let pendingScan = null;
  const esc = (value) => window.PortfolioOSMobileFramework.escapeHtml(value);
  async function refresh(root) {
    const summary = await window.SecurityKernel.getSummary();
    root.querySelector("[data-security-summary]").textContent =
      summary.quarantineCount +
      " quarantined files · Local scanning · Drive credentials stay in memory.";
    root.querySelector("[data-security-list]").innerHTML =
      (await window.SecurityKernel.getQuarantine())
        .map(
          (record) =>
            "<article><h3>" +
            esc(record.name) +
            "</h3><p>" +
            esc(
              record.metadata?.security?.reason ||
                "File policy review required.",
            ) +
            "</p></article>",
        )
        .join("") || "<p>No quarantined files.</p>";
  }
  window.mobileAppRegistry["security-center"] = {
    title: "Security Center",
    icon: "fa-solid fa-shield-halved",
    viewClass: "mobile-security-center-app",
    render: () =>
      '<h2>Local file protection</h2><p>Files are checked in this browser before import and Drive backup. Policy scanning does not upload your files and is not a full antivirus scanner.</p><p data-security-summary></p><button type="button" data-security-scan>Scan workspace</button><p role="status" data-security-status></p><h3>Quarantine</h3><section data-security-list></section>',
    onOpen: async (root, { signal } = {}) => {
      await refresh(root);
      root.addEventListener(
        "click",
        async (event) => {
          const button = event.target.closest("[data-security-scan]");
          if (!button || pendingScan) return;
          button.disabled = true;
          try {
            pendingScan = window.SecurityKernel.scanWorkspace();
            const result = await pendingScan;
            root.querySelector("[data-security-status]").textContent =
              result.accepted +
              " accepted, " +
              result.quarantined +
              " quarantined.";
            await refresh(root);
          } catch (error) {
            root.querySelector("[data-security-status]").textContent =
              error.message;
          } finally {
            pendingScan = null;
            button.disabled = false;
          }
        },
        { signal },
      );
    },
    onResume: refresh,
    onClose: async () => {
      await pendingScan?.catch(() => {});
    },
  };
})();
