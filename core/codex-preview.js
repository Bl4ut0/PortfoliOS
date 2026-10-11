/** First-party readiness UI. No Codex engine, provider credentials or guest file access. */
(function () {
  const instances = new WeakMap();
  function mount(root) {
    const panel = root.querySelector('[data-codex-preview]');
    const controller = new AbortController();
    const userId = window.state?.currentUserId;
    let pending = null;
    let invalidated = false;
    function active() {
      if (controller.signal.aborted || invalidated || window.state?.currentUserId !== userId) throw new Error('The workspace changed. Reopen Codex Preview in the intended profile.');
      if (!window.isPrivateUser?.(userId)) throw new Error('Choose a private profile to check local saves.');
    }
    panel.innerHTML = `
      <header><span class="codex-preview-badge">PREVIEW</span><h2>Codex CLI</h2><p>Prepare your private workspace for a future browser coding agent.</p></header>
      <section><h3>Your workspace</h3><p data-codex-session></p><button type="button" data-codex-choose>Choose a private profile</button><button type="button" data-codex-check>Test local save</button><p role="status" aria-live="polite" data-codex-result></p></section>
      <section><h3>Browser availability</h3><p>The browser engine is not installed. ChatGPT sign-in, project editing and Git commands are not available in this preview.</p><p>The experimental WASM port passed local version/help tests. Source verification and private workspace integration must pass before it can be installed here.</p></section>
      <section><h3>Use the official CLI on your computer</h3><p>Run these commands in your computer's terminal:</p><pre><code>npm install -g @openai/codex@latest
codex</code></pre><p>Choose Sign in with ChatGPT. Your Google workspace sign-in does not sign you into ChatGPT.</p><p>Run the installation command again to update the native CLI. Native updates do not update a browser WASM port; PortfoliOS will distribute reviewed browser releases separately.</p><a href="https://learn.chatgpt.com/docs/codex/cli" target="_blank" rel="noopener noreferrer">Official CLI setup</a> <a href="https://learn.chatgpt.com/docs/auth" target="_blank" rel="noopener noreferrer">ChatGPT sign-in help</a></section>`;
    const result = panel.querySelector('[data-codex-result]');
    const check = panel.querySelector('[data-codex-check]');
    const choose = panel.querySelector('[data-codex-choose]');
    panel.querySelector('[data-codex-session]').textContent = window.getAssistantSessionStatus?.() || 'Choose your workspace.';
    const isPrivate = Boolean(window.isPrivateUser?.(userId));
    check.disabled = !isPrivate;
    choose.hidden = isPrivate;
    choose.addEventListener('click', () => window.openSessionChooser?.(), { signal: controller.signal });
    check.addEventListener('click', () => {
      if (pending) return;
      check.disabled = true;
      result.textContent = 'Checking this profile’s local filesystem…';
      pending = (async () => {
        active();
        await window.SystemFS.ensureReady(); active();
        const file = '/documents/codex-workspace-check-' + crypto.randomUUID() + '.txt';
        const text = 'PortfoliOS private workspace local save check.\n';
        await window.SystemFS.writeFile(file, file.split('/').pop(), '/documents', text, undefined, 'text/plain'); active();
        const saved = await window.SystemFS.readFile(file); active();
        if (saved?.data !== text) throw new Error('The local save could not be verified.');
        result.textContent = 'Local save and read verified: ' + file + '. This confirms SystemFS access for this app, not Codex guest access or a completed Drive upload.';
      })().catch(error => {
        if (!controller.signal.aborted && !invalidated) result.textContent = error.message;
      }).finally(() => {
        pending = null;
        if (!controller.signal.aborted && !invalidated) check.disabled = !isPrivate;
      });
    }, { signal: controller.signal });
    const unsubscribe = window.EventBus?.on('user:changed', () => {
      invalidated = true;
      check.disabled = true; choose.hidden = true;
      result.textContent = 'Workspace changed. Close and reopen this preview.';
      panel.querySelector('[data-codex-session]').textContent = '';
    });
    instances.set(root, async () => { controller.abort(); unsubscribe?.(); await pending; });
  }
  window.CodexPreview = { mount, async close(root) { await instances.get(root)?.(); instances.delete(root); } };
})();
