/** Cross-device handoff and recovery through real Desktop/Mobile adapters. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
const root=path.resolve(__dirname,'..'),mime={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://test').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)||name.split('/').some(p=>p.startsWith('.')))return res.writeHead(403).end();fs.readFile(file,(e,data)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const remote=new Map(),mutations=[],uploads=new Map(),pageErrors=[];let serial=0,active=null,pending=null,generation=0,failWrites=false;
 const profile={sub:'handoffA',email:'handoff@example.test',name:'Handoff Test',source:'google'},owner='private_handoffA';
 const target=process.env.PORTFOLIOS_TEST_URL || 'http://127.0.0.1:'+server.address().port+'/',origin=new URL(target).origin;
 function reply(route,status,body){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});}
 function view(id){return {owned:active?.id===id,epoch:active?.id===id?active.epoch:null,occupied:!!active,handoffRequested:active?.id===id && !!pending,waiting:pending===id,expires:Date.now()/1000+180};}
 function mutate(method,url,body,type){
  const id=/\/files\/([^?]+)/.exec(url)?.[1];
  if(method==='DELETE'){remote.delete(id);return {};}
  if(method==='PATCH'){const f=remote.get(id);if(!f)throw Error('Unknown update '+id);f.data=body;f.version=String(Number(f.version || 0)+1);f.modifiedTime=new Date().toISOString();return {id,version:f.version};}
  let metadata,data='';
  if(type.startsWith('multipart/related')){
   const boundary=type.split('boundary=')[1];const parts=body.split('--'+boundary);
   metadata=JSON.parse(parts[1].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/,''));
   data=parts[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/,'');
  }else metadata=JSON.parse(body);
  const key='file'+(++serial);remote.set(key,{...metadata,id:key,mimeType:metadata.mimeType || 'application/octet-stream',modifiedTime:new Date().toISOString(),version:'1',data});return {id:key,version:'1'};
 }
 async function routeContext(context){
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),headers=req.headers();
   if(url.origin===origin && url.pathname==='/core/private-session.php'){
    const id=headers['x-portfolios-session'],epoch=Number(headers['x-portfolios-epoch']),action=url.searchParams.get('action');
    if(action==='drive'){
     if(active?.id!==id || active?.epoch!==epoch)return reply(route,409,{error:'Lease lost'});
     if(failWrites)return reply(route,403,{error:'Injected Drive failure'});
     const driveUrl=new URL(headers['x-drive-path'],'https://www.googleapis.com');
     if(driveUrl.searchParams.get('uploadType')==='resumable'){
      if(headers['x-drive-method']!=='PUT'){
       const key='upload_fixture_'+(++serial);uploads.set(key,{id:/\/files\/([^?]+)/.exec(driveUrl.pathname)?.[1],metadata:JSON.parse(req.postData()),parts:[]});
       return route.fulfill({status:200,headers:{'X-Drive-Upload-Location':'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id='+key},body:''});
      }
      const upload=uploads.get(driveUrl.searchParams.get('upload_id')),range=/bytes (\d+)-(\d+)\/(\d+)/.exec(headers['content-range']);
      const chunk=req.postDataBuffer();assert(chunk.length<=4*1024*1024,'Chunks stay within PHP request limits');upload.parts.push(chunk);
      if(Number(range[2])+1<Number(range[3]))return route.fulfill({status:308,body:''});
      const data=Buffer.concat(upload.parts).toString();let result;
      if(upload.id)result=mutate('PATCH','/drive/v3/files/'+upload.id,data,headers['content-type']);
      else {const key='file'+(++serial);remote.set(key,{...upload.metadata,id:key,mimeType:headers['content-type'],modifiedTime:new Date().toISOString(),version:'1',data});result={id:key,version:'1'};}
      uploads.delete(driveUrl.searchParams.get('upload_id'));mutations.push({id,epoch,path:headers['x-drive-path']});return reply(route,200,result);
     }
     const result=mutate(headers['x-drive-method'],headers['x-drive-path'],req.postData() || '',headers['content-type']);
     mutations.push({id,epoch,path:headers['x-drive-path']});return reply(route,200,result);
    }
    if(action==='claim' && !active){active={id,epoch:++generation};}
    if(action==='force'){active={id,epoch:++generation};pending=null;}
    if(action==='request' && active?.id!==id)pending=id;
    if(action==='cancel' && pending===id)pending=null;
    if(action==='release'){
     if(pending && JSON.parse(req.postData() || '{}').synced!==true)return reply(route,409,{error:'Finish saving before handoff'});
     if(active?.id!==id || active?.epoch!==epoch)return reply(route,409,{error:'Lease lost'});
     active=pending?{id:pending,epoch:++generation}:null;pending=null;
    }
    return reply(route,200,view(id));
   }
   if(url.hostname==='openidconnect.googleapis.com')return reply(route,200,profile);
   if(url.hostname==='www.googleapis.com'){
    assert.equal(req.method(),'GET','All Drive mutations use fenced gateway');
    if(url.pathname==='/drive/v3/files'){
     const q=url.searchParams.get('q') || '',parentMatch=/'([^']+)' in parents/.exec(q),name=/name = '([^']+)'/.exec(q);
     const files=[...remote.values()].filter(f=>(!parentMatch || f.parents?.includes(parentMatch[1])) && (!name || f.name===name[1]));
     return reply(route,200,{files:files.map(({data,...rest})=>rest)});
    }
    const id=url.pathname.split('/').pop(),f=remote.get(id);if(!f)return reply(route,404,{error:'missing'});
    return route.fulfill({status:200,contentType:f.mimeType,body:f.data});
   }
   return url.origin===origin?route.continue():route.abort();
  });
  await context.addInitScript(({owner,profile})=>localStorage.setItem('bl4ut0_private_profiles',JSON.stringify({[owner]:profile})),{owner,profile});
 }
 async function prepare(viewName='desktop'){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});await routeContext(context);
  const p=await context.newPage();p.on('pageerror',error=>pageErrors.push(error.message));await p.goto(target);await p.locator('[data-enter-view='+viewName+']').click();await p.locator('[data-session-profile="'+owner+'"]').waitFor();
  await p.evaluate(({owner,profile})=>{GDriveSync.scheduleAutomaticSync=()=>{};window.triggerGDriveSync=()=>{};GDriveSync.accountSessions[owner]={token:'fixture-token-not-a-real-credential',expiresAt:Date.now()+3600000,profile};},{owner,profile});
  return {p,context};
 }
 async function selected(p){await p.locator('[data-session-profile="'+owner+'"]').click();}
 async function ready(p){await p.waitForFunction(()=>state.sessionChosen && document.body.dataset.startupStage==='workspace' && PrivateSessions.owned);}
 async function write(p,text){await p.evaluate(async text=>{clearTimeout(GDriveSync.pendingSyncTimer);await SystemFS.writeFile('/documents/handoff.txt','handoff.txt','/documents',text,text.length,'text/plain',false);clearTimeout(GDriveSync.pendingSyncTimer);},text);}
 async function read(p,path='/documents/handoff.txt'){return p.evaluate(async path=>readFilesystemRecordText(await SystemFS.readFile(path)),path);}
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const a=await prepare();failWrites=true;await selected(a.p);
  await a.p.locator('[data-session-error]:not([hidden])').waitFor();assert.equal(await a.p.evaluate(()=>state.sessionChosen),false);
  await selected(a.p);await a.p.locator('[data-session-error]:not([hidden])').waitFor();assert.equal(await a.p.evaluate(()=>PrivateSessions.ready),false,'Failed restore retries cannot bypass reconciliation');
  failWrites=false;await selected(a.p);await ready(a.p);const aid=await a.p.evaluate(()=>PrivateSessions.id);
  await a.p.reload();await a.p.locator('[data-enter-view=desktop]').click();await a.p.locator('[data-session-profile="'+owner+'"]').waitFor();
  await a.p.evaluate(({owner,profile})=>{GDriveSync.scheduleAutomaticSync=()=>{};window.triggerGDriveSync=()=>{};GDriveSync.accountSessions[owner]={token:'fixture-token-not-a-real-credential',expiresAt:Date.now()+3600000,profile};},{owner,profile});
  await selected(a.p);await ready(a.p);assert.equal(await a.p.evaluate(()=>PrivateSessions.id),aid,'Reload retains unique tab identity without force takeover');
  const clone=await a.context.newPage();await clone.addInitScript(id=>sessionStorage.setItem('portfolios:session-id',id),aid);await clone.goto(target);await clone.locator('[data-enter-view=desktop]').click();await clone.locator('[data-session-profile="'+owner+'"]').waitFor();
  await clone.evaluate(({owner,profile})=>{GDriveSync.accountSessions[owner]={token:'fixture-token-not-a-real-credential',expiresAt:Date.now()+3600000,profile};},{owner,profile});
  await selected(clone);await clone.getByRole('button',{name:'Save other session & take over',exact:true}).waitFor();assert.notEqual(await clone.evaluate(()=>PrivateSessions.id),aid,'Cloned sessionStorage cannot duplicate tab ownership');
  await clone.getByRole('button',{name:'Cancel',exact:true}).click();await clone.close();
  assert(remote.size>0,'First workspace backed up before entry');
  await a.p.evaluate(async()=>{const data='large recovery fixture '.repeat(220000);await SystemFS.writeFile('/documents/large.txt','large.txt','/documents',data,data.length,'text/plain');clearTimeout(GDriveSync.pendingSyncTimer);await GDriveSync.sync();});
  const large=[...remote.values()].find(file=>file.appProperties?.path==='/documents/large.txt');assert(large.data.length>4*1024*1024,'Large file uses resumable gateway chunks');
  await a.p.evaluate(async()=>{await SystemFS.deleteFile('/documents/large.txt');clearTimeout(GDriveSync.pendingSyncTimer);await GDriveSync.sync();});
  await write(a.p,'first confirmed version');await a.p.evaluate(()=>GDriveSync.sync());
  await a.p.evaluate(async()=>{const tx=SystemFS.db.transaction(['files'],'readwrite');tx.objectStore('files').delete(SystemFS.storagePath('/documents/handoff.txt'));await SystemFS.transactionDone(tx);await GDriveSync.sync();});
  assert.equal(await read(a.p),'first confirmed version','Missing local data without an explicit deletion is restored, never propagated');
  const b=await prepare('mobile');await selected(b.p);
  await b.p.getByRole('button',{name:'Save other session & take over',exact:true}).waitFor();
  assert.equal(await b.p.evaluate(()=>state.sessionChosen),false,'Second workspace cannot mount before handoff');
  await b.p.getByRole('button',{name:'Save other session & take over',exact:true}).click();
  await write(a.p,'saved during handoff');
  await a.p.evaluate(()=>PrivateSessions.tick());await ready(b.p);
  assert.equal(await read(b.p),'saved during handoff','New device sees flushed owner changes');
  assert.equal(await a.p.evaluate(()=>PrivateSessions.owned),false);
  await a.p.getByRole('button',{name:'Choose account',exact:true}).waitFor();
  const bid=await b.p.evaluate(()=>PrivateSessions.id);assert.equal(active.id,bid);
  // Old generation cannot mutate Drive, even with an otherwise valid Google credential.
  assert.equal(await a.p.evaluate(async()=>{const response=await fetch('/core/private-session.php?action=drive',{method:'POST',headers:{'X-PortfoliOS-Session':PrivateSessions.id,'X-PortfoliOS-Epoch':String(PrivateSessions.epoch),'X-Drive-Method':'DELETE','X-Drive-Path':'/drive/v3/files/file1'}});return response.status;}),409);
  await write(b.p,'new active version');await b.p.evaluate(()=>GDriveSync.sync());
  // Offline former device retains its own divergent work and requests the workspace again.
  await write(a.p,'old offline edits');await a.p.getByRole('button',{name:'Choose account',exact:true}).click();await selected(a.p);
  await a.p.getByRole('button',{name:'Save other session & take over',exact:true}).click();
  failWrites=true;await write(b.p,'new active dirty version');await b.p.evaluate(()=>PrivateSessions.tick());
  await b.p.getByRole('button',{name:'Retry save and handoff',exact:true}).waitFor();
  assert.equal(active.id,bid,'Failed save does not release owner');assert.equal(await a.p.evaluate(()=>state.sessionChosen),false);
  failWrites=false;await b.p.getByRole('button',{name:'Retry save and handoff',exact:true}).click();await ready(a.p);
  assert.equal(await read(a.p),'new active dirty version','Canonical current version retained');
  const recovered=await a.p.evaluate(async()=>(await SystemFS.getAllFiles()).filter(f=>f.path.startsWith('/Recovered Sessions/') && f.metadata?.originalPath==='/documents/handoff.txt').map(f=>({path:f.path,data:f.data instanceof Blob?null:f.data})));
  assert(recovered.length,'Divergent former-session file preserved locally');
  assert.equal(await read(a.p,recovered[0].path),'old offline edits');
  await a.p.evaluate(()=>WorkspaceRecovery.openReview());
  await a.p.getByRole('button',{name:'Local copy: /documents/handoff.txt',exact:true}).click();
  await a.p.getByRole('textbox',{name:'File name',exact:true}).fill('recovered-handoff.txt');
  await a.p.getByRole('button',{name:'Save',exact:true}).click();
  await a.p.waitForFunction(()=>!document.querySelector('dialog[aria-label="Restore recovery copy"]'));
  assert.equal(await read(a.p,'/documents/recovered-handoff.txt'),'old offline edits','Native Save As restores a chosen recovery copy');
  await a.p.getByRole('button',{name:'Load Drive recovery history',exact:true}).click();
  await a.p.getByRole('button',{name:/^Drive snapshot:/}).first().click();
  await a.p.getByRole('button',{name:'Restore /documents/handoff.txt',exact:true}).click();
  await a.p.getByRole('textbox',{name:'File name',exact:true}).fill('cloud-recovered.txt');
  await a.p.getByRole('button',{name:'Save',exact:true}).click();
  await a.p.waitForFunction(()=>!document.querySelector('dialog[aria-label="Restore recovery copy"]'));
  assert.equal(await read(a.p,'/documents/cloud-recovered.txt'),'old offline edits','Drive delta restores through hash-checked native Save As');
  await a.p.locator('dialog[aria-label="Session recovery"] [data-close]').first().click();
  const snapshots=[...remote.values()].filter(f=>f.name==='snapshot.json');
  assert(snapshots.some(f=>JSON.parse(f.data).files.some(entry=>entry.path==='/documents/handoff.txt')),'Immutable Drive snapshot contains recoverable file references');
  // Explicit delete after a confirmed baseline propagates with a tombstone.
  await a.p.evaluate(async()=>{await SystemFS.deleteFile('/documents/handoff.txt');clearTimeout(GDriveSync.pendingSyncTimer);await GDriveSync.sync();});
  const checkpoint=[...remote.values()].find(f=>f.appProperties?.path==='/.portfolios-sync-state.json');
  assert.equal(JSON.parse(checkpoint.data).files['/documents/handoff.txt'].deleted,true);
  // Force takeover from an unavailable owner; warning requires a separate explicit click.
  await b.p.getByRole('button',{name:'Choose account',exact:true}).click();await selected(b.p);
  await b.p.getByRole('button',{name:'Other device unavailable…',exact:true}).click();
  await b.p.getByRole('button',{name:'Force takeover and preserve recovery',exact:true}).click();await ready(b.p);
  assert.equal(await b.p.evaluate(()=>SystemFS.readFile('/documents/handoff.txt')),null,'Unchanged stale copy follows explicit cloud deletion');
  await a.p.evaluate(()=>PrivateSessions.tick());assert.equal(await a.p.evaluate(()=>PrivateSessions.owned),false);
  // Different profiles never inherit this account lease; public remains unrestricted.
  await b.p.evaluate(()=>switchToPublicProfile({saveToDrive:false}));assert.equal(await b.p.evaluate(()=>state.currentUserId),'bl4ut0');assert.equal(active,null);
  assert(mutations.some(m=>m.id===aid) && mutations.some(m=>m.id===bid),'Both independent devices exercised fenced writes');
  assert.deepEqual(pageErrors,[],'No unhandled frontend errors');
  console.log('PASS: two isolated devices, Desktop/Mobile entry gate, confirmed handoff, stale writer rejection, failed-save blocking/retry, conflicting offline recovery, immutable snapshots, deletion tombstones, explicit forced takeover and public release.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
