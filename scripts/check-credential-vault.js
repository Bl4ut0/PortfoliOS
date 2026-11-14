/** Encrypted persistence, multi-account bindings and revocable consumer access; synthetic secrets only. */
'use strict';
const assert=require('node:assert/strict');
require('../core/credential-vault.js');
const Vault=global.CredentialVault,password='Synthetic fixture master passphrase 58!';
let activeProfile='private_A',serial=0;
const stores=new Map();
function host(profileId='private_A'){
 return {profileId,isCurrent:()=>activeProfile===profileId,
  readRecord:async()=>stores.get(profileId)||null,
  writeRecord:async(text,expected)=>{const prior=stores.get(profileId);if(expected?prior?.revision!==expected.revision:!!prior)throw new Error('Concurrent vault change');const row={text,revision:++serial};stores.set(profileId,row);return row;},
  deleteRecord:async expected=>{if(stores.get(profileId)?.revision!==expected.revision)throw new Error('Concurrent vault change');stores.delete(profileId);}
 };
}
const secret=id=>({accessToken:'fixture-only-access-'+id,refreshToken:'fixture-only-refresh-'+id});
(async()=>{
 assert.throws(()=>Vault.create({...host(),profileId:'bl4ut0'}),/private/);
 const vault=Vault.create(host());assert.equal(vault.isUnlocked,false);
 await assert.rejects(vault.save({provider:'openai',accountId:'A',secret:secret(1)}),/locked/);
 await vault.initialize(password);assert.equal(vault.isUnlocked,true);
 await assert.rejects(vault.initialize(password),/already exists/);
 const first=await vault.save({provider:'openai',accountId:'account-A',label:'First account',secret:secret(1),consumers:['cli.codex','app.codex']});
 const cli=vault.acquire('cli.codex'),app=vault.acquire('app.codex');assert.equal(cli.read().accessToken,secret(1).accessToken);
 cli.release();assert.equal(app.read().accessToken,secret(1).accessToken,'Releasing one consumer does not revoke another');
 const firstEnvelope=stores.get('private_A').text;assert(!firstEnvelope.includes('fixture-only-'));assert(!JSON.stringify(vault.list()).includes('fixture-only-'));
 vault.lock();assert.throws(()=>app.read(),/locked/);assert.throws(()=>vault.acquire('cli.codex'),/locked/);
 const fresh=Vault.create(host());assert.equal((await fresh.status()).isLocked,true);
 await assert.rejects(fresh.unlock('Wrong fixture password'),/Incorrect/);await fresh.unlock(password);
 assert.equal(fresh.binding('cli.codex').id,first.id,'Saved links survive reload and unlock');
 const savedLease=fresh.acquire('cli.codex');assert.equal(savedLease.read().refreshToken,secret(1).refreshToken);
 const second=await fresh.save({provider:'openai',accountId:'account-B',label:'Second account',secret:secret(2),consumers:['app.codex']});
 assert.equal(savedLease.read().accessToken,secret(1).accessToken,'Unrelated account saves do not revoke a linked consumer');
 const otherLease=fresh.acquire('app.codex');assert.equal(otherLease.read().accessToken,secret(2).accessToken);
 assert.equal(fresh.list().length,2);await assert.rejects(fresh.removeUnused(first.id),/still linked/);
 await fresh.unlink('cli.codex');assert.throws(()=>savedLease.read(),/revoked/);assert.equal(fresh.list().length,2,'Unlinking last consumer retains saved login');
 await fresh.removeUnused(first.id);assert.equal(fresh.list().length,1);assert.equal(fresh.binding('app.codex').id,second.id,'Other accounts remain linked');assert.equal(otherLease.read().accessToken,secret(2).accessToken,'Removing an unused login does not interrupt another account');
 const prevIv=JSON.parse(stores.get('private_A').text).cipher.iv;await fresh.checkpoint();assert.notEqual(JSON.parse(stores.get('private_A').text).cipher.iv,prevIv,'Every save uses a fresh IV');
 const stale=Vault.create(host());await stale.unlock(password);await fresh.checkpoint();await assert.rejects(stale.save({provider:'openai',accountId:'stale',secret:secret(3)}),/Concurrent/);assert.equal(stale.list().length,1,'Failed save does not mutate memory');
 assert.throws(()=>Vault.parseCodex('{"accessToken":"oauth-codex-1234567890"}'),/placeholder/);
 const parsed=Vault.parseCodex(JSON.stringify({tokens:{access_token:'fixture-codex-access',refresh_token:'fixture-codex-refresh',account_id:'fixture-account'}}));assert.equal(parsed.accountId,'fixture-account');
 await assert.rejects(fresh.save({...parsed,consumers:['cli.agy']}),/cannot use/);
 const original=stores.get('private_A');const corrupt=JSON.parse(original.text);corrupt.kdf.iterations=2000001;stores.set('private_A',{text:JSON.stringify(corrupt),revision:++serial});await assert.rejects(Vault.create(host()).unlock(password),/parameters/);stores.set('private_A',original);
 activeProfile='private_B';stores.set('private_B',original);await assert.rejects(Vault.create(host('private_B')).unlock(password),/Incorrect/);assert.throws(()=>fresh.acquire('app.codex'),/session changed/);
 activeProfile='private_A';
 let release;const interrupted=Vault.create({...host(),readRecord:()=>new Promise(r=>release=r)});const pending=interrupted.unlock(password);await new Promise(r=>setImmediate(r));interrupted.close();release(original);await assert.rejects(pending,/session changed/);assert.equal(interrupted.isUnlocked,false);
 const reload=Vault.create(host());await reload.unlock(password);assert.equal(reload.list().length,1);assert.equal(reload.binding('app.codex').accountId,'account-B');
 await reload.unlink('app.codex');await reload.removeUnused(second.id);assert.equal(reload.list().length,0);assert.equal((await reload.status()).initialized,true,'Empty initialized vault remains password protected');
 reload.lock();await reload.unlock(password);assert.equal(reload.list().length,0);await reload.purge();assert.equal(stores.has('private_A'),false);

 // An authenticated legacy envelope upgrades only after explicit unlock and a save.
 const salt=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
 const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const legacyKey=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-512',iterations:600000,salt},base,{name:'AES-GCM',length:256},false,['encrypt']);
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},legacyKey,new TextEncoder().encode(JSON.stringify({version:1,profileId:'private_A',tokens:{github:secret('legacy')}})));
 const legacy={version:1,format:'portfolios-zk-vault',kdf:{algorithm:'PBKDF2',hash:'SHA-512',iterations:600000,salt:Buffer.from(salt).toString('base64')},cipher:{algorithm:'AES-256-GCM',tagLength:128,iv:Buffer.from(iv).toString('base64')},ciphertext:Buffer.from(cipher).toString('base64')};
 stores.set('private_A',{text:JSON.stringify(legacy),revision:++serial});const upgraded=Vault.create(host());assert.equal((await upgraded.unlock(password)).legacy,true);assert.equal(upgraded.acquire('cli.git').read().accessToken,secret('legacy').accessToken);await upgraded.checkpoint();assert.equal(JSON.parse(stores.get('private_A').text).version,2);
 // A lock invalidates operations queued by the old access session, even if a later unlock occurs.
 let resumeRead;const delayed=Vault.create({...host(),readRecord:()=>new Promise(r=>resumeRead=r)});const loading=delayed.unlock(password);await new Promise(r=>setImmediate(r));
 const oldSave=delayed.save({provider:'openai',accountId:'queued-before-lock',secret:secret('queued')});const expectOld=assert.rejects(oldSave,/session changed/);delayed.lock();resumeRead(stores.get('private_A'));await assert.rejects(loading,/session changed/);await expectOld;
 console.log('PASS: encrypted persistence, shared consumers, independent accounts, lock/reload revocation, explicit unused removal, profile binding, placeholder rejection, concurrent-write guard and bounded KDF.');
})().catch(e=>{console.error(e);process.exitCode=1});
