/* Loop Studio, AGPL-3.0-or-later. Pattern-only input: never evaluate user JavaScript. */
(function(root){
    'use strict';
    const MAX_CODE=16384, MAX_NODES=96;
    const sounds=new Set(['bd','sd','hh','sine','triangle','sawtooth','square','white','pink','brown']);
    const synths=new Set(['sine','triangle','sawtooth','square','white','pink','brown']);
    const roots=new Set(['stack','note','n','s','sound']);
    const ranges={gain:[0,1],pan:[-1,1],lpf:[40,16000],hpf:[20,12000],attack:[0,2],decay:[0,2],sustain:[0,1],release:[0.01,3],clip:[0.05,2],room:[0,0.8],delay:[0,0.8],delaytime:[0.02,1],delayfeedback:[0,0.75],fast:[0.125,8],slow:[0.125,8],transpose:[-24,24],add:[-24,24],segment:[1,16]};
    const methods=new Set([...Object.keys(ranges),'s','sound','note','scale','rev','palindrome','euclid']);
    function notation(text){
        if(typeof text!=='string'||!text.trim()||text.length>256||!/^[a-zA-Z0-9#_~\s\[\]<>,.*\/!?:+@%()-]+$/.test(text))throw new Error('Use a mini-notation pattern up to 256 characters.');
        let depth=0,mult=1;
        for(const c of text){if('[<('.includes(c)){if(++depth>3)throw new Error('Keep mini-notation nesting to three levels.');}else if(']> )'.replace(' ','').includes(c)){if(--depth<0)throw new Error('Unbalanced mini-notation groups.');}}
        if(depth)throw new Error('Unbalanced mini-notation groups.');
        for(const m of text.matchAll(/([*!\/])\s*(\d+(?:\.\d+)?)/g)){const n=Number(m[2]);if(!Number.isInteger(n)||n<1||n>8)throw new Error('Pattern repetitions/divisions must be whole numbers from 1 to 8.');if(m[1]!=='/')mult*=n;}
        if(/[*!\/]\s*(?!\d)(?:[^\s]|$)/.test(text))throw new Error('Use a fixed number for a pattern repetition or division.');
        for(const pair of text.matchAll(/\(([^()]*)\)/g)){if(!/^\d+,\d+(?:,\d+)?$/.test(pair[1])||pair[1].split(',').some(n=>Number(n)>16))throw new Error('Inline Euclidean steps must be whole numbers up to 16.');}
        const atoms=(text.match(/[a-zA-Z0-9#_.+-]+/g)||[]).length;
        if(atoms*mult>256)throw new Error('Pattern is too dense. Reduce repetitions.');
        return text;
    }
    function checkSound(value){
        if(typeof value!=='string')throw new Error('Sound names use quoted mini-notation.');
        notation(value);
        for(const name of value.match(/[a-zA-Z][a-zA-Z0-9_-]*/g)||[])if(!sounds.has(name))throw new Error('Unknown sound '+name+'. Choose a sound from the shared library or a built-in synth.');
    }
    function parse(source){
        if(typeof source!=='string'||!source.trim()||source.length>MAX_CODE)throw new Error('Enter a pattern up to 16 KiB.');
        let i=0,nodes=0;
        const fail=message=>{throw new Error(message+' (character '+(i+1)+')');};
        function space(){for(;;){while(/\s/.test(source[i]||'')&&i<source.length)i++;if(source.slice(i,i+2)==='//'){while(i<source.length&&source[i]!=='\n')i++;continue;}break;}}
        function eat(c){space();if(source[i]===c){i++;return true;}return false;}
        function identifier(){space();const m=/^[a-zA-Z][a-zA-Z0-9]*/.exec(source.slice(i));if(!m)fail('Expected a pattern function');i+=m[0].length;return m[0];}
        function string(){const quote=source[i++];let text='';while(i<source.length){let c=source[i++];if(c===quote)return text;if(c==='\\'){c=source[i++];if(!['\\','"',"'",'n','t'].includes(c))fail('Unsupported string escape');c=c==='n'?'\n':c==='t'?'\t':c;}if(c==='\n'||c==='\r')fail('Keep quoted patterns on one line');text+=c;}fail('Unclosed string');}
        function args(depth){const values=[];if(eat(')'))return values;do{if(values.length>=8)fail('Use at most eight arguments');values.push(value(depth+1));}while(eat(','));if(!eat(')'))fail('Expected a closing parenthesis');return values;}
        function value(depth=0){
            if(depth>12||++nodes>MAX_NODES)fail('Pattern is too complex');space();
            if(source[i]==='"'||source[i]==="'")return{kind:'value',value:string()};
            const number=/^-?(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(i));
            if(number){i+=number[0].length;return{kind:'value',value:Number(number[0])};}
            const name=identifier();if(!roots.has(name))fail('Unsupported pattern function '+name);if(!eat('('))fail('Expected a function call');
            const node={kind:'pattern',name,args:args(depth),chain:[]};
            if(name==='stack'){if(!node.args.length||node.args.some(a=>a.kind!=='pattern'))fail('stack needs one to eight patterns');}
            else {if(node.args.length!==1||node.args[0].kind!=='value')fail(name+' needs one quoted pattern or number');if(['s','sound'].includes(name))checkSound(node.args[0].value);else if(typeof node.args[0].value==='string')notation(node.args[0].value);else if(!Number.isFinite(node.args[0].value)||Math.abs(node.args[0].value)>127)fail('Note value is outside the supported range');}
            let speed=1;
            while(eat('.')){
                if(++nodes>MAX_NODES||node.chain.length>=12)fail('Use fewer chained controls');
                const method=identifier();if(!methods.has(method))fail('Unsupported control '+method);if(!eat('('))fail('Expected a control call');const params=args(depth);
                if(['rev','palindrome'].includes(method)){if(params.length)fail(method+' takes no arguments');}
                else if(method==='euclid'){if(params.length!==2||params.some(a=>a.kind!=='value'||!Number.isInteger(a.value)||a.value<1||a.value>16)||params[0].value>params[1].value)fail('euclid needs hits and steps between 1 and 16');}
                else {
                    if(params.length!==1||params[0].kind!=='value')fail(method+' takes one string or number');
                    const input=params[0].value;
                    if(['s','sound'].includes(method))checkSound(input);
                    else if(method==='scale'){if(typeof input!=='string'||input.length>48||!/^[A-Ga-g][#b]?\d? [a-zA-Z ]+$/.test(input))fail('Use a scale such as C3 minor');}
                    else if(method==='note'){if(typeof input==='string')notation(input);else if(Math.abs(input)>127)fail('Note value is outside the supported range');}
                    else {
                        const [min,max]=ranges[method];let numbers;
                        if(typeof input==='string'){notation(input);numbers=(input.replace(/[*!\/]\s*\d+/g,'').match(/-?(?:\d+(?:\.\d*)?|\.\d+)/g)||[]).map(Number);if(!numbers.length||/[a-zA-Z]/.test(input))fail(method+' needs numeric values');}
                        else numbers=[input];
                        if(numbers.some(n=>!Number.isFinite(n)||n<min||n>max))fail(method+' values must be between '+min+' and '+max);
                        if(['fast','slow','segment'].includes(method)){if(typeof input!=='number')fail(method+' needs one fixed number');speed*=method==='slow'?1/input:input;if(speed>8||speed<0.125)fail('Keep combined pattern speed between 1/8 and 8');}
                    }
                }
                node.chain.push({name:method,args:params});
            }
            return node;
        }
        const ast=value();if(ast.kind!=='pattern')fail('Start with note, n, s, sound or stack');eat(';');space();if(i!==source.length)fail('Only pattern expressions are supported. JavaScript statements and callbacks are unavailable');
        const cost=text=>{let factor=1;for(const m of text.matchAll(/[*!]\s*(\d+)/g))factor*=Number(m[1]);for(const m of text.matchAll(/\(\d+,(\d+)(?:,\d+)?\)/g))factor*=Number(m[1]);return Math.max(1,(text.match(/[a-zA-Z0-9#_.+-]+/g)||[]).length)*factor;};
        function bound(node,inherited=1){
            let rate=1,mult=1;for(const control of node.chain){const number=control.args[0]?.value;if(control.name==='fast')rate*=number;if(control.name==='slow')rate/=number;if(control.name==='euclid')mult*=control.args[1].value;if(control.name==='segment')mult*=number;for(const arg of control.args)if(typeof arg.value==='string'&&control.name!=='scale')mult*=cost(arg.value);}
            const effective=inherited*rate;if(effective>8||effective<0.125)fail('Keep nested pattern speed between 1/8 and 8');
            const base=node.name==='stack'?node.args.reduce((sum,child)=>sum+bound(child,effective),0):(typeof node.args[0].value==='string'?cost(node.args[0].value):1);
            const estimate=base*rate*mult;if(!Number.isFinite(estimate)||estimate>256)fail('Pattern is too dense. Use fewer repetitions or controls');return estimate;
        }
        bound(ast);return ast;
    }
    function build(ast,engine){
        const evaluate=node=>{if(node.kind==='value')return node.value;let pattern=engine[node.name](...node.args.map(evaluate));for(const method of node.chain)pattern=pattern[method.name](...method.args.map(evaluate));return pattern;};
        return evaluate(ast);
    }
    function project(input){
        if(!input||typeof input!=='object'||Array.isArray(input)||input.format!=='portfolios-loop'||input.version!==1)throw new Error('Choose a Loop Studio project (.loop.json).');
        const title=String(input.title||'Untitled loop').trim();if(!title||title.length>80||/[\u0000-\u001f]/.test(title))throw new Error('Use a project title up to 80 characters.');
        const bpm=Number(input.bpm),volume=Number(input.volume??70);if(!Number.isFinite(bpm)||bpm<40||bpm>220||!Number.isFinite(volume)||volume<0||volume>100)throw new Error('Tempo must be 40–220 BPM and volume 0–100.');
        if(typeof input.code!=='string'||input.code.length>MAX_CODE)throw new Error('Project code must be text up to 16 KiB.');return{format:'portfolios-loop',version:1,title,bpm,volume,code:input.code};
    }
    const starters=[
        {title:'Midnight circuits',bpm:112,code:'// A small groove. Edit, then Ctrl+Enter to update.\nstack(\n  s("bd*4").gain(0.65),\n  s("~ sd ~ sd").gain(0.4),\n  s("hh*8").gain(0.18),\n  note("c2 ~ [c2 eb2] g1").s("sawtooth").lpf(650).release(0.12).gain(0.22),\n  note("<c4 eb4 g4 bb4>").s("triangle").release(0.7).gain(0.28)\n)'},
        {title:'Glass garden',bpm:84,code:'// Slow down and let the notes breathe.\nstack(\n  note("c4 [eb4 g4] bb4 g4").s("sine").slow(2).release(1.4).gain(0.4),\n  note("<c2 ab1 f1 g1>").s("triangle").release(0.9).gain(0.3),\n  s("hh ~ hh ~").gain(0.12)\n)'},
        {title:'Broken orbit',bpm:132,code:'// Euclidean hits over a rolling bass.\nstack(\n  s("bd").euclid(3,8).gain(0.6),\n  s("~ sd ~ sd").gain(0.38),\n  s("hh*8").pan("-0.4 0.4").gain(0.16),\n  note("c2 c2 eb2 [g1 bb1]").s("square").lpf(900).release(0.08).gain(0.18)\n)'},
        {title:'First notes',bpm:100,code:'// ~ is a rest. Brackets subdivide one step.\n// * repeats. Angle brackets alternate across cycles.\nnote("c4 e4 [g4 a4] ~").s("triangle").gain(0.4)'}
    ].map(s=>project({format:'portfolios-loop',version:1,volume:70,...s}));
    function registerSamples(names){for(const name of names)if(/^[a-z][a-z0-9_-]{0,31}$/i.test(name)&&!['constructor','prototype','__proto__','then'].includes(name))sounds.add(name);}
    function sampleNames(ast){const names=new Set();const visit=node=>{if(node.kind!=='pattern')return;if(['s','sound'].includes(node.name))for(const name of node.args[0].value.match(/[a-zA-Z][a-zA-Z0-9_-]*/g)||[])if(!synths.has(name))names.add(name);for(const method of node.chain)if(['s','sound'].includes(method.name))for(const name of method.args[0].value.match(/[a-zA-Z][a-zA-Z0-9_-]*/g)||[])if(!synths.has(name))names.add(name);node.args.forEach(visit);};visit(ast);return [...names];}
    root.LoopPatterns=Object.freeze({parse,build,project,starters,MAX_CODE,registerSamples,sampleNames});
})(typeof window!=='undefined'?window:globalThis);
