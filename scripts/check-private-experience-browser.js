/** Real IndexedDB and native Store/profile checks in disposable browser contexts. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://local').pathname);
  const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if (!file.startsWith(root+path.sep) || pathname.split('/').some(part=>part.startsWith('.'))) return res.writeHead(403).end();
  fs.readFile(file,(error,bytes) => { if(error)return res.writeHead(404).end(); res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});res.end(bytes); });
});
(async () => {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  let browser;
  try {
    browser=await chromium.launch({channel:process.env.PORTFOLIOS_BROWSER_CHANNEL||'chrome',headless:true});
    const filesystemContext=await browser.newContext();
    const filesystemPage=await filesystemContext.newPage();
    await filesystemPage.goto(origin+'/scripts/check-profile-filesystem.html');
    await filesystemPage.waitForFunction(()=>!document.querySelector('#summary').textContent.startsWith('Running'));
    assert.equal(await filesystemPage.locator('#summary').textContent(),'All profile filesystem checks passed');
    console.log('IndexedDB profile audit: '+await filesystemPage.locator('#results .pass').count()+' filesystem isolation, save-race and public-reset checks passed.');
    await filesystemContext.close();
    for(const view of ['desktop','mobile']) {
      const context=await browser.newContext({viewport:view==='mobile'?{width:390,height:844}:{width:1440,height:1000},isMobile:view==='mobile',hasTouch:view==='mobile',reducedMotion:'reduce',serviceWorkers:'block'});
      await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
      await context.addInitScript(()=>{
        if(localStorage.getItem('privateAuditSeed'))return;
        localStorage.setItem('privateAuditSeed','1');
        localStorage.setItem('bl4ut0_private_profiles',JSON.stringify({private_auditA:{sub:'auditA',email:'a@example.test',name:'Audit A',source:'local'},private_auditB:{sub:'auditB',email:'b@example.test',name:'Audit B',source:'local'}}));
        localStorage.setItem('bl4ut0CurrentUser','private_auditA');
      });
      const page=await context.newPage();const errors=[];const engineRequests=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('request',request=>{if(/codex_wasm|agent-wasm/.test(request.url()))engineRequests.push(request.url());});
      async function enter(profile='private_auditA') {
        await page.locator('[data-enter-view="'+view+'"]').click();
        await page.locator('#session-chooser').waitFor();
        assert.equal(await page.locator('[data-view-panel]').count(),0,'Workspace must remain unmounted until profile selection');
        await page.locator('[data-session-profile="'+profile+'"]').click();
        await page.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
      }
      const open=id=>page.evaluate(({id,view})=>view==='mobile'?window.MobileOS.openApp(id):window.openDesktopWindow(id),{id,view});
      await page.goto(origin+'/?view='+view);await enter();
      assert.equal(await page.evaluate(()=>Boolean(window.CodexPreview)),false,'Preview is loaded only for its consumer');
      assert.match(await page.evaluate(()=>window.getAssistantSessionStatus()),/private profile is active/i);
      await open('store');
      await page.locator(view==='mobile'?'[data-store-add="codex"]':'[data-install-store-app="codex"]').click();
      await page.waitForFunction(()=>window.isStoreAppInstalled('codex'));
      await open('codex');
      const panel=page.locator('[data-codex-preview]');
      assert.match(await panel.textContent(),/browser engine is not installed/i);
      await panel.locator('[data-codex-check]').click();
      await page.waitForFunction(()=>document.querySelector('[data-codex-result]')?.textContent.startsWith('Local save and read verified'));
      const savedPath=await page.evaluate(async()=> (await window.SystemFS.readDir('/documents')).find(file=>file.name.startsWith('codex-workspace-check-')).path);
      await page.evaluate(async()=>{window.setPortfolioTheme('light');await window.savePreferencesToFilesystem({strict:true});});
      await page.reload();await enter();
      assert.equal(await page.evaluate(()=>window.state.themeId),'light');
      assert.equal(await page.evaluate(()=>window.isStoreAppInstalled('codex')),true);
      assert(await page.evaluate(savedPath=>window.SystemFS.readFile(savedPath),savedPath));
      await open('codex');
      for (const theme of ['dark','light','oled']) {
        await page.evaluate(theme=>window.setPortfolioTheme(theme),theme);
        assert.equal(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Preview must fit the selected experience');
      }
      await page.evaluate(async()=>{await window.prepareProfileSwitch();window.setCurrentUser('private_auditB');await window.SystemFS.ensureDefaultFiles();});
      assert.equal(await page.evaluate(savedPath=>window.SystemFS.readFile(savedPath),savedPath),null);
      assert.equal(await page.evaluate(()=>window.isStoreAppInstalled('codex')),false);
      await page.evaluate(()=>window.switchToPublicProfile());
      assert.equal(await page.locator('#gdrive-reconnect-prompt').count(),0);
      await page.evaluate(()=>window.setInstalledStoreAppIds(['codex']));
      await open('codex');
      assert.equal(await page.locator('[data-codex-check]').isDisabled(),true);
      await page.evaluate(()=>window.SystemFS.writeFile('/documents/public-audit.txt','public-audit.txt','/documents','public',6,'text/plain'));
      await page.reload();
      await page.locator('[data-enter-view="'+view+'"]').click();await page.locator('[data-session-public]').click();
      await page.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
      assert.equal(await page.evaluate(()=>window.isStoreAppInstalled('codex')),false);
      assert.equal(await page.evaluate(()=>window.SystemFS.readFile('/documents/public-audit.txt')),null);
      await page.evaluate(async()=>{await window.prepareProfileSwitch();window.setCurrentUser('private_auditA');await window.SystemFS.ensureDefaultFiles();});
      assert(await page.evaluate(savedPath=>window.SystemFS.readFile(savedPath),savedPath));
      assert.equal(await page.evaluate(()=>window.isStoreAppInstalled('codex')),true);
      assert.deepEqual(engineRequests,[]);
      assert.deepEqual(errors,[]);
      console.log(view+': chooser before mount, private local saves/preferences/install persistence, A/B isolation, public reset, preview gate and no Codex binary downloads passed.');
      await context.close();
    }
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
