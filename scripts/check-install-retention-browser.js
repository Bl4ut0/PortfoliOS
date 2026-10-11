/** Private Store installation retention during sync and across tabs. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
const root=path.resolve(__dirname,'..'),mime={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://test').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)||name.split('/').some(p=>p.startsWith('.')))return res.writeHead(403).end();fs.readFile(file,(e,data)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
  const target=process.env.PORTFOLIOS_TEST_URL || 'http://127.0.0.1:'+server.address().port+'/',origin=new URL(target).origin;
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await context.addInitScript(()=>localStorage.setItem('bl4ut0_private_profiles',JSON.stringify({private_iconsA:{sub:'iconsA',email:'icons-a@example.test',name:'Icons A',source:'local'},private_iconsB:{sub:'iconsB',email:'icons-b@example.test',name:'Icons B',source:'local'}})));
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  async function enter(view='desktop',profile='private_iconsA'){
   await p.locator('[data-enter-view='+view+']').click();await p.locator(profile==='public'?'[data-session-public]':'[data-session-profile="'+profile+'"]').click();await p.waitForFunction(()=>document.body.dataset.startupStage==='workspace');await p.evaluate(()=>AppIcons.load());
  }
  await p.goto(target);await enter();

  await p.evaluate(async()=>{
   const path='/documents/retention-audit.txt';
   await SystemFS.writeFile(path,'retention-audit.txt','/documents','old',3,'text/plain',false);
   const snapshot=await SystemFS.readFile(path);
   await SystemFS.writeFile(path,'retention-audit.txt','/documents','new',3,'text/plain',false);
   let rejected=false;try{await SecurityKernel.scanExisting(snapshot,'cloud-upload');}catch(error){rejected=error.message.includes('file changed');}
   if(!rejected || await readFilesystemRecordText(await SystemFS.readFile(path))!=='new')throw new Error('Stale scan overwrote newer file');
  });
  await p.evaluate(async()=>{await savePreferencesToFilesystem({strict:true});await renderDesktopIcons();await flushDesktopLayout();});
  // Hold a real backup after its local snapshot, then install while it is running.
  await p.evaluate(()=>{
   GDriveSync.scheduleAutomaticSync=()=>{};
   window.fakeDrive=new Map();let held=false;
   GDriveSync.fetchRemoteFiles=async()=>[...fakeDrive.values()].map(record=>record.remote);
   const put=(path,name,type,data)=>{fakeDrive.set(path,{data,remote:{id:path,name,mimeType:type,modifiedTime:new Date().toISOString(),appProperties:{path}}});};
   GDriveSync.createRemoteFolder=async(path,name)=>{if(!held){held=true;await new Promise(resolve=>window.resumeBackup=resolve);}put(path,name,'application/vnd.google-apps.folder',null);};
   GDriveSync.uploadFile=async(path,name,type,data)=>put(path,name,type,data);
   GDriveSync.updateFile=async(path,type,data)=>put(path,SystemFS.getName(path),type,data);
   GDriveSync.deleteFile=async path=>fakeDrive.delete(path);
   GDriveSync.downloadFile=async path=>new Blob([fakeDrive.get(path).data],{type:fakeDrive.get(path).remote.mimeType});
   window.pendingBackup=GDriveSync.sync();
  });
  await p.waitForFunction(()=>!!window.resumeBackup);
  await p.evaluate(()=>openDesktopWindow('store'));await p.locator('[data-install-store-app=codex]').click();
  await p.waitForFunction(async()=>isStoreAppInstalled('codex') && !state.installingApps.codex && !!await SystemFS.readFile('/Desktop/codex.portfolios-link.json'));
  await p.evaluate(async()=>{resumeBackup();try{await pendingBackup;}catch(error){if(!error.message.includes('Backup incomplete'))throw error;}});
  assert.equal(await p.evaluate(()=>JSON.parse(Storage.local.get(GDriveSync.getScopedStorageKey('sync_manifest')) || '[]').includes('/Desktop/codex.portfolios-link.json')),false,'New shortcut was not falsely acknowledged as uploaded');
  await p.evaluate(()=>GDriveSync.sync());
  assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/codex.portfolios-link.json')),'Second backup retains newly installed shortcut');
  assert(await p.evaluate(()=>fakeDrive.has('/Desktop/codex.portfolios-link.json')),'Second backup uploads new shortcut');
  // Reproduce the old poisoned manifest; preserve the active app rather than deleting it.
  await p.evaluate(async()=>{fakeDrive.delete('/Desktop/codex.portfolios-link.json');await GDriveSync.sync();});
  assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/codex.portfolios-link.json')),'Previously poisoned manifest does not delete active app shortcut');
  // Even a newer legacy list cannot uninstall an app without its own explicit record.
  await p.evaluate(async()=>{
   const key=getInstalledStoreAppsKey(), value=JSON.stringify({[key]:'[]',__portfoliosPreferenceRevisions:{[key]:Date.now()+10000}});
   await SystemFS.writeFile('/home/private_iconsA/settings.json','settings.json','/home/private_iconsA',value,value.length,'application/json',false);
   await loadPreferencesFromFilesystem();await renderDesktopIcons();
  });
  assert.equal(await p.evaluate(()=>isStoreAppInstalled('codex')),true);
  await p.waitForFunction(()=>!!document.querySelector('#desktop-icons [data-open-app=codex]'));
  const q=await context.newPage();await q.goto(target);await q.locator('[data-enter-view=desktop]').click();await q.locator('[data-session-profile="private_iconsA"]').click();await q.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
  await Promise.all([p.evaluate(()=>setStoreAppInstalled('vscode',true)),q.evaluate(()=>setStoreAppInstalled('photocraft',true))]);
  assert.deepEqual((await p.evaluate(()=>getInstalledStoreAppIds())).sort(),['codex','photocraft','vscode']);
  await p.evaluate(()=>uninstallApp('codex'));
  await q.waitForFunction(()=>!isStoreAppInstalled('codex'));
  await q.evaluate(()=>Storage.local.set(getInstalledStoreAppsKey(),JSON.stringify(['codex','vscode','photocraft'])));
  assert.equal(await q.evaluate(()=>isStoreAppInstalled('codex')),false,'Explicit uninstall defeats stale legacy installed list');
  await p.evaluate(()=>installApp('codex'));await p.waitForFunction(()=>isStoreAppInstalled('codex') && !state.installingApps.codex);
  await p.reload();await enter();
  assert.equal(await p.evaluate(()=>isStoreAppInstalled('codex')),true,'Private install survives reload');
  assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/codex.portfolios-link.json')));
  await p.evaluate(()=>setCurrentUser('private_iconsB'));assert.deepEqual(await p.evaluate(()=>getInstalledStoreAppIds()),[]);
  console.log('PASS: install during backup, truthful manifest, stale scanner write rejection, second backup retention/upload, old poisoned manifest recovery, stale list restore, concurrent per-app choices, explicit uninstall tombstone, reinstall, reload and profile isolation.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
