(function () {
  window.mobileAppRegistry.codex = {
    title: 'Codex CLI Preview', icon: 'fa-solid fa-terminal', viewClass: 'mobile-codex-app',
    render: () => '<main class="codex-preview" data-codex-preview></main>',
    onOpen: root => window.CodexPreview.mount(root),
    onClose: root => window.CodexPreview.close(root)
  };
})();
