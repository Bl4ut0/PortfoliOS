"use strict";
const assert=require('node:assert/strict'),crypto=require('node:crypto'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn,execFile}=require('node:child_process');
const root=path.resolve(__dirname,'..'),stateDir=path.join(root,'.tmp','session-gateway-state'),php=process.env.PORTFOLIOS_PHP || 'php';
const flags=process.platform==='win32'?['-d','extension_dir='+path.join(path.dirname(php),'ext'),'-d','extension=curl']:[];
process.env.PORTFOLIOS_SESSION_DIR=stateDir;
const exec=(args)=>new Promise((resolve,reject)=>execFile(php,[...flags,...args],{cwd:root},(error,out,err)=>error?reject(new Error(err || error.message)):resolve(out)));
(async()=>{
 const marker='gateway-fixture-'+Date.now(),token=marker+'-not-google',otherToken=token+'-other',port=await new Promise(resolve=>{const s=http.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const helper=path.join(os.tmpdir(),marker+'.php');
 fs.writeFileSync(helper,'<?php\n$dir=getenv("PORTFOLIOS_SESSION_DIR");\nif(!is_dir($dir))mkdir($dir,0700,true);\nforeach(['+JSON.stringify(token)+','+JSON.stringify(otherToken)+'] as $i=>$token){$sub="'+marker+'-".$i;$cache=$dir."/auth-".hash("sha256",$token).".json";$state=$dir."/".hash("sha256",$sub).".json";if(($argv[1] ?? "") === "clean"){if(is_file($cache))unlink($cache);if(is_file($state))unlink($state);if(is_file($state.".lock"))unlink($state.".lock");}else file_put_contents($cache,json_encode(["sub"=>$sub,"verifiedUntil"=>time()+60]));}\n');
 const transportFile=path.join(os.tmpdir(),marker+'-transport.php');
 fs.writeFileSync(transportFile,'<?php\nrequire '+JSON.stringify(path.join(root,'core','session-drive-lib.php').replaceAll('\\','/'))+';\n$data=str_repeat("a".chr(0)."b",1500000);$stream=fopen("php://temp","w+");fwrite($stream,$data);rewind($stream);echo json_encode(portfolios_drive_request($argv[1],$argv[2],"transport-fixture-not-google",$stream,strlen($data),"application/octet-stream",["Content-Range"=>"bytes 0-4499999/4500000"]));');
 let server,echoServer;
 try{
  echoServer=http.createServer((req,res)=>{const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{const body=Buffer.concat(chunks);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({method:req.method,size:body.length,hash:crypto.createHash('sha256').update(body).digest('hex'),range:req.headers['content-range']}));});});
  await new Promise(resolve=>echoServer.listen(0,'127.0.0.1',resolve));
  const expectedHash=crypto.createHash('sha256').update('a\0b'.repeat(1500000)).digest('hex');
  for(const method of ['POST','PATCH','PUT']){const result=JSON.parse(await exec([transportFile,'http://127.0.0.1:'+echoServer.address().port+'/',method]));assert.equal(result.status,200);const echoed=JSON.parse(result.body);assert.equal(echoed.method,method);assert.equal(echoed.size,4500000);assert.equal(echoed.hash,expectedHash);assert.equal(echoed.range,'bytes 0-4499999/4500000');}
  await exec([helper]);server=spawn(php,[...flags,'-S','127.0.0.1:'+port,'-t',root],{cwd:root,stdio:'pipe'});
  let stderr='';server.stderr.on('data',data=>stderr+=data);
  const origin='http://127.0.0.1:'+port;
  for(let i=0;i<100;i++){try{await fetch(origin+'/core/private-session.php');break;}catch{await new Promise(r=>setTimeout(r,30));}}
  const aid='11111111-1111-4111-8111-111111111111',bid='22222222-2222-4222-8222-222222222222';
  async function request(action,id=aid,epoch=0,body={},bearer=token,extra={}){const response=await fetch(origin+'/core/private-session.php?action='+action,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+bearer,'Content-Type':'application/json','X-PortfoliOS-Session':id,'X-PortfoliOS-Epoch':String(epoch),...extra},body:JSON.stringify(body)});return {status:response.status,value:await response.json()};}
  const a=await request('claim');assert.equal(a.status,200,JSON.stringify(a));assert.equal(a.value.owned,true);
  const b=await request('claim',bid);assert.equal(b.value.owned,false);
  await request('request',bid);assert.equal((await request('renew',aid,a.value.epoch)).value.handoffRequested,true);
  assert.equal((await request('release',aid,a.value.epoch)).status,409,'Pending takeover requires confirmed save');
  const released=await request('release',aid,a.value.epoch,{snapshot:'snapshot_fixture',synced:true});assert.equal(released.value.owned,false);
  const owned=await request('claim',bid);assert.equal(owned.value.owned,true);
  const stale=await request('drive',aid,a.value.epoch,{},token,{'X-Drive-Method':'DELETE','X-Drive-Path':'/drive/v3/files/fixture'});assert.equal(stale.status,409,'Actual PHP gateway fences stale writes before Google');
  const malformed=await request('drive',bid,owned.value.epoch,{},token,{'X-Drive-Method':'POST','X-Drive-Path':'https://example.test/drive/v3/files'});assert.equal(malformed.status,400);
  assert.equal((await request('claim',aid,0,{},otherToken)).value.owned,true,'Verified accounts have separate locks');
  const cross=await request('renew',bid,owned.value.epoch,{},token,{Origin:'https://other.example'});assert.equal(cross.status,403);
  const forced=await request('force');assert.equal(forced.value.owned,true);assert(forced.value.epoch>owned.value.epoch);
  assert.equal((await request('assert',bid,owned.value.epoch)).value.owned,false);
  console.log('PASS: actual PHP binary streaming transport, HTTP gateway, same-origin enforcement, verified-account isolation, exclusive claim, save-required handoff, epoch fencing, target rejection and force takeover. Google identity cache is seeded only in the local test server; no production credentials used.');
 }finally{server?.kill();if(echoServer)await new Promise(resolve=>echoServer.close(resolve));await exec([helper,'clean']);fs.unlinkSync(helper);fs.unlinkSync(transportFile);}
})().catch(error=>{console.error(error);process.exitCode=1;});
