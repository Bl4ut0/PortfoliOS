/** Profile-scoped, passive app artwork. No app engines or external requests. */
(() => {
    const path = '/Pictures/Icon Packs/active.json';
    const maxPackBytes = 8 * 1024 * 1024;
    const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
    let icons = Object.create(null), owner = null, revision = 0, queue = Promise.resolve();
    const esc = value => window.escapeHtml(String(value));
    const builtinIds = new Set('codex profile dossier browser network linux cli local-ai store files security-center office taskmgr webamp musicmini iptv settings romplayer openrct2 ut99 documents music calculator devhub status homelab automation addons guildcraft survival-ai wardenit media flappybird pki'.split(' '));
    const catalogs = () => [...(window.desktopApps || []), ...(window.mobileAppCatalog || []), ...(window.storeApps || []), ...(window.systems || [])];
    function refresh() {
        document.querySelectorAll('[data-app-icon]').forEach(el => {
            el.outerHTML = window.getAppIconHtml(el.dataset.defaultIcon, el.dataset.iconExtra, el.dataset.appIcon);
        });
        window.EventBus?.emit('icons:changed', { owner });
    }
    function validate(pack) {
        if (!pack || pack.format !== 'portfolios-icon-pack' || pack.version !== 1 || !pack.icons || typeof pack.icons !== 'object' || Array.isArray(pack.icons)) throw new Error('Choose a PortfoliOS icon pack (version 1).');
        const entries = Object.entries(pack.icons);
        if (entries.length > 64) throw new Error('An icon pack can contain up to 64 icons.');
        const result = Object.create(null);
        for (const [id, value] of entries) {
            if (!idPattern.test(id) || typeof value !== 'string' || value.length > 130000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Pack icons must be bounded PNG images with app IDs.');
            const bytes = atob(value.slice(value.indexOf(',') + 1));
            if (!bytes.startsWith('\x89PNG\r\n\x1a\n')) throw new Error('Invalid PNG icon.');
            result[id] = value;
        }
        return result;
    }
    async function load() {
        const mine = ++revision, profile = window.state?.currentUserId;
        if (owner !== profile) { icons = Object.create(null); owner = profile; refresh(); }
        try {
            const record = await window.SystemFS.readFile(path);
            window.SystemFS.assertProfile(profile);
            if (mine !== revision) return;
            if (record && record.size <= maxPackBytes) {
                const text = typeof record.data === 'string' ? record.data : await new Blob([record.data]).text();
                window.SystemFS.assertProfile(profile);
                if (mine !== revision) return;
                icons = validate(JSON.parse(text)); refresh();
            } else { icons = Object.create(null); refresh(); }
        } catch (error) {
            if (profile === window.state?.currentUserId && mine === revision) console.warn('App icons: using defaults.', error.message);
        }
    }
    async function normalize(blob) {
        if (!(blob instanceof Blob) || blob.size > 2 * 1024 * 1024 || !['image/png','image/jpeg','image/webp'].includes(blob.type)) throw new Error('Choose a PNG, JPEG or WebP image up to 2 MB.');
        const scan = await window.SecurityKernel.inspect({name:'icon.png',type:blob.type,data:blob,size:blob.size,source:'local-import'});
        if (scan.result.verdict !== 'clean') throw new Error('This image was rejected by file protection.');
        const bitmap = await createImageBitmap(blob);
        try {
            if (bitmap.width > 4096 || bitmap.height > 4096 || !bitmap.width || !bitmap.height) throw new Error('Icons must be no larger than 4096 pixels per side.');
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
            const scale = Math.min(128 / bitmap.width, 128 / bitmap.height);
            canvas.getContext('2d').drawImage(bitmap, (128-bitmap.width*scale)/2, (128-bitmap.height*scale)/2, bitmap.width*scale, bitmap.height*scale);
            return canvas.toDataURL('image/png');
        } finally { bitmap.close(); }
    }
    function mutate(operation) {
        const profile = window.state?.currentUserId;
        const job = queue.catch(() => {}).then(async () => {
            window.SystemFS.assertProfile(profile);
            const record = await window.SystemFS.readFile(path); window.SystemFS.assertProfile(profile);
            if (record?.size > maxPackBytes) throw new Error('Stored icon pack is too large; remove it from Pictures/Icon Packs.');
            const current = record ? validate(JSON.parse(typeof record.data === 'string' ? record.data : await new Blob([record.data]).text())) : Object.create(null);
            window.SystemFS.assertProfile(profile);
            const next = await operation(current); window.SystemFS.assertProfile(profile);
            const text = JSON.stringify({ format:'portfolios-icon-pack', version:1, icons:next });
            if (new Blob([text]).size > maxPackBytes) throw new Error('Icon pack is too large.');
            const imported = await window.SecurityKernel.importFile({path,name:'active.json',parent:'/Pictures/Icon Packs',data:text,size:new Blob([text]).size,type:'application/json'});
            if (imported.status !== 'accepted') throw new Error('Icon pack was quarantined by file protection.');
            window.SystemFS.assertProfile(profile);
            await load();
        });
        queue = job; return job;
    }
    const api = window.AppIcons = {
        resolve(id, fallback) {
            if (owner === window.state?.currentUserId && Object.hasOwn(icons,id)) return icons[id];
            const upstream = {duke32:'duke3d-icon.png',diablo:'diablo-icon.png',quake:'quake-icon.png',doomsource:'doom-icon.png',vscode:'apps/vscode/icon.png'};
            if (upstream[id]) return upstream[id];
            if (/^(pdf|photo|vector|light|design|film|effect)craft$/.test(id)) return `apps/${id}/icon.svg`;
            // Existing upstream logos take precedence over project fallback artwork.
            if (fallback && /\.(png|svg|webp|jpe?g)([?#]|$)/i.test(fallback)) return fallback;
            if (['openrct2','webamp'].includes(id)) return `core/icons/upstream/${id}.png`;
            return builtinIds.has(id) ? `core/icons/${id}.svg` : (catalogs().some(app=>app.id===id) ? "core/icons/application.svg" : fallback);
        },
        load,
        async set(id, file) {
            if (!idPattern.test(id) || !catalogs().some(app => app.id === id)) throw new Error('Choose an available app.');
            return mutate(async current => { current[id] = await normalize(file); return current; });
        },
        reset(id) { return mutate(current => { if (id) delete current[id]; else current = Object.create(null); return current; }); },
        async importPack(file) {
            if (!(file instanceof Blob) || file.size > maxPackBytes) throw new Error('Choose a pack up to 8 MB.');
            // Capture owner before any File or bitmap await through the mutation queue.
            return mutate(async () => {
                const input = validate(JSON.parse(await file.text())), output = Object.create(null);
                for (const [id, value] of Object.entries(input)) {
                    const bytes = Uint8Array.from(atob(value.split(',')[1]), c => c.charCodeAt(0));
                    output[id] = await normalize(new Blob([bytes], {type:'image/png'}));
                }
                return output;
            });
        },
        exportPack() {
            return new Blob([JSON.stringify({format:'portfolios-icon-pack',version:1,icons:owner === window.state?.currentUserId ? icons : {}},null,2)],{type:'application/json'});
        },
        flush() { return queue.catch(() => {}); },
        mount(parent) {
            if (!parent || parent.querySelector('[data-icon-settings]')) return;
            const apps = [...new Map(catalogs().map(app => [app.id, app])).values()].sort((a,b)=>a.title.localeCompare(b.title));
            const panel = document.createElement('section'); panel.className = 'app-icon-settings'; panel.dataset.iconSettings = '';
            panel.innerHTML = `<h3>App icons</h3><p>Use a custom image for an app, or import a PortfoliOS icon pack. Shared by Desktop and Mobile in this profile.</p>
                <div data-icon-preview aria-hidden="true"></div><label>Application<select data-icon-app>${apps.map(app=>`<option value="${esc(app.id)}">${esc(app.title)}</option>`).join('')}</select></label>
                <label>Custom icon<input data-icon-file type="file" accept="image/png,image/jpeg,image/webp"></label>
                <div class="app-icon-actions"><button type="button" data-icon-reset>Reset app icon</button><button type="button" data-icon-reset-all>Use default icons</button></div>
                <label>Import icon pack<input data-icon-pack type="file" accept="application/json,.json"></label>
                <button type="button" data-icon-export>Export icon pack</button><p role="status" data-icon-status>PNG, JPEG or WebP; up to 2 MB per image. Packs use app IDs.</p>`;
            const status = panel.querySelector('[data-icon-status]');
            const preview = () => {const app=apps.find(a=>a.id===panel.querySelector('[data-icon-app]').value);panel.querySelector('[data-icon-preview]').innerHTML=window.getAppIconHtml(app?.icon, '', app?.id);};
            preview();
            let busy = false;
            async function run(fn) {
                if (busy) return; busy = true;
                panel.querySelectorAll('input,button,select').forEach(el=>el.disabled=true);
                try { await fn(); status.textContent = 'Icons updated for this profile.'; }
                catch (error) { status.textContent = error.message; }
                finally { busy=false;panel.querySelectorAll('input,button,select').forEach(el=>el.disabled=false); }
            }
            panel.addEventListener('change', event => {
                const input=event.target; if (input.matches('[data-icon-app]')) { preview(); return; }
                const file=input.files?.[0]; if (!file) return;
                const id=panel.querySelector('[data-icon-app]').value;
                if (input.matches('[data-icon-file]')) run(()=>api.set(id,file));
                if (input.matches('[data-icon-pack]')) run(()=>api.importPack(file));
                input.value='';
            });
            panel.addEventListener('click', event => {
                if (event.target.closest('[data-icon-reset]')) run(()=>api.reset(panel.querySelector('[data-icon-app]').value));
                if (event.target.closest('[data-icon-reset-all]')) run(()=>api.reset());
                if (event.target.closest('[data-icon-export]')) {
                    const url=URL.createObjectURL(api.exportPack()), a=document.createElement('a');a.href=url;a.download='portfolios-icons.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
                }
            });
            parent.append(panel);
        }
    };
    window.EventBus.on('user:changed', () => { load(); });
    window.EventBus.on('fs:ready', () => { load(); });
    window.EventBus.on('fs:changed', event => { if(event.path===path || event.action==='sync') load(); });
})();
