const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 const calls=[];let delayPin=false,releasePin;
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());calls.push({path:u.pathname,search:u.search,method:req.method(),headers:req.headers()});
  if(u.host==='workspace.test')return route.fulfill({contentType:'text/html',body:'<div id="app"></div>'});
  let body={};
  if(u.pathname==='/api/v2/pins')body={id:123,code:'TEST',expiresIn:300};
  else if(u.pathname==='/api/v2/pins/123'){if(delayPin)await new Promise(r=>releasePin=r);body={authToken:'fixture-cloud-token'};}
  else if(u.pathname==='/api/v2/resources')body=[{name:'Test server',provides:'server',accessToken:'fixture-server-token',connections:[{uri:'http://insecure.test',local:true},{uri:'https://pms.test',local:true}]}];
  else if(u.pathname==='/library/sections')body={MediaContainer:{Directory:[{key:'1',title:'Movies',type:'movie'}]}};
  else if(u.pathname==='/hubs/home/continueWatching')body={MediaContainer:{Metadata:[{ratingKey:'42',key:'/library/metadata/42',title:'Fixture <movie>',type:'movie'}],totalSize:1}};
  else if(u.pathname==='/library/metadata/42')body={MediaContainer:{Metadata:[{ratingKey:'42',key:'/library/metadata/42',title:'Fixture movie',duration:10000,Media:[{container:'mp4',videoCodec:'h264',audioCodec:'aac',Part:[{key:'/library/parts/42/file.mp4'}]}]}]}};
  return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
 });
 await page.goto('https://workspace.test');
 await page.evaluate(()=>{window.state={currentUserId:'private-fixture'};const handlers={};window.EventBus={on:(n,f)=>(handlers[n]??=[]).push(f),off:(n,f)=>handlers[n]=handlers[n]?.filter(x=>x!==f),emit:n=>handlers[n]?.slice().forEach(f=>f())};HTMLMediaElement.prototype.play=function(){this.dispatchEvent(new Event('playing'));return Promise.resolve()};HTMLMediaElement.prototype.pause=function(){};HTMLMediaElement.prototype.load=function(){};HTMLMediaElement.prototype.canPlayType=()=> 'probably';window.open=()=>null;});
 for(const file of ['core/plex-client.js','core/plex-player.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'..',file),'utf8')});
 await page.evaluate(()=>{document.querySelector('#app').innerHTML=PlexPlayer.markup();PlexPlayer.mount(document.querySelector('#app'));});
 assert.equal(await page.getByRole('heading',{name:'Welcome to Plex Player'}).count(),1);
 const auth=await page.evaluate(()=>{const c=new PlexClient();const url=c.signInUrl({code:'strong-secret'});const id=c.id;c.close();return {url,id}});
 const params=new URLSearchParams(new URL(auth.url).hash.slice(2));assert.equal(params.get('clientID'),auth.id);assert.equal(params.get('code'),'strong-secret');assert.equal(new URL(auth.url).origin,'https://app.plex.tv');
 assert.equal(calls.filter(c=>c.path.startsWith('/api')).length,0,'No Plex network work before linking');
 await page.getByRole('button',{name:'Test guest connection',exact:true}).click();
 await page.locator('[data-guest-result]').filter({hasText:'No guest authorization obtained.'}).waitFor();
 await page.getByRole('button',{name:'Sign in to Plex',exact:true}).click();
 await page.getByText('Choose a server and connect.').waitFor();
 assert.ok(calls.some(c=>c.path==='/api/v2/pins'&&c.search==='?strong=true'));
 assert.equal(calls.some(c=>c.path==='/link'),false);
 await page.getByRole('button',{name:'Connect server',exact:true}).click();
 await page.getByRole('button',{name:'Fixture <movie>'}).click();
 await page.getByText('Direct playback · browser decoder').waitFor();
 assert.equal(await page.locator('iframe').count(),0);
 assert.ok((await page.locator('video').getAttribute('src')).includes('fixture-server-token'));
 assert.ok(calls.some(c=>c.path==='/:/timeline'&&c.method==='POST'));
 assert.equal(calls.find(c=>c.path==='/identity').headers['x-plex-token'],'fixture-server-token');
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 await page.evaluate(()=>{HTMLMediaElement.prototype.canPlayType=()=>'';window.Hls=class{static isSupported(){return true}static Events={ERROR:'error'};on(){}loadSource(url){window.fixtureHlsUrl=url}attachMedia(){}destroy(){window.fixtureHlsDestroyed=(window.fixtureHlsDestroyed||0)+1}}});
 await page.getByRole('button',{name:'Retry as compatible stream',exact:true}).click();
 await page.getByText('Plex compatible stream · conversion depends on the server').waitFor();
 assert.ok(await page.evaluate(()=>new URL(window.fixtureHlsUrl).pathname.endsWith('/start.m3u8')));
 await page.locator('[data-quality]').selectOption('720');
 await page.waitForFunction(()=>window.fixtureHlsDestroyed>0);
 assert.ok(calls.some(c=>c.path==='/video/:/transcode/universal/stop'));

 await page.evaluate(()=>{window.state.currentUserId='public';EventBus.emit('user:changed');});
 assert.equal(await page.locator('video').getAttribute('src'),null,'Profile change releases media');
 await page.evaluate(()=>{document.querySelector('#app').innerHTML=PlexPlayer.markup();PlexPlayer.mount(document.querySelector('#app'),{mobile:true});});
 delayPin=true;
 await page.getByRole('button',{name:'Sign in to Plex',exact:true}).click();
 await page.getByRole('button',{name:'Cancel sign-in',exact:true}).waitFor();
 const before=calls.filter(c=>c.path==='/api/v2/resources').length;
 await page.getByRole('button',{name:'Cancel sign-in',exact:true}).click();
 if(releasePin)releasePin();
 await page.waitForTimeout(200);
 assert.equal(calls.filter(c=>c.path==='/api/v2/resources').length,before,'Cancelled linking cannot authorize a late response');
 await page.evaluate(()=>PlexPlayer.close(document.querySelector('#app')));
 console.log('Plex browser fixtures passed: lazy link, server-scoped credentials, direct playback selection, timeline, profile cleanup, cancelled authorization. Actual codec decoding and live Plex access require server testing.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
