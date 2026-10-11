(function(){
 const sessions=new WeakMap(),MAX=4*1024*1024;
 function mount(root){
  const owner=state.currentUserId,abort=new AbortController(),frame=root.querySelector('iframe'),pending=new Map();let alive=true,ready=false,inflight=0;
  const current=()=>alive&&owner===state.currentUserId;
  const assert=()=>{if(!current())throw new Error('The workspace changed.');};
  const status=text=>{if(current())root.querySelector('[data-code-status]').textContent=text;};
  const allowed=path=>{const normalized=SystemFS.normalizePath(path);if(normalized!=='/documents'&&!normalized.startsWith('/documents/'))throw new Error('Code OSS is scoped to your Documents workspace.');if(normalized.split('/').some(p=>p.startsWith('.')&&p!=='.vscode'))throw new Error('Protected location.');return normalized;};
  async function operation(m){
   assert();const path=allowed(m.path),record=await SystemFS.readFile(path);assert();
   if(m.op==='stat'){if(!record){const e=new Error('File not found');e.notFound=true;throw e;}return {type:record.isDirectory?2:1,ctime:record.lastModified||0,mtime:record.lastModified||0,size:record.size||0};}
   if(m.op==='list'){if(!record?.isDirectory)throw new Error('Folder not found.');return (await SystemFS.readDir(path)).filter(f=>{try{allowed(f.path);return true;}catch{return false;}}).map(f=>[f.name,f.isDirectory?2:1]);}
   if(m.op==='read'){if(!record||record.isDirectory){const e=new Error('File not found');e.notFound=true;throw e;}if(record.size>MAX)throw new Error('Editor files are limited to 4 MiB.');return new Blob([record.data]).arrayBuffer();}
   if(m.op==='mkdir'){await SystemFS.ensureDirectory(path);return true;}
   if(m.op==='write'){
    const bytes=m.value?.bytes;if(!(bytes instanceof Uint8Array)||bytes.byteLength>MAX)throw new Error('Invalid source file.');if(record&&(!m.value.overwrite||record.isDirectory))throw new Error('File already exists.');if(!record&&!m.value.create)throw new Error('File not found.');
    const result=await SecurityKernel.importFile({path,parent:SystemFS.getParentPath(path),name:SystemFS.getName(path),data:bytes,size:bytes.byteLength,type:'text/plain',source:'vscode-output',options:{documentPolicy:'source-text',metadata:{kind:'source-document'}}});assert();if(result.status!=='accepted')throw new Error('File quarantined. Review it in Security Center.');return true;
   }
   if(path==='/documents')throw new Error('The workspace root cannot be removed or renamed.');
   if(m.op==='delete'){if(!record)throw new Error('File not found.');if(record.isDirectory&&m.value?.recursive)await SystemFS.deleteFileRecursive(path);else{if(record.isDirectory&&(await SystemFS.readDir(path)).length)throw new Error('Folder is not empty.');assert();await SystemFS.deleteFile(path);}return true;}
   if(m.op==='rename'){
    const target=allowed(m.value?.target);if(!record||record.isDirectory)throw new Error('Rename files individually; folder rename is not yet supported.');const existing=await SystemFS.readFile(target);assert();if(existing?.isDirectory)throw new Error('Target is a folder.');if(existing&&!m.value.overwrite)throw new Error('Target exists.');await SystemFS.writeFile(target,SystemFS.getName(target),SystemFS.getParentPath(target),record.data,record.size,record.type,false,{metadata:record.metadata});assert();await SystemFS.deleteFile(path);return true;
   }
   throw new Error('Unsupported filesystem operation.');
  }
  window.addEventListener('message',async event=>{
   if(!current()||event.source!==frame.contentWindow||event.origin!=='null')return;const m=event.data;if(!m||typeof m!=='object')return;
   if(m.type==='code:fs'&&typeof m.id==='string'&&m.id.length<=64&&typeof m.path==='string'&&m.path.length<=2048){const mutating=['write','mkdir','delete','rename'].includes(m.op);if(mutating)inflight++;try{const value=await operation(m);assert();frame.contentWindow.postMessage({type:'code:fs-result',id:m.id,value},'*');}catch(error){if(current())frame.contentWindow.postMessage({type:'code:fs-result',id:m.id,error:error.message,notFound:!!error.notFound},'*');}finally{if(mutating)inflight--;}}
   else if(m.type==='code:ready'){ready=true;root.querySelector('[data-code-loading]').hidden=true;status('Documents workspace · Code OSS web');if(root.launchParams?.path)frame.contentWindow.postMessage({type:'code:open',path:allowed(root.launchParams.path)},'*');}
   else if(m.type==='code:failed'){status('Code OSS could not start: '+String(m.error||'Unknown error'));root.querySelector('[data-code-loading]').textContent='Editor unavailable. Close this window and retry.';}
   else if(m.type==='code:flushed'&&pending.has(m.id)){const r=pending.get(m.id);pending.delete(m.id);clearTimeout(r.timer);r.resolve(m.ok===true);}
  },{signal:abort.signal});
  root.addEventListener('launch-params',()=>{if(ready&&root.launchParams?.path)frame.contentWindow.postMessage({type:'code:open',path:allowed(root.launchParams.path)},'*');},{signal:abort.signal});
  sessions.set(root,{async beforeClose(){if(!ready)return inflight===0;const id=crypto.randomUUID();status('Saving documents…');const saved=await new Promise(resolve=>{const timer=setTimeout(()=>{pending.delete(id);resolve(false);},20000);pending.set(id,{resolve,timer});frame.contentWindow.postMessage({type:'code:flush',id},'*');});const until=Date.now()+2000;while(saved&&inflight&&Date.now()<until)await new Promise(r=>setTimeout(r,20));if(!saved||inflight){status('Save failed. Your editor remains open.');return false;}return true;},close(){alive=false;abort.abort();for(const r of pending.values()){clearTimeout(r.timer);r.resolve(false);}pending.clear();frame.remove();sessions.delete(root);}});
  frame.src='apps/vscode/runtime/index.php/index.html';
 }
 window.appRegistry.vscode={title:'Code OSS',icon:'apps/vscode/icon.png',windowClass:'vscode-window document-window',renderBody:()=>'<main class="code-host"><p data-code-status role="status">Loading Code OSS…</p><div data-code-loading>Loading Code OSS web workbench…</div><iframe title="Code OSS editor" sandbox="allow-scripts allow-downloads" referrerpolicy="no-referrer"></iframe></main>',onOpen:mount,beforeClose:root=>sessions.get(root)?.beforeClose(),onClose:root=>sessions.get(root)?.close()};
})();
