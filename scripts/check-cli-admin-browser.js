/** CLI input and administrator-only Studio lifecycle in disposable Chrome. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
const root=path.resolve(__dirname,'..'),mime={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://test').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)||name.split('/').some(p=>p.startsWith('.')))return res.writeHead(403).end();fs.readFile(file,(e,data)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
  const target=process.env.PORTFOLIOS_TEST_URL || 'http://127.0.0.1:'+server.address().port+'/',origin=new URL(target).origin;
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await context.addInitScript(()=>localStorage.setItem('bl4ut0_private_profiles',JSON.stringify({private_iconsA:{sub:'iconsA',email:'icons-a@example.test',name:'Icons A',source:'local'},private_iconsB:{sub:'iconsB',email:'icons-b@example.test',name:'Icons B',source:'local'}})));
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  async function enter(view='desktop',profile='private_iconsA'){
   await p.locator('[data-enter-view='+view+']').click();await p.locator(profile==='public'?'[data-session-public]':'[data-session-profile="'+profile+'"]').click();await p.waitForFunction(()=>document.body.dataset.startupStage==='workspace');await p.evaluate(()=>AppIcons.load());
  }
  await p.goto(target);await enter();

  assert.equal(await p.evaluate(()=>isVisibleForCurrentUser('portfolio-studio')),false);
  await p.evaluate(()=>openDesktopWindow('portfolio-studio'));
  assert.equal(await p.locator('[data-window="portfolio-studio"]:visible').count(),0);
  await p.evaluate(()=>openDesktopWindow('cli'));
  await p.locator('#terminal-output').click();
  await p.keyboard.type('help');
  assert.equal(await p.locator('#terminal-input').inputValue(),'help');
  await p.keyboard.press('Enter');
  for(const size of [{width:1440,height:700},{width:412,height:915}]){
   await p.setViewportSize(size);
   const box=await p.locator('#terminal-input').boundingBox(), frame=await p.locator('[data-window="cli"]').boundingBox();
   assert(box.width>30 && box.y+box.height<=frame.y+frame.height,'Input stays inside window');
  }
  await p.setViewportSize({width:1440,height:1000});
  await context.route('**/core/admin.php',route=>route.fulfill({json:{success:true,token:'disposable-test-token',expiresAt:Date.now()+60000}}));
  await p.locator('#terminal-input').fill('admin');await p.keyboard.press('Enter');
  await p.waitForFunction(()=>document.querySelector('#terminal-input').type==='password');
  await p.locator('#terminal-input').fill('fixture-only');await p.keyboard.press('Enter');
  await p.waitForFunction(()=>AdminSession?.isAuthenticated());
  assert.equal(await p.evaluate(()=>isVisibleForCurrentUser('portfolio-studio')),true);
  await p.waitForFunction(()=>state.openApps.has('portfolio-studio'));
  await p.evaluate(()=>setCurrentUser('private_iconsB'));
  assert.equal(await p.evaluate(()=>isVisibleForCurrentUser('portfolio-studio')),false);
  await p.evaluate(()=>establishAdminSession({token:'expiry-fixture',expiresAt:Date.now()+150},state.currentUserId));
  await p.waitForFunction(()=>!window.AdminSession);
  assert.equal(await p.evaluate(()=>isVisibleForCurrentUser('portfolio-studio')),false);
  await p.evaluate(()=>setCurrentUser('bl4ut0'));
  assert.equal(await p.evaluate(()=>isVisibleForCurrentUser('portfolio-studio')),false);
  await p.evaluate(()=>establishAdminSession({token:'public-admin-fixture',expiresAt:Date.now()+60000},state.currentUserId));
  assert.equal(await p.evaluate(()=>isVisibleForCurrentUser('portfolio-studio')),true,'Admin command also unlocks Studio from public profile');
  await p.evaluate(()=>clearAdminSession());
  await p.evaluate(()=>closeDesktopWindow('cli'));
  await p.evaluate(()=>openDesktopWindow('cli'));
  await p.locator('#terminal-output').click();await p.keyboard.type('pwd');
  assert.equal(await p.locator('#terminal-input').inputValue(),'pwd','Reopened CLI binds focus');
  console.log('PASS: CLI typing and sizing; Studio blocked before admin, enabled after mocked login, revoked on profile switch and expiry.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
