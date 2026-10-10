/** Rendered theme/contrast regression audit. Uses a disposable Chrome profile. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webmanifest':'application/manifest+json' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.'))) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if(error) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cross-Origin-Opener-Policy':'same-origin', 'Cross-Origin-Embedder-Policy':'require-corp' });
    response.end(data);
  });
});
async function contrastAudit(page, selector) {
  return page.evaluate(selector => {
    const root = document.querySelector(selector); if (!root) throw Error('Missing root: ' + selector);
    const parse = color => { const n = color.match(/[\d.]+/g)?.map(Number); const scale = color.startsWith('color(srgb ') ? 255 : 1; return n?.length >= 3 ? [n[0]*scale,n[1]*scale,n[2]*scale,n[3] ?? 1] : [0,0,0,0]; };
    const over = (fg,bg) => { const a=fg[3]+bg[3]*(1-fg[3]); return a ? [...[0,1,2].map(i=>(fg[i]*fg[3]+bg[i]*bg[3]*(1-fg[3]))/a),a] : [0,0,0,0]; };
    const lum = rgb => rgb.slice(0,3).map(c=>{ c/=255; return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4; }).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
    const ratio = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    const failures=[]; let checked=0;
    for(const el of [root,...root.querySelectorAll('*')]) {
      const directText=Array.from(el.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).join(' ').trim();
      const isInput=el.matches('input:not([type=color]):not([type=range]):not([type=checkbox]):not([type=file]),textarea');
      const placeholder=isInput&&!el.value?el.getAttribute('placeholder'):null;
      const text=directText||(isInput?(el.value||placeholder||''): '');
      if(!text || !el.getClientRects().length || el.closest('[hidden], [aria-hidden="true"], :disabled, canvas, iframe, .writer-page, .boot-screen, .screensaver-stage')) continue;
      const style=getComputedStyle(el, placeholder ? "::placeholder" : null);
      if(style.visibility!=='visible' || Number(style.opacity)<.6) continue;
      const chain=[];let faded=false;
      for(let node=el;node;node=node.parentElement) { const s=getComputedStyle(node); if(Number(s.opacity)<.6) {faded=true;break;} chain.push({color:parse(s.backgroundColor),image:s.backgroundImage}); }
      if(faded)continue;
      let background=[255,255,255,1];
      for(const layer of chain.reverse()) {
        background=over(layer.color,background);
        const stops=(layer.image.match(/rgba?\([^)]*\)|color\(srgb [^)]*\)/g)||[]).map(parse).filter(color=>color[3]===1);
        if(stops.length) background=stops.sort((a,b)=>ratio(parse(style.color),a)-ratio(parse(style.color),b))[0];
      }
      const foreground=over(parse(style.color),background);
      const minimum=(parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && Number(style.fontWeight)>=700))?3:4.5;
      const contrast=ratio(foreground,background); checked++;
      if(contrast < minimum) failures.push({text:text.slice(0,72),selector:el.tagName.toLowerCase()+(el.className?'.'+String(el.className).trim().replace(/\s+/g,'.'):''),contrast:+contrast.toFixed(2),minimum,foreground:style.color,background:background.map(Math.round).slice(0,3)});
    }
    return { checked, failures };
  }, selector);
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const results=[];
 async function record(page,scope,theme,selector) { const result=await contrastAudit(page,selector); results.push({scope,theme,...result}); }
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.locator('[data-enter-view="desktop"]').click({timeout:15000});
  await page.locator('[data-session-public]').click();
  await page.waitForFunction(()=>document.body.dataset.startupStage === "workspace");
  await page.evaluate(()=>window.setInstalledStoreAppIds(['romplayer','iptv']));
  const themes=await page.evaluate(()=>window.portfolioThemes.map(theme=>theme.id));
  await page.evaluate(()=>window.openDesktopWindow('settings'));
  for(const theme of themes) {
   await page.evaluate(theme=>window.setPortfolioTheme(theme),theme);
   for(const tab of ['accounts','desktop','appearance','mobile','cloud-sync','local-ai','recovery','debug']) {
    const button=page.locator('.settings-tab-btn[data-tab="'+tab+'"]');
    if(!await button.count())continue;
    await button.click();
    await record(page,'Settings/'+tab,theme,'.settings-window');
   }
   await page.locator('#start-toggle').click();
   await record(page,'Start',theme,'.start-menu');
   await page.locator('[data-start-view="all"]').click();
   await record(page,'Start/all apps',theme,'.start-menu');
   await page.locator('[data-start-view="pinned"]').click();
   await page.locator('#start-toggle').click();
   await record(page,'Taskbar',theme,'.os-taskbar');
   for(const [toggle,selector] of [['#clock-toggle','#calendar-panel'],['#volume-toggle','#volume-panel'],['#local-ai-tray-toggle','#local-ai-tray-panel']]) {
    await page.locator(toggle).click(); await record(page,'Panel/'+toggle,theme,selector); await page.locator(toggle).click();
   }
   await page.evaluate(()=>{window.BrainHelper.show();window.BrainHelper.openBubble();});
   await record(page,'Assistant bubble',theme,'.brain-helper-bubble');
   await page.evaluate(()=>{window.BrainHelper.closeBubble();window.BrainHelper.hide();});
  }
  await page.locator('.settings-tab-btn[data-tab="debug"]').click();
  const report=await page.evaluate(()=>{window.addSystemLog('test','Appearance audit log');return window.getSystemDebugReport();});
  assert.match(report,/build=2026\.10\.10\.2 loaded=\d{4}-\d{2}-\d{2}T/);
  assert.match(report,/core\/gdrive-sync\.js\?v=2026\.10\.10\.2/);
  assert.match(report,/\[LocalAI Snapshot\]/);
  assert.match(report,/\[\d{4}-\d{2}-\d{2}T[^\]]+Z\] \[TEST\] Appearance audit log/);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.appearanceCopiedLog=text;}}}));
  await page.locator('#settings-debug-copy-btn').click();
  const copied=await page.evaluate(()=>window.appearanceCopiedLog);
  assert.match(copied,/\[PortfoliOS Debug\]/);assert.match(copied,/\[Assets\]/);assert.match(copied,/\[LocalAI Snapshot\]/);assert.match(copied,/Appearance audit log/);
  await page.locator('#settings-debug-clear-btn').click();
  const cleared=await page.evaluate(()=>window.getSystemDebugReport());
  assert.match(cleared,/\[PortfoliOS Debug\]/);assert(!cleared.includes('Appearance audit log'));
  await page.evaluate(()=>window.closeDesktopWindow('settings'));
  for(const id of ['files','store','profile','dossier','network','linux','cli','local-ai','musicmini','office','taskmgr','security-center','browser','romplayer','iptv']) {
   console.log('Auditing Desktop ' + id);
   await page.evaluate(id=>window.openDesktopWindow(id),id);
   const selector='.desktop-window[data-window="'+id+'"]';
   await page.locator(selector).waitFor();
   if(id === "office") await page.locator(selector + " .office-splash").waitFor({state:"detached",timeout:15000});
   for(const theme of themes) {
    await page.evaluate(theme=>window.setPortfolioTheme(theme),theme);
    await record(page,id,theme,selector);
   }
   if(id==='office') {
    for(const [button,label] of [['.btn-new-doc-action','Writer'],['.btn-new-calc-action','Calc']]) {
     if(!await page.locator(selector+' '+button+':visible').count()) await page.locator(selector+' .btn-menubar-dashboard:visible').first().click();
     await page.locator(selector+' '+button+':visible').first().click();
     for(const theme of themes) {await page.evaluate(theme=>window.setPortfolioTheme(theme),theme);await record(page,'Office/'+label,theme,selector);}
    }
   }
   await page.evaluate(id=>window.closeDesktopWindow(id),id);
  }
  // Render game/player chrome without running or downloading the embedded engines.
  for(const id of ['doomsource','duke32','diablo','quake','ut99','openrct2','webamp']) {
   await page.evaluate(async id=>{
    const app=await window.ensureAppLoaded(id);
    const fixture=document.createElement('section');fixture.id='appearance-loader-fixture';
    fixture.className='desktop-window '+app.windowClass;
    fixture.style.cssText='width:800px;height:600px;left:20px;top:20px;display:flex;flex-direction:column;';
    const template=document.createElement('template');template.innerHTML=app.renderBody();
    template.content.querySelectorAll('iframe').forEach(frame=>frame.removeAttribute('src'));
    fixture.innerHTML='<div class="window-bar">'+app.title+'</div><div class="window-body"></div>';
    fixture.querySelector('.window-body').append(template.content);
    document.querySelector('#desktop-experience').append(fixture);
   },id);
   for(const theme of themes) {await page.evaluate(theme=>window.setPortfolioTheme(theme),theme);await record(page,'Loader/'+id,theme,'#appearance-loader-fixture');}
   await page.evaluate(()=>document.querySelector('#appearance-loader-fixture').remove());
  }
  await page.evaluate(()=>window.setPortfolioTheme('light'));
  await page.evaluate(()=>window.openDesktopWindow('files'));
  await page.evaluate(()=>window.openDesktopWindow('settings'));
  await page.locator('.settings-tab-btn[data-tab="appearance"]').click();
  if(process.env.PORTFOLIOS_APPEARANCE_SCREENSHOTS) await page.screenshot({path:path.join(root,'docs','appearance-light-desktop.png')});
  // Extreme custom accents must retain readable action text and separate text ink.
  for(const primary of ['#000000','#ffffff','#ffff00','#0000ff','#ff00ff']) {
   await page.evaluate(primary=>{window.state.themePrimary=primary;window.applyThemeColors();},primary);
   await record(page,'Custom accent',primary,'.settings-window');
  }
  await context.close();
  const quickContext=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
  const quick=await quickContext.newPage();
  await quick.goto(origin,{waitUntil:'domcontentloaded'});
  await quick.locator('[data-enter-view="quick"]').click({timeout:15000});
  await quick.waitForFunction(()=>document.body.dataset.startupStage === 'workspace');
  for(const theme of themes) {await quick.evaluate(theme=>window.setPortfolioTheme(theme),theme);await record(quick,'Quick',theme,'[data-view-panel="quick"]');}
  await quickContext.close();
  const phone=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
  const mobile=await phone.newPage();
  await mobile.goto(origin,{waitUntil:'domcontentloaded'});
  await mobile.locator('[data-enter-view="mobile"]').click({timeout:15000});
  await mobile.locator('#session-chooser').waitFor();
  for(const theme of ['dark','light']) {
   await mobile.evaluate(theme=>document.getElementById('mobile-device').dataset.mobileTheme=theme,theme);
   await record(mobile,'Phone sign-in',theme,'#mobile-device .session-chooser');
  }
  await mobile.locator('[data-session-public]').click();
  await mobile.waitForFunction(()=>document.body.dataset.startupStage === 'workspace');
  for(const theme of ['dark','light']) {
   await mobile.evaluate(theme=>window.MobileOS.setPreference('theme',theme),theme);
   const wallpapers=new Set();
   for(const wallpaper of ['aurora','ember','forest','graphite']) {
    await mobile.evaluate(wallpaper=>window.MobileOS.setPreference('wallpaper',wallpaper),wallpaper);
    wallpapers.add(await mobile.locator('.mobile-wallpaper').evaluate(el=>getComputedStyle(el).backgroundImage));
    await record(mobile,'Phone wallpaper',theme+'/'+wallpaper,'#mobile-device');
   }
   assert.equal(wallpapers.size,4,'all four phone wallpapers must remain distinct in either theme');
  }
  await mobile.evaluate(()=>window.setInstalledStoreAppIds(['romplayer']));
  for(const theme of ['dark','light']) {
   await mobile.evaluate(theme=>window.MobileOS.setPreference('theme',theme),theme);
   for(const accent of ['cyan','blue','violet','green','amber']) {
    await mobile.evaluate(accent=>window.MobileOS.setPreference('accent',accent),accent);
    console.log('Auditing Mobile ' + theme + '/' + accent);
    for(const id of ['settings','store','files','documents','local-ai','taskmgr','security-center','profile','dossier','browser','music','media','calculator','devhub','status','homelab','automation','addons','guildcraft','survival-ai','wardenit','romplayer','flappybird']) {
     await mobile.evaluate(id=>window.MobileOS.openApp(id),id);
     await record(mobile,'Mobile/'+id,theme+'/'+accent,'#mobile-device .mobile-task:not([hidden])');
     await mobile.evaluate(id=>window.MobileOS.closeTask(id,'audit'),id);
    }
    await record(mobile,'Phone home',theme+'/'+accent,'#mobile-device');
   }
  }
  if(process.env.PORTFOLIOS_APPEARANCE_SCREENSHOTS) {await mobile.evaluate(()=>window.MobileOS.openApp('settings'));await mobile.screenshot({path:path.join(root,'docs','appearance-light-mobile.png')});}
  await phone.close();
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
 fs.writeFileSync(path.join(root,'docs','appearance-audit-results.json'),JSON.stringify({generatedAt:new Date().toISOString(),results},null,2)+'\n');
 const failures=results.filter(result=>result.failures.length);
 console.log(JSON.stringify({scenarios:results.length,checked:results.reduce((s,r)=>s+r.checked,0),failedScenarios:failures.length,examples:failures.slice(0,3)},null,2));
 if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
