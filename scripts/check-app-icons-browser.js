/** App artwork, pack import/export and profile lifecycle in disposable Chrome. */
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
  const coverage=await p.evaluate(async()=>{
   const apps=[...new Map([...desktopApps,...storeApps,...systems].map(a=>[a.id,a])).values()];
   const missing=[];for(const a of apps){const icon=AppIcons.resolve(a.id,a.icon);if(!icon||icon.startsWith('fa-'))missing.push(a.id);else {const image=new Image();image.src=icon;try{await image.decode();}catch{missing.push(a.id);}}}return {count:apps.length,missing};
  });assert.deepEqual(coverage.missing,[],'All Desktop/catalog apps have locally decodable artwork');
  await p.evaluate(()=>openDesktopWindow('settings'));await p.locator('[data-tab=appearance]').click();
  const panel=p.locator('[data-icon-settings]');await panel.waitFor();await panel.scrollIntoViewIfNeeded();fs.mkdirSync(path.join(root,'.tmp'),{recursive:true});await p.screenshot({path:path.join(root,'.tmp/icon-settings.png')});await panel.locator('[data-icon-app]').selectOption('store');
  const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=16;c.getContext('2d').fillRect(0,0,32,16);return c.toDataURL('image/png').split(',')[1];});
  await panel.locator('[data-icon-file]').setInputFiles({name:'custom.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await p.waitForFunction(()=>document.querySelector('#desktop-icons [data-app-icon=store]')?.src.startsWith('data:image/png'));
  const chosen=await p.evaluate(()=>AppIcons.resolve('store','fa-solid fa-shop'));assert(await p.evaluate(async()=>!!await SystemFS.readFile('/Pictures/Icon Packs/active.json')));
  await p.evaluate(()=>openDesktopWindow('store'));assert.equal(await p.locator('#taskbar-apps [data-app-icon=store]').getAttribute('src'),chosen);assert.equal(await p.locator('[data-window=store] .window-bar [data-app-icon=store]').getAttribute('src'),chosen);
  const pack=await p.evaluate(async()=>await AppIcons.exportPack().text());
  await p.evaluate(()=>AppIcons.reset('store'));assert.match(await p.locator('#desktop-icons [data-app-icon=store]').getAttribute('src'),/core\/icons\/store.svg/);
  await panel.locator('[data-icon-pack]').setInputFiles({name:'icons.json',mimeType:'application/json',buffer:Buffer.from(pack)});await p.waitForFunction(value=>AppIcons.resolve('store','')===value,chosen);
  const rejected=await p.evaluate(async()=>{const before=AppIcons.resolve('store','');let rejected=0;for(const icons of [{store:'data:image/svg+xml,<svg onload="alert(1)"/>'},{store:'https://evil.example/icon.png'},{'bad"id':'data:image/png;base64,aGVsbG8='}])try{await AppIcons.importPack(new Blob([JSON.stringify({format:'portfolios-icon-pack',version:1,icons})]));}catch{rejected++;}return {rejected,unchanged:before===AppIcons.resolve('store','')};});assert.deepEqual(rejected,{rejected:3,unchanged:true});
  await p.reload();await enter();assert.equal(await p.evaluate(()=>AppIcons.resolve('store','')),chosen,'Private icons survive reload');
  await p.evaluate(async()=>{await prepareProfileSwitch();setCurrentUser('private_iconsB');await SystemFS.ensureDefaultFiles();await AppIcons.load();});assert.match(await p.evaluate(()=>AppIcons.resolve('store','fa-solid fa-shop')),/core\/icons\/store.svg/);
  await p.evaluate(async()=>{await prepareProfileSwitch();setCurrentUser('private_iconsA');await SystemFS.ensureDefaultFiles();await AppIcons.load();});assert.equal(await p.evaluate(()=>AppIcons.resolve('store','')),chosen);
  const race=await p.evaluate(async png=>{const bytes=Uint8Array.from(atob(png),c=>c.charCodeAt(0));const pending=AppIcons.set('files',new Blob([bytes],{type:'image/png'}));setCurrentUser('private_iconsB');try{await pending;return false;}catch{return true;}},png);assert(race);assert.equal(await p.evaluate(()=>SystemFS.readFile('/Pictures/Icon Packs/active.json')),null,'Stale image cannot write into another profile');
  await p.reload();await enter('mobile');await p.evaluate(()=>MobileOS.openApp('settings'));await p.locator('[data-icon-settings]').waitFor();await p.evaluate(()=>MobileOS.showHome());
  await p.waitForFunction(value=>[...document.querySelectorAll('[data-app-icon=store]')].some(el=>el.src===value),chosen);
  const mobile=await p.evaluate(async()=>{const missing=[];for(const a of mobileAppCatalog){const image=new Image();image.src=AppIcons.resolve(a.id,a.icon);try{await image.decode();}catch{missing.push(a.id);}}return {count:mobileAppCatalog.length,missing};});assert.deepEqual(mobile.missing,[]);
  await p.evaluate(()=>MobileOS.openApp('store'));await p.waitForFunction(()=>document.querySelector('.mobile-store-title [data-app-icon=files]')?.naturalWidth>0);
  await p.reload();await enter('desktop','public');await p.evaluate(async png=>{await AppIcons.set('store',new Blob([Uint8Array.from(atob(png),c=>c.charCodeAt(0))],{type:'image/png'}));},png);await p.reload();await enter('desktop','public');assert.equal(await p.evaluate(()=>SystemFS.readFile('/Pictures/Icon Packs/active.json')),null,'Public icon choices reset');
  await p.waitForFunction(()=>document.querySelectorAll('#desktop-icons [data-open-app]').length>=6 && [...document.querySelectorAll('#desktop-icons [data-open-app]')].every(el=>el.querySelector('img')?.naturalWidth>0));
  assert.deepEqual(errors,[]);fs.mkdirSync(path.join(root,'.tmp'),{recursive:true});await p.screenshot({path:path.join(root,'.tmp/app-icons.png')});console.log(JSON.stringify({checks:'complete artwork coverage, Appearance upload, live taskbar/title refresh, export/import, invalid packs, private reload/isolation, profile race, shared Mobile icons and public reset',coverage,mobile},null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
