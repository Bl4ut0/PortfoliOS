(function () {
  window.appRegistry.codex = {
    title: 'Codex CLI Preview', icon: 'apps/codex/icon.svg', windowClass: 'codex-window utility-window',
    renderBody: () => '<main class="codex-preview" data-codex-preview></main>',
    onOpen: root => window.CodexPreview.mount(root),
    onClose: root => window.CodexPreview.close(root)
  };
})();
