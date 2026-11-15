/** Real controller/worker bootstrap and debug UI with a controlled WebLLM transport; no model download or provider calls. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const runtime = 'https://esm.run/@mlc-ai/web-llm@0.2.88';
const moduleFixture = `
export const prebuiltAppConfig = {model_list: ['gemma-2-2b-it-q4f16_1-MLC', 'SmolLM2-360M-Instruct-q4f16_1-MLC'].map(model_id => ({model_id, model:'https://example.test/model', model_lib:'https://example.test/model.wasm', overrides:{context_window_size:4096}, required_features:['shader-f16']}))};
export class WebWorkerMLCEngineHandler { onmessage() {} }
export async function CreateWebWorkerMLCEngine(worker, id, options) {
 const f = window.fixture; f.loads++; if(f.loadError !== null) throw f.loadError;
 options.initProgressCallback({progress:1,text:'Fixture weights ready'});
 return {
  unload: async () => {f.unloads++;}, interruptGenerate: async () => {},
  chat:{completions:{create:async request => {
   f.requests.push(request);
   if(f.behavior === 'hold') return new Promise((resolve,reject) => {f.releaseOld = () => reject('Old worker stopped');});
   if(f.behavior === 'string-error') throw 'ContextWindowSizeExceededError: Prompt tokens exceed context window size: number of prompt tokens: 5000; context window size: 4096.';
   if(f.behavior === 'number-error') throw 8476360;
   if(f.behavior === 'numeric-string-error') throw '8476360';
   if(f.behavior === 'object-error') throw {error:{message:'GPUDevice was lost during dispatch'}};
   const text = f.reply;
   if(request.stream) return (async function*(){yield {choices:[{delta:{content:text.slice(0,16)}}]};yield {choices:[{delta:{content:text.slice(16)}}]};})();
   return {choices:[{message:{content:text}}]};
  }}}
 };
}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/styles/tokens.css"><link rel="stylesheet" href="/styles/components.css"></head><body><h1>Local AI contract fixture</h1><div id="settings-debug-log-container"></div><script src="/data/systems.js"></script><script src="/core/local-ai.js"></script><script src="/desktop/settings.js"></script></body></html>`;
const headers = {'Cross-Origin-Opener-Policy':'same-origin', 'Cross-Origin-Embedder-Policy':'require-corp', 'Cross-Origin-Resource-Policy':'same-origin'};
const server = http.createServer((req,res) => {
 const name = decodeURIComponent(new URL(req.url,'http://fixture').pathname);
 if(name === '/__ai') return res.writeHead(200,{...headers,'Content-Type':'text/html'}).end(html);
 const file = path.resolve(root,'.'+(name === '/core/local-ai-worker.php' ? '/core/local-ai-worker.js' : name));
 if(!file.startsWith(root+path.sep) || name.split('/').some(part=>part.startsWith('.'))) return res.writeHead(403).end();
 fs.readFile(file,(error,data)=>error ? res.writeHead(404).end() : res.writeHead(200,{...headers,'Content-Type':file.endsWith('.css')?'text/css':'text/javascript'}).end(data));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({serviceWorkers:'block'}), external=[], errors=[];
 try {
  await context.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(origin)) return route.continue();
   external.push(url);
   if(url === runtime) return route.fulfill({body:moduleFixture,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin'}});
   return route.abort();
  });
  await context.addInitScript(()=>{
   localStorage.setItem('bl4ut0LocalAiModel','gemma-2-2b-it-q4f16_1-MLC');
   window.fixture={loads:0,unloads:0,requests:[],loadError:null,behavior:'success',reply:'<image_soft_token>Fixture response.',features:[]};
   window.SystemLogs=[];window.addSystemLog=(type,message)=>SystemLogs.push('['+type+'] '+message);
   window.EventBus={emit(){},on(){return ()=>{};}};
   Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({info:{vendor:'fixture-gpu'},features:new Set(fixture.features),limits:{maxStorageBufferBindingSize:2147483644,maxBufferSize:2147483648}})}});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/__ai');await page.waitForFunction(()=>!!window.LocalAI);await page.evaluate(()=>initDebugSettings());
  async function enable(){
   await page.evaluate(()=>{window.enableOutcome=LocalAI.enable('browser regression').then(status=>({ok:true,status})).catch(error=>({ok:false,message:error.message}));});
   await page.locator('[data-local-ai-consent="allow"]').click();
   return await page.evaluate(()=>enableOutcome);
  }
  const missing=await enable();assert.equal(missing.ok,false);assert.match(missing.message,/shader-f16/);assert.equal(await page.evaluate(()=>fixture.loads),0,'Missing GPU features fail before model download');
  const missingSnapshot=await page.evaluate(()=>LocalAI.getDebugSnapshot());assert.equal(missingSnapshot.lastFailure.phase,'load');assert.equal(missingSnapshot.gpu.vendor,'fixture-gpu');
  await page.evaluate(()=>fixture.features=['shader-f16']);assert.equal((await enable()).ok,true);
  async function ask(prompt,options={mode:'cli'},stream=false){return page.evaluate(async({prompt,options,stream})=>{
   try {const chunks=[];const text=await LocalAI.chat(prompt,options,stream?delta=>chunks.push(delta):null);return{ok:true,text,chunks};}
   catch(error){return{ok:false,message:error.message,name:error.name};}
  },{prompt,options,stream});}
  const tooLong=await ask('x'.repeat(20000));assert.equal(tooLong.name,'LocalAIInputTooLongError');assert.equal(await page.evaluate(()=>LocalAI.isReady()),true);assert.equal(await page.evaluate(()=>fixture.loads),1);
  await page.evaluate(()=>fixture.behavior='string-error');
  const rejected=await ask('Find WardenIT. This private test marker must never enter diagnostics.',{mode:'cli'},true);
  assert.equal(rejected.ok,false);assert.match(rejected.message,/Prompt tokens exceed context window size/);assert.equal(await page.evaluate(()=>LocalAI.isReady()),true,'A request rejection retains the loaded model');assert.equal(await page.evaluate(()=>fixture.unloads),0);
  const snapshot=await page.evaluate(()=>LocalAI.getDebugSnapshot());assert.equal(snapshot.lastFailure.phase,'generation');assert.equal(snapshot.lastFailure.surface,'cli');assert.equal(snapshot.lastRequest.contextWindowTokens,4096);assert(snapshot.lastRequest.inputCharacters<10000,'All local models receive bounded portfolio context');
  const sent=await page.evaluate(()=>fixture.requests.at(-1));assert.match(sent.messages[0].content,/WardenIT/i);assert(!sent.messages[0].content.includes('System Bookmarks:'),'Local context omits unrelated bookmark lists');
  const report=await page.evaluate(()=>getSystemDebugReport());assert.match(report,/\[LocalAI Last Error\].*ContextWindowSizeExceededError/);assert.match(report,/\[LocalAI Failure\] phase=generation/);assert.match(report,/\[LocalAI Request\]/);assert.match(report,/\[LocalAI GPU\] vendor=fixture-gpu/);assert(!report.includes('This private test marker'),'Debug exports never contain the prompt');
  await page.evaluate(()=>fixture.behavior='success');const reply=await ask('Explain this workspace',{mode:'cli'},true);assert.equal(reply.text,'Fixture response.');assert.equal(reply.chunks.join(''),'Fixture response.');assert.equal(await page.evaluate(()=>LocalAI.getStatus().lastError),'','A successful retry clears the previous failure');assert.equal(await page.evaluate(()=>fixture.loads),1,'Retry needs no model reload');
  await page.evaluate(()=>fixture.reply=JSON.stringify({title:'Repeated notes',bpm:100,code:'stack(note("c4"), note("c4"), note("c4"), note("c4"), note("c4"))'}));
  const music=await ask('Draft a small beat',{mode:'loop-studio',localOnly:true,soundNames:['clap']},true);assert.equal(music.ok,true);assert.equal(music.text,await page.evaluate(()=>fixture.reply),'Structured code is preserved without prose cleanup');const musicRequest=await page.evaluate(()=>fixture.requests.at(-1));assert.equal(musicRequest.max_tokens,384);assert(!musicRequest.messages[0].content.includes('PORTFOLIO DATASET'));
  await page.evaluate(()=>fixture.behavior='number-error');const numeric=await ask('Explain',{mode:'cli'},true);assert.match(numeric.message,/8476360/);assert.equal(await page.evaluate(()=>LocalAI.getStatus().status),'error');assert.equal(await page.evaluate(()=>LocalAI.getDebugSnapshot().lastFailure.errorType),'number');
  await page.evaluate(()=>fixture.behavior='success');assert.equal((await enable()).ok,true);
  await page.evaluate(()=>fixture.behavior='numeric-string-error');const pointer=await ask('Explain',{mode:'cli'});assert.match(pointer.message,/WebLLM runtime code: 8476360/);await page.evaluate(()=>fixture.behavior='success');assert.equal((await enable()).ok,true);
  await page.evaluate(()=>{fixture.behavior='hold';window.oldGeneration=LocalAI.chat('Old request',{mode:'cli'});});await page.waitForFunction(()=>!!fixture.releaseOld);
  await page.evaluate(()=>{LocalAI.setSelectedModelId('SmolLM2-360M-Instruct-q4f16_1-MLC');fixture.behavior='success';});assert.equal((await enable()).ok,true);
  await page.evaluate(()=>fixture.releaseOld());assert.equal(await page.evaluate(()=>oldGeneration),'AI response cancelled.');assert.equal(await page.evaluate(()=>LocalAI.isReady()),true,'An old rejection cannot disable a newly selected model');
  await page.evaluate(()=>fixture.behavior='object-error');const nested=await ask('Explain',{mode:'cli'});assert.match(nested.message,/GPUDevice was lost/);assert.equal(await page.evaluate(()=>LocalAI.getStatus().status),'error');
  await page.evaluate(()=>{fixture.behavior='success';LocalAI.setSelectedModelId('gemini-3.8-flash');});assert.equal((await enable()).ok,true);const cloud=await ask('Compose',{mode:'loop-studio',localOnly:true});assert.match(cloud.message,/on-device/);
  await page.evaluate(()=>LocalAI.setSelectedModelId('gemma-2-2b-it-q4f16_1-MLC'));
  await page.evaluate(()=>LocalAI.disable());await page.evaluate(()=>fixture.loadError='TypeError: Cache storage failed while loading weights');const load=await enable();assert.equal(load.ok,false);assert.match(load.message,/Cache storage failed/);assert.equal(await page.evaluate(()=>LocalAI.getDebugSnapshot().lastFailure.phase),'load');
  assert(external.length>=2);assert(external.every(url=>url===runtime),'Page and worker import exactly the same pinned runtime');assert.deepEqual(errors,[]);
  console.log('PASS: worker string/numeric load and generation errors, debug exports without prompt text, modern GPU metadata/pre-download feature checks, bounded local context, warm request-error retry, structured draft budget, streaming sanitization, and stale-model rejection isolation. No models or provider credentials used.');
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
