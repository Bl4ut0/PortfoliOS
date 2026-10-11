/* Real pinned PdfCraft WASM smoke test; uses an original generated PDF, not a mocked editor. */
'use strict';
const assert = require('node:assert/strict'), path = require('node:path'), http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
function fixture() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length 49 >>\nstream\nBT /F1 18 Tf 30 150 Td (PortfoliOS test PDF) Tj ET\nendstream'];
  let pdf='%PDF-1.4\n', offsets=[0];
  objects.forEach((value,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(index+1)+' 0 obj\n'+value+'\nendobj\n';});
  const xref=Buffer.byteLength(pdf);
  pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return Buffer.from(pdf);
}
(async()=>{
 const server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const root=path.resolve(__dirname,'..'), php=spawn(process.env.PORTFOLIOS_PHP||'php',['-S','127.0.0.1:'+port,'-t',root],{windowsHide:true,stdio:'ignore'});let browser;
 try {
  await new Promise(r=>setTimeout(r,900));browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1500,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}), errors=[], engineRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/pdfcraft/runtime/'))engineRequests.push(r.url());});
  const target=process.env.PORTFOLIOS_TEST_URL || 'http://127.0.0.1:'+port+'/?view=desktop';
  const origin=new URL(target).origin; await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.addInitScript(()=>{if(window!==window.top)return;if(localStorage.getItem('pdfcraftTestSeed'))return;localStorage.setItem('pdfcraftTestSeed','1');localStorage.setItem('bl4ut0_private_profiles',JSON.stringify({private_pdfA:{sub:'pdfA',email:'a@example.test',name:'PDF A',source:'local'},private_pdfB:{sub:'pdfB',email:'b@example.test',name:'PDF B',source:'local'}}));});
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await page.locator('[data-enter-view=desktop]').click();await page.locator('[data-session-profile=private_pdfA]').click();
  await page.waitForFunction(()=>document.body.dataset.startupStage==='workspace');assert.equal(engineRequests.length,0,'Engine requested during boot');
  await page.evaluate(()=>window.openDesktopWindow('store'));
  for (const width of [430,624,900]) {
    await page.evaluate(width=>{const store=getDesktopWindowElement('store');store.style.width=width+'px';store.style.height='600px';},width);
    await page.screenshot({path:path.join(root,'.tmp/pdfcraft/store-'+width+'.png')});
    assert.deepEqual(await page.locator('.store-app-card').evaluateAll(cards=>cards.flatMap(card=>{const box=card.getBoundingClientRect();return [...card.querySelectorAll('h3,p,.store-app-card-meta,.store-app-card-action-container')].filter(item=>{const r=item.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1||r.bottom>box.bottom+1;}).map(item=>item.textContent);})),[],'Store content must fit each card');
  }
  await page.screenshot({path:path.join(root,'.tmp/pdfcraft/store-layout.png')});
  await page.locator('[data-install-store-app=pdfcraft]').click();await page.waitForFunction(()=>window.isStoreAppInstalled('pdfcraft'));await page.evaluate(()=>window.openDesktopWindow('pdfcraft'));
  await page.locator('[data-pdf-status]').filter({hasText:'Editor ready'}).waitFor({timeout:30000,state:'attached'}).catch(async error=>{console.log(await page.locator('[data-pdf-status]').textContent(),await page.locator('iframe[title="PdfCraft PDF editor"]').getAttribute('src'));await page.screenshot({path:path.join(root,'.tmp/pdfcraft/failure.png')});throw error;});
  const iframe=page.locator('iframe[title="PdfCraft PDF editor"]');assert.equal(await iframe.getAttribute('sandbox'),'allow-scripts allow-downloads');
  assert.equal(await page.locator('[data-pdf-files]').count(),0);
  await iframe.click({position:{x:100,y:20}});await page.locator('[data-pdf-dialog]').waitFor();
  await page.locator('[data-pdf-cancel]').click();await iframe.click({position:{x:100,y:20}});await page.locator('[data-pdf-dialog]').waitFor();
  await page.locator('[data-pdf-import]').setInputFiles({name:'original.pdf',mimeType:'application/pdf',buffer:fixture()});
  await page.locator('[data-pdf-status]').filter({hasText:'Opened original.pdf'}).waitFor({state:'attached'});
  await page.waitForTimeout(1500);await page.screenshot({path:path.join(root,'.tmp/pdfcraft/before-save.png')});
  // The real egui canvas has no DOM buttons. Rotate control coordinates correspond
  // to this fixed 1200x850 app viewport and are checked by dirty state + exported PDF.
  await iframe.click({position:{x:120,y:354}});await page.waitForTimeout(500);await iframe.click({position:{x:80,y:224}});await page.waitForTimeout(500);await page.screenshot({path:path.join(root,'.tmp/pdfcraft/rotate-dialog.png')});await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>window.closeDesktopWindow('pdfcraft')),false,'Dirty editor must veto close');
  assert.equal(await page.evaluate(async()=>{try{await prepareProfileSwitch();return false;}catch{return true;}}),true,'Dirty editor must veto profile switch');
  await iframe.click({position:{x:500,y:300}});await page.evaluate(()=>{window.pdfTestWrite=SystemFS.writeFile;SystemFS.writeFile=async()=>{throw new Error('Disposable save failure');};});
  await page.keyboard.press('Control+s');
  await page.locator('[data-pdf-status]').filter({hasText:'Save failed'}).waitFor({state:'attached'});
  assert.equal(await page.evaluate(()=>closeDesktopWindow('pdfcraft')),false,'Failed export must veto close');
  await page.evaluate(()=>{SystemFS.writeFile=window.pdfTestWrite;delete window.pdfTestWrite;});
  await page.locator('[data-pdf-retry]').click();
  await page.locator('[data-pdf-status]').filter({hasText:'Saved /documents/PdfCraft/original.pdf'}).waitFor({timeout:15000,state:'attached'});
  assert(await page.evaluate(async()=>{const file=await SystemFS.readFile('/documents/PdfCraft/original.pdf');return file.size>100 && file.metadata.security.verdict==='clean' && /\/Rotate\s+90/.test(await new Blob([file.data]).text());}));
  await iframe.click({position:{x:500,y:300}});await page.keyboard.press('Control+Shift+s');
  await page.waitForTimeout(800);await page.screenshot({path:path.join(root,'.tmp/pdfcraft/save-as.png')});
  await page.locator('[data-pdf-heading]').filter({hasText:'Save PDF As'}).waitFor();
  assert.equal(await page.evaluate(()=>closeDesktopWindow('pdfcraft')),false,'Open Save As dialog must veto close without hanging');
  await page.locator('[data-pdf-cancel]').click();
  await page.locator('[data-pdf-status]').filter({hasText:'Save cancelled'}).waitFor({state:'attached'});
  await page.locator('[data-pdf-retry]').click();await page.locator('[data-pdf-heading]').filter({hasText:'Save PDF As'}).waitFor();
  await page.locator('[data-pdf-up]').click();await page.locator('[data-pdf-root]').click();await page.locator('[data-pdf-dir="/documents"]').click();
  await page.locator('[data-pdf-new-name]').fill('Exports');await page.locator('[data-pdf-create]').click();
  await page.locator('[data-pdf-location]').filter({hasText:'/documents/Exports'}).waitFor();
  await page.locator('[data-pdf-name]').fill('edited.pdf');await page.locator('[data-pdf-confirm]').click();
  await page.locator('[data-pdf-status]').filter({hasText:'Saved /documents/Exports/edited.pdf'}).waitFor({state:'attached'});
  assert(await page.evaluate(()=>SystemFS.readFile('/documents/Exports/edited.pdf')));
  // Untrusted top-window messages cannot spoof an engine save or dirty state.
  await page.evaluate(()=>window.postMessage({type:'pdfcraft:save',name:'spoof.pdf',bytes:new ArrayBuffer(20)},'*'));
  await page.evaluate(()=>{const spoof=document.createElement('iframe');spoof.sandbox='allow-scripts';spoof.srcdoc='<script>parent.postMessage({type:"pdfcraft:save",name:"spoof.pdf",bytes:new ArrayBuffer(20)},"*")<\/script>';document.body.append(spoof);});
  await page.waitForTimeout(100);assert.equal(await page.evaluate(async()=>!!await SystemFS.readFile('/documents/PdfCraft/spoof.pdf')),false);
  await page.screenshot({path:path.join(root,'.tmp/pdfcraft/integrated.png')});
  await page.evaluate(()=>window.closeDesktopWindow('pdfcraft'));
  assert.equal(await page.locator('iframe[title="PdfCraft PDF editor"]').count(),0);
  await page.evaluate(async()=>{await window.ensureAppLoaded('pdfcraft');await window.openDesktopWindow('pdfcraft');});
  await page.locator('[data-pdf-status]').filter({hasText:'Editor ready'}).waitFor({timeout:90000,state:'attached'});
  await page.locator('iframe[title="PdfCraft PDF editor"]').click({position:{x:100,y:20}});await page.locator('[data-pdf-dir="/documents/PdfCraft"]').click();await page.locator('[data-pdf-path="/documents/PdfCraft/original.pdf"]').dblclick();
  await page.locator('[data-pdf-status]').filter({hasText:'Opened original.pdf'}).waitFor({state:'attached'});
  await page.evaluate(()=>closeDesktopWindow('pdfcraft'));
  await page.evaluate(()=>openDesktopWindow('files'));
  await page.locator('.file-item[data-path="/documents"]').dblclick();
  await page.locator('.file-item[data-path="/documents/PdfCraft"]').dblclick();
  await page.locator('.file-item[data-path="/documents/PdfCraft/original.pdf"]').dblclick();
  await page.locator('[data-pdf-status]').filter({hasText:'Opened original.pdf'}).waitFor({state:'attached',timeout:90000});
  await page.evaluate(async()=>{await prepareProfileSwitch();setCurrentUser('private_pdfB');await SystemFS.ensureDefaultFiles();});
  assert.equal(await page.evaluate(()=>SystemFS.readFile('/documents/PdfCraft/original.pdf')),null);
  await page.evaluate(async()=>{setCurrentUser('private_pdfA');await SystemFS.ensureDefaultFiles();});
  assert(await page.evaluate(()=>SystemFS.readFile('/documents/PdfCraft/original.pdf')));
  await page.evaluate(()=>openDesktopWindow('pdfcraft',{path:'/documents/PdfCraft/original.pdf'}));
  await page.locator('[data-pdf-status]').filter({hasText:'Opened original.pdf'}).waitFor({state:'attached',timeout:90000});await page.waitForTimeout(500);
  const autoFrame=page.locator('iframe[title="PdfCraft PDF editor"]');await autoFrame.click({position:{x:120,y:354}});await page.waitForTimeout(400);await autoFrame.click({position:{x:80,y:224}});await page.waitForTimeout(400);await autoFrame.click({position:{x:500,y:300}});
  assert.equal(await page.evaluate(()=>closeDesktopWindow('pdfcraft')),false,'Automatic public-switch fixture is dirty');
  await page.evaluate(()=>switchToPublicProfile());
  assert.equal(await page.evaluate(()=>SystemFS.readFile('/documents/PdfCraft/original.pdf')),null);
  await page.evaluate(async()=>{setInstalledStoreAppIds(['pdfcraft']);await SystemFS.writeFile('/documents/public-pdf-test.txt','public-pdf-test.txt','/documents','test',4,'text/plain');});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-enter-view=desktop]').click();await page.locator('[data-session-public]').click();await page.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
  assert.equal(await page.evaluate(()=>isStoreAppInstalled('pdfcraft')),false);assert.equal(await page.evaluate(()=>SystemFS.readFile('/documents/public-pdf-test.txt')),null);
  assert.deepEqual(errors,[]);console.log('PdfCraft real WASM passed: lazy boot, opaque frame, native Open/cancel/import, File Explorer launch, editor Save, rotation, dirty close/switch vetoes, failed-save retry, scanned SystemFS output, spoof rejection, teardown/reopen, private A/B isolation and public reload reset.');
 } finally {await browser?.close();php.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
