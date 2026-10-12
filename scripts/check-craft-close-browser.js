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
  await page.getByText('Save cancelled.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>appRegistry.designcraft.beforeClose(document.getElementById('root'),{reason:'close'})),true,'Cancelled save must not block closing');
  await page.evaluate(()=>{
   SystemFS.showSaveDialog=async()=>({path:'/documents/test.design'});SystemFS.showClosePrompt=async()=> 'cancel';SystemFS.getName=()=> 'test.design';SystemFS.getParentPath=()=>'/documents';
   window.SecurityKernel={importFile:async()=>{throw new Error('Disk write failed');}};
   window.dispatchEvent(new MessageEvent('message',{source:document.querySelector('iframe').contentWindow,origin:'null',data:{type:'craft:save',id:'failed',name:'test.design',bytes:new ArrayBuffer(4)}}));
  });
  await page.getByText('Disk write failed',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>appRegistry.designcraft.beforeClose(document.getElementById('root'),{autoSave:true,reason:'session-lost'})),false);
  assert.equal(await page.locator('[data-discard]').count(),0,'Automatic handoff cannot discard');
  assert.equal(await page.evaluate(()=>appRegistry.designcraft.beforeClose(document.getElementById('root'),{reason:'close'})),false,'Cancel keeps editor open');
  await page.evaluate(()=>SystemFS.showClosePrompt=async()=> 'save');
  assert.equal(await page.evaluate(()=>appRegistry.designcraft.beforeClose(document.getElementById('root'),{reason:'close'})),false,'Save failure keeps editor open');
  await page.evaluate(()=>SystemFS.showClosePrompt=async()=> 'discard');
  assert.equal(await page.evaluate(()=>appRegistry.designcraft.beforeClose(document.getElementById('root'),{reason:'close'})),true,'Discard closes even when an export failed');
  await page.evaluate(()=>appRegistry.designcraft.onClose(document.getElementById('root')));
  assert.equal(await page.locator('iframe').count(),0);
  for(const id of ['pdfcraft','vscode']){
   await page.addScriptTag({path:require('node:path').resolve(__dirname,'../apps/'+id+'/app.js')});
   await page.evaluate(id=>{
    const app=appRegistry[id],root=document.getElementById('root');root.innerHTML=app.renderBody();app.onOpen(root);
    if(id==='pdfcraft')window.dispatchEvent(new MessageEvent('message',{source:root.querySelector('iframe').contentWindow,origin:'null',data:{type:'pdfcraft:dirty',dirty:true}}));
    SystemFS.showClosePrompt=async()=> 'cancel';
   },id);
   assert.equal(await page.evaluate(id=>appRegistry[id].beforeClose(document.getElementById('root'),{reason:'close'}),id),false,id+' Cancel keeps window open');
   await page.evaluate(()=>SystemFS.showClosePrompt=async()=> 'discard');
   assert.equal(await page.evaluate(id=>appRegistry[id].beforeClose(document.getElementById('root'),{reason:'close'}),id),true,id+' discard closes');
   await page.evaluate(id=>appRegistry[id].onClose(document.getElementById('root')),id);
  }
  console.log('PASS: cancel save, close prompt cancellation, failed save protection, discard bypass, protected automatic handoff.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
