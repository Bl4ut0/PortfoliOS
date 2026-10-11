/**
 * PortfoliOS: Desktop Icons and Grid Layout
 * Renders the desktop shortcut icons on a snapping grid and handles icon drag-and-drop.
 */

window.getDesktopLauncher = (id) => {
    const system = window.systemById ? window.systemById(id) : null;
    if (system) {
        return {
            id: system.id,
            title: system.title,
            icon: system.icon,
            color: system.color,
            launchApp: system.launchApp || "dossier",
            selectId: system.id
        };
    }

    const app = window.appById ? window.appById(id) : null;
    if (!app) return null;
    return {
        id: app.id,
        title: app.title,
        icon: app.icon,
        color: app.id === "linux" ? "#34d399" : (app.id === "store" ? "#a78bfa" : "#22d3ee"),
        launchApp: app.id,
        selectId: ""
    };
};

window.findFreeGridCell = (occupied, maxRows) => {
    let col = 0;
    let row = 0;
    while (occupied.has(`${col},${row}`)) {
        row++;
        if (row >= maxRows) {
            row = 0;
            col++;
        }
    }
    return { col, row };
};

window.findNearestFreeCell = (targetCol, targetRow, occupied, maxRows, maxCols) => {
    let minDistance = Infinity;
    let bestCell = { col: targetCol, row: targetRow };
    for (let c = 0; c < maxCols; c++) {
        for (let r = 0; r < maxRows; r++) {
            if (!occupied.has(`${c},${r}`)) {
                const dist = Math.abs(c - targetCol) + Math.abs(r - targetRow);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestCell = { col: c, row: r };
                }
            }
        }
    }
    if (minDistance === Infinity) {
        let row = maxRows;
        while (true) {
            for (let col = 0; col < maxCols; col++) if (!occupied.has(`${col},${row}`)) return {col,row};
            row++;
        }
    }
    return bestCell;
};

window.getDesktopIconPositionKey = (item) => {
    const userId = window.state?.currentUserId === "bl4ut0" ? "" : `${window.state?.currentUserId || "guest"}_`;
    if (item.path) return `desktop_pos_${userId}file_${item.path}`;
    return item.selectId ? `desktop_pos_${userId}${item.launchApp}_${item.selectId}` : `desktop_pos_${userId}${item.launchApp || item.id}`;
};

