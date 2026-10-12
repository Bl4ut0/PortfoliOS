/** Live, credential-free guest connection spike. No token values are logged or saved. */
'use strict';
const {chromium}=require(process.env.PORTFOLIOS_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  await page.route('https://os.bl4ut0.dev/__plex_guest_probe',route=>route.fulfill({contentType:'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'},body:'<!doctype html><title>Plex guest connection probe</title>'}));
  await page.goto('https://os.bl4ut0.dev/__plex_guest_probe');
  const result=await page.evaluate(async()=>{
   const headers={'Accept':'application/json','Content-Type':'application/json','X-Plex-Product':'PortfoliOS Plex Player','X-Plex-Version':'0.1.0','X-Plex-Client-Identifier':crypto.randomUUID(),'X-Plex-Platform':'Web','X-Plex-Device':'Browser'};
   const results=[];
   for(const endpoint of ['https://plex.tv/api/v2/users/anonymous','https://plex.tv/api/v2/users/signin?skipAuthentication=true']){
    try{
     const response=await fetch(endpoint,{method:'POST',headers,body:'{}',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
     const data=await response.json();
     results.push({endpoint,status:response.status,guest:data.anonymous===true,tokenReturned:!!data.authToken,errors:(data.errors||[]).map(e=>({code:e.code,message:e.message}))});
    }catch{results.push({endpoint,error:'Request blocked or unavailable in the browser (CORS/network/timeout).'});}
   }
   return {origin:location.origin,crossOriginIsolated,results};
  });
  console.log(JSON.stringify(result,null,2));
  if(!result.results.some(r=>r.status===200&&r.guest&&r.tokenReturned)){
   console.error('BLOCKED: No anonymous Plex session was obtained with the independent client identity. Guest catalog/playback acceptance has not passed.');
   process.exitCode=1;
  }
 }finally{await browser.close();}
})().catch(()=>{console.error('Guest browser probe failed.');process.exitCode=1;});
