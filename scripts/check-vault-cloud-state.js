/** Real recovery algorithm: opaque vault conflicts and partial startup checkpoints. Synthetic content only. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const crypto=require('node:crypto').webcrypto;
const owner='private_cloud_fixture',vaultPath='/documents/vault.enc',ledgerPath='/.portfolios-sync-state.json';
const baseKey='portfolios:recovery-base:'+owner,storage=new Map(),local=new Map(),remote=new Map(),mutations=[];
const hash=async text=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))};
const SystemFS={getAllFiles:async()=>[...local.values()],readFile:async path=>local.get(path)||null,normalizePath:path=>path};
const SecurityKernel={scanExisting:async record=>({status:'accepted',record}),importFile:async input=>{const record={...input,revision:'restored-fixture'};local.set(input.path,record);mutations.push({kind:'local',path:input.path});return{status:'accepted',record};}};
const PrivateSessions={assert:async()=>{},id:'fixture-tab',epoch:1};
const window={state:{currentUserId:owner},EventBus:{on(){},emit(){}},SystemFS,SecurityKernel,PrivateSessions,Storage:{local:{set:localStorage.setItem}}};
vm.runInNewContext(fs.readFileSync('core/workspace-recovery.js','utf8'),{window,localStorage,SystemFS,SecurityKernel,PrivateSessions,Blob,crypto,Date});
const recovery=window.WorkspaceRecovery;
const sync={getCurrentSyncScope:()=>({userId:owner}),getScopedStorageKey:key=>'fixture:'+key,
 fetchRemoteFiles:async()=>[...remote.values()].map(({data,...record})=>record),
 downloadFile:async id=>new Blob([remote.get(id).data],{type:'application/json'}),
 updateFile:async(id,type,data)=>{mutations.push({kind:'remote',path:remote.get(id).appProperties.path});remote.get(id).data=await data.text();return{version:'updated'};},
 uploadFile:async()=>{throw new Error('Unexpected new upload');}
};
(async()=>{
 const original='{"ciphertext":"original-encrypted-vault"}',localEdit='{"ciphertext":"offline-local-encrypted-vault"}',cloudEdit='{"ciphertext":"other-device-encrypted-vault"}';
 const baseHash=await hash(original),cloudHash=await hash(cloudEdit);
 storage.set(baseKey,JSON.stringify({files:{[vaultPath]:{hash:baseHash,localRevision:'old-revision'}}}));storage.set('fixture:last_sync_time','previous-full-sync');
 local.set(vaultPath,{path:vaultPath,name:'vault.enc',parent:'/documents',data:localEdit,type:'application/json',revision:'offline-edit'});
 remote.set('vault',{id:'vault',name:'vault.enc',version:'2',appProperties:{path:vaultPath},mimeType:'application/json',data:cloudEdit});
 remote.set('ledger',{id:'ledger',appProperties:{path:ledgerPath},data:JSON.stringify({schema:1,files:{[vaultPath]:{hash:cloudHash,remoteVersion:'2'}}})});
 await recovery.sync(sync,null,{paths:['/Desktop/desktop-layout.json']});
 assert.equal(JSON.parse(storage.get(baseKey)).files[vaultPath].hash,baseHash,'A startup pass must not claim an unprocessed vault was restored');
 assert.equal(storage.get('fixture:last_sync_time'),'previous-full-sync','Partial startup restore is not a completed full backup');
 const checkpoint=storage.get(baseKey),ledger=remote.get('ledger').data;mutations.length=0;
 await assert.rejects(recovery.sync(sync),/Encrypted vault versions conflict/);
 assert.equal(local.get(vaultPath).data,localEdit);assert.equal(remote.get('vault').data,cloudEdit);
 assert.equal(storage.get(baseKey),checkpoint);assert.equal(remote.get('ledger').data,ledger);assert.equal(mutations.length,0,'Conflicting encrypted versions must not be overwritten or marked successful');
 // An unchanged local copy may safely restore the newer cloud envelope.
 local.get(vaultPath).data=original;local.get(vaultPath).revision='old-revision';
 await recovery.sync(sync);
 assert.equal(await local.get(vaultPath).data.text(),cloudEdit);assert.equal(JSON.parse(storage.get(baseKey)).files[vaultPath].hash,cloudHash);
 assert.notEqual(storage.get('fixture:last_sync_time'),'previous-full-sync');
 // A remote deletion also cannot silently discard a locally edited encrypted vault.
 local.set(vaultPath,{path:vaultPath,name:'vault.enc',parent:'/documents',data:localEdit,type:'application/json',revision:'another-offline-edit'});remote.delete('vault');
 remote.get('ledger').data=JSON.stringify({schema:1,files:{[vaultPath]:{hash:null,deleted:true}}});mutations.length=0;
 await assert.rejects(recovery.sync(sync),/Encrypted vault versions conflict/);assert.equal(local.get(vaultPath).data,localEdit);assert.equal(mutations.length,0);
 console.log('PASS: partial restore preserves prior vault baseline and full-sync timestamp; divergent encrypted copies/deletion conflicts retain both states; unchanged local vault restores the newer cloud envelope.');
})().catch(error=>{console.error(error);process.exitCode=1;});