const desktopLayoutPath = '/Desktop/desktop-layout.json';
let desktopLayoutWriteQueue = Promise.resolve();
let desktopLayoutWriteOwner = null;
window.flushDesktopLayout = async () => {
    const owner=state.currentUserId;
    if (desktopLayoutWriteOwner !== owner) return;
    await desktopLayoutWriteQueue;
    SystemFS.assertProfile(owner);
};
window.readDesktopLayout = async (owner = state.currentUserId) => {
    const record = await SystemFS.readFile(desktopLayoutPath);
    SystemFS.assertProfile(owner);
    if (!record) return {version:1,positions:Object.create(null)};
    if (record.isDirectory || record.size > 262144) throw new Error('The desktop layout file is invalid.');
    let value;
    try {value = JSON.parse(typeof record.data==='string'?record.data:await new Blob([record.data]).text());}
    catch {throw new Error('The desktop layout file is invalid.');}
    SystemFS.assertProfile(owner);
    if (value?.version!==1 || !value.positions || typeof value.positions!=='object' || Array.isArray(value.positions) || Object.keys(value.positions).length>2048) throw new Error('The desktop layout file is invalid.');
    const positions = Object.create(null);
    for (const [id,cell] of Object.entries(value.positions)) {
        if (id.length<=256 && cell && Number.isInteger(cell.col) && Number.isInteger(cell.row) && cell.col>=0 && cell.row>=0 && cell.col<=10000 && cell.row<=10000) positions[id]={col:cell.col,row:cell.row};
    }
    const shortcutsSeeded = Array.isArray(value.shortcutsSeeded) ? [...new Set(value.shortcutsSeeded.filter(id=>typeof id==='string'&&id.length<=256))].slice(0,2048) : [];
    return {version:1,positions,shortcutsSeeded,customized:value.customized===true};
};
window.saveDesktopLayoutPositions = (positions, owner = state.currentUserId, reset = false) => {
    const saving = desktopLayoutWriteQueue.catch(()=>{}).then(async()=>{
        SystemFS.assertProfile(owner);
        let layout;
        try {layout=await window.readDesktopLayout(owner);} catch(error) {if(!reset)throw error;layout={version:1,positions:Object.create(null),shortcutsSeeded:[]};}
        if (reset) layout.positions=Object.create(null);
        else Object.assign(layout.positions,positions);
        layout.customized=true;
        const data=JSON.stringify(layout);
        if (data.length>262144 || Object.keys(layout.positions).length>2048) throw new Error('The desktop layout is full.');
        SystemFS.assertProfile(owner);
        await SystemFS.writeFile(desktopLayoutPath,'desktop-layout.json','/Desktop',data,new Blob([data]).size,'application/json',false,{metadata:{kind:'desktop-layout'}});
        SystemFS.assertProfile(owner);
    });
    desktopLayoutWriteOwner=owner;
    desktopLayoutWriteQueue=saving;
    return saving;
};
window.ensureDesktopShortcuts = (launchers, owner) => {
    const saving=desktopLayoutWriteQueue.catch(()=>{}).then(async()=>{
        SystemFS.assertProfile(owner);
        const layout=await window.readDesktopLayout(owner), seeded=new Set(layout.shortcutsSeeded || []);
        let changed=false;
        for (const item of launchers) {
            if (seeded.has(item.id)) continue;
            const name=item.id+'.portfolios-link.json',path='/Desktop/'+name;
            if (!/^[a-z0-9_-]+\.portfolios-link\.json$/i.test(name)) continue;
            const existing=await SystemFS.readFile(path);
            SystemFS.assertProfile(owner);
            if (!existing) {
                const shortcut={appId:item.launchApp,selectId:item.selectId || ''};
                const data=JSON.stringify({type:'portfolios-app-shortcut',...shortcut});
                await SystemFS.writeFile(path,name,'/Desktop',data,new Blob([data]).size,'application/json',false,{silent:true,metadata:{desktopShortcut:shortcut,kind:'desktop-default-shortcut'}});
                SystemFS.assertProfile(owner);
            }
            seeded.add(item.id);changed=true;
        }
        if (changed) {
            layout.shortcutsSeeded=[...seeded];
            const data=JSON.stringify(layout);
            await SystemFS.writeFile(desktopLayoutPath,'desktop-layout.json','/Desktop',data,new Blob([data]).size,'application/json',false,{metadata:{kind:layout.customized?'desktop-layout':'desktop-layout-default'}});
            SystemFS.assertProfile(owner);
        }
    });
    desktopLayoutWriteOwner=owner;
    desktopLayoutWriteQueue=saving;
    return saving;
};
window.clearDesktopIconPositions = async () => {
    const owner=state.currentUserId;
    await window.saveDesktopLayoutPositions({},owner,true);
    await window.renderDesktopIcons();
};

window.getDefaultDesktopIconCell = (item, fallbackIndex, maxRows, maxCols) => {
    const layout = window.getCurrentDesktopIconLayout ? window.getCurrentDesktopIconLayout() : window.defaultDesktopIconLayout;
    const savedCell = layout?.[item.id];
    let col = savedCell ? savedCell.col : Math.floor(fallbackIndex / maxRows);
    let row = savedCell ? savedCell.row : fallbackIndex % maxRows;

    col = Math.max(0, Math.min(col, maxCols - 1));
    row = Math.max(0, Math.min(row, maxRows - 1));

    return { col, row };
};

