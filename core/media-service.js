/**
 * PortfoliOS Mobile Media Service
 *
 * A persistent, UI-independent audio service backed by SystemFS `/music`.
 * The service deliberately lives outside mobile app roots so playback survives
 * Home, Recents, app switches, and mobile/desktop experience changes.
 */
(function() {
    if (window.MobileMediaService) return;

    const MUSIC_ROOT = "/music";
    const ARTWORK_ROOT = `${MUSIC_ROOT}/.artwork`;
    const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".webm", ".opus", ".aiff", ".aif"];
    const REPEAT_MODES = ["off", "all", "one"];
    const listeners = new Set();
    const artworkUrls = new Map();

    let audio = null;
    let audioObjectUrl = "";
    let initPromise = null;
    let refreshGeneration = 0;
    let loadGeneration = 0;
    let metadataParserPromise = null;
    let unregisterAudioAdapter = null;
    let unsubscribeFilesystem = null;
    let unsubscribeVolume = null;
    let unsubscribeView = null;
    let suppressFilesystemRefresh = false;

    const state = {
        status: "idle",
        busy: false,
        busyLabel: "",
        error: "",
        library: [],
        externalTrack: null,
        queue: [],
        currentPath: "",
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: getSystemVolume(),
        shuffle: false,
        repeat: "off"
    };

    function getSystemVolume() {
        const value = window.PortfolioOSAppFramework?.getDesktopVolume?.() ?? window.state?.volume ?? 70;
        return Math.max(0, Math.min(100, Number(value) || 0));
    }

    function preferenceKey(name) {
        if (typeof window.getPreferencesKey === "function") {
            return window.getPreferencesKey(`MobileMusic${name}`);
        }
        const userId = String(window.state?.currentUserId || "bl4ut0").replace(/[^a-z0-9_-]/gi, "") || "bl4ut0";
        return `bl4ut0_${userId}_MobileMusic${name}`;
    }

    function readStored(name, fallback = "") {
        try {
            const value = window.Storage
                ? window.Storage.local.get(preferenceKey(name))
                : window.localStorage.getItem(preferenceKey(name));
            return value === null || value === undefined ? fallback : value;
        } catch (error) {
            return fallback;
        }
    }

    function writeStored(name, value) {
        try {
            const serialized = String(value);
            if (window.Storage) window.Storage.local.set(preferenceKey(name), serialized);
            else window.localStorage.setItem(preferenceKey(name), serialized);
        } catch (error) {}
    }

    function readStoredJson(name, fallback) {
        try {
            const parsed = JSON.parse(readStored(name, ""));
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch (error) {
            return fallback;
        }
    }

    function publicTrack(track) {
        if (!track) return null;
        return {
            path: track.path,
            name: track.name,
            size: track.size,
            type: track.type,
            lastModified: track.lastModified,
            title: track.title,
            artist: track.artist,
            album: track.album,
            artworkUrl: track.artworkUrl || ""
        };
    }

    function currentTrack() {
        return state.library.find((track) => track.path === state.currentPath)
            || (state.externalTrack?.path === state.currentPath ? state.externalTrack : null);
    }

    function snapshot() {
        return {
            status: state.status,
            busy: state.busy,
            busyLabel: state.busyLabel,
            error: state.error,
            library: state.library.map(publicTrack),
            queue: [...state.queue],
            currentPath: state.currentPath,
            currentTrack: publicTrack(currentTrack()),
            isPlaying: state.isPlaying,
            playing: state.isPlaying,
            currentTime: state.currentTime,
            duration: state.duration,
            volume: state.volume,
            shuffle: state.shuffle,
            repeat: state.repeat
        };
    }

    function notify(reason = "state") {
        const next = snapshot();
        listeners.forEach((listener) => {
            try {
                listener(next, reason);
            } catch (error) {
                console.error("PortfoliOS Mobile: media subscriber failed.", error);
            }
        });
        window.EventBus?.emit("mobile-media:state", { ...next, reason });
        window.EventBus?.emit("mobile:media-state", { ...next, reason });
    }

    function subscribe(listener) {
        if (typeof listener !== "function") return () => {};
        listeners.add(listener);
        try {
            listener(snapshot(), "subscribe");
        } catch (error) {
            console.error("PortfoliOS Mobile: media subscriber failed.", error);
        }
        return () => listeners.delete(listener);
    }

    function ensureAudioElement() {
        if (audio) return audio;
        audio = document.getElementById("mobile-media-service-audio") || document.createElement("audio");
        audio.id = "mobile-media-service-audio";
        audio.hidden = true;
        audio.preload = "metadata";
        audio.playsInline = true;
        audio.setAttribute("playsinline", "");
        audio.setAttribute("aria-hidden", "true");
        audio.volume = state.volume / 100;
        if (!audio.isConnected) (document.body || document.documentElement).appendChild(audio);
        return audio;
    }

    function normalizeRelativePath(value = "") {
        return String(value || "")
            .replace(/\\/g, "/")
            .replace(/^\/+|\/+$/g, "")
            .replace(/\/{2,}/g, "/");
    }

    function sanitizeFileName(value = "") {
        const cleaned = String(value || "")
            .replace(/[\\/:*?"<>|]/g, "-")
            .replace(/[\u0000-\u001f]/g, "")
            .replace(/\s+/g, " ")
            .trim();
        return cleaned || `track-${Date.now()}.mp3`;
    }

    function isAudioName(name = "") {
        const lower = String(name).toLowerCase();
        return AUDIO_EXTENSIONS.some((extension) => lower.endsWith(extension));
    }

    function isAudioRecord(record) {
        return !!record
            && !record.isDirectory
            && (String(record.type || "").startsWith("audio/") || record.metadata?.kind === "music" || isAudioName(record.name));
    }

    function isAudioFile(file) {
        return !!file
            && Number(file.size) > 0
            && (String(file.type || "").startsWith("audio/") || isAudioName(file.name));
    }

    function guessMime(name = "") {
        const lower = String(name).toLowerCase();
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (/\.(?:ogg|oga|opus)$/.test(lower)) return "audio/ogg";
        if (/\.(?:m4a|aac)$/.test(lower)) return "audio/mp4";
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".webm")) return "audio/webm";
        if (/\.(?:aiff|aif)$/.test(lower)) return "audio/aiff";
        return "audio/mpeg";
    }

    function inferredMetadata(relativePath, fallbackName) {
        const parts = normalizeRelativePath(relativePath || fallbackName).split("/").filter(Boolean);
        const fileName = parts.pop() || fallbackName || "Untitled track";
        const title = fileName
            .replace(/\.[^.]+$/, "")
            .replace(/^\s*\d{1,3}[\s._-]+/, "")
            .trim() || "Untitled track";
        return {
            title,
            artist: parts.length >= 2 ? parts[parts.length - 2] : "Unknown Artist",
            album: parts.length ? parts[parts.length - 1] : "Unknown Album"
        };
    }

    function cleanText(value, fallback = "") {
        const text = String(value ?? "").replace(/\0/g, "").replace(/\s+/g, " ").trim();
        return text || fallback;
    }

    function ensureMetadataParser() {
        if (window.jsmediatags?.read) return Promise.resolve(window.jsmediatags);
        if (metadataParserPromise) return metadataParserPromise;

        metadataParserPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector("script[data-mobile-media-tags]")
                || document.querySelector("script[data-musicmini-tags]");
            const script = existing || document.createElement("script");
            const removeListeners = () => {
                script.removeEventListener("load", handleLoad);
                script.removeEventListener("error", handleError);
            };
            const rejectAndRemove = (error) => {
                removeListeners();
                script.remove();
                reject(error);
            };
            const handleLoad = () => {
                removeListeners();
                if (window.jsmediatags?.read) {
                    resolve(window.jsmediatags);
                    return;
                }
                script.remove();
                reject(new Error("Audio metadata parser did not initialize."));
            };
            const handleError = () => rejectAndRemove(new Error("Audio metadata parser could not be loaded."));
            script.addEventListener("load", handleLoad, { once: true });
            script.addEventListener("error", handleError, { once: true });
            if (!existing) {
                script.src = "apps/musicmini/vendor/jsmediatags.min.js?v=3.9.7.1";
                script.dataset.mobileMediaTags = "1";
                try {
                    document.head.appendChild(script);
                } catch (error) {
                    rejectAndRemove(error);
                }
            }
        }).catch((error) => {
            metadataParserPromise = null;
            throw error;
        });
        return metadataParserPromise;
    }

    async function readTags(file) {
        try {
            const parser = await ensureMetadataParser();
            return await new Promise((resolve) => {
                parser.read(file, {
                    onSuccess: (result) => resolve(result?.tags || {}),
                    onError: () => resolve({})
                });
            });
        } catch (error) {
            return {};
        }
    }

    async function blobHash(blob) {
        if (window.crypto?.subtle) {
            const digest = await window.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
            return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
        }
        return `${blob.size}-${String(blob.type || "image").replace(/\W/g, "")}`;
    }

    async function storeEmbeddedArtwork(picture) {
        if (!picture?.data?.length) return "";
        const bytes = picture.data instanceof Uint8Array ? picture.data : new Uint8Array(picture.data);
        const type = picture.format || "image/jpeg";
        const blob = new Blob([bytes], { type });
        const extension = type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : ".jpg";
        await window.SystemFS.ensureDirectory(ARTWORK_ROOT, {
            silent: true,
            metadata: { kind: "music-artwork-root", sync: false }
        });
        const name = `${await blobHash(blob)}${extension}`;
        const path = `${ARTWORK_ROOT}/${name}`;
        if (!await window.SystemFS.readFile(path)) {
            await window.SystemFS.writeFile(path, name, ARTWORK_ROOT, blob, blob.size, type, false, {
                silent: true,
                metadata: { kind: "album-artwork", sync: false }
            });
        }
        return path;
    }

    async function metadataForImport(file) {
        const inferred = inferredMetadata(file.webkitRelativePath || file.name, file.name);
        const tags = await readTags(file);
        const artworkPath = await storeEmbeddedArtwork(tags.picture || tags.APIC || tags.covr);
        return {
            kind: "music",
            mobileMusicMetadataSchema: 1,
            title: cleanText(tags.title, inferred.title),
            artist: cleanText(tags.artist, inferred.artist),
            album: cleanText(tags.album, inferred.album),
            albumArtist: cleanText(tags.albumArtist, cleanText(tags.artist, inferred.artist)),
            artworkPath,
            originalName: file.name,
            relativePath: normalizeRelativePath(file.webkitRelativePath || file.name),
            importedAt: Date.now()
        };
    }

    async function artworkUrl(path) {
        if (!path) return "";
        if (artworkUrls.has(path)) return artworkUrls.get(path);
        const record = await window.SystemFS.readFile(path);
        if (!record?.data) return "";
        const blob = record.data instanceof Blob
            ? record.data
            : new Blob([record.data], { type: record.type || "image/jpeg" });
        const url = URL.createObjectURL(blob);
        artworkUrls.set(path, url);
        return url;
    }

    async function trackFromRecord(record) {
        const inferred = inferredMetadata(record.metadata?.relativePath || record.name, record.name);
        return {
            path: record.path,
            name: record.name,
            size: Number(record.size) || 0,
            type: record.type || guessMime(record.name),
            lastModified: Number(record.lastModified) || 0,
            title: cleanText(record.metadata?.title, inferred.title),
            artist: cleanText(record.metadata?.artist, inferred.artist),
            album: cleanText(record.metadata?.album, inferred.album),
            artworkPath: record.metadata?.artworkPath || "",
            artworkUrl: await artworkUrl(record.metadata?.artworkPath || "")
        };
    }

    async function scanDirectory(path, records, visited = new Set()) {
        const cleanPath = window.SystemFS.normalizePath(path);
        if (visited.has(cleanPath)) return;
        visited.add(cleanPath);
        const items = await window.SystemFS.readDir(cleanPath);
        for (const item of items) {
            if (item.isDirectory) {
                if (item.path === ARTWORK_ROOT || item.name.startsWith(".")) continue;
                await scanDirectory(item.path, records, visited);
            } else if (isAudioRecord(item)) {
                records.push(item);
            }
        }
    }

    function compareTracks(a, b) {
        return a.artist.localeCompare(b.artist, undefined, { sensitivity: "base" })
            || a.album.localeCompare(b.album, undefined, { sensitivity: "base" })
            || a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    }

    function persistPlaybackState() {
        writeStored("CurrentPath", state.currentPath);
        writeStored("Queue", JSON.stringify(state.queue));
        writeStored("Shuffle", state.shuffle ? "1" : "0");
        writeStored("Repeat", state.repeat);
        window.savePreferencesToFilesystem?.();
    }

    function restorePlaybackState() {
        state.currentPath = readStored("CurrentPath", "");
        const queue = readStoredJson("Queue", []);
        state.queue = Array.isArray(queue) ? queue.filter((path) => typeof path === "string") : [];
        state.shuffle = readStored("Shuffle", "0") === "1";
        const repeat = readStored("Repeat", "off");
        state.repeat = REPEAT_MODES.includes(repeat) ? repeat : "off";
    }

    async function refreshLibrary(options = {}) {
        if (!window.SystemFS) throw new Error("System storage is unavailable.");
        const generation = ++refreshGeneration;
        if (!options.background) {
            state.busy = true;
            state.busyLabel = "Scanning /music";
            notify("library-loading");
        }

        try {
            await window.SystemFS.ensureDirectory(MUSIC_ROOT, { silent: true });
            const records = [];
            await scanDirectory(MUSIC_ROOT, records);
            const tracks = [];
            for (const record of records) {
                if (generation !== refreshGeneration) return snapshot();
                tracks.push(await trackFromRecord(record));
            }
            if (generation !== refreshGeneration) return snapshot();

            const liveArtworkPaths = new Set(tracks.map((track) => track.artworkPath).filter(Boolean));
            artworkUrls.forEach((url, path) => {
                if (liveArtworkPaths.has(path)) return;
                URL.revokeObjectURL(url);
                artworkUrls.delete(path);
            });

            state.library = tracks.sort(compareTracks);
            const availablePaths = new Set(state.library.map((track) => track.path));
            const retainedQueue = state.queue.filter((path) => availablePaths.has(path));
            const queuedPaths = new Set(retainedQueue);
            state.library.forEach((track) => {
                if (!queuedPaths.has(track.path)) retainedQueue.push(track.path);
            });
            state.queue = retainedQueue;

            if (state.currentPath && !availablePaths.has(state.currentPath)) {
                const isExternalPath = state.currentPath !== MUSIC_ROOT && !state.currentPath.startsWith(`${MUSIC_ROOT}/`);
                const externalRecord = isExternalPath ? await window.SystemFS.readFile(state.currentPath) : null;
                if (isAudioRecord(externalRecord)) {
                    state.externalTrack = await trackFromRecord(externalRecord);
                } else {
                    state.externalTrack = null;
                    clearLoadedAudio();
                    state.currentPath = state.queue[0] || "";
                }
            } else if (!state.currentPath) {
                state.externalTrack = null;
                state.currentPath = state.queue[0] || "";
            } else {
                state.externalTrack = null;
            }

            state.status = "ready";
            state.error = "";
            persistPlaybackState();
            updateMediaSession();
            return snapshot();
        } catch (error) {
            state.status = "error";
            state.error = error?.message || "The music library could not be loaded.";
            console.error("PortfoliOS Mobile: music scan failed.", error);
            return snapshot();
        } finally {
            if (generation === refreshGeneration) {
                state.busy = false;
                state.busyLabel = "";
                notify("library");
            }
        }
    }

    async function uniqueMusicPath(originalName) {
        const name = sanitizeFileName(originalName);
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        const extension = dot > 0 ? name.slice(dot) : "";
        let path = `${MUSIC_ROOT}/${name}`;
        let counter = 2;
        while (await window.SystemFS.readFile(path)) {
            path = `${MUSIC_ROOT}/${base} (${counter})${extension}`;
            counter += 1;
        }
        return path;
    }

    async function importFiles(fileList) {
        await init();
        const files = Array.from(fileList || []).filter(isAudioFile);
        if (!files.length) throw new Error("Choose one or more supported audio files.");

        suppressFilesystemRefresh = true;
        state.busy = true;
        state.error = "";
        let firstPath = "";
        const previousPath = state.currentPath;
        try {
            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
                state.busyLabel = `Importing ${index + 1} of ${files.length}`;
                notify("import-progress");
                const path = await uniqueMusicPath(file.name);
                const name = window.SystemFS.getName(path);
                const metadata = await metadataForImport(file);
                const record = await window.SystemFS.writeFile(
                    path,
                    name,
                    MUSIC_ROOT,
                    file,
                    file.size,
                    file.type || guessMime(file.name),
                    false,
                    { lastModified: file.lastModified || Date.now(), metadata }
                );
                if (!firstPath) firstPath = record.path;
            }
            await refreshLibrary({ background: true });
            if (!previousPath && firstPath) state.currentPath = firstPath;
            persistPlaybackState();
            updateMediaSession();
            notify("import-complete");
            return { imported: files.length, firstPath };
        } catch (error) {
            state.error = error?.message || "Audio import failed.";
            notify("error");
            throw error;
        } finally {
            suppressFilesystemRefresh = false;
            state.busy = false;
            state.busyLabel = "";
            notify("import-idle");
        }
    }

    async function readTrackBlob(path) {
        const record = await window.SystemFS.readFile(path);
        if (!isAudioRecord(record)) throw new Error("That track is no longer available.");
        const blob = record.data instanceof Blob
            ? record.data
            : new Blob([record.data], { type: record.type || guessMime(record.name) });
        return { record, blob };
    }

    function revokeAudioObjectUrl() {
        if (!audioObjectUrl) return;
        URL.revokeObjectURL(audioObjectUrl);
        audioObjectUrl = "";
    }

    function clearLoadedAudio() {
        if (audio) {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
        }
        revokeAudioObjectUrl();
        state.isPlaying = false;
        state.currentTime = 0;
        state.duration = 0;
    }

    async function loadTrack(path, options = {}) {
        const generation = ++loadGeneration;
        await init();
        if (generation !== loadGeneration) return snapshot();
        if (!path) throw new Error("No track was selected.");
        state.error = "";
        state.busy = true;
        state.busyLabel = "Loading track";
        notify("track-loading");
        try {
            const { record, blob } = await readTrackBlob(path);
            if (generation !== loadGeneration) return snapshot();
            const libraryTrack = state.library.find((track) => track.path === record.path) || null;
            const externalTrack = libraryTrack ? null : await trackFromRecord(record);
            if (generation !== loadGeneration) return snapshot();
            const player = ensureAudioElement();
            player.pause();
            revokeAudioObjectUrl();
            audioObjectUrl = URL.createObjectURL(blob);
            player.src = audioObjectUrl;
            player.load();
            player.volume = state.volume / 100;
            state.currentPath = record.path;
            state.externalTrack = externalTrack;
            state.currentTime = 0;
            state.duration = 0;
            persistPlaybackState();
            updateMediaSession();
            notify("track");
            if (options.autoplay) {
                if (generation !== loadGeneration) return snapshot();
                await startPlayback(generation);
                if (generation !== loadGeneration) return snapshot();
            }
            return snapshot();
        } catch (error) {
            if (generation !== loadGeneration) return snapshot();
            state.error = error?.message || "The track could not be loaded.";
            notify("error");
            throw error;
        } finally {
            if (generation === loadGeneration) {
                state.busy = false;
                state.busyLabel = "";
                notify("track-ready");
            }
        }
    }

    async function startPlayback(expectedLoadGeneration = null) {
        await init();
        if (expectedLoadGeneration !== null && expectedLoadGeneration !== loadGeneration) return snapshot();
        const player = ensureAudioElement();
        if (!player.getAttribute("src")) {
            const path = state.currentPath || state.queue[0];
            if (!path) throw new Error("Import music before pressing play.");
            return loadTrack(path, { autoplay: true });
        }
        try {
            activateMediaSession();
            await player.play();
            state.error = "";
            return snapshot();
        } catch (error) {
            state.error = error?.name === "NotAllowedError"
                ? "Tap play again to allow audio playback."
                : (error?.message || "Playback could not start.");
            notify("error");
            throw error;
        }
    }

    async function play(path = "") {
        if (path && (path !== state.currentPath || !audio?.getAttribute("src"))) {
            return loadTrack(path, { autoplay: true });
        }
        return startPlayback();
    }

    function pause() {
        ensureAudioElement().pause();
        return snapshot();
    }

    async function toggle() {
        return state.isPlaying ? pause() : startPlayback();
    }

    function stop(options = {}) {
        const player = ensureAudioElement();
        player.pause();
        try {
            player.currentTime = 0;
        } catch (error) {}
        state.currentTime = 0;
        state.isPlaying = false;
        if (options.clearSelection) {
            clearLoadedAudio();
            state.currentPath = "";
            state.externalTrack = null;
            persistPlaybackState();
        }
        updateMediaSession();
        notify("stop");
        return snapshot();
    }

    function queueIndex() {
        return state.queue.indexOf(state.currentPath);
    }

    async function next(options = {}) {
        await init();
        if (!state.queue.length) return snapshot();
        let index = queueIndex();
        if (state.shuffle && state.queue.length > 1) {
            let nextIndex = index;
            while (nextIndex === index) nextIndex = Math.floor(Math.random() * state.queue.length);
            index = nextIndex;
        } else {
            const atEnd = index >= state.queue.length - 1;
            if (options.fromEnded && atEnd && state.repeat !== "all") {
                pause();
                seek(0);
                return snapshot();
            }
            index = (Math.max(index, -1) + 1) % state.queue.length;
        }
        return loadTrack(state.queue[index], { autoplay: options.autoplay !== false });
    }

    async function previous() {
        await init();
        if (!state.queue.length) return snapshot();
        if (state.currentTime > 3) {
            seek(0);
            return snapshot();
        }
        const index = queueIndex();
        const previousIndex = (index <= 0 ? state.queue.length : index) - 1;
        return loadTrack(state.queue[previousIndex], { autoplay: true });
    }

    function seek(seconds) {
        const player = ensureAudioElement();
        const duration = Number.isFinite(player.duration) ? player.duration : state.duration;
        const nextTime = Math.max(0, Math.min(Number(seconds) || 0, Number.isFinite(duration) ? duration : Number.MAX_SAFE_INTEGER));
        try {
            player.currentTime = nextTime;
        } catch (error) {}
        state.currentTime = nextTime;
        updateMediaPosition();
        notify("seek");
        return snapshot();
    }

    function applyVolume(value, options = {}) {
        const nextVolume = Math.max(0, Math.min(100, Number(value) || 0));
        const changed = nextVolume !== state.volume;
        state.volume = nextVolume;
        ensureAudioElement().volume = nextVolume / 100;

        if (options.persist !== false) {
            if (typeof window.setDesktopVolume === "function" && Number(window.state?.volume) !== nextVolume) {
                window.setDesktopVolume(nextVolume);
            } else if (window.Storage) {
                window.Storage.local.set(
                    typeof window.getPreferencesKey === "function" ? window.getPreferencesKey("Volume") : "bl4ut0Volume",
                    String(nextVolume)
                );
            }
        }
        if (changed || options.forceNotify) notify("volume");
        return snapshot();
    }

    function setShuffle(enabled) {
        state.shuffle = !!enabled;
        persistPlaybackState();
        notify("shuffle");
        return snapshot();
    }

    function setRepeat(mode) {
        state.repeat = REPEAT_MODES.includes(mode) ? mode : "off";
        persistPlaybackState();
        notify("repeat");
        return snapshot();
    }

    function cycleRepeat() {
        const index = REPEAT_MODES.indexOf(state.repeat);
        return setRepeat(REPEAT_MODES[(index + 1) % REPEAT_MODES.length]);
    }

    function setQueue(paths, startPath = "") {
        const available = new Set(state.library.map((track) => track.path));
        const unique = [];
        (paths || []).forEach((path) => {
            if (available.has(path) && !unique.includes(path)) unique.push(path);
        });
        state.queue = unique.length ? unique : state.library.map((track) => track.path);
        if (startPath && state.queue.includes(startPath)) state.currentPath = startPath;
        else if (!state.queue.includes(state.currentPath)) state.currentPath = state.queue[0] || "";
        persistPlaybackState();
        notify("queue");
        return snapshot();
    }

    function updateMediaPosition() {
        if (!("mediaSession" in navigator) || typeof navigator.mediaSession.setPositionState !== "function") return;
        const duration = Number(audio?.duration) || state.duration;
        const position = Math.min(Number(audio?.currentTime) || state.currentTime, duration || 0);
        if (!(duration > 0) || !Number.isFinite(duration) || !Number.isFinite(position)) return;
        try {
            navigator.mediaSession.setPositionState({
                duration,
                playbackRate: audio?.playbackRate || 1,
                position: Math.max(0, position)
            });
        } catch (error) {}
    }

    function updateMediaSession() {
        if (!("mediaSession" in navigator)) return;
        const track = currentTrack();
        try {
            if (typeof window.MediaMetadata === "function") {
                navigator.mediaSession.metadata = track
                    ? new window.MediaMetadata({
                        title: track.title,
                        artist: track.artist,
                        album: track.album,
                        artwork: track.artworkUrl ? [{ src: track.artworkUrl }] : []
                    })
                    : null;
            }
            navigator.mediaSession.playbackState = state.isPlaying ? "playing" : "paused";
        } catch (error) {}
        updateMediaPosition();
    }

    function configureMediaSession() {
        if (!("mediaSession" in navigator) || typeof navigator.mediaSession.setActionHandler !== "function") return;
        const safely = (handler) => (details) => {
            try {
                Promise.resolve(handler(details)).catch(() => {});
            } catch (error) {}
        };
        const handlers = {
            play: () => startPlayback(),
            pause,
            stop: () => stop(),
            previoustrack: previous,
            nexttrack: () => next(),
            seekto: (details) => seek(details.seekTime || 0),
            seekbackward: (details) => seek(state.currentTime - (details.seekOffset || 10)),
            seekforward: (details) => seek(state.currentTime + (details.seekOffset || 10))
        };
        Object.entries(handlers).forEach(([action, handler]) => {
            try {
                navigator.mediaSession.setActionHandler(action, safely(handler));
            } catch (error) {}
        });
    }

    function activateMediaSession() {
        configureMediaSession();
        updateMediaSession();
        return snapshot();
    }

    function bindAudioEvents() {
        const player = ensureAudioElement();
        if (player.dataset.mobileMediaBound === "1") return;
        player.dataset.mobileMediaBound = "1";
        player.addEventListener("loadedmetadata", () => {
            state.duration = Number.isFinite(player.duration) ? player.duration : 0;
            state.currentTime = Number.isFinite(player.currentTime) ? player.currentTime : 0;
            updateMediaPosition();
            notify("metadata");
        });
        player.addEventListener("durationchange", () => {
            state.duration = Number.isFinite(player.duration) ? player.duration : state.duration;
            updateMediaPosition();
            notify("duration");
        });
        player.addEventListener("timeupdate", () => {
            state.currentTime = Number.isFinite(player.currentTime) ? player.currentTime : 0;
            state.duration = Number.isFinite(player.duration) ? player.duration : state.duration;
            updateMediaPosition();
            notify("time");
        });
        player.addEventListener("play", () => {
            state.isPlaying = true;
            updateMediaSession();
            notify("play");
        });
        player.addEventListener("pause", () => {
            state.isPlaying = false;
            updateMediaSession();
            notify("pause");
        });
        player.addEventListener("ended", async () => {
            if (state.repeat === "one") {
                seek(0);
                try {
                    await startPlayback();
                } catch (error) {}
                return;
            }
            try {
                await next({ fromEnded: true });
            } catch (error) {}
        });
        player.addEventListener("error", () => {
            if (!player.getAttribute("src") || !player.error) return;
            state.error = "This browser could not decode the selected audio file.";
            state.isPlaying = false;
            updateMediaSession();
            notify("error");
        });
    }

    function bindSharedEvents() {
        if (window.EventBus && !unsubscribeFilesystem) {
            unsubscribeFilesystem = window.EventBus.on("fs:changed", (event = {}) => {
                if (suppressFilesystemRefresh) return;
                const changedPath = event.path || event.parent || "";
                if (event.action === "sync" || changedPath === MUSIC_ROOT || changedPath.startsWith(`${MUSIC_ROOT}/`)) {
                    refreshLibrary({ background: true });
                }
            });
        }
        if (window.EventBus && !unsubscribeVolume) {
            unsubscribeVolume = window.EventBus.on("volume:changed", (value) => {
                const nextVolume = typeof value === "object" ? value?.newValue : value;
                applyVolume(nextVolume, { persist: false });
            });
        }
        if (window.EventBus && !unsubscribeView) {
            unsubscribeView = window.EventBus.on("view:changed", (view) => {
                const viewName = typeof view === "object" ? view?.view || view?.newValue : view;
                if (viewName === "mobile" && state.currentPath) activateMediaSession();
            });
        }
        if (!unregisterAudioAdapter && typeof window.registerAppAudioAdapter === "function") {
            unregisterAudioAdapter = window.registerAppAudioAdapter("mobile-media-service", {
                setVolume: (value) => applyVolume(value, { persist: false })
            });
        }
    }

    async function init() {
        if (state.status === "ready") return snapshot();
        if (initPromise) return initPromise;
        initPromise = (async () => {
            state.status = "loading";
            state.error = "";
            restorePlaybackState();
            ensureAudioElement();
            bindAudioEvents();
            bindSharedEvents();
            configureMediaSession();
            applyVolume(getSystemVolume(), { persist: false });
            await refreshLibrary();
            return snapshot();
        })().catch((error) => {
            state.status = "error";
            state.error = error?.message || "Music could not be initialized.";
            notify("error");
            throw error;
        }).finally(() => {
            initPromise = null;
        });
        return initPromise;
    }

    window.MobileMediaService = Object.freeze({
        version: "1.0.0",
        musicRoot: MUSIC_ROOT,
        supportedExtensions: [...AUDIO_EXTENSIONS],
        init,
        subscribe,
        getState: snapshot,
        refresh: refreshLibrary,
        importFiles,
        load: loadTrack,
        play,
        pause,
        toggle,
        stop,
        previous,
        next,
        seek,
        activateMediaSession,
        setVolume: applyVolume,
        setShuffle,
        setRepeat,
        cycleRepeat,
        setQueue
    });
})();
