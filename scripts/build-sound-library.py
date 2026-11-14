#!/usr/bin/env python3
"""Index public, curated sound packs; optionally create the original PortfoliOS starter kit."""
from pathlib import Path
import argparse, hashlib, json, math, random, re, struct, wave
ROOT = Path(__file__).resolve().parents[1]
SOUNDS = ROOT / 'data' / 'sounds'
FORMATS = {'.wav':'audio/wav', '.ogg':'audio/ogg', '.mp3':'audio/mpeg', '.flac':'audio/flac', '.m4a':'audio/mp4', '.webm':'audio/webm'}

def starter():
    folder = SOUNDS / 'portfolios-kit'
    folder.mkdir(parents=True, exist_ok=True)
    names = [('bd','Kick',0.36),('sd','Snare',0.19),('hh','Closed hi-hat',0.065),('oh','Open hi-hat',0.23),('clap','Clap',0.22),('rim','Rim click',0.09),('tom','Low tom',0.34),('bell','Bell',0.5)]
    for name, title, duration in names:
        target = folder / (name + '.wav')
        if target.exists():
            continue
        rng=random.Random(20261114 + sum(map(ord,name)));sr=22050;phase=0;last=0;frames=[]
        for i in range(int(sr*duration)):
            t=i/sr;noise=rng.random()*2-1
            if name=='bd':
                phase+=2*math.pi*(45+120*math.exp(-t*30))/sr;value=math.sin(phase)*math.exp(-t*14)*0.8
            elif name=='sd':value=(noise*0.6+math.sin(2*math.pi*180*t)*0.25)*math.exp(-t*23)
            elif name in ['hh','oh']:
                value=(noise-last)*0.2*math.exp(-t*(70 if name=='hh' else 18));last=noise
            elif name=='clap':value=noise*0.5*math.exp(-t*18)*(0.3+0.7*(math.sin(t*170)>0))
            elif name=='rim':value=(math.sin(t*2*math.pi*920)+math.sin(t*2*math.pi*1370))*0.3*math.exp(-t*65)
            elif name=='tom':value=math.sin(2*math.pi*(100*t+2*(1-math.exp(-t*12))))*0.7*math.exp(-t*10)
            else:value=(math.sin(t*2*math.pi*620)+0.45*math.sin(t*2*math.pi*927))*0.35*math.exp(-t*8)
            value*=min(1,t/0.002,max(0,(duration-t)/0.005));frames.append(struct.pack('<h',round(max(-1,min(1,value))*32767)))
        with wave.open(str(target),'wb') as f:
            f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes(b''.join(frames))
    manifest=folder/'pack.json'
    if not manifest.exists():
        manifest.write_text(json.dumps({'id':'portfolios-kit','title':'PortfoliOS Pocket Kit','license':'ISC','source':'https://github.com/Bl4ut0/PortfoliOS','description':'Original synthesized percussion. No third-party recordings.','sounds':[{'id':name,'title':title,'category':'drums' if name!='bell' else 'percussion','files':[name+'.wav']} for name,title,_ in names]},indent=2)+'\n',encoding='utf-8')

def index():
    packs=[];sounds=[];ids=set();pack_ids=set()
    for manifest in sorted(SOUNDS.glob('*/pack.json')):
        if manifest.is_symlink() or manifest.parent.is_symlink() or manifest.parent.name.startswith('.'):raise ValueError('Sound packs cannot use hidden paths or symbolic links')
        pack=json.loads(manifest.read_text(encoding='utf-8-sig'))
        for key in ['id','title','license','source']:
            if not isinstance(pack.get(key),str) or not pack[key].strip():raise ValueError('Missing pack '+key)
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{0,31}',pack['id']) or pack['id'] in pack_ids or pack['id'] in ['constructor','prototype','__proto__','then']:raise ValueError('Duplicate or invalid pack id: '+pack['id'])
        if not isinstance(pack.get('sounds'),list):raise ValueError('Each pack needs a sounds list')
        pack_ids.add(pack['id']);packs.append({k:pack[k] for k in ['id','title','license','source']})
        for entry in pack['sounds']:
            if not isinstance(entry,dict) or not isinstance(entry.get('files'),list):raise ValueError('Each sound needs a files list')
            if not isinstance(entry.get('title',entry.get('id')),str) or not isinstance(entry.get('category','other'),str):raise ValueError('Sound titles and categories must be text')
            name=entry['id']
            if not isinstance(name,str) or not name or len(name)>32 or not name[0].isalpha() or not all(c.isascii() and (c.isalnum() or c in '_-') for c in name) or name in ids or name in ['constructor','prototype','__proto__','then']:raise ValueError('Duplicate or invalid sound name: '+str(name))
            ids.add(name);files=[]
            for filename in entry['files']:
                if not isinstance(filename,str):raise ValueError('Sample filenames must be text')
                file=manifest.parent/filename
                relative=file.relative_to(manifest.parent)
                if any(part.startswith('.') for part in relative.parts) or any(part.is_symlink() for part in [file,*file.parents[:len(relative.parts)-1]]):raise ValueError('Hidden paths and symbolic links cannot be indexed')
                if file.is_symlink() or not file.resolve().is_relative_to(manifest.parent.resolve()) or file.suffix.lower() not in FORMATS:raise ValueError('Invalid sample path: '+str(filename))
                if not re.fullmatch(r'[A-Za-z0-9_ /.-]+', file.relative_to(ROOT).as_posix()) or '..' in file.relative_to(ROOT).as_posix():raise ValueError('Use simple sample filenames with letters, numbers, spaces, dots, underscores or hyphens')
                data=file.read_bytes()
                if not data or len(data)>8*1024*1024:raise ValueError('Each shared sample must be between 1 byte and 8 MiB')
                item={'url':file.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'type':FORMATS[file.suffix.lower()]}
                if file.suffix.lower()=='.wav':
                    with wave.open(str(file),'rb') as f:item['seconds']=round(f.getnframes()/f.getframerate(),4)
                files.append(item)
            if not files or len(files)>16:raise ValueError('Each sound needs 1–16 samples')
            sounds.append({'id':name,'title':entry.get('title',name),'category':entry.get('category','other'),'pack':pack['id'],'files':files})
    if len(sounds)>512:raise ValueError('The shared index supports up to 512 sounds')
    result={'format':'portfolios-sounds','version':1,'packs':packs,'sounds':sounds}
    encoded=json.dumps(result,indent=2)+'\n'
    if len(encoded.encode('utf-8'))>1024*1024:raise ValueError('Sound index exceeds 1 MiB; split the library before publishing')
    SOUNDS.mkdir(parents=True,exist_ok=True);(SOUNDS/'catalog.json').write_text(encoded,encoding='utf-8')
    print(f'Indexed {len(sounds)} sounds in {len(packs)} packs ({sum(f["bytes"] for s in sounds for f in s["files"]):,} bytes).')

if __name__=='__main__':
    cli=argparse.ArgumentParser(description=__doc__);cli.add_argument('--starter-kit',action='store_true');args=cli.parse_args()
    if args.starter_kit:starter()
    index()
