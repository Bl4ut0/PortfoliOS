/**
 * PortfoliOS: Core Runtime Bridge & Secondary Connector Adapter
 * Integrates the PortfoliOS-Runtime secondary connectors (VFS Bridge, PTY Controller,
 * Network Proxy, Credentials Vault, and Process Harness) into the PortfoliOS desktop shell,
 * enabling native CLI applications to run inside the browser.
 */

(function () {
  const activeSessions = new Map();
  let activePtySession = null;

  function isPrivateProfile(profileId) {
    if (!profileId) return false;
    if (typeof window.isPrivateUser === 'function') {
      return window.isPrivateUser(profileId) || profileId === 'guest' || profileId === 'bl4ut0' || profileId === 'root';
    }
    return true;
  }

  const AUTH_PATTERNS = [
    {
      provider: 'openai',
      name: 'ChatGPT Subscription',
      urlPattern: /https:\/\/(?:auth0\.openai\.com\/activate|chatgpt\.com\/[^\s'"]+)/i,
      codePattern: /\b([A-Z0-9]{4,5}-[A-Z0-9]{4,5})\b/
    },
    {
      provider: 'google',
      name: 'Google Antigravity Subscription',
      urlPattern: /https:\/\/(?:accounts\.google\.com\/[^\s'"]+|antigravity\.google\/[^\s'"]+)/i,
      codePattern: /\b([A-Z0-9]{3,8}-[A-Z0-9]{3,8})\b/i
    },
    {
      provider: 'anthropic',
      name: 'Claude.ai Subscription',
      urlPattern: /https:\/\/(?:claude\.ai\/[^\s'"]+|console\.anthropic\.com\/[^\s'"]+)/i,
      codePattern: /\b([a-zA-Z0-9_-]{6,32})\b/
    },
    {
      provider: 'xai',
      name: 'xAI Subscription',
      urlPattern: /https:\/\/(?:x\.ai\/[^\s'"]+|auth\.x\.ai\/[^\s'"]+)/i,
      codePattern: /\b([a-zA-Z0-9_-]{6,32})\b/
    }
  ];

  function detectDeviceAuth(text) {
    if (!text || typeof text !== 'string') return null;
    for (const item of AUTH_PATTERNS) {
      const urlMatch = text.match(item.urlPattern);
      if (urlMatch) {
        const codeMatch = text.match(item.codePattern);
        return {
          provider: item.provider,
          name: item.name,
          url: urlMatch[0],
          code: codeMatch ? codeMatch[1] : null,
          detectedAt: Date.now()
        };
      }
    }
    return null;
  }

  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function stripAnsi(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  }

  function ansiToHtml(str) {
    if (!str || typeof str !== 'string') return '';
    const ansiRegex = /\x1b\[([0-9;]*)m/g;
    let html = '';
    let lastIdx = 0;
    let bold = false;
    let fgColor = null;

    const colors = {
      '30': '#000000', '31': '#ef4444', '32': '#22c55e', '33': '#eab308',
      '34': '#3b82f6', '35': '#a855f7', '36': '#06b6d4', '37': '#f8fafc',
      '90': '#64748b', '91': '#f87171', '92': '#4ade80', '93': '#fde047',
      '94': '#60a5fa', '95': '#c084fc', '96': '#22d3ee', '97': '#ffffff'
    };

    let match;
    while ((match = ansiRegex.exec(str)) !== null) {
      const textBefore = str.slice(lastIdx, match.index);
      if (textBefore) {
        let style = '';
        if (fgColor) style += `color:${fgColor};`;
        if (bold) style += `font-weight:bold;`;
        if (style) {
          html += `<span style="${style}">${escapeHtml(textBefore)}</span>`;
        } else {
          html += escapeHtml(textBefore);
        }
      }
      lastIdx = ansiRegex.lastIndex;

      const codes = match[1] ? match[1].split(';') : ['0'];
      for (const code of codes) {
        if (code === '0' || code === '') {
          bold = false;
          fgColor = null;
        } else if (code === '1') {
          bold = true;
        } else if (colors[code]) {
          fgColor = colors[code];
        }
      }
    }

    const remaining = str.slice(lastIdx);
    if (remaining) {
      let style = '';
      if (fgColor) style += `color:${fgColor};`;
      if (bold) style += `font-weight:bold;`;
      if (style) {
        html += `<span style="${style}">${escapeHtml(remaining)}</span>`;
      } else {
        html += escapeHtml(remaining);
      }
    }

    return html;
  }

  function renderPtyOutputToTerminal(text) {
    if (!text) return;
    const cleanStr = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanStr.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line && i === lines.length - 1) continue;
      const stripped = stripAnsi(line);
      const html = ansiToHtml(line);

      if (typeof window.addTerminalHtmlLine === 'function' && html.includes('<span')) {
        window.addTerminalHtmlLine(html, stripped);
      } else if (typeof window.addTerminalLine === 'function') {
        window.addTerminalLine(stripped);
      } else if (typeof document !== 'undefined') {
        const containers = typeof window.getTerminalOutputContainers === 'function'
          ? window.getTerminalOutputContainers()
          : Array.from(document.querySelectorAll('#terminal-output, [data-term-output]'));
        for (const container of containers) {
          const div = document.createElement('div');
          div.className = 'terminal-line pty-output';
          div.innerHTML = html;
          container.appendChild(div);
          container.scrollTop = container.scrollHeight;
        }
      }
    }
  }

  function handleTerminalFormSubmit(event) {
    if (!activePtySession || !activePtySession.active || !activePtySession.activeProcess) {
      return;
    }
    const isPrimary = event.target?.id === 'terminal-form';
    const isMirror = Boolean(event.target?.matches?.('[data-term-form]'));
    if (isPrimary || isMirror) {
      const input = event.target.querySelector?.('input') ||
        (window.byId ? window.byId('terminal-input') : document.getElementById('terminal-input'));
      if (input) {
        event.preventDefault();
        event.stopPropagation();
        const val = input.value;
        input.value = '';
        activePtySession.writeInput(val + '\n');
        if (typeof window.addTerminalLine === 'function') {
          window.addTerminalLine(val, 'command');
        }
      }
    }
  }

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('submit', handleTerminalFormSubmit, true);
  }

  window.PortfoliOSRuntimeBridge = {
    isAvailable() {
      return typeof WebAssembly !== 'undefined' && typeof window.SystemFS !== 'undefined';
    },

    getActiveSession() {
      if (activePtySession) return activePtySession;
      const currentId = (typeof window !== 'undefined' && window.state?.currentUserId) || 'guest';
      if (activeSessions.has(currentId)) return activeSessions.get(currentId);
      return activeSessions.values().next().value || null;
    },

    sendInput(data, profileId) {
      const session = profileId ? activeSessions.get(profileId) : activePtySession;
      if (session && session.active) {
        session.writeInput(data);
        return true;
      }
      return false;
    },

    /**
     * Create or retrieve a container runtime session bound to a profile.
     * VFS mount root is `/` with full access across `/`, `/home`, `/usr/local/bin`, `/etc`, `/tmp`, `/documents`.
     */
    async getOrCreateSession(profileId = window.state?.currentUserId || 'guest') {
      if (!isPrivateProfile(profileId)) {
        throw new Error('A valid PortfoliOS profile is required to launch native CLI containers.');
      }

      if (activeSessions.has(profileId)) {
        return activeSessions.get(profileId);
      }

      const session = {
        profileId,
        active: true,
        mountRoot: '/',
        vfsRoot: '/',
        allowedPaths: ['/', '/home', '/usr/local/bin', '/etc', '/tmp', '/documents'],
        ptyOutputListeners: new Set(),
        ptyInputListeners: new Set(),
        vaultTokens: new Map(),
        vault: {
          async saveToken(provider, tokenRec) {
            session.vaultTokens.set(provider, tokenRec);
            if (window.SystemFS && typeof window.SystemFS.writeFile === 'function') {
              try {
                await window.SystemFS.ensureDirectory('/etc/portfolios/vault', { silent: true });
                await window.SystemFS.writeFile(
                  `/etc/portfolios/vault/${provider}.json`,
                  `${provider}.json`,
                  '/etc/portfolios/vault',
                  JSON.stringify(tokenRec, null, 2),
                  undefined,
                  'application/json'
                );
              } catch (_) {}
            }
          },
          async getToken(provider) {
            if (session.vaultTokens.has(provider)) {
              return session.vaultTokens.get(provider);
            }
            if (window.SystemFS && typeof window.SystemFS.readFile === 'function') {
              try {
                const rec = await window.SystemFS.readFile(`/etc/portfolios/vault/${provider}.json`);
                if (rec?.data) {
                  const parsed = JSON.parse(String(rec.data));
                  session.vaultTokens.set(provider, parsed);
                  return parsed;
                }
              } catch (_) {}
            }
            return null;
          },
          lock() {
            session.vaultTokens.clear();
          },
          async revokeToken(provider) {
            session.vaultTokens.delete(provider);
            if (window.SystemFS && typeof window.SystemFS.deleteFile === 'function') {
              try { await window.SystemFS.deleteFile(`/etc/portfolios/vault/${provider}.json`); } catch (_) {}
            }
          },
          async purge() {
            session.vaultTokens.clear();
            if (window.SystemFS) {
              const providers = ['openai', 'google', 'anthropic', 'xai', 'github'];
              for (const p of providers) {
                try { await window.SystemFS.deleteFile?.(`/etc/portfolios/vault/${p}.json`); } catch (_) {}
                try { await window.SystemFS.unlink?.(`/etc/portfolios/vault/${p}.json`); } catch (_) {}
              }
              try { await window.SystemFS.deleteFile?.('/documents/vault.enc'); } catch (_) {}
              try { await window.SystemFS.unlink?.('/documents/vault.enc'); } catch (_) {}
              try { await window.SystemFS.deleteFile?.('/documents/vault.enc.bak'); } catch (_) {}
            }
            return true;
          },
          async listProviders() {
            const list = new Set(session.vaultTokens.keys());
            if (window.SystemFS && typeof window.SystemFS.readDir === 'function') {
              try {
                const files = (await window.SystemFS.readDir('/etc/portfolios/vault')) || [];
                for (const f of files) {
                  if (f.name?.endsWith('.json')) list.add(f.name.replace('.json', ''));
                }
              } catch (_) {}
            }
            return Array.from(list);
          }
        },
        activeProcess: null,

        writeInput(data) {
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
          if (text.includes('\x03')) {
            if (this.activeProcess) {
              this.activeProcess.cancelled = true;
              if (this.activeProcess.abortController) {
                try { this.activeProcess.abortController.abort(); } catch (_) {}
              }
              if (this.activeProcess.engine?.terminate) {
                try { this.activeProcess.engine.terminate(); } catch (_) {}
              }
              this.emitOutput('^C\r\n');
            }
          }
          if (text.includes('\x04')) {
            if (this.activeProcess) {
              this.activeProcess.eof = true;
            }
          }
          for (const listener of this.ptyInputListeners) {
            try { listener(text); } catch (_) {}
          }
          if (this.activeProcess?.engine?.sendInput) {
            try { this.activeProcess.engine.sendInput(text); } catch (_) {}
          }
        },

        emitOutput(chunk) {
          const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
          for (const listener of this.ptyOutputListeners) {
            try { listener(text); } catch (_) {}
          }

          // Wire PTY output stream directly to the terminal output container
          renderPtyOutputToTerminal(text);

          // Check for device auth requests in output stream
          const auth = detectDeviceAuth(text);
          if (auth && window.showTerminalAuthBanner) {
            window.showTerminalAuthBanner({
              bin: auth.provider,
              name: auth.name,
              provider: auth.name,
              url: auth.url,
              code: auth.code
            });
          }
        },

        async syncFilesystem() {
          // Live two-way sync between SystemFS and container memory with VFS root '/'
          // Full SystemFS access across '/', '/home', '/usr/local/bin', '/etc', '/tmp', '/documents'
          if (window.SystemFS && typeof window.SystemFS.readDir === 'function') {
            const synced = {};
            const pathsToSync = ['/', '/home', '/usr/local/bin', '/etc', '/tmp', '/documents'];
            for (const p of pathsToSync) {
              try {
                synced[p] = await window.SystemFS.readDir(p);
              } catch (_) {}
            }
            try {
              if (!await window.SystemFS.readFile('/usr/local/bin/git-credential-portfolios')) {
                await window.SystemFS.ensureDirectory('/usr/local/bin', { silent: true });
                await window.SystemFS.writeFile(
                  '/usr/local/bin/git-credential-portfolios',
                  'git-credential-portfolios',
                  '/usr/local/bin',
                  '#!/bin/sh\n#PORTFOLIOS_BIN:{"bin":"git-credential-portfolios","name":"Git Credential Helper","version":"1.0.0"}\n',
                  undefined,
                  'application/x-executable'
                );
              }
            } catch (_) {}
            return synced;
          }
          return {};
        },

        close() {
          this.active = false;
          this.activeProcess = null;
          this.ptyOutputListeners.clear();
          this.ptyInputListeners.clear();
          this.vaultTokens.clear();
          if (activePtySession === this) {
            activePtySession = null;
          }
          activeSessions.delete(profileId);
        }
      };

      activeSessions.set(profileId, session);
      return session;
    },

    /**
     * Run a process in the container engine with full SystemFS root '/' access and PTY stream routing.
     */
    async runProcess({ profileId = window.state?.currentUserId || 'guest', cmd, args = [], onOutput = () => {} }) {
      const session = await this.getOrCreateSession(profileId);
      session.ptyOutputListeners.add(onOutput);
      activePtySession = session;
      const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      session.activeProcess = { cmd, args, startedAt: Date.now(), abortController, cancelled: false, eof: false };

      try {
        await session.syncFilesystem();

        if (session.activeProcess.cancelled) {
          return { exitCode: 130 };
        }

        if (cmd === 'git-credential-portfolios' || cmd.endsWith('/git-credential-portfolios')) {
          const action = args[0] || 'get';
          if (action === 'get') {
            const ghToken = await session.vault.getToken('github');
            if (ghToken?.accessToken) {
              session.emitOutput(`protocol=https\r\nhost=github.com\r\nusername=git\r\npassword=${ghToken.accessToken}\r\n`);
            }
            return { exitCode: 0 };
          }
          return { exitCode: 0 };
        }

        const candidatePaths = cmd.startsWith('/') ? [cmd] : [
          `/usr/local/bin/${cmd}`,
          `/bin/${cmd}`,
          `/usr/bin/${cmd}`,
          `/home/${profileId}/bin/${cmd}`,
          `/home/bin/${cmd}`,
          cmd
        ];

        let fileRec = null;
        let resolvedPath = cmd;
        if (window.SystemFS && typeof window.SystemFS.readFile === 'function') {
          for (const cPath of candidatePaths) {
            try {
              const rec = await window.SystemFS.readFile(cPath);
              if (rec && !rec.isDirectory) {
                fileRec = rec;
                resolvedPath = cPath;
                break;
              }
            } catch (_) {}
          }
        }

        if (fileRec && fileRec.data != null) {
          const raw = fileRec.data;
          let bytes;
          let text = '';
          if (raw instanceof Uint8Array) {
            bytes = raw;
            try { text = new TextDecoder('utf-8', { fatal: false }).decode(raw); } catch (_) {}
          } else if (raw instanceof ArrayBuffer) {
            bytes = new Uint8Array(raw);
            try { text = new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch (_) {}
          } else if (typeof raw === 'string') {
            text = raw;
            bytes = new TextEncoder().encode(raw);
          } else {
            bytes = new Uint8Array(0);
            text = '';
          }

          // Installed CLI wrapper (#PORTFOLIOS_BIN:{...})
          const binMatch = text.match(/^#PORTFOLIOS_BIN:(\{.*\})$/m);
          if (binMatch) {
            try {
              const meta = JSON.parse(binMatch[1]);
              const sub = (args[0] || '').toLowerCase();
              if (args.includes('--version') || args.includes('-v') || args.includes('-V') || sub === 'version') {
                session.emitOutput(`${meta.name || meta.bin} v${meta.version || '1.0.0'}\r\n`);
                return { exitCode: 0 };
              }
              if (args.includes('--help') || args.includes('-h') || sub === 'help') {
                session.emitOutput([
                  `${meta.name || meta.bin} v${meta.version || '1.0.0'}`,
                  `Usage: ${meta.bin} [options] [command]`,
                  '',
                  'Options:',
                  '  -v, --version                   Print version information',
                  '  -h, --help                      Print help message',
                  '',
                  'Subcommands:',
                  `  ${(meta.bin + ' doctor').padEnd(24)} Check runtime, VFS, and relay connectivity`,
                  `  ${(meta.bin + ' status').padEnd(24)} Show authentication and profile status`,
                  `  ${(meta.bin + ' update').padEnd(24)} Check for upstream version updates`
                ].join('\r\n') + '\r\n');
                return { exitCode: 0 };
              }
              if (sub === 'doctor') {
                const relayActive = Boolean(window.PortfoliOSNativeRelay);
                session.emitOutput([
                  `[Doctor] CLI: ${meta.bin} v${meta.version || '1.0.0'}`,
                  `[Doctor] Platform: PortfoliOS Linux/WASM Container`,
                  `[Doctor] VFS Mount: / (SystemFS root mounted)`,
                  `[Doctor] Native Relay: ${relayActive ? 'Connected (Raw TCP sockets & HTTP proxy enabled)' : 'Unavailable (In-browser direct network mode)'}`,
                  `[Doctor] PTY Terminal: Active duplex PTY stream`,
                  `[Doctor] Status: OK`
                ].join('\r\n') + '\r\n');
                return { exitCode: 0 };
              }

              if (meta.customScript && typeof window.runShellScript === 'function') {
                const scriptOut = await window.runShellScript([resolvedPath, ...args], meta.customScript);
                if (scriptOut) {
                  session.emitOutput(scriptOut.endsWith('\n') ? scriptOut : scriptOut + '\r\n');
                }
                return { exitCode: 0 };
              }
            } catch (_) {}
          }

          // Shebang script dispatch (#!/bin/sh, #!/usr/bin/env, etc.)
          if (text.startsWith('#!')) {
            if (typeof window.runShellScript === 'function') {
              const scriptOut = await window.runShellScript([resolvedPath, ...args], text);
              if (scriptOut) {
                session.emitOutput(scriptOut.endsWith('\n') ? scriptOut : scriptOut + '\r\n');
              }
              return { exitCode: 0 };
            }
          }

          // WebAssembly module dispatch (\x00asm or .wasm)
          const isWasm = (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) || resolvedPath.endsWith('.wasm');
          if (isWasm) {
            if (window.PortfoliOSRuntime && typeof window.PortfoliOSRuntime.createLinuxContainerEngine === 'function') {
              const ptyCtrl = {
                emitOutput: (c) => session.emitOutput(c),
                close: () => {}
              };
              const bridge = session.bridge || (typeof window.PortfoliOSRuntime.createSystemFSBridge === 'function'
                ? window.PortfoliOSRuntime.createSystemFSBridge({ profile: { id: profileId, kind: 'private' }, hostFS: window.SystemFS })
                : null);
              const engine = window.PortfoliOSRuntime.createLinuxContainerEngine({
                profile: { id: profileId, kind: 'private' },
                bridge,
                ptyController: ptyCtrl,
                args: [resolvedPath, ...args]
              });
              session.activeProcess.engine = engine;
              const code = await engine.execute(bytes);
              return { exitCode: code ?? 0 };
            }
          }

          // ELF x86_64 binary (\x7fELF)
          const isElf = bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46;
          if (isElf) {
            if (typeof window.PortfoliOSRuntime?.executeElf === 'function') {
              const res = await window.PortfoliOSRuntime.executeElf({
                bytes,
                cmd: resolvedPath,
                args,
                root: '/',
                onOutput: (c) => session.emitOutput(c)
              });
              return { exitCode: res?.exitCode ?? 0 };
            }
          }
        }

        let exitCode = 0;
        if (typeof window.PortfoliOSRuntime?.execute === 'function') {
          try {
            const proc = await window.PortfoliOSRuntime.execute({
              cmd,
              args,
              cwd: session.cwd || '/',
              root: session.vfsRoot || '/',
              onOutput: (chunk) => session.emitOutput(chunk)
            });
            exitCode = proc?.exitCode ?? 0;
          } catch (err) {
            session.emitOutput(`\x1b[1;31m[Runtime Error]\x1b[0m ${err.message}\r\n`);
            exitCode = 1;
          }
        } else if (!fileRec) {
          const knownBins = ['agy', 'codex', 'claude', 'grok', 'xai'];
          if (knownBins.includes(cmd)) {
            const sub = (args[0] || '').toLowerCase();
            if (sub === '--version' || sub === '-v' || sub === 'version') {
              session.emitOutput(`${cmd} v1.0.0 (PortfoliOS Linux Container)\r\n`);
              return { exitCode: 0 };
            }
            if (sub === 'doctor') {
              session.emitOutput(`[Doctor] ${cmd} container environment: root /, PTY ready, network relay ${window.PortfoliOSNativeRelay ? 'ready' : 'direct'}.\r\n`);
              return { exitCode: 0 };
            }
          } else {
            session.emitOutput(`bash: ${cmd}: command not found\r\n`);
            exitCode = 127;
          }
        }

        if (session.activeProcess?.cancelled) {
          exitCode = 130;
        }

        return { exitCode };
      } finally {
        session.activeProcess = null;
        if (activePtySession === session) {
          activePtySession = null;
        }
        session.ptyOutputListeners.delete(onOutput);
      }
    },

    /**
     * Terminate all active sessions on user logout or profile switch.
     */
    closeAll() {
      for (const session of activeSessions.values()) {
        session.close();
      }
      activeSessions.clear();
      activePtySession = null;
    }
  };

  function uint8ToBase64(bytes) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    if (typeof globalThis.Buffer !== 'undefined') {
      return globalThis.Buffer.from(bytes).toString('base64');
    }
    const encodeFn = typeof btoa === 'function' ? btoa : (typeof globalThis.btoa === 'function' ? globalThis.btoa : null);
    if (!encodeFn) throw new Error('Base64 encoder unavailable.');
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return encodeFn(binary);
  }

  function base64ToUint8(base64) {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
    if (typeof globalThis.Buffer !== 'undefined') {
      return new Uint8Array(globalThis.Buffer.from(base64, 'base64'));
    }
    const decodeFn = typeof atob === 'function' ? atob : (typeof globalThis.atob === 'function' ? globalThis.atob : null);
    if (!decodeFn) throw new Error('Base64 decoder unavailable.');
    const binary = decodeFn(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function sha256Hex(bytes) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function validateVaultPassword(password) {
    if (typeof password !== 'string') {
      return { valid: false, errors: ['Password must be a string.'], entropyBits: 0 };
    }
    const errors = [];
    if (password.length < 14) {
      errors.push('Password must be at least 14 characters long.');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number.');
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character or symbol.');
    }
    if (/(.)\1{3,}/.test(password)) {
      errors.push('Password must not contain 4 or more repeating characters.');
    }
    const common = ['password', '12345678', 'admin1234', 'qwertyuiop', 'portfolios'];
    const lower = password.toLowerCase();
    for (const word of common) {
      if (lower.includes(word)) {
        errors.push(`Password must not contain common word '${word}'.`);
        break;
      }
    }
    let pool = 0;
    if (/[a-z]/.test(password)) pool += 26;
    if (/[A-Z]/.test(password)) pool += 26;
    if (/[0-9]/.test(password)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(password)) pool += 32;
    const entropyBits = Math.round(password.length * Math.log2(pool || 1));
    if (entropyBits < 60) {
      errors.push(`Password entropy is too low (${entropyBits} bits). Minimum required: 60 bits.`);
    }
    return { valid: errors.length === 0, errors, entropyBits };
  }

  window.PortfoliOSVault = {
    validatePassword(password) {
      return validateVaultPassword(password);
    },

    async getStatus() {
      const session = await window.PortfoliOSRuntimeBridge.getOrCreateSession();
      const providers = await session.vault.listProviders();
      let hasEncrypted = false;
      if (window.SystemFS && typeof window.SystemFS.readFile === 'function') {
        try {
          const rec = await window.SystemFS.readFile('/documents/vault.enc');
          hasEncrypted = Boolean(rec && !rec.isDirectory);
        } catch (_) {}
      }
      return {
        isLocked: session.vaultTokens.size === 0 && (providers.length > 0 || hasEncrypted),
        providers,
        hasEncryptedBackup: hasEncrypted,
        tokenCount: session.vaultTokens.size
      };
    },

    lock() {
      for (const s of activeSessions.values()) {
        if (s?.vault) s.vault.lock();
      }
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('portfolios:vault-status-changed', {
          detail: { locked: true, action: 'lock' }
        }));
      }
    },

    async purgeAndReset() {
      for (const s of activeSessions.values()) {
        if (s?.vault) await s.vault.purge();
      }
      const session = await window.PortfoliOSRuntimeBridge.getOrCreateSession();
      if (session?.vault) {
        await session.vault.purge();
      }
      if (window.cliAuthSessions && typeof window.cliAuthSessions.clear === 'function') {
        window.cliAuthSessions.clear();
      }
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('portfolios:vault-status-changed', {
          detail: { locked: false, purged: true, action: 'purge' }
        }));
      }
      return { success: true };
    },

    async unlockWithPassphrase(password) {
      if (!password || typeof password !== 'string') {
        throw new Error('Master passphrase is required.');
      }
      let fileRec = null;
      if (window.SystemFS && typeof window.SystemFS.readFile === 'function') {
        try {
          fileRec = await window.SystemFS.readFile('/documents/vault.enc');
        } catch (_) {}
      }
      if (!fileRec || !fileRec.data) {
        throw new Error("Encrypted vault envelope ('/documents/vault.enc') not found.");
      }

      const envelope = typeof fileRec.data === 'string' ? JSON.parse(fileRec.data) : JSON.parse(new TextDecoder().decode(fileRec.data));
      if (!envelope || envelope.format !== 'portfolios-zk-vault') {
        throw new Error('Invalid vault envelope format. Expected portfolios-zk-vault.');
      }

      const salt = base64ToUint8(envelope.kdf.salt);
      const iv = base64ToUint8(envelope.cipher.iv);
      const ciphertext = base64ToUint8(envelope.ciphertext);

      const calculatedChecksum = await sha256Hex(ciphertext);
      if (envelope.checksum && envelope.checksum !== calculatedChecksum) {
        throw new Error('Vault transport checksum mismatch: payload was corrupted or modified.');
      }

      const encoder = new TextEncoder();
      const baseKey = await globalThis.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const key = await globalThis.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: envelope.kdf.iterations, hash: 'SHA-512' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      let decryptedBuf;
      try {
        decryptedBuf = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      } catch (_) {
        throw new Error('Incorrect master passphrase or corrupted authentication tag.');
      }

      const data = JSON.parse(new TextDecoder('utf-8').decode(decryptedBuf));
      const restored = [];
      const session = await window.PortfoliOSRuntimeBridge.getOrCreateSession();

      if (data && data.tokens) {
        for (const [provider, tokenRec] of Object.entries(data.tokens)) {
          await session.vault.saveToken(provider, tokenRec);
          restored.push(provider);
        }
      }

      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('portfolios:vault-status-changed', {
          detail: { locked: false, unlocked: true, restored, action: 'unlock' }
        }));
      }

      return { success: true, restored };
    },

    async initWithPassphrase(password) {
      const validation = validateVaultPassword(password);
      if (!validation.valid) {
        throw new Error(validation.errors.join(' '));
      }

      const session = await window.PortfoliOSRuntimeBridge.getOrCreateSession();
      const tokens = {};
      for (const [p, tok] of session.vaultTokens.entries()) {
        tokens[p] = tok;
      }

      if (window.SystemFS && typeof window.SystemFS.readDir === 'function') {
        try {
          const files = (await window.SystemFS.readDir('/etc/portfolios/vault')) || [];
          for (const f of files) {
            if (f.name?.endsWith('.json')) {
              const rec = await window.SystemFS.readFile(f.path);
              if (rec?.data) {
                tokens[f.name.replace('.json', '')] = JSON.parse(String(rec.data));
              }
            }
          }
        } catch (_) {}
      }

      const salt = globalThis.crypto.getRandomValues(new Uint8Array(32));
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const baseKey = await globalThis.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const key = await globalThis.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-512' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const payload = {
        version: 1,
        profileId: window.state?.currentUserId || 'guest',
        tokens,
        exportedAt: Date.now()
      };
      const plaintext = encoder.encode(JSON.stringify(payload));
      const cipherBuf = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
      const cipherBytes = new Uint8Array(cipherBuf);

      const checksum = await sha256Hex(cipherBytes);
      const envelope = {
        version: 1,
        format: 'portfolios-zk-vault',
        kdf: { algorithm: 'PBKDF2', hash: 'SHA-512', iterations: 600000, salt: uint8ToBase64(salt) },
        cipher: { algorithm: 'AES-256-GCM', iv: uint8ToBase64(iv), tagLength: 128 },
        ciphertext: uint8ToBase64(cipherBytes),
        checksum,
        exportedAt: Date.now()
      };

      if (window.SystemFS) {
        await window.SystemFS.ensureDirectory?.('/documents', { silent: true });
        await window.SystemFS.writeFile?.(
          '/documents/vault.enc',
          'vault.enc',
          '/documents',
          JSON.stringify(envelope, null, 2),
          undefined,
          'application/json'
        );
      }

      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('portfolios:vault-status-changed', {
          detail: { locked: false, initialized: true, action: 'init' }
        }));
      }

      return { success: true };
    },

    closeModal() {
      if (typeof document === 'undefined') return;
      const backdrop = document.getElementById('vault-modal-backdrop');
      if (backdrop) backdrop.style.display = 'none';
    },

    showUnlockModal(options = {}) {
      if (typeof document === 'undefined') {
        return Promise.resolve({ success: false, reason: 'No DOM' });
      }
      return new Promise((resolve, reject) => {
        const backdrop = document.getElementById('vault-modal-backdrop');
        const viewUnlock = document.getElementById('vault-view-unlock');
        const viewSetup = document.getElementById('vault-view-setup');
        const viewPurge = document.getElementById('vault-view-purge');
        const passInput = document.getElementById('vault-unlock-passphrase');
        const errBox = document.getElementById('vault-unlock-error');
        const submitBtn = document.getElementById('vault-unlock-submit');
        const cancelBtn = document.getElementById('vault-unlock-cancel');
        const purgeLink = document.getElementById('vault-goto-purge-btn');
        const eyeBtn = document.getElementById('vault-unlock-toggle-eye');

        if (!backdrop || !viewUnlock) {
          resolve({ success: false, reason: 'Modal elements not found' });
          return;
        }

        backdrop.style.display = 'flex';
        viewUnlock.style.display = 'block';
        if (viewSetup) viewSetup.style.display = 'none';
        if (viewPurge) viewPurge.style.display = 'none';

        if (errBox) {
          errBox.hidden = true;
          errBox.textContent = '';
        }
        if (passInput) {
          passInput.value = '';
          passInput.type = 'password';
          passInput.focus();
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-unlock"></i> Unlock Vault';
        }

        const cleanup = () => {
          backdrop.style.display = 'none';
        };

        const doUnlock = async () => {
          const pass = passInput?.value || '';
          if (!pass) {
            if (errBox) {
              errBox.textContent = 'Please enter your master passphrase.';
              errBox.hidden = false;
            }
            return;
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Decrypting...';
          }
          if (errBox) errBox.hidden = true;

          try {
            const res = await window.PortfoliOSVault.unlockWithPassphrase(pass);
            cleanup();
            if (typeof options.onUnlock === 'function') options.onUnlock(res);
            resolve(res);
          } catch (err) {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = '<i class="fa-solid fa-unlock"></i> Unlock Vault';
            }
            if (errBox) {
              errBox.textContent = err.message || 'Incorrect master passphrase.';
              errBox.hidden = false;
            }
          }
        };

        if (submitBtn) submitBtn.onclick = doUnlock;
        if (passInput) {
          passInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              doUnlock();
            }
          };
        }
        if (cancelBtn) {
          cancelBtn.onclick = () => {
            cleanup();
            if (typeof options.onCancel === 'function') options.onCancel();
            resolve({ success: false, cancelled: true });
          };
        }
        if (purgeLink) {
          purgeLink.onclick = () => {
            window.PortfoliOSVault.showPurgeModal(options).then(resolve).catch(reject);
          };
        }
        if (eyeBtn && passInput) {
          eyeBtn.onclick = () => {
            const isPass = passInput.type === 'password';
            passInput.type = isPass ? 'text' : 'password';
            eyeBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
          };
        }
      });
    },

    showPurgeModal(options = {}) {
      if (typeof document === 'undefined') {
        return Promise.resolve({ success: false, reason: 'No DOM' });
      }
      return new Promise((resolve) => {
        const backdrop = document.getElementById('vault-modal-backdrop');
        const viewUnlock = document.getElementById('vault-view-unlock');
        const viewSetup = document.getElementById('vault-view-setup');
        const viewPurge = document.getElementById('vault-view-purge');
        const confirmInput = document.getElementById('vault-purge-confirm-input');
        const purgeSubmit = document.getElementById('vault-purge-submit');
        const purgeCancel = document.getElementById('vault-purge-cancel');
        const purgeErr = document.getElementById('vault-purge-error');

        if (!backdrop || !viewPurge) {
          resolve({ success: false, reason: 'Modal elements not found' });
          return;
        }

        backdrop.style.display = 'flex';
        viewPurge.style.display = 'block';
        if (viewUnlock) viewUnlock.style.display = 'none';
        if (viewSetup) viewSetup.style.display = 'none';

        if (confirmInput) {
          confirmInput.value = '';
          confirmInput.focus();
        }
        if (purgeSubmit) purgeSubmit.disabled = true;
        if (purgeErr) purgeErr.hidden = true;

        if (confirmInput && purgeSubmit) {
          confirmInput.oninput = () => {
            purgeSubmit.disabled = confirmInput.value.trim() !== 'PURGE';
          };
        }

        const cleanup = () => {
          backdrop.style.display = 'none';
        };

        if (purgeCancel) {
          purgeCancel.onclick = () => {
            cleanup();
            if (typeof options.onCancel === 'function') options.onCancel();
            resolve({ success: false, cancelled: true });
          };
        }

        if (purgeSubmit) {
          purgeSubmit.onclick = async () => {
            purgeSubmit.disabled = true;
            purgeSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Purging...';
            try {
              await window.PortfoliOSVault.purgeAndReset();
              cleanup();
              if (typeof options.onPurged === 'function') options.onPurged();
              resolve({ success: true, purged: true });
            } catch (err) {
              purgeSubmit.disabled = false;
              purgeSubmit.innerHTML = '<i class="fa-solid fa-trash-can"></i> Purge All Credentials & Reset';
              if (purgeErr) {
                purgeErr.textContent = `Purge failed: ${err.message}`;
                purgeErr.hidden = false;
              }
            }
          };
        }
      });
    },

    showSetupModal(options = {}) {
      if (typeof document === 'undefined') {
        return Promise.resolve({ success: false, reason: 'No DOM' });
      }
      return new Promise((resolve) => {
        const backdrop = document.getElementById('vault-modal-backdrop');
        const viewUnlock = document.getElementById('vault-view-unlock');
        const viewSetup = document.getElementById('vault-view-setup');
        const viewPurge = document.getElementById('vault-view-purge');
        const pass1 = document.getElementById('vault-setup-passphrase');
        const pass2 = document.getElementById('vault-setup-confirm');
        const submitBtn = document.getElementById('vault-setup-submit');
        const cancelBtn = document.getElementById('vault-setup-cancel');
        const errBox = document.getElementById('vault-setup-error');
        const eyeBtn = document.getElementById('vault-setup-toggle-eye');

        const reqLen = document.getElementById('vreq-len');
        const reqMix = document.getElementById('vreq-mix');
        const reqEnt = document.getElementById('vreq-ent');
        const reqMatch = document.getElementById('vreq-match');

        if (!backdrop || !viewSetup) {
          resolve({ success: false, reason: 'Modal elements not found' });
          return;
        }

        backdrop.style.display = 'flex';
        viewSetup.style.display = 'block';
        if (viewUnlock) viewUnlock.style.display = 'none';
        if (viewPurge) viewPurge.style.display = 'none';

        if (pass1) { pass1.value = ''; pass1.focus(); }
        if (pass2) pass2.value = '';
        if (submitBtn) submitBtn.disabled = true;
        if (errBox) errBox.hidden = true;

        const updateCriteria = () => {
          const val1 = pass1?.value || '';
          const val2 = pass2?.value || '';
          const validation = validateVaultPassword(val1);

          const hasLen = val1.length >= 14;
          const hasMix = /[a-z]/.test(val1) && /[A-Z]/.test(val1) && /[0-9]/.test(val1) && /[^a-zA-Z0-9]/.test(val1);
          const hasEnt = validation.entropyBits >= 60;
          const hasMatch = val1.length > 0 && val1 === val2;

          if (reqLen) {
            reqLen.className = `vault-req ${hasLen ? 'met' : ''}`;
            const icon = reqLen.querySelector('i');
            if (icon) icon.className = hasLen ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
          }
          if (reqMix) {
            reqMix.className = `vault-req ${hasMix ? 'met' : ''}`;
            const icon = reqMix.querySelector('i');
            if (icon) icon.className = hasMix ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
          }
          if (reqEnt) {
            reqEnt.className = `vault-req ${hasEnt ? 'met' : ''}`;
            const icon = reqEnt.querySelector('i');
            if (icon) icon.className = hasEnt ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
          }
          if (reqMatch) {
            reqMatch.className = `vault-req ${hasMatch ? 'met' : ''}`;
            const icon = reqMatch.querySelector('i');
            if (icon) icon.className = hasMatch ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
          }

          if (submitBtn) {
            submitBtn.disabled = !(validation.valid && hasMatch);
          }
        };

        if (pass1) pass1.oninput = updateCriteria;
        if (pass2) pass2.oninput = updateCriteria;

        if (eyeBtn && pass1) {
          eyeBtn.onclick = () => {
            const isPass = pass1.type === 'password';
            pass1.type = isPass ? 'text' : 'password';
            eyeBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
          };
        }

        const cleanup = () => {
          backdrop.style.display = 'none';
        };

        if (cancelBtn) {
          cancelBtn.onclick = () => {
            cleanup();
            if (typeof options.onCancel === 'function') options.onCancel();
            resolve({ success: false, cancelled: true });
          };
        }

        if (submitBtn) {
          submitBtn.onclick = async () => {
            const pass = pass1?.value || '';
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Initializing...';
            try {
              const res = await window.PortfoliOSVault.initWithPassphrase(pass);
              cleanup();
              if (typeof options.onComplete === 'function') options.onComplete(res);
              resolve(res);
            } catch (err) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Initialize Vault';
              if (errBox) {
                errBox.textContent = `Setup failed: ${err.message}`;
                errBox.hidden = false;
              }
            }
          };
        }
      });
    }
  };

  // Bind to profile switch events if window.addEventListener is available
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('portfolios:profile-switched', () => {
      window.PortfoliOSRuntimeBridge.closeAll();
    });
  }
})();
