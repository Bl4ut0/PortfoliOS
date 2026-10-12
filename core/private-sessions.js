/** One live Google workspace, with a confirmed-save handoff. Credentials stay in memory. */
(function () {
    const session = {
        id: crypto.randomUUID(), epoch: 0, ready: false, owner: null, owned: false, busy: false, timer: null,
        required() { return window.isPrivateUser?.() && window.getSavedPrivateProfile?.()?.source === 'google'; },
        async ensureTabIdentity() {
            if(this.tabIdentity)return this.tabIdentity;
            if(!navigator.locks)throw new Error('This browser needs Web Locks for a safe private workspace.');
            this.tabIdentity=(async()=>{
                const saved=sessionStorage.getItem('portfolios:session-id');
                if(/^[a-f0-9-]{36}$/.test(saved || ''))this.id=saved;
                const acquire=()=>new Promise((resolve,reject)=>{
                    this.tabLock=navigator.locks.request('portfolios:session-tab:'+this.id,{ifAvailable:true},lock=>{
                        resolve(!!lock);
                        return lock ? new Promise(done=>{this.releaseTabLock=done;}) : undefined;
                    }).catch(reject);
                });
                for(let attempt=0;attempt<2;attempt++) {
                    let acquired=await acquire();
                    // A refreshing document can briefly retain its Web Lock. Give that
                    // same saved identity time to settle before treating it as a clone.
                    for(let wait=0;!acquired && saved===this.id && wait<24;wait++){
                        await new Promise(resolve=>setTimeout(resolve,50));
                        acquired=await acquire();
                    }
                    if(acquired){sessionStorage.setItem('portfolios:session-id',this.id);return;}
                    this.id=crypto.randomUUID();
                }
                throw new Error('A unique workspace tab could not be opened.');
            })();
            return this.tabIdentity;
        },
        async request(action, body = {}) {
            const token=window.GDriveSync?.getToken();
            if (!token) throw new Error('Reconnect Google to verify your active workspace. Local files are retained.');
            const response=await fetch('/core/private-session.php?action='+action, {
                method:'POST', cache:'no-store', signal:AbortSignal.timeout(25000),
                headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','X-PortfoliOS-Session':this.id,'X-PortfoliOS-Epoch':String(this.epoch)},
                body:JSON.stringify(body)
            });
            const value=await response.json();
            if (!response.ok) {const error=new Error(value.error || 'Session coordination is unavailable.');error.status=response.status;throw error;}
            return value;
        },
        show(message, actions = []) {
            this.hide();
            const node=document.createElement('section'); node.id='session-transfer-overlay'; node.className='session-chooser';
            node.dataset.experience=document.body.dataset.view==='mobile'?'mobile':'desktop';
            node.setAttribute('role','dialog'); node.setAttribute('aria-modal','true');
            node.setAttribute('aria-label','Private workspace session');
            const panel=document.createElement('div'); panel.className='session-chooser-panel';
            const title=document.createElement('h1'); title.textContent='Private workspace'; panel.append(title);
            const text=document.createElement('p'); text.textContent=message; text.setAttribute('role','status'); panel.append(text);
            for(const [label,callback] of actions) {const button=document.createElement('button');button.className='session-public-action';button.textContent=label;button.onclick=()=>callback().catch(error=>{text.textContent=error.message;});panel.append(button);}
            node.append(panel);
            const host=node.dataset.experience==='mobile' ? document.getElementById('mobile-device') || document.body : document.body;
            this.inerted=Array.from(host.children).map(child=>[child,child.inert]);this.inerted.forEach(([child])=>child.inert=true);
            host.append(node);panel.querySelector('button')?.focus();
            return text;
        },
        hide() { document.getElementById('session-transfer-overlay')?.remove();this.inerted?.forEach(([node,value])=>node.inert=value);this.inerted=null; },
        adopt(value) {this.epoch=value.epoch;this.owner=window.state.currentUserId;this.owned=true;this.ready=false;this.verifiedAt=Date.now();this.start();},
        start() {clearInterval(this.timer);this.timer=setInterval(()=>this.tick(),15000);},
        async assert() {
            if(!this.required())return;
            if(!this.owned || this.owner!==window.state.currentUserId)throw new Error('Open this account through the sign-in screen before syncing.');
            if(Date.now()-(this.verifiedAt || 0)<10000)return;
            const value=await this.request('assert');
            if(!value.owned || value.epoch!==this.epoch) {this.owned=false;throw new Error('The private workspace moved to another session. Local changes are retained.');}
            this.verifiedAt=Date.now();return value;
        },
        async drive(url, options) {
            if(!this.required())return fetch(url,options);
            await this.assert();
            const target=new URL(url);
            const response=await fetch('/core/private-session.php?action=drive', {
                ...options, method:'POST', cache:'no-store', signal:AbortSignal.timeout(75000),
                headers:{'Authorization':'Bearer '+GDriveSync.getToken(),'Content-Type':options.headers?.['Content-Type'] || 'application/octet-stream',
                    'X-PortfoliOS-Session':this.id,'X-PortfoliOS-Epoch':String(this.epoch),
                    'X-Drive-Method':options.method,'X-Drive-Path':target.pathname+target.search,
                    ...(options.headers?.['Content-Range'] ? {'Content-Range':options.headers['Content-Range']} : {}),
                    ...(options.headers?.['X-Upload-Content-Type'] ? {'X-Upload-Content-Type':options.headers['X-Upload-Content-Type'],'X-Upload-Content-Length':options.headers['X-Upload-Content-Length']} : {})}
            });
            if(response.status===409){this.verifiedAt=0;this.owned=false;this.lock('This account is now active elsewhere. Your local files are retained.');}
            return response;
        },
        async upload(metadata,blob,fileId=null) {
            const url='https://www.googleapis.com/upload/drive/v3/files'+(fileId?'/'+encodeURIComponent(fileId):'')+'?uploadType=resumable&fields=id,version';
            const started=await this.drive(url,{method:fileId?'PATCH':'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':blob.type || 'application/octet-stream','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify(metadata)});
            if(!started.ok)throw new Error('Resumable upload could not start ('+started.status+').');
            const location=started.headers.get('X-Drive-Upload-Location');
            if(!location || !location.startsWith('https://www.googleapis.com/upload/drive/v3/files'))throw new Error('Drive did not return a safe upload session.');
            const chunkSize=4*1024*1024;
            for(let offset=0;offset<blob.size;offset+=chunkSize){
                const end=Math.min(offset+chunkSize,blob.size);
                const response=await this.drive(location,{method:'PUT',headers:{'Content-Type':blob.type || 'application/octet-stream','Content-Range':'bytes '+offset+'-'+(end-1)+'/'+blob.size},body:blob.slice(offset,end)});
                if(end<blob.size){if(response.status!==308)throw new Error('Drive chunk was not acknowledged ('+response.status+').');}
                else {if(!response.ok)throw new Error('Drive upload did not finish ('+response.status+').');return response.json();}
            }
            throw new Error('Empty files use the normal upload path.');
        },
        async enter() {
            if(!this.required())return;
            await this.pendingLocalSave;await this.ensureTabIdentity();
            if(this.owned && this.ready && this.owner===window.state.currentUserId){await this.assert();return;}
            let value=await this.request('claim');
            if(!value.owned) value=await this.chooseTakeover();
            this.adopt(value);
            const text=this.show('Restoring your private workspace and checking recovery changes…');
            try {
                await window.savePreferencesToFilesystem?.({strict:true});
                await GDriveSync.sync((done,total,path)=>{text.textContent='Preparing workspace: '+path;});
                await window.loadPreferencesFromFilesystem?.();
                this.ready=true;this.hide();
            } catch(error) {this.ready=false;this.hide();throw error;}
        },
        chooseTakeover() {
            return new Promise((resolve,reject)=>{
                let polling=null, settled=false;
                const finish=(value,error)=>{if(settled)return;settled=true;clearInterval(polling);this.hide();error?reject(error):resolve(value);};
                const poll=async()=>{try{const value=await this.request('request');if(value.owned)finish(value);}catch(error){text.textContent=error.message;}};
                const text=this.show('This account is active in another session. Request a handoff to save and sync that workspace first.',[
                    ['Save other session & take over',async()=>{await poll();if(!settled){text.textContent='Waiting for the other session to save and finish Drive sync. Keep this screen open.';polling ||= setInterval(poll,3000);}}],
                    ['Other device unavailable…',async()=>{this.show('Force takeover cannot save unreachable work. Its local changes remain on that device and will be recovered when it next connects and acquires a session.',[
                        ['Force takeover and preserve recovery',async()=>finish(await this.request('force'))],
                        ['Cancel',async()=>{const value=await this.request('cancel');if(value.owned){this.epoch=value.epoch;await this.request('release');}finish(null,new Error('Takeover cancelled.'));}]
                    ]);}],
                    ['Cancel',async()=>{const value=await this.request('cancel');if(value.owned){this.epoch=value.epoch;await this.request('release');}finish(null,new Error('Takeover cancelled.'));}]
                ]);
            });
        },
        async tick() {
            if(this.busy || !this.owned || this.owner!==window.state?.currentUserId)return;
            this.busy=true;
            try {
                const value=await this.request('renew');this.verifiedAt=Date.now();
                if(!value.owned || value.epoch!==this.epoch){this.owned=false;this.lock('This private workspace moved to another session. Local changes are retained for recovery.');return;}
                if(value.handoffRequested && !this.handoffPaused && !GDriveSync.syncInProgress)await this.handoff();
            } catch(error) {this.owned=false;this.lock(error.message);}
            finally {this.busy=false;}
        },
        async handoff() {
            this.handoffPaused=false;window.state.sessionChosen=false;
            const text=this.show('Another device requested this workspace. Saving apps and syncing before handoff…');
            clearTimeout(GDriveSync.pendingSyncTimer);
            try {
                await window.MobileOS?.flushForHandoff?.();
                await window.prepareProfileSwitch({autoSave:true});
                await window.savePreferencesToFilesystem?.({strict:true});
                await GDriveSync.sync((done,total,path)=>{text.textContent='Saving before handoff: '+path;});
                await this.request('release',{snapshot:window.WorkspaceRecovery?.lastSnapshot || null,synced:true});
                this.owned=false;clearInterval(this.timer);this.lock('Your workspace was saved to Drive and handed to the other session.');
            } catch(error) {
                this.handoffPaused=true;
                this.show('Handoff paused: '+error.message+' The other session cannot enter until saving succeeds or it explicitly forces takeover.',[
                    ['Retry save and handoff',async()=>this.handoff()],
                    ['Return to sign-in',async()=>this.lock('Local work is retained. Reconnect this account to retry saving.')]
                ]);
                // Keep the lease alive; the pending requester must not assume success.
                this.start();
            }
        },
        async flushLocal() {
            if(this.owner!==window.state.currentUserId)return;
            await window.flushDesktopLayout?.();await window.AppIcons?.flush();
            await window.MobileOS?.flushForHandoff?.();
            for(const id of Array.from(window.state.openApps || [])) {
                const allowed=await window.runAppLifecycleHook?.(id,'beforeClose',window.getDesktopWindowElement?.(id),{rethrow:true,reason:'session-lost',autoSave:true});
                if(allowed===false)throw new Error('Save '+id+' locally before reopening this account.');
            }
            await window.savePreferencesToFilesystem?.({strict:true});
        },
        lock(message) {
            clearInterval(this.timer);clearTimeout(window.GDriveSync?.pendingSyncTimer);
            window.state.sessionChosen=false;this.owned=false;this.ready=false;
            const save=async()=>{this.pendingLocalSave=this.flushLocal();await this.pendingLocalSave;};
            const text=this.show(message,[
                ['Retry local save',save],
                ['Choose account',async()=>{this.hide();window.closeSessionChooser?.();window.openSessionChooser?.();}]
            ]);
            this.pendingLocalSave=this.flushLocal();
            this.pendingLocalSave.catch(error=>{text.textContent=message+' Local save needs attention: '+error.message;});
        },
        async release({synced=false,allowOffline=false}={}) {
            if(this.owned){try{await this.request('release',{snapshot:window.WorkspaceRecovery?.lastSnapshot || null,synced});}catch(error){if(!allowOffline || synced || error.status===409)throw error;}}
            this.owned=false;clearInterval(this.timer);
        }
    };
    window.PrivateSessions=session;
    window.EventBus?.on('user:changed',()=>{if(session.owner && session.owner!==window.state.currentUserId){session.owned=false;session.ready=false;session.pendingLocalSave=null;session.handoffPaused=false;clearInterval(session.timer);}});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)session.tick();});
})();
