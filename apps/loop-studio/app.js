/* Loop Studio, AGPL-3.0-or-later. Native editor, SystemFS projects and local composition tools. */
(function(){
    'use strict';
    const ID='loop-studio',FOLDER='/music/Loop Studio',sessions=new WeakMap();let activeSession=null;
    const clone=value=>JSON.parse(JSON.stringify(value));
    const safeName=value=>String(value||'Untitled loop').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').replace(/^\.+/,'').slice(0,80)||'Untitled loop';
    function markup(){return `
        <main class="loop-studio" aria-label="Loop Studio">
            <header class="loop-filebar"><img src="apps/loop-studio/icon.svg" alt=""><div class="loop-brand"><strong>Loop Studio</strong><span>LIVE CODE · LOCAL SOUND</span></div><div class="loop-file-actions"><button data-loop="new">New</button><button data-loop="open">Open</button><button data-loop="save">Save</button><button data-loop="save-as">Save As</button></div><button data-loop="help" aria-expanded="false">Guide</button></header>
            <div class="loop-transport"><button class="loop-play" data-loop="play" title="Play or update · Ctrl+Enter"><i class="fa-solid fa-play" aria-hidden="true"></i> <span data-play-label>Play</span></button><button data-loop="stop" title="Stop · Escape"><i class="fa-solid fa-stop" aria-hidden="true"></i> Stop</button><label class="loop-tempo">Tempo <input data-bpm type="number" min="40" max="220" value="112" aria-label="Tempo in BPM"> <span>BPM</span></label><label class="loop-mix">Mix <input data-mix type="range" min="0" max="100" value="70" aria-label="Loop mix volume"></label><button data-loop="record" title="Record the output locally"><i class="fa-solid fa-circle" aria-hidden="true"></i> <span data-record-label>Record</span></button><button data-loop="save-audio" hidden>Save recording</button><button class="loop-ai-toggle" data-loop="ai" aria-expanded="false"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Co-compose</button></div>
            <section class="loop-monitor" aria-label="Live audio monitor"><canvas data-scope width="900" height="84" aria-label="Output waveform"></canvas><div class="loop-clock"><span class="loop-indicator" data-audio-light></span><strong data-audio-label>Ready to play</strong><span data-cycle>Cycle 0</span><div class="loop-steps" aria-label="Cycle position">${Array.from({length:16},()=>'<span></span>').join('')}</div></div></section>
            <div class="loop-layout"><section class="loop-workspace"><div class="loop-document"><input data-title aria-label="Loop title" maxlength="80" value="Midnight circuits"><span data-dirty>Preset</span><button data-loop="undo" hidden>Undo draft</button></div><label class="loop-code-label" for="loop-code">Pattern <span>Ctrl+Enter to play or update</span></label><textarea id="loop-code" data-code aria-label="Strudel pattern" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea><div class="loop-presets"><label>Start somewhere <select data-preset aria-label="Starter loop">${LoopPatterns.starters.map((s,i)=>'<option value="'+i+'">'+escapeHtml(s.title)+'</option>').join('')}</select></label><button data-loop="preset">Load starter</button><span>Powered by Strudel</span></div></section>
            <aside class="loop-shelf" aria-label="Shared sound library"><header><strong>Sound shelf</strong><small data-library-count>Loading the shared library…</small><button data-loop="refresh-sounds" aria-label="Refresh sound index" disabled>Refresh</button></header><input data-sound-search type="search" placeholder="Find a sound…" aria-label="Search shared sounds"><div data-sounds></div><p>Choose a sound to add a track. The shared kit is stored on this server.</p><details><summary>Synth voices</summary><p><code>sine</code>, <code>triangle</code>, <code>sawtooth</code>, <code>square</code>, <code>white</code>, <code>pink</code>, <code>brown</code>. These generate sound without sample files.</p></details></aside></div>
            <section class="loop-ai" data-ai-panel hidden><header><div><strong>Co-compose</strong><p>Describe a mood or a change. Review the draft before applying it.</p></div><button data-loop="ai-settings">Local AI settings</button></header><div class="loop-ai-request"><textarea data-ai-prompt aria-label="Music idea" placeholder="A mellow late-night beat, warm bass and a sparse melody" maxlength="1200"></textarea><button data-loop="generate">Draft a loop</button><button data-loop="cancel-ai" hidden>Cancel</button></div><p data-ai-status role="status">Uses your enabled on-device model. No model starts automatically.</p><div data-draft hidden><strong data-draft-title></strong><pre data-draft-code></pre><button data-loop="apply-draft">Apply draft</button><button data-loop="discard-draft">Discard draft</button></div><details><summary>Music tools</summary><p>The helper can read this editor and sound index, check a pattern, propose a draft, or stop playback. Applying, playing and saving stay in your hands. The MCP connection is local to this open app.</p></details></section>
            <section class="loop-guide" data-guide hidden><h3>A small pattern becomes a track</h3><p><code>s("bd*4")</code> repeats the kick four times per cycle. <code>~</code> is a rest, <code>[c4 e4]</code> subdivides a step, and <code>&lt;c4 g4&gt;</code> alternates across cycles.</p><p>Layer tracks with <code>stack(...)</code>. Try <code>note("c3 eb3 g3").s("triangle").gain(0.3)</code>. Controls include <code>gain</code>, <code>pan</code>, <code>lpf</code>, <code>hpf</code>, <code>attack</code>, <code>release</code>, <code>fast</code>, <code>slow</code>, <code>rev</code>, <code>palindrome</code> and <code>euclid(3,8)</code>.</p><p>This editor accepts bounded Strudel pattern expressions. General JavaScript, callbacks and remote sample loading are unavailable. One cycle is four beats. Update applies your edited pattern while the clock keeps running.</p><p>Open and save <code>.loop.json</code> projects in SystemFS. Record captures the actual mix as WebM/Opus or Ogg, depending on your browser. Minimize, Stop, leaving the tab, or changing profile stops sound.</p><p><a href="https://strudel.cc/learn/mini-notation/" target="_blank" rel="noopener noreferrer">Strudel mini-notation</a> · <a href="https://github.com/Bl4ut0/PortfoliOS/tree/main/apps/loop-studio" target="_blank" rel="noopener noreferrer">Source &amp; license</a></p></section>
            <footer class="loop-status"><span data-loop-status role="status" aria-live="polite">Choose a starter, then press Play.</span><span data-path>Unsaved preset</span></footer>
        </main>`;}
    function mount(windowEl){
        const root=windowEl.querySelector('.loop-studio'),owner=state.currentUserId,events=new AbortController();
        let alive=true,closing=false,dirty=false,path=null,record=null,saved='',writeQueue=Promise.resolve(),recording=null,recordingName='',draft=null,undo=null,aiRequest=0,aiPending=false,animation=0,library=[],libraryReady=Promise.resolve();
        const q=s=>root.querySelector(s),current=()=>alive&&!closing&&owner===state.currentUserId,assert=()=>{if(!current())throw new Error('The music workspace changed.');};
        const say=text=>{if(current())q('[data-loop-status]').textContent=text;};
        const project=()=>({format:'portfolios-loop',version:1,title:q('[data-title]').value||'Untitled loop',bpm:Number(q('[data-bpm]').value),volume:Number(q('[data-mix]').value),code:q('[data-code]').value});
        const serialize=()=>JSON.stringify(project());
        function changed(){dirty=serialize()!==saved;q('[data-dirty]').textContent=dirty?'Unsaved changes':path?'Saved':'Preset';q('[data-dirty]').classList.toggle('is-dirty',dirty);q('[data-path]').textContent=path||(isPrivateUser?.(owner)?'Private workspace · unsaved':'Public workspace · resets on reload');}
        function setProject(value,{clean=false}={}){value=LoopPatterns.project(value);q('[data-title]').value=value.title;q('[data-bpm]').value=value.bpm;q('[data-mix]').value=value.volume;q('[data-code]').value=value.code;if(clean)saved=serialize();changed();}
        function showDraft(value){assert();draft=LoopPatterns.project(value);q('[data-draft-title]').textContent=draft.title+' · '+draft.bpm+' BPM';q('[data-draft-code]').textContent=draft.code;q('[data-draft]').hidden=false;q('[data-ai-panel]').hidden=false;q('[data-ai-status]').textContent='Draft checked. Apply it when you are ready; playback is unchanged.';}
        function clearDraft(){draft=null;q('[data-draft]').hidden=true;}
        function draw(){
            cancelAnimationFrame(animation);animation=0;if(!current())return;
            const canvas=q('[data-scope]'),ctx=canvas.getContext('2d'),data=audio.waveform(),style=getComputedStyle(root),w=canvas.width,h=canvas.height;
            ctx.clearRect(0,0,w,h);ctx.lineWidth=2;ctx.strokeStyle=style.getPropertyValue('--theme-primary-ink').trim()||'#22d3ee';ctx.beginPath();
            if(data.length){for(let i=0;i<data.length;i++){const x=i*w/(data.length-1),y=h/2+(data[i]-128)/128*(h*0.42);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}}
            else{ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);}ctx.stroke();
            const info=audio.status(),step=Math.floor((info.cycle%1)*16);q('[data-cycle]').textContent='Cycle '+Math.floor(info.cycle+1);
            q('.loop-steps').querySelectorAll('span').forEach((node,i)=>node.classList.toggle('is-active',info.playing&&i===step));
            if(info.playing)animation=requestAnimationFrame(draw);
        }
        const audio=LoopAudio.create({onState:info=>{
            if(!current())return;root.dataset.playing=String(info.playing);root.dataset.audioContext=info.contextState;
            q('[data-play-label]').textContent=info.starting?'Starting…':info.playing?'Update':'Play';q('[data-audio-label]').textContent=info.starting?'Starting audio':info.playing?'Live':'Stopped';q('[data-audio-light]').classList.toggle('is-live',info.playing);q('[data-loop="play"]').disabled=info.starting;
            q('[data-record-label]').textContent=info.recording?'End recording':'Record';q('[data-loop="record"]').classList.toggle('is-recording',info.recording);if(info.error)say(info.error);draw();
        },onRecording:blob=>{if(!current())return;recording=blob;recordingName=safeName(project().title)+'-'+new Date().toISOString().replace(/[:.]/g,'-')+(blob.type.includes('ogg')?'.ogg':'.webm');q('[data-loop="save-audio"]').hidden=false;say('Recording ready. Choose Save recording to keep it in SystemFS.');}});
        const tools=LoopMusicTools.create({isCurrent:current,getProject:project,getSounds:()=>library,onProposal:showDraft,onStop:()=>audio.stop()});
        const unregister=registerAppAudioAdapter(ID,{setVolume:value=>audio.setVolume(value)});
        async function save({saveAs=false,automatic=false}={}){
            assert();const snapshot=LoopPatterns.project(project());let target=saveAs?null:path;
            if(!target){
                if(automatic){await SystemFS.ensureDirectory(FOLDER,{silent:true});assert();target=FOLDER+'/'+safeName(snapshot.title)+'-'+crypto.randomUUID().slice(0,8)+'.loop.json';}
                else{const choice=await SystemFS.showSaveDialog({title:'Save Loop Studio project',folder:FOLDER,defaultName:safeName(snapshot.title)+'.loop.json',types:['.loop.json'],signal:events.signal});assert();if(!choice){say('Save cancelled. Your pattern is still here.');return false;}target=choice.path;}
            }
            const expected=target===path?record:await SystemFS.readFile(target);assert();
            const text=JSON.stringify(snapshot,null,2),next=await SystemFS.writeFile(target,SystemFS.getName(target),SystemFS.getParentPath(target),text,undefined,'application/json',false,{...(expected?{expectedRecord:expected}:{expectedAbsent:true}),metadata:{kind:'loop-project',app:ID}});assert();
            path=target;record=next;saved=JSON.stringify(snapshot);changed();say('Saved '+target);return true;
        }
        async function saveRecording({automatic=false}={}){
            assert();if(!recording)return true;const blob=recording;let target;
            if(automatic){await SystemFS.ensureDirectory(FOLDER,{silent:true});assert();target=FOLDER+'/'+recordingName;}
            else{const choice=await SystemFS.showSaveDialog({title:'Save loop recording',folder:FOLDER,defaultName:recordingName,types:[blob.type.includes('ogg')?'.ogg':'.webm'],signal:events.signal});assert();if(!choice){say('Recording save cancelled. The recording is retained.');return false;}target=choice.path;}
            const expected=await SystemFS.readFile(target);assert();const result=await SecurityKernel.importFile({path:target,name:SystemFS.getName(target),parent:SystemFS.getParentPath(target),data:blob,size:blob.size,type:blob.type.split(';')[0],source:'loop-studio-recording',options:{...(expected?{expectedRecord:expected}:{expectedAbsent:true}),metadata:{kind:'loop-recording'}}});assert();if(result.status!=='accepted')throw new Error('Recording quarantined. Review it in Security Center.');
            if(recording===blob){recording=null;q('[data-loop="save-audio"]').hidden=true;}say('Saved recording to '+target);return true;
        }
        function queueSave(options){const pending=writeQueue.catch(()=>{}).then(()=>save(options));writeQueue=pending.catch(()=>{});return pending;}
        async function canReplace(context={}){
            await writeQueue;await audio.stop();assert();if(!dirty&&!recording)return true;
            if(context.autoSave)return(!dirty||await queueSave({automatic:true}))&&await saveRecording({automatic:true});
            const decision=await SystemFS.showClosePrompt({title:'Save current loop?',signal:events.signal});assert();if(decision==='discard')return true;if(decision!=='save')return false;return(!dirty||await queueSave({}))&&await saveRecording({});
        }
        async function loadFile(input){
            assert();let source=input?.file?input.file:await SystemFS.readFile(typeof input==='string'?input:input?.path);assert();if(!source||source.isDirectory)throw new Error('Choose a Loop Studio project.');
            if(source.size>65536)throw new Error('Loop projects are limited to 64 KiB.');
            const data=source instanceof Blob?source:new Blob([source.data]);if(data.size>65536)throw new Error('Loop projects are limited to 64 KiB.');await libraryReady;assert();const inspected=await SecurityKernel.inspect({name:source.name||'project.loop.json',type:'application/json',data,source:'loop-studio-open'});assert();if(inspected.result.verdict!=='clean')throw new Error('The selected file did not pass inspection.');
            const loaded=LoopPatterns.project(JSON.parse(await data.text()));assert();
            if(!await canReplace())return;assert();record=source instanceof Blob?null:source;path=record?.path||null;setProject(loaded,{clean:true});if(!path){saved='';changed();}clearDraft();say(path?'Opened '+path:'Imported project. Choose Save to keep it in SystemFS.');
        }
        function cancelAI(){aiRequest++;if(aiPending&&window.LocalAI?.getStatus?.().generationSurface===ID)void LocalAI.cancelGeneration(ID);aiPending=false;q('[data-loop="generate"]').disabled=false;q('[data-loop="cancel-ai"]').hidden=true;}
        async function compose(){
            assert();if(aiPending)return;const idea=q('[data-ai-prompt]').value.trim();if(!idea)throw new Error('Describe a mood, instrument, or change first.');
            await PortfolioLoader.scripts(['core/local-ai.js']);assert();const info=LocalAI.getStatus();if(info.modelType!=='local'||!LocalAI.isReady()||info.status==='generating'){q('[data-ai-status]').textContent='Enable an idle on-device model in Local AI settings, then return here.';return;}
            const request=++aiRequest;aiPending=true;q('[data-loop="generate"]').disabled=true;q('[data-loop="cancel-ai"]').hidden=false;q('[data-ai-status]').textContent='Composing on this device…';
            try{
                const score=await tools.call('read_project');
                const response=await LocalAI.chat('Music request: '+idea+'\nCurrent project: '+JSON.stringify(score),{mode:ID,localOnly:true,soundNames:library.map(sound=>sound.id)},delta=>{if(current()&&request===aiRequest)q('[data-ai-status]').textContent='Drafting locally…';});assert();if(request!==aiRequest)return;
                const cleaned=String(response).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');if(cleaned.length>32768)throw new Error('The draft is too large. Try a simpler music idea.');const candidate=JSON.parse(cleaned);
                await tools.call('propose_project',{title:candidate.title,bpm:candidate.bpm,code:candidate.code});
            }catch(error){if(current()&&request===aiRequest)q('[data-ai-status]').textContent='Draft not applied: '+error.message;}
            finally{if(current()&&request===aiRequest){aiPending=false;q('[data-loop="generate"]').disabled=false;q('[data-loop="cancel-ai"]').hidden=true;}}
        }
        function renderSounds(){
            const needle=q('[data-sound-search]').value.toLowerCase(),list=q('[data-sounds]');list.replaceChildren();
            for(const sound of library.filter(s=>(s.id+' '+s.title+' '+s.category).toLowerCase().includes(needle))){const button=document.createElement('button');button.type='button';button.className='loop-sound';button.dataset.addSound=sound.id;const title=document.createElement('strong');title.textContent=sound.title;const meta=document.createElement('span');meta.textContent=sound.id+' · '+sound.category;button.append(title,meta);button.title='Add '+sound.title+' as a track';list.append(button);}
        }
        const actions={
            play:async()=>{await audio.play(project());say('Live. Edit your code, then choose Update.');},stop:()=>audio.stop(),
            record:async()=>{if(audio.status().recording)return audio.stopRecording();if(recording&&!await saveRecording())return;await audio.startRecording();say('Recording the local mix. Choose End recording when ready.');},
            'save-audio':()=>saveRecording(),save:()=>queueSave({}),'save-as':()=>queueSave({saveAs:true}),
            open:async()=>{const choice=await SystemFS.showOpenDialog({title:'Open Loop Studio project',folder:FOLDER,types:['.loop.json'],signal:events.signal});assert();if(choice)await loadFile(choice);},
            new:async()=>{if(!await canReplace())return;path=null;record=null;setProject({...LoopPatterns.starters[3],title:'Untitled loop'},{clean:true});clearDraft();say('A new loop is ready.');},
            preset:async()=>{if(!await canReplace())return;path=null;record=null;setProject(LoopPatterns.starters[Number(q('[data-preset]').value)],{clean:true});clearDraft();say('Starter loaded. Press Play.');},
            help:()=>{q('[data-guide]').hidden=!q('[data-guide]').hidden;q('[data-loop="help"]').setAttribute('aria-expanded',String(!q('[data-guide]').hidden));},
            ai:()=>{q('[data-ai-panel]').hidden=!q('[data-ai-panel]').hidden;q('[data-loop="ai"]').setAttribute('aria-expanded',String(!q('[data-ai-panel]').hidden));},
            'ai-settings':()=>openDesktopWindow('local-ai'),generate:compose,'cancel-ai':()=>{cancelAI();q('[data-ai-status]').textContent='Draft cancelled.';},
            'apply-draft':()=>{if(!draft)return;undo=project();setProject(draft);clearDraft();q('[data-loop="undo"]').hidden=false;say('Draft applied to the editor. Press Play or Update when ready.');},
            'discard-draft':clearDraft,undo:()=>{if(!undo)return;setProject(undo);undo=null;q('[data-loop="undo"]').hidden=true;say('Previous pattern restored to the editor.');}
        };
        const run=fn=>async event=>{try{assert();await fn(event);}catch(error){say(error.message);}};
        root.addEventListener('click',run(async event=>{const action=event.target.closest('[data-loop]')?.dataset.loop;if(action&&actions[action])return actions[action]();const sound=event.target.closest('[data-add-sound]')?.dataset.addSound;if(sound){const candidate='stack(\n'+project().code+'\n,\n  s("'+sound+'*4").gain(0.25)\n)';LoopPatterns.parse(candidate);q('[data-code]').value=candidate;changed();say(sound+' added. Press Update to hear the new track.');}}),{signal:events.signal});
        for(const selector of ['[data-code]','[data-title]','[data-bpm]','[data-mix]'])q(selector).addEventListener('input',()=>{changed();if(selector==='[data-mix]')audio.setMix(q(selector).value);if(selector==='[data-bpm]'){const bpm=Number(q(selector).value);if(bpm>=40&&bpm<=220)audio.setTempo(bpm);}}, {signal:events.signal});
        q('[data-sound-search]').addEventListener('input',renderSounds,{signal:events.signal});
        root.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();void run(actions.play)();}if(event.key==='Escape'&&audio.status().playing){event.preventDefault();void audio.stop();}if(event.key==='Tab'&&event.target===q('[data-code]')){event.preventDefault();const input=event.target;input.setRangeText('  ',input.selectionStart,input.selectionEnd,'end');changed();}},{signal:events.signal});
        windowEl.addEventListener('launch-params',run(event=>loadFile(event.detail)),{signal:events.signal});
        document.addEventListener('visibilitychange',()=>{if(document.hidden)void audio.stop();},{signal:events.signal});
        const themeOff=EventBus.on('theme:changed',draw);
        const profileOff=EventBus.on('user:changed',()=>{if(owner!==state.currentUserId)void dispose();});
        async function dispose(){if(!alive)return;closing=true;cancelAI();tools.close();events.abort();profileOff?.();themeOff?.();cancelAnimationFrame(animation);unregister();await audio.close();alive=false;if(activeSession===api)activeSession=null;sessions.delete(windowEl);}
        const api={beforeClose:canReplace,stop:()=>audio.stop(),close:dispose,connectTools:()=>tools.connect(),inspect:()=>({owner,path,dirty,recordingBytes:recording?.size||0,draftReady:!!draft,signalPeak:Array.from(audio.waveform()).reduce((peak,n)=>Math.max(peak,Math.abs(n-128)/128),0),...audio.status()})};sessions.set(windowEl,api);activeSession=api;
        setProject(LoopPatterns.starters[0],{clean:true});draw();
        async function loadLibrary(refresh=false){
            const button=q('[data-loop="refresh-sounds"]');button.disabled=true;
            try{const catalog=await SoundLibrary.getCatalog({refresh});if(!current())return;library=catalog.sounds;LoopPatterns.registerSamples(library.map(s=>s.id));q('[data-library-count]').textContent=library.length+' shared sounds';renderSounds();}
            catch(error){if(current())q('[data-library-count]').textContent=error.message;}
            finally{if(current())button.disabled=false;}
        }
        actions['refresh-sounds']=()=>{libraryReady=loadLibrary(true);return libraryReady;};
        libraryReady=loadLibrary();
        if(windowEl.launchParams)void run(()=>loadFile(windowEl.launchParams))();
    }
    window.LoopStudio=Object.freeze({connectTools(){if(!activeSession)throw new Error('Open Loop Studio first.');return activeSession.connectTools();},inspect:()=>activeSession?.inspect()||null});
    window.appRegistry[ID]={title:'Loop Studio',icon:'apps/loop-studio/icon.svg',windowClass:'loop-studio-window document-window',renderBody:markup,onOpen:mount,
        beforeClose:(root,context)=>sessions.get(root)?.beforeClose(context)??true,onMinimize:root=>sessions.get(root)?.stop(),onClose:root=>sessions.get(root)?.close()};
})();
