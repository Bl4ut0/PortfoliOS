(function () {
  const sessions = new WeakMap();
  const safeName = value => String(value || 'project.fc').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 110);

  function mount(root) {
    const owner = window.state.currentUserId;
    const abort = new AbortController();
    const status = root.querySelector('[data-filmcraft-status]');
    const frame = root.querySelector('iframe');
    let alive = true, ready = false, dirty = false, timer;

    const current = () => alive && owner === window.state.currentUserId;
    const assert = () => { if (!current()) throw new Error('The FilmCraft workspace has changed.'); };

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
        type: record.type || 'video/mp4',
        source: 'filmcraft-open',
        options: { metadata: record.metadata || {} }
      });
      assert();
      if (inspected.status !== 'accepted') throw new Error('File quarantined. Review it in Security Center.');

      const name = safeName(record.name);
      frame.contentWindow.postMessage({
        type: 'filmcraft:file-result',
        id: requestId,
        files: [{ name, bytes, type: record.type || 'video/mp4' }]
      }, '*', [bytes]);

      say(`Opened ${name} in FilmCraft WASM.`);
    }

    async function handleOpenRequest(requestId) {
      assert();
      try {
        const choice = await window.SystemFS.showOpenDialog?.({
          title: 'Open Media / Timeline in FilmCraft',
          folder: '/documents',
          types: ['.mp4', '.webm', '.mov', '.mkv', '.fc', '.json']
        });
        if (choice?.record) {
          await sendFileToEditor(requestId, choice.record);
        } else {
          frame.contentWindow.postMessage({
            type: 'filmcraft:file-result',
            id: requestId,
            files: []
          }, '*');
        }
      } catch (err) {
        say(`Open failed: ${err.message}`);
        frame.contentWindow.postMessage({
          type: 'filmcraft:file-result',
          id: requestId,
          files: []
        }, '*');
      }
    }

    window.addEventListener('message', async (event) => {
      if (!current() || event.source !== frame.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'filmcraft:ready' || message.type === 'FilmCraftStarted') {
        ready = true;
        clearTimeout(timer);
        const loadingEl = root.querySelector('[data-filmcraft-loading]');
        if (loadingEl) loadingEl.hidden = true;
        say('Editor ready');
        if (root.launchParams?.path) {
          const rec = await window.SystemFS.readFile(root.launchParams.path);
          if (rec) await sendFileToEditor('launch', rec);
        }
      } else if (message.type === 'filmcraft:request-open') {
        await handleOpenRequest(message.id);
      } else if (message.type === 'filmcraft:drop') {
        try {
          const name = safeName(message.name);
          let path = '/documents/FilmCraft/' + name;
          await window.SystemFS.ensureDirectory('/documents/FilmCraft', { silent: true });
          const outcome = await window.SecurityKernel.importFile({
            path,
            parent: '/documents/FilmCraft',
            name,
            data: message.bytes,
            size: message.bytes.byteLength,
            type: 'video/mp4',
            source: 'filmcraft-import'
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
      const loadingEl = root.querySelector('[data-filmcraft-loading]');
      if (loadingEl && !ready) {
        loadingEl.hidden = true;
        say('FilmCraft WASM canvas active.');
      }
    }, 15000);

    frame.src = 'apps/filmcraft/runtime/index.php/host.html?host=parent';
  }

  window.appRegistry.filmcraft = {
    title: 'FilmCraft',
    icon: 'fa-solid fa-film',
    windowClass: 'filmcraft-window media-window',
    renderBody: () => `
      <main class="filmcraft-host">
        <p role="status" class="filmcraft-status" data-filmcraft-status>Loading FilmCraft WASM...</p>
        <div data-filmcraft-loading class="filmcraft-loading">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <span>Loading FilmCraft (Rust / WebAssembly / Video Engine)...</span>
        </div>
        <iframe title="FilmCraft Non-Linear Video Editor" sandbox="allow-scripts allow-downloads allow-same-origin" referrerpolicy="no-referrer"></iframe>
      </main>
    `,
    onOpen: mount,
    beforeClose: root => sessions.get(root)?.beforeClose(),
    onClose: root => sessions.get(root)?.close()
  };
})();
