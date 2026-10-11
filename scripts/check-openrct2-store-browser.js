/** Opt-in live Apache/Store check; disposable local identity, no Google sign-in or game launch. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const originArg = process.argv.find(arg=>arg.startsWith('--origin='));
assert(originArg,'Pass --origin=https://os.bl4ut0.dev to explicitly enable live verification.');
const target = new URL(originArg.slice(9));
assert(['https:','http:'].includes(target.protocol)&&!target.username&&!target.password&&target.pathname==='/'&&!target.search&&!target.hash,'Origin must be an HTTP(S) site root without credentials.');
const origin=target.origin;
const root=path.resolve(__dirname,'..');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'desktop/store.js'),'utf8')+'\nwindow.auditConfig=GAME_INSTALL_CONFIGS.openrct2;',sandbox);
const files=Array.from(sandbox.window.auditConfig.files,file=>{
  const data=fs.readFileSync(path.join(root,file.path));
  return {path:file.path,url:file.url,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
});
(async()=>{
  const guardFiles=['openrct2.zip','assets.zip','RCT.zip'];
  for(const name of guardFiles) {
    const base=origin+'/apps/openrct2/runtime/'+name;
    const audit=Date.now();
    let index=0;
    for(const referer of [origin+'/',origin+'/?view=desktop',origin+'/index.html?view=desktop',origin+'/apps/openrct2/runtime/index.php','', 'https://other.example/',origin+'.other.example/']) {
      const url=base+'?store-audit='+audit+'-'+index++;
      const response=await fetch(url,{method:'HEAD',headers:referer?{Referer:referer}:{},signal:AbortSignal.timeout(20000)});
      const allowed=referer.startsWith(origin+'/');
      assert.equal(response.status,allowed?200:403,name+' referrer '+(referer||'(none)'));
      if(allowed)assert.equal(Number(response.headers.get('content-length')),fs.statSync(path.join(root,'apps/openrct2/runtime',name)).size,name+' live length');
    }
    const warm=base+'?warm-guard='+audit;
    await fetch(warm,{method:'HEAD',headers:{Referer:origin+'/'}});
    const cached=await fetch(warm,{method:'HEAD'});
    if(cached.status!==403)console.warn('Hosting limitation: shared CDN response bypasses origin hotlink guard for '+name+' ('+cached.headers.get('cf-cache-status')+'). This is not an authentication boundary.');
  }
  console.log('Fresh-URL origin guard: Store root/index/query and game runtime accepted; direct/external/spoofed requests denied for all three archives.');
  const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT||'playwright');
  const browser=await chromium.launch({channel:process.env.PORTFOLIOS_BROWSER_CHANNEL||'chrome',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'allow',reducedMotion:'reduce'});
    await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    await context.addInitScript(()=>{
      if(localStorage.getItem('openrctStoreAuditSeed'))return;
      localStorage.setItem('openrctStoreAuditSeed','1');
      localStorage.setItem('bl4ut0_private_profiles',JSON.stringify({private_storeAudit:{sub:'storeAudit',email:'store@example.test',name:'Store Audit',source:'local'}}));
      localStorage.setItem('bl4ut0CurrentUser','private_storeAudit');
    });
    const page=await context.newPage();
    const errors=[],responses=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requests.push(new URL(request.url()).pathname));
    page.on('response',response=>{
      const pathname=new URL(response.url()).pathname;
      if(files.some(file=>file.path===pathname))responses.push({path:pathname,status:response.status(),worker:response.fromServiceWorker()});
    });
    await page.goto(origin+'/?view=desktop&store-audit='+Date.now());
    await page.evaluate(()=>navigator.serviceWorker.ready);
    if(!await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)))await page.reload();
    assert.equal(await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),true,'Exercise installation with the real service worker active');
    async function enter() {
      await page.locator('[data-enter-view="desktop"]').click();
      await page.locator('[data-session-profile="private_storeAudit"]').click();
      await page.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
    }
    await enter();
    await page.evaluate(()=>window.openDesktopWindow('store'));
    await page.locator('[data-install-store-app="openrct2"]').click();
    await page.waitForFunction(()=>window.isStoreAppInstalled('openrct2')||(window.SystemLogs||[]).some(log=>String(log).includes('openrct2 installation failed')),null,{timeout:240000});
    assert.equal(await page.evaluate(()=>window.isStoreAppInstalled('openrct2')),true,'Store installation failed: '+await page.evaluate(()=>(window.SystemLogs||[]).filter(log=>String(log).includes('openrct2 installation failed')).join('\n')));
    await page.locator('.store-window [data-open-app="openrct2"]').waitFor();
    for(const file of files) {
      const actual=await page.evaluate(async pathname=>{
        const record=await window.SystemFS.readFile(pathname);
        if(!record)return null;
        const data=record.data;
        const digest=await crypto.subtle.digest('SHA-256',data);
        return {bytes:data.byteLength,sha256:Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join(''),sync:record.metadata?.sync,kind:record.metadata?.kind,app:record.metadata?.app};
      },file.path);
      assert.deepEqual(actual,{bytes:file.bytes,sha256:file.sha256,sync:false,kind:'app-runtime',app:'openrct2'},'Installed file must match real source bytes and remain outside private backup: '+file.path);
      assert(responses.some(response=>response.path===file.path&&response.status===200),'No successful Store response for '+file.path);
    }
    assert(!requests.some(url=>url.endsWith('/RCT.zip')),'Store should not download the full game-data archive');
    assert.equal(await page.locator('[data-window="openrct2"]').count(),0,'Installing must not start the game');
    console.log('Real Store installation: '+files.length+' files, '+files.reduce((sum,file)=>sum+file.bytes,0)+' bytes; all SystemFS hashes and no-backup runtime metadata match.');
    await page.reload();await enter();
    await page.evaluate(()=>window.openDesktopWindow('store'));
    assert.equal(await page.evaluate(()=>window.isStoreAppInstalled('openrct2')),true);
    await page.locator('.store-window [data-open-app="openrct2"]').waitFor();
    assert.equal(await page.evaluate(async()=> (await window.SystemFS.readFile('/apps/openrct2/runtime/openrct2.zip'))?.data?.byteLength),files.find(file=>file.path.endsWith('/openrct2.zip')).bytes);
    assert.deepEqual(errors,[]);
    console.log('Private install survives reload, Launch is available, no page exceptions. Game execution and RCT.zip are outside this installation check.');
    await context.close();
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
