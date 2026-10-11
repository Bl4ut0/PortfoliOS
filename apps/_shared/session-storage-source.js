import * as storage from 'fake-indexeddb';
// A new database factory per opaque frame. Never connects to the OS origin database.
for (const name of ['indexedDB','IDBCursor','IDBCursorWithValue','IDBDatabase','IDBFactory','IDBIndex','IDBKeyRange','IDBObjectStore','IDBOpenDBRequest','IDBRequest','IDBTransaction','IDBVersionChangeEvent']) Object.defineProperty(globalThis,name,{value:storage[name],configurable:true});
function memoryStorage(){const values=new Map();return {get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(String(key))??null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key)),clear:()=>values.clear()};}
Object.defineProperty(globalThis,'localStorage',{value:memoryStorage(),configurable:true});Object.defineProperty(globalThis,'sessionStorage',{value:memoryStorage(),configurable:true});
Object.defineProperty(navigator,'hardwareConcurrency',{value:Math.min(navigator.hardwareConcurrency||2,2),configurable:true});
