/** Profile-owned LightCraft files-store checkpoints; no OS-origin database access. */
(() => {
 const origin=location.origin,MAX=48*1024*1024,pending=new Map();let db,restoring=true,timer,dirty=false,serial=Promise.resolve(),lastCheckpoint=0;const watched=new WeakSet();
 const request=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('lightcraft',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const rpc=(type,data={})=>new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timeout=setTimeout(()=>{pending.delete(id);reject(new Error('LightCraft library checkpoint timed out.'));},20000);pending.set(id,{resolve,reject,timeout});parent.postMessage({type:'craft:library-'+type,id,...data},origin);});
 addEventListener('message',event=>{if(event.source!==parent||event.origin!==origin)return;const m=event.data;if(m?.type==='craft:library-result'&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timeout);m.error?p.reject(new Error(m.error)):p.resolve(m.snapshot);}});
 function decode(text){const raw=atob(text),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}
 function encode(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
 async function snapshot(){
  const rows=await new Promise((resolve,reject)=>{const rows=[],tx=db.transaction('files','readonly'),cursor=tx.objectStore('files').openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){rows.push([String(c.key),c.value]);c.continue();}};tx.oncomplete=()=>resolve(rows);tx.onerror=()=>reject(tx.error);});
  let total=0;const files=[];for(const [key,value] of rows){const bytes=value instanceof Blob?new Uint8Array(await value.arrayBuffer()):value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;if(!bytes)throw new Error('Unsupported LightCraft library value.');total+=bytes.length;if(total>MAX)throw new Error('LightCraft library exceeds the 48 MiB checkpoint limit. Export a backup before closing.');files.push({key,data:encode(bytes)});}
  const settings=Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{const key=localStorage.key(i);return [key,localStorage.getItem(key)];}));
  return {version:1,files,settings};
 }
 async function save(){if(!dirty)return;const revision=changes;const data=await snapshot();await rpc('save',{snapshot:data});lastCheckpoint=Date.now();if(revision===changes)dirty=false;}
 let changes=0;const nativePut=IDBObjectStore.prototype.put,nativeDelete=IDBObjectStore.prototype.delete,nativeClear=IDBObjectStore.prototype.clear;
 function changed(store){if(restoring||store.name!=='files'||store.transaction.db.name!=='lightcraft'||watched.has(store.transaction))return;watched.add(store.transaction);store.transaction.addEventListener('complete',()=>{dirty=true;changes++;clearTimeout(timer);timer=setTimeout(()=>{serial=serial.then(save).catch(error=>parent.postMessage({type:'craft:failed-save',error:error.message},origin));},Math.max(2000,30000-(Date.now()-lastCheckpoint)));},{once:true});}
 for(const [name,native] of [['put',nativePut],['delete',nativeDelete],['clear',nativeClear]])IDBObjectStore.prototype[name]=function(...args){changed(this);return native.apply(this,args);};
 window.lightLibraryFlush=async()=>{clearTimeout(timer);await serial;await save();};
 window.craftStorageReady=(async()=>{
  const data=await rpc('load');db=await request();
  if(data){if(data.version!==1||!Array.isArray(data.files)||data.files.length>20000)throw new Error('Invalid LightCraft checkpoint.');let size=0;const entries=data.files.map(f=>{if(typeof f.key!=='string'||f.key.length>2048||typeof f.data!=='string')throw new Error('Invalid library entry.');const bytes=decode(f.data);size+=bytes.length;if(size>MAX)throw new Error('Library checkpoint too large.');return [f.key,bytes];});await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite'),store=tx.objectStore('files');for(const [key,value] of entries)store.put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});for(const [key,value] of Object.entries(data.settings||{}))if(typeof value==='string')localStorage.setItem(key,value);}
  restoring=false;
 })();
})();
