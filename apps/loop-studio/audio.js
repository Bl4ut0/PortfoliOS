/* Loop Studio, AGPL-3.0-or-later. Strudel Web Audio output, created only by Play. */
(function(root){
    'use strict';
    let library;
    function load(){return library||(library=root.PortfolioLoader.script('apps/loop-studio/vendor/strudel-web-1.3.0.js').then(()=>root.strudel).catch(error=>{library=null;throw error;}));}
    root.LoopAudio={create({onState=()=>{},onRecording=()=>{}}={}){
        let context=null,repl=null,master=null,analyser=null,compressor=null,destination=null,recorder=null,recordingDone=null;
        let alive=true,generation=0,playing=false,starting=false,bpm=112,volume=70,systemVolume=70;
        const emit=()=>onState(status());
        function status(){return{playing,starting,recording:!!recorder&&recorder.state==='recording',contextState:context?.state||'closed',bpm,volume,systemVolume,cycle:repl?.scheduler?.now?.()||0};}
        function gain(){if(master&&context?.state!=='closed')master.gain.setTargetAtTime(0.7*volume*systemVolume/10000,context.currentTime,0.008);}
        async function stop(){
            generation++;starting=false;playing=false;
            repl?.stop();repl=null;
            if(master&&context?.state!=='closed')master.gain.setValueAtTime(0,context.currentTime);
            await stopRecording();
            const old=context;context=null;master=null;analyser=null;compressor=null;destination=null;
            if(old&&old.state!=='closed')await old.close();emit();
        }
        async function play(project){
            if(!alive)throw new Error('The music window is closed.');
            project=root.LoopPatterns.project(project);const ast=root.LoopPatterns.parse(project.code);
            if(starting)throw new Error('Audio is starting. Wait a moment.');
            if(playing&&repl){
                const id=generation;starting=true;emit();
                try{const names=root.LoopPatterns.sampleNames(ast);if(names.length)await root.strudel.samples(await root.SoundLibrary.sampleMap({only:names}));if(!alive||id!==generation||!playing)throw new Error('Pattern update cancelled.');const pattern=root.LoopPatterns.build(ast,root.strudel);if(pattern.queryArc(0,1).length>128)throw new Error('Use at most 128 events per cycle.');bpm=project.bpm;volume=project.volume;repl.setCps(bpm/240);await repl.setPattern(pattern,true);gain();}
                finally{if(id===generation){starting=false;emit();}}return;
            }
            const id=++generation;starting=true;bpm=project.bpm;volume=project.volume;
            // Resume synchronously in the user gesture, before the engine download.
            const current=new AudioContext({latencyHint:'interactive'});context=current;const resumed=current.resume();emit();
            const check=()=>{if(!alive||generation!==id||context!==current)throw new Error('Audio startup cancelled.');};
            try{
                const engine=await load();await resumed;check();
                engine.setAudioContext(current);engine.setSuperdoughAudioController(null);engine.miniAllStrings();
                await engine.registerSynthSounds();check();
                const names=root.LoopPatterns.sampleNames(ast),samples=names.length?await root.SoundLibrary.sampleMap({only:names}):{};check();
                await engine.samples(samples);await engine.initAudio({disableWorklets:true,maxPolyphony:32});check();
                const output=engine.getSuperdoughAudioController().output;master=output.destinationGain;master.disconnect();
                compressor=current.createDynamicsCompressor();compressor.threshold.value=-12;compressor.knee.value=15;compressor.ratio.value=8;compressor.attack.value=0.003;compressor.release.value=0.18;
                analyser=current.createAnalyser();analyser.fftSize=512;destination=current.createMediaStreamDestination();
                master.connect(compressor);compressor.connect(current.destination);compressor.connect(analyser);compressor.connect(destination);gain();
                const pattern=root.LoopPatterns.build(ast,engine);if(pattern.queryArc(0,1).length>128)throw new Error('Use at most 128 events per cycle.');
                repl=engine.webaudioRepl({audioContext:current,sync:false,defaultOutput:(...args)=>{if(alive&&id===generation)return engine.webaudioOutput(...args);},onEvalError:error=>onState({...status(),error:error.message})});
                repl.setCps(bpm/240);await repl.setPattern(pattern,true);check();starting=false;playing=true;emit();
            }catch(error){if(generation===id)await stop();else if(current.state!=='closed')await current.close();throw error;}
        }
        async function startRecording(){
            if(!playing||!destination)throw new Error('Press Play before recording.');
            if(typeof MediaRecorder==='undefined')throw new Error('Audio recording is unavailable in this browser.');
            if(recorder)throw new Error('Finish the current recording first.');
            const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
            if(!mime)throw new Error('This browser has no supported audio recorder.');
            const chunks=[];let size=0;const current=new MediaRecorder(destination.stream,{mimeType:mime});recorder=current;
            recordingDone=new Promise(resolve=>{
                current.ondataavailable=event=>{if(event.data.size){size+=event.data.size;if(size<=32*1024*1024)chunks.push(event.data);else if(current.state==='recording')current.stop();}};
                current.onstop=()=>{const blob=new Blob(chunks,{type:current.mimeType});recorder=null;recordingDone=null;if(alive&&blob.size)onRecording(blob);emit();resolve(blob);};
                current.onerror=()=>{recorder=null;recordingDone=null;onState({...status(),error:'Recording failed. Your pattern is retained.'});resolve(null);};
            });current.start(500);emit();
        }
        async function stopRecording(){const pending=recordingDone;if(recorder?.state==='recording')recorder.stop();return pending?await pending:null;}
        return Object.freeze({play,stop,startRecording,stopRecording,status,
            setVolume(value){systemVolume=Math.max(0,Math.min(100,Number(value)||0));gain();},
            setTempo(value){bpm=Math.max(40,Math.min(220,Number(value)||112));repl?.setCps(bpm/240);emit();},
            setMix(value){volume=Math.max(0,Math.min(100,Number(value)||0));gain();},
            waveform(){if(!analyser)return new Uint8Array(0);const data=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(data);return data;},
            async close(){await stop();alive=false;}
        });
    }};
})(window);
