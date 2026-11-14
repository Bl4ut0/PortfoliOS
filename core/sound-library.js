/** Public shared sample index; loaded on demand. User/private recordings remain in SystemFS. */
(function(root){
    'use strict';
    let pending;
    const validName=value=>typeof value==='string'&&/^[a-z][a-z0-9_-]{0,31}$/i.test(value)&&!['constructor','prototype','__proto__','then'].includes(value);
    function validate(input){
        if(input?.format!=='portfolios-sounds'||input.version!==1||!Array.isArray(input.packs)||!Array.isArray(input.sounds)||input.sounds.length>512)throw new Error('Invalid shared sound index.');
        const packs=new Map(),ids=new Set();
        for(const pack of input.packs){if(!validName(pack.id)||packs.has(pack.id)||typeof pack.title!=='string'||typeof pack.license!=='string'||!pack.license||typeof pack.source!=='string')throw new Error('Invalid sound pack metadata.');packs.set(pack.id,pack);}
        for(const sound of input.sounds){
            if(!validName(sound.id)||ids.has(sound.id)||!packs.has(sound.pack)||typeof sound.title!=='string'||typeof sound.category!=='string'||!Array.isArray(sound.files)||!sound.files.length||sound.files.length>16)throw new Error('Invalid sound entry.');ids.add(sound.id);
            for(const file of sound.files){if(typeof file.url!=='string'||!/^data\/sounds\/[a-z0-9_ /.-]+\.(wav|ogg|mp3|flac|m4a|webm)$/i.test(file.url)||file.url.includes('..')||!Number.isInteger(file.bytes)||file.bytes<1||file.bytes>8*1024*1024||!/^([a-f0-9]{64})$/.test(file.sha256)||typeof file.type!=='string'||!file.type.startsWith('audio/'))throw new Error('Invalid indexed sample.');}
        }
        const result=JSON.parse(JSON.stringify(input));const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};return freeze(result);
    }
    function getCatalog({refresh=false}={}){
        if(refresh)pending=null;if(pending)return pending;
        const request=(async()=>{const response=await fetch(new URL('data/sounds/catalog.json',document.baseURI),{credentials:'omit',cache:'no-cache'});if(!response.ok)throw new Error('The shared sound library is unavailable ('+response.status+').');const text=await response.text();if(text.length>1024*1024)throw new Error('Sound index exceeds the size limit.');return validate(JSON.parse(text));})();
        const result=request.catch(error=>{if(pending===result)pending=null;throw error;});pending=result;return result;
    }

    async function sampleMap({only=null,excludeNames=[]}={}){
        const catalog=await getCatalog(),result=Object.create(null),wanted=only?new Set(only):null;
        for(const sound of catalog.sounds){if(excludeNames.includes(sound.id)||(wanted&&!wanted.has(sound.id)))continue;result[sound.id]=sound.files.map(file=>new URL(file.url+'?sha='+file.sha256.slice(0,16),document.baseURI).href);}
        if(wanted)for(const name of wanted)if(!Object.hasOwn(result,name)&&!excludeNames.includes(name))throw new Error('Shared sample '+name+' is not installed.');return result;
    }
    root.SoundLibrary=Object.freeze({getCatalog,sampleMap,validate});
})(typeof window!=='undefined'?window:globalThis);
