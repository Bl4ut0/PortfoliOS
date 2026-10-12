/** Plex API transport. Credentials are memory-only and scoped to the active OS profile. */
(function(){
 'use strict';
 const sessions=new Set();
 const CLOUD='https://plex.tv';
 class PlexClient {
  constructor(){this.owner=window.state?.currentUserId;this.abort=new AbortController();this.id=crypto.randomUUID();this.token='';this.server=null;this.servers=[];this.closed=false;sessions.add(this);}
  assert(){if(this.closed||this.owner!==window.state?.currentUserId)throw new Error('This Plex session has ended.');}
  headers(token=''){return {'Accept':'application/json','X-Plex-Product':'PortfoliOS Plex Player','X-Plex-Version':'0.1.0','X-Plex-Client-Identifier':this.id,'X-Plex-Platform':'Web','X-Plex-Device':'Browser',...(token?{'X-Plex-Token':token}:{})};}
  async fetch(url,{method='GET',token='',signal=this.abort.signal,raw=false,body,keepalive=false}={}){
   this.assert();let response;
   try{response=await fetch(url,{method,headers:this.headers(token),body,keepalive,signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),cache:'no-store',credentials:'omit',redirect:'error'});}
   catch(error){if(signal.aborted)throw error;throw new Error('Cannot reach Plex. Check the server HTTPS connection, browser local-network permission, and CORS access.');}
   this.assert();if(!response.ok)throw new Error(response.status===401?'Plex authorization expired. Disconnect and link again.':response.status===403?'Plex denied access. Check library permissions and remote playback entitlement.':'Plex request failed ('+response.status+').');
   return raw?response:response.json();
  }
  cloud(path,options={}){return this.fetch(CLOUD+path,{...options,token:this.token});}
  async createPin(){return this.cloud('/api/v2/pins?strong=true',{method:'POST'});}
  signInUrl(pin){if(!pin?.code)throw new Error('Plex did not provide a sign-in request.');const params=new URLSearchParams({clientID:this.id,code:pin.code,'context[device][product]':'PortfoliOS Plex Player'});return 'https://app.plex.tv/auth#?'+params.toString();}
  async checkPin(id){if(!/^\d+$/.test(String(id)))throw new Error('Invalid Plex linking request.');const value=await this.cloud('/api/v2/pins/'+id);return value.authToken||'';}
  async discover(){const data=await this.cloud('/api/v2/resources?includeHttps=1&includeRelay=1');return (Array.isArray(data)?data:[]).filter(s=>String(s.provides||'').split(',').includes('server')&&s.accessToken);}
  async connect(index){this.assert();const server=this.servers[index];if(!server)throw new Error('Select a Plex server.');let error;
   const connections=(server.connections||[]).filter(c=>{try{const u=new URL(c.uri);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}}).sort((a,b)=>Number(b.local)-Number(a.local)).slice(0,6);
   if(!connections.length)throw new Error('This server advertises no secure HTTPS connection. Enable secure connections in Plex.');
   for(const connection of connections){try{const origin=new URL(connection.uri).origin;await this.fetch(origin+'/identity',{token:server.accessToken});this.server={...server,origin,local:!!connection.local};return this.server;}catch(e){error=e;}}
   throw error||new Error('No reachable secure server connection.');
  }
  url(path,params={}){this.assert();if(!this.server)throw new Error('Choose a server first.');const url=new URL(path,this.server.origin);if(url.origin!==this.server.origin||url.username||url.password||!String(path).startsWith('/')||String(path).startsWith('//'))throw new Error('Invalid media path.');for(const [k,v]of Object.entries(params))url.searchParams.set(k,String(v));return url;}
  request(path,params={},options={}){return this.fetch(this.url(path,params),{...options,token:this.server.accessToken});}
  mediaUrl(path,params={}){const url=this.url(path,params);url.searchParams.set('X-Plex-Token',this.server.accessToken);url.searchParams.set('X-Plex-Client-Identifier',this.id);return url.href;}
  async libraries(){return (await this.request('/library/sections')).MediaContainer?.Directory||[];}
  async items(path,offset=0,query=''){return (await this.request(path,{'X-Plex-Container-Start':offset,'X-Plex-Container-Size':40,...(query?{title:query}:{})})).MediaContainer||{};}
  async metadata(key){if(!/^\d+$/.test(String(key)))throw new Error('Invalid library item.');return (await this.request('/library/metadata/'+key)).MediaContainer?.Metadata?.[0];}
  async artwork(path,signal){const response=await this.request(path,{}, {raw:true,signal});return URL.createObjectURL(await response.blob());}
  timeline(item,video,state){if(!this.server||!item)return Promise.resolve();return this.request('/:/timeline',{ratingKey:item.ratingKey,key:item.key,state,time:Math.round((video.currentTime||0)*1000),duration:Math.round((video.duration||item.duration/1000||0)*1000)}, {method:'POST',raw:true});}
  close(){this.closed=true;this.abort.abort();this.token='';this.server=null;this.servers=[];sessions.delete(this);}
 }
 window.PlexClient=PlexClient;
 window.EventBus?.on?.('user:changed',()=>{for(const session of [...sessions])session.close();});
})();
