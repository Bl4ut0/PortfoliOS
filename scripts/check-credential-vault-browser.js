/** Real browser + SystemFS/IndexedDB vault lifecycle. All credentials and profiles are disposable fixtures. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..');
const html=profile=>'<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><link rel="stylesheet" href="/styles/tokens.css"><link rel="stylesheet" href="/styles/components.css"><style>body{margin:0;padding:24px;background:var(--surface);color:var(--text);font:16px system-ui}</style></head><body><h1>Vault integration fixture</h1><script>window.state={currentUserId:'+JSON.stringify(profile)+',sessionChosen:true};window.isPrivateUser=id=>/^private_/.test(id||state.currentUserId);</script><script src="/core/event-bus.js"></script><script src="/core/filesystem.js"></script><script>SystemFS.dbName="PortfoliOS_Vault_Browser_Fixture";</script><script src="/core/credential-vault.js"></script><script src="/core/runtime-bridge.js"></script></body></html>';
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://test');if(u.pathname==='/__vault')return res.writeHead(200,{'Content-Type':'text/html'}).end(html(u.searchParams.get('profile')||'private_vaultA'));const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep)||u.pathname.split('/').some(p=>p.startsWith('.')))return res.writeHead(403).end();fs.readFile(file,(e,data)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true}),ctx=await browser.newContext({viewport:{width:1200,height:950},serviceWorkers:'block'});const errors=[],external=[];
 try{
  await ctx.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();external.push(new URL(r.request().url()).origin);return r.abort()});
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  async function open(){await p.goto(origin+'/__vault');await p.evaluate(async()=>{await SystemFS.init();const text=await(await fetch('/desktop/workspace.html')).text();const dom=new DOMParser().parseFromString(text,'text/html');document.body.append(dom.querySelector('#vault-modal-backdrop'));PortfoliOSVault.showAccountsModal()});}
  await open();await p.getByRole('button',{name:'Set up vault',exact:true}).click();await p.locator('#vault-setup-passphrase').fill('Synthetic master passphrase for fixture 849!');await p.locator('#vault-setup-confirm').fill('Synthetic master passphrase for fixture 849!');await p.locator('#vault-setup-submit').click();
  const accounts=p.getByRole('dialog',{name:'Saved tool logins',exact:true});await accounts.waitFor();
  async function importAccount(id){await accounts.locator('[data-import]').setInputFiles({name:'codex-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({tokens:{access_token:'fixture-access-'+id,refresh_token:'fixture-refresh-'+id,account_id:id}}))});await p.waitForFunction(id=>PortfoliOSVault.getBinding('cli.codex')?.accountId===id,id);}
  await importAccount('AccountA');
  await p.setViewportSize({width:430,height:900});
  assert.equal(await accounts.evaluate(d=>{const r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&d.scrollWidth<=d.clientWidth+1;}),true,'Saved login manager fits a narrow Desktop viewport');
  fs.mkdirSync(path.join(root,'.tmp','vault-validation'),{recursive:true});await p.screenshot({path:path.join(root,'.tmp','vault-validation','accounts-narrow.png')});
  await p.setViewportSize({width:1200,height:950});
  await accounts.locator('.vault-account-card').getByRole('combobox').selectOption('app.codex');await accounts.getByRole('button',{name:'Link selected subsystem'}).click();await p.waitForFunction(()=>PortfoliOSVault.getBinding('app.codex')?.accountId==='AccountA');
  await p.evaluate(()=>{window.sharedLease=PortfoliOSVault.acquire('app.codex')});
  await importAccount('AccountB');assert.equal(await accounts.locator('.vault-account-card').count(),2);
  assert.equal(await p.evaluate(()=>sharedLease.read().tokens.account_id),'AccountA','Second account import preserves the other subsystem account');
  await accounts.getByRole('button',{name:'Close saved logins'}).click();assert.equal(await p.evaluate(()=>sharedLease.read().tokens.account_id),'AccountA','Closing manager does not delete or revoke another subsystem login');
  const records=await p.evaluate(()=>SystemFS.getAllFiles());assert(!JSON.stringify(records).includes('fixture-access-'));assert(!JSON.stringify(records).includes('fixture-refresh-'));assert(records.some(r=>r.path==='/documents/vault.enc'));
  assert.equal(await p.evaluate(()=>localStorage.length+sessionStorage.length),0);
  await p.evaluate(()=>PortfoliOSVault.lock());assert.equal(await p.evaluate(()=>{try{sharedLease.read();return false}catch{return true}}),true);
  await open();assert.equal(await p.evaluate(async()=>(await PortfoliOSVault.getStatus()).isLocked),true);
  await accounts.getByRole('button',{name:'Unlock vault',exact:true}).click();
  await p.evaluate(()=>{const original=SystemFS.readFile;SystemFS.readFile=function(...args){SystemFS.readFile=original;return new Promise(resolve=>{window.resumeVaultRead=()=>resolve(original.apply(this,args));});};});
  await p.locator('#vault-unlock-passphrase').fill('Synthetic master passphrase for fixture 849!');await p.locator('#vault-unlock-submit').click();await p.waitForFunction(()=>!!window.resumeVaultRead);
  await p.locator('#vault-unlock-cancel').click();await p.evaluate(()=>resumeVaultRead());
  await p.waitForFunction(async()=>(await PortfoliOSVault.getStatus()).isLocked);assert.equal(await p.locator('#vault-unlock-passphrase').inputValue(),'','Cancel clears the passphrase and invalidates in-flight unlocking');
  await p.evaluate(()=>PortfoliOSVault.showAccountsModal());await accounts.getByRole('button',{name:'Unlock vault',exact:true}).click();await p.locator('#vault-unlock-passphrase').fill('Synthetic master passphrase for fixture 849!');await p.locator('#vault-unlock-submit').click();await accounts.waitFor();
  assert.equal(await accounts.locator('.vault-account-card').count(),2);assert.equal(await p.locator('#vault-unlock-passphrase').inputValue(),'','Passphrase field is cleared after unlock');
  assert.equal(await p.evaluate(()=>PortfoliOSVault.getBinding('cli.codex').accountId),'AccountB');assert.equal(await p.evaluate(()=>PortfoliOSVault.getBinding('app.codex').accountId),'AccountA');
  // A second tab may read the same ciphertext, but a saved change must revoke stale unlocked access.
  await p.evaluate(()=>{window.peerLease=PortfoliOSVault.acquire('cli.codex')});
  const peer=await ctx.newPage();peer.on('pageerror',e=>errors.push(e.message));await peer.goto(origin+'/__vault');
  await peer.evaluate(async()=>{await SystemFS.init();await PortfoliOSVault.unlockWithPassphrase('Synthetic master passphrase for fixture 849!');await PortfoliOSVault.checkpoint();});
  await p.waitForFunction(async()=>(await PortfoliOSVault.getStatus()).isLocked);
  assert.equal(await p.evaluate(()=>{try{peerLease.read();return false}catch{return true}}),true,'Peer write revokes cached access');
  await peer.close();await p.evaluate(()=>PortfoliOSVault.unlockWithPassphrase('Synthetic master passphrase for fixture 849!'));await p.waitForFunction(()=>document.querySelectorAll('.vault-account-card').length===2);
  const first=accounts.locator('.vault-account-card').filter({hasText:'AccountA'});await first.getByRole('button',{name:'Unlink app.codex',exact:true}).click();await first.getByRole('button',{name:'Remove unused login',exact:true}).click();await first.getByRole('button',{name:'Keep login',exact:true}).click();assert.equal(await accounts.locator('.vault-account-card').count(),2);
  await accounts.locator('.vault-account-card').filter({hasText:'AccountA'}).getByRole('button',{name:'Remove unused login',exact:true}).click();await accounts.getByRole('button',{name:'Confirm removal',exact:true}).click();await p.waitForFunction(()=>PortfoliOSVault.listAccounts().length===1);
  await p.evaluate(()=>{window.oldLease=PortfoliOSVault.acquire('cli.codex');state.currentUserId='private_vaultB';EventBus.emit('user:changed',{})});assert.equal(await p.evaluate(()=>{try{oldLease.read();return false}catch{return true}}),true);assert.equal(await accounts.count(),0);
  assert.equal(await p.evaluate(async()=>!!(await SystemFS.readFile('/documents/vault.enc'))),false,'Different profile cannot see first profile vault');
  assert.equal(await p.evaluate(()=>SystemFS.canBrowsePath('/etc/portfolios/vault/openai.json')),false,'Legacy keyring remains outside file picker browsing');
  // Old unowned global keyring records must not appear in either public or private listings.
  await p.evaluate(async()=>{const tx=SystemFS.db.transaction(['files'],'readwrite');const done=SystemFS.transactionDone(tx);tx.objectStore('files').put({path:'/etc/portfolios/vault/openai.json',parent:'/etc/portfolios/vault',name:'openai.json',data:'fixture-legacy-secret',isDirectory:false});await done;});
  assert(!(await p.evaluate(()=>SystemFS.getAllFiles())).some(r=>r.path==='/etc/portfolios/vault/openai.json'));
  await p.evaluate(async()=>{await SystemFS.resetPublicWorkspace();await SystemFS.migrateProfileWorkspace('private','private_vaultB');});
  assert.equal(await p.evaluate(async()=>{const tx=SystemFS.db.transaction(['files'],'readonly');return await new Promise(r=>{const req=tx.objectStore('files').get('/etc/portfolios/vault/openai.json');req.onsuccess=()=>r(!!req.result);});}),true,'Public reset does not erase unowned historical credentials');
  assert.equal(await p.evaluate(()=>SystemFS.readFile('/etc/portfolios/vault/openai.json')),null,'Legacy migration does not assign an unowned login to the selected private account');
  await p.evaluate(()=>{state.currentUserId='bl4ut0';EventBus.emit('user:changed',{})});assert.equal(await p.evaluate(()=>{try{PortfoliOSVault.listAccounts();return false}catch{return true}}),true);
  assert(!(await p.evaluate(()=>SystemFS.getAllFiles())).some(r=>r.path==='/etc/portfolios/vault/openai.json'));
  await p.goto(origin+'/scripts/check-profile-filesystem.html');await p.waitForFunction(()=>document.querySelector('#summary').textContent!=='Running…');
  assert.equal(await p.locator('#summary').textContent(),'All profile filesystem checks passed');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('PASS: real IndexedDB ciphertext-only storage, Codex file import, two saved accounts, shared subsystem reuse, reload/unlock without provider login, explicit unused removal, profile/public isolation, hidden/preserved unowned legacy records, narrow viewport, peer-write revocation, profile filesystem checks, and zero external auth requests.');
 }finally{await ctx.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
