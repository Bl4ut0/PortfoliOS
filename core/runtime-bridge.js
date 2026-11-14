/**
 * PortfoliOS: Core Runtime Bridge & Secondary Connector Adapter
 * Integrates the PortfoliOS-Runtime secondary connectors (VFS Bridge, PTY Controller,
 * Network Proxy, Credentials Vault, and Process Harness) into the PortfoliOS desktop shell,
 * exposing the browser-side adapter. Native CLI process execution remains a separate capability.
 */

(function () {
  const activeSessions = new Map();
  let activePtySession = null;
  const vaultSessions = new Map();
  const credentialConsumers = {openai:'cli.codex',google:'cli.agy',anthropic:'cli.claude',xai:'cli.xai',github:'cli.git'};
  const vaultChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('portfolios:vault-change') : null;
  const vaultSender = crypto.randomUUID();
  function vaultChanged() {
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('portfolios:vault-status-changed'));
  }
  function getVault(profileId = window.state?.currentUserId) {
    if (!isPrivateProfile(profileId) || profileId !== window.state?.currentUserId || window.state?.sessionChosen === false) throw new Error('Open the intended private workspace to access its vault.');
    if (!window.CredentialVault) throw new Error('The credential vault service is unavailable.');
    if (!vaultSessions.has(profileId)) {
      const assert = () => { if (window.state?.currentUserId !== profileId || !isPrivateProfile(profileId)) throw new Error('Profile changed during vault access.'); };
      const state = {writing:false,broker:null};
      const readRecord = async () => {
        assert();const record=await window.SystemFS.readFile('/documents/vault.enc');assert();
        if(!record)return null;
        const text=typeof record.data==='string'?record.data:await window.readFilesystemRecordText(record);assert();return {record,text};
      };
      state.broker=window.CredentialVault.create({profileId,isCurrent:()=>window.state?.currentUserId===profileId&&window.state?.sessionChosen!==false,
        readRecord,
        writeRecord:async(text,expected)=>{
          assert();state.writing=true;
          try {
            // Scanning may change record metadata/revision without changing ciphertext.
            // Rebase only identical encrypted bytes, then keep the atomic revision check.
            const current=expected?await readRecord():null;
            if(expected&&current?.text!==expected.text)throw new Error('The vault changed elsewhere. Unlock its latest version before saving.');
            const record=await window.SystemFS.writeFile('/documents/vault.enc','vault.enc','/documents',text,undefined,'application/json',false,{...(current?{expectedRecord:current.record}:{expectedAbsent:true}),metadata:{kind:'encrypted-credentials',vaultVersion:2}});
            assert();vaultChannel?.postMessage({profileId,sender:vaultSender});vaultChanged();return {record,text};
          } catch(error) {state.broker.lock();throw error;} finally {state.writing=false;}
        },
        deleteRecord:async expected=>{assert();state.writing=true;try{await window.SystemFS.deleteFile('/documents/vault.enc',{expectedRecord:expected.record});assert();vaultChannel?.postMessage({profileId,sender:vaultSender});}finally{state.writing=false;}},
        onRevoke:consumer=>{
          window.cliAuthSessions?.clear?.();
          for(const session of activeSessions.values())if(session.profileId===profileId&&session.activeProcess&&(!consumer||session.activeProcess.authConsumer===consumer)){session.activeProcess.abortController?.abort();session.activeProcess.engine?.terminate?.();}
          vaultChanged();
        }
      });vaultSessions.set(profileId,state);
    }
    return vaultSessions.get(profileId).broker;
  }
  if(vaultChannel)vaultChannel.onmessage=({data})=>{if(data?.sender!==vaultSender&&data?.profileId===window.state?.currentUserId){vaultSessions.get(data.profileId)?.broker.lock();}};
  window.EventBus?.on?.('fs:changed', event=>{
    const state=vaultSessions.get(window.state?.currentUserId), path='/documents/vault.enc';
    const changed=event?.path===path||event?.oldPath===path||event?.newPath===path||event?.restoredPath===path||
      (event?.action==='deleteRecursive'&&event.path&&(event.path==='/'||path.startsWith(event.path+'/')));
    if(state&&!state.writing&&changed)state.broker.lock();
  });

  function isPrivateProfile(profileId) {
    if (!profileId) return false;
    if (typeof window.isPrivateUser === 'function') {
      return window.isPrivateUser(profileId);
    }
    return false;
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
      if (activePtySession?.active && activePtySession.profileId === window.state?.currentUserId) return activePtySession;
      const currentId = (typeof window !== 'undefined' && window.state?.currentUserId) || 'guest';
      if (activeSessions.has(currentId)) return activeSessions.get(currentId);
      return null;
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
      if (!isPrivateProfile(profileId) || profileId !== window.state?.currentUserId) {
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
        vault: null,
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
          this.activeProcess?.abortController?.abort();
          this.activeProcess?.engine?.terminate?.();
          this.activeProcess = null;
          this.ptyOutputListeners.clear();
          this.ptyInputListeners.clear();

          if (activePtySession === this) {
            activePtySession = null;
          }
          activeSessions.delete(profileId);
        }
      };

      const broker=getVault(profileId);
      session.vault={
        async saveToken(provider,tokenRec,{consumer=credentialConsumers[provider]}={}) {
          if(!session.active||profileId!==window.state?.currentUserId)throw new Error('Runtime session ended.');
          return broker.save({provider,accountId:String(tokenRec.account||tokenRec.accountId||'default'),label:String(tokenRec.account||provider),secret:tokenRec,consumers:consumer?[consumer]:[]});
        },
        async getToken(provider,{consumer=credentialConsumers[provider]}={}) {
          if(!session.active||profileId!==window.state?.currentUserId)throw new Error('Runtime session ended.');
          if(!consumer||window.CredentialVault.consumers[consumer]!==provider)throw new Error('Subsystem cannot use this provider.');
          const lease=broker.acquire(consumer);try{return lease.read();}finally{lease.release();}
        },
        lock:()=>broker.lock(),
        listProviders:async()=>[...new Set(broker.list().map(c=>c.provider))],
        revokeToken:async(provider,{consumer=credentialConsumers[provider]}={})=>{await broker.unlink(consumer);},
        purge:()=>broker.purge()
      };
      Object.defineProperty(session,'vaultTokens',{get:()=>new Map(broker.isUnlocked?broker.list().map(c=>[c.provider,{id:c.id,account:c.accountId}]):[])});
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
            session.emitOutput('Credential delivery requires the scoped native Git connector; secrets are not printed in terminal output.\r\n');
            return {exitCode:1};
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
                  `[Doctor] Native Relay: ${relayActive ? 'Connected (Raw TCP sockets & HTTP proxy enabled)' : 'Unavailable (browser sandbox networking only; no hosted relay fallback)'}`,
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

  window.PortfoliOSVault = {
    validatePassword:password=>window.CredentialVault.validatePassword(password),
    getStatus:()=>getVault().status(),
    lock(){for(const state of vaultSessions.values())state.broker.lock();vaultChanged();},
    async purgeAndReset(){const result=await getVault().purge();vaultChanged();return result;},
    unlockWithPassphrase:async password=>{const result=await getVault().unlock(password);vaultChanged();return result;},
    initWithPassphrase:async password=>{const result=await getVault().initialize(password);vaultChanged();return result;},
    listAccounts:()=>getVault().list(),
    getBinding:consumer=>getVault().binding(consumer),
    acquire:consumer=>getVault().acquire(consumer),
    link:(id,consumer)=>getVault().link(id,consumer),
    unlink:consumer=>getVault().unlink(consumer),
    removeUnused:id=>getVault().removeUnused(id),
    checkpoint:()=>getVault().checkpoint(),
    importCodex:async text=>getVault().save({...window.CredentialVault.parseCodex(text),consumers:['cli.codex']}),
    async migrateLegacyKeyring(){
      const owner=window.state.currentUserId, broker=getVault(owner);if(!broker.isUnlocked)throw new Error('Unlock the vault first.');
      let moved=0;
      for(const provider of Object.keys(credentialConsumers)){
        if(owner!==window.state.currentUserId)throw new Error('Profile changed during migration.');
        const path='/etc/portfolios/vault/'+provider+'.json',record=await window.SystemFS.readFile(path);if(!record)continue;
        const text=typeof record.data==='string'?record.data:await window.readFilesystemRecordText(record);
        let secret;try{secret=JSON.parse(text);}catch{throw new Error('Legacy keyring contains invalid JSON. No unsaved record was deleted.');}
        if(secret.profileId!==owner)throw new Error('Legacy login has no matching private-profile owner. Import a selected provider login file instead.');
        await broker.save({provider,accountId:String(secret.account||provider),label:String(secret.account||provider),secret,consumers:[credentialConsumers[provider]]});
        if(owner!==window.state.currentUserId)throw new Error('Profile changed during migration.');
        await window.SystemFS.deleteFile(path,{expectedRecord:record});moved++;
      }return {moved};
    },
    showAccountsModal() {
      const owner=window.state?.currentUserId;getVault(owner);
      const existing=document.querySelector('[data-vault-accounts]');if(existing){existing.focus();return;}
      const dialog=document.createElement('dialog');dialog.className='vault-accounts';dialog.dataset.vaultAccounts='';dialog.setAttribute('aria-label','Saved tool logins');
      dialog.innerHTML='<header><h2>Saved tool logins</h2><button type="button" data-close aria-label="Close saved logins">Close</button></header><p>Logins stay encrypted in your private vault. Each subsystem chooses a saved account. Closing an app does not delete its saved login.</p><p data-status role="status" aria-live="polite"></p><div class="vault-account-actions"><button data-setup>Set up vault</button><button data-unlock>Unlock vault</button><label>Import Codex login JSON<input data-import type="file" accept=".json,application/json"></label><button data-migrate>Move legacy keyring into vault</button></div><p>Import reads the selected file directly into encrypted storage; it does not upload it or save a plaintext SystemFS copy. A saved login is not proof of live CLI authentication.</p><div data-accounts></div>';
      const events=new AbortController(), find=q=>dialog.querySelector(q), message=text=>{if(dialog.isConnected&&owner===window.state?.currentUserId)find('[data-status]').textContent=text;};
      const run=fn=>async event=>{const target=event?.currentTarget;try{if(target)target.disabled=true;await fn();await render();}catch(error){message(error.message);}finally{if(target)target.disabled=false;}};
      const close=()=>dialog.close();
      const button=(text,fn)=>{const node=document.createElement('button');node.type='button';node.textContent=text;node.addEventListener('click',run(fn),{signal:events.signal});return node;};
      async function render(){
        if(owner!==window.state?.currentUserId){close();return;}
        const state=await getVault(owner).status();if(!dialog.isConnected||owner!==window.state?.currentUserId)return;
        find('[data-import]').disabled=state.isLocked;find('[data-migrate]').disabled=state.isLocked;
        find('[data-setup]').hidden=state.initialized;find('[data-unlock]').hidden=!state.initialized||!state.isLocked;
        const list=find('[data-accounts]');list.replaceChildren();
        if(state.isLocked){message(state.initialized?'Vault locked. Unlock once to access saved accounts.':'Set a master passphrase before saving logins.');return;}
        message(state.credentials.length+' saved login(s). Unused logins are retained until you choose Remove.');
        for(const entry of state.credentials){
          const card=document.createElement('section');card.className='vault-account-card';
          const title=document.createElement('h3');title.textContent=entry.label;card.append(title);
          const details=document.createElement('p');details.textContent=entry.provider+' · '+entry.accountId;card.append(details);
          const select=document.createElement('select');select.setAttribute('aria-label','Subsystem for '+entry.label);
          for(const [consumer,provider]of Object.entries(window.CredentialVault.consumers))if(provider===entry.provider){const option=document.createElement('option');option.value=consumer;option.textContent=consumer;select.append(option);}
          card.append(select,button('Link selected subsystem',()=>window.PortfoliOSVault.link(entry.id,select.value)));
          for(const consumer of entry.consumers)card.append(button('Unlink '+consumer,()=>window.PortfoliOSVault.unlink(consumer)));
          if(!entry.consumers.length){
            const note=document.createElement('p');note.textContent='Unused by saved subsystem links. You may keep it for later or remove it.';card.append(note);
            const remove=document.createElement('button');remove.type='button';remove.textContent='Remove unused login';
            remove.addEventListener('click',()=>{
              remove.hidden=true;
              card.append(button('Confirm removal',()=>window.PortfoliOSVault.removeUnused(entry.id)),button('Keep login',async()=>{}));
            },{signal:events.signal});card.append(remove);
          }
          list.append(card);
        }
      }
      const refresh=()=>{void render().catch(error=>message(error.message));};
      find('[data-close]').addEventListener('click',close,{signal:events.signal});
      find('[data-setup]').addEventListener('click',()=>{close();window.PortfoliOSVault.showSetupModal({onComplete:()=>window.PortfoliOSVault.showAccountsModal()});},{signal:events.signal});
      find('[data-unlock]').addEventListener('click',()=>{close();window.PortfoliOSVault.showUnlockModal({onUnlock:()=>window.PortfoliOSVault.showAccountsModal()});},{signal:events.signal});
      find('[data-migrate]').addEventListener('click',run(()=>window.PortfoliOSVault.migrateLegacyKeyring()),{signal:events.signal});
      find('[data-import]').addEventListener('change',run(async()=>{
        const input=find('[data-import]'),file=input.files?.[0];if(!file)return;
        try{if(file.size>256*1024)throw new Error('Credential file exceeds the size limit.');await window.PortfoliOSVault.importCodex(await file.text());}finally{input.value='';}
      }),{signal:events.signal});
      window.addEventListener('portfolios:vault-status-changed',refresh,{signal:events.signal});
      dialog.addEventListener('close',()=>{find('[data-import]').value='';events.abort();dialog.remove();},{once:true});
      document.body.append(dialog);dialog.showModal();refresh();
    },
    closeModal() {
      if (typeof document === 'undefined') return;
      const backdrop = document.getElementById('vault-modal-backdrop');
      if (backdrop) {backdrop.style.display = 'none';for(const input of backdrop.querySelectorAll('input'))input.value='';}
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
          window.PortfoliOSVault.closeModal();
        };

        let pending = false, cancelled = false;
        const doUnlock = async () => {
          if (pending || cancelled) return;
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

          pending = true;
          try {
            const res = await window.PortfoliOSVault.unlockWithPassphrase(pass);
            if (cancelled) return;
            cleanup();
            if (typeof options.onUnlock === 'function') options.onUnlock(res);
            resolve(res);
          } catch (err) {
            pending = false;
            if (cancelled) return;
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
            cancelled = true;
            if (pending) getVault().lock();
            cleanup();
            if (typeof options.onCancel === 'function') options.onCancel();
            resolve({ success: false, cancelled: true });
          };
        }
        if (purgeLink) {
          purgeLink.onclick = () => {
            cancelled = true;
            if (pending) getVault().lock();
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
        if (purgeSubmit) { purgeSubmit.disabled = true; purgeSubmit.innerHTML = '<i class="fa-solid fa-trash-can"></i> Purge vault &amp; reset'; }
        if (purgeCancel) purgeCancel.disabled = false;
        if (purgeErr) purgeErr.hidden = true;

        if (confirmInput && purgeSubmit) {
          confirmInput.oninput = () => {
            purgeSubmit.disabled = confirmInput.value.trim() !== 'PURGE';
          };
        }

        const cleanup = () => {
          window.PortfoliOSVault.closeModal();
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
            if (confirmInput?.value.trim() !== 'PURGE') return;
            purgeSubmit.disabled = true;
            if (purgeCancel) purgeCancel.disabled = true;
            purgeSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Purging...';
            try {
              await window.PortfoliOSVault.purgeAndReset();
              cleanup();
              if (typeof options.onPurged === 'function') options.onPurged();
              resolve({ success: true, purged: true });
            } catch (err) {
              purgeSubmit.disabled = false;
              if (purgeCancel) purgeCancel.disabled = false;
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
        const reqMatch = document.getElementById('vreq-match');

        if (!backdrop || !viewSetup) {
          resolve({ success: false, reason: 'Modal elements not found' });
          return;
        }

        backdrop.style.display = 'flex';
        viewSetup.style.display = 'block';
        if (viewUnlock) viewUnlock.style.display = 'none';
        if (viewPurge) viewPurge.style.display = 'none';

        if (pass1) { pass1.value = ''; pass1.type = 'password'; pass1.focus(); }
        if (pass2) pass2.value = '';
        if (submitBtn) submitBtn.disabled = true;
        if (errBox) errBox.hidden = true;

        const updateCriteria = () => {
          const val1 = pass1?.value || '';
          const val2 = pass2?.value || '';
          const validation = window.CredentialVault.validatePassword(val1);

          const hasLen = val1.length >= 14;
          const hasMatch = val1.length > 0 && val1 === val2;

          if (reqLen) {
            reqLen.className = `vault-req ${hasLen ? 'met' : ''}`;
            const icon = reqLen.querySelector('i');
            if (icon) icon.className = hasLen ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle';
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

        let pending = false, cancelled = false;
        const cleanup = () => {
          window.PortfoliOSVault.closeModal();
        };

        if (cancelBtn) {
          cancelBtn.onclick = () => {
            cancelled = true;
            if (pending) getVault().lock();
            cleanup();
            if (typeof options.onCancel === 'function') options.onCancel();
            resolve({ success: false, cancelled: true });
          };
        }

        if (submitBtn) {
          submitBtn.onclick = async () => {
            if (pending || cancelled) return;
            pending = true;
            const pass = pass1?.value || '';
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Initializing...';
            try {
              const res = await window.PortfoliOSVault.initWithPassphrase(pass);
              if (cancelled) return;
              cleanup();
              if (typeof options.onComplete === 'function') options.onComplete(res);
              resolve(res);
            } catch (err) {
              pending = false;
              if (cancelled) return;
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

  const revokeProfile=()=>{
    window.PortfoliOSRuntimeBridge.closeAll();
    for(const state of vaultSessions.values())state.broker.close();vaultSessions.clear();
    window.PortfoliOSVault.closeModal();
    document.querySelector?.('[data-vault-accounts]')?.close();
  };
  window.EventBus?.on?.('user:changed',revokeProfile);
  if(typeof window.addEventListener==='function')window.addEventListener('pagehide',revokeProfile);
})();
