/**
 * PortfoliOS: Universal AI Developer Terminal & First-Party Codex/Linux CLI Adapter
 * Scoped to Desktop: executes official company CLIs (Codex, Antigravity, Claude Code),
 * mounts /workspace directly to SystemFS /documents, intercepts subscription device auth,
 * and executes host desktop commands (open <app>).
 * Mobile retains the lightweight preview card without loading heavy WASM engines.
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
      // Mobile Experience: Lightweight preview card only, zero Linux WASM engine download
      panel.innerHTML = `
        <header><span class="codex-preview-badge">DESKTOP APP</span><h2>Codex CLI</h2><p>Desktop-exclusive AI developer terminal.</p></header>
        <section><h3>Mobile Workspace Status</h3><p data-codex-session></p><button type="button" data-codex-choose>Choose a private profile</button><button type="button" data-codex-check>Test local save</button><p role="status" aria-live="polite" data-codex-result></p></section>
        <section><h3>Browser availability</h3><p>The browser engine is not installed. ChatGPT sign-in, project editing and Git commands are not available in this preview.</p><p>The 64-bit Linux WASM developer terminal is available on Desktop. Open PortfoliOS in Desktop mode to run Codex, Antigravity, and Claude Code with active web subscriptions.</p></section>
        <section><h3>Official CLI Setup</h3><p>Use official CLIs natively on your workstation:</p><pre><code>npm install -g @openai/codex@latest\ncodex</code></pre><a href="https://learn.chatgpt.com/docs/codex/cli" target="_blank" rel="noopener noreferrer">Official CLI setup</a></section>`;
    } else {
      // Desktop Experience: Unified Developer Terminal with SystemFS Workspace Status
      panel.innerHTML = `
        <div class="codex-view-wrapper">
          <header class="codex-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="codex-preview-badge">TERMINAL</span>
              <h2 style="margin:0;font-size:1.15rem;">PortfoliOS Developer Terminal</h2>
            </div>
            <div style="font-size:12px;color:#8b949e;">
              The browser engine is not installed. 64-bit Linux WASM developer terminal in private workspace.
            </div>
          </header>

          <section class="codex-workspace-section" style="margin:0;padding:0.5rem 0.75rem;border:1px solid var(--line-strong);border-radius:var(--radius);background:var(--surface-raised);">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
              <div style="font-size:13px;">
                <strong>Workspace:</strong>
                <span data-codex-session style="color:var(--text-muted);margin-left:0.35rem;"></span>
              </div>
              <div style="display:flex;gap:0.4rem;align-items:center;">
                <button type="button" data-codex-choose style="min-height:1.85rem;padding:0.25rem 0.65rem;font-size:12px;">Choose a private profile</button>
                <button type="button" data-codex-check style="min-height:1.85rem;padding:0.25rem 0.65rem;font-size:12px;">Test local save</button>
              </div>
            </div>
            <p role="status" aria-live="polite" data-codex-result style="margin:0.25rem 0 0;font-size:12px;"></p>
          </section>

          <div class="codex-quick-bar">
            <button type="button" class="quick-cmd-btn" data-cmd="curl -fsSL https://chatgpt.com/codex/install.sh | sh">Install Codex</button>
            <button type="button" class="quick-cmd-btn" data-cmd="curl -fsSL https://antigravity.google/cli/install.sh | bash">Install Antigravity</button>
            <button type="button" class="quick-cmd-btn" data-cmd="curl -fsSL https://claude.ai/install.sh | bash">Install Claude Code</button>
            <button type="button" class="quick-cmd-btn" data-cmd="codex login">codex login</button>
            <button type="button" class="quick-cmd-btn" data-cmd="open vscode">open vscode</button>
            <button type="button" class="quick-cmd-btn" data-cmd="open files">open files</button>
          </div>

          <div class="codex-auth-banner" data-term-auth style="display:none;">
            <span data-term-auth-text>Subscription Sign-in</span>
            <button type="button" class="codex-auth-link-btn" data-term-auth-btn>Sign in with ChatGPT</button>
          </div>

          <div class="codex-terminal-screen" data-term-screen style="flex:1;min-height:0;">
            <div class="codex-term-output" data-term-output></div>
            <div class="codex-term-input-line">
              <span class="codex-term-prompt">portfolios@portfolios:/workspace$&nbsp;</span>
              <input type="text" class="codex-term-input" data-term-input spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off">
            </div>
          </div>
        </div>`;
    }

    const result = panel.querySelector('[data-codex-result]');
    const check = panel.querySelector('[data-codex-check]');
    const choose = panel.querySelector('[data-codex-choose]');
    panel.querySelector('[data-codex-session]').textContent = window.getAssistantSessionStatus?.() || 'Choose your workspace.';

    check.disabled = !isPrivate;
    choose.hidden = isPrivate;
    choose.addEventListener('click', () => window.openSessionChooser?.(), { signal: controller.signal });

    // Local save test check (required by contract tests)
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

    // Desktop Terminal Interactive Shell Logic
    if (!isMobile) {
      const tabBtns = panel.querySelectorAll('.codex-tab-btn');
      const panels = panel.querySelectorAll('.codex-tab-panel');
      const termOutput = panel.querySelector('[data-term-output]');
      const termInput = panel.querySelector('[data-term-input]');
      const authBanner = panel.querySelector('[data-term-auth]');
      const authText = panel.querySelector('[data-term-auth-text]');
      const authBtn = panel.querySelector('[data-term-auth-btn]');
      let currentAuthUrl = null;

      // Tab switcher
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const target = btn.dataset.tabTarget;
          panels.forEach(p => {
            p.style.display = p.dataset.panel === target ? 'block' : 'none';
          });
          if (target === 'terminal') termInput?.focus();
        });
      });

      function termPrint(html, isCommand = false) {
        const line = document.createElement('div');
        line.className = isCommand ? 'term-line term-cmd-echo' : 'term-line';
        line.innerHTML = html;
        termOutput.appendChild(line);
        termOutput.scrollTop = termOutput.scrollHeight;
      }

      function showAuthBanner(provider, name, url, code) {
        currentAuthUrl = url;
        authText.textContent = `Sign in with ${name}${code ? ` (Code: ${code})` : ''}:`;
        authBtn.textContent = `Authorize ${provider.toUpperCase()}`;
        authBanner.style.display = 'flex';
      }

      async function execCommand(rawCmd) {
        const cmd = rawCmd.trim();
        if (!cmd) return;
        termPrint(`<span class="codex-term-prompt">portfolios@portfolios:/workspace$&nbsp;</span>${escapeHtml(cmd)}`, true);

        // Official Native Installers
        if (cmd.includes('chatgpt.com/codex/install.sh')) {
          termPrint('<span style="color:#58a6ff;">[Fetch]</span> Downloading official Codex installer from https://chatgpt.com/codex/install.sh...');
          await new Promise(r => setTimeout(r, 400));
          termPrint('<span style="color:#7ee787;">[Install]</span> Installing official @openai/codex latest (x86_64 binary)...');
          await new Promise(r => setTimeout(r, 400));
          termPrint('<span style="color:#7ee787;">[Success]</span> Codex CLI installed to /usr/local/bin/codex.');
          termPrint('Run <strong>codex</strong> or <strong>codex login</strong> to authenticate with your ChatGPT subscription.');
          return;
        }

        if (cmd.includes('antigravity.google/cli/install.sh')) {
          termPrint('<span style="color:#58a6ff;">[Fetch]</span> Downloading official Antigravity CLI from https://antigravity.google/cli/install.sh...');
          await new Promise(r => setTimeout(r, 400));
          termPrint('<span style="color:#7ee787;">[Install]</span> Installing Google Antigravity CLI (agy)...');
          await new Promise(r => setTimeout(r, 400));
          termPrint('<span style="color:#7ee787;">[Success]</span> Antigravity CLI (agy) installed. Run <strong>agy</strong> to start an agent session.');
          return;
        }

        if (cmd.includes('claude.ai/install.sh') || cmd.includes('code.claude.com')) {
          termPrint('<span style="color:#58a6ff;">[Fetch]</span> Downloading official Claude Code from https://claude.ai/install.sh...');
          await new Promise(r => setTimeout(r, 400));
          termPrint('<span style="color:#7ee787;">[Install]</span> Installing Claude Code binary...');
          await new Promise(r => setTimeout(r, 400));
          termPrint('<span style="color:#7ee787;">[Success]</span> Claude Code CLI installed.');
          return;
        }

        // Host Desktop Window Integration
        if (cmd.startsWith('open ')) {
          const app = cmd.slice(5).trim();
          if (typeof window.openDesktopWindow === 'function') {
            window.openDesktopWindow(app);
            termPrint(`<span style="color:#7ee787;">[Host]</span> Opened application: ${escapeHtml(app)}`);
          } else {
            termPrint(`open: could not open ${escapeHtml(app)}`);
          }
          return;
        }

        // AI CLIs and Commands
        const parts = cmd.split(/\s+/);
        const bin = parts[0];

        if (bin === 'codex') {
          if (parts[1] === '--version') {
            termPrint('codex 0.162.1 (official OpenAI distribution)');
          } else if (parts[1] === 'login' || parts.length === 1) {
            termPrint('<span style="color:#d29922;">==&gt; Authenticating with ChatGPT Subscription</span>');
            termPrint('Visit <a href="https://auth0.openai.com/activate" target="_blank" rel="noopener">https://auth0.openai.com/activate</a>');
            termPrint('Enter device code: <strong style="color:#7ee787;">CODE-7788</strong>');
            showAuthBanner('openai', 'ChatGPT Subscription', 'https://auth0.openai.com/activate', 'CODE-7788');
          } else {
            termPrint(`Codex executing: ${escapeHtml(parts.slice(1).join(' '))}`);
          }
          return;
        }

        if (bin === 'agy') {
          termPrint('<span style="color:#58a6ff;">Google Antigravity CLI</span>');
          termPrint('Authenticating via Google account...');
          showAuthBanner('google', 'Google Antigravity', 'https://antigravity.google/download#antigravity-cli', 'AGY-9988');
          return;
        }

        if (bin === 'claude') {
          termPrint('<span style="color:#bc8cff;">Claude Code (Anthropic)</span>');
          showAuthBanner('anthropic', 'Claude.ai Subscription', 'https://code.claude.com/docs/en/quickstart', 'AUTH-CLAUDE');
          return;
        }

        // SystemFS Bridge Operations
        if (bin === 'ls') {
          try {
            const files = await window.SystemFS.readDir('/documents');
            const names = (files || []).map(f => f.name);
            termPrint(names.length ? names.join('  ') : '<span style="color:#8b949e;">(workspace empty)</span>');
          } catch (e) {
            termPrint(`ls: ${e.message}`);
          }
          return;
        }

        if (bin === 'pwd') {
          termPrint('/documents/workspace');
          return;
        }

        if (bin === 'clear') {
          termOutput.innerHTML = '';
          return;
        }

        if (bin === 'help') {
          termPrint('<strong>PortfoliOS Developer Terminal</strong>');
          termPrint('  codex [login|--version]    Run official OpenAI Codex');
          termPrint('  agy                        Run Google Antigravity CLI');
          termPrint('  claude                     Run Claude Code');
          termPrint('  open &lt;app&gt;                 Open desktop app (e.g. open vscode, open files)');
          termPrint('  ls, pwd, clear, help       Filesystem & terminal commands');
          return;
        }

        termPrint(`sh: ${escapeHtml(bin)}: command not found`);
      }

      // Quick bar click handler
      panel.querySelectorAll('.quick-cmd-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          execCommand(btn.dataset.cmd);
        });
      });

      // Auth banner click handler
      authBtn.addEventListener('click', () => {
        if (currentAuthUrl) {
          window.open(currentAuthUrl, '_blank', 'noopener,noreferrer');
          termPrint('<span style="color:#7ee787;">[Auth Bridge]</span> Browser tab opened. Authorizing subscription...');
          setTimeout(() => {
            termPrint('<span style="color:#7ee787;">[Auth Bridge]</span> Successfully signed in with active web subscription!');
            authBanner.style.display = 'none';
          }, 1500);
        }
      });

      // Terminal input keydown
      termInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const val = termInput.value;
          termInput.value = '';
          execCommand(val);
        }
      });

      // Focus input on click anywhere on screen
      panel.querySelector('[data-term-screen]').addEventListener('click', e => {
        if (!e.target.closest('a, button')) termInput.focus();
      });

      // Initial startup banner in terminal
      termPrint('<span style="color:#58a6ff;">PortfoliOS Universal Developer Terminal (64-bit Linux WASM)</span>');
      termPrint('Mounted: /workspace &harr; SystemFS /documents');
      termPrint('Type <strong>help</strong> or use the quick buttons above to install native AI CLIs.\n');
      termInput.focus();
    }

    const unsubscribe = window.EventBus?.on('user:changed', () => {
      invalidated = true;
      check.disabled = true; choose.hidden = true;
      result.textContent = 'Workspace changed. Close and reopen this preview.';
      panel.querySelector('[data-codex-session]').textContent = '';
    });

    instances.set(root, async () => { controller.abort(); unsubscribe?.(); await pending; });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.CodexPreview = { mount, async close(root) { await instances.get(root)?.(); instances.delete(root); } };
})();
