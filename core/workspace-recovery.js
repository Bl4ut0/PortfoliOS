/** Versioned Drive checkpoints and immutable session recovery deltas. */
(function () {
    const ledgerPath='/.portfolios-sync-state.json';
    const digest=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
    const blobOf=record=>record.data instanceof Blob?record.data:new Blob([record.data ?? ''],{type:record.type});
    const parent=path=>path.slice(0,path.lastIndexOf('/')) || '/';
    function decision(base, local, remote, deleted=false) {
        if(local===remote)return 'equal';
        if(local===null && remote!==null)return base===remote?'delete-remote':base===null?'download':'deletion-conflict';
        if(remote===null && local!==null)return deleted?'deleted-conflict':'upload';
        if(local===base)return 'download';
        if(remote===base)return 'upload';
        return 'conflict';
    }
    function mergeSettings(base={}, local={}, remote={}) {
        const out=Object.create(null), revisions=Object.create(null), conflicts=[];
        for(const key of new Set([...Object.keys(local),...Object.keys(remote)])) {
            if(key==='__portfoliosPreferenceRevisions')continue;
            const b=base[key],l=local[key],r=remote[key];
            let value;
            if(l===r)value=l;
            else if(l===b)value=r;
            else if(r===b)value=l;
            else if(l===undefined)value=r;
            else if(r===undefined)value=l;
            else {value=r;conflicts.push(key);}
            if(value!==undefined)out[key]=value;
            revisions[key]=Math.max(Number(local.__portfoliosPreferenceRevisions?.[key]) || 0,Number(remote.__portfoliosPreferenceRevisions?.[key]) || 0);
            if(value!==r || conflicts.includes(key))revisions[key]=Math.max(revisions[key],Date.now())+1;
        }
        out.__portfoliosPreferenceRevisions=revisions;
        return {settings:out,conflicts};
    }
    const recovery={
        decision,mergeSettings,lastSnapshot:null,lastReport:null,
        eligible(path,record,owner) {
            if(record?.metadata?.sync===false || path==='/' || path.split('/').some(part=>part.startsWith('.')))return false;
            if(['/apps','/ROMs','/etc','/Recovered Sessions'].some(root=>path===root || path.startsWith(root+'/')))return false;
            return path!=='/home' && (!path.startsWith('/home/') || path==='/home/'+owner || path.startsWith('/home/'+owner+'/'));
        },
        async postBlob(sync,folder,name,blob) {
            if(blob.size>4*1024*1024)return PrivateSessions.upload({name,parents:[folder]},blob);
            const boundary='portfolios_'+crypto.randomUUID();
            const body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify({name,parents:[folder]}),'\r\n--'+boundary+'\r\nContent-Type: application/octet-stream\r\n\r\n',blob,'\r\n--'+boundary+'--\r\n'],{type:'multipart/related; boundary='+boundary});
            const response=await PrivateSessions.drive('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{'Content-Type':body.type},body});
            if(!response.ok)throw new Error('Recovery snapshot upload failed ('+response.status+').');
            return response.json();
        },
        async snapshot(sync, records, baseline, owner, intents={}) {
            const changes=records.filter(record=>!record.isDirectory && baseline[record.path]?.hash!==record.hash);
            const current=new Set(records.map(record=>record.path));
            const deletions=Object.keys(intents).filter(path=>baseline[path]?.hash && !current.has(path));
            if(!changes.length && !deletions.length)return null;
            const root=await sync.getOrCreateSyncFolder(sync.getToken());
            let folder=await sync.findFolderByName(sync.getToken(),'Recovery Sessions',root);
            if(!folder)folder=await sync.createDriveFolder(sync.getToken(),'Recovery Sessions',root);
            const created=await sync.createDriveFolder(sync.getToken(),new Date().toISOString().replace(/[:.]/g,'-')+'-'+PrivateSessions.id,folder.id);
            const files=[];
            for(const record of changes){
                if(window.state.currentUserId!==owner)throw new Error('Profile changed during recovery snapshot.');
                const uploaded=await this.postBlob(sync,created.id,record.hash,blobOf(record));
                files.push({path:record.path,hash:record.hash,type:record.type,size:blobOf(record).size,fileId:uploaded.id});
            }
            // Upload manifest last: directories without a manifest are incomplete snapshots.
            const manifest={schema:1,session:PrivateSessions.id,epoch:PrivateSessions.epoch,createdAt:new Date().toISOString(),files,deletions,moves:deletions.flatMap(from=>files.filter(file=>file.hash===baseline[from]?.hash).map(file=>({from,to:file.path}))),base:baseline};
            await this.postBlob(sync,created.id,'snapshot.json',new Blob([JSON.stringify(manifest)],{type:'application/json'}));
            this.lastSnapshot=created.id;
            return created.id;
        },
        async preserve(record,snapshot,owner) {
            if(!record || record.isDirectory)return;
            const path='/Recovered Sessions/'+(snapshot || PrivateSessions.id)+record.path;
            if(window.state.currentUserId!==owner)throw new Error('Profile changed before conflict recovery.');
            const result=await SecurityKernel.importFile({path,name:record.name,parent:parent(path),data:blobOf(record),size:blobOf(record).size,type:record.type,source:'session-recovery',options:{metadata:{sync:false,kind:'session-conflict',originalPath:record.path}}});
            if(result.status!=='accepted')throw new Error('Conflicting file could not be retained safely.');
        },
        async listChildren(folder) {
            const files=[];let pageToken='';
            do {
                const params=new URLSearchParams({q:"'"+GDriveSync.escapeDriveQueryValue(folder)+"' in parents and trashed=false",fields:'nextPageToken,files(id,name,mimeType)',pageSize:'1000'});
                if(pageToken)params.set('pageToken',pageToken);
                const response=await fetch('https://www.googleapis.com/drive/v3/files?'+params,{headers:{Authorization:'Bearer '+GDriveSync.getToken()}});
                if(!response.ok)throw new Error('Recovery history could not be loaded.');
                const result=await response.json();files.push(...(result.files || []));pageToken=result.nextPageToken || '';
            }while(pageToken);
            return files;
        },
        async restoreCopy(record,blob,owner) {
            await PrivateSessions.assert();
            const choice=await SystemFS.showSaveDialog({title:'Restore recovery copy',folder:'/documents',defaultName:record.name || SystemFS.getName(record.path)});
            if(!choice)return;
            if(window.state.currentUserId!==owner)throw new Error('The account changed before recovery.');
            await PrivateSessions.assert();
            const existing=await SystemFS.readFile(choice.path);
            const result=await SecurityKernel.importFile({path:choice.path,name:choice.name,parent:choice.parent,data:blob,size:blob.size,type:record.type,source:'session-recovery',options:existing?{expectedRecord:existing}:{expectedAbsent:true}});
            if(result.status!=='accepted')throw new Error('Recovery copy failed inspection.');
        },
        async openReview() {
            const owner=window.state.currentUserId;
            if(!window.isPrivateUser?.(owner))throw new Error('Recovery belongs to a private workspace.');
            const dialog=document.createElement('dialog');dialog.className='systemfs-dialog';dialog.setAttribute('aria-label','Session recovery');dialog.dataset.recoveryOwner=owner;
            dialog.innerHTML='<header class="systemfs-dialog-header"><h2>Session recovery</h2><button type="button" data-close aria-label="Close">×</button></header><p>Conflicting copies stay separate. Restore a copy through Save As to choose its workspace location.</p><div class="systemfs-dialog-list" data-list></div><p data-status role="status"></p><footer class="systemfs-dialog-footer"><button type="button" data-drive>Load Drive recovery history</button><button type="button" data-close>Close</button></footer>';
            const list=dialog.querySelector('[data-list]'),status=dialog.querySelector('[data-status]');
            const add=(label,callback)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=async()=>{button.disabled=true;try{if(window.state.currentUserId!==owner)throw new Error('Account changed.');await callback();}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};list.append(button);};
            const close=()=>{dialog.close();dialog.remove();};
            dialog.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
            dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
            (document.body.dataset.view==='mobile' ? document.getElementById('mobile-device') || document.body : document.body).append(dialog);dialog.showModal();
            const local=(await SystemFS.getAllFiles()).filter(record=>record.metadata?.kind==='session-conflict' && !record.isDirectory);
            for(const record of local)add('Local copy: '+(record.metadata.originalPath || record.path),()=>this.restoreCopy(record,blobOf(record),owner));
            if(!local.length)status.textContent='No conflicting local copies on this device.';
            dialog.querySelector('[data-drive]').onclick=async event=>{
                const button=event.currentTarget;button.disabled=true;
                try {
                    await PrivateSessions.assert();
                    const root=await GDriveSync.getOrCreateSyncFolder(GDriveSync.getToken());
                    const folder=await GDriveSync.findFolderByName(GDriveSync.getToken(),'Recovery Sessions',root);
                    if(!folder){status.textContent='No Drive recovery snapshots yet.';return;}
                    const snapshots=(await this.listChildren(folder.id)).filter(file=>file.mimeType==='application/vnd.google-apps.folder').sort((a,b)=>b.name.localeCompare(a.name)).slice(0,50);
                    for(const snapshot of snapshots)add('Drive snapshot: '+snapshot.name,async()=>{
                        const manifestFile=(await this.listChildren(snapshot.id)).find(file=>file.name==='snapshot.json');
                        if(!manifestFile)throw new Error('This snapshot did not complete; it will not be restored.');
                        const manifest=JSON.parse(await (await GDriveSync.downloadFile(manifestFile.id)).text());
                        if(manifest.schema!==1 || !Array.isArray(manifest.files))throw new Error('Unsupported recovery snapshot.');
                        for(const file of manifest.files){
                            if(!this.eligible(file.path,null,owner) || SystemFS.normalizePath(file.path)!==file.path || !/^[a-f0-9]{64}$/.test(file.hash) || !/^[A-Za-z0-9_-]+$/.test(file.fileId))throw new Error('Invalid recovery entry.');
                            add('Restore '+file.path,async()=>{
                                const blob=await GDriveSync.downloadFile(file.fileId);
                                if(await digest(blob)!==file.hash)throw new Error('Recovery content does not match its saved hash.');
                                await this.restoreCopy(file,blob,owner);
                            });
                        }
                        status.textContent=manifest.files.length+' saved file(s); '+(manifest.deletions?.length || 0)+' recorded deletion(s). Deletions are not applied by recovery.';
                    });
                    status.textContent='Showing the newest '+snapshots.length+' snapshot(s). Nothing is deleted automatically.';
                }catch(error){status.textContent=error.message;button.disabled=false;}
            };
        },
        async sync(sync,onProgress) {
            const owner=window.state.currentUserId, scope=sync.getCurrentSyncScope();
            const baseKey='portfolios:recovery-base:'+owner;
            let previous;try{previous=JSON.parse(localStorage.getItem(baseKey) || '{}');}catch{throw new Error('Local sync history is unreadable. Local files were retained.');}
            const baseline=previous.files || {}, remoteFiles=await sync.fetchRemoteFiles();
            const remoteMap=new Map();
            for(const record of remoteFiles){const path=record.appProperties.path;if(remoteMap.has(path))throw new Error('Drive contains duplicate entries for '+path+'. Resolve duplicates before syncing.');remoteMap.set(path,record);}
            let ledger={schema:1,files:{}};
            const ledgerRecord=remoteMap.get(ledgerPath);
            if(ledgerRecord){ledger=JSON.parse(await (await sync.downloadFile(ledgerRecord.id)).text());if(ledger.schema!==1 || !ledger.files || typeof ledger.files!=='object')throw new Error('Unsupported cloud checkpoint.');}
            const records=[];
            for(const original of await SystemFS.getAllFiles()) {
                if(!this.eligible(original.path,original,owner))continue;
                if(original.isDirectory){records.push({...original,hash:'directory'});continue;}
                const checked=await SecurityKernel.scanExisting(original,'cloud-upload');
                if(checked.status!=='accepted')throw new Error('Backup blocked for '+original.path+'.');
                const record=checked.record,blob=blobOf(record);
                if(blob.size>256*1024*1024)throw new Error('Recovery upload limit is 256 MiB per file: '+record.path);
                records.push({...record,hash:original.revision && original.revision===baseline[record.path]?.localRevision ? baseline[record.path].hash : await digest(blob)});
            }
            // Durable immutable delta before the first destructive reconciliation step.
            const intentRecord=await SystemFS.readFile('/.sync-deletions.json');
            const intents=intentRecord?.data ? JSON.parse(await window.readFilesystemRecordText(intentRecord)) : {};
            const snapshot=await this.snapshot(sync,records,baseline,owner,intents);
            const localMap=new Map(records.map(record=>[record.path,record]));
            const next=Object.assign(Object.create(null),ledger.files),report={snapshot,conflicts:[],deletions:[]};
            this.lastSnapshot=snapshot || previous.snapshot || ledger.snapshot || null;
            const paths=[...new Set([...localMap.keys(),...remoteMap.keys(),...Object.keys(baseline),...Object.keys(ledger.files)])].filter(path=>this.eligible(path,localMap.get(path),owner)).sort();
            let processed=0;
            for(const path of paths) {
                await PrivateSessions.assert();
                if(window.state.currentUserId!==owner)throw new Error('Profile changed during sync.');
                onProgress?.(processed++,paths.length,path);
                const local=localMap.get(path), remote=remoteMap.get(path),base=baseline[path]?.hash || null;
                if(!local && !remote){if(intents[path] && intents[path].revision===baseline[path]?.localRevision)next[path]={hash:null,deleted:true};continue;}
                if(local?.isDirectory || remote?.mimeType==='application/vnd.google-apps.folder'){
                    if(local && remote && !local.isDirectory)throw new Error('File/folder type conflict at '+path+'. Local snapshot retained.');
                    if(local && remote && remote.mimeType!=='application/vnd.google-apps.folder')throw new Error('File/folder type conflict at '+path+'. Local snapshot retained.');
                    if(!remote)await sync.createRemoteFolder(path,local.name);
                    if(!local)await SystemFS.ensureDirectory(path,{silent:true});
                    next[path]={hash:'directory'};continue;
                }
                let remoteBlob=null,remoteHash=null;
                if(remote){
                    if(remote.version && ledger.files[path]?.remoteVersion===remote.version)remoteHash=ledger.files[path].hash;
                    else {remoteBlob=await sync.downloadFile(remote.id);remoteHash=await digest(remoteBlob);}
                }
                const localHash=local?.hash || null;
                let action=decision(base,localHash,remoteHash,ledger.files[path]?.deleted===true && !baseline[path]?.deleted);
                if(action==='deleted-conflict' && localHash===base)action='delete-local';
                if(action==='delete-remote' && (!intents[path] || intents[path].revision!==baseline[path]?.localRevision))action='download';
                if(path==='/home/'+owner+'/settings.json' && local && remote && localHash!==remoteHash){
                    remoteBlob ||= await sync.downloadFile(remote.id);
                    const l=JSON.parse(await blobOf(local).text()),r=JSON.parse(await remoteBlob.text());
                    const merged=mergeSettings(baseline[path]?.settings || {},l,r);
                    if(merged.conflicts.length){await this.preserve(local,snapshot,owner);report.conflicts.push({path,preferences:merged.conflicts});}
                    const blob=new Blob([JSON.stringify(merged.settings,null,2)],{type:'application/json'});
                    const result=await SecurityKernel.importFile({path,name:local.name,parent:parent(path),data:blob,size:blob.size,type:'application/json',source:'cloud-settings-merge',options:{expectedRecord:local,silent:true}});
                    if(result.status!=='accepted')throw new Error('Merged preferences failed inspection.');
                    const uploaded=await sync.updateFile(remote.id,'application/json',blob);
                    for(const [key,value] of Object.entries(merged.settings)){
                        if(!window.WorkspaceSessions?.ownsPreference(key,owner) || (value!==null && typeof value!=='string'))continue;
                        if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);
                        WorkspaceSessions.adoptRevision(key,merged.settings.__portfoliosPreferenceRevisions[key]);
                    }
                    next[path]={hash:await digest(blob),settings:merged.settings,localRevision:result.record.revision,remoteVersion:uploaded.version};continue;
                }
                if(action==='conflict' || action==='deleted-conflict'){
                    await this.preserve(local,snapshot,owner);report.conflicts.push({path,kind:action});
                    action=remote?'download':'delete-local';
                }
                if(action==='deletion-conflict') {report.conflicts.push({path,kind:'deletion-versus-edit'});action='download';}
                if(action==='delete-local'){
                    await SystemFS.deleteFile(path,{expectedRecord:local,trackSyncDeletion:false});next[path]={hash:null,deleted:true};continue;
                }
                if(action==='delete-remote'){
                    await sync.deleteFile(remote.id);next[path]={hash:null,deleted:true};report.deletions.push(path);continue;
                }
                if(action==='upload'){
                    const uploaded=remote ? await sync.updateFile(remote.id,local.type,blobOf(local)) : await sync.uploadFile(path,local.name,local.type,blobOf(local));
                    next[path]={hash:localHash,localRevision:local?.revision,remoteVersion:uploaded.version};
                } else if(action==='download'){
                    remoteBlob ||= await sync.downloadFile(remote.id);
                    const current=await SystemFS.readFile(path);
                    if((local?.revision || null)!==(current?.revision || null))throw new Error('Local file changed while syncing '+path+'. Retry to retain the latest version.');
                    const result=await SecurityKernel.importFile({path,name:remote.name,parent:parent(path),data:remoteBlob,size:remoteBlob.size,type:remote.mimeType,source:'cloud-download',options:local?{expectedRecord:local}: {expectedAbsent:true}});
                    if(result.status!=='accepted')throw new Error('Cloud file failed inspection: '+path);
                    next[path]={hash:remoteHash,localRevision:result.record.revision,remoteVersion:remote.version};
                } else next[path]={hash:localHash,localRevision:local?.revision,remoteVersion:remote?.version};
                if(path==='/home/'+owner+'/settings.json' && next[path]?.hash){
                    const settingsBlob=action==='download'?remoteBlob:blobOf(local);next[path].settings=JSON.parse(await settingsBlob.text());
                }
            }
            await PrivateSessions.assert();
            const checkpoint={schema:1,session:PrivateSessions.id,epoch:PrivateSessions.epoch,updatedAt:new Date().toISOString(),snapshot:this.lastSnapshot,files:next};
            const blob=new Blob([JSON.stringify(checkpoint)],{type:'application/json'});
            if(ledgerRecord)await sync.updateFile(ledgerRecord.id,'application/json',blob);
            else await sync.uploadFile(ledgerPath,'portfolios-sync-state.json','application/json',blob);
            localStorage.setItem(baseKey,JSON.stringify(checkpoint));
            window.Storage?.local.set(sync.getScopedStorageKey('sync_manifest',scope),JSON.stringify(Object.keys(next).filter(path=>!next[path].deleted)));
            window.Storage?.local.set(sync.getScopedStorageKey('last_sync_time',scope),String(Date.now()));
            this.lastReport=report;
            await window.loadPreferencesFromFilesystem?.();window.EventBus?.emit('fs:changed',{action:'sync',paths:Object.keys(next)});
            window.EventBus?.emit('preferences:external',{userId:owner});
            if(report.conflicts.length)window.showDesktopToast?.(report.conflicts.length+' conflict(s) preserved in Recovered Sessions.');
            onProgress?.(paths.length,paths.length,'Complete');return report;
        }
    };
    window.EventBus?.on('user:changed',()=>document.querySelectorAll('dialog[data-recovery-owner]').forEach(dialog=>{dialog.close();dialog.remove();}));
    window.WorkspaceRecovery=recovery;
})();
