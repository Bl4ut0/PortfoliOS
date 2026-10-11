/** Native SystemFS adapter for the six pinned ArtCraft browser-download engines. */
(function () {
  const sessions = new WeakMap(), LIMIT = 64 * 1024 * 1024;
  const safe = value => String(value || 'untitled').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 160) || 'untitled';
  window.registerCraftEditor = config => {
    function mount(root) {
      const owner = window.state.currentUserId, abort = new AbortController(), frame = root.querySelector('iframe');
      const paths = new Map(), failures = new Map(), requests = new Map();
      let alive = true, ready = false, busy = 0, writes = Promise.resolve(), timer, flushing = false, interacted = false, closeConfirmed = false;
      const current = () => alive && owner === window.state.currentUserId;
      const assert = () => { if (!current()) throw new Error('The workspace has changed.'); };
      const say = text => { if (current()) { root.querySelector('[data-craft-status]').textContent = text; root.querySelector('[data-craft-retry]').hidden = !failures.size; } };
      const send = (type, value = {}, transfer = []) => { assert(); frame.contentWindow.postMessage({type:'craft:' + type,...value}, '*', transfer); };
      async function inspect(record, source) {
        assert(); if (!record || record.isDirectory) throw new Error('Choose a file.');
        const bytes = await new Blob([record.data]).arrayBuffer(); assert();
        if (!bytes.byteLength || bytes.byteLength > LIMIT) throw new Error('Choose a file up to 64 MiB.');
        const result = await SecurityKernel.importFile({path:record.path,name:record.name,parent:record.parent,data:bytes,size:bytes.byteLength,type:record.type || 'application/octet-stream',source,options:{metadata:record.metadata || {},documentPolicy:config.id==='vectorcraft'?'passive-svg':undefined}});
        assert(); if (result.status !== 'accepted') throw new Error('File quarantined. Review it in Security Center.');
        return {name:safe(record.name),bytes,type:record.type || 'application/octet-stream'};
      }
      async function imported(file) {
        assert(); if (!file || file.size > LIMIT) throw new Error('Choose a file up to 64 MiB.');
        const folder='/documents/'+config.title, name=safe(file.name); await SystemFS.ensureDirectory(folder); assert();
        let path=folder+'/'+name;
        if (await SystemFS.readFile(path)) path=folder+'/'+crypto.randomUUID().slice(0,8)+'-'+name;
        assert(); const result=await SecurityKernel.importFile({path,parent:folder,name:SystemFS.getName(path),data:file,size:file.size,type:file.type,source:config.id+'-import',options:{documentPolicy:config.id==='vectorcraft'?'passive-svg':undefined}});
        assert(); if (result.status !== 'accepted') throw new Error('File quarantined. Review it in Security Center.');
        return result.record;
      }
      async function open(record, id) {
        const file=await inspect(record,config.id+'-open'); assert(); paths.set(file.name,record.path);
        send('file-result',{id,files:[file]},[file.bytes]); say('Opening '+file.name+'…'); interacted=true;closeConfirmed=false;
      }
      const action = callback => async (...args) => { busy++; try { await callback(...args); } catch(error) { say(error.message); } finally { busy--; } };
      async function picker(message) {
        try {
          const choice=await SystemFS.showOpenDialog({title:'Open in '+config.title,types:config.types,signal:abort.signal}); assert();
          if (choice) await open(choice.file ? await imported(choice.file) : await SystemFS.readFile(choice.path),message.id);
          else send('file-result',{id:message.id,files:[]});
        } catch(error) { if(current()) send('file-result',{id:message.id,files:[]}); throw error; }
      }
      async function save(message) {
        assert(); const name=safe(message.name); let path=message.targetPath || paths.get(name);
        if (!path && (flushing || message.autosave)) { const folder='/documents/'+config.title; await SystemFS.ensureDirectory(folder); assert(); path=folder+'/'+name; if(await SystemFS.readFile(path)) path=folder+'/'+crypto.randomUUID().slice(0,8)+'-'+name; }
        if (!path) { const choice=await SystemFS.showSaveDialog({title:'Save '+config.title+' file',defaultName:name,signal:abort.signal}); assert(); if (!choice) throw new Error('Save cancelled. Output retained; choose Retry save.'); path=choice.path; }
        message.targetPath=path; assert();
        const result=await SecurityKernel.importFile({path,name:SystemFS.getName(path),parent:SystemFS.getParentPath(path),data:message.bytes,size:message.bytes.byteLength,type:message.mime || 'application/octet-stream',source:config.id+'-output',options:{documentPolicy:config.id==='vectorcraft'?'passive-svg':undefined}}); assert();
        if(result.status!=='accepted') throw new Error('Output quarantined. Review it in Security Center.');
        paths.set(name,path); failures.delete(message.id); send('saved',{id:message.id}); say('Saved '+path);
      }
      function queue(message) { writes=writes.then(()=>save(message)).catch(error=>{if(current()){failures.set(message.id,message);say(error.message);}}); }
      function request(type) { const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{requests.delete(id);reject(new Error(config.title+' did not finish saving. Your workspace is still active.'));},20000);requests.set(id,{resolve,reject,timeout});send(type,{id});}); }
      window.addEventListener('message',event=>{
        if(!current() || event.source!==frame.contentWindow || event.origin!=='null') return;
        const m=event.data;if(!m || typeof m!=='object') return;
        if(config.id==='lightcraft' && ['craft:library-load','craft:library-save'].includes(m.type) && typeof m.id==='string' && m.id.length<=64){
          action(async()=>{try{let snapshot=null;const path='/documents/LightCraft/library-checkpoint.json';if(m.type==='craft:library-save'){const bytes=JSON.stringify(m.snapshot);if(bytes.length>64*1024*1024)throw new Error('Library checkpoint exceeds 64 MiB.');await SystemFS.ensureDirectory('/documents/LightCraft');assert();const result=await SecurityKernel.importFile({path,name:'library-checkpoint.json',parent:'/documents/LightCraft',data:bytes,size:new Blob([bytes]).size,type:'application/json',source:'lightcraft-library'});assert();if(result.status!=='accepted')throw new Error('Library checkpoint quarantined.');}else{const file=await SystemFS.readFile(path);assert();if(file){if(file.size>64*1024*1024)throw new Error('Library checkpoint too large.');snapshot=JSON.parse(await new Blob([file.data]).text());}}send('library-result',{id:m.id,snapshot});}catch(error){if(current())send('library-result',{id:m.id,error:error.message});throw error;}})();
        }
        else if(m.type==='craft:ready' && !ready){ready=true;clearTimeout(timer);root.querySelector('[data-craft-loading]').hidden=true;say('Editor ready');if(root.launchParams?.path) action(async()=>open(await SystemFS.readFile(root.launchParams.path),'launch'))();}
        else if(m.type==='craft:failed'){clearTimeout(timer);say('Editor failed to start. Close and reopen to retry.');root.querySelector('[data-craft-loading]').textContent='Editor failed to start. Close and reopen to retry.';}
        else if(m.type==='craft:request-open' && typeof m.id==='string' && m.id.length<=64){if(busy)send('file-result',{id:m.id,files:[]});else action(()=>picker(m))();}
        else if(m.type==='craft:activity'){interacted=true;closeConfirmed=false;}
        else if(m.type==='craft:opened'&&typeof m.name==='string')say('Opened '+safe(m.name));
        else if(m.type==='craft:focus-needed')say('Use Open in the editor to load '+safe(m.name)+'.');
        else if(m.type==='craft:failed-save') say('Editor export failed: '+String(m.error||'Unknown error'));
        else if(m.type==='craft:save' && typeof m.id==='string' && m.id.length<=64 && typeof m.name==='string' && m.name.length<=512 && m.bytes instanceof ArrayBuffer && m.bytes.byteLength>0 && m.bytes.byteLength<=LIMIT) queue({id:m.id,name:m.name,bytes:m.bytes,mime:typeof m.mime==='string'?m.mime:'',autosave:flushing});
        else if(m.type==='craft:drop' && typeof m.name==='string' && m.name.length<=512 && m.bytes instanceof ArrayBuffer && m.bytes.byteLength<=LIMIT && !busy) action(async()=>open(await imported(new File([m.bytes],m.name,{type:m.mime || ''})),'launch'))();
        else if(m.type==='craft:result' && typeof m.id==='string' && requests.has(m.id)){const r=requests.get(m.id);clearTimeout(r.timeout);requests.delete(m.id);r.resolve(m);}
      },{signal:abort.signal});
      root.querySelector('[data-craft-retry]').addEventListener('click',()=>{for(const m of failures.values())queue(m);},{signal:abort.signal});
      root.addEventListener('launch-params',action(async()=>{if(ready&&root.launchParams?.path)await open(await SystemFS.readFile(root.launchParams.path),'launch');}),{signal:abort.signal});
      sessions.set(root,{
        async beforeClose(){
          if(busy){say('Finish or cancel the file dialog first.');return false;}
          await writes;if(failures.size){say('Retry the retained output before closing.');return false;}
          if(!ready)return true;
          flushing=true;try{const result=await request('flush');await writes;if(!result.ok || failures.size){say(result.error || 'Save your project before closing or switching profiles.');return false;}if(['vectorcraft','designcraft'].includes(config.id)&&interacted&&!closeConfirmed){closeConfirmed=await new Promise(resolve=>{const panel=document.createElement('div');panel.className='craft-close-confirm';panel.innerHTML='<p>The active document has been saved. Save any other open documents before closing this editor.</p><button type="button" data-keep>Keep editing</button><button type="button" data-close>All documents saved — close</button>';root.querySelector('.craft-host').append(panel);panel.querySelector('[data-keep]').onclick=()=>{panel.remove();resolve(false);};panel.querySelector('[data-close]').onclick=()=>{panel.remove();resolve(true);};});return closeConfirmed;}return true;}catch(error){say(error.message);return false;}finally{flushing=false;}
        },
        close(){alive=false;clearTimeout(timer);abort.abort();for(const r of requests.values()){clearTimeout(r.timeout);r.reject(new Error('Editor closed.'));}requests.clear();frame.remove();sessions.delete(root);}
      });
      timer=setTimeout(()=>{if(!ready){frame.removeAttribute('src');say('Startup timed out. Close and reopen to retry.');root.querySelector('[data-craft-loading]').textContent='Startup timed out. Close and reopen to retry.';}},90000);
      frame.src='apps/'+config.id+'/runtime/index.php/host.html?host=parent&fresh=1'+(config.id==='lightcraft'?'&store=idb&workers=0':config.id==='effectcraft'?'&empty&home&frameworkers=1&webgl':'');
    }
    window.appRegistry[config.id]={title:config.title,icon:config.icon,windowClass:config.id+'-window document-window',renderBody:()=>`<main class="craft-host"><p data-craft-status role="status">Loading ${config.title}â€¦</p><div data-craft-loading>Loading ${config.title}â€¦</div><button type="button" data-craft-retry hidden>Retry save</button><iframe title="${config.title} editor" sandbox="allow-scripts allow-downloads" referrerpolicy="no-referrer"></iframe></main>`,onOpen:mount,beforeClose:root=>sessions.get(root)?.beforeClose(),onClose:root=>sessions.get(root)?.close()};
  };
})();
