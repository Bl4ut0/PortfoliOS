'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const source=fs.readFileSync('services/native-relay/sdk/native-relay-client.js','utf8');
 const {GameNetworkClient}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const originalWindow=global.window,originalSocket=global.WebSocket;
 let connections=0;global.WebSocket=class{constructor(){connections++;throw Error('No external relay may be contacted')}};
 try{
  global.window={isPrivateUser:()=>true,state:{currentUserId:'private_fixture'}};
  const noRelay=new GameNetworkClient({cloudRelayUrl:'wss://forbidden.fixture',preferNative:false});
  await assert.rejects(noRelay.init(),/Sandbox networking only/);assert.equal(noRelay.backend,'none');
  global.window.PortfoliOSNativeRelay={isAvailable:async()=>false};await assert.rejects(noRelay.init(),/Sandbox networking only/);
  let tcp=0,udp=0;
  global.window.PortfoliOSNativeRelay={isAvailable:async()=>true,createTcpSocket:async()=>{tcp++;return{}},createUdpSocket:async()=>{udp++;return {on(){},send(){},close(){}}}};
  const native=new GameNetworkClient();assert.equal((await native.init()).backend,'native');await native.createTcpSocket('game.fixture',443);await native.createUdpSocket();assert.equal(tcp,1);assert.equal(udp,1);
  global.window.isPrivateUser=()=>false;await assert.rejects(native.createTcpSocket('game.fixture',443),/private/);await assert.rejects(native.createUdpSocket(),/private/);
  assert.equal(connections,0,'Legacy options must never open cloud sockets');
  global.window.isPrivateUser=()=>true;delete global.window.PortfoliOSNativeRelay;
  await assert.rejects(new GameNetworkClient({mode:'custom',endpoint:'https://invalid.fixture/'}).init(),/secure wss/);
  global.WebSocket=class{static OPEN=1;constructor(url){assert.equal(url,'wss://own-relay.fixture/udp');connections++;this.readyState=1;queueMicrotask(()=>this.onopen())}send(data){if(typeof data==='string'){assert.equal(JSON.parse(data).type,'relay.open');queueMicrotask(()=>this.onmessage({data:JSON.stringify({type:'relay.ready'})}))}}close(){this.onclose?.()}};
  const ownRelay=new GameNetworkClient({mode:'custom',endpoint:'wss://own-relay.fixture/udp'});assert.equal((await ownRelay.init()).backend,'custom');const socket=await ownRelay.createUdpSocket({targetHost:'game.fixture',targetPort:7777});socket.close();assert.equal(connections,1,'Only explicit custom mode opens the provided relay');

  const host=fs.readFileSync('core/browser-workspace.js','utf8');assert.doesNotMatch(host,/mode === 'automatic'|id: 'hyperbeam'|id: 'scramjet'|id: 'browserjs-hosted'/);
  const receipt=JSON.parse(fs.readFileSync('apps/browser/browserjs/release.json'));for(const file of Object.keys(receipt.files||{}).filter(f=>f.endsWith('.js'))){const code=fs.readFileSync('apps/browser/browserjs/'+file,'utf8');assert(!code.includes('sensible-ship-8305.puter.work'),'Imported engine must not discover public relays')}
  console.log('PASS: no cloud fallback with legacy options, unavailable native bridge, raw native TCP/UDP, public gate, and no public relay discovery in imported Browser.JS.');
 }finally{global.window=originalWindow;global.WebSocket=originalSocket}
})().catch(e=>{console.error(e);process.exitCode=1});
