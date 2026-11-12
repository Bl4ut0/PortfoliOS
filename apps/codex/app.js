(function () {
  window.appRegistry.codex = {
    title: 'PortfoliOS Terminal', icon: 'apps/cli/icon.svg', windowClass: 'codex-window cli-window utility-window',
    renderBody: () => '<main class="codex-preview" data-codex-preview></main>',
    onOpen: root => window.CodexPreview.mount(root),
    onClose: root => window.CodexPreview.close(root)
  };
})();
