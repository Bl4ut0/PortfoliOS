/* Loop Studio, AGPL-3.0-or-later. MCP tools over a browser-local MessagePort. */
(function(root){
    'use strict';
    const object=properties=>({type:'object',properties,additionalProperties:false});
    const tools=[
        {name:'list_sounds',title:'List available sounds',description:'List the shared sample index and built-in synth voices.',inputSchema:object({}),annotations:{readOnlyHint:true,openWorldHint:false}},
        {name:'read_project',title:'Read current loop',description:'Read only the current editor pattern and tempo.',inputSchema:object({}),annotations:{readOnlyHint:true,openWorldHint:false}},
        {name:'validate_pattern',title:'Check a pattern',description:'Validate the supported Strudel pattern language without playing it.',inputSchema:{...object({code:{type:'string',maxLength:16384}}),required:['code']},annotations:{readOnlyHint:true,openWorldHint:false}},
        {name:'propose_project',title:'Propose a loop',description:'Place a validated composition in the draft pane. The user must Apply it and press Play; this never saves or starts audio.',inputSchema:{...object({title:{type:'string',maxLength:80},bpm:{type:'number',minimum:40,maximum:220},code:{type:'string',maxLength:16384}}),required:['title','bpm','code']},annotations:{destructiveHint:false,openWorldHint:false}},
        {name:'stop_playback',title:'Stop sound',description:'Stop this music app only.',inputSchema:object({}),annotations:{destructiveHint:false,idempotentHint:true,openWorldHint:false}}
    ];
    root.LoopMusicTools={create({isCurrent,getProject,getSounds=()=>[],onProposal,onStop}){
        let active=true;const connections=new Set();
        const check=()=>{if(!active||!isCurrent())throw new Error('The music workspace changed. Reopen its tools in the intended profile.');};
        async function call(name,args={}){
            check();const tool=tools.find(t=>t.name===name);if(!tool)throw new Error('Unknown music tool.');
            if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!Object.hasOwn(tool.inputSchema.properties,k)))throw new Error('Invalid music tool arguments.');
            let result;
            if(name==='list_sounds')result={sounds:getSounds().map(s=>({id:s.id,title:s.title,category:s.category,pack:s.pack})),synths:['sine','triangle','sawtooth','square','white','pink','brown']};
            else if(name==='read_project'){result=JSON.parse(JSON.stringify(getProject()));if(typeof result.code!=='string'||result.code.length>16384)throw new Error('Current pattern exceeds the size limit.');}
            else if(name==='validate_pattern'){root.LoopPatterns.parse(args.code);result={valid:true,characters:args.code.length};}
            else if(name==='propose_project'){
                if(typeof args.title!=='string'||typeof args.bpm!=='number'||typeof args.code!=='string')throw new Error('Provide title, bpm and code.');
                root.LoopPatterns.parse(args.code);
                result=root.LoopPatterns.project({format:'portfolios-loop',version:1,volume:getProject().volume,...args});onProposal(result);
                result={draftReady:true,requiresUserApply:true,playbackStarted:false};
            }else{await onStop();result={stopped:true};}
            check();return result;
        }
        function connect(){
            check();if(connections.size>=4)throw new Error('At most four local music tool connections can be open.');
            const channel=new MessageChannel();let initialized=false,ready=false,queue=Promise.resolve();connections.add(channel);
            async function receive(message){
                const id=message?.id,notify=id===undefined;
                const error=(code,text)=>({jsonrpc:'2.0',id:id??null,error:{code,message:text}});
                try{
                    check();if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string'||(id!==undefined&&(typeof id!=='string'&&!Number.isInteger(id)))||JSON.stringify(message).length>65536)return error(-32600,'Invalid request.');
                    if(message.method==='notifications/initialized'&&notify){if(initialized)ready=true;return null;}
                    if(notify)return null;
                    let result;
                    if(message.method==='ping')result={};
                    else if(message.method==='initialize'){
                        if(initialized)return error(-32600,'Already initialized.');
                        if(typeof message.params?.protocolVersion!=='string'||typeof message.params?.clientInfo?.name!=='string')return error(-32602,'Client protocol and clientInfo are required.');
                        initialized=true;result={protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'portfolios-loop-studio',version:'1.0.0'},instructions:'Use the current editor only. Proposals require human Apply and Play. This browser-local transport grants no filesystem, vault or network access.'};
                    }else if(!ready)return error(-32002,'Initialize this connection first.');
                    else if(message.method==='tools/list')result={tools};
                    else if(message.method==='tools/call'){
                        if(!tools.some(t=>t.name===message.params?.name))return error(-32602,'Unknown music tool.');
                        try{const value=await call(message.params.name,message.params.arguments);result={content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,isError:false};}
                        catch(e){result={content:[{type:'text',text:e.message}],isError:true};}
                    }else return error(-32601,'Method not found.');
                    return{jsonrpc:'2.0',id,result};
                }catch(e){return notify?null:error(-32000,e.message);}
            }
            channel.port1.onmessage=event=>{queue=queue.catch(()=>{}).then(()=>receive(event.data)).then(reply=>{if(reply&&active)channel.port1.postMessage(reply);});};
            channel.port1.start();return Object.freeze({port:channel.port2,close(){connections.delete(channel);channel.port1.close();channel.port2.close();}});
        }
        return Object.freeze({call,connect,list:()=>JSON.parse(JSON.stringify(tools)),close(){active=false;for(const c of connections){c.port1.close();c.port2.close();}connections.clear();}});
    }};
})(typeof window!=='undefined'?window:globalThis);
