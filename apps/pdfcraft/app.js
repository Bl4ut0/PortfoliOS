(function () {
  const sessions = new WeakMap();
  const LIMIT = 64 * 1024 * 1024;
  const safeName = value => String(value || 'document.pdf').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 110).replace(/(?:\.pdf)?$/i, '.pdf');
  function mount(root) {
    const owner = window.state.currentUserId;
    const abort = new AbortController();
    const status = root.querySelector('[data-pdf-status]');
    const picker = root.querySelector('[data-pdf-files]');
    const frame = root.querySelector('iframe');
    let alive = true, ready = false, dirty = false, pending = 0, failedSaves = new Map(), timer;
    let writes = Promise.resolve();
    const paths = new Map();
    const current = () => alive && owner === window.state.currentUserId;
    const assert = () => { if (!current()) throw new Error('The PdfCraft workspace has changed.'); };
    const say = message => { if (current()) status.textContent = message; };
    async function refresh() {
      assert();
      const rows = [...await window.SystemFS.readDir('/documents'), ...await window.SystemFS.readDir('/documents/PdfCraft')];
      assert(); picker.replaceChildren(new Option('Choose a workspace PDF', ''));
      rows.filter(row => !row.isDirectory && /\.pdf$/i.test(row.name)).forEach(row => picker.add(new Option(row.path, row.path)));
    }
    async function open(record) {
      assert(); if (!ready) throw new Error('Wait for the editor to finish loading.');
      if (!record || record.isDirectory || record.size > LIMIT || !/\.pdf$/i.test(record.name)) throw new Error('Choose a PDF up to 64 MiB.');
      const bytes = await new Blob([record.data]).arrayBuffer(); assert();
      if (bytes.byteLength > LIMIT || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('This file is not a supported PDF.');
      let name = safeName(record.name);
      // Unique engine tab names keep same-named workspace files from overwriting each other.
      if (paths.has(name) && paths.get(name) !== record.path) name = name.replace(/\.pdf$/i, '-' + crypto.randomUUID().slice(0, 8) + '.pdf');
      paths.set(name, record.path);
      frame.contentWindow.postMessage({ type: 'pdfcraft:open', name, bytes }, '*', [bytes]);
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
      await refresh();
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
        ready = true; clearTimeout(timer); say('Editor ready. Open a workspace PDF or import one.');
      } else if (message.type === 'pdfcraft:dirty' && typeof message.dirty === 'boolean') dirty = message.dirty;
      else if (message.type === 'pdfcraft:save' && typeof message.name === 'string' && message.name.length <= 512 && message.bytes instanceof ArrayBuffer && message.bytes.byteLength > 0 && message.bytes.byteLength <= LIMIT) queueSave(message);
      else if (message.type === 'pdfcraft:failed') { clearTimeout(timer); say('Editor failed to start. Close and reopen to retry.'); }
    }, { signal: abort.signal });
    const act = callback => async () => { try { await callback(); } catch (error) { say(error.message); } };
    root.querySelector('[data-pdf-open]').addEventListener('click', act(async () => open(await window.SystemFS.readFile(picker.value))), { signal: abort.signal });
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
      await refresh(); await open(outcome.record);
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
      close() { alive = false; clearTimeout(timer); abort.abort(); frame.remove(); sessions.delete(root); }
    });
    refresh().catch(error => say(error.message));
    timer = setTimeout(() => { if (!ready) { frame.removeAttribute('src'); say('Editor startup timed out. Close and reopen to retry.'); } }, 90000);
    frame.src = 'apps/pdfcraft/runtime/index.php/index.html?host=parent';
  }
  window.appRegistry.pdfcraft = {
    title: 'PdfCraft', icon: 'fa-solid fa-file-pdf', windowClass: 'pdfcraft-window document-window',
    renderBody: () => `<main class="pdfcraft-host"><div class="pdfcraft-toolbar"><label>Workspace PDF <select data-pdf-files aria-label="Workspace PDF"></select></label><button type="button" data-pdf-open>Open PDF</button><label class="pdfcraft-import">Import PDF<input type="file" accept="application/pdf,.pdf" data-pdf-import></label><button type="button" data-pdf-retry>Retry save</button></div><p role="status" data-pdf-status>Loading PdfCraft 0.6.0 (41 MB runtime on first launch)Ã¢â‚¬Â¦</p><iframe title="PdfCraft PDF editor" sandbox="allow-scripts allow-downloads" referrerpolicy="no-referrer"></iframe></main>`,
    onOpen: mount,
    beforeClose: root => sessions.get(root)?.beforeClose(),
    onClose: root => sessions.get(root)?.close()
  };
})();
