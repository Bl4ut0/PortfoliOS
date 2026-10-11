(function () {
  const sessions = new WeakMap();
  const safeName = value => String(value || 'project.fx').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 110);

  function mount(root) {
    const owner = window.state.currentUserId;
    const abort = new AbortController();
    const status = root.querySelector('[data-effectcraft-status]');
    const frame = root.querySelector('iframe');
    let alive = true, ready = false, dirty = false, timer;

    const current = () => alive && owner === window.state.currentUserId;
    const assert = () => { if (!current()) throw new Error('The EffectCraft workspace has changed.'); };

    const say = message => {
      if (!current()) return;
      if (status) status.textContent = message;
      if (message !== 'Editor ready') window.showDesktopToast?.(message);
    };

    async function sendFileToEditor(requestId, record) {
      assert();
      if (!record || !record.data) throw new Error('File data is missing.');
      let bytes;
      if (record.data instanceof ArrayBuffer) bytes = record.data;
      else if (record.data instanceof Uint8Array) bytes = record.data.buffer.slice(record.data.byteOffset, record.data.byteOffset + record.data.byteLength);
      else if (record.data instanceof Blob) bytes = await record.data.arrayBuffer();
      else if (typeof record.data === 'string') bytes = new TextEncoder().encode(record.data).buffer;
      else throw new Error('Unsupported file data format.');

      const inspected = await window.SecurityKernel.importFile({
        path: record.path,
        name: record.name,
        parent: record.parent,
        data: bytes,
        size: bytes.byteLength,
        type: record.type || 'application/octet-stream',
        source: 'effectcraft-open',
        options: { metadata: record.metadata || {} }
      });
      assert();
      if (inspected.status !== 'accepted') throw new Error('File quarantined. Review it in Security Center.');

      const name = safeName(record.name);
      frame.contentWindow.postMessage({
        type: 'effectcraft:file-result',
        id: requestId,
        files: [{ name, bytes, type: record.type || 'application/octet-stream' }]
      }, '*', [bytes]);

      say(`Opened ${name} in EffectCraft WASM.`);
    }

    async function handleOpenRequest(requestId) {
      assert();
      try {
        const choice = await window.SystemFS.showOpenDialog?.({
          title: 'Open Composition in EffectCraft',
          folder: '/documents',
          types: ['.fx', '.json', '.png', '.jpg', '.mp4', '.mov']
        });
        if (choice?.record) {
          await sendFileToEditor(requestId, choice.record);
        } else {
          frame.contentWindow.postMessage({
            type: 'effectcraft:file-result',
            id: requestId,
            files: []
          }, '*');
        }
      } catch (err) {
        say(`Open failed: ${err.message}`);
        frame.contentWindow.postMessage({
          type: 'effectcraft:file-result',
          id: requestId,
          files: []
        }, '*');
      }
    }

    window.addEventListener('message', async (event) => {
      if (!current() || event.source !== frame.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'effectcraft:ready' || message.type === 'EffectCraftStarted') {
        ready = true;
        clearTimeout(timer);
        const loadingEl = root.querySelector('[data-effectcraft-loading]');
        if (loadingEl) loadingEl.hidden = true;
        say('Editor ready');
        if (root.launchParams?.path) {
          const rec = await window.SystemFS.readFile(root.launchParams.path);
          if (rec) await sendFileToEditor('launch', rec);
        }
      } else if (message.type === 'effectcraft:request-open') {
        await handleOpenRequest(message.id);
      } else if (message.type === 'effectcraft:drop') {
        try {
          const name = safeName(message.name);
          let path = '/documents/EffectCraft/' + name;
          await window.SystemFS.ensureDirectory('/documents/EffectCraft', { silent: true });
          const outcome = await window.SecurityKernel.importFile({
            path,
            parent: '/documents/EffectCraft',
            name,
            data: message.bytes,
            size: message.bytes.byteLength,
            type: 'application/octet-stream',
            source: 'effectcraft-import'
          });
          if (outcome.status !== 'accepted') throw new Error('File quarantined by SecurityKernel.');
          say(`Imported ${name} into workspace.`);
        } catch (err) {
          say(`Drop import failed: ${err.message}`);
        }
      }
    }, { signal: abort.signal });

    root.addEventListener('launch-params', async (e) => {
      const p = e.detail || root.launchParams;
      if (p?.path && ready) {
        const rec = await window.SystemFS.readFile(p.path);
        if (rec) await sendFileToEditor('launch', rec);
      }
    }, { signal: abort.signal });

    sessions.set(root, {
      beforeClose() {
        if (dirty) {
          say('Save project before closing.');
          return false;
        }
        return true;
      },
      close() {
        alive = false;
        clearTimeout(timer);
        abort.abort();
        frame.remove();
        sessions.delete(root);
      }
    });

    timer = setTimeout(() => {
      const loadingEl = root.querySelector('[data-effectcraft-loading]');
      if (loadingEl && !ready) {
        loadingEl.hidden = true;
        say('EffectCraft WASM canvas active.');
      }
    }, 15000);

    frame.src = 'apps/effectcraft/runtime/index.php/host.html?host=parent';
  }

  window.appRegistry.effectcraft = {
    title: 'EffectCraft',
    icon: 'fa-solid fa-wand-magic-sparkles',
    windowClass: 'effectcraft-window media-window',
    renderBody: () => `
      <main class="effectcraft-host">
        <p role="status" class="effectcraft-status" data-effectcraft-status>Loading EffectCraft WASM...</p>
        <div data-effectcraft-loading class="effectcraft-loading">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <span>Loading EffectCraft (Rust / WebAssembly / VFX Engine)...</span>
        </div>
        <iframe title="EffectCraft Motion Graphics and VFX Editor" sandbox="allow-scripts allow-downloads allow-same-origin" referrerpolicy="no-referrer"></iframe>
      </main>
    `,
    onOpen: mount,
    beforeClose: root => sessions.get(root)?.beforeClose(),
    onClose: root => sessions.get(root)?.close()
  };
})();
