/** Real Desktop folders and square grid regression checks; no Google credentials. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),s=http.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
 const php=spawn(process.env.PORTFOLIOS_PHP || 'php',['-S','127.0.0.1:'+port,'-t',root],{windowsHide:true,stdio:'ignore'});let browser;
 try{
  await new Promise(r=>setTimeout(r,800));browser=await chromium.launch({channel:'chrome',headless:true});
  const p=await browser.newPage({viewport:{width:1500,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[],requests=[],httpFailures=new Map(),recovered=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)httpFailures.set(r.url(),r.status());else if(httpFailures.has(r.url())){recovered.push({url:r.url(),status:httpFailures.get(r.url())});httpFailures.delete(r.url());}});p.on('request',r=>{if(r.url().includes('/runtime/'))requests.push(r.url());});
  const target=process.env.PORTFOLIOS_TEST_URL || 'http://127.0.0.1:'+port+'/',base=new URL(target).origin;
  await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await p.addInitScript(()=>{
   if(localStorage.getItem('desktopFoldersSeed'))return;
   localStorage.setItem('desktopFoldersSeed','1');localStorage.setItem('desktop_pos_private_foldersA_store',JSON.stringify({left:230.4,top:115.2}));
   localStorage.setItem('bl4ut0_private_profiles',JSON.stringify({private_foldersA:{sub:'foldersA',email:'a@example.test',name:'Folders A',source:'local'},private_foldersB:{sub:'foldersB',email:'b@example.test',name:'Folders B',source:'local'}}));
  });
  async function enter(profile='private_foldersA') {
   await p.locator('[data-enter-view=desktop]').click();
   await p.locator(profile==='public'?'[data-session-public]':'[data-session-profile="'+profile+'"]').click();
   await p.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
   await p.evaluate(async()=>{for(const id of [...state.openApps])await closeDesktopWindow(id);await renderDesktopIcons();});
  }
  await p.goto(target);await enter();await p.waitForFunction(async()=>!!(await readDesktopLayout()).positions.store);assert.deepEqual(await p.evaluate(async()=>(await readDesktopLayout()).positions.store),{col:2,row:1},'Legacy positions migrate into SystemFS');assert.equal(await p.evaluate(()=>localStorage.getItem('desktop_pos_private_foldersA_store')),null,'Legacy position removed after durable migration');
  assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/cli.portfolios-link.json')),'Default app icons are actual Desktop shortcut files');
  assert.equal(await p.locator('[data-desktop-create-folder]').count(),0,'Folder creation is not a desktop tile');
  async function newFolderFromMenu(){await p.locator('#desktop-icons').dispatchEvent('contextmenu',{bubbles:true,clientX:500,clientY:200});await p.locator('#desktop-context-menu').getByRole('menuitem',{name:'New folder',exact:true}).click();}
  await newFolderFromMenu();
  const dialog=p.locator('[data-desktop-folder-dialog]');await dialog.locator('input').fill('../Invalid');await dialog.locator('[type=submit]').click();await p.waitForFunction(()=>document.querySelector('[data-folder-error]')?.textContent.includes('without slashes'));await dialog.locator('input').fill('Projects');await dialog.locator('[type=submit]').click();await dialog.waitFor({state:'detached'});
  const folder=p.locator('[data-desktop-path="/Desktop/Projects"]');await folder.waitFor();
  assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/Projects')),'Folder is a real SystemFS directory');
  await folder.click();await p.waitForFunction(()=>document.querySelector('.files-breadcrumbs')?.textContent.includes('Projects'));
  await p.evaluate(()=>closeDesktopWindow('files'));
  const cli=p.locator('#desktop-icons [data-open-app=cli]'),from=await cli.boundingBox(),to=await folder.boundingBox();
  await p.mouse.move(from.x+from.width/2,from.y+from.height/2);await p.mouse.down();await p.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:15});await p.mouse.up();
  const link='/Desktop/Projects/cli.portfolios-link.json';await p.waitForFunction(async path=>!!await SystemFS.readFile(path)&&!await SystemFS.readFile('/Desktop/cli.portfolios-link.json'),link);
  await p.evaluate(async path=>{const r=await SystemFS.readFile(path);await SystemFS.writeFile(path,r.name,r.parent,r.data,r.size,r.type);},link);
  await folder.click();const shortcut=p.locator('.file-item[data-path="'+link+'"]');await shortcut.waitFor();assert.equal(await shortcut.locator('.file-name').textContent(),'Portfolio CLI');
  await shortcut.dblclick();await p.waitForFunction(()=>state.openApps.has('cli'));await p.evaluate(async()=>{await closeDesktopWindow('cli');await closeDesktopWindow('files');});
  const grids=[];
  for(const [width,height] of [[1440,1000],[768,850],[412,915],[850,768]]){
   await p.setViewportSize({width,height});await p.evaluate(()=>renderDesktopIcons());
   const cells=await p.locator('#desktop-icons .desktop-icon').evaluateAll(icons=>icons.map(el=>({left:parseFloat(el.style.left),top:parseFloat(el.style.top),w:el.offsetWidth,h:el.offsetHeight})));
   assert(cells.every(c=>c.w===c.h),'All icon cells are square at '+width);
   assert.equal(new Set(cells.map(c=>c.left+','+c.top)).size,cells.length,'No overlapping cells');
   const unit=await p.evaluate(()=>7.2*parseFloat(getComputedStyle(document.documentElement).fontSize));
   assert(cells.every(c=>Math.abs(c.left/unit-Math.round(c.left/unit))<.001&&Math.abs(c.top/unit-Math.round(c.top/unit))<.001),'Square snapping increments');grids.push({width,height,icons:cells.length,cell:unit});
  }
  await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>renderDesktopIcons());
  const folderBefore=await folder.boundingBox();await p.mouse.move(folderBefore.x+folderBefore.width/2,folderBefore.y+folderBefore.height/2);await p.mouse.down();await p.mouse.move(415,65,{steps:15});await p.mouse.up();
  await p.waitForFunction(async()=>!!(await readDesktopLayout()).positions['/Desktop/Projects']);
  await p.evaluate(()=>renderDesktopIcons());
  const savedPosition=await folder.evaluate(el=>({left:el.style.left,top:el.style.top}));
  await p.reload();await enter();assert(await p.evaluate(path=>SystemFS.readFile(path),link),'Private desktop survives reload');assert.equal(await p.evaluate(()=>SystemFS.readFile('/Desktop/cli.portfolios-link.json')),null,'Moved shortcut is not recreated on reload');
  assert.deepEqual(await folder.evaluate(el=>({left:el.style.left,top:el.style.top})),savedPosition,'Folder drag position survives reload');assert(await p.evaluate(()=>SystemFS.readFile('/Desktop/desktop-layout.json')),'Layout lives in SystemFS');assert.equal(await p.locator('[data-desktop-path="/Desktop/desktop-layout.json"]').count(),0,'Reserved layout file is not a desktop icon');
  await p.evaluate(async()=>{await prepareProfileSwitch();setCurrentUser('private_foldersB');await SystemFS.ensureDefaultFiles();await renderDesktopIcons();});
  assert.equal(await p.evaluate(()=>SystemFS.readFile('/Desktop/Projects')),null,'Other private account has its own desktop');
  await p.evaluate(()=>saveDesktopLayoutPositions({cli:{col:1,row:0}}));await newFolderFromMenu();await dialog.waitFor();
  await p.evaluate(async()=>{await prepareProfileSwitch();setCurrentUser('private_foldersA');await SystemFS.ensureDefaultFiles();await renderDesktopIcons();});await dialog.waitFor({state:'detached'});await p.evaluate(()=>clearDesktopIconPositions());assert.deepEqual(await p.evaluate(async()=>(await readDesktopLayout()).positions),{},'Reset clears only the active layout');
  const race=await p.evaluate(async()=>{const pending=createDesktopFolder('Race');setCurrentUser('private_foldersB');try{await pending;return false;}catch{return true;}});assert(race,'Profile change aborts pending folder creation');assert.deepEqual(await p.evaluate(async()=>(await readDesktopLayout()).positions.cli),{col:1,row:0},'Other profile layout survives reset');assert.equal(await p.evaluate(()=>SystemFS.readFile('/Desktop/Race')),null);
  await p.evaluate(()=>switchToPublicProfile({saveToDrive:false}));await p.evaluate(async()=>{for(const id of [...state.openApps])await closeDesktopWindow(id);await createDesktopFolder('Temporary');});
  await p.reload();await enter('public');assert.equal(await p.evaluate(()=>SystemFS.readFile('/Desktop/Temporary')),null,'Public desktop resets on reload');
  await p.setViewportSize({width:412,height:400});await p.evaluate(async()=>{for(let i=0;i<18;i++)await createDesktopFolder('Folder '+i);await renderDesktopIcons();});
  assert(await p.locator('#desktop-icons').evaluate(el=>el.scrollHeight>el.clientHeight),'Overflow desktop entries remain scrollable');
  const overflow=await p.locator('#desktop-icons .desktop-icon').evaluateAll(icons=>icons.map(el=>({left:parseFloat(el.style.left),top:parseFloat(el.style.top),width:el.offsetWidth,available:el.parentElement.clientWidth})));
  assert(overflow.every(c=>c.left+c.width<=c.available),'Overflow entries stay inside grid width');assert.equal(new Set(overflow.map(c=>c.left+','+c.top)).size,overflow.length);
  await p.setViewportSize({width:768,height:850});await p.evaluate(()=>renderDesktopIcons());
  assert.deepEqual(errors,[]);assert.deepEqual([...httpFailures],[]);
  fs.mkdirSync(path.join(root,'.tmp'),{recursive:true});await p.screenshot({path:path.join(root,'.tmp/desktop-folders.png')});
  console.log(JSON.stringify({checks:'Desktop folder UI, real drag shortcut, restored JSON association, private reload/isolation, race cancellation, public reset and square grid',grids,recoveredPreloads:recovered},null,2));

 }finally{await browser?.close();php.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
