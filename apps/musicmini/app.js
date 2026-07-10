(function() {
    const APP_ID = "musicmini";
    const MUSIC_ROOT = "/music";
    const ARTWORK_ROOT = `${MUSIC_ROOT}/.artwork`;
    const METADATA_SCHEMA = 1;
    const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".webm", ".opus", ".aiff", ".aif"];
    const COVER_FILE_NAMES = ["cover", "folder", "front", "album", "albumart"];
    const BLOCKED_MEDIA_HOSTS = ["youtube.com", "youtu.be", "music.youtube.com", "soundcloud.com", "spotify.com", "open.spotify.com", "music.apple.com"];

    const STORE_KEYS = {
        currentPath: "musicmini_current_path_v2",
        shuffle: "musicmini_shuffle_v2",
        repeat: "musicmini_repeat_v2",
        libraryView: "musicmini_library_view_v3"
    };

    const LEGACY_STORE_KEYS = [
        "musicmini_settings_v1",
        "musicmini_spotify_token_v1",
        "musicmini_spotify_pending_v1",
        "musicmini_active_provider_v1",
        "musicmini_active_tab_v1"
    ];

    let rootEl = null;
    let audioEl = null;
    let fileInputEl = null;
    let folderInputEl = null;
    let objectUrl = "";
    let unregisterAudio = null;
    let unsubscribeFs = null;
    let metadataParserPromise = null;
    let libraryLoadGeneration = 0;
    let suppressFsRefresh = false;
    const artworkUrls = new Map();

    const appState = {
        library: [],
        currentPath: readStoredValue(STORE_KEYS.currentPath),
        filterText: "",
        libraryView: ["albums", "artists", "songs"].includes(readStoredValue(STORE_KEYS.libraryView))
            ? readStoredValue(STORE_KEYS.libraryView)
            : "albums",
        notice: "",
        busy: false,
        busyLabel: "",
        isPlaying: false,
        duration: 0,
        currentTime: 0,
        shuffle: readStoredBool(STORE_KEYS.shuffle, false),
        repeat: readStoredBool(STORE_KEYS.repeat, false)
    };

    function escapeHtml(value) {
        if (window.escapeHtml) return window.escapeHtml(value);
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function readStoredValue(key) {
        try {
            return localStorage.getItem(key) || "";
        } catch (error) {
            return "";
        }
    }

    function writeStoredValue(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {}
    }

    function readStoredBool(key, fallback) {
        const value = readStoredValue(key);
        if (!value) return fallback;
        return value === "1";
    }

    function writeStoredBool(key, value) {
        writeStoredValue(key, value ? "1" : "0");
    }

    function removeStoredValue(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {}

        try {
            sessionStorage.removeItem(key);
        } catch (error) {}
    }

    function cleanupLegacyProviderState() {
        LEGACY_STORE_KEYS.forEach(removeStoredValue);
    }

    function setNotice(message, toast = false) {
        appState.notice = message || "";
        renderNotice();
        if (toast && message) window.showDesktopToast?.(message);
    }

    function setBusy(isBusy) {
        appState.busy = !!isBusy;
        if (!appState.busy) appState.busyLabel = "";
        renderControls();
        renderTopbar();
    }

    function setBusyLabel(label) {
        appState.busy = true;
        appState.busyLabel = label || "Working";
        renderControls();
        renderTopbar();
    }

    function isAudioName(name = "") {
        const lower = String(name).toLowerCase();
        return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
    }

    function isAudioRecord(record) {
        if (!record || record.isDirectory) return false;
        if (String(record.type || "").startsWith("audio/")) return true;
        return record.metadata?.kind === "music" || isAudioName(record.name);
    }

    function isAudioFile(file) {
        if (!file || file.size <= 0) return false;
        if (String(file.type || "").startsWith("audio/")) return true;
        return isAudioName(file.name);
    }

    function isArtworkFile(file) {
        if (!file || file.size <= 0) return false;
        const type = String(file.type || "").toLowerCase();
        const name = String(file.name || "").toLowerCase();
        const base = name.replace(/\.[^.]+$/, "");
        return type.startsWith("image/")
            && COVER_FILE_NAMES.includes(base)
            && /\.(jpe?g|png|webp)$/i.test(name);
    }

    function safeHttpUrl(value) {
        try {
            const url = new URL(String(value || "").trim());
            if (!["http:", "https:"].includes(url.protocol)) return null;
            return url;
        } catch (error) {
            return null;
        }
    }

    function isBlockedMediaPageUrl(url) {
        const host = url.hostname.replace(/^www\./, "").toLowerCase();
        return BLOCKED_MEDIA_HOSTS.some((blockedHost) => host === blockedHost || host.endsWith(`.${blockedHost}`));
    }

    function filenameFromUrl(url, contentType = "") {
        const pathName = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
        const cleanPathName = sanitizeFileName(pathName);
        if (cleanPathName && cleanPathName.includes(".")) return cleanPathName;

        const extensionByType = {
            "audio/mpeg": ".mp3",
            "audio/mp3": ".mp3",
            "audio/wav": ".wav",
            "audio/ogg": ".ogg",
            "audio/mp4": ".m4a",
            "audio/aac": ".aac",
            "audio/flac": ".flac",
            "audio/webm": ".webm"
        };
        const extension = extensionByType[String(contentType || "").split(";")[0].trim().toLowerCase()] || ".mp3";
        return `imported-track-${Date.now()}${extension}`;
    }

    function guessMime(name = "") {
        const lower = String(name).toLowerCase();
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".ogg") || lower.endsWith(".oga") || lower.endsWith(".opus")) return "audio/ogg";
        if (lower.endsWith(".m4a") || lower.endsWith(".aac")) return "audio/mp4";
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".webm")) return "audio/webm";
        if (lower.endsWith(".aiff") || lower.endsWith(".aif")) return "audio/aiff";
        return "audio/mpeg";
    }

    function sanitizeFileName(name = "") {
        const clean = String(name)
            .replace(/[\\/:*?"<>|]/g, "-")
            .replace(/\s+/g, " ")
            .trim();
        return clean || `track-${Date.now()}.mp3`;
    }

    function normalizeRelativePath(value = "") {
        return String(value || "")
            .replace(/\\/g, "/")
            .replace(/^\/+|\/+$/g, "")
            .replace(/\/{2,}/g, "/");
    }

    function directoryFromRelativePath(value = "") {
        const path = normalizeRelativePath(value);
        const slashIndex = path.lastIndexOf("/");
        return slashIndex >= 0 ? path.slice(0, slashIndex) : "";
    }

    function cleanTagText(value, fallback = "") {
        const text = String(value ?? "").replace(/\0/g, "").replace(/\s+/g, " ").trim();
        return text || fallback;
    }

    function tagValue(tags, keys) {
        for (const key of keys) {
            const entry = tags?.[key];
            const value = entry && typeof entry === "object" && "data" in entry ? entry.data : entry;
            if (value !== undefined && value !== null && String(value).trim()) return value;
        }
        return "";
    }

    function parseIndex(value) {
        const match = String(value || "").match(/\d+/);
        return match ? Number.parseInt(match[0], 10) || 0 : 0;
    }

    function inferPathMetadata(relativePath, fallbackName) {
        const normalized = normalizeRelativePath(relativePath || fallbackName);
        const parts = normalized.split("/").filter(Boolean);
        const fileName = parts.pop() || fallbackName || "Untitled track";
        const title = fileName
            .replace(/\.[^.]+$/, "")
            .replace(/^\s*\d{1,3}[\s._-]+/, "")
            .trim() || "Untitled track";
        const album = parts.length ? parts[parts.length - 1] : "Unknown Album";
        const artist = parts.length >= 2 ? parts[parts.length - 2] : "Unknown Artist";
        return { title, artist, album };
    }

    function ensureMetadataParser() {
        if (window.jsmediatags?.read) return Promise.resolve(window.jsmediatags);
        if (metadataParserPromise) return metadataParserPromise;

        metadataParserPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector("script[data-musicmini-tags]");
            const script = existing || document.createElement("script");
            const handleLoad = () => {
                if (window.jsmediatags?.read) resolve(window.jsmediatags);
                else reject(new Error("Audio metadata parser did not initialize."));
            };
            const handleError = () => reject(new Error("Audio metadata parser could not be loaded."));

            script.addEventListener("load", handleLoad, { once: true });
            script.addEventListener("error", handleError, { once: true });
            if (!existing) {
                script.src = "apps/musicmini/vendor/jsmediatags.min.js?v=3.9.7.1";
                script.dataset.musicminiTags = "1";
                document.head.appendChild(script);
            }
        }).catch((error) => {
            metadataParserPromise = null;
            throw error;
        });

        return metadataParserPromise;
    }

    async function readMediaTags(file) {
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

    function pictureBlob(picture) {
        const data = picture?.data;
        if (!data || !data.length) return null;
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        return new Blob([bytes], { type: picture.format || "image/jpeg" });
    }

    function artworkExtension(type = "") {
        const normalized = String(type).toLowerCase();
        if (normalized.includes("png")) return ".png";
        if (normalized.includes("webp")) return ".webp";
        return ".jpg";
    }

    async function blobHash(blob) {
        if (window.crypto?.subtle) {
            const digest = await window.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
            return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
        }
        return `${blob.size}-${blob.type.replace(/\W/g, "")}`;
    }

    async function storeArtwork(blob) {
        if (!(blob instanceof Blob) || !blob.size) return "";
        await window.SystemFS.ensureDirectory(ARTWORK_ROOT, {
            silent: true,
            metadata: { kind: "music-artwork-root", sync: false }
        });
        const name = `${await blobHash(blob)}${artworkExtension(blob.type)}`;
        const path = `${ARTWORK_ROOT}/${name}`;
        if (!await window.SystemFS.readFile(path)) {
            await window.SystemFS.writeFile(path, name, ARTWORK_ROOT, blob, blob.size, blob.type || "image/jpeg", false, {
                silent: true,
                metadata: { kind: "album-artwork", sync: false }
            });
        }
        return path;
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

    function revokeArtworkUrls() {
        artworkUrls.forEach((url) => URL.revokeObjectURL(url));
        artworkUrls.clear();
    }

    async function extractTrackMetadata(file, relativePath = "", fallbackArtwork = null) {
        const inferred = inferPathMetadata(relativePath, file.name);
        const tags = await readMediaTags(file);
        const embeddedArtwork = pictureBlob(tags.picture || tags.APIC || tags.covr);
        const artworkPath = await storeArtwork(embeddedArtwork || fallbackArtwork);
        const artist = cleanTagText(tagValue(tags, ["artist", "TPE1", "\u00a9ART"]), inferred.artist);
        const albumArtist = cleanTagText(tagValue(tags, ["albumArtist", "TPE2", "aART"]), artist);

        return {
            musicMetadataSchema: METADATA_SCHEMA,
            title: cleanTagText(tagValue(tags, ["title", "TIT2", "\u00a9nam"]), inferred.title),
            artist,
            albumArtist,
            album: cleanTagText(tagValue(tags, ["album", "TALB", "\u00a9alb"]), inferred.album),
            year: cleanTagText(tagValue(tags, ["year", "date", "TDRC", "TYER", "\u00a9day"])),
            genre: cleanTagText(tagValue(tags, ["genre", "TCON", "\u00a9gen"])),
            trackNumber: parseIndex(tagValue(tags, ["track", "TRCK", "trkn"])),
            discNumber: parseIndex(tagValue(tags, ["disk", "disc", "TPOS", "disk"])),
            artworkPath,
            relativePath: normalizeRelativePath(relativePath || file.name)
        };
    }

    function formatBytes(size) {
        const value = Number(size) || 0;
        if (value < 1024) return `${value} B`;
        const kb = value / 1024;
        if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
        const mb = kb / 1024;
        return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
    }

    function formatTime(seconds) {
        const total = Math.max(0, Math.floor(Number(seconds) || 0));
        const minutes = Math.floor(total / 60);
        const secs = total % 60;
        return `${minutes}:${String(secs).padStart(2, "0")}`;
    }

    function trackTitle(record) {
        return cleanTagText(record?.metadata?.title, String(record?.name || "Untitled track").replace(/\.[^.]+$/, ""));
    }

    function trackArtist(record) {
        return cleanTagText(record?.metadata?.artist, "Unknown Artist");
    }

    function trackAlbum(record) {
        return cleanTagText(record?.metadata?.album, "Unknown Album");
    }

    function trackAlbumArtist(record) {
        return cleanTagText(record?.metadata?.albumArtist, trackArtist(record));
    }

    function compareTracks(a, b) {
        const fields = [
            trackAlbumArtist(a).localeCompare(trackAlbumArtist(b), undefined, { sensitivity: "base" }),
            trackAlbum(a).localeCompare(trackAlbum(b), undefined, { sensitivity: "base" }),
            (Number(a.metadata?.discNumber) || 0) - (Number(b.metadata?.discNumber) || 0),
            (Number(a.metadata?.trackNumber) || 0) - (Number(b.metadata?.trackNumber) || 0),
            trackTitle(a).localeCompare(trackTitle(b), undefined, { sensitivity: "base" })
        ];
        return fields.find((value) => value !== 0) || 0;
    }

    function selectedTrack() {
        return appState.library.find((item) => item.path === appState.currentPath) || null;
    }

    function filteredLibrary() {
        const query = appState.filterText.trim().toLowerCase();
        if (!query) return appState.library;
        return appState.library.filter((item) => [
            trackTitle(item),
            trackArtist(item),
            trackAlbumArtist(item),
            trackAlbum(item),
            item.metadata?.genre,
            item.name
        ].some((value) => String(value || "").toLowerCase().includes(query)));
    }

    async function ensureMusicRoot() {
        if (!window.SystemFS) throw new Error("System storage is not available.");
        await window.SystemFS.ensureDirectory(MUSIC_ROOT, { silent: true });
    }

    async function getUniqueMusicPath(originalName) {
        const name = sanitizeFileName(originalName);
        const dotIndex = name.lastIndexOf(".");
        const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
        const extension = dotIndex > 0 ? name.slice(dotIndex) : "";
        let candidate = `${MUSIC_ROOT}/${name}`;
        let counter = 2;

        while (await window.SystemFS.readFile(candidate)) {
            candidate = `${MUSIC_ROOT}/${base} (${counter})${extension}`;
            counter += 1;
        }

        return candidate;
    }

    function fileFromRecord(record) {
        const blob = record.data instanceof Blob
            ? record.data
            : new Blob([record.data], { type: record.type || guessMime(record.name) });
        try {
            return new File([blob], record.name, {
                type: record.type || blob.type || guessMime(record.name),
                lastModified: record.lastModified || Date.now()
            });
        } catch (error) {
            return blob;
        }
    }

    async function enrichLibraryRecord(record) {
        let metadata = record.metadata || {};
        if (Number(metadata.musicMetadataSchema) < METADATA_SCHEMA) {
            const file = fileFromRecord(record);
            let extracted;
            try {
                extracted = await extractTrackMetadata(file, metadata.relativePath || metadata.originalName || record.name);
            } catch (error) {
                const inferred = inferPathMetadata(metadata.relativePath || metadata.originalName, record.name);
                extracted = {
                    musicMetadataSchema: METADATA_SCHEMA,
                    ...inferred,
                    albumArtist: inferred.artist,
                    year: "",
                    genre: "",
                    trackNumber: 0,
                    discNumber: 0,
                    artworkPath: "",
                    relativePath: normalizeRelativePath(metadata.relativePath || metadata.originalName || record.name)
                };
            }

            metadata = { ...metadata, ...extracted, kind: "music" };
            record = await window.SystemFS.writeFile(
                record.path,
                record.name,
                record.parent,
                record.data,
                record.size,
                record.type,
                false,
                { silent: true, lastModified: record.lastModified, metadata }
            );
        }

        return {
            ...record,
            metadata,
            _artworkUrl: await artworkUrl(metadata.artworkPath)
        };
    }

    async function loadLibrary() {
        const generation = ++libraryLoadGeneration;
        try {
            await ensureMusicRoot();
            const entries = await window.SystemFS.readDir(MUSIC_ROOT);
            const audioEntries = entries.filter(isAudioRecord);
            const needsScan = audioEntries.some((record) => Number(record.metadata?.musicMetadataSchema) < METADATA_SCHEMA);
            const ownsBusyState = needsScan && !appState.busy;
            const library = [];

            if (needsScan) setBusyLabel(`Scanning 0/${audioEntries.length}`);
            for (let index = 0; index < audioEntries.length; index += 1) {
                if (generation !== libraryLoadGeneration) return;
                if (needsScan) {
                    appState.busyLabel = `Scanning ${index + 1}/${audioEntries.length}`;
                    renderTopbar();
                }
                library.push(await enrichLibraryRecord(audioEntries[index]));
            }
            if (generation !== libraryLoadGeneration) return;
            appState.library = library.sort(compareTracks);

            if (appState.currentPath && !appState.library.some((item) => item.path === appState.currentPath)) {
                appState.currentPath = appState.library[0]?.path || "";
                writeStoredValue(STORE_KEYS.currentPath, appState.currentPath);
                clearLoadedAudio();
            }

            if (!appState.currentPath && appState.library.length) {
                appState.currentPath = appState.library[0].path;
                writeStoredValue(STORE_KEYS.currentPath, appState.currentPath);
            }

            render();
            if (ownsBusyState) setBusy(false);
        } catch (error) {
            if (generation !== libraryLoadGeneration) return;
            setNotice(error.message || "Music library could not be loaded.", true);
            setBusy(false);
        }
    }

    function normalizeImportEntries(fileList) {
        return Array.from(fileList || []).map((entry) => {
            if (entry?.file) {
                return {
                    file: entry.file,
                    relativePath: normalizeRelativePath(entry.relativePath || entry.file.webkitRelativePath || entry.file.name)
                };
            }
            return {
                file: entry,
                relativePath: normalizeRelativePath(entry?.webkitRelativePath || entry?.name)
            };
        }).filter((entry) => entry.file);
    }

    async function importFiles(fileList) {
        const entries = normalizeImportEntries(fileList);
        const audioEntries = entries.filter((entry) => isAudioFile(entry.file));
        if (!audioEntries.length) {
            setNotice("No supported audio files selected.", true);
            return;
        }

        const artworkByDirectory = new Map();
        entries.filter((entry) => isArtworkFile(entry.file)).forEach((entry) => {
            artworkByDirectory.set(directoryFromRelativePath(entry.relativePath), entry.file);
        });

        suppressFsRefresh = true;
        setBusyLabel(`Importing 0/${audioEntries.length}`);
        try {
            await ensureMusicRoot();
            let firstImportedPath = "";

            for (let index = 0; index < audioEntries.length; index += 1) {
                const { file, relativePath } = audioEntries[index];
                appState.busyLabel = `Importing ${index + 1}/${audioEntries.length}`;
                renderTopbar();
                const folderArtwork = artworkByDirectory.get(directoryFromRelativePath(relativePath)) || null;
                const musicMetadata = await extractTrackMetadata(file, relativePath, folderArtwork);
                const path = await getUniqueMusicPath(file.name);
                const name = window.SystemFS.getName(path);
                const record = await window.SystemFS.writeFile(
                    path,
                    name,
                    MUSIC_ROOT,
                    file,
                    file.size,
                    file.type || guessMime(file.name),
                    false,
                    {
                        lastModified: file.lastModified || Date.now(),
                        metadata: {
                            kind: "music",
                            importedAt: Date.now(),
                            originalName: file.name,
                            ...musicMetadata
                        }
                    }
                );

                if (!firstImportedPath) firstImportedPath = record.path;
            }

            appState.currentPath = firstImportedPath || appState.currentPath;
            writeStoredValue(STORE_KEYS.currentPath, appState.currentPath);
            await loadLibrary();
            setNotice(`Imported ${audioEntries.length} track${audioEntries.length === 1 ? "" : "s"}.`, true);
        } catch (error) {
            setNotice(error.message || "Audio import failed.", true);
        } finally {
            suppressFsRefresh = false;
            setBusy(false);
        }
    }

    async function importAudioUrl(urlText) {
        const url = safeHttpUrl(urlText);
        if (!url) {
            setNotice("Enter a direct HTTP audio file URL.", true);
            return;
        }

        if (isBlockedMediaPageUrl(url)) {
            setNotice("Music Mini does not convert streaming/video links. Upload your own audio file or use a direct audio URL you have rights to save.", true);
            return;
        }

        if (!isAudioName(url.pathname)) {
            setNotice("That URL does not look like a direct audio file.", true);
            return;
        }

        suppressFsRefresh = true;
        setBusyLabel("Importing URL");
        try {
            await ensureMusicRoot();
            const response = await fetch(url.toString(), { credentials: "omit" });
            if (!response.ok) throw new Error(`Audio download failed (${response.status}).`);

            const contentType = response.headers.get("content-type") || guessMime(url.pathname);
            if (!String(contentType).startsWith("audio/") && !isAudioName(url.pathname)) {
                throw new Error("The URL did not return an audio file.");
            }

            const blob = await response.blob();
            if (!blob.size) throw new Error("The audio file was empty.");

            const sourceName = filenameFromUrl(url, contentType);
            const metadataFile = new File([blob], sourceName, { type: contentType || blob.type || guessMime(sourceName) });
            const musicMetadata = await extractTrackMetadata(metadataFile, sourceName);
            const path = await getUniqueMusicPath(sourceName);
            const name = window.SystemFS.getName(path);
            const record = await window.SystemFS.writeFile(
                path,
                name,
                MUSIC_ROOT,
                blob,
                blob.size,
                contentType || blob.type || guessMime(name),
                false,
                {
                    metadata: {
                        kind: "music",
                        importedAt: Date.now(),
                        importSource: "direct-url",
                        sourceHost: url.hostname,
                        ...musicMetadata
                    }
                }
            );

            appState.currentPath = record.path;
            writeStoredValue(STORE_KEYS.currentPath, record.path);
            await loadLibrary();
            setNotice(`Imported ${record.name}.`, true);
        } catch (error) {
            const corsHint = /Failed to fetch|NetworkError|CORS/i.test(String(error?.message || error))
                ? " The server may not allow browser downloads; download it locally and upload it instead."
                : "";
            setNotice(`${error.message || "URL import failed."}${corsHint}`, true);
        } finally {
            suppressFsRefresh = false;
            setBusy(false);
        }
    }

    async function syncMusicLibrary() {
        if (!window.GDriveSync) {
            setNotice("Cloud Sync is not available.", true);
            return;
        }

        const token = window.GDriveSync.getToken?.();
        if (!token) {
            setNotice("Connect Google Drive Cloud Sync first.", true);
            return;
        }

        setBusyLabel("Syncing /music");
        try {
            await window.GDriveSync.sync((processed, total, path) => {
                if (!path || path === "Complete" || path === MUSIC_ROOT || path.startsWith(`${MUSIC_ROOT}/`)) {
                    appState.busyLabel = total ? `Sync ${Math.min(processed, total)}/${total}` : "Syncing";
                    renderTopbar();
                }
            });
            await loadLibrary();
            setNotice("Music library synced.", true);
        } catch (error) {
            setNotice(error.message || "Music sync failed.", true);
        } finally {
            setBusy(false);
        }
    }

    function clearLoadedAudio() {
        if (audioEl) {
            audioEl.pause();
            audioEl.removeAttribute("src");
            audioEl.load();
        }

        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = "";
        }

        appState.isPlaying = false;
        appState.duration = 0;
        appState.currentTime = 0;
    }

    async function readTrackBlob(path) {
        const record = await window.SystemFS.readFile(path);
        if (!isAudioRecord(record)) throw new Error("Track is no longer available.");
        const blob = record.data instanceof Blob
            ? record.data
            : new Blob([record.data], { type: record.type || guessMime(record.name) });
        return { record, blob };
    }

    async function loadTrack(path, autoplay = true) {
        if (!path || !audioEl) return;

        try {
            const { record, blob } = await readTrackBlob(path);
            clearLoadedAudio();
            objectUrl = URL.createObjectURL(blob);
            audioEl.src = objectUrl;
            audioEl.load();
            setVolume(window.PortfolioOSAppFramework?.getDesktopVolume?.() ?? 70);
            appState.currentPath = record.path;
            writeStoredValue(STORE_KEYS.currentPath, record.path);
            render();
            updateMediaSession(selectedTrack());

            if (autoplay) {
                await startAudio();
            }
        } catch (error) {
            setNotice(error.message || "Track could not be loaded.", true);
        }
    }

    async function startAudio() {
        if (!audioEl) return;
        if (!audioEl.src) {
            const track = selectedTrack() || appState.library[0];
            if (!track) {
                setNotice("Upload audio before playing.", true);
                return;
            }
            await loadTrack(track.path, false);
        }

        try {
            await audioEl.play();
            appState.isPlaying = true;
            renderControls();
        } catch (error) {
            setNotice("Playback was blocked. Press play again.", true);
        }
    }

    function pauseAudio() {
        audioEl?.pause();
        appState.isPlaying = false;
        renderControls();
    }

    async function playAdjacent(direction) {
        if (!appState.library.length) {
            setNotice("Upload audio before playing.", true);
            return;
        }

        const currentIndex = appState.library.findIndex((item) => item.path === appState.currentPath);
        let nextIndex = currentIndex >= 0 ? currentIndex : 0;

        if (appState.shuffle && appState.library.length > 1) {
            do {
                nextIndex = Math.floor(Math.random() * appState.library.length);
            } while (nextIndex === currentIndex);
        } else {
            nextIndex = (nextIndex + direction + appState.library.length) % appState.library.length;
        }

        await loadTrack(appState.library[nextIndex].path, true);
    }

    async function removeTrack(path) {
        const track = appState.library.find((item) => item.path === path);
        if (!track) return;
        if (!window.confirm?.(`Remove "${track.name}" from Music Mini?`)) return;

        const wasCurrent = path === appState.currentPath;
        try {
            if (wasCurrent) clearLoadedAudio();
            await window.SystemFS.deleteFile(path);
            await loadLibrary();
            setNotice(`Removed ${track.name}.`, true);
        } catch (error) {
            setNotice(error.message || "Track could not be removed.", true);
        }
    }

    async function openInWebamp(path = appState.currentPath) {
        if (!path) {
            setNotice("Select a track first.", true);
            return;
        }

        try {
            const { record, blob } = await readTrackBlob(path);
            await window.openDesktopWindow?.("webamp");
            window.setTimeout(() => {
                const webampApp = window.appRegistry?.webamp;
                if (webampApp && typeof webampApp.playTrack === "function") {
                    webampApp.playTrack(blob, record.name);
                    setNotice(`Sent ${record.name} to Webamp.`, true);
                } else {
                    setNotice("Webamp is not ready yet. Try again in a moment.", true);
                }
            }, 450);
        } catch (error) {
            setNotice(error.message || "Could not open track in Webamp.", true);
        }
    }

    function updateMediaSession(track) {
        if (!("mediaSession" in navigator) || typeof window.MediaMetadata !== "function") return;
        try {
            navigator.mediaSession.metadata = track
                ? new window.MediaMetadata({
                    title: trackTitle(track),
                    artist: trackArtist(track),
                    album: trackAlbum(track),
                    artwork: track._artworkUrl ? [{ src: track._artworkUrl }] : []
                })
                : null;
            navigator.mediaSession.playbackState = appState.isPlaying ? "playing" : "paused";
        } catch (error) {}
    }

    function configureMediaSession() {
        if (!("mediaSession" in navigator) || typeof navigator.mediaSession.setActionHandler !== "function") return;
        const handlers = {
            play: () => startAudio(),
            pause: () => pauseAudio(),
            previoustrack: () => playAdjacent(-1),
            nexttrack: () => playAdjacent(1)
        };
        Object.entries(handlers).forEach(([action, handler]) => {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (error) {}
        });
    }

    function clearMediaSession() {
        if (!("mediaSession" in navigator) || typeof navigator.mediaSession.setActionHandler !== "function") return;
        ["play", "pause", "previoustrack", "nexttrack"].forEach((action) => {
            try {
                navigator.mediaSession.setActionHandler(action, null);
            } catch (error) {}
        });
        try {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = "none";
        } catch (error) {}
    }

    function renderBody() {
        return `
            <div class="musicmini-shell" data-musicmini-root>
                <aside class="musicmini-sidebar" aria-label="Music library">
                    <div class="musicmini-brand">
                        <span class="musicmini-brand-mark"><i class="fa-solid fa-record-vinyl"></i></span>
                        <span>
                            <strong>Music Mini</strong>
                            <small data-mm-library-count>/music</small>
                        </span>
                    </div>
                    <label class="musicmini-search">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="search" data-mm-search placeholder="Search music" autocomplete="off">
                    </label>
                    <div class="musicmini-view-switch" role="tablist" aria-label="Library view">
                        <button type="button" data-mm-view="albums" title="Albums" role="tab">
                            <i class="fa-solid fa-compact-disc"></i><span>Albums</span>
                        </button>
                        <button type="button" data-mm-view="artists" title="Artists" role="tab">
                            <i class="fa-solid fa-user-group"></i><span>Artists</span>
                        </button>
                        <button type="button" data-mm-view="songs" title="Songs" role="tab">
                            <i class="fa-solid fa-music"></i><span>Songs</span>
                        </button>
                    </div>
                    <div class="musicmini-library" data-mm-library></div>
                </aside>
                <main class="musicmini-main">
                    <header class="musicmini-topbar">
                        <div class="musicmini-title-block">
                            <span><i class="fa-solid fa-headphones-simple"></i></span>
                            <span>
                                <strong>Local Library</strong>
                                <small data-mm-status>Ready</small>
                            </span>
                        </div>
                        <div class="musicmini-top-actions">
                            <button type="button" data-mm-action="upload" title="Upload audio files">
                                <i class="fa-solid fa-file-arrow-up"></i>
                            </button>
                            <button type="button" data-mm-action="upload-folder" title="Upload a music folder">
                                <i class="fa-solid fa-folder-plus"></i>
                            </button>
                            <button type="button" data-mm-action="refresh" title="Refresh library">
                                <i class="fa-solid fa-rotate"></i>
                            </button>
                            <button type="button" data-mm-action="sync" title="Sync /music with Cloud Sync">
                                <i class="fa-solid fa-cloud-arrow-down"></i>
                            </button>
                            <button type="button" data-mm-action="webamp" title="Open selected track in Webamp">
                                <i class="fa-solid fa-wave-square"></i>
                            </button>
                        </div>
                    </header>
                    <div class="musicmini-notice" data-mm-notice hidden></div>
                    <section class="musicmini-now" data-mm-now></section>
                    <section class="musicmini-controls" data-mm-controls></section>
                    <form class="musicmini-url-import" data-mm-url-form>
                        <label>
                            <i class="fa-solid fa-link"></i>
                            <input type="url" data-mm-url-input placeholder="https://example.com/track.mp3" autocomplete="off">
                        </label>
                        <button type="submit" title="Save direct audio URL">
                            <i class="fa-solid fa-cloud-arrow-down"></i>
                        </button>
                    </form>
                    <section class="musicmini-dropzone" data-mm-dropzone>
                        <i class="fa-solid fa-folder-open"></i>
                        <strong>Drop files or music folders</strong>
                        <span>Tags and cover images are processed locally</span>
                    </section>
                </main>
                <input class="musicmini-file-input" type="file" accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus,.aiff,.aif" multiple hidden data-mm-file-input>
                <input class="musicmini-file-input" type="file" accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus,.aiff,.aif,image/jpeg,image/png,image/webp" webkitdirectory directory multiple hidden data-mm-folder-input>
                <audio data-mm-audio preload="metadata"></audio>
            </div>
        `;
    }

    function render() {
        if (!rootEl) return;
        renderTopbar();
        renderNotice();
        renderLibrary();
        renderNowPlaying();
        renderControls();
        updateProgressUI();
    }

    function renderTopbar() {
        if (!rootEl) return;
        const status = rootEl.querySelector("[data-mm-status]");
        const count = rootEl.querySelector("[data-mm-library-count]");
        const albumCount = new Set(appState.library.map((track) => `${trackAlbumArtist(track)}\0${trackAlbum(track)}`)).size;
        if (status) {
            status.textContent = appState.busy
                ? appState.busyLabel || "Working"
                : `${appState.library.length} track${appState.library.length === 1 ? "" : "s"} / ${albumCount} album${albumCount === 1 ? "" : "s"}`;
        }
        if (count) {
            count.textContent = `${albumCount} album${albumCount === 1 ? "" : "s"} in /music`;
        }
    }

    function renderNotice() {
        const notice = rootEl?.querySelector("[data-mm-notice]");
        if (!notice) return;
        notice.hidden = !appState.notice;
        notice.textContent = appState.notice || "";
    }

    function artworkContent(track, fallbackIcon = "fa-compact-disc") {
        if (track?._artworkUrl) {
            return `<img src="${escapeHtml(track._artworkUrl)}" alt="" draggable="false">`;
        }
        return `<i class="fa-solid ${fallbackIcon}"></i>`;
    }

    function groupLibrary(items, keyForTrack) {
        const groups = new Map();
        items.forEach((track) => {
            const key = keyForTrack(track);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(track);
        });
        return Array.from(groups.values());
    }

    function renderTrackRow(track, index, detail) {
        const active = track.path === appState.currentPath;
        return `
            <div class="musicmini-track ${active ? "is-active" : ""}">
                <button type="button" class="musicmini-track-main" data-mm-track="${escapeHtml(track.path)}" title="Play ${escapeHtml(trackTitle(track))}">
                    <span class="musicmini-track-art">
                        ${artworkContent(track, "fa-music")}
                        ${active && appState.isPlaying ? `<i class="fa-solid fa-volume-high musicmini-playing-badge"></i>` : ""}
                    </span>
                    <span class="musicmini-track-copy">
                        <strong>${escapeHtml(trackTitle(track))}</strong>
                        <small>${escapeHtml(detail)}</small>
                    </span>
                    <span class="musicmini-track-number">${Number(track.metadata?.trackNumber) || index + 1}</span>
                </button>
                <button type="button" class="musicmini-track-action" data-mm-remove="${escapeHtml(track.path)}" title="Remove ${escapeHtml(track.name)}">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
    }

    function renderAlbumGroups(items) {
        return groupLibrary(items, (track) => `${trackAlbumArtist(track)}\0${trackAlbum(track)}`).map((tracks) => {
            const lead = tracks[0];
            const year = cleanTagText(lead.metadata?.year);
            const detail = `${trackAlbumArtist(lead)} / ${tracks.length} track${tracks.length === 1 ? "" : "s"}${year ? ` / ${year}` : ""}`;
            return `
                <section class="musicmini-library-group">
                    <button type="button" class="musicmini-group-header" data-mm-track="${escapeHtml(lead.path)}" title="Play ${escapeHtml(trackAlbum(lead))}">
                        <span class="musicmini-group-art">${artworkContent(lead)}</span>
                        <span class="musicmini-group-copy">
                            <strong>${escapeHtml(trackAlbum(lead))}</strong>
                            <small>${escapeHtml(detail)}</small>
                        </span>
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <div class="musicmini-group-tracks">
                        ${tracks.map((track, index) => renderTrackRow(track, index, trackArtist(track))).join("")}
                    </div>
                </section>
            `;
        }).join("");
    }

    function renderArtistGroups(items) {
        return groupLibrary(items, trackArtist).map((tracks) => {
            const lead = tracks[0];
            const albumCount = new Set(tracks.map(trackAlbum)).size;
            return `
                <section class="musicmini-library-group">
                    <button type="button" class="musicmini-group-header is-artist" data-mm-track="${escapeHtml(lead.path)}" title="Play ${escapeHtml(trackArtist(lead))}">
                        <span class="musicmini-group-art">${artworkContent(lead, "fa-user")}</span>
                        <span class="musicmini-group-copy">
                            <strong>${escapeHtml(trackArtist(lead))}</strong>
                            <small>${albumCount} album${albumCount === 1 ? "" : "s"} / ${tracks.length} track${tracks.length === 1 ? "" : "s"}</small>
                        </span>
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <div class="musicmini-group-tracks">
                        ${tracks.map((track, index) => renderTrackRow(track, index, trackAlbum(track))).join("")}
                    </div>
                </section>
            `;
        }).join("");
    }

    function renderLibrary() {
        const list = rootEl?.querySelector("[data-mm-library]");
        if (!list) return;

        rootEl.querySelectorAll("[data-mm-view]").forEach((button) => {
            const active = button.dataset.mmView === appState.libraryView;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", active ? "true" : "false");
        });

        const items = filteredLibrary();
        if (!items.length) {
            list.innerHTML = `
                <div class="musicmini-empty">
                    <i class="fa-solid fa-compact-disc"></i>
                    <strong>${appState.library.length ? "No matches" : "No local tracks"}</strong>
                    <button type="button" data-mm-action="upload">
                        <i class="fa-solid fa-file-arrow-up"></i>
                        <span>Upload Music</span>
                    </button>
                </div>
            `;
            return;
        }

        if (appState.libraryView === "albums") {
            list.innerHTML = renderAlbumGroups(items);
            return;
        }

        if (appState.libraryView === "artists") {
            list.innerHTML = renderArtistGroups(items);
            return;
        }

        list.innerHTML = items.map((track, index) => renderTrackRow(
            track,
            index,
            `${trackArtist(track)} / ${trackAlbum(track)}`
        )).join("");
    }

    function renderNowPlaying() {
        const now = rootEl?.querySelector("[data-mm-now]");
        if (!now) return;
        const track = selectedTrack();
        const title = track ? trackTitle(track) : "No track selected";
        const subtitle = track
            ? `${trackArtist(track)} / ${trackAlbum(track)}`
            : `${appState.library.length} track${appState.library.length === 1 ? "" : "s"} in /music`;

        now.innerHTML = `
            <div class="musicmini-art">
                ${track ? artworkContent(track, `fa-record-vinyl ${appState.isPlaying ? "is-spinning" : ""}`) : `<i class="fa-solid fa-record-vinyl"></i>`}
            </div>
            <div class="musicmini-now-copy">
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(subtitle)}</span>
                <div class="musicmini-progress-row">
                    <small data-mm-current-time>${formatTime(appState.currentTime)}</small>
                    <input class="musicmini-seek" type="range" min="0" max="1000" value="0" data-mm-seek ${appState.duration ? "" : "disabled"} title="Seek">
                    <small data-mm-duration>${formatTime(appState.duration)}</small>
                </div>
            </div>
        `;
    }

    function renderControls() {
        const controls = rootEl?.querySelector("[data-mm-controls]");
        if (!controls) return;
        const hasTracks = appState.library.length > 0;

        controls.innerHTML = `
            <button type="button" data-mm-action="previous" title="Previous" ${hasTracks && !appState.busy ? "" : "disabled"}>
                <i class="fa-solid fa-backward-step"></i>
            </button>
            <button type="button" class="musicmini-play" data-mm-action="toggle" title="${appState.isPlaying ? "Pause" : "Play"}" ${hasTracks && !appState.busy ? "" : "disabled"}>
                <i class="fa-solid ${appState.isPlaying ? "fa-pause" : "fa-play"}"></i>
            </button>
            <button type="button" data-mm-action="next" title="Next" ${hasTracks && !appState.busy ? "" : "disabled"}>
                <i class="fa-solid fa-forward-step"></i>
            </button>
            <button type="button" class="${appState.shuffle ? "is-active" : ""}" data-mm-action="shuffle" title="Shuffle">
                <i class="fa-solid fa-shuffle"></i>
            </button>
            <button type="button" class="${appState.repeat ? "is-active" : ""}" data-mm-action="repeat" title="Repeat current track">
                <i class="fa-solid fa-repeat"></i>
            </button>
            <button type="button" data-mm-action="webamp" title="Open selected track in Webamp" ${hasTracks ? "" : "disabled"}>
                <i class="fa-solid fa-wave-square"></i>
            </button>
        `;
    }

    function updateProgressUI() {
        if (!rootEl) return;
        const duration = Number.isFinite(audioEl?.duration) ? audioEl.duration : appState.duration;
        const current = Number.isFinite(audioEl?.currentTime) ? audioEl.currentTime : appState.currentTime;
        appState.duration = duration || 0;
        appState.currentTime = current || 0;

        const currentTime = rootEl.querySelector("[data-mm-current-time]");
        const durationTime = rootEl.querySelector("[data-mm-duration]");
        const seek = rootEl.querySelector("[data-mm-seek]");
        const progress = appState.duration > 0 ? Math.min(1000, Math.max(0, appState.currentTime / appState.duration * 1000)) : 0;

        if (currentTime) currentTime.textContent = formatTime(appState.currentTime);
        if (durationTime) durationTime.textContent = formatTime(appState.duration);
        if (seek) {
            seek.disabled = !appState.duration;
            if (document.activeElement !== seek) seek.value = String(Math.round(progress));
        }
    }

    async function handleAction(action) {
        if (action === "upload") {
            fileInputEl?.click();
            return;
        }

        if (action === "upload-folder") {
            folderInputEl?.click();
            return;
        }

        if (action === "refresh") {
            await loadLibrary();
            setNotice("Music library refreshed.", false);
            return;
        }

        if (action === "sync") {
            await syncMusicLibrary();
            return;
        }

        if (action === "toggle") {
            if (appState.isPlaying) pauseAudio();
            else await startAudio();
            return;
        }

        if (action === "previous") {
            await playAdjacent(-1);
            return;
        }

        if (action === "next") {
            await playAdjacent(1);
            return;
        }

        if (action === "shuffle") {
            appState.shuffle = !appState.shuffle;
            writeStoredBool(STORE_KEYS.shuffle, appState.shuffle);
            renderControls();
            return;
        }

        if (action === "repeat") {
            appState.repeat = !appState.repeat;
            writeStoredBool(STORE_KEYS.repeat, appState.repeat);
            renderControls();
            return;
        }

        if (action === "webamp") {
            await openInWebamp();
        }
    }

    async function handleClick(event) {
        const removeButton = event.target.closest("[data-mm-remove]");
        if (removeButton) {
            await removeTrack(removeButton.dataset.mmRemove);
            return;
        }

        const viewButton = event.target.closest("[data-mm-view]");
        if (viewButton) {
            appState.libraryView = viewButton.dataset.mmView;
            writeStoredValue(STORE_KEYS.libraryView, appState.libraryView);
            renderLibrary();
            return;
        }

        const actionButton = event.target.closest("[data-mm-action]");
        if (actionButton) {
            await handleAction(actionButton.dataset.mmAction);
            return;
        }

        const trackButton = event.target.closest("[data-mm-track]");
        if (trackButton) {
            await loadTrack(trackButton.dataset.mmTrack, true);
        }
    }

    async function handleSubmit(event) {
        const form = event.target.closest("[data-mm-url-form]");
        if (!form) return;
        event.preventDefault();
        const input = form.querySelector("[data-mm-url-input]");
        const value = input?.value || "";
        await importAudioUrl(value);
        if (input) input.value = "";
    }

    function handleInput(event) {
        if (event.target.matches("[data-mm-search]")) {
            appState.filterText = event.target.value || "";
            renderLibrary();
            return;
        }

        if (event.target.matches("[data-mm-seek]") && audioEl && appState.duration) {
            const ratio = Math.max(0, Math.min(1000, Number(event.target.value) || 0)) / 1000;
            audioEl.currentTime = ratio * appState.duration;
            updateProgressUI();
        }
    }

    async function handleFileChange(event) {
        await importFiles(Array.from(event.target.files || []).map((file) => ({
            file,
            relativePath: file.webkitRelativePath || file.name
        })));
        event.target.value = "";
    }

    function readFileEntry(entry, relativePath) {
        return new Promise((resolve, reject) => {
            entry.file(
                (file) => resolve({ file, relativePath: normalizeRelativePath(relativePath || file.name) }),
                reject
            );
        });
    }

    function readDirectoryBatch(reader) {
        return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    }

    async function readDirectoryEntries(entry) {
        const reader = entry.createReader();
        const entries = [];
        while (true) {
            const batch = await readDirectoryBatch(reader);
            if (!batch.length) return entries;
            entries.push(...batch);
        }
    }

    async function walkDroppedEntry(entry, prefix, results) {
        if (entry.isFile) {
            results.push(await readFileEntry(entry, `${prefix}${entry.name}`));
            return;
        }
        if (!entry.isDirectory) return;

        const directoryPrefix = `${prefix}${entry.name}/`;
        const children = await readDirectoryEntries(entry);
        for (const child of children) {
            await walkDroppedEntry(child, directoryPrefix, results);
        }
    }

    async function droppedImportEntries(dataTransfer) {
        const transferItems = Array.from(dataTransfer?.items || []);
        const entryItems = transferItems
            .map((item) => item.webkitGetAsEntry?.())
            .filter(Boolean);
        if (!entryItems.length) {
            return Array.from(dataTransfer?.files || []).map((file) => ({ file, relativePath: file.name }));
        }

        const results = [];
        for (const entry of entryItems) {
            await walkDroppedEntry(entry, "", results);
        }
        return results;
    }

    function handleDragOver(event) {
        if (!event.dataTransfer?.types?.includes("Files")) return;
        event.preventDefault();
        rootEl?.classList.add("is-dragging");
    }

    function handleDragLeave(event) {
        if (rootEl && !rootEl.contains(event.relatedTarget)) {
            rootEl.classList.remove("is-dragging");
        }
    }

    async function handleDrop(event) {
        if (!event.dataTransfer?.items?.length && !event.dataTransfer?.files?.length) return;
        event.preventDefault();
        rootEl?.classList.remove("is-dragging");
        setBusyLabel("Reading folder");
        try {
            const entries = await droppedImportEntries(event.dataTransfer);
            await importFiles(entries);
        } catch (error) {
            setNotice(error.message || "That folder could not be read.", true);
            setBusy(false);
        }
    }

    function handleLoadedMetadata() {
        appState.duration = Number.isFinite(audioEl?.duration) ? audioEl.duration : 0;
        renderNowPlaying();
        updateProgressUI();
    }

    function handleTimeUpdate() {
        updateProgressUI();
    }

    function handlePlay() {
        appState.isPlaying = true;
        updateMediaSession(selectedTrack());
        renderLibrary();
        renderNowPlaying();
        renderControls();
    }

    function handlePause() {
        appState.isPlaying = false;
        updateMediaSession(selectedTrack());
        renderLibrary();
        renderNowPlaying();
        renderControls();
    }

    async function handleEnded() {
        if (appState.repeat && audioEl) {
            audioEl.currentTime = 0;
            await startAudio();
            return;
        }

        if (appState.library.length > 1) {
            await playAdjacent(1);
            return;
        }

        appState.isPlaying = false;
        renderControls();
    }

    function setVolume(volume) {
        if (!audioEl) return;
        const nextVolume = Math.max(0, Math.min(100, Number(volume) || 0));
        audioEl.volume = nextVolume / 100;
    }

    window.appRegistry[APP_ID] = {
        title: "music-mini.exe",
        icon: "fa-solid fa-record-vinyl",
        windowClass: "musicmini-window media-window",
        renderBody,
        onOpen: async (windowEl) => {
            rootEl = windowEl.querySelector("[data-musicmini-root]");
            audioEl = windowEl.querySelector("[data-mm-audio]");
            fileInputEl = windowEl.querySelector("[data-mm-file-input]");
            folderInputEl = windowEl.querySelector("[data-mm-folder-input]");
            cleanupLegacyProviderState();
            unregisterAudio = window.registerAppAudioAdapter?.(APP_ID, { setVolume }) || null;
            configureMediaSession();

            rootEl?.addEventListener("click", handleClick);
            rootEl?.addEventListener("submit", handleSubmit);
            rootEl?.addEventListener("input", handleInput);
            rootEl?.addEventListener("dragover", handleDragOver);
            rootEl?.addEventListener("dragleave", handleDragLeave);
            rootEl?.addEventListener("drop", handleDrop);
            fileInputEl?.addEventListener("change", handleFileChange);
            folderInputEl?.addEventListener("change", handleFileChange);
            audioEl?.addEventListener("loadedmetadata", handleLoadedMetadata);
            audioEl?.addEventListener("timeupdate", handleTimeUpdate);
            audioEl?.addEventListener("play", handlePlay);
            audioEl?.addEventListener("pause", handlePause);
            audioEl?.addEventListener("ended", handleEnded);

            if (window.EventBus && !unsubscribeFs) {
                unsubscribeFs = window.EventBus.on("fs:changed", (event) => {
                    if (suppressFsRefresh) return;
                    const changedPath = event?.path || event?.parent || "";
                    if (event?.action === "sync" || changedPath === MUSIC_ROOT || changedPath.startsWith(`${MUSIC_ROOT}/`)) {
                        loadLibrary();
                    }
                });
            }

            await loadLibrary();
            rootEl?.querySelector("[data-mm-search], button")?.focus({ preventScroll: true });
        },
        onClose: () => {
            libraryLoadGeneration++;
            rootEl?.removeEventListener("click", handleClick);
            rootEl?.removeEventListener("submit", handleSubmit);
            rootEl?.removeEventListener("input", handleInput);
            rootEl?.removeEventListener("dragover", handleDragOver);
            rootEl?.removeEventListener("dragleave", handleDragLeave);
            rootEl?.removeEventListener("drop", handleDrop);
            fileInputEl?.removeEventListener("change", handleFileChange);
            folderInputEl?.removeEventListener("change", handleFileChange);
            audioEl?.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audioEl?.removeEventListener("timeupdate", handleTimeUpdate);
            audioEl?.removeEventListener("play", handlePlay);
            audioEl?.removeEventListener("pause", handlePause);
            audioEl?.removeEventListener("ended", handleEnded);
            clearLoadedAudio();
            clearMediaSession();
            revokeArtworkUrls();
            unregisterAudio?.();
            unregisterAudio = null;

            if (unsubscribeFs) {
                unsubscribeFs();
                unsubscribeFs = null;
            }

            rootEl = null;
            audioEl = null;
            fileInputEl = null;
            folderInputEl = null;
        },
        onMinimize: () => {},
        onMaximize: () => {},
        setVolume
    };
})();
