'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const ctx=await browser.newContext();await ctx.route('http://127.0.0.1:48888/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Session identity regression</title>'}));
  const source=fs.readFileSync(path.join(__dirname,'../core/private-sessions.js'),'utf8');
  async function page(id){const p=await ctx.newPage();await p.goto('http://127.0.0.1:48888/');if(id)await p.evaluate(id=>sessionStorage.setItem('portfolios:session-id',id),id);await p.addScriptTag({content:source});return p;}
  const previous=await page();const id=await previous.evaluate(async()=>{await PrivateSessions.ensureTabIdentity();return PrivateSessions.id});
  const resumed=await page(id);
  const wait=resumed.evaluate(async()=>{await PrivateSessions.ensureTabIdentity();return PrivateSessions.id});
  await previous.evaluate(()=>setTimeout(()=>PrivateSessions.releaseTabLock(),300));
  assert.equal(await wait,id,'Old document draining its lock must not create another identity');
  const duplicate=await page(id);const duplicateId=await duplicate.evaluate(async()=>{await PrivateSessions.ensureTabIdentity();return PrivateSessions.id});assert.notEqual(duplicateId,id,'A live duplicate tab must receive a different identity');
  for(let n=0;n<3;n++){
   await resumed.reload();await resumed.addScriptTag({content:source});assert.equal(await resumed.evaluate(async()=>{await PrivateSessions.ensureTabIdentity();return PrivateSessions.id}),id,'Refresh keeps its tab identity');
  }
  console.log('PASS: delayed old-document release, three refreshes, cloned storage in a concurrent tab.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
