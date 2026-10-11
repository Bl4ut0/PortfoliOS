/** Foldable Desktop full viewport regression checks; no Google credentials. */
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
  await p.goto(target);await p.locator('[data-enter-view=desktop]').click();await p.locator('[data-session-public]').click();await p.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
  const measurements=[];
  for(const [width,height] of [[768,850],[690,767],[850,768],[412,915],[768,740],[1440,1000]]){
   await p.setViewportSize({width,height});await p.evaluate(()=>{state.desktopResolution='auto';applyDesktopResolution();});
   const bounds=await p.locator('#desktop-experience').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});
   assert.equal(Math.round(bounds.width),width,'Auto uses full browser width');assert.equal(Math.round(bounds.height),height,'Auto uses full dynamic browser height');assert.equal(Math.round(bounds.top),0);assert.equal(Math.round(bounds.left),0);measurements.push({width,height,bounds});
   for(const app of ['settings','files','store']) {
    await p.evaluate(id=>openDesktopWindow(id),app);
    const geometry=await p.locator('[data-window="'+app+'"]').evaluate(el=>{const r=el.getBoundingClientRect(),t=document.querySelector('.os-taskbar').getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,taskbarTop:t.top};});
    assert(geometry.top>=0&&geometry.bottom<=geometry.taskbarTop,app+' stays above the taskbar at '+width+'x'+height+': '+JSON.stringify(geometry));
    assert(geometry.left>=0&&geometry.right<=width,app+' stays within viewport width');
   }
  }
  await p.setViewportSize({width:768,height:850});await p.evaluate(()=>{state.desktopResolution='1280x720';applyDesktopResolution();});
  const fixed=await p.locator('#desktop-experience').evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,top:r.top};});assert(Math.abs(fixed.width/fixed.height-1280/720)<0.01,'Fixed resolution retains aspect ratio');assert(fixed.width<=768&&fixed.height<=850,'Fixed resolution fits');
  await p.evaluate(()=>{state.desktopResolution='auto';applyDesktopResolution();});await p.evaluate(()=>openDesktopWindow('settings'));await p.screenshot({path:path.join(root,'.tmp/fold-desktop.png')});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:'Fold-sized Desktop Auto fill, rotation, fold/cover resize, browser-height resize and fixed-resolution compatibility',measurements},null,2));

 }finally{await browser?.close();php.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
