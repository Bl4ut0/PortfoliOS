(function() {
    const APP_ID = "musicmini";
    const MUSIC_ROOT = "/music";
    const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".webm", ".opus", ".aiff", ".aif"];

    const STORE_KEYS = {
        currentPath: "musicmini_current_path_v2",
        shuffle: "musicmini_shuffle_v2",
        repeat: "musicmini_repeat_v2"
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
    let objectUrl = "";
    let unregisterAudio = null;
    let unsubscribeFs = null;

    const appState = {
        library: [],
        currentPath: readStoredValue(STORE_KEYS.currentPath),
        filterText: "",
        notice: "",
        busy: false,
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
        return String(record?.name || "Untitled track").replace(/\.[^.]+$/, "");
    }

    function selectedTrack() {
        return appState.library.find((item) => item.path === appState.currentPath) || null;
    }

    function filteredLibrary() {
        const query = appState.filterText.trim().toLowerCase();
        if (!query) return appState.library;
        return appState.library.filter((item) => item.name.toLowerCase().includes(query));
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

    async function loadLibrary() {
        try {
            await ensureMusicRoot();
            const entries = await window.SystemFS.readDir(MUSIC_ROOT);
            appState.library = entries.filter(isAudioRecord);

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
        } catch (error) {
            setNotice(error.message || "Music library could not be loaded.", true);
        }
    }

    async function importFiles(fileList) {
        const files = Array.from(fileList || []).filter(isAudioFile);
        if (!files.length) {
            setNotice("No supported audio files selected.", true);
            return;
        }

        setBusy(true);
        try {
            await ensureMusicRoot();
            let firstImportedPath = "";

            for (const file of files) {
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
                            originalName: file.name
                        }
                    }
                );

                if (!firstImportedPath) firstImportedPath = record.path;
            }

            appState.currentPath = firstImportedPath || appState.currentPath;
            writeStoredValue(STORE_KEYS.currentPath, appState.currentPath);
            await loadLibrary();
            setNotice(`Imported ${files.length} track${files.length === 1 ? "" : "s"}.`, true);
        } catch (error) {
            setNotice(error.message || "Audio import failed.", true);
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
                        <input type="search" data-mm-search placeholder="Filter tracks" autocomplete="off">
                    </label>
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
                            <button type="button" data-mm-action="upload" title="Upload audio">
                                <i class="fa-solid fa-file-arrow-up"></i>
                            </button>
                            <button type="button" data-mm-action="refresh" title="Refresh library">
                                <i class="fa-solid fa-rotate"></i>
                            </button>
                            <button type="button" data-mm-action="webamp" title="Open selected track in Webamp">
                                <i class="fa-solid fa-wave-square"></i>
                            </button>
                        </div>
                    </header>
                    <div class="musicmini-notice" data-mm-notice hidden></div>
                    <section class="musicmini-now" data-mm-now></section>
                    <section class="musicmini-controls" data-mm-controls></section>
                    <section class="musicmini-dropzone" data-mm-dropzone>
                        <i class="fa-solid fa-folder-open"></i>
                        <strong>Drop audio files</strong>
                        <span>MP3, WAV, OGG, M4A, FLAC, WebM</span>
                    </section>
                </main>
                <input class="musicmini-file-input" type="file" accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus,.aiff,.aif" multiple hidden data-mm-file-input>
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
        if (status) {
            status.textContent = appState.busy
                ? "Working"
                : `${appState.library.length} track${appState.library.length === 1 ? "" : "s"} in /music`;
        }
        if (count) {
            count.textContent = `${appState.library.length} local track${appState.library.length === 1 ? "" : "s"}`;
        }
    }

    function renderNotice() {
        const notice = rootEl?.querySelector("[data-mm-notice]");
        if (!notice) return;
        notice.hidden = !appState.notice;
        notice.textContent = appState.notice || "";
    }

    function renderLibrary() {
        const list = rootEl?.querySelector("[data-mm-library]");
        if (!list) return;

        const items = filteredLibrary();
        if (!items.length) {
            list.innerHTML = `
                <div class="musicmini-empty">
                    <i class="fa-solid fa-compact-disc"></i>
                    <strong>${appState.library.length ? "No matches" : "No local tracks"}</strong>
                    <button type="button" data-mm-action="upload">
                        <i class="fa-solid fa-file-arrow-up"></i>
                        <span>Upload Audio</span>
                    </button>
                </div>
            `;
            return;
        }

        list.innerHTML = items.map((track, index) => {
            const active = track.path === appState.currentPath;
            return `
                <div class="musicmini-track ${active ? "is-active" : ""}">
                    <button type="button" class="musicmini-track-main" data-mm-track="${escapeHtml(track.path)}" title="Play ${escapeHtml(track.name)}">
                        <span class="musicmini-track-index">${active && appState.isPlaying ? `<i class="fa-solid fa-volume-high"></i>` : index + 1}</span>
                        <span class="musicmini-track-copy">
                            <strong>${escapeHtml(trackTitle(track))}</strong>
                            <small>${escapeHtml(formatBytes(track.size))} / ${escapeHtml(track.type || guessMime(track.name))}</small>
                        </span>
                    </button>
                    <button type="button" class="musicmini-track-action" data-mm-remove="${escapeHtml(track.path)}" title="Remove ${escapeHtml(track.name)}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        }).join("");
    }

    function renderNowPlaying() {
        const now = rootEl?.querySelector("[data-mm-now]");
        if (!now) return;
        const track = selectedTrack();
        const title = track ? trackTitle(track) : "No track selected";
        const subtitle = track
            ? `${formatBytes(track.size)} / ${track.type || guessMime(track.name)}`
            : `${appState.library.length} track${appState.library.length === 1 ? "" : "s"} in /music`;

        now.innerHTML = `
            <div class="musicmini-art">
                <i class="fa-solid fa-record-vinyl ${appState.isPlaying ? "is-spinning" : ""}"></i>
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

        if (action === "refresh") {
            await loadLibrary();
            setNotice("Music library refreshed.", false);
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
        await importFiles(event.target.files);
        event.target.value = "";
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
        if (!event.dataTransfer?.files?.length) return;
        event.preventDefault();
        rootEl?.classList.remove("is-dragging");
        await importFiles(event.dataTransfer.files);
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
        renderLibrary();
        renderNowPlaying();
        renderControls();
    }

    function handlePause() {
        appState.isPlaying = false;
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
            cleanupLegacyProviderState();
            unregisterAudio = window.registerAppAudioAdapter?.(APP_ID, { setVolume }) || null;

            rootEl?.addEventListener("click", handleClick);
            rootEl?.addEventListener("input", handleInput);
            rootEl?.addEventListener("dragover", handleDragOver);
            rootEl?.addEventListener("dragleave", handleDragLeave);
            rootEl?.addEventListener("drop", handleDrop);
            fileInputEl?.addEventListener("change", handleFileChange);
            audioEl?.addEventListener("loadedmetadata", handleLoadedMetadata);
            audioEl?.addEventListener("timeupdate", handleTimeUpdate);
            audioEl?.addEventListener("play", handlePlay);
            audioEl?.addEventListener("pause", handlePause);
            audioEl?.addEventListener("ended", handleEnded);

            if (window.EventBus && !unsubscribeFs) {
                unsubscribeFs = window.EventBus.on("fs:changed", (event) => {
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
            rootEl?.removeEventListener("click", handleClick);
            rootEl?.removeEventListener("input", handleInput);
            rootEl?.removeEventListener("dragover", handleDragOver);
            rootEl?.removeEventListener("dragleave", handleDragLeave);
            rootEl?.removeEventListener("drop", handleDrop);
            fileInputEl?.removeEventListener("change", handleFileChange);
            audioEl?.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audioEl?.removeEventListener("timeupdate", handleTimeUpdate);
            audioEl?.removeEventListener("play", handlePlay);
            audioEl?.removeEventListener("pause", handlePause);
            audioEl?.removeEventListener("ended", handleEnded);
            clearLoadedAudio();
            unregisterAudio?.();
            unregisterAudio = null;

            if (unsubscribeFs) {
                unsubscribeFs();
                unsubscribeFs = null;
            }

            rootEl = null;
            audioEl = null;
            fileInputEl = null;
        },
        onMinimize: () => {},
        onMaximize: () => {},
        setVolume
    };
})();
