/** Bounded music patterns, shared sample provenance and MCP lifecycle. No real accounts or model downloads. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
require('../core/sound-library.js');require('../apps/loop-studio/patterns.js');require('../apps/loop-studio/tools.js');
const receipt=JSON.parse(fs.readFileSync('apps/loop-studio/engine.json','utf8'));for(const [file,hash]of Object.entries(receipt.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join('apps/loop-studio',file))).digest('hex'),hash,'Pinned engine '+file);
const catalog=SoundLibrary.validate(JSON.parse(fs.readFileSync('data/sounds/catalog.json','utf8')));LoopPatterns.registerSamples(catalog.sounds.map(s=>s.id));
for(const sound of catalog.sounds)for(const file of sound.files){const bytes=fs.readFileSync(file.url);assert.equal(bytes.length,file.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);if(file.type==='audio/wav'){assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');}}
for(const starter of LoopPatterns.starters){LoopPatterns.parse(starter.code);assert.equal(LoopPatterns.project(starter).code,starter.code);}
assert.equal(LoopPatterns.project({...LoopPatterns.starters[0],code:'note( unfinished'}).code,'note( unfinished','An incomplete editor draft can be saved as inert project text');
for(const code of ['while(true){}','fetch("https://example.test")','note("c4").constructor("return window")','s("bd*99999")','s("bd(1,999999999)")','s("bd").euclid(16,16).euclid(16,16).euclid(16,16)','stack(stack(s("bd").fast(8)).fast(8))','s("https://example.test/drum.wav")','s("bd").gain(100)','s("bd").fast(0)','note("c4"); alert(1)', 's("bd").gain(()=>1)'])assert.throws(()=>LoopPatterns.parse(code),undefined,code);
assert.deepEqual(LoopPatterns.sampleNames(LoopPatterns.parse('stack(s("clap*4"),note("c4").s("triangle"))')),['clap']);
const evil=JSON.parse(JSON.stringify(catalog));evil.sounds[0].files[0].url='https://example.test/file.wav';assert.throws(()=>SoundLibrary.validate(evil));
let current=true,proposal=null,stops=0,cleanup=()=>{};const project=LoopPatterns.starters[0];
(async()=>{
 const tools=LoopMusicTools.create({isCurrent:()=>current,getProject:()=>project,getSounds:()=>catalog.sounds,onProposal:p=>proposal=p,onStop:async()=>{stops++;}});
 const listed=await tools.call('list_sounds');assert.equal(listed.sounds.length,8);assert(listed.synths.includes('triangle'));
 assert.equal((await tools.call('read_project')).title,project.title);
 await tools.call('propose_project',{title:'Tool draft',bpm:100,code:'note("c4 e4").s("triangle").gain(0.3)'});assert.equal(proposal.title,'Tool draft');assert.equal(project.title,'Midnight circuits');assert.equal(stops,0,'A proposal neither edits the project nor starts/stops playback');
 await assert.rejects(tools.call('propose_project',{title:'Bad',bpm:100,code:'fetch("x")'}));await assert.rejects(tools.call('read_project',{path:'/documents/vault.enc'}));
 const conn=tools.connect(),pending=new Map();let id=0;conn.port.onmessage=event=>{const reply=event.data;if(pending.has(reply.id)){pending.get(reply.id)(reply);pending.delete(reply.id);}};conn.port.start();cleanup=()=>{conn.close();tools.close();};
 function request(method,params){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(new Error('MCP request timed out')),2000);pending.set(key,reply=>{clearTimeout(timer);resolve(reply);});conn.port.postMessage({jsonrpc:'2.0',id:key,method,params});});}
 assert.equal((await request('tools/list')).error.code,-32002);
 const hello=await request('initialize',{protocolVersion:'2025-06-18',clientInfo:{name:'fixture',version:'1'}});assert.equal(hello.result.protocolVersion,'2025-06-18');assert(hello.result.capabilities.tools);
 conn.port.postMessage({jsonrpc:'2.0',method:'notifications/initialized'});assert.equal((await request('tools/list')).result.tools.length,5);
 assert.equal((await request('tools/call',{name:'validate_pattern',arguments:{code:'s("bd").gain(0.3)'}})).result.structuredContent.valid,true);
 assert.equal((await request('tools/call',{name:'validate_pattern',arguments:{code:'new Function("x")'}})).result.isError,true);
 assert.equal((await request('tools/call',{name:'save_any_file',arguments:{}})).error.code,-32602);
 current=false;await assert.rejects(tools.call('read_project'),/workspace changed/);assert.equal((await request('ping')).error.code,-32000);conn.close();tools.close();
 console.log('PASS: original indexed audio hashes, safe starter syntax/density, arbitrary JavaScript rejection, same-origin sample paths, music-only tools, reviewed proposals, MCP initialize/list/call, and profile revocation.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>cleanup());
