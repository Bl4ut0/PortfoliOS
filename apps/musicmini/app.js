(function() {
    const APP_ID = "musicmini";
    const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
    const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
    const SPOTIFY_API_URL = "https://api.spotify.com/v1";
    const SPOTIFY_SDK_URL = "https://sdk.scdn.co/spotify-player.js";
    const YOUTUBE_API_URL = "https://www.youtube.com/iframe_api";
    const SOUNDCLOUD_WIDGET_URL = "https://w.soundcloud.com/player/api.js";
    const MUSICKIT_URL = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";

    const STORE_KEYS = {
        settings: "musicmini_settings_v1",
        spotifyToken: "musicmini_spotify_token_v1",
        spotifyPending: "musicmini_spotify_pending_v1",
        activeProvider: "musicmini_active_provider_v1",
        activeTab: "musicmini_active_tab_v1"
    };

    const SPOTIFY_SCOPES = [
        "streaming",
        "user-read-email",
        "user-read-private",
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-read-currently-playing",
        "playlist-read-private",
        "playlist-read-collaborative",
        "user-library-read",
        "user-read-recently-played"
    ];

    const PROVIDERS = {
        spotify: {
            label: "Spotify",
            icon: "fa-brands fa-spotify",
            status: "OAuth player"
        },
        youtube: {
            label: "YouTube",
            icon: "fa-brands fa-youtube",
            status: "Video and playlist player"
        },
        apple: {
            label: "Apple Music",
            icon: "fa-solid fa-music",
            status: "Embed and MusicKit"
        },
        soundcloud: {
            label: "SoundCloud",
            icon: "fa-brands fa-soundcloud",
            status: "Widget player"
        }
    };

    let rootEl = null;
    let unregisterAudio = null;
    let spotifyPlayer = null;
    let spotifyDeviceId = "";
    let spotifyPollTimer = null;
    let spotifySdkPromise = null;
    let youtubeApiPromise = null;
    let youtubePlayer = null;
    let soundCloudScriptPromise = null;
    let soundCloudWidget = null;
    let musicKitPromise = null;
    let musicKitInstance = null;

    const appState = {
        activeProvider: readStoredValue(STORE_KEYS.activeProvider) || "spotify",
        activeTab: readStoredValue(STORE_KEYS.activeTab) || "home",
        notice: "",
        settings: loadSettings(),
        spotify: {
            profile: null,
            playback: null,
            playlists: [],
            savedTracks: [],
            recentTracks: [],
            searchResults: null,
            status: "Disconnected",
            busy: false
        },
        youtube: {
            status: "Ready",
            currentUrl: "",
            ready: false
        },
        apple: {
            status: "Ready",
            currentUrl: "",
            searchResults: null,
            authorized: false
        },
        soundcloud: {
            status: "Ready",
            currentUrl: "",
            title: "",
            ready: false
        }
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

    function removeStoredValue(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {}
    }

    function readStoredJson(key, fallback = null) {
        const raw = readStoredValue(key);
        if (!raw) return fallback;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    }

    function writeStoredJson(key, value) {
        writeStoredValue(key, JSON.stringify(value));
    }

    function readSessionValue(key) {
        try {
            return sessionStorage.getItem(key) || "";
        } catch (error) {
            return "";
        }
    }

    function writeSessionValue(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (error) {}
    }

    function removeSessionValue(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (error) {}
    }

    function readSessionJson(key, fallback = null) {
        const raw = readSessionValue(key);
        if (!raw) return fallback;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    }

    function writeSessionJson(key, value) {
        writeSessionValue(key, JSON.stringify(value));
    }

    function removeSensitiveStorage(key) {
        removeSessionValue(key);
        removeStoredValue(key);
    }

    removeStoredValue(STORE_KEYS.spotifyToken);
    removeStoredValue(STORE_KEYS.spotifyPending);

    function defaultRedirectUri() {
        return `${window.location.origin}${window.location.pathname}`;
    }

    function getOwnerConfig() {
        const config = window.musicMiniConfig || {};
        const spotify = config.spotify || {};
        const apple = config.apple || {};

        return {
            spotifyClientId: spotify.clientId || "",
            spotifyRedirectUri: spotify.redirectUri || defaultRedirectUri(),
            spotifyMarket: spotify.market || "US",
            appleDeveloperToken: apple.developerToken || "",
            appleDeveloperTokenEndpoint: apple.developerTokenEndpoint || ""
        };
    }

    function loadSettings() {
        const saved = readStoredJson(STORE_KEYS.settings, {});
        const ownerConfig = getOwnerConfig();
        return {
            spotifyClientId: ownerConfig.spotifyClientId,
            spotifyRedirectUri: ownerConfig.spotifyRedirectUri,
            spotifyMarket: ownerConfig.spotifyMarket,
            youtubeUrl: saved.youtubeUrl || "",
            appleUrl: saved.appleUrl || "",
            appleDeveloperToken: ownerConfig.appleDeveloperToken,
            appleDeveloperTokenEndpoint: ownerConfig.appleDeveloperTokenEndpoint,
            soundcloudUrl: saved.soundcloudUrl || ""
        };
    }

    function saveSettings(nextSettings = {}) {
        const ownerConfig = getOwnerConfig();
        appState.settings = {
            ...appState.settings,
            ...nextSettings,
            spotifyClientId: ownerConfig.spotifyClientId,
            spotifyRedirectUri: ownerConfig.spotifyRedirectUri,
            spotifyMarket: ownerConfig.spotifyMarket,
            appleDeveloperToken: ownerConfig.appleDeveloperToken,
            appleDeveloperTokenEndpoint: ownerConfig.appleDeveloperTokenEndpoint
        };
        writeStoredJson(STORE_KEYS.settings, {
            youtubeUrl: appState.settings.youtubeUrl,
            appleUrl: appState.settings.appleUrl,
            soundcloudUrl: appState.settings.soundcloudUrl
        });
    }

    function getSpotifyToken() {
        return readSessionJson(STORE_KEYS.spotifyToken, null);
    }

    function setSpotifyToken(token) {
        writeSessionJson(STORE_KEYS.spotifyToken, {
            access_token: token.access_token,
            refresh_token: token.refresh_token || getSpotifyToken()?.refresh_token || "",
            expires_at: Date.now() + Math.max(0, Number(token.expires_in || 3600) - 30) * 1000,
            token_type: token.token_type || "Bearer"
        });
    }

    function hasSpotifyToken() {
        return !!getSpotifyToken()?.access_token;
    }

    function setNotice(message, toast = false) {
        appState.notice = message || "";
        if (toast && message) window.showDesktopToast?.(message);
        render();
    }

    function setProvider(provider) {
        if (!PROVIDERS[provider]) return;
        appState.activeProvider = provider;
        writeStoredValue(STORE_KEYS.activeProvider, provider);
        if (provider !== "spotify") {
            appState.activeTab = "home";
            writeStoredValue(STORE_KEYS.activeTab, "home");
        }
        render();
        restoreProviderRuntime();
    }

    function setTab(tab) {
        appState.activeTab = tab;
        writeStoredValue(STORE_KEYS.activeTab, tab);
        render();
    }

    function safeHttpUrl(value) {
        try {
            const url = new URL(String(value || "").trim());
            if (!["http:", "https:"].includes(url.protocol)) return "";
            return url.toString();
        } catch (error) {
            return "";
        }
    }

    function isHost(url, fragments) {
        const host = url.hostname.replace(/^www\./, "").toLowerCase();
        return fragments.some((fragment) => host === fragment || host.endsWith(`.${fragment}`));
    }

    function renderBody() {
        return `
            <div class="musicmini-shell" data-musicmini-root>
                <aside class="musicmini-sidebar" aria-label="Music providers">
                    <div class="musicmini-brand">
                        <span class="musicmini-brand-mark"><i class="fa-solid fa-record-vinyl"></i></span>
                        <span>
                            <strong>Music Mini</strong>
                            <small>Spotify support</small>
                        </span>
                    </div>
                    <div class="musicmini-provider-list" data-mm-provider-list></div>
                    <div class="musicmini-account" data-mm-account></div>
                </aside>
                <main class="musicmini-main">
                    <header class="musicmini-topbar">
                        <div class="musicmini-title-block">
                            <span data-mm-provider-icon></span>
                            <span>
                                <strong data-mm-provider-title>Music</strong>
                                <small data-mm-provider-status></small>
                            </span>
                        </div>
                        <div class="musicmini-top-actions">
                            <button type="button" data-mm-refresh title="Refresh">
                                <i class="fa-solid fa-rotate"></i>
                            </button>
                            <button type="button" data-mm-tab="settings" title="Settings">
                                <i class="fa-solid fa-sliders"></i>
                            </button>
                        </div>
                    </header>
                    <div class="musicmini-notice" data-mm-notice hidden></div>
                    <section class="musicmini-now" data-mm-now></section>
                    <section class="musicmini-controls" data-mm-controls></section>
                    <nav class="musicmini-tabs" data-mm-tabs aria-label="Music Mini sections"></nav>
                    <section class="musicmini-panel" data-mm-panel></section>
                </main>
            </div>
        `;
    }

    function render() {
        if (!rootEl) return;
        renderProviders();
        renderTopbar();
        renderAccount();
        renderNotice();
        renderNowPlaying();
        renderControls();
        renderTabs();
        renderPanel();
    }

    function renderProviders() {
        const list = rootEl.querySelector("[data-mm-provider-list]");
        if (!list) return;

        list.innerHTML = Object.entries(PROVIDERS).map(([id, provider]) => `
            <button type="button" class="musicmini-provider ${appState.activeProvider === id ? "is-active" : ""}"
                data-mm-provider="${escapeHtml(id)}" aria-pressed="${appState.activeProvider === id ? "true" : "false"}">
                <i class="${escapeHtml(provider.icon)}"></i>
                <span>
                    <strong>${escapeHtml(provider.label)}</strong>
                    <small>${escapeHtml(provider.status)}</small>
                </span>
            </button>
        `).join("");
    }

    function renderTopbar() {
        const provider = PROVIDERS[appState.activeProvider] || PROVIDERS.spotify;
        const icon = rootEl.querySelector("[data-mm-provider-icon]");
        const title = rootEl.querySelector("[data-mm-provider-title]");
        const status = rootEl.querySelector("[data-mm-provider-status]");
        if (icon) icon.innerHTML = `<i class="${escapeHtml(provider.icon)}"></i>`;
        if (title) title.textContent = provider.label;
        if (status) status.textContent = getProviderStatus(appState.activeProvider);
    }

    function renderAccount() {
        const account = rootEl.querySelector("[data-mm-account]");
        if (!account) return;

        if (appState.activeProvider === "spotify") {
            const profile = appState.spotify.profile;
            account.innerHTML = profile ? `
                <div class="musicmini-account-row">
                    <span class="musicmini-avatar">${renderProfileAvatar(profile)}</span>
                    <span>
                        <strong>${escapeHtml(profile.display_name || "Spotify")}</strong>
                        <small>${escapeHtml(profile.product || "connected")}</small>
                    </span>
                </div>
                <button type="button" class="musicmini-quiet-btn" data-mm-spotify-disconnect>
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                    Disconnect
                </button>
            ` : `
                <div class="musicmini-account-row">
                    <span class="musicmini-avatar"><i class="fa-brands fa-spotify"></i></span>
                    <span>
                        <strong>Spotify</strong>
                        <small>${hasSpotifyToken() ? "token saved" : "not signed in"}</small>
                    </span>
                </div>
            `;
            return;
        }

        account.innerHTML = `
            <div class="musicmini-account-row">
                <span class="musicmini-avatar"><i class="${escapeHtml(PROVIDERS[appState.activeProvider].icon)}"></i></span>
                <span>
                    <strong>${escapeHtml(PROVIDERS[appState.activeProvider].label)}</strong>
                    <small>${escapeHtml(getProviderStatus(appState.activeProvider))}</small>
                </span>
            </div>
        `;
    }

    function renderNotice() {
        const notice = rootEl.querySelector("[data-mm-notice]");
        if (!notice) return;
        notice.hidden = !appState.notice;
        notice.textContent = appState.notice || "";
    }

    function renderNowPlaying() {
        const now = rootEl.querySelector("[data-mm-now]");
        if (!now) return;

        if (appState.activeProvider === "spotify") {
            const playback = appState.spotify.playback;
            const item = playback?.item;
            const image = item?.album?.images?.[0]?.url || "";
            const artists = Array.isArray(item?.artists) ? item.artists.map((artist) => artist.name).join(", ") : "";
            const progress = playback?.progress_ms || 0;
            const duration = item?.duration_ms || 0;
            const pct = duration > 0 ? Math.min(100, Math.max(0, progress / duration * 100)) : 0;
            now.innerHTML = `
                <div class="musicmini-art ${image ? "" : "is-empty"}">
                    ${image ? `<img src="${escapeHtml(image)}" alt="">` : `<i class="fa-solid fa-record-vinyl"></i>`}
                </div>
                <div class="musicmini-now-copy">
                    <strong>${escapeHtml(item?.name || "No active track")}</strong>
                    <span>${escapeHtml(artists || appState.spotify.status)}</span>
                    <div class="musicmini-progress" aria-hidden="true">
                        <span style="width:${pct.toFixed(2)}%"></span>
                    </div>
                    <small>${formatMs(progress)} / ${formatMs(duration)}</small>
                </div>
            `;
            return;
        }

        if (appState.activeProvider === "youtube") {
            now.innerHTML = providerNowTemplate("fa-brands fa-youtube", "YouTube", appState.youtube.currentUrl || "No video loaded", appState.youtube.status);
            return;
        }

        if (appState.activeProvider === "soundcloud") {
            now.innerHTML = providerNowTemplate("fa-brands fa-soundcloud", appState.soundcloud.title || "SoundCloud", appState.soundcloud.currentUrl || "No track loaded", appState.soundcloud.status);
            return;
        }

        now.innerHTML = providerNowTemplate("fa-solid fa-music", "Apple Music", appState.apple.currentUrl || "No item loaded", appState.apple.status);
    }

    function providerNowTemplate(icon, title, subtitle, status) {
        return `
            <div class="musicmini-art is-empty">
                <i class="${escapeHtml(icon)}"></i>
            </div>
            <div class="musicmini-now-copy">
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(subtitle)}</span>
                <small>${escapeHtml(status)}</small>
            </div>
        `;
    }

    function renderControls() {
        const controls = rootEl.querySelector("[data-mm-controls]");
        if (!controls) return;
        const provider = appState.activeProvider;
        const canSkip = ["spotify", "youtube", "soundcloud", "apple"].includes(provider);
        const canUseBrowser = provider === "spotify" && hasSpotifyToken();

        controls.innerHTML = `
            <button type="button" data-mm-action="previous" title="Previous" ${canSkip ? "" : "disabled"}>
                <i class="fa-solid fa-backward-step"></i>
            </button>
            <button type="button" class="musicmini-play" data-mm-action="play" title="Play">
                <i class="fa-solid fa-play"></i>
            </button>
            <button type="button" data-mm-action="pause" title="Pause">
                <i class="fa-solid fa-pause"></i>
            </button>
            <button type="button" data-mm-action="next" title="Next" ${canSkip ? "" : "disabled"}>
                <i class="fa-solid fa-forward-step"></i>
            </button>
            ${canUseBrowser ? `
                <button type="button" class="musicmini-device-btn" data-mm-spotify-device title="Use this browser">
                    <i class="fa-solid fa-laptop"></i>
                    <span>${spotifyDeviceId ? "Browser Ready" : "Use Browser"}</span>
                </button>
            ` : ""}
        `;
    }

    function renderTabs() {
        const tabs = rootEl.querySelector("[data-mm-tabs]");
        if (!tabs) return;
        const provider = appState.activeProvider;
        const baseTabs = provider === "spotify" && hasSpotifyToken()
            ? [
                ["home", "Home", "fa-solid fa-house"],
                ["search", "Search", "fa-solid fa-magnifying-glass"],
                ["library", "Library", "fa-solid fa-layer-group"],
                ["settings", "Settings", "fa-solid fa-sliders"]
            ]
            : [
                ["home", "Player", "fa-solid fa-play"],
                ["settings", "Settings", "fa-solid fa-sliders"]
            ];

        tabs.innerHTML = baseTabs.map(([id, label, icon]) => `
            <button type="button" class="${appState.activeTab === id ? "is-active" : ""}"
                data-mm-tab="${escapeHtml(id)}" aria-pressed="${appState.activeTab === id ? "true" : "false"}">
                <i class="${escapeHtml(icon)}"></i>
                <span>${escapeHtml(label)}</span>
            </button>
        `).join("");
    }

    function renderPanel() {
        const panel = rootEl.querySelector("[data-mm-panel]");
        if (!panel) return;

        if (appState.activeTab === "settings") {
            panel.innerHTML = renderSettingsPanel();
            return;
        }

        if (appState.activeProvider === "spotify") {
            panel.innerHTML = renderSpotifyPanel();
            return;
        }

        if (appState.activeProvider === "youtube") {
            panel.innerHTML = renderYouTubePanel();
            return;
        }

        if (appState.activeProvider === "soundcloud") {
            panel.innerHTML = renderSoundCloudPanel();
            return;
        }

        panel.innerHTML = renderApplePanel();
    }

    function renderSpotifyPanel() {
        if (!appState.settings.spotifyClientId || !hasSpotifyToken()) {
            const isConfigured = !!appState.settings.spotifyClientId;
            return isConfigured ? `
                <form class="musicmini-setup" data-mm-form="spotify-login">
                    <div class="musicmini-provider-card">
                        <i class="fa-brands fa-spotify"></i>
                        <span>
                            <strong>Spotify is ready</strong>
                            <small>Sign in with your Spotify account to enable playback and library controls.</small>
                        </span>
                    </div>
                    <div class="musicmini-inline-actions">
                        <button type="submit" class="musicmini-primary">
                            <i class="fa-brands fa-spotify"></i>
                            Sign In
                        </button>
                    </div>
                </form>
            ` : `
                <div class="musicmini-setup">
                    <div class="musicmini-provider-card is-warning">
                        <i class="fa-solid fa-circle-exclamation"></i>
                        <span>
                            <strong>Spotify support is not configured yet</strong>
                            <small>The site owner needs to publish the Spotify app configuration before users can sign in.</small>
                        </span>
                    </div>
                </div>
            `;
        }

        if (appState.activeTab === "search") {
            return `
                <form class="musicmini-search" data-mm-form="spotify-search">
                    <label>
                        <span>Search Spotify</span>
                        <input type="search" name="query" autocomplete="off" placeholder="Tracks, albums, playlists">
                    </label>
                    <button type="submit" class="musicmini-primary" title="Search">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                </form>
                ${renderSpotifySearchResults()}
            `;
        }

        if (appState.activeTab === "library") {
            return `
                <div class="musicmini-split-list">
                    <section>
                        <h3>Playlists</h3>
                        ${renderSpotifyList(appState.spotify.playlists, "playlist")}
                    </section>
                    <section>
                        <h3>Saved Tracks</h3>
                        ${renderSpotifyList(appState.spotify.savedTracks, "track")}
                    </section>
                </div>
            `;
        }

        return `
            <div class="musicmini-split-list">
                <section>
                    <h3>Recently Played</h3>
                    ${renderSpotifyList(appState.spotify.recentTracks, "track")}
                </section>
                <section>
                    <h3>Your Playlists</h3>
                    ${renderSpotifyList(appState.spotify.playlists.slice(0, 8), "playlist")}
                </section>
            </div>
        `;
    }

    function renderSpotifySearchResults() {
        const results = appState.spotify.searchResults;
        if (!results) {
            return `<div class="musicmini-empty"><i class="fa-solid fa-wave-square"></i><span>Ready</span></div>`;
        }

        const tracks = (results.tracks?.items || []).map((item) => normalizeSpotifyTrack(item));
        const albums = (results.albums?.items || []).map((item) => normalizeSpotifyContext(item, "album"));
        const playlists = (results.playlists?.items || []).filter(Boolean).map((item) => normalizeSpotifyContext(item, "playlist"));
        const items = [...tracks, ...albums, ...playlists];

        if (!items.length) {
            return `<div class="musicmini-empty"><i class="fa-solid fa-circle-exclamation"></i><span>No results</span></div>`;
        }

        return `<div class="musicmini-result-list">${items.map(renderSpotifyItem).join("")}</div>`;
    }

    function renderSpotifyList(items, fallbackType) {
        if (!items || !items.length) {
            return `<div class="musicmini-empty"><i class="fa-solid fa-compact-disc"></i><span>Empty</span></div>`;
        }
        return `<div class="musicmini-result-list">${items.map((item) => renderSpotifyItem(item, fallbackType)).join("")}</div>`;
    }

    function renderSpotifyItem(item, fallbackType = "track") {
        const type = item.type || fallbackType;
        const image = item.image || "";
        return `
            <article class="musicmini-result">
                <span class="musicmini-result-art ${image ? "" : "is-empty"}">
                    ${image ? `<img src="${escapeHtml(image)}" alt="">` : `<i class="fa-solid fa-music"></i>`}
                </span>
                <span class="musicmini-result-copy">
                    <strong>${escapeHtml(item.title)}</strong>
                    <small>${escapeHtml(item.subtitle || type)}</small>
                </span>
                <button type="button" data-mm-spotify-play="${escapeHtml(item.uri)}" data-mm-spotify-type="${escapeHtml(type)}" title="Play">
                    <i class="fa-solid fa-play"></i>
                </button>
            </article>
        `;
    }

    function renderYouTubePanel() {
        return `
            <form class="musicmini-search" data-mm-form="youtube-load">
                <label>
                    <span>YouTube URL</span>
                    <input type="url" name="url" value="${escapeHtml(appState.settings.youtubeUrl)}" autocomplete="off" spellcheck="false" placeholder="https://www.youtube.com/watch?v=...">
                </label>
                <button type="submit" class="musicmini-primary" title="Load">
                    <i class="fa-solid fa-play"></i>
                </button>
            </form>
            <div class="musicmini-embed-stage">
                <div id="musicmini-youtube-player" class="musicmini-youtube-host"></div>
            </div>
        `;
    }

    function renderSoundCloudPanel() {
        const url = safeHttpUrl(appState.settings.soundcloudUrl);
        return `
            <form class="musicmini-search" data-mm-form="soundcloud-load">
                <label>
                    <span>SoundCloud URL</span>
                    <input type="url" name="url" value="${escapeHtml(appState.settings.soundcloudUrl)}" autocomplete="off" spellcheck="false" placeholder="https://soundcloud.com/...">
                </label>
                <button type="submit" class="musicmini-primary" title="Load">
                    <i class="fa-solid fa-play"></i>
                </button>
            </form>
            <div class="musicmini-embed-stage">
                ${url ? `<iframe id="musicmini-soundcloud-frame" class="musicmini-provider-frame" title="SoundCloud player" allow="autoplay" scrolling="no" src="${escapeHtml(buildSoundCloudEmbedUrl(url))}"></iframe>` : `<div class="musicmini-empty"><i class="fa-brands fa-soundcloud"></i><span>Ready</span></div>`}
            </div>
        `;
    }

    function renderApplePanel() {
        const embedUrl = buildAppleEmbedUrl(appState.settings.appleUrl);
        return `
            <form class="musicmini-search" data-mm-form="apple-load">
                <label>
                    <span>Apple Music URL</span>
                    <input type="url" name="url" value="${escapeHtml(appState.settings.appleUrl)}" autocomplete="off" spellcheck="false" placeholder="https://music.apple.com/...">
                </label>
                <button type="submit" class="musicmini-primary" title="Load">
                    <i class="fa-solid fa-play"></i>
                </button>
            </form>
            <div class="musicmini-embed-stage">
                ${embedUrl ? `<iframe class="musicmini-provider-frame" title="Apple Music player" allow="autoplay *; encrypted-media *;" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation" src="${escapeHtml(embedUrl)}"></iframe>` : `<div class="musicmini-empty"><i class="fa-solid fa-music"></i><span>Ready</span></div>`}
            </div>
        `;
    }

    function renderSettingsPanel() {
        const spotifyConfigured = !!appState.settings.spotifyClientId;
        const appleConfigured = !!(appState.settings.appleDeveloperToken || appState.settings.appleDeveloperTokenEndpoint);
        return `
            <div class="musicmini-settings-grid">
                <section>
                    <h3>Integrations</h3>
                    ${renderIntegrationStatus("fa-brands fa-spotify", "Spotify", spotifyConfigured ? "Ready for sign in" : "Owner setup needed")}
                    ${renderIntegrationStatus("fa-solid fa-music", "Apple Music", appleConfigured ? "MusicKit ready" : "Embed mode only")}
                    ${renderIntegrationStatus("fa-brands fa-youtube", "YouTube", "Link player ready")}
                    ${renderIntegrationStatus("fa-brands fa-soundcloud", "SoundCloud", "Widget player ready")}
                </section>
                <section>
                    <h3>Account Actions</h3>
                    ${appleConfigured ? `
                    <button type="button" data-mm-apple-authorize>
                        <i class="fa-solid fa-user-check"></i>
                        Authorize Apple Music
                    </button>
                    ` : ""}
                    <button type="button" data-mm-clear-local>
                        <i class="fa-solid fa-trash-can"></i>
                        Clear Local Data
                    </button>
                </section>
            </div>
        `;
    }

    function renderIntegrationStatus(icon, label, status) {
        return `
            <div class="musicmini-integration-status">
                <i class="${escapeHtml(icon)}"></i>
                <span>
                    <strong>${escapeHtml(label)}</strong>
                    <small>${escapeHtml(status)}</small>
                </span>
            </div>
        `;
    }

    function renderProfileAvatar(profile) {
        const image = profile.images?.[0]?.url || "";
        if (image) return `<img src="${escapeHtml(image)}" alt="">`;
        return `<i class="fa-brands fa-spotify"></i>`;
    }

    function getProviderStatus(provider) {
        if (provider === "spotify") return appState.spotify.status;
        if (provider === "youtube") return appState.youtube.status;
        if (provider === "soundcloud") return appState.soundcloud.status;
        return appState.apple.status;
    }

    function normalizeSpotifyTrack(track) {
        return {
            type: "track",
            uri: track.uri,
            title: track.name,
            subtitle: Array.isArray(track.artists) ? track.artists.map((artist) => artist.name).join(", ") : "Track",
            image: track.album?.images?.[0]?.url || ""
        };
    }

    function normalizeSpotifyContext(item, type) {
        return {
            type,
            uri: item.uri,
            title: item.name,
            subtitle: type === "album"
                ? (Array.isArray(item.artists) ? item.artists.map((artist) => artist.name).join(", ") : "Album")
                : (item.owner?.display_name || "Playlist"),
            image: item.images?.[0]?.url || ""
        };
    }

    function normalizeRecentTrack(entry) {
        return normalizeSpotifyTrack(entry.track || entry);
    }

    function normalizeSavedTrack(entry) {
        return normalizeSpotifyTrack(entry.track || entry);
    }

    function formatMs(ms) {
        if (!ms) return "0:00";
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = String(totalSeconds % 60).padStart(2, "0");
        return `${minutes}:${seconds}`;
    }

    function randomString(length = 64) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        const values = new Uint8Array(length);
        crypto.getRandomValues(values);
        return Array.from(values, (value) => chars[value % chars.length]).join("");
    }

    function base64UrlEncode(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");
    }

    async function sha256(value) {
        const data = new TextEncoder().encode(value);
        return crypto.subtle.digest("SHA-256", data);
    }

    async function beginSpotifyAuth(formData = null) {
        const clientId = String(appState.settings.spotifyClientId || "").trim();
        const redirectUri = String(appState.settings.spotifyRedirectUri || defaultRedirectUri()).trim();
        if (!clientId || !redirectUri) {
            setNotice("Spotify sign-in is not configured for this site yet.", true);
            return;
        }

        const state = `musicmini-${randomString(24)}`;
        const codeVerifier = randomString(96);
        const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
        writeSessionJson(STORE_KEYS.spotifyPending, { state, codeVerifier, redirectUri, clientId, createdAt: Date.now() });

        const params = new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            scope: SPOTIFY_SCOPES.join(" "),
            redirect_uri: redirectUri,
            state,
            code_challenge_method: "S256",
            code_challenge: codeChallenge
        });

        window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
    }

    async function handleSpotifyCallback() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        const error = params.get("error");
        const pending = readSessionJson(STORE_KEYS.spotifyPending, null);
        if (!pending || !state || state !== pending.state) return false;

        if (error) {
            removeSensitiveStorage(STORE_KEYS.spotifyPending);
            stripOAuthParams();
            setNotice(`Spotify sign in failed: ${error}`, true);
            return true;
        }

        if (!code) return false;

        appState.spotify.status = "Completing sign in";
        render();
        try {
            const response = await fetch(SPOTIFY_TOKEN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: pending.clientId,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: pending.redirectUri,
                    code_verifier: pending.codeVerifier
                })
            });
            const token = await response.json();
            if (!response.ok) throw new Error(token.error_description || token.error || "Token exchange failed");
            setSpotifyToken(token);
            removeSensitiveStorage(STORE_KEYS.spotifyPending);
            stripOAuthParams();
            appState.spotify.status = "Connected";
            setNotice("Spotify connected.", true);
            await loadSpotifyData();
            return true;
        } catch (error) {
            appState.spotify.status = "Sign in failed";
            setNotice(error.message || "Spotify sign in failed.", true);
            return true;
        }
    }

    function stripOAuthParams() {
        const url = new URL(window.location.href);
        ["code", "state", "error"].forEach((key) => url.searchParams.delete(key));
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }

    async function getSpotifyAccessToken() {
        const token = getSpotifyToken();
        if (!token?.access_token) throw new Error("Spotify is not connected.");
        if (token.expires_at && token.expires_at > Date.now() + 60000) return token.access_token;
        if (!token.refresh_token) throw new Error("Spotify session expired.");

        const response = await fetch(SPOTIFY_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: appState.settings.spotifyClientId,
                grant_type: "refresh_token",
                refresh_token: token.refresh_token
            })
        });
        const nextToken = await response.json();
        if (!response.ok) throw new Error(nextToken.error_description || nextToken.error || "Spotify refresh failed");
        setSpotifyToken({ ...nextToken, refresh_token: nextToken.refresh_token || token.refresh_token });
        return nextToken.access_token;
    }

    async function spotifyApi(path, options = {}, retry = true) {
        const accessToken = await getSpotifyAccessToken();
        const response = await fetch(`${SPOTIFY_API_URL}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(options.headers || {})
            }
        });

        if (response.status === 401 && retry) {
            const token = getSpotifyToken();
            if (token?.refresh_token) {
                token.expires_at = 0;
                writeSessionJson(STORE_KEYS.spotifyToken, token);
                return spotifyApi(path, options, false);
            }
        }

        if (response.status === 204) return null;
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        if (!response.ok) {
            throw new Error(data?.error?.message || data?.error_description || `Spotify request failed (${response.status})`);
        }
        return data;
    }

    async function loadSpotifyData() {
        if (!hasSpotifyToken()) return;
        appState.spotify.busy = true;
        appState.spotify.status = "Syncing";
        render();
        try {
            const [profile, playback, playlists, saved, recent] = await Promise.all([
                spotifyApi("/me"),
                spotifyApi("/me/player").catch(() => null),
                spotifyApi("/me/playlists?limit=24"),
                spotifyApi("/me/tracks?limit=20"),
                spotifyApi("/me/player/recently-played?limit=20").catch(() => ({ items: [] }))
            ]);
            appState.spotify.profile = profile;
            appState.spotify.playback = playback;
            appState.spotify.playlists = (playlists?.items || []).filter(Boolean).map((item) => normalizeSpotifyContext(item, "playlist"));
            appState.spotify.savedTracks = (saved?.items || []).map(normalizeSavedTrack);
            appState.spotify.recentTracks = (recent?.items || []).map(normalizeRecentTrack);
            appState.spotify.status = spotifyDeviceId ? "Browser device ready" : "Connected";
            startSpotifyPolling();
        } catch (error) {
            appState.spotify.status = "Needs attention";
            setNotice(error.message || "Spotify sync failed.", true);
        } finally {
            appState.spotify.busy = false;
            render();
        }
    }

    function startSpotifyPolling() {
        if (spotifyPollTimer) window.clearInterval(spotifyPollTimer);
        spotifyPollTimer = window.setInterval(async () => {
            if (!rootEl || appState.activeProvider !== "spotify" || !hasSpotifyToken()) return;
            try {
                appState.spotify.playback = await spotifyApi("/me/player").catch(() => appState.spotify.playback);
                renderNowPlaying();
                renderTopbar();
            } catch (error) {}
        }, 5000);
    }

    async function loadSpotifySdk() {
        if (window.Spotify?.Player) return;
        if (spotifySdkPromise) return spotifySdkPromise;

        spotifySdkPromise = new Promise((resolve, reject) => {
            const existing = document.getElementById("musicmini-spotify-sdk");
            const previousReady = window.onSpotifyWebPlaybackSDKReady;
            window.onSpotifyWebPlaybackSDKReady = () => {
                if (typeof previousReady === "function") previousReady();
                resolve();
            };
            if (existing) {
                existing.addEventListener("load", () => resolve(), { once: true });
                existing.addEventListener("error", () => reject(new Error("Failed to load Spotify player.")), { once: true });
                return;
            }
            const script = document.createElement("script");
            script.id = "musicmini-spotify-sdk";
            script.src = SPOTIFY_SDK_URL;
            script.onerror = () => reject(new Error("Failed to load Spotify player."));
            document.head.appendChild(script);
        });

        return spotifySdkPromise;
    }

    async function connectSpotifyDevice() {
        if (!hasSpotifyToken()) {
            setNotice("Connect Spotify first.", true);
            return;
        }
        try {
            await loadSpotifySdk();
            if (!spotifyPlayer) {
                spotifyPlayer = new window.Spotify.Player({
                    name: "Music Mini on PortfoliOS",
                    volume: (window.PortfolioOSAppFramework?.getDesktopVolume?.() ?? 70) / 100,
                    getOAuthToken: async (callback) => callback(await getSpotifyAccessToken())
                });

                spotifyPlayer.addListener("ready", async ({ device_id }) => {
                    spotifyDeviceId = device_id;
                    appState.spotify.status = "Browser device ready";
                    render();
                    await spotifyApi("/me/player", {
                        method: "PUT",
                        body: JSON.stringify({ device_ids: [device_id], play: false })
                    }).catch(() => null);
                });
                spotifyPlayer.addListener("not_ready", () => {
                    spotifyDeviceId = "";
                    appState.spotify.status = "Browser device offline";
                    render();
                });
                spotifyPlayer.addListener("player_state_changed", (state) => {
                    if (!state?.track_window?.current_track) return;
                    appState.spotify.playback = {
                        is_playing: !state.paused,
                        progress_ms: state.position,
                        item: {
                            name: state.track_window.current_track.name,
                            duration_ms: state.duration,
                            artists: state.track_window.current_track.artists || [],
                            album: {
                                images: state.track_window.current_track.album?.images || []
                            }
                        }
                    };
                    renderNowPlaying();
                });
                ["initialization_error", "authentication_error", "account_error", "playback_error"].forEach((eventName) => {
                    spotifyPlayer.addListener(eventName, ({ message }) => {
                        appState.spotify.status = eventName === "account_error" ? "Premium required" : "Playback issue";
                        setNotice(message || "Spotify playback is unavailable.", true);
                    });
                });
            }

            const connected = await spotifyPlayer.connect();
            if (!connected) throw new Error("Spotify did not create a browser device.");
            appState.spotify.status = spotifyDeviceId ? "Browser device ready" : "Connecting device";
            render();
        } catch (error) {
            setNotice(error.message || "Spotify player failed.", true);
        }
    }

    async function playSpotifyUri(uri, type = "track") {
        if (!uri) return;
        await connectSpotifyDevice();
        if (!spotifyDeviceId) {
            setNotice("Spotify browser device is still connecting.", true);
            return;
        }

        const body = type === "track"
            ? { uris: [uri] }
            : { context_uri: uri };
        await spotifyApi(`/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`, {
            method: "PUT",
            body: JSON.stringify(body)
        });
        appState.spotify.playback = await spotifyApi("/me/player").catch(() => appState.spotify.playback);
        render();
    }

    async function searchSpotify(query) {
        const q = String(query || "").trim();
        if (!q) return;
        appState.spotify.status = "Searching";
        renderTopbar();
        try {
            const market = encodeURIComponent(appState.settings.spotifyMarket || "US");
            appState.spotify.searchResults = await spotifyApi(`/search?type=track,album,playlist&limit=8&market=${market}&q=${encodeURIComponent(q)}`);
            appState.spotify.status = spotifyDeviceId ? "Browser device ready" : "Connected";
            render();
        } catch (error) {
            setNotice(error.message || "Spotify search failed.", true);
        }
    }

    async function spotifyControl(action) {
        if (!hasSpotifyToken()) return setNotice("Connect Spotify first.", true);
        try {
            if (action === "play") {
                if (spotifyPlayer) await spotifyPlayer.resume();
                else await spotifyApi("/me/player/play", { method: "PUT" });
            } else if (action === "pause") {
                if (spotifyPlayer) await spotifyPlayer.pause();
                else await spotifyApi("/me/player/pause", { method: "PUT" });
            } else if (action === "next") {
                if (spotifyPlayer) await spotifyPlayer.nextTrack();
                else await spotifyApi("/me/player/next", { method: "POST" });
            } else if (action === "previous") {
                if (spotifyPlayer) await spotifyPlayer.previousTrack();
                else await spotifyApi("/me/player/previous", { method: "POST" });
            }
            appState.spotify.playback = await spotifyApi("/me/player").catch(() => appState.spotify.playback);
            render();
        } catch (error) {
            setNotice(error.message || "Spotify control failed.", true);
        }
    }

    function disconnectSpotify() {
        removeSensitiveStorage(STORE_KEYS.spotifyToken);
        removeSensitiveStorage(STORE_KEYS.spotifyPending);
        spotifyDeviceId = "";
        appState.spotify = {
            profile: null,
            playback: null,
            playlists: [],
            savedTracks: [],
            recentTracks: [],
            searchResults: null,
            status: "Disconnected",
            busy: false
        };
        spotifyPlayer?.disconnect?.();
        spotifyPlayer = null;
        if (spotifyPollTimer) window.clearInterval(spotifyPollTimer);
        spotifyPollTimer = null;
        render();
    }

    function parseYouTubeUrl(value) {
        const urlText = safeHttpUrl(value);
        if (!urlText) return null;
        const url = new URL(urlText);
        if (!isHost(url, ["youtube.com", "youtu.be", "youtube-nocookie.com"])) return null;
        const playlistId = url.searchParams.get("list");
        let videoId = "";

        if (url.hostname.replace(/^www\./, "") === "youtu.be") {
            videoId = url.pathname.split("/").filter(Boolean)[0] || "";
        } else if (url.pathname.startsWith("/embed/")) {
            videoId = url.pathname.split("/").filter(Boolean)[1] || "";
        } else if (url.pathname.startsWith("/shorts/")) {
            videoId = url.pathname.split("/").filter(Boolean)[1] || "";
        } else {
            videoId = url.searchParams.get("v") || "";
        }

        if (!videoId && !playlistId) return null;
        return { videoId, playlistId };
    }

    async function loadYouTubeApi() {
        if (window.YT?.Player) return;
        if (youtubeApiPromise) return youtubeApiPromise;
        youtubeApiPromise = new Promise((resolve, reject) => {
            const previousReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (typeof previousReady === "function") previousReady();
                resolve();
            };
            const existing = document.getElementById("musicmini-youtube-api");
            if (existing) {
                existing.addEventListener("load", () => resolve(), { once: true });
                existing.addEventListener("error", () => reject(new Error("Failed to load YouTube player.")), { once: true });
                return;
            }
            const script = document.createElement("script");
            script.id = "musicmini-youtube-api";
            script.src = YOUTUBE_API_URL;
            script.onerror = () => reject(new Error("Failed to load YouTube player."));
            document.head.appendChild(script);
        });
        return youtubeApiPromise;
    }

    async function loadYouTubeUrl(urlText) {
        const parsed = parseYouTubeUrl(urlText);
        if (!parsed) {
            setNotice("That YouTube link is not supported.", true);
            return;
        }
        saveSettings({ youtubeUrl: urlText });
        appState.youtube.currentUrl = urlText;
        appState.youtube.status = "Loading";
        render();

        await loadYouTubeApi();
        const host = rootEl?.querySelector("#musicmini-youtube-player");
        if (!host) return;

        if (youtubePlayer?.destroy) {
            try {
                youtubePlayer.destroy();
            } catch (error) {}
        }

        youtubePlayer = new window.YT.Player(host, {
            width: "100%",
            height: "100%",
            videoId: parsed.videoId || undefined,
            playerVars: {
                playsinline: 1,
                origin: window.location.origin,
                ...(parsed.playlistId ? { listType: "playlist", list: parsed.playlistId } : {})
            },
            events: {
                onReady: () => {
                    appState.youtube.ready = true;
                    appState.youtube.status = "Ready";
                    setVolume(window.PortfolioOSAppFramework?.getDesktopVolume?.() ?? 70);
                    renderTopbar();
                    renderNowPlaying();
                },
                onStateChange: () => {
                    appState.youtube.status = "Active";
                    renderTopbar();
                    renderNowPlaying();
                },
                onError: () => {
                    appState.youtube.status = "Unavailable";
                    setNotice("YouTube could not play that item.", true);
                }
            }
        });
    }

    function youTubeControl(action) {
        if (!youtubePlayer) return setNotice("Load a YouTube item first.", true);
        if (action === "play") youtubePlayer.playVideo?.();
        if (action === "pause") youtubePlayer.pauseVideo?.();
        if (action === "next") youtubePlayer.nextVideo?.();
        if (action === "previous") youtubePlayer.previousVideo?.();
    }

    function buildSoundCloudEmbedUrl(url) {
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&show_artwork=true&visual=true&single_active=true`;
    }

    async function loadSoundCloudScript() {
        if (window.SC?.Widget) return;
        if (soundCloudScriptPromise) return soundCloudScriptPromise;
        soundCloudScriptPromise = new Promise((resolve, reject) => {
            const existing = document.getElementById("musicmini-soundcloud-api");
            if (existing) {
                existing.addEventListener("load", () => resolve(), { once: true });
                existing.addEventListener("error", () => reject(new Error("Failed to load SoundCloud widget.")), { once: true });
                return;
            }
            const script = document.createElement("script");
            script.id = "musicmini-soundcloud-api";
            script.src = SOUNDCLOUD_WIDGET_URL;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load SoundCloud widget."));
            document.head.appendChild(script);
        });
        return soundCloudScriptPromise;
    }

    async function loadSoundCloudUrl(urlText) {
        const url = safeHttpUrl(urlText);
        if (!url || !isHost(new URL(url), ["soundcloud.com"])) {
            setNotice("That SoundCloud link is not supported.", true);
            return;
        }
        saveSettings({ soundcloudUrl: url });
        appState.soundcloud.currentUrl = url;
        appState.soundcloud.status = "Loading";
        render();
        await initSoundCloudWidget();
    }

    async function initSoundCloudWidget() {
        const frame = rootEl?.querySelector("#musicmini-soundcloud-frame");
        if (!frame) return;
        try {
            await loadSoundCloudScript();
            soundCloudWidget = window.SC.Widget(frame);
            soundCloudWidget.bind(window.SC.Widget.Events.READY, () => {
                appState.soundcloud.ready = true;
                appState.soundcloud.status = "Ready";
                soundCloudWidget.getCurrentSound((sound) => {
                    appState.soundcloud.title = sound?.title || "SoundCloud";
                    renderTopbar();
                    renderNowPlaying();
                });
                setVolume(window.PortfolioOSAppFramework?.getDesktopVolume?.() ?? 70);
            });
            soundCloudWidget.bind(window.SC.Widget.Events.PLAY, () => {
                appState.soundcloud.status = "Playing";
                renderTopbar();
                renderNowPlaying();
            });
            soundCloudWidget.bind(window.SC.Widget.Events.PAUSE, () => {
                appState.soundcloud.status = "Paused";
                renderTopbar();
                renderNowPlaying();
            });
            soundCloudWidget.bind(window.SC.Widget.Events.ERROR, () => {
                appState.soundcloud.status = "Unavailable";
                setNotice("SoundCloud could not play that item.", true);
            });
        } catch (error) {
            setNotice(error.message || "SoundCloud failed.", true);
        }
    }

    function soundCloudControl(action) {
        if (!soundCloudWidget) return setNotice("Load a SoundCloud item first.", true);
        if (action === "play") soundCloudWidget.play();
        if (action === "pause") soundCloudWidget.pause();
        if (action === "next") soundCloudWidget.next();
        if (action === "previous") soundCloudWidget.prev();
    }

    function buildAppleEmbedUrl(value) {
        const urlText = safeHttpUrl(value);
        if (!urlText) return "";
        const url = new URL(urlText);
        if (!isHost(url, ["music.apple.com"])) return "";
        url.hostname = `embed.${url.hostname.replace(/^embed\./, "")}`;
        return url.toString();
    }

    function loadAppleUrl(urlText) {
        const embedUrl = buildAppleEmbedUrl(urlText);
        if (!embedUrl) {
            setNotice("That Apple Music link is not supported.", true);
            return;
        }
        saveSettings({ appleUrl: urlText });
        appState.apple.currentUrl = urlText;
        appState.apple.status = "Loaded";
        render();
    }

    async function loadMusicKit() {
        if (window.MusicKit) return;
        if (musicKitPromise) return musicKitPromise;
        musicKitPromise = new Promise((resolve, reject) => {
            const onLoaded = () => {
                document.removeEventListener("musickitloaded", onLoaded);
                resolve();
            };
            document.addEventListener("musickitloaded", onLoaded);
            const existing = document.getElementById("musicmini-musickit");
            if (existing) {
                existing.addEventListener("load", () => window.MusicKit ? resolve() : null, { once: true });
                existing.addEventListener("error", () => reject(new Error("Failed to load MusicKit.")), { once: true });
                return;
            }
            const script = document.createElement("script");
            script.id = "musicmini-musickit";
            script.src = MUSICKIT_URL;
            script.onload = () => window.MusicKit ? resolve() : null;
            script.onerror = () => reject(new Error("Failed to load MusicKit."));
            document.head.appendChild(script);
        });
        return musicKitPromise;
    }

    async function getAppleDeveloperToken() {
        const staticToken = appState.settings.appleDeveloperToken.trim();
        if (staticToken) return staticToken;

        const endpoint = safeHttpUrl(appState.settings.appleDeveloperTokenEndpoint);
        if (!endpoint) throw new Error("Apple Music sign-in is not configured for this site yet.");

        const response = await fetch(endpoint, { credentials: "omit" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Apple Music token request failed.");
        const token = data?.developerToken || data?.token || "";
        if (!token) throw new Error("Apple Music token endpoint did not return a token.");
        return token;
    }

    async function authorizeAppleMusic() {
        try {
            appState.apple.status = "Authorizing";
            render();
            const developerToken = await getAppleDeveloperToken();
            await loadMusicKit();
            await window.MusicKit.configure({
                developerToken,
                app: {
                    name: "Music Mini",
                    build: "1.0.0"
                }
            });
            musicKitInstance = window.MusicKit.getInstance();
            await musicKitInstance.authorize();
            appState.apple.authorized = true;
            appState.apple.status = "MusicKit authorized";
            setNotice("Apple Music authorized.", true);
        } catch (error) {
            appState.apple.status = "MusicKit unavailable";
            setNotice(error.message || "Apple Music authorization failed.", true);
        }
    }

    async function appleControl(action) {
        if (!musicKitInstance) {
            return setNotice("Apple embed playback uses the embedded controls.", true);
        }
        try {
            if (action === "play") await musicKitInstance.play();
            if (action === "pause") musicKitInstance.pause();
            if (action === "next") await musicKitInstance.skipToNextItem();
            if (action === "previous") await musicKitInstance.skipToPreviousItem();
        } catch (error) {
            setNotice(error.message || "Apple Music control failed.", true);
        }
    }

    function restoreProviderRuntime() {
        window.setTimeout(() => {
            if (!rootEl) return;
            if (appState.activeProvider === "youtube" && appState.settings.youtubeUrl) {
                loadYouTubeUrl(appState.settings.youtubeUrl);
            }
            if (appState.activeProvider === "soundcloud" && appState.settings.soundcloudUrl) {
                initSoundCloudWidget();
            }
        }, 0);
    }

    async function refreshActiveProvider() {
        if (appState.activeProvider === "spotify") return loadSpotifyData();
        if (appState.activeProvider === "youtube" && appState.settings.youtubeUrl) return loadYouTubeUrl(appState.settings.youtubeUrl);
        if (appState.activeProvider === "soundcloud" && appState.settings.soundcloudUrl) return initSoundCloudWidget();
        if (appState.activeProvider === "apple" && appState.settings.appleUrl) return loadAppleUrl(appState.settings.appleUrl);
    }

    function clearLocalData() {
        Object.values(STORE_KEYS).forEach((key) => {
            removeStoredValue(key);
            removeSessionValue(key);
        });
        appState.settings = loadSettings();
        disconnectSpotify();
        appState.activeProvider = "spotify";
        appState.activeTab = "home";
        appState.youtube = { status: "Ready", currentUrl: "", ready: false };
        appState.apple = { status: "Ready", currentUrl: "", searchResults: null, authorized: false };
        appState.soundcloud = { status: "Ready", currentUrl: "", title: "", ready: false };
        setNotice("Music Mini local data cleared.", true);
    }

    async function handleAction(action) {
        if (appState.activeProvider === "spotify") return spotifyControl(action);
        if (appState.activeProvider === "youtube") return youTubeControl(action);
        if (appState.activeProvider === "soundcloud") return soundCloudControl(action);
        return appleControl(action);
    }

    function setVolume(volume) {
        const nextVolume = Math.max(0, Math.min(100, Number(volume) || 0));
        if (spotifyPlayer) spotifyPlayer.setVolume(nextVolume / 100).catch(() => {});
        if (youtubePlayer?.setVolume) youtubePlayer.setVolume(nextVolume);
        if (soundCloudWidget?.setVolume) soundCloudWidget.setVolume(nextVolume);
        if (musicKitInstance) {
            try {
                musicKitInstance.volume = nextVolume / 100;
            } catch (error) {}
        }
    }

    async function handleSubmit(event) {
        const form = event.target.closest("[data-mm-form]");
        if (!form) return;
        event.preventDefault();
        const data = new FormData(form);
        const formName = form.dataset.mmForm;

        if (formName === "spotify-login") {
            await beginSpotifyAuth();
            return;
        }

        if (formName === "spotify-search") {
            await searchSpotify(data.get("query"));
            return;
        }

        if (formName === "youtube-load") {
            await loadYouTubeUrl(String(data.get("url") || ""));
            return;
        }

        if (formName === "soundcloud-load") {
            await loadSoundCloudUrl(String(data.get("url") || ""));
            return;
        }

        if (formName === "apple-load") {
            loadAppleUrl(String(data.get("url") || ""));
            return;
        }

    }

    async function handleClick(event) {
        const providerButton = event.target.closest("[data-mm-provider]");
        if (providerButton) {
            setProvider(providerButton.dataset.mmProvider);
            return;
        }

        const tabButton = event.target.closest("[data-mm-tab]");
        if (tabButton) {
            setTab(tabButton.dataset.mmTab);
            return;
        }

        const refreshButton = event.target.closest("[data-mm-refresh]");
        if (refreshButton) {
            await refreshActiveProvider();
            return;
        }

        const actionButton = event.target.closest("[data-mm-action]");
        if (actionButton) {
            await handleAction(actionButton.dataset.mmAction);
            return;
        }

        const spotifyPlayButton = event.target.closest("[data-mm-spotify-play]");
        if (spotifyPlayButton) {
            await playSpotifyUri(spotifyPlayButton.dataset.mmSpotifyPlay, spotifyPlayButton.dataset.mmSpotifyType);
            return;
        }

        if (event.target.closest("[data-mm-spotify-device]")) {
            await connectSpotifyDevice();
            return;
        }

        if (event.target.closest("[data-mm-spotify-disconnect]")) {
            disconnectSpotify();
            return;
        }

        if (event.target.closest("[data-mm-apple-authorize]")) {
            await authorizeAppleMusic();
            return;
        }

        if (event.target.closest("[data-mm-clear-local]")) {
            clearLocalData();
        }
    }

    window.appRegistry[APP_ID] = {
        title: "music-mini.exe",
        icon: "fa-solid fa-record-vinyl",
        windowClass: "musicmini-window media-window",
        renderBody,
        onOpen: async (windowEl) => {
            rootEl = windowEl.querySelector("[data-musicmini-root]");
            unregisterAudio = window.registerAppAudioAdapter?.(APP_ID, { setVolume }) || null;
            rootEl?.addEventListener("submit", handleSubmit);
            rootEl?.addEventListener("click", handleClick);
            render();
            await handleSpotifyCallback();
            if (hasSpotifyToken()) await loadSpotifyData();
            restoreProviderRuntime();
            rootEl?.querySelector("input, button")?.focus({ preventScroll: true });
        },
        onClose: () => {
            rootEl?.removeEventListener("submit", handleSubmit);
            rootEl?.removeEventListener("click", handleClick);
            unregisterAudio?.();
            unregisterAudio = null;
            rootEl = null;

            if (spotifyPollTimer) window.clearInterval(spotifyPollTimer);
            spotifyPollTimer = null;
            spotifyPlayer?.disconnect?.();
            spotifyPlayer = null;
            spotifyDeviceId = "";

            if (youtubePlayer?.destroy) {
                try {
                    youtubePlayer.destroy();
                } catch (error) {}
            }
            youtubePlayer = null;
            soundCloudWidget = null;
        },
        onMinimize: () => {},
        onMaximize: () => {},
        setVolume
    };

    window.setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        const pending = readSessionJson(STORE_KEYS.spotifyPending, null);
        if (pending?.state && params.get("state") === pending.state && (params.get("code") || params.get("error"))) {
            window.openDesktopWindow?.(APP_ID);
        }
    }, 0);
})();
