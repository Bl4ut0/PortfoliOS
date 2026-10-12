/** Cancelled Craft saves must not trap manual close or silently discard on handoff. */
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>r.abort());
  await page.setContent('<section id="root"></section>');
  await page.evaluate(()=>{window.state={currentUserId:'private_test'};window.appRegistry={};window.SystemFS={showSaveDialog:async()=>null};});
  await page.addScriptTag({path:require('node:path').resolve(__dirname,'../apps/_shared/craft-editor.js')});
  await page.evaluate(()=>{
   registerCraftEditor({id:'designcraft',title:'DesignCraft',icon:'test',types:[]});
   const app=appRegistry.designcraft,root=document.getElementById('root');root.innerHTML=app.renderBody();app.onOpen(root);
   window.dispatchEvent(new MessageEvent('message',{source:root.querySelector('iframe').contentWindow,origin:'null',data:{type:'craft:save',id:'cancelled',name:'untitled.design',bytes:new ArrayBuffer(4)}}));
  });
  await page.getByText('Save cancelled. Output retained; choose Retry save.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>appRegistry.designcraft.beforeClose(document.getElementById('root'),{autoSave:true,reason:'session-lost'})),false);
  assert.equal(await page.locator('[data-discard]').count(),0,'Automatic handoff cannot discard');
  async function close(){await page.evaluate(()=>{window.closeResult=undefined;window.closing=appRegistry.designcraft.beforeClose(document.getElementById('root'),{reason:'close'}).then(r=>window.closeResult=r);});}
  await close();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.closing),false);
  await close();await page.locator('.craft-close-confirm [data-retry]').click();
  assert.equal(await page.evaluate(()=>window.closing),false);
  await page.getByText('Save cancelled. Output retained; choose Retry save.',{exact:true}).waitFor();
  await close();await page.getByRole('button',{name:'Discard and close',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.closing),true);
  await page.evaluate(()=>appRegistry.designcraft.onClose(document.getElementById('root')));
  assert.equal(await page.locator('iframe').count(),0);
  console.log('PASS: cancel save, keep editing, retry, explicit discard and close, protected automatic handoff.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
