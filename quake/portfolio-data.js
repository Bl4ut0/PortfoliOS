// Load device-local PAK data asynchronously before WebQuake's synchronous engine starts.
(function () {
    // Legacy sound channels do not await play(); pauses/reloads can reject it.
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
        const attempt = play.apply(this, args);
        attempt?.catch(error => {
            if (!['AbortError', 'NotAllowedError'].includes(error.name)) console.warn('[Quake audio]', error);
        });
        return attempt;
    };
    const start = window.onload;
    const originalPack = COM.LoadPackFile;
    const originalFile = COM.LoadFile;
    let data;
    COM.LoadPackFile = function (path) {
        if (path !== 'id1/pak0.pak' || !data) return originalPack(path);
        const header = new DataView(data);
        if (data.byteLength < 12 || header.getUint32(0, true) !== 0x4b434150) throw Error('Invalid pak0.pak.');
        const offset = header.getUint32(4, true), length = header.getUint32(8, true);
        if (!length || length % 64 || offset + length > data.byteLength) throw Error('Incomplete PAK directory.');
        const count = length / 64, directory = new Uint8Array(data, offset, length), view = new DataView(data, offset, length), pack = [];
        if (count !== 339 || CRC.Block(directory) !== 32981) COM.modified = true;
        for (let i = 0; i < count; i++) {
            const filepos = view.getUint32(i * 64 + 56, true), filelen = view.getUint32(i * 64 + 60, true);
            if (filepos + filelen > data.byteLength) throw Error('Incomplete PAK entry.');
            pack.push({name:Q.memstr(directory.subarray(i * 64, i * 64 + 56)).toLowerCase(), filepos, filelen});
        }
        Con.Print('Added local packfile ' + path + ' (' + count + ' files)\n');
        return pack;
    };
    COM.LoadFile = function (filename) {
        filename = filename.toLowerCase();
        for (let i = COM.searchpaths.length - 1; i >= 0; i--) {
            const search = COM.searchpaths[i], saved = localStorage.getItem('Quake.' + search.filename + '/' + filename);
            if (saved !== null) return Q.strmem(saved);
            for (let j = search.pack.length - 1; j >= 0; j--) {
                const file = search.pack[j].find(entry => entry.name === filename);
                if (data && search.filename === 'id1' && j === 0 && file) return data.slice(file.filepos, file.filepos + file.filelen);
                if (file) return originalFile(filename);
            }
        }
        return originalFile(filename);
    };
    window.onload = async function (event) {
        const progress = document.getElementById('progress');
        try {
            if (progress) progress.textContent = 'Loading local Quake data…';
            const response = await fetch('id1/pak0.pak');
            if (!response.ok) throw Error('Quake data is unavailable. Close the game and select pak0.pak again.');
            data = await response.arrayBuffer();
            start.call(window, event);
        } catch (error) {
            document.body.style.cursor = 'auto';
            if (progress) { progress.style.display = ''; progress.textContent = error.message || 'Quake could not start.'; }
            console.error('[Quake]', error);
        }
    };
})();