let desktopRenderRevision = 0;
let desktopDragActive = false;
window.renderDesktopIcons = async () => {
    if (desktopDragActive) return;
    const revision = ++desktopRenderRevision, owner = state.currentUserId;
    const desktopIcons = window.byId ? window.byId("desktop-icons") : document.getElementById("desktop-icons");
    if (!desktopIcons) return;

    const containerRect = {width:desktopIcons.clientWidth,height:desktopIcons.clientHeight};
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const cellWidth = 7.2 * rem;
    const cellHeight = cellWidth;

    let maxRows = 5;
    let maxCols = 10;
    if (containerRect.height > 0) {
        maxRows = Math.max(1, Math.floor(containerRect.height / cellHeight));
    }
    if (containerRect.width > 0) {
        maxCols = Math.max(1, Math.floor(containerRect.width / cellWidth));
    }

    const defaults = window.desktopPinnedIds
        .filter(id => window.isAppInstalled(id) && id !== "settings" && id !== "local-ai")
        .map(window.getDesktopLauncher)
        .filter(Boolean);
    let apps=[...defaults];
    let desktopLayout = {version:1,positions:Object.create(null)};
    try {await SystemFS.ensureReady();} catch(error) {if(owner===state.currentUserId)console.warn('Desktop filesystem is unavailable.',error);return;}
    if (owner !== state.currentUserId || revision !== desktopRenderRevision) return;
    try {
        await desktopLayoutWriteQueue.catch(()=>{});
        desktopLayout = await window.readDesktopLayout(owner);
        // Migrate this profile's old positions after a durable SystemFS write.
        if (owner !== 'bl4ut0' && !await SystemFS.readFile(desktopLayoutPath)) {
            SystemFS.assertProfile(owner);
            const legacy = Object.create(null), keys=[];
            for (const item of apps) {
                const key = window.getDesktopIconPositionKey(item);
                try {
                    const raw = window.Storage?.local.get(key);
                    if (!raw) continue;
                    const pos=JSON.parse(raw);
                    if (!Number.isFinite(pos.left)||!Number.isFinite(pos.top)) continue;
                    legacy[item.id]={col:Math.max(0,Math.round(pos.left/cellWidth)),row:Math.max(0,Math.round(pos.top/cellHeight))};keys.push(key);
                } catch {}
            }
            if (keys.length) {
                await window.saveDesktopLayoutPositions(legacy,owner);
                SystemFS.assertProfile(owner);
                keys.forEach(key=>window.Storage?.local.remove(key));
                desktopLayout=await window.readDesktopLayout(owner);
            }
        }
    } catch(error) {
        if (owner !== state.currentUserId) return;
        console.warn('Desktop layout could not be loaded.',error);
    }
    try {
        if (defaults.some(item=>!desktopLayout.shortcutsSeeded?.includes(item.id))) {
            await window.ensureDesktopShortcuts(defaults,owner);
            desktopLayout=await window.readDesktopLayout(owner);
        }
        const entries=await SystemFS.readDir('/Desktop');
        const resolved=await Promise.all(entries.filter(entry=>!entry.name.startsWith('.')&&entry.name!=='desktop-layout.json').map(async entry=>{
            const shortcut=await window.resolveDesktopShortcut(entry);
            if (shortcut) {
                if (!window.isAppInstalled(shortcut.appId)) return null;
                const launcher=window.getDesktopLauncher(shortcut.selectId || shortcut.appId);
                const defaultId=entry.name.slice(0,-'.portfolios-link.json'.length);
                return {...launcher,id:defaults.some(item=>item.id===defaultId)?defaultId:entry.path,path:entry.path};
            }
            return {id:entry.path,path:entry.path,isDirectory:entry.isDirectory,title:entry.name,icon:entry.isDirectory?'fa-solid fa-folder':'fa-regular fa-file',color:entry.isDirectory?'#fbbf24':'#22d3ee'};
        }));
        apps=resolved.filter(Boolean).sort((a,b)=>{
            const ai=defaults.findIndex(item=>item.id===a.id),bi=defaults.findIndex(item=>item.id===b.id);
            if(ai>=0||bi>=0)return (ai>=0?ai:10000)-(bi>=0?bi:10000);
            return Number(b.isDirectory)-Number(a.isDirectory)||a.title.localeCompare(b.title);
        });
    } catch(error) {if(owner!==state.currentUserId)return;console.warn('Desktop entries could not be loaded.',error);}
    if (revision !== desktopRenderRevision || owner !== state.currentUserId) return;
    apps.push({id:'new-folder',title:'New folder',icon:'fa-solid fa-folder-plus',color:'#fbbf24',createFolder:true});

    const occupied = new Set();
    const resolvedPositions = [];
    const appsToPlaceLater = [];

    // Pass 1: Place apps with saved custom positions
    apps.forEach(item => {
        const pos = desktopLayout.positions[item.id];
        if (pos) {
            try {
                let col = pos.col;
                let row = pos.row;

                col = Math.max(0, Math.min(col, maxCols - 1));
                row = Math.max(0, Math.min(row, maxRows - 1));

                const gridKey = `${col},${row}`;
                if (!occupied.has(gridKey)) {
                    occupied.add(gridKey);
                    resolvedPositions.push({
                        item,
                        left: `${col * cellWidth}px`,
                        top: `${row * cellHeight}px`
                    });
                    return;
                }
            } catch (e) {
                // invalid position, place later
            }
        }
        appsToPlaceLater.push(item);
    });

    // Pass 2: Place remaining apps in default grid slots
    appsToPlaceLater.forEach((item, fallbackIndex) => {
        let { col, row } = window.getDefaultDesktopIconCell(item, fallbackIndex, maxRows, maxCols);

        let gridKey = `${col},${row}`;
        if (occupied.has(gridKey)) {
            const freeCell = window.findNearestFreeCell(col, row, occupied, maxRows, maxCols);
            col = freeCell.col;
            row = freeCell.row;
            gridKey = `${col},${row}`;
        }

        occupied.add(gridKey);
        resolvedPositions.push({
            item,
            left: `${col * cellWidth}px`,
            top: `${row * cellHeight}px`
        });
    });

    const escape = window.escapeHtml;
    desktopIcons.innerHTML = resolvedPositions.map(({ item, left, top }) => {
        const isActive = item.selectId && item.selectId === state.activeId;
        const action = item.launchApp ? `data-open-app="${escape(item.launchApp)}" ${item.path?`data-desktop-path="${escape(item.path)}"`:''}` : item.path ? `data-desktop-path="${escape(item.path)}" ${item.isDirectory?'data-desktop-folder="true"':''}`
            : item.createFolder ? 'data-desktop-create-folder="true"' : `data-open-app="${escape(item.launchApp)}"`;
        return `<button class="desktop-icon ${isActive ? 'active' : ''}" ${item.selectId ? `data-select="${escape(item.selectId)}"` : ''}
            ${action} data-desktop-id="${escape(item.id)}" style="--tile-color:${item.color};left:${left};top:${top}" title="${item.createFolder?'Create a desktop folder':'Open '+escape(item.title)}">
            ${window.getAppIconHtml(item.icon)}<span>${escape(item.title)}</span></button>`;
    }).join('');
};

