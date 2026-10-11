/** Real Store + local PAK import + installed byte ranges. Supply legally obtained data via PORTFOLIOS_QUAKE_PAK. */
'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),fs=require('node:fs');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..');
assert(process.env.PORTFOLIOS_QUAKE_PAK,'Set PORTFOLIOS_QUAKE_PAK to your local pak0.pak. No game data is downloaded by this check.');
(async()=>{let browser,php;try{
 let origin=process.argv.find(a=>a.startsWith('--origin='))?.slice(9);
 if(!origin){const socket=http.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));php=spawn(process.env.PORTFOLIOS_PHP||'php',['-S','127.0.0.1:'+port,'-t',root,path.join(root,'scripts/test-static-router.php')],{windowsHide:true,stdio:'ignore'});origin='http://127.0.0.1:'+port;for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}}
 origin=new URL(origin).origin;
 browser=await chromium.launch({channel:'chrome',headless:true});const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'allow',reducedMotion:'reduce'});
 await c.addInitScript(()=>{if(localStorage.getItem('quakeAuditSeed'))return;localStorage.setItem('quakeAuditSeed','1');localStorage.setItem('bl4ut0_private_profiles',JSON.stringify({private_quakeAudit:{sub:'quakeAudit',name:'Quake Audit',email:'quake@example.test',source:'local'}}));});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.stack || e.message));await p.goto(origin);await p.evaluate(()=>navigator.serviceWorker.ready);if(!await p.evaluate(()=>Boolean(navigator.serviceWorker.controller)))await p.reload();
 const enter=async()=>{await p.locator('[data-enter-view=desktop]').click();await p.locator('[data-session-profile=private_quakeAudit]').click();await p.waitForFunction(()=>document.body.dataset.startupStage==='workspace');};await enter();
 assert.equal(await p.locator('.desktop-icon[data-open-app=browser]').count(),1,'Default desktop must include Browser');
 assert.equal(await p.evaluate(()=>window.storeApps.some(a=>['tools','pdf'].includes(a.id))),false);assert.equal(await p.evaluate(()=>window.browserBookmarks.some(b=>/https:\/\/(pdf|tools)\.bl4ut0\.com/.test(b.url))),false);
 await p.evaluate(()=>window.openDesktopWindow('store'));await p.locator('[data-install-store-app=quake]').click();await p.waitForFunction(()=>window.isStoreAppInstalled('quake'),null,{timeout:90000});await p.locator('.store-window [data-open-app=quake]').click();
 await p.locator('[data-quake-setup]').waitFor();assert.equal(await p.locator('.quake-window iframe').getAttribute('src'),null,'No broken game launch before data is selected');
 await p.locator('[data-quake-pak]').setInputFiles({name:'invalid.pak',mimeType:'application/octet-stream',buffer:Buffer.from('invalid game data')});await p.locator('[data-quake-status]').filter({hasText:'valid Quake PAK'}).waitFor();
 const truncated=Buffer.alloc(76);truncated.write('PACK');truncated.writeUInt32LE(12,4);truncated.writeUInt32LE(64,8);truncated.write('gfx.wad',12);truncated.writeUInt32LE(1000,68);truncated.writeUInt32LE(8,72);
 await p.locator('[data-quake-pak]').setInputFiles({name:'truncated.pak',mimeType:'application/octet-stream',buffer:truncated});await p.locator('[data-quake-status]').filter({hasText:'truncated entry'}).waitFor();
 await p.locator('[data-quake-pak]').setInputFiles(process.env.PORTFOLIOS_QUAKE_PAK);
 await p.waitForFunction(()=>document.querySelector('.quake-window iframe')?.src.includes('/quake/index.php'));
 await p.waitForFunction(()=>document.querySelector('.quake-window iframe')?.contentWindow?.Host?.initialized===true&&document.querySelector('.quake-window iframe').contentWindow.Host.framecount>2,null,{timeout:90000});const f=p.frames().find(f=>f.url().includes('/quake/index.php'));
 assert.equal(await f.evaluate(()=>crossOriginIsolated),true);
 const range=await p.evaluate(async()=>{const r=await fetch('/quake/id1/pak0.pak',{headers:{Range:'bytes=0-11'}});return {status:r.status,range:r.headers.get('content-range'),length:(await r.arrayBuffer()).byteLength};});assert.equal(range.status,206);assert.equal(range.length,12);assert.match(range.range,/^bytes 0-11\//);
 console.log('Quake: Store engine install, missing-data setup, invalid PAK rejection, local PAK import, real WebGL engine frames and installed byte ranges passed.');
 await p.reload();await enter();await p.evaluate(()=>window.openDesktopWindow('quake'));await p.waitForFunction(()=>document.querySelector('.quake-window iframe')?.src.includes('/quake/index.php'));await p.waitForFunction(()=>document.querySelector('.quake-window iframe')?.contentWindow?.Host?.initialized===true&&document.querySelector('.quake-window iframe').contentWindow.Host.framecount>2,null,{timeout:90000});assert.deepEqual(errors,[]);console.log('Quake: installed engine and local game data survive private reload; no page exceptions.');
 await c.close();
}finally{await browser?.close();php?.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
