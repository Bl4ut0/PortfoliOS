/* PortfoliOS browser-environment adapter for FilmCraft. Upstream JS/WASM bytes stay unchanged. */
(() => {
  const nativeClick = HTMLInputElement.prototype.click;
  let pending = null;
  HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return nativeClick.call(this);
    if (pending) return;
    pending = { input: this, id: crypto.randomUUID() };
    parent.postMessage({ type: 'filmcraft:request-open', id: pending.id, multiple: this.multiple }, location.origin);
  };
  addEventListener('dragover', event => { event.preventDefault(); }, true);
  addEventListener('drop', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const file = event.dataTransfer?.files[0];
    if (!file || file.size > 512 * 1024 * 1024) return;
    const bytes = await file.arrayBuffer();
    parent.postMessage({ type: 'filmcraft:drop', name: file.name, bytes }, location.origin, [bytes]);
  }, true);
  addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'filmcraft:file-result' || event.data.id !== pending?.id) return;
    const input = pending.input; pending = null;
    const transfer = new DataTransfer();
    for (const file of (Array.isArray(event.data.files) ? event.data.files.slice(0, 16) : [])) {
      if (typeof file.name === 'string' && file.bytes instanceof ArrayBuffer && file.bytes.byteLength <= 512 * 1024 * 1024) {
        transfer.items.add(new File([file.bytes], file.name, { type: file.type || 'video/mp4' }));
      }
    }
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  });
})();
