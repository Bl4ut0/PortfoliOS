/** Context menus and Store shortcut lifecycle in disposable Chrome. */
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

  await p.evaluate(async()=>{await createDesktopFolder('Position Test');await renderDesktopIcons();});
  const cells=()=>p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#desktop-icons .desktop-icon')].map(el=>[el.dataset.desktopId,[el.style.left,el.style.top]])));
  const before=await cells(),drag=p.locator('#desktop-icons .desktop-icon').first(),dragId=await drag.getAttribute('data-desktop-id'),box=await drag.boundingBox();
  await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();
  await p.mouse.move(box.x+box.width/2+350,box.y+box.height/2+210,{steps:8});await p.mouse.up();
  await p.waitForFunction(async()=>Object.keys((await readDesktopLayout()).positions).length===document.querySelectorAll('#desktop-icons .desktop-icon').length);
  await p.evaluate(()=>renderDesktopIcons());
  const after=await cells();
  for(const [id,cell] of Object.entries(before))if(id!==dragId)assert.deepEqual(after[id],cell,'Dragging must preserve other icons: '+id);
  await p.reload();await enter();await p.waitForFunction(()=>document.querySelectorAll('#desktop-icons .desktop-icon').length>0);assert.deepEqual(await cells(),after,'All visible icon cells survive reload');

  const menu=p.locator('#desktop-context-menu');
  const send=()=>menu.getByRole('menuitem',{name:'Send to Desktop (create shortcut)',exact:true});
  async function rightClick(selector){await p.locator(selector).first().click({button:'right'});await menu.waitFor({state:'visible'});}
  await p.evaluate(()=>openDesktopWindow('store'));
  await rightClick('[data-store-context=codex] h3');
  await menu.getByRole('menuitem',{name:'Install',exact:true}).click();
  await p.waitForFunction(async()=>isStoreAppInstalled('codex') && !state.installingApps.codex && !!await SystemFS.readFile('/Desktop/codex.portfolios-link.json'));
  await p.evaluate(()=>minimizeDesktopWindow('store'));
  await rightClick('#desktop-icons [data-open-app=codex]');
  await menu.getByRole('menuitem',{name:'Remove shortcut',exact:true}).click();
  await p.waitForFunction(async()=>!await SystemFS.readFile('/Desktop/codex.portfolios-link.json'));
  assert.equal(await p.evaluate(()=>isStoreAppInstalled('codex')),true,'Removing shortcut keeps application installed');
  await p.evaluate(()=>renderDesktopIcons());
  assert.equal(await p.locator('#desktop-icons [data-open-app=codex]').count(),0);
  await p.reload();await enter();
  assert.equal(await p.locator('#desktop-icons [data-open-app=codex]').count(),0,'Removal persists on reload');
  await p.locator('#start-toggle').click();await p.locator('[data-start-view=all]').click();
  await rightClick('#start-menu [data-open-app=codex]');
  await send().click();
  await p.waitForFunction(async()=>!!await SystemFS.readFile('/Desktop/codex.portfolios-link.json'));
  await p.evaluate(()=>{document.getElementById('start-menu').hidden=true;});
  await p.evaluate(()=>openDesktopWindow('store'));
  await rightClick('[data-store-context=codex] h3');await send().click();
  assert.equal(await p.evaluate(async()=> (await SystemFS.readDir('/Desktop')).filter(f=>f.name==='codex.portfolios-link.json').length),1,'Repeated send does not duplicate');
  await p.evaluate(()=>installApp('vscode'));
  await p.waitForFunction(async()=>!state.installingApps.vscode && !!await SystemFS.readFile('/Desktop/vscode.portfolios-link.json'));
  await context.route('**/apps/ut99/runtime/index.php/*',route=>route.fulfill({status:200,body:'fixture-runtime-bytes'}));
  await p.evaluate(()=>installApp('ut99'));
  assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/ut99.portfolios-link.json')),'Downloaded install creates shortcut');
  await context.route('**/doom.js*',route=>route.fulfill({status:403,body:'denied-fixture'}));
  await p.evaluate(()=>installApp('doomsource'));
  assert.equal(await p.evaluate(()=>isStoreAppInstalled('doomsource')),false,'Failed download is not installed');
  assert.equal(await p.evaluate(()=>SystemFS.readFile('/Desktop/doomsource.portfolios-link.json')),null);
  await p.evaluate(()=>minimizeDesktopWindow('store'));
  await p.evaluate(async()=>{await createDesktopFolder('App Folder');await addDesktopAppShortcut('/Desktop/App Folder','codex','','/Desktop/codex.portfolios-link.json');});
  await p.evaluate(()=>openDesktopFile('/Desktop/App Folder'));
  await rightClick('[data-window=files] [data-path="/Desktop/App Folder/codex.portfolios-link.json"]');
  await send().click();
  await p.waitForFunction(async()=>!!await SystemFS.readFile('/Desktop/codex.portfolios-link.json'));
  assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/App Folder/codex.portfolios-link.json')),'Explicit send keeps folder copy');
  await p.evaluate(()=>openDesktopFile('/Desktop/App Folder'));
  await p.locator('[data-window=files] .files-grid-container').dispatchEvent('contextmenu',{bubbles:true,clientX:500,clientY:300});
  await menu.getByRole('menuitem',{name:'New folder',exact:true}).waitFor();
  await p.keyboard.press('Escape');assert(await menu.isHidden());
  await p.evaluate(async()=>{await SystemFS.writeFile('/Desktop/App Folder/readme.txt','readme.txt','/Desktop/App Folder','test',4,'text/plain',false);});
  await rightClick('[data-window=files] [data-path="/Desktop/App Folder/readme.txt"]');
  await menu.getByRole('menuitem',{name:'Open with',exact:true}).focus();await p.keyboard.press('ArrowRight');
  assert.equal(await p.evaluate(()=>document.activeElement.closest('[role="menu"]').className),'context-submenu');
  await p.keyboard.press('ArrowLeft');assert.equal(await p.evaluate(()=>document.activeElement.textContent.trim().includes('Open with')),true);
  await p.keyboard.press('Escape');
  const input=p.locator('[data-window=files] .files-search-input');
  await input.click({button:'right'});assert(await menu.isHidden(),'Inputs retain native editing menu');
  await p.evaluate(()=>minimizeDesktopWindow('files'));
  const icon=p.locator('#desktop-icons [data-open-app=codex]');await icon.focus();await p.keyboard.press('Shift+F10');
  await menu.waitFor({state:'visible'});await p.keyboard.press('ArrowDown');await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>document.activeElement?.dataset.openApp),'codex','Escape restores keyboard target');
  await rightClick('#desktop-icons [data-open-app=codex]');
  await p.evaluate(()=>setCurrentUser('private_iconsB'));
  assert(await menu.isHidden(),'Profile switch dismisses old menu');
  assert.equal(await p.evaluate(()=>SystemFS.readFile('/Desktop/codex.portfolios-link.json')),null,'Another profile has separate shortcuts');
  assert.deepEqual(errors,[],'No uncaught browser errors');
  console.log('PASS: modular, catalog and downloaded installs; failed download; removal persists without uninstall; Start/Store/Explorer send, duplicate avoidance, folder copy, native inputs, keyboard navigation and profile isolation.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
