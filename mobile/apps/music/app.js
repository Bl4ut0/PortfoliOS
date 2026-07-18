(function() {
    const APP_ID = "music";
    const SERVICE_URL = "core/media-service.js?v=1.1.13";
    let rootEl = null;
    let unsubscribe = null;
    let servicePromise = null;
    let latestState = null;
    let librarySignature = "";
    let coverSignature = "";
    let seeking = false;
    let connectionGeneration = 0;

    function escapeHtml(value) {
        if (window.PortfolioOSMobileFramework?.escapeHtml) {
            return window.PortfolioOSMobileFramework.escapeHtml(value);
        }
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatTime(seconds) {
        const total = Math.max(0, Math.floor(Number(seconds) || 0));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const remainder = total % 60;
        return hours
            ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
            : `${minutes}:${String(remainder).padStart(2, "0")}`;
    }

    function formatBytes(bytes) {
        const value = Number(bytes) || 0;
        if (value < 1024) return `${value} B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)} KB`;
        return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
    }

    function ensureService() {
        if (window.MobileMediaService) return Promise.resolve(window.MobileMediaService);
        if (servicePromise) return servicePromise;

        servicePromise = (async () => {
            if (typeof window.loadScript === "function") {
                await window.loadScript(SERVICE_URL);
            } else {
                await new Promise((resolve, reject) => {
                    const existing = document.querySelector(`script[src="${SERVICE_URL}"]`);
                    if (existing) {
                        existing.addEventListener("load", resolve, { once: true });
                        existing.addEventListener("error", reject, { once: true });
                        return;
                    }
                    const script = document.createElement("script");
                    script.src = SERVICE_URL;
                    script.onload = resolve;
                    script.onerror = () => reject(new Error("The mobile music service could not be loaded."));
                    document.head.appendChild(script);
                });
            }
            if (!window.MobileMediaService) throw new Error("The mobile music service did not initialize.");
            return window.MobileMediaService;
        })().finally(() => {
            servicePromise = null;
        });
        return servicePromise;
    }

    function setText(selector, value) {
        const element = rootEl?.querySelector(selector);
        if (element) element.textContent = value;
    }

    function setNotice(message = "", tone = "") {
        const notice = rootEl?.querySelector("[data-music-notice]");
        if (!notice) return;
        notice.textContent = message;
        notice.hidden = !message;
        notice.dataset.tone = tone;
    }

    function filteredTracks(state) {
        const query = String(rootEl?.querySelector("[data-music-search]")?.value || "").trim().toLowerCase();
        if (!query) return state.library;
        return state.library.filter((track) => [track.title, track.artist, track.album, track.name]
            .some((value) => String(value || "").toLowerCase().includes(query)));
    }

    function renderLibrary(state, force = false) {
        const list = rootEl?.querySelector("[data-music-library]");
        if (!list) return;
        const tracks = filteredTracks(state);
        const query = rootEl?.querySelector("[data-music-search]")?.value || "";
        const signature = JSON.stringify({
            query,
            currentPath: state.currentPath,
            isPlaying: state.isPlaying,
            tracks: tracks.map((track) => [track.path, track.lastModified, track.title, track.artist, track.album, track.artworkUrl])
        });
        if (!force && signature === librarySignature) return;
        librarySignature = signature;

        if (!tracks.length) {
            list.innerHTML = `
                <div class="mobile-music-empty">
                    <i class="fa-solid ${state.library.length ? "fa-magnifying-glass" : "fa-headphones"}"></i>
                    <strong>${state.library.length ? "No matching tracks" : "Your library is empty"}</strong>
                    <span>${state.library.length ? "Try another artist, album, or title." : "Import audio saved on this device to build /music."}</span>
                </div>
            `;
            return;
        }

        list.innerHTML = tracks.map((track) => {
            const active = track.path === state.currentPath;
            const artwork = track.artworkUrl
                ? `<img src="${escapeHtml(track.artworkUrl)}" alt="" loading="lazy">`
                : '<i class="fa-solid fa-music"></i>';
            return `
                <button type="button" class="mobile-music-track ${active ? "is-active" : ""}" data-music-track="${escapeHtml(track.path)}" aria-label="Play ${escapeHtml(track.title)} by ${escapeHtml(track.artist)}">
                    <span class="mobile-music-track-art">${artwork}</span>
                    <span class="mobile-music-track-copy">
                        <strong>${escapeHtml(track.title)}</strong>
                        <small>${escapeHtml(track.artist)} · ${escapeHtml(track.album)}</small>
                    </span>
                    <span class="mobile-music-track-tail">
                        ${active && state.isPlaying ? '<i class="fa-solid fa-volume-high" aria-label="Playing"></i>' : `<small>${escapeHtml(formatBytes(track.size))}</small>`}
                    </span>
                </button>
            `;
        }).join("");
    }

    function renderCover(track) {
        const cover = rootEl?.querySelector("[data-music-cover]");
        if (!cover) return;
        const signature = `${track?.path || ""}|${track?.artworkUrl || ""}`;
        if (signature === coverSignature) return;
        coverSignature = signature;
        cover.innerHTML = track?.artworkUrl
            ? `<img src="${escapeHtml(track.artworkUrl)}" alt="Album artwork for ${escapeHtml(track.album)}">`
            : '<div class="mobile-music-cover-fallback"><i class="fa-solid fa-compact-disc"></i></div>';
    }

    function renderState(state, reason = "state") {
        if (!rootEl?.isConnected) return;
        latestState = state;
        const track = state.currentTrack;
        renderCover(track);
        setText("[data-music-title]", track?.title || "Nothing playing");
        setText("[data-music-artist]", track ? `${track.artist} · ${track.album}` : "Import music to get started");
        setText("[data-music-current-time]", formatTime(state.currentTime));
        setText("[data-music-duration]", formatTime(state.duration));
        setText("[data-music-count]", `${state.library.length} track${state.library.length === 1 ? "" : "s"}`);
        setText("[data-music-volume-value]", `${Math.round(state.volume)}%`);

        const playButton = rootEl.querySelector('[data-music-action="toggle"]');
        if (playButton) {
            playButton.innerHTML = `<i class="fa-solid ${state.isPlaying ? "fa-pause" : "fa-play"}"></i>`;
            playButton.setAttribute("aria-label", state.isPlaying ? "Pause" : "Play");
            playButton.disabled = !state.library.length || state.busy;
        }
        rootEl.querySelectorAll('[data-music-action="previous"], [data-music-action="next"], [data-music-action="stop"]')
            .forEach((button) => { button.disabled = !state.library.length || state.busy; });

        const shuffleButton = rootEl.querySelector('[data-music-action="shuffle"]');
        if (shuffleButton) {
            shuffleButton.classList.toggle("is-active", state.shuffle);
            shuffleButton.setAttribute("aria-pressed", String(state.shuffle));
        }
        const repeatButton = rootEl.querySelector('[data-music-action="repeat"]');
        if (repeatButton) {
            repeatButton.classList.toggle("is-active", state.repeat !== "off");
            repeatButton.dataset.repeatMode = state.repeat;
            repeatButton.setAttribute("aria-label", `Repeat ${state.repeat}`);
            repeatButton.setAttribute("aria-pressed", String(state.repeat !== "off"));
            repeatButton.innerHTML = `<i class="fa-solid ${state.repeat === "one" ? "fa-repeat-1" : "fa-repeat"}"></i>`;
        }

        const seek = rootEl.querySelector("[data-music-seek]");
        if (seek && !seeking) {
            seek.max = String(Math.max(1, state.duration || 1));
            seek.value = String(Math.min(state.currentTime || 0, state.duration || 1));
            seek.disabled = !state.duration;
            const ratio = state.duration > 0 ? state.currentTime / state.duration : 0;
            seek.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, ratio * 100))}%`);
        }
        const volume = rootEl.querySelector("[data-music-volume]");
        if (volume && document.activeElement !== volume) volume.value = String(state.volume);

        const importButton = rootEl.querySelector('[data-music-action="import"]');
        if (importButton) {
            importButton.disabled = state.busy;
            importButton.innerHTML = state.busy
                ? `<i class="fa-solid fa-spinner fa-spin"></i><span>${escapeHtml(state.busyLabel || "Working")}</span>`
                : '<i class="fa-solid fa-plus"></i><span>Add music</span>';
        }

        if (state.error) setNotice(state.error, "error");
        else if (reason === "import-complete") setNotice("Music saved locally in /music.", "success");
        else if (reason !== "import-progress" && reason !== "track-loading") setNotice();
        renderLibrary(state);
    }

    async function perform(action) {
        try {
            const service = await ensureService();
            if (action === "toggle") await service.toggle();
            else if (action === "previous") await service.previous();
            else if (action === "next") await service.next();
            else if (action === "stop") service.stop();
            else if (action === "shuffle") service.setShuffle(!service.getState().shuffle);
            else if (action === "repeat") service.cycleRepeat();
            else if (action === "refresh") await service.refresh();
            else if (action === "import") rootEl?.querySelector("[data-music-file-input]")?.click();
        } catch (error) {
            setNotice(error?.message || "The music action failed.", "error");
        }
    }

    async function handleClick(event) {
        const trackButton = event.target.closest("[data-music-track]");
        if (trackButton) {
            try {
                const service = await ensureService();
                await service.play(trackButton.dataset.musicTrack);
            } catch (error) {
                setNotice(error?.message || "That track could not be played.", "error");
            }
            return;
        }
        const actionButton = event.target.closest("[data-music-action]");
        if (actionButton) await perform(actionButton.dataset.musicAction);
    }

    function handleInput(event) {
        if (event.target.matches("[data-music-search]")) {
            if (latestState) renderLibrary(latestState, true);
            return;
        }
        if (event.target.matches("[data-music-seek]")) {
            seeking = true;
            const seconds = Number(event.target.value) || 0;
            setText("[data-music-current-time]", formatTime(seconds));
            const maximum = Number(event.target.max) || 1;
            event.target.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, seconds / maximum * 100))}%`);
            return;
        }
        if (event.target.matches("[data-music-volume]")) {
            const volume = Number(event.target.value) || 0;
            setText("[data-music-volume-value]", `${Math.round(volume)}%`);
            window.MobileMediaService?.setVolume(volume, { persist: false });
        }
    }

    async function handleChange(event) {
        if (event.target.matches("[data-music-file-input]")) {
            const files = event.target.files;
            if (!files?.length) return;
            try {
                const service = await ensureService();
                const result = await service.importFiles(files);
                setNotice(`Added ${result.imported} track${result.imported === 1 ? "" : "s"} to /music.`, "success");
            } catch (error) {
                setNotice(error?.message || "Music import failed.", "error");
            } finally {
                event.target.value = "";
            }
            return;
        }
        if (event.target.matches("[data-music-seek]")) {
            seeking = false;
            window.MobileMediaService?.seek(Number(event.target.value) || 0);
            return;
        }
        if (event.target.matches("[data-music-volume]")) {
            window.MobileMediaService?.setVolume(Number(event.target.value) || 0, { persist: true });
        }
    }

    function bindRoot(root) {
        if (!root || root.dataset.mobileMusicBound === "1") return;
        root.dataset.mobileMusicBound = "1";
        root.addEventListener("click", handleClick);
        root.addEventListener("input", handleInput);
        root.addEventListener("change", handleChange);
    }

    function unbindRoot(root) {
        if (!root || root.dataset.mobileMusicBound !== "1") return;
        root.removeEventListener("click", handleClick);
        root.removeEventListener("input", handleInput);
        root.removeEventListener("change", handleChange);
        delete root.dataset.mobileMusicBound;
    }

    async function connect(root, context = {}) {
        if (context.signal?.aborted) return false;
        const generation = ++connectionGeneration;
        rootEl = root;
        bindRoot(root);
        const service = await ensureService();
        if (context.signal?.aborted || generation !== connectionGeneration || rootEl !== root) return false;
        await service.init();
        if (context.signal?.aborted || generation !== connectionGeneration || rootEl !== root) return false;
        service.activateMediaSession?.();
        unsubscribe?.();
        unsubscribe = service.subscribe(renderState);

        if (!context.intent && (context.path || context.launchIntent)) {
            await handleIntent(root, context);
        }
        return true;
    }

    async function handleIntent(root, context = {}) {
        rootEl = root || rootEl;
        const intent = window.MobileFileIntents?.consume?.(APP_ID, context)
            || context.intent
            || context.launchIntent
            || context;
        const path = intent?.path || "";
        if (!path) return false;
        const service = await ensureService();
        await service.init();
        if (path) {
            try {
                if (intent.action === "open" || intent.autoplay === false) await service.load(path, { autoplay: false });
                else await service.play(path);
                return true;
            } catch (error) {
                setNotice(error?.message || "The requested track could not be opened.", "error");
                return false;
            }
        }
        return false;
    }

    function disconnect(root, context = {}) {
        connectionGeneration++;
        unsubscribe?.();
        unsubscribe = null;
        unbindRoot(root);
        rootEl = null;
        latestState = null;
        librarySignature = "";
        coverSignature = "";
        seeking = false;
        if (["task-close", "dismiss", "clear-recents", "force-stop"].includes(context.reason)) {
            window.MobileMediaService?.stop();
        }
    }

    window.mobileAppRegistry[APP_ID] = {
        title: "Music",
        icon: "fa-solid fa-headphones",
        viewClass: "mobile-music-app",
        render: () => `
            <section class="mobile-music-player" aria-label="Now playing">
                <div class="mobile-music-cover" data-music-cover>
                    <div class="mobile-music-cover-fallback"><i class="fa-solid fa-compact-disc"></i></div>
                </div>
                <div class="mobile-music-now-copy">
                    <span>Now playing</span>
                    <h2 data-music-title>Nothing playing</h2>
                    <p data-music-artist>Import music to get started</p>
                </div>
                <div class="mobile-music-timeline">
                    <input type="range" min="0" max="1" step="0.1" value="0" data-music-seek aria-label="Playback position" disabled>
                    <div><span data-music-current-time>0:00</span><span data-music-duration>0:00</span></div>
                </div>
                <div class="mobile-music-controls">
                    <button type="button" data-music-action="shuffle" aria-label="Shuffle" aria-pressed="false"><i class="fa-solid fa-shuffle"></i></button>
                    <button type="button" data-music-action="previous" aria-label="Previous track" disabled><i class="fa-solid fa-backward-step"></i></button>
                    <button type="button" class="mobile-music-play" data-music-action="toggle" aria-label="Play" disabled><i class="fa-solid fa-play"></i></button>
                    <button type="button" data-music-action="next" aria-label="Next track" disabled><i class="fa-solid fa-forward-step"></i></button>
                    <button type="button" data-music-action="repeat" aria-label="Repeat off" aria-pressed="false"><i class="fa-solid fa-repeat"></i></button>
                </div>
                <div class="mobile-music-volume-row">
                    <i class="fa-solid fa-volume-low"></i>
                    <input type="range" min="0" max="100" step="1" value="70" data-music-volume aria-label="System media volume">
                    <span data-music-volume-value>70%</span>
                    <button type="button" data-music-action="stop" aria-label="Stop playback" disabled><i class="fa-solid fa-stop"></i></button>
                </div>
            </section>

            <p class="mobile-music-notice" data-music-notice role="status" hidden></p>

            <section class="mobile-music-library-section" aria-labelledby="mobile-music-library-title">
                <header class="mobile-music-library-header">
                    <div>
                        <span>On this device</span>
                        <h3 id="mobile-music-library-title">Library</h3>
                    </div>
                    <small data-music-count>0 tracks</small>
                </header>
                <label class="mobile-music-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="search" data-music-search placeholder="Songs, artists, albums" autocomplete="off">
                </label>
                <div class="mobile-music-actions">
                    <button type="button" data-music-action="import"><i class="fa-solid fa-plus"></i><span>Add music</span></button>
                    <button type="button" data-music-action="refresh"><i class="fa-solid fa-rotate"></i><span>Rescan</span></button>
                    <input type="file" data-music-file-input accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus,.aiff,.aif" multiple hidden>
                </div>
                <div class="mobile-music-library" data-music-library>
                    <div class="mobile-music-empty"><i class="fa-solid fa-spinner fa-spin"></i><strong>Opening /music</strong><span>Reading your local SystemFS library.</span></div>
                </div>
            </section>
        `,
        onOpen: connect,
        onResume: connect,
        onIntent: handleIntent,
        onPause: () => {
            connectionGeneration++;
            unsubscribe?.();
            unsubscribe = null;
        },
        onClose: disconnect
    };
})();
