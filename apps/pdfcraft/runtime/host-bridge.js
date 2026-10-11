/* PortfoliOS browser-environment adapter. Upstream JS/WASM bytes stay unchanged. */
(() => {
  const nativeClick = HTMLInputElement.prototype.click;
  let pending = null;
  HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return nativeClick.call(this);
    if (pending) return;
    pending = { input: this, id: crypto.randomUUID() };
    parent.postMessage({ type: 'pdfcraft:request-open', id: pending.id, multiple: this.multiple }, location.origin);
  };
  addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'pdfcraft:file-result' || event.data.id !== pending?.id) return;
    const input = pending.input; pending = null;
    const transfer = new DataTransfer();
    for (const file of (Array.isArray(event.data.files) ? event.data.files.slice(0, 16) : [])) {
      if (typeof file.name === 'string' && file.bytes instanceof ArrayBuffer && file.bytes.byteLength <= 64 * 1024 * 1024) transfer.items.add(new File([file.bytes], file.name, { type: 'application/pdf' }));
    }
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  });
})();
