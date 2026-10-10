/** Release graph and service-worker cache contracts; no browser or network needed. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const manifest = vm.runInNewContext(read('core/loading-manifest.js') + '; PortfolioLoadingManifest');
const build = read('index.html').match(/name="portfolios-build" content="([^"]+)/)[1];
assert.equal(manifest.release, build);
assert(read("sw.js").includes('const SHELL_RELEASE = "' + build + '"'));
assert(read("core/app-loader.js").includes('window.appAssetVersion = "' + build + '"'));
assert(read("mobile/app-loader.js").includes('const assetVersion = "' + build + '"'));
assert(!/data-view-panel|app-template-/.test(read('index.html')));
for (const [view, shell] of Object.entries(manifest.shells)) {
    for (const asset of [...shell.styles, ...shell.scripts, view + '/workspace.html']) assert(fs.existsSync(path.join(root, asset)), asset);
    if (view === 'mobile') assert(!shell.scripts.some(p => p.startsWith('desktop/') || p === 'core/window-manager.js'));
    assert(!shell.scripts.includes('core/local-ai.js') && !shell.scripts.includes('desktop/terminal.js'));
    assert.match(read(view + '/workspace.html'), new RegExp('data-view-panel="' + view + '"'));
}
for (const asset of [...manifest.shared, ...Object.values(manifest.services).flat()]) assert(fs.existsSync(path.join(root, asset)), asset);
for (const group of [manifest.desktopApps, manifest.mobileApps]) for (const deps of Object.values(group)) for (const dep of deps) {
    if (dep.startsWith('@')) assert(manifest.services[dep.slice(1)], dep); else assert(fs.existsSync(path.join(root, dep)), dep);
}
const origin = 'https://test.example';
const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
const buckets = new Map();
const caches = {
    async open(name) {
        if (!buckets.has(name)) buckets.set(name, new Map());
        const map = buckets.get(name);
        return {
            async match(req) { return map.get(key(req))?.clone(); },
            async put(req, response) { map.set(key(req), response.clone()); },
            async keys() { return [...map.keys()].map(url => new Request(url)); }
        };
    },
    async keys() { return [...buckets.keys()]; },
    async delete(name) { return buckets.delete(name); },
    async match(req) { for (const name of buckets.keys()) { const result = await (await this.open(name)).match(req); if (result) return result; } }
};
const handlers = new Map();
let active = 0, maxActive = 0, fetches = 0, failure = null;
class SameOriginRequest extends Request { constructor(input, options) { super(typeof input === 'string' ? new URL(input, origin) : input, options); } }
const sandbox = {
    URL, Request:SameOriginRequest, Response, caches, console,
    self:{ location:{origin}, addEventListener:(name, callback) => handlers.set(name, callback), skipWaiting:async()=>{}, clients:{claim:async()=>{}} },
    fetch:async request => {
        fetches++; active++; maxActive = Math.max(active, maxActive);
        await new Promise(resolve => setTimeout(resolve, 1)); active--;
        const url = key(request);
        if (failure && url.includes(failure)) return new Response('failed', {status:503});
        return new Response('asset:' + url, {status:200});
    }
};
vm.createContext(sandbox); vm.runInContext(read('sw.js'), sandbox);
const install = () => { let pending; handlers.get('install')({waitUntil:promise=>pending=promise}); return pending; };
const activate = () => { let pending; handlers.get('activate')({waitUntil:promise=>pending=promise}); return pending; };
module.exports = (async () => {
    const current = 'portfolio-shell-' + build;
    const old = await caches.open('portfolio-mobile-shell-previous');
    const asset = '/mobile/shell.js?v=' + build;
    await old.put(asset, new Response('current release loaded before activation'));
    await old.put('/mobile/shell.js?v=obsolete', new Response('old release'));
    failure = '/core/staged-loader.js';
    await assert.rejects(install(), /Required boot asset/);
    assert(!buckets.has(current), 'a failed install must not retain a partial boot cache');
    assert(buckets.has('portfolio-mobile-shell-previous'), 'a failed install must retain the active release');
    failure = null; maxActive = 0; await install();
    assert(maxActive <= 3, 'boot downloads must be bounded');
    assert.equal((await (await caches.open(current)).keys()).length, 11);
    await activate();
    assert.equal(await (await (await caches.open(current)).match(asset)).text(), 'current release loaded before activation');
    assert(!await (await caches.open(current)).match('/mobile/shell.js?v=obsolete'));
    assert(!buckets.has('portfolio-mobile-shell-previous'));
    fetches = 0;
    await sandbox.serveMobileShellAsset(new Request(origin + asset));
    assert.equal(fetches, 0, 'exact cached versions must not revalidate');
    sandbox.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(sandbox.serveMobileShellAsset(new Request(origin + '/mobile/shell.js?v=unknown')), /offline/);
    console.log('Loading contracts passed: separate entries, app dependencies, 11-asset bounded atomic boot cache, failure rollback, upgrade migration, and exact-version offline caching.');
})().catch(error => { console.error(error); process.exitCode = 1; });
