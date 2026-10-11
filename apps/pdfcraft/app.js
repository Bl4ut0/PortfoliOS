(function () {
  const sessions = new WeakMap();
  const LIMIT = 64 * 1024 * 1024;
  const safeName = value => String(value || 'document.pdf').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 110).replace(/(?:\.pdf)?$/i, '.pdf');
  function mount(root) {
    const owner = window.state.currentUserId;
    const abort = new AbortController();
    const status = root.querySelector('[data-pdf-status]');
    const dialog = root.querySelector('[data-pdf-dialog]');
    const list = root.querySelector('[data-pdf-list]');
    let openRequest = null;
    const frame = root.querySelector('iframe');
    let alive = true, ready = false, dirty = false, pending = 0, failedSaves = new Map(), timer;
    let writes = Promise.resolve();
    const paths = new Map();
    const current = () => alive && owner === window.state.currentUserId;
    const assert = () => { if (!current()) throw new Error('The PdfCraft workspace has changed.'); };
    const say = message => {
      if (!current()) return;
      status.textContent = message;
      const failed = failedSaves.size > 0;
      root.querySelector('[data-pdf-retry]').hidden = !failed;
      if (message !== 'Editor ready') window.showDesktopToast?.(message);
    };
    async function choose(id) {
      assert(); if (openRequest) return;
      openRequest = id; list.replaceChildren(); dialog.showModal();
      const rows = await window.SystemFS.getAllFiles(); assert();
      rows.filter(row => !row.isDirectory && /\.pdf$/i.test(row.name) && !row.path.startsWith('/.quarantine/')).forEach(row => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = row.path; button.dataset.pdfPath = row.path;
        button.addEventListener('click', act(async () => { await open(await window.SystemFS.readFile(row.path)); }), { signal: abort.signal }); list.append(button);
      });
      if (!list.children.length) list.textContent = 'No PDFs in this profile yet. Import one from your device.';
    }
    function finishChoice(files = []) {
      if (openRequest) frame.contentWindow.postMessage({ type: 'pdfcraft:file-result', id: openRequest, files }, '*', files.map(file => file.bytes));
      openRequest = null; dialog.close();
    }
    async function open(record) {
      assert(); if (!ready) throw new Error('Wait for the editor to finish loading.');
      if (!record || record.isDirectory || record.size > LIMIT || !/\.pdf$/i.test(record.name)) throw new Error('Choose a PDF up to 64 MiB.');
      const bytes = await new Blob([record.data]).arrayBuffer(); assert();
      if (bytes.byteLength > LIMIT || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('This file is not a supported PDF.');
      const inspected = await window.SecurityKernel.importFile({ path: record.path, name: record.name, parent: record.parent, data: bytes, size: bytes.byteLength, type: 'application/pdf', source: 'pdfcraft-open', options: { metadata: record.metadata || {} } });
      assert(); if (inspected.status !== 'accepted') throw new Error('File quarantined. Review it in Security Center.');
      let name = safeName(record.name);
      // Unique engine tab names keep same-named workspace files from overwriting each other.
      if (paths.has(name) && paths.get(name) !== record.path) name = name.replace(/\.pdf$/i, '-' + crypto.randomUUID().slice(0, 8) + '.pdf');
      paths.set(name, record.path);
      if (openRequest) finishChoice([{ name, bytes }]);
      else frame.contentWindow.postMessage({ type: 'pdfcraft:open', name, bytes }, '*', [bytes]);
      say('Opened ' + name + '. Use Save in PdfCraft to write changes to this workspace.');
    }
    async function save(message) {
      assert();
      const name = safeName(message.name);
      let path = !message.saveAs && paths.get(name);
      if (!path) {
        path = '/documents/PdfCraft/' + name;
        if (await window.SystemFS.readFile(path)) path = '/documents/PdfCraft/' + name.replace(/\.pdf$/i, '-' + crypto.randomUUID().slice(0, 8) + '.pdf');
      }
      assert();
      const outcome = await window.SecurityKernel.importFile({ path, name: window.SystemFS.getName(path), parent: window.SystemFS.getParentPath(path), data: message.bytes, size: message.bytes.byteLength, type: 'application/pdf', source: 'pdfcraft-output' });
      assert();
      if (outcome.status !== 'accepted') throw new Error('The exported PDF was quarantined. Review it in Security Center.');
      paths.set(name, path); failedSaves.delete(name);
      say('Saved ' + path + '. ' + (owner === 'bl4ut0' ? 'Public workspace resets on reload.' : 'Drive backup follows your workspace sync settings.'));

    }
    function queueSave(message) {
      pending++;
      writes = writes.then(() => save(message)).catch(error => {
        if (current()) { failedSaves.set(safeName(message.name), message); say('Save failed: ' + error.message + ' Use Retry save before closing.'); }
      }).finally(() => pending--);
    }
    window.addEventListener('message', event => {
      // Opaque sandbox replies have origin "null". The exact owned WindowProxy is mandatory.
      if (!current() || event.source !== frame.contentWindow || event.origin !== 'null') return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'pdfcraft:ready') {
        ready = true; clearTimeout(timer); root.querySelector('[data-pdf-loading]').hidden = true; say('Editor ready');
        if (root.launchParams?.path) act(async () => open(await window.SystemFS.readFile(root.launchParams.path)))();
      } else if (message.type === 'pdfcraft:request-open' && typeof message.id === 'string' && message.id.length <= 64) act(() => choose(message.id))();
      else if (message.type === 'pdfcraft:dirty' && typeof message.dirty === 'boolean') dirty = message.dirty;
      else if (message.type === 'pdfcraft:save' && typeof message.name === 'string' && message.name.length <= 512 && message.bytes instanceof ArrayBuffer && message.bytes.byteLength > 0 && message.bytes.byteLength <= LIMIT) queueSave(message);
      else if (message.type === 'pdfcraft:failed') { clearTimeout(timer); say('Editor failed to start. Close and reopen to retry.'); }
    }, { signal: abort.signal });
    const act = callback => async () => { try { await callback(); } catch (error) { say(error.message); } };
    root.querySelector('[data-pdf-cancel]').addEventListener('click', () => finishChoice(), { signal: abort.signal });
    dialog.addEventListener('cancel', event => { event.preventDefault(); finishChoice(); }, { signal: abort.signal });
    root.addEventListener('launch-params', act(async () => { if (ready && root.launchParams?.path) await open(await window.SystemFS.readFile(root.launchParams.path)); }), { signal: abort.signal });
    root.querySelector('[data-pdf-import]').addEventListener('change', act(async () => {
      const input = root.querySelector('[data-pdf-import]'), file = input.files[0]; input.value = '';
      if (!file) return;
      assert(); if (!ready) throw new Error('Wait for the editor to finish loading.');
      if (file.size > LIMIT || !/\.pdf$/i.test(file.name)) throw new Error('Choose a PDF up to 64 MiB.');
      const name = safeName(file.name);
      let path = '/documents/PdfCraft/' + name;
      if (await window.SystemFS.readFile(path)) path = '/documents/PdfCraft/' + name.replace(/\.pdf$/i, '-' + crypto.randomUUID().slice(0, 8) + '.pdf');
      assert(); const outcome = await window.SecurityKernel.importFile({ path, parent: '/documents/PdfCraft', name: window.SystemFS.getName(path), data: file, size: file.size, type: file.type, source: 'pdfcraft-import' });
      assert(); if (outcome.status !== 'accepted') throw new Error('File quarantined. Review it in Security Center.');
      await open(outcome.record);
    }), { signal: abort.signal });
    root.querySelector('[data-pdf-retry]').addEventListener('click', () => { if (current()) for (const message of failedSaves.values()) queueSave(message); }, { signal: abort.signal });
    const unload = event => { if (dirty || pending || failedSaves.size) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', unload, { signal: abort.signal });
    sessions.set(root, {
      async beforeClose() {
        await writes;
        if (dirty || failedSaves.size || pending) { say('Save changes in PdfCraft, or retry the failed save, before closing or switching profiles.'); return false; }
        return true;
      },
      close() { alive = false; clearTimeout(timer); abort.abort(); dialog.close(); frame.remove(); sessions.delete(root); }
    });
    timer = setTimeout(() => { if (!ready) { frame.removeAttribute('src'); say('Editor startup timed out. Close and reopen to retry.'); } }, 90000);
    frame.src = 'apps/pdfcraft/runtime/index.php/host.html?host=parent';
  }
  window.appRegistry.pdfcraft = {
    title: 'PdfCraft', icon: 'fa-solid fa-file-pdf', windowClass: 'pdfcraft-window document-window',
    renderBody: () => `<main class="pdfcraft-host"><p role="status" class="pdfcraft-status" data-pdf-status>Loading PdfCraft...</p><div data-pdf-loading class="pdfcraft-loading">Loading PdfCraft...</div><button type="button" data-pdf-retry hidden>Retry failed save</button><iframe title="PdfCraft PDF editor" sandbox="allow-scripts allow-downloads" referrerpolicy="no-referrer"></iframe><dialog data-pdf-dialog><h2>Open PDF</h2><p>Files from your current profile</p><div data-pdf-list></div><label>Import from device <input type="file" accept="application/pdf,.pdf" data-pdf-import></label><button type="button" data-pdf-cancel>Cancel</button></dialog></main>`,
    onOpen: mount,
    beforeClose: root => sessions.get(root)?.beforeClose(),
    onClose: root => sessions.get(root)?.close()
  };
})();
