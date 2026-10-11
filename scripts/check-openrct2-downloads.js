/** Regression for the Apache hotlink rule used by Store and runtime downloads. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const config = fs.readFileSync(path.join(root, 'apps/openrct2/runtime/.htaccess'), 'utf8');
const conditions = [...config.matchAll(/^\s*RewriteCond %\{(REQUEST_URI|HTTP_REFERER)\} (\S+) \[NC\]\s*$/gm)];
assert.equal(conditions.length, 2, 'Download guard must retain both its asset and referrer conditions');
const rules = conditions.map(([,variable,pattern]) => ({variable,negated:pattern.startsWith('!'),expression:new RegExp(pattern.replace(/^!/,''),'i')}));
const blocked = (uri,referer='') => rules.every(rule=>rule.expression.test(rule.variable==='REQUEST_URI'?uri:referer)!==rule.negated);
const origin = 'https://os.bl4ut0.dev';
const storeReferrers = [origin+'/',origin+'/?view=desktop&release=store-regression',origin+'/index.html',origin+'/index.html?view=desktop',origin+'/?view=mobile'];
const runtimeReferrers = [origin+'/apps/openrct2/runtime/index.php?v=1.0.57',origin+'/apps/openrct2/runtime/index.html'];
const rejectedReferrers = ['', 'https://other.example/', 'https://os.bl4ut0.dev.evil.example/', 'https://os.bl4ut0.dev@evil.example/',origin+'/index.html.evil',origin+'/unrelated-page',origin+'/apps/openrct2/runtime-elsewhere/index.html'];
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'desktop/store.js'),'utf8')+'\nwindow.auditOpenRCT2Config=GAME_INSTALL_CONFIGS.openrct2;',sandbox);
const downloads = sandbox.window.auditOpenRCT2Config.files.map(file=>new URL(file.url,origin).pathname);
for(const uri of downloads)for(const referer of storeReferrers)assert.equal(blocked(uri,referer),false,'Store download rejected: '+uri+' from '+referer);
const guarded = ['openrct2.zip','assets.zip','RCT.zip','openrct2.js','openrct2.wasm'].map(file=>'/apps/openrct2/runtime/'+file);
for(const uri of guarded) {
  assert.equal(blocked(uri),true,'Direct download must remain blocked: '+uri);
  for(const referer of runtimeReferrers)assert.equal(blocked(uri,referer),false,'Runtime download rejected: '+uri);
  for(const referer of rejectedReferrers)assert.equal(blocked(uri,referer),true,'Unapproved referrer accepted: '+referer);
}
assert.equal(blocked('/apps/openrct2/runtime/index.html'),false,'Runtime page must stay reachable');
console.log('OpenRCT2 download guard passed: actual Store URLs, root/index/query entry, runtime entry and rejected direct/external/spoofed referrers. Production Apache behavior is checked separately.');
