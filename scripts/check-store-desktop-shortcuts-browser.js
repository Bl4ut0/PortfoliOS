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
  await p.evaluate(()=>openDesktopWindow('store'));
  await p.locator('[data-install-store-app=codex]').click();
  await p.waitForFunction(async()=>isStoreAppInstalled('codex') && !!await SystemFS.readFile('/Desktop/codex.portfolios-link.json'));
  await p.waitForFunction(()=>document.querySelector('#desktop-icons [data-open-app=codex] img')?.naturalWidth>0);
  await p.evaluate(()=>installApp('vscode'));
  await p.waitForFunction(async()=>isStoreAppInstalled('vscode') && !!await SystemFS.readFile('/Desktop/vscode.portfolios-link.json'));
  const coverage=await p.evaluate(async()=>{
   const ids=storeApps.filter(app=>app.installable!==false&&appById(app.id)).map(app=>app.id);
   setInstalledStoreAppIds(ids);await renderDesktopIcons();
   const missing=[];for(const id of ids)if(!await SystemFS.readFile('/Desktop/'+id+'.portfolios-link.json'))missing.push(id);
   return {count:ids.length,missing};
  });assert.deepEqual(coverage.missing,[],'All Desktop Store apps receive real shortcut files');
  await p.evaluate(async()=>{await createDesktopFolder('Installed Apps');await addDesktopAppShortcut('/Desktop/Installed Apps','codex','','/Desktop/codex.portfolios-link.json');});
  await p.evaluate(()=>uninstallApp('codex'));await p.waitForFunction(()=>!document.querySelector('#desktop-icons [data-open-app=codex]'));
  await p.evaluate(()=>installApp('codex'));await p.waitForFunction(()=>isStoreAppInstalled('codex') && !state.installingApps.codex);await p.evaluate(()=>flushDesktopLayout());
  assert.equal(await p.evaluate(()=>SystemFS.readFile('/Desktop/codex.portfolios-link.json')),null,'Reinstall retains moved shortcut');
  assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/Installed Apps/codex.portfolios-link.json')));
  await p.evaluate(async()=>{await SystemFS.deleteFile('/Desktop/vscode.portfolios-link.json');await renderDesktopIcons();});
  assert.equal(await p.evaluate(()=>SystemFS.readFile('/Desktop/vscode.portfolios-link.json')),null,'Ordinary refresh respects deletion');
  await p.evaluate(()=>uninstallApp('vscode'));await p.evaluate(()=>installApp('vscode'));
  await p.waitForFunction(async()=>!!await SystemFS.readFile('/Desktop/vscode.portfolios-link.json'));
  await p.waitForFunction(()=>Object.keys(state.installingApps || {}).length===0);
  await p.evaluate(async()=>{await prepareProfileSwitch();setCurrentUser('private_iconsB');await SystemFS.ensureDefaultFiles();await renderDesktopIcons();});
  assert.equal(await p.evaluate(()=>SystemFS.readFile('/Desktop/vscode.portfolios-link.json')),null,'Installation shortcuts are profile-scoped');
  await p.reload();await enter();await p.evaluate(()=>renderDesktopIcons());
  assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/vscode.portfolios-link.json')));
  assert.equal(await p.evaluate(()=>SystemFS.readFile('/Desktop/codex.portfolios-link.json')),null);
  assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/Installed Apps/codex.portfolios-link.json')));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:'actual Store installation, all Desktop Store shortcut files, decoded artwork, uninstall/reinstall, moved shortcut retention, deleted shortcut restoration, private isolation and reload',coverage},null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
