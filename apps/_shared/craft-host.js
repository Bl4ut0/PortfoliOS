/** Browser file/download hooks; runs only inside an opaque Craft engine frame. */
(() => {
  const origin=location.origin, app=location.pathname.match(/apps\/([a-z]+)\/runtime/)[1], LIMIT=64*1024*1024;
  const blobs=new Map(), pendingSaves=new Set();let pending=null, queuedFiles=null, internalDrop=false, activity=false, projectSaved=false, startup=false, revision=0;
  const send=(type,data={},transfer=[])=>parent.postMessage({type:'craft:'+type,...data},origin,transfer);
  const nativeURL=URL.createObjectURL.bind(URL), nativeRevoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=blob=>{const url=nativeURL(blob);if(blob instanceof Blob)blobs.set(url,blob);return url;};
  URL.revokeObjectURL=url=>{blobs.delete(url);nativeRevoke(url);};
  const nativeClick=HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click=function(){if(this.type!=='file')return nativeClick.call(this);if(queuedFiles){const files=queuedFiles;queuedFiles=null;const input=this;setTimeout(()=>{const transfer=new DataTransfer();for(const file of files)transfer.items.add(new File([file.bytes],file.name,{type:file.type||''}));input.files=transfer.files;input.dispatchEvent(new Event('change'));if(input.id==='rfd-input')document.querySelector('#rfd-overlay .rfd-button')?.click();send('opened',{name:files[0]?.name});},40);return;}if(pending)return;pending={input:this,id:crypto.randomUUID()};send('request-open',{id:pending.id,multiple:this.multiple});};
  // rfd's fixed overlay can be created without clicking its input when Open was
  // invoked programmatically. Supply the already-selected SystemFS file there.
  const pickerObserver=new MutationObserver(()=>{const input=document.querySelector('#rfd-overlay #rfd-input[type=file]');if(queuedFiles&&input)input.click();});
  pickerObserver.observe(document.documentElement,{childList:true,subtree:true});
  const extensions={photocraft:['.psd','.psb','.pcraft','.ora'],vectorcraft:['.svg','.vcraft'],designcraft:['.dcproj','.designcraft'],filmcraft:['.fcproj'],effectcraft:['.ecproj'],lightcraft:['.zip']};
  const anchorClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    const blob=blobs.get(this.href);if(!this.download || !blob)return anchorClick.call(this);
    const name=this.download,id=crypto.randomUUID();
    if(!blob.size || blob.size>LIMIT){send('failed-save',{error:'Output exceeds the 64 MiB workspace limit.'});return;}
    pendingSaves.add(id);
    blob.arrayBuffer().then(bytes=>send('save',{id,name,bytes,mime:blob.type},[bytes])).catch(error=>{pendingSaves.delete(id);savedProjects.delete(id);send('failed-save',{error:error.message});});
    this.dataset.craftSave=id;this.dataset.craftProject=String(extensions[app].some(ext=>name.toLowerCase().endsWith(ext)));
    savedProjects.set(id,{project:this.dataset.craftProject==='true',revision});
  };
  const savedProjects=new Map();
  // Opaque-origin workers use a Blob entry importing the public CORS-enabled worker module.
  const NativeWorker=globalThis.Worker;
  if(NativeWorker)globalThis.Worker=class extends NativeWorker{constructor(url,options={}){const absolute=new URL(url,location.href);if(absolute.origin===origin){const entry=nativeURL(new Blob(['import '+JSON.stringify(absolute.href)+';'],{type:'text/javascript'}));super(entry,{...options,type:'module'});setTimeout(()=>nativeRevoke(entry),10000);}else super(url,options);}};
  function keys(key){const target=document.querySelector('canvas')||document.body;window.focus();target.focus();const emit=(type,key,code,keyCode,ctrlKey)=>target.dispatchEvent(new KeyboardEvent(type,{key,code,keyCode,which:keyCode,ctrlKey,bubbles:true,cancelable:true}));emit('keydown','Control','ControlLeft',17,true);emit('keydown',key,'Key'+key.toUpperCase(),key.toUpperCase().charCodeAt(0),true);requestAnimationFrame(()=>{emit('keyup',key,'Key'+key.toUpperCase(),key.toUpperCase().charCodeAt(0),true);emit('keyup','Control','ControlLeft',17,false);});}

  function drop(files){const transfer=new DataTransfer();for(const file of files)transfer.items.add(new File([file.bytes],file.name,{type:file.type || ''}));internalDrop=true;try{(document.querySelector('canvas')||document.body).dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));}finally{internalDrop=false;}}
  addEventListener('dragover',event=>{if(!internalDrop)event.preventDefault();},true);
  addEventListener('drop',async event=>{if(internalDrop)return;event.preventDefault();event.stopImmediatePropagation();const file=event.dataTransfer?.files[0];if(!file || file.size>LIMIT)return;const bytes=await file.arrayBuffer();send('drop',{name:file.name,bytes,mime:file.type},[bytes]);},true);
  for(const type of ['pointerdown','keydown'])addEventListener(type,event=>{if(!event.isTrusted)return;activity=true;revision++;projectSaved=false;send('activity');},{capture:true,passive:true});
  addEventListener('message',async event=>{
    if(event.source!==parent || event.origin!==origin)return;const m=event.data;if(!m || typeof m!=='object')return;
    if(m.type==='craft:saved' && pendingSaves.has(m.id)){pendingSaves.delete(m.id);const snapshot=savedProjects.get(m.id);if(snapshot?.project && snapshot.revision===revision)projectSaved=true;savedProjects.delete(m.id);}
    else if(m.type==='craft:file-result' && Array.isArray(m.files)){
      activity=true;revision++;projectSaved=false;const files=m.files.filter(f=>typeof f.name==='string'&&f.bytes instanceof ArrayBuffer&&f.bytes.byteLength<=LIMIT).slice(0,16);
      if(pending && m.id===pending.id){const input=pending.input;pending=null;const transfer=new DataTransfer();for(const file of files)transfer.items.add(new File([file.bytes],file.name,{type:file.type||''}));input.files=transfer.files;input.dispatchEvent(new Event('change'));if(files.length)send('opened',{name:files[0].name});}
      else if(m.id==='launch' && files.length){if(['photocraft','vectorcraft','designcraft'].includes(app)){queuedFiles=files;keys('o');setTimeout(()=>{if(queuedFiles===files){send('focus-needed',{name:files[0].name});}},2000);}else if(app==='effectcraft'&&globalThis.effectcraft?.addFile){for(const file of files)globalThis.effectcraft.addFile(file.name,new Uint8Array(file.bytes));send('opened',{name:files[0].name});}else if(app==='filmcraft'&&globalThis.filmcraft?.openProject&&files[0].name.endsWith('.fcproj')){await globalThis.filmcraft.openProject(new File([files[0].bytes],files[0].name));send('opened',{name:files[0].name});}else{drop(files);send('opened',{name:files[0].name});}}
    }else if(m.type==='craft:flush' && typeof m.id==='string'){
      try{
        if(app==='lightcraft'){await new Promise(r=>setTimeout(r,1100));const deadline=Date.now()+8000;let stats;do{stats=JSON.parse(await window.lightcraft.command('web.stats','{}'));if(stats.saveError)throw new Error(stats.saveError);if(!stats.dirty&&!stats.flushing)break;await new Promise(r=>setTimeout(r,100));}while(Date.now()<deadline);if(stats.dirty||stats.flushing)throw new Error('LightCraft is still saving its library.');await window.lightLibraryFlush();send('result',{id:m.id,ok:true});return;}
        if(app==='photocraft'&&!queuedFiles&&!pending&&!pendingSaves.size&&dispatchEvent(new Event('beforeunload',{cancelable:true}))){send('result',{id:m.id,ok:true});return;}
        if(!activity && !pendingSaves.size){send('result',{id:m.id,ok:true});return;}
        if(!projectSaved){
          if(app==='effectcraft' && globalThis.effectcraft?.execute)await globalThis.effectcraft.execute('file.saveAs',{path:'/PortfoliOS.ecproj'});
          else if(app==='filmcraft' && globalThis.filmcraft?.execute)await globalThis.filmcraft.execute('file.saveAs',{path:'/PortfoliOS.fcproj'});
          else keys('s');
        }
        const until=Date.now()+12000;while(Date.now()<until && (!projectSaved || pendingSaves.size))await new Promise(resolve=>setTimeout(resolve,80));
        const guard=new Event('beforeunload',{cancelable:true});const clean=dispatchEvent(guard);
        send('result',{id:m.id,ok:projectSaved && !pendingSaves.size && clean,error:'Finish saving the project in '+app+' before switching. Exporting a flattened image does not preserve the editable project.'});
      }catch(error){send('result',{id:m.id,ok:false,error:error.message});}
    }
  });
  async function ready(){if(startup)return;startup=true;const deadline=Date.now()+30000;while(Date.now()<deadline){const canvas=document.querySelector('canvas'),ratio=devicePixelRatio||1;if(canvas&&canvas.clientWidth>0&&canvas.clientHeight>0&&Math.abs(canvas.width-canvas.clientWidth*ratio)<=2&&Math.abs(canvas.height-canvas.clientHeight*ratio)<=2){await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));send('ready');return;}await new Promise(r=>setTimeout(r,40));}send('failed');}
  for(const type of ['TrunkApplicationStarted','LightCraftStarted','FilmCraftStarted','EffectCraftStarted'])addEventListener(type,ready);
  addEventListener('error',()=>{if(!startup)send('failed');});addEventListener('unhandledrejection',()=>{if(!startup)send('failed');});
})();
