(function () {
  const sessions = new WeakMap();
  const LIMIT = 128 * 1024 * 1024;
  const safeName = value => String(value || 'artwork.png').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 110);

  function mount(root) {
    const owner = window.state.currentUserId;
    const abort = new AbortController();
    const status = root.querySelector('[data-photocraft-status]');
    const frame = root.querySelector('iframe');
    let alive = true, ready = false, dirty = false, timer;

    const current = () => alive && owner === window.state.currentUserId;
    const assert = () => { if (!current()) throw new Error('The PhotoCraft workspace has changed.'); };

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
        type: record.type || 'image/png',
        source: 'photocraft-open',
        options: { metadata: record.metadata || {} }
      });
      assert();
      if (inspected.status !== 'accepted') throw new Error('File quarantined. Review it in Security Center.');

      const name = safeName(record.name);
      frame.contentWindow.postMessage({
        type: 'photocraft:file-result',
        id: requestId,
        files: [{ name, bytes, type: record.type || 'image/png' }]
      }, '*', [bytes]);

      say(`Opened ${name} in PhotoCraft WASM.`);
    }

    async function handleOpenRequest(requestId) {
      assert();
      try {
        const choice = await window.SystemFS.showOpenDialog?.({
          title: 'Open Image in PhotoCraft',
          folder: '/documents',
          types: ['.png', '.jpg', '.jpeg', '.webp', '.psd', '.bmp', '.gif']
        });
        if (choice?.record) {
          await sendFileToEditor(requestId, choice.record);
        } else {
          // Send empty result to clear pending
          frame.contentWindow.postMessage({
            type: 'photocraft:file-result',
            id: requestId,
            files: []
          }, '*');
        }
      } catch (err) {
        say(`Open failed: ${err.message}`);
        frame.contentWindow.postMessage({
          type: 'photocraft:file-result',
          id: requestId,
          files: []
        }, '*');
      }
    }

    window.addEventListener('message', async (event) => {
      if (!current() || event.source !== frame.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'photocraft:ready' || message.type === 'TrunkApplicationStarted') {
        ready = true;
        clearTimeout(timer);
        const loadingEl = root.querySelector('[data-photocraft-loading]');
        if (loadingEl) loadingEl.hidden = true;
        say('Editor ready');
        if (root.launchParams?.path) {
          const rec = await window.SystemFS.readFile(root.launchParams.path);
          if (rec) await sendFileToEditor('launch', rec);
        }
      } else if (message.type === 'photocraft:request-open') {
        await handleOpenRequest(message.id);
      } else if (message.type === 'photocraft:drop') {
        try {
          const name = safeName(message.name);
          let path = '/documents/PhotoCraft/' + name;
          await window.SystemFS.ensureDirectory('/documents/PhotoCraft', { silent: true });
          const outcome = await window.SecurityKernel.importFile({
            path,
            parent: '/documents/PhotoCraft',
            name,
            data: message.bytes,
            size: message.bytes.byteLength,
            type: 'image/png',
            source: 'photocraft-import'
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
          say('Save artwork in PhotoCraft before closing.');
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
      const loadingEl = root.querySelector('[data-photocraft-loading]');
      if (loadingEl && !ready) {
        loadingEl.hidden = true;
        say('PhotoCraft WASM canvas active.');
      }
    }, 15000);

    frame.src = 'apps/photocraft/runtime/index.php/host.html?host=parent';
  }

  window.appRegistry.photocraft = {
    title: 'PhotoCraft',
    icon: 'fa-solid fa-image',
    windowClass: 'photocraft-window media-window',
    renderBody: () => `
      <main class="photocraft-host">
        <p role="status" class="photocraft-status" data-photocraft-status>Loading PhotoCraft WASM...</p>
        <div data-photocraft-loading class="photocraft-loading">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <span>Loading PhotoCraft (Rust / WebAssembly / WebGPU)...</span>
        </div>
        <iframe title="PhotoCraft Image Editor" sandbox="allow-scripts allow-downloads allow-same-origin" referrerpolicy="no-referrer"></iframe>
      </main>
    `,
    onOpen: mount,
    beforeClose: root => sessions.get(root)?.beforeClose(),
    onClose: root => sessions.get(root)?.close()
  };
})();