window.initDesktopIconDragging = () => {
    const container = window.byId ? window.byId("desktop-icons") : document.getElementById("desktop-icons");
    if (!container || container.dataset.desktopBound === 'true') return;
    container.dataset.desktopBound = 'true';
    container.addEventListener('click', event => {
        const icon = event.target.closest('.desktop-icon');
        if (!icon || icon.dataset.openApp) return;
        if (icon.dataset.preventClick === 'true') { delete icon.dataset.preventClick; return; }
        if (icon.hasAttribute('data-desktop-create-folder')) window.createDesktopFolder();
        else if (icon.dataset.desktopPath) window.openDesktopFile(icon.dataset.desktopPath).catch(error=>window.showDesktopToast?.(error.message));
    });

    container.addEventListener("pointerdown", (event) => {
        const icon = event.target.closest(".desktop-icon");
        if (!icon || icon.hasAttribute("data-desktop-create-folder") || event.button !== 0 || event.target.closest("a, button:not(.desktop-icon)")) return;
        event.preventDefault();

        desktopDragActive = true;
        ++desktopRenderRevision;
        const dragOwner = state.currentUserId;
        const scale = window.getDesktopScale ? window.getDesktopScale() : 1;
        const startX = event.clientX;
        const startY = event.clientY;

        const startLeft = parseFloat(icon.style.left) || 0;
        const startTop = parseFloat(icon.style.top) || 0;

        const iconW = icon.offsetWidth;
        const iconH = icon.offsetHeight;
        const containerW = container.clientWidth;
        const containerH = Math.max(container.clientHeight, container.scrollHeight);

        let hasMoved = false;

        const move = (moveEvent) => {
            const dx = (moveEvent.clientX - startX) / scale;
            const dy = (moveEvent.clientY - startY) / scale;

            if (Math.abs(dx * scale) > 4 || Math.abs(dy * scale) > 4) {
                hasMoved = true;
                icon.dataset.preventClick = "true";
                icon.classList.add("is-dragging");
            }

            if (hasMoved) {
                const nextLeft = Math.max(0, Math.min(containerW - iconW, startLeft + dx));
                const nextTop = Math.max(0, Math.min(containerH - iconH, startTop + dy));
                icon.style.left = `${nextLeft}px`;
                icon.style.top = `${nextTop}px`;
            }
        };

        const stop = async (stopEvent) => {
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", stop);
            document.removeEventListener("pointercancel", stop);

            desktopDragActive = false;
            if (dragOwner !== state.currentUserId) { window.renderDesktopIcons(); return; }
            if (hasMoved) {
                icon.classList.remove("is-dragging");
                const folder = document.elementsFromPoint(stopEvent.clientX, stopEvent.clientY).map(el=>el.closest('[data-desktop-folder]')).find(el=>el&&el!==icon);
                if (stopEvent.type !== 'pointercancel' && folder && icon.dataset.openApp) {
                    try { await window.addDesktopAppShortcut(folder.dataset.desktopPath, icon.dataset.openApp, icon.dataset.select || '', icon.dataset.desktopPath); }
                    catch(error) { window.showDesktopToast?.(error.message); }
                    delete icon.dataset.preventClick;
                    window.renderDesktopIcons();
                    return;
                }
                const finalLeft = parseFloat(icon.style.left);
                const finalTop = parseFloat(icon.style.top);

                const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
                const cellWidth = 7.2 * rem;
                const cellHeight = cellWidth;

                const maxRows = Math.max(1, Math.floor(containerH / cellHeight));
                const maxCols = Math.max(1, Math.floor(containerW / cellWidth));

                const otherIcons = Array.from(container.querySelectorAll(".desktop-icon")).filter(el => el !== icon);
                const occupied = new Set();
                otherIcons.forEach(el => {
                    const leftVal = parseFloat(el.style.left) || 0;
                    const topVal = parseFloat(el.style.top) || 0;
                    const c = Math.round(leftVal / cellWidth);
                    const r = Math.round(topVal / cellHeight);
                    occupied.add(`${c},${r}`);
                });

                const targetCol = Math.max(0, Math.min(Math.round(finalLeft / cellWidth), maxCols - 1));
                const targetRow = Math.max(0, Math.min(Math.round(finalTop / cellHeight), maxRows - 1));

                const resolved = window.findNearestFreeCell(targetCol, targetRow, occupied, maxRows, maxCols);

                const snappedLeft = resolved.col * cellWidth;
                const snappedTop = resolved.row * cellHeight;

                icon.style.left = `${snappedLeft}px`;
                icon.style.top = `${snappedTop}px`;

                try {
                    await window.saveDesktopLayoutPositions({[icon.dataset.desktopId]:{col:resolved.col,row:resolved.row}},dragOwner);
                } catch(error) { window.showDesktopToast?.('Icon position was not saved: '+error.message); }

                window.renderDesktopIcons();
                setTimeout(() => {
                    delete icon.dataset.preventClick;
                }, 50);
            }
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", stop);
        document.addEventListener("pointercancel", stop);
    });
};

// Desktop entries share File Explorer's existing file associations.
window.openDesktopFile = async (path) => {
    const owner = state.currentUserId;
    const windowEl = await window.openDesktopWindow('files');
    SystemFS.assertProfile(owner);
    if (!windowEl) throw new Error('File Explorer is unavailable.');
    return window.appRegistry.files.openPath(path, windowEl);
};

window.resolveDesktopShortcut = async (record) => {
    if (record?.isDirectory || !record?.name?.endsWith('.portfolios-link.json') || record.size > 4096) return null;
    try {
        const text = typeof record.data === 'string' ? record.data : await new Blob([record.data]).text();
        if (text.length > 4096) return null;
        const value = JSON.parse(text);
        if (value.type !== 'portfolios-app-shortcut' || typeof value.appId !== 'string' || !window.appById?.(value.appId)) return null;
        return {appId:value.appId,selectId:typeof value.selectId==='string'&&window.systemById?.(value.selectId)?value.selectId:''};
    } catch { return null; }
};

window.addDesktopAppShortcut = async (folder, appId, selectId = '', sourcePath = null) => {
    const owner = state.currentUserId;
    if (!window.appById?.(appId)) throw new Error('Unknown application.');
    const destination = SystemFS.normalizePath(folder);
    if (!destination.startsWith('/Desktop/')) throw new Error('Choose a desktop folder.');
    const record = await SystemFS.readFile(destination);
    SystemFS.assertProfile(owner);
    if (!record?.isDirectory) throw new Error('That folder is no longer available.');
    const launcher = window.getDesktopLauncher(selectId || appId);
    const name = `${appId}${selectId ? '-'+selectId : ''}.portfolios-link.json`;
    if (!/^[a-z0-9_-]+\.portfolios-link\.json$/i.test(name)) throw new Error('Invalid shortcut.');
    const path = `${destination}/${name}`;
    if (await SystemFS.readFile(path)) { SystemFS.assertProfile(owner); window.showDesktopToast?.('This shortcut is already in the folder.'); return; }
    SystemFS.assertProfile(owner);
    const shortcut = {appId,selectId:window.systemById?.(selectId)?selectId:''};
    const data = JSON.stringify({type:'portfolios-app-shortcut',...shortcut});
    await SystemFS.writeFile(path,name,destination,data,new Blob([data]).size,'application/json',false,{metadata:{desktopShortcut:shortcut,label:launcher?.title || appId}});
    SystemFS.assertProfile(owner);
    if (sourcePath) {
        const source=SystemFS.normalizePath(sourcePath);
        if (!source.startsWith('/Desktop/') || SystemFS.getParentPath(source)!=='/Desktop') throw new Error('Invalid desktop shortcut source.');
        const sourceRecord=await SystemFS.readFile(source), sourceLink=await window.resolveDesktopShortcut(sourceRecord);
        SystemFS.assertProfile(owner);
        if (sourceLink?.appId===appId && sourceLink.selectId===shortcut.selectId) await SystemFS.deleteFile(source);
        SystemFS.assertProfile(owner);
    }
    await window.saveDesktopLayoutPositions({},owner);
    window.showDesktopToast?.(sourcePath?'App shortcut moved to folder':'App shortcut added to folder');
};

window.createDesktopFolder = (requestedName) => {
    const owner = state.currentUserId;
    const create = async (rawName) => {
        const name = String(rawName || '').trim();
        if (name === 'desktop-layout.json') throw new Error('This name is reserved for the desktop layout.');
        if (!name || name.length > 100 || /^[.]/.test(name) || /[\\/\x00-\x1f]/.test(name)) throw new Error('Enter a folder name without slashes or a leading dot.');
        SystemFS.assertProfile(owner);
        const path = '/Desktop/'+name;
        const existing = await SystemFS.readFile(path);
        SystemFS.assertProfile(owner);
        if (existing) throw new Error('A desktop item with this name already exists.');
        await SystemFS.writeFile(path,name,'/Desktop',null,0,'directory',true);
        SystemFS.assertProfile(owner);
        await window.saveDesktopLayoutPositions({},owner);
        await window.renderDesktopIcons();
        return path;
    };
    if (requestedName !== undefined) return create(requestedName);
    if (document.querySelector('[data-desktop-folder-dialog]')) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'systemfs-dialog';
    dialog.dataset.desktopFolderDialog = 'true';
    dialog.innerHTML = `<form class="desktop-folder-form" role="dialog" aria-modal="true" aria-labelledby="desktop-folder-heading">
        <h2 id="desktop-folder-heading">New desktop folder</h2>
        <label>Folder name<input name="folderName" value="New folder" maxlength="100" autocomplete="off" required></label>
        <p role="alert" data-folder-error></p><div><button type="button" data-folder-cancel>Cancel</button><button type="submit">Create folder</button></div></form>`;
    const previousFocus = document.activeElement;
    let alive = true, saving = false;
    const close = () => { alive = false; off?.(); dialog.close(); dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true}); };
    const off = window.EventBus?.on('user:changed',close);
    dialog.querySelector('[data-folder-cancel]').addEventListener('click',close);
    dialog.addEventListener('keydown',event=>{
        if (event.key==='Escape') {event.preventDefault();close();}
        if (event.key==='Tab') {
            const fields=[...dialog.querySelectorAll('input,button')], first=fields[0], last=fields.at(-1);
            if (event.shiftKey&&document.activeElement===first) {event.preventDefault();last.focus();}
            else if (!event.shiftKey&&document.activeElement===last) {event.preventDefault();first.focus();}
        }
    });
    dialog.querySelector('form').addEventListener('submit',async event=>{
        event.preventDefault();if (saving) return;saving=true;
        dialog.querySelector('[data-folder-error]').textContent='';
        try {await create(dialog.querySelector('input').value);if(alive)close();}
        catch(error) {if(alive)dialog.querySelector('[data-folder-error]').textContent=error.message;}
        finally {saving=false;}
    });
    document.body.append(dialog);dialog.showModal();const input=dialog.querySelector('input');input.focus();input.select();
};

// Hook into EventBus
if (window.EventBus) {
    window.EventBus.on("app:installed", () => window.renderDesktopIcons());
    window.EventBus.on("app:uninstalled", () => window.renderDesktopIcons());
    window.EventBus.on("desktop:refresh", () => window.renderDesktopIcons());
    window.EventBus.on("user:changed", () => {desktopDragActive=false;window.renderDesktopIcons();});
    window.EventBus.on('fs:ready', () => window.renderDesktopIcons());
    window.EventBus.on('fs:changed', event => { if (event.parent === '/Desktop' || event.path === '/Desktop' || event.action === 'sync') window.renderDesktopIcons(); });
}
