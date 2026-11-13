/** Native-only policy exercised with the real imported Browser.JS UI. No external traffic allowed. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT||'playwright');
(async()=>{
 const server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const root=path.resolve(__dirname,'..'),origin='http://127.0.0.1:'+port;
 const php=spawn(process.env.PORTFOLIOS_PHP||'php',['-S','127.0.0.1:'+port,'-t',root],{windowsHide:true,stdio:'ignore'});let browser;
 try{
  for(let n=0;n<50;n++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const mobile of [false,true]){
   const ctx=await browser.newContext({viewport:mobile?{width:430,height:900}:{width:1280,height:900},serviceWorkers:'block'}),requests=[],errors=[];
   await ctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
   await ctx.route(origin+'/__native-policy',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><div id="test"></div><script>window.state={currentUserId:"private_network_fixture"};window.isPrivateUser=()=>true;window.EventBus={on(){}};localStorage.setItem("bl4ut0_private_network_fixture_BrowserProvider","hyperbeam");localStorage.setItem("bl4ut0_private_network_fixture_BrowserProxy",JSON.stringify({mode:"automatic"}));</script><script src="/core/browser-workspace.js"></script>'}));
   const p=await ctx.newPage();p.on('request',r=>requests.push(r.url()));p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/__native-policy');
   await p.evaluate(mobile=>{const host=document.querySelector('#test');host.innerHTML=BrowserWorkspace.render();window.testBrowser=BrowserWorkspace.mount(host.firstElementChild,{mobile});},mobile);
   const frame=p.frameLocator('.web-browser-relay-frame');await frame.getByLabel('Search or enter address',{exact:true}).waitFor();
   await frame.getByTitle('More Options').click();await frame.getByRole('menuitem',{name:'Settings',exact:true}).click();await frame.getByRole('button',{name:'Proxy',exact:true}).click();
   await frame.getByRole('heading',{name:'Network connection',exact:true}).waitFor();
   assert.equal(await frame.getByLabel('Wisp endpoint').isVisible(),false);assert.equal(await frame.getByLabel('Network transport').inputValue(),'relay');
   await frame.getByRole('button',{name:'Apply connection',exact:true}).click();await frame.getByRole('status').filter({hasText:'Sandbox mode:'}).waitFor();
   assert.equal(await p.locator('[data-web-provider]').count(),1);
   const rejected=await frame.locator('html').evaluate(()=>new Promise(resolve=>{
    const receive=e=>{if(e.data?.requestId==='forbidden-network-mode'){window.removeEventListener('message',receive);resolve(e.data)}};
    window.addEventListener('message',receive);
    parent.postMessage({source:'portfolios-browser',type:'configure',requestId:'forbidden-network-mode',config:{mode:'automatic',endpoint:'wss://forbidden.fixture/',remember:true}},location.origin);
   }));
   assert.match(rejected.error,/disabled/);assert.equal(rejected.config.mode,'relay');
   await frame.getByLabel('Network transport').selectOption('custom');
   await frame.getByLabel('Wisp endpoint').fill('https://invalid.fixture/');
   await frame.getByRole('button',{name:'Apply connection',exact:true}).click();
   await frame.getByRole('status').filter({hasText:'secure wss://'}).waitFor();
   await frame.getByLabel('Wisp endpoint').fill('wss://user-relay.fixture/wisp/');
   await frame.getByText('Remember this connection for my profile',{exact:true}).click();
   await frame.getByRole('button',{name:'Apply connection',exact:true}).click();
   await p.waitForFunction(()=>JSON.parse(localStorage.getItem('bl4ut0_private_network_fixture_BrowserProxy'))?.mode==='custom');
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('bl4ut0_private_network_fixture_BrowserProxy')).endpoint),'wss://user-relay.fixture/wisp/');


   const hosted=await p.request.post(origin+'/apps/browser/hyperbeam.php',{data:{action:'start'}});assert.equal(hosted.status(),410);
   assert(!requests.some(u=>/sensible-ship|browser\.puter|mercurywork|hyperbeam|proxysite|hide\.me/.test(u)),'No fallback services should be contacted');
   assert.deepEqual(errors,[]);await p.evaluate(()=>testBrowser.destroy());await ctx.close();
  }
  console.log('PASS: Desktop/Mobile Native Relay and explicit custom Wisp settings, invalid endpoint rejection, remembered custom configuration, no automatic fallback requests and disabled hosted allocation.');
 }finally{await browser?.close();php.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
