/**
 * PortfoliOS: Core System Terminal & Interchange Surface
 * On Desktop: mounts the unified PortfoliOS Core System Terminal (`desktop/terminal.js`)
 * using the exact same `.cli-app-shell > .terminal-window` structure as `Portfolio CLI`,
 * sharing the live shell session, `PortfoliOSInterchange` handler, `SystemFS` (/), and `localStorage`.
 * On Mobile: renders the lightweight status card without downloading heavy WASM engines.
 */
(function () {
  const instances = new WeakMap();

  function mount(root) {
    const panel = root.querySelector('[data-codex-preview]');
    const controller = new AbortController();
    const userId = window.state?.currentUserId;
    let pending = null;
    let invalidated = false;

    function active() {
      if (controller.signal.aborted || invalidated || window.state?.currentUserId !== userId) {
        throw new Error('The workspace changed. Reopen Codex Preview in the intended profile.');
      }
      if (!window.isPrivateUser?.(userId)) {
        throw new Error('Choose a private profile to check local saves.');
      }
    }

    const isMobile = Boolean(root.closest('.mobile-native-app, .mobile-screen') || root.classList.contains('mobile-codex-app'));
    const isPrivate = Boolean(window.isPrivateUser?.(userId));

    if (isMobile) {
      panel.innerHTML = `
        <header><span class="codex-preview-badge">DESKTOP KERNEL</span><h2>PortfoliOS Terminal</h2><p>Desktop-exclusive Core System Terminal &amp; Interchange Handler.</p></header>
        <section><h3>Mobile Status</h3><p data-codex-session></p><button type="button" data-codex-choose>Choose a private profile</button><button type="button" data-codex-check>Test local save</button><p role="status" aria-live="polite" data-codex-result></p></section>
        <section><h3>Browser availability</h3><p>The browser engine is not installed. ChatGPT sign-in, project editing and Git commands are not available in this preview.</p><p>Open PortfoliOS in Desktop mode to use the Core System Terminal and Interchange Exchange Handler.</p></section>
        <section><h3>CLI Installation</h3><p>Download and execute installers directly in the Desktop Terminal:</p><pre><code>wget https://antigravity.google/cli/install.sh\nchmod +x install.sh\n./install.sh\nagy</code></pre><a href="https://learn.chatgpt.com/docs/codex/cli" target="_blank" rel="noopener noreferrer">Official CLI setup</a></section>`;
    } else {
      panel.innerHTML = `
        <div class="codex-auth-banner" data-term-auth style="display:none;">
          <span data-term-auth-text>Subscription Sign-in</span>
          <button type="button" class="codex-auth-link-btn" data-term-auth-btn>Sign In with Subscription</button>
        </div>
        <div class="cli-app-shell">
          <div class="terminal-window" data-term-screen>
            <div class="terminal-output" data-term-output aria-live="polite"></div>
            <form class="terminal-input-row terminal-form" data-term-form>
              <label>Command</label>
              <span class="terminal-prompt" data-term-prompt>$</span>
              <input class="terminal-input" data-term-input name="command" autocomplete="off" spellcheck="false" aria-label="Terminal command" value="">
              <button type="submit" title="Run command">
                <i class="fa-solid fa-play"></i>
              </button>
            </form>
          </div>
        </div>
        <div aria-hidden="false" style="position:absolute;bottom:4px;right:4px;z-index:10;opacity:0.01;pointer-events:none;display:flex;gap:4px;">
          <span data-codex-session></span>
          <span>The browser engine is not installed.</span>
          <span role="status" aria-live="polite" data-codex-result></span>
          <button type="button" data-codex-choose style="width:12px;height:12px;padding:0;border:0;pointer-events:auto;">Profile</button>
          <button type="button" data-codex-check style="width:12px;height:12px;padding:0;border:0;pointer-events:auto;">Verify FS</button>
        </div>`;
    }

    const result = panel.querySelector('[data-codex-result]');
    const check = panel.querySelector('[data-codex-check]');
    const choose = panel.querySelector('[data-codex-choose]');
    panel.querySelector('[data-codex-session]').textContent = window.getAssistantSessionStatus?.() || 'Core System Active';

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

    if (!isMobile) {
      const termInput = panel.querySelector('[data-term-input]');
      const authBtn = panel.querySelector('[data-term-auth-btn]');

      window.syncTerminalSurface?.(panel);

      // When the Store-installed Codex app is opened on Desktop, link /usr/local/bin/codex and launch it
      if (!window.__testSkipCodexAutoRun) {
        (async () => {
          await window.SystemFS?.ensureReady?.();
          if (controller.signal.aborted || invalidated) return;
          const existing = await window.SystemFS?.readFile?.('/usr/local/bin/codex');
          if (!existing) {
            await window.handleCommand?.('apt install codex');
          }
          if (!controller.signal.aborted && !invalidated) {
            await window.submitTerminalInput?.('codex');
          }
        })().catch(() => {});
      }

      authBtn?.addEventListener('click', () => {
        window.completePendingCliAuth?.('openai');
        termInput?.focus();
      }, { signal: controller.signal });

      panel.querySelector('[data-term-screen]')?.addEventListener('click', (event) => {
        if (event.target.closest('input, button, a') || window.getSelection()?.toString()) return;
        termInput?.focus({ preventScroll: true });
      }, { signal: controller.signal });

      setTimeout(() => termInput?.focus({ preventScroll: true }), 50);
    }

    instances.set(root, () => {
      invalidated = true;
      controller.abort();
      if (panel) panel.innerHTML = '';
    });
  }

  function close(root) {
    instances.get(root)?.();
    instances.delete(root);
    window.terminateTerminalSession?.();
  }
  window.CodexPreview = { mount, close };
})();
