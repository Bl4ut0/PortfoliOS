(function () {
  const sessions = new WeakMap();
  const safeName = value => String(value || 'photo.dng').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 110);

  function mount(root) {
    const owner = window.state.currentUserId;
    const abort = new AbortController();
    const status = root.querySelector('[data-lightcraft-status]');
    const frame = root.querySelector('iframe');
    let alive = true, ready = false, dirty = false, timer;

    const current = () => alive && owner === window.state.currentUserId;
    const assert = () => { if (!current()) throw new Error('The LightCraft workspace has changed.'); };

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
        type: record.type || 'image/jpeg',
        source: 'lightcraft-open',
        options: { metadata: record.metadata || {} }
      });
      assert();
      if (inspected.status !== 'accepted') throw new Error('File quarantined. Review it in Security Center.');

      const name = safeName(record.name);
      frame.contentWindow.postMessage({
        type: 'lightcraft:file-result',
        id: requestId,
        files: [{ name, bytes, type: record.type || 'image/jpeg' }]
      }, '*', [bytes]);

      say(`Opened ${name} in LightCraft WASM.`);
    }

    async function handleOpenRequest(requestId) {
      assert();
      try {
        const choice = await window.SystemFS.showOpenDialog?.({
          title: 'Open RAW / Photo in LightCraft',
          folder: '/documents',
          types: ['.raw', '.dng', '.cr2', '.nef', '.arw', '.jpg', '.jpeg', '.png', '.tiff']
        });
        if (choice?.record) {
          await sendFileToEditor(requestId, choice.record);
        } else {
          frame.contentWindow.postMessage({
            type: 'lightcraft:file-result',
            id: requestId,
            files: []
          }, '*');
        }
      } catch (err) {
        say(`Open failed: ${err.message}`);
        frame.contentWindow.postMessage({
          type: 'lightcraft:file-result',
          id: requestId,
          files: []
        }, '*');
      }
    }

    window.addEventListener('message', async (event) => {
      if (!current() || event.source !== frame.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'lightcraft:ready' || message.type === 'LightCraftStarted') {
        ready = true;
        clearTimeout(timer);
        const loadingEl = root.querySelector('[data-lightcraft-loading]');
        if (loadingEl) loadingEl.hidden = true;
        say('Editor ready');
        if (root.launchParams?.path) {
          const rec = await window.SystemFS.readFile(root.launchParams.path);
          if (rec) await sendFileToEditor('launch', rec);
        }
      } else if (message.type === 'lightcraft:request-open') {
        await handleOpenRequest(message.id);
      } else if (message.type === 'lightcraft:drop') {
        try {
          const name = safeName(message.name);
          let path = '/documents/LightCraft/' + name;
          await window.SystemFS.ensureDirectory('/documents/LightCraft', { silent: true });
          const outcome = await window.SecurityKernel.importFile({
            path,
            parent: '/documents/LightCraft',
            name,
            data: message.bytes,
            size: message.bytes.byteLength,
            type: 'image/jpeg',
            source: 'lightcraft-import'
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
          say('Save photos in LightCraft before closing.');
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
      const loadingEl = root.querySelector('[data-lightcraft-loading]');
      if (loadingEl && !ready) {
        loadingEl.hidden = true;
        say('LightCraft WASM canvas active.');
      }
    }, 15000);

    frame.src = 'apps/lightcraft/runtime/index.php/host.html?host=parent';
  }

  window.appRegistry.lightcraft = {
    title: 'LightCraft',
    icon: 'fa-solid fa-sun',
    windowClass: 'lightcraft-window media-window',
    renderBody: () => `
      <main class="lightcraft-host">
        <p role="status" class="lightcraft-status" data-lightcraft-status>Loading LightCraft WASM...</p>
        <div data-lightcraft-loading class="lightcraft-loading">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <span>Loading LightCraft (Rust / WebAssembly / RAW Engine)...</span>
        </div>
        <iframe title="LightCraft RAW Photo Developer" sandbox="allow-scripts allow-downloads allow-same-origin" referrerpolicy="no-referrer"></iframe>
      </main>
    `,
    onOpen: mount,
    beforeClose: root => sessions.get(root)?.beforeClose(),
    onClose: root => sessions.get(root)?.close()
  };
})();
