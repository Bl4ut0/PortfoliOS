/** Multi-tab preference and backup coordination in disposable Chrome. */
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

  assert.equal(await p.evaluate(()=>WorkspaceSessions.ownsPreference('bl4ut0_private_iconsA_ThemeId','private')),false,'Legacy profile prefix cannot claim another account');
  const q=await context.newPage();await q.goto(target);
  await q.locator('[data-enter-view=desktop]').click();await q.locator('[data-session-profile="private_iconsA"]').click();await q.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
  await p.evaluate(async()=>{setPortfolioTheme('light');Storage.local.set(getPreferencesKey('ThemePrimary'),'#123456');await savePreferencesToFilesystem({strict:true});});
  await q.waitForFunction(()=>state.themeId==='light');
  const old=await p.evaluate(async()=> (await SystemFS.readFile('/home/private_iconsA/settings.json')).data);
  await q.evaluate(async()=>{Storage.local.set(getPreferencesKey('ThemePrimary'),'#123456');setPortfolioTheme('oled');await savePreferencesToFilesystem({strict:true});});
  await p.waitForFunction(()=>state.themeId==='oled');
  await p.evaluate(async old=>{await SystemFS.writeFile('/home/private_iconsA/settings.json','settings.json','/home/private_iconsA',old,old.length,'application/json',false);await loadPreferencesFromFilesystem();},old);
  await q.evaluate(()=>loadPreferencesFromFilesystem());
  assert.equal(await p.evaluate(()=>state.themeId),'oled','Stale restore cannot revert newer theme');
  assert.equal(await q.evaluate(()=>Storage.local.get(getPreferencesKey('ThemePrimary'))),null,'Reset accent remains reset');
  await p.evaluate(()=>{window.holdPreferences=WorkspaceSessions.withLock('preferences',state.currentUserId,()=>new Promise(resolve=>{window.releasePreferences=resolve;}));});
  await p.waitForFunction(()=>!!window.releasePreferences);
  await q.evaluate(()=>setPortfolioTheme('terminal'));await p.evaluate(()=>setPortfolioTheme('glacier'));
  await p.evaluate(()=>releasePreferences());
  await Promise.all([p.evaluate(()=>savePreferencesToFilesystem({strict:true})),q.evaluate(()=>savePreferencesToFilesystem({strict:true}))]);
  assert.equal(await q.evaluate(async()=>JSON.parse((await SystemFS.readFile('/home/private_iconsA/settings.json')).data)[getPreferencesKey('ThemeId')]),'glacier','Queued writes read current values');
  // Delayed restores must reject writes into a newly selected profile.
  await q.evaluate(async()=>{
   const original=readFilesystemRecordText;let release;
   window.readFilesystemRecordText=async record=>{await new Promise(r=>release=r);return original(record);};
   window.delayedRestore=loadPreferencesFromFilesystem();
   while(!release)await new Promise(r=>setTimeout(r,1));
   setCurrentUser('private_iconsB');release();await window.delayedRestore;window.readFilesystemRecordText=original;
  });
  assert.notEqual(await q.evaluate(()=>state.themeId),'glacier','Restoration stays with originating profile');
  await q.evaluate(()=>setCurrentUser('private_iconsA'));
  await q.evaluate(async()=>{
   GDriveSync.fetchRemoteFiles=async()=>{throw new Error('fixture backup failure');};
   try{await GDriveSync.sync();}catch(e){if(!e.message.includes('fixture backup failure'))throw e;}
   if(GDriveSync.syncInProgress)throw new Error('Failed backup did not clear busy state');
  });
  // Hold the first backup at its remote read; the other tab must not enter.
  await p.evaluate(()=>{
   window.realFiles=SystemFS.getAllFiles;SystemFS.getAllFiles=async()=>[];
   GDriveSync.fetchRemoteFiles=()=>new Promise(resolve=>window.releaseBackup=()=>resolve([]));
   window.backup=GDriveSync.sync();
  });
  await p.waitForFunction(()=>!!window.releaseBackup);
  const blocked=await q.evaluate(async()=>{try{await GDriveSync.sync();return '';}catch(e){return e.message;}});
  assert.match(blocked,/Another tab/);
  await p.evaluate(async()=>{releaseBackup();await backup;SystemFS.getAllFiles=realFiles;});
  await q.evaluate(async()=>{
   const original=SystemFS.getAllFiles;SystemFS.getAllFiles=async()=>[];GDriveSync.fetchRemoteFiles=async()=>[];
   try{await GDriveSync.sync();}finally{SystemFS.getAllFiles=original;}
  });
  await p.evaluate(()=>{window.closeLock=WorkspaceSessions.withLock('drive',state.currentUserId,()=>new Promise(()=>{}));});
  await p.waitForFunction(async()=> (await navigator.locks.query()).held.some(lock=>lock.name==='portfolios:drive:private_iconsA'));
  await p.close();
  await q.waitForFunction(async()=> !(await navigator.locks.query()).held.some(lock=>lock.name==='portfolios:drive:private_iconsA'));
  await q.evaluate(async()=>{await WorkspaceSessions.withLock('drive',state.currentUserId,()=>{}, {ifAvailable:true});});
  await q.reload();await q.locator('[data-enter-view=desktop]').click();await q.locator('[data-session-profile="private_iconsA"]').click();await q.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
  assert.equal(await q.evaluate(()=>state.themeId),'glacier','Latest theme survives reload');
  const m=await context.newPage();await m.goto(target);await m.locator('[data-enter-view=mobile]').click();await m.locator('[data-session-profile="private_iconsA"]').click();await m.waitForFunction(()=>!!window.MobileOS);
  await m.evaluate(async()=>{MobileOS.setPreference('theme','light');await savePreferencesToFilesystem({strict:true});});
  const n=await context.newPage();await n.goto(target);await n.locator('[data-enter-view=mobile]').click();await n.locator('[data-session-profile="private_iconsA"]').click();await n.waitForFunction(()=>!!window.MobileOS);
  await m.evaluate(()=>MobileOS.setPreference('theme','dark'));await n.waitForFunction(()=>MobileOS.getPreferences().theme==='dark');
  console.log('PASS: two-tab theme propagation, stale restore/reset protection, current-value queued saves, profile-switch cancellation, backup exclusion/release/tab-close recovery, reload and native Mobile peer preferences.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
