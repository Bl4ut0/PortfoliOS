/** Actual pinned ArtCraft launch and isolation checks; no Google credentials. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),s=http.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
 const php=spawn(process.env.PORTFOLIOS_PHP || 'php',['-S','127.0.0.1:'+port,'-t',root],{windowsHide:true,stdio:'ignore'});let browser;
 try{
  await new Promise(r=>setTimeout(r,800));browser=await chromium.launch({channel:'chrome',headless:true});
  const p=await browser.newPage({viewport:{width:1500,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[],requests=[];
  p.on('pageerror',e=>{errors.push(e.message);console.error('Engine page error:',e.message);});p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});p.on('request',r=>{if(r.url().includes('/runtime/'))requests.push(r.url());});
  const target=process.env.PORTFOLIOS_TEST_URL || 'http://127.0.0.1:'+port+'/',base=new URL(target).origin;
  await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await p.goto(target);await p.locator('[data-enter-view=desktop]').click();await p.locator('[data-session-public]').click();await p.waitForFunction(()=>document.body.dataset.startupStage==='workspace');
  assert.equal(requests.length,0,'No Craft engines during startup');
  const policy=await p.evaluate(async()=>{const svg='<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';const inputs=[{data:svg,source:'vectorcraft-output',policy:'passive-svg'},{data:svg,source:'device-import',policy:'passive-svg'},{data:svg.replace('</svg>','<script>alert(1)</script></svg>'),source:'vectorcraft-output',policy:'passive-svg'},{data:svg.replace('<rect','<image href="https://example.test/a"/><rect'),source:'vectorcraft-output',policy:'passive-svg'}];const out=[];for(const [i,item] of inputs.entries())out.push((await SecurityKernel.importFile({path:'/documents/policy-'+i+'.svg',name:'policy-'+i+'.svg',data:item.data,type:'image/svg+xml',source:item.source,options:{documentPolicy:item.policy}})).status);return out;});assert.deepEqual(policy,['accepted','quarantined','quarantined','quarantined'],'Passive SVG policy is limited to static VectorCraft documents');
  const apps=process.env.PORTFOLIOS_CRAFT_APPS?.split(',')||['photocraft','vectorcraft','designcraft','lightcraft','filmcraft','effectcraft'];await p.evaluate(apps=>setInstalledStoreAppIds(apps),apps);
  fs.mkdirSync(path.join(root,'.tmp/artcraft-review/screens'),{recursive:true});const results=[];
  for(const app of apps){
   errors.length=0;const started=Date.now();await p.evaluate(a=>openDesktopWindow(a),app);
   await p.locator('[data-craft-status]').filter({hasText:'Editor ready'}).waitFor({timeout:25000,state:'attached'});
   const readyMs=Date.now()-started;await p.waitForTimeout(600);const frame=p.frames().find(f=>f.url().includes('/'+app+'/runtime/'));
   assert(frame,'Missing engine frame '+app);const facts=await frame.evaluate(()=>({canvas:!!document.querySelector('canvas'),film:typeof window.filmcraft,light:typeof window.lightcraft,effect:typeof window.effectcraft,opaque:globalThis.origin==='null',parentBlocked:(()=>{try{return !parent.document;}catch{return true;}})()}));

   await p.screenshot({path:path.join(root,'.tmp/artcraft-review/screens',app+'.png'),timeout:8000}).catch(e=>errors.push('Screenshot: '+e.message.split('\n')[0]));
   results.push({app,readyMs,diagnosticsMs:Date.now()-started,status:await p.locator('[data-craft-status]').textContent(),facts,errors:[...errors]});
   console.log(JSON.stringify(results.at(-1)));
   assert.equal(facts.canvas,true,'Native engine canvas');assert(!errors.some(e=>!e.startsWith('Screenshot:')),errors.join('\n'));
   if(app==='photocraft'){
    const engine=p.locator('iframe[title="PhotoCraft editor"]');await engine.click({position:{x:500,y:100}});await p.keyboard.press('Control+o');await p.locator('.systemfs-dialog').waitFor();await p.locator('.systemfs-dialog [data-action=cancel]').first().click();await p.waitForTimeout(150);await engine.click({position:{x:500,y:100}});await p.keyboard.press('Control+o');
    const psd=Buffer.alloc(43);psd.write('8BPS');psd.writeUInt16BE(1,4);psd.writeUInt16BE(3,12);psd.writeUInt32BE(1,14);psd.writeUInt32BE(1,18);psd.writeUInt16BE(8,22);psd.writeUInt16BE(3,24);psd[40]=255;
    await p.locator('.systemfs-dialog [data-upload]').setInputFiles({name:'sample.psd',mimeType:'image/vnd.adobe.photoshop',buffer:psd});await p.locator('[data-craft-status]').filter({hasText:'Opened sample.psd'}).waitFor({state:'attached'});await p.waitForTimeout(500);await engine.click({position:{x:500,y:100}});await p.keyboard.press('Control+s');await p.locator('[data-craft-status]').filter({hasText:'Saved'}).waitFor({state:'attached'});
   }
   if(app==='lightcraft'){await frame.evaluate(async()=>{const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('lightcraft',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=database.transaction('files','readwrite');tx.objectStore('files').put(new Uint8Array([1,2,3]),'portfolios-checkpoint-fixture');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});});await p.waitForTimeout(1500);}
   if(['filmcraft','effectcraft'].includes(app)){await p.locator('iframe[title="'+(app==='filmcraft'?'FilmCraft':'EffectCraft')+' editor"]').click({position:{x:500,y:100},timeout:5000,force:true});}
   assert.equal(facts.opaque,true);assert.equal(facts.parentBlocked,true);
   assert.notEqual(await p.evaluate(a=>closeDesktopWindow(a),app),false,'Native editor should save and close');if(['filmcraft','effectcraft'].includes(app)){assert(await p.evaluate(async a=>(await SystemFS.readDir('/documents/'+(a==='filmcraft'?'FilmCraft':'EffectCraft'))).some(f=>f.size>0),app),'Native project snapshot persisted');}
   if(app==='lightcraft'){assert(await p.evaluate(()=>SystemFS.readFile('/documents/LightCraft/library-checkpoint.json')),'Library checkpoint exists');await p.evaluate(()=>openDesktopWindow('lightcraft'));await p.locator('[data-craft-status]').filter({hasText:'Editor ready'}).waitFor({timeout:25000,state:'attached'});const restored=p.frames().find(f=>f.url().includes('/lightcraft/runtime/'));assert.deepEqual(await restored.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('lightcraft',1);q.onsuccess=()=>r(q.result);});return new Promise(r=>{const q=db.transaction('files').objectStore('files').get('portfolios-checkpoint-fixture');q.onsuccess=()=>r(Array.from(q.result));});}),[1,2,3],'Library bytes restored into a new isolated frame');assert.notEqual(await p.evaluate(()=>closeDesktopWindow('lightcraft')),false);}
   if(app==='photocraft'){const saved=await p.evaluate(()=>SystemFS.readFile('/documents/PhotoCraft/sample.psd'));assert(saved&&saved.size>43,'Native PSD save replaces original with serialized editor project');await p.evaluate(()=>openDesktopWindow('photocraft',{path:'/documents/PhotoCraft/sample.psd'}));await p.locator('[data-craft-status]').filter({hasText:'Opened sample.psd'}).waitFor({state:'attached'});await p.waitForTimeout(500);const closeAgain=await p.evaluate(()=>closeDesktopWindow('photocraft'));if(closeAgain===false){console.log('Photo reopen guard',await p.locator('[data-craft-status]').textContent());await p.screenshot({path:path.join(root,'.tmp/artcraft-review/photo-reopen.png')});}assert.notEqual(closeAgain,false,'Saved PSD reopens and closes');}
  }
  fs.writeFileSync(path.join(root,'.tmp/artcraft-review/results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser?.close();php.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
