/** Real Code OSS workbench edit/save checks; no Google credentials. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),s=http.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
 const php=spawn(process.env.PORTFOLIOS_PHP || 'php',['-S','127.0.0.1:'+port,'-t',root],{windowsHide:true,stdio:'ignore'});let browser;
 try{
  await new Promise(r=>setTimeout(r,800));browser=await chromium.launch({channel:'chrome',headless:true});
  const p=await browser.newPage({viewport:{width:1500,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});p.on('request',r=>{if(r.url().includes('/runtime/'))requests.push(r.url());});
  const target=process.env.PORTFOLIOS_TEST_URL || 'http://127.0.0.1:'+port+'/',base=new URL(target).origin;
  await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await p.addInitScript(()=>{if(window!==top)return;localStorage.setItem('bl4ut0_private_profiles',JSON.stringify({private_codeA:{sub:'codeA',name:'Code A',email:'code-a@example.test',source:'local'},private_codeB:{sub:'codeB',name:'Code B',email:'code-b@example.test',source:'local'}}));});
  await p.goto(target);await p.locator('[data-enter-view=desktop]').click();await p.locator('[data-session-profile=private_codeA]').click();await p.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
  assert.equal(requests.length,0,'No Craft engines during startup');
  await p.evaluate(async()=>{setInstalledStoreAppIds(['vscode']);await SystemFS.writeFile('/documents/editor-check.txt','editor-check.txt','/documents','original',8,'text/plain');await openDesktopWindow('vscode',{path:'/documents/editor-check.txt'});});
  await p.locator('[data-code-loading]').waitFor({state:'hidden',timeout:45000});
  const frame=p.frames().find(f=>f.url().includes('/vscode/runtime/'));assert(frame,'Code OSS iframe');
  await frame.locator('.monaco-editor textarea').first().waitFor({timeout:20000});
  await frame.locator('.view-lines').first().click({position:{x:100,y:10},force:true});await p.keyboard.press('Control+End');await p.keyboard.type(' saved via SystemFS');await p.keyboard.press('Control+s');
  await p.waitForFunction(async()=>(await readFilesystemRecordText(await SystemFS.readFile('/documents/editor-check.txt'))).includes('saved via SystemFS'),{},{timeout:15000});
  assert.notEqual(await p.evaluate(()=>closeDesktopWindow('vscode')),false,'Editor save-all and close');
  await p.evaluate(async()=>{await prepareProfileSwitch();setCurrentUser('private_codeB');await SystemFS.ensureDefaultFiles();});
  assert.equal(await p.evaluate(()=>SystemFS.readFile('/documents/editor-check.txt')),null,'Other account has no editor document');
  await p.evaluate(async()=>{setCurrentUser('private_codeA');await SystemFS.ensureDefaultFiles();await openDesktopWindow('vscode',{path:'/documents/editor-check.txt'});});
  await p.locator('[data-code-loading]').waitFor({state:'hidden',timeout:45000});
  const reopened=p.frames().find(f=>f.url().includes('/vscode/runtime/'));await reopened.locator('.view-lines').filter({hasText:'saved via SystemFS'}).first().waitFor();await reopened.locator('.view-lines').first().click({position:{x:100,y:10},force:true});await p.keyboard.press('Control+End');await p.keyboard.type(' autosaved on switch');
  await reopened.locator('.view-lines').filter({hasText:'autosaved on switch'}).first().waitFor();await p.evaluate(()=>switchToPublicProfile());
  assert.equal(await p.evaluate(()=>state.currentUserId),'bl4ut0');assert.equal(await p.evaluate(()=>SystemFS.readFile('/documents/editor-check.txt')),null,'Public profile has fresh SystemFS');
  await p.evaluate(async()=>{await prepareProfileSwitch();setCurrentUser('private_codeA');await SystemFS.ensureDefaultFiles();});
  assert((await p.evaluate(async()=>await readFilesystemRecordText(await SystemFS.readFile('/documents/editor-check.txt')))).includes('autosaved on switch'),'Private draft saved before profile switch');

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Code OSS real workbench edit/save/reopen, private A/B isolation and autosave-to-public switch passed.');

 }finally{await browser?.close();php.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
