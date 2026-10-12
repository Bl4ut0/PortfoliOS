# Native Plex client research

Reviewed 2026-10-11. Status: researched proposal; no Plex runtime, account connection, playback certification, or Store entry has been implemented.

## Product direction

Build a third-party Plex-compatible PortfoliOS client with its own library screens and player controls. Do not frame app.plex.tv or load its application UI. The existing Plex Media Server remains the media source. Use distinct client identification and describe the integration as unofficial.

The old [Plex Media Player](https://github.com/plexinc/plex-media-player) is archived, uses Qt/mpv/FFmpeg, and is GPLv2. It is not a maintained browser engine to import. Our recommendation is an original client using documented APIs and independently licensed playback components.

## API and authentication foundation

[Plex's published PMS API](https://developer.plex.tv/pms/) documents token authentication and a PIN-based account-linking flow. Build a bounded, cancellable linking flow opening Plex authentication separately, then discover authorized servers. Use a stable per-install client identifier and accurate application headers. Select the server-specific access token where discovery supplies one.

The API covers library sections, metadata, media parts, playback decisions/transcoding, and playback state. Follow returned provider keys where documented. Negotiate the documented PMS API version against the actual server; do not hard-code latest-version assumptions or present undocumented endpoints as stable contracts.

Initial API validation: account link, discovered resources, secure server identity, libraries, one item including stream metadata, playable part/playlist, timeline reporting, and stopping a transcode session. Record exact server version and sanitized fixtures. This has not yet been tested with a real account.

## Playback choice

1. Browser HTML video/audio for compatible media.
2. Native HLS where available; otherwise lazy-loaded, pinned [hls.js](https://github.com/video-dev/hls.js), Apache 2.0, using MediaSource and the browser decoder.
3. Plex Direct Stream for compatible streams requiring container changes; server transcoding when necessary. [Plex's playback explanation](https://support.plex.tv/articles/200250387-streaming-media-direct-play-and-direct-stream/) distinguishes these modes and subtitle-triggered transcoding.
4. Add targeted WASM demuxing/subtitle components only after a reproducible compatibility gap. Do not download a general software decoder on startup.

Use [MediaCapabilities.decodingInfo](https://developer.mozilla.org/en-US/docs/Web/API/MediaCapabilities/decodingInfo) to inform capability selection; validate the actual stream too. [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) exposes codecs rather than a complete player. A custom WebCodecs pipeline would also need container parsing, scheduling, A/V synchronization, seeking, subtitles and buffering. It is a later measured experiment, not the first playback engine.

[ffmpeg.wasm's FAQ](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/website/docs/faq.md) documents performance/resource tradeoffs. Do not promise real-time 4K software conversion or native desktop codec parity on phones.

## Connection gates

Test direct HTTPS connections from the deployed OS origin to Plex account endpoints and each selected PMS. Validate CORS/preflight, range requests, images, subtitles and HLS playlists/segments. Our deployment uses cross-origin isolation: all required subresources must work under that policy. Do not relax isolation globally to hide failures.

Use advertised secure connections; see [Plex secure connections](https://support.plex.tv/articles/206225077-how-to-use-secure-server-connections/). A public HTTPS app cannot assume it can fetch an arbitrary HTTP LAN address. Account for [browser local-network access permission](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access).

Do not silently relay media through PortfoliOS hosting. A cloud proxy cannot reach a user's private LAN by default. Any required companion/backend would be separately scoped after connection tests, not an unrestricted URL proxy.

Respect server entitlements. [Remote personal video playback requirements](https://support.plex.tv/articles/requirements-for-remote-playback-of-personal-media/) can require Plex Pass or Remote Watch Pass; third-party client status does not establish an exemption.

## PortfoliOS integration

- Shared neutral Plex API/session service; separate Desktop window and Mobile phone views, using existing app registries and loaders.
- Native first screens: Connect, server/library chooser, Continue Watching, paginated poster library, title details, seasons/episodes, search and player.
- Native controls: play/pause, seek, resume/start over, volume, fullscreen, quality, audio/subtitles where supported, playback-mode status and actionable errors.
- Profile-scoped non-secret preferences in SystemFS. Plex is separately authorized from Google. Keep tokens out of Drive backup, URLs in logs, exported debug data and service-worker caches. Initial linking tokens remain memory-only; durable credential storage requires a separate explicit design.
- No eager media downloads or full-library indexing. Fetch visible pages and thumbnails on demand. Keep movie files on PMS unless download is explicitly implemented and authorized.
- On X/Back/profile change: release media, HLS workers, object URLs, timers and requests; report stopped playback and stop server transcoding best-effort without trapping window close. Clear account-bound state on profile changes.

Existing IPTV has HLS/video lifecycle code worth reviewing for neutral reuse; do not make Mobile load the Desktop IPTV controller. Existing Mobile Media provides native playback presentation patterns. These are reuse candidates, not proof of Plex compatibility.

## Implementation order and acceptance

1. Connection spike: real Plex linking and one secure server reachable from PortfoliOS, including CORS and isolation. No fake Installed/working Store entry.
2. Native read-only library app: pagination, artwork, search, details, unavailable-server and revoked-token handling.
3. Movie/episode player: compatible direct play plus HLS fallback, seek/resume, timeline, stop/cleanup; prove which mode actually runs.
4. Mobile adaptation: touch controls, Fold inner/outer viewport, rotation, safe areas, audio focus and Home/Back behavior.
5. Advanced features: stream selection, subtitles, music playlists, local codec experiments, casting, downloads, managed Plex Home users and Live TV only after separate validation.

Acceptance requires account isolation, revoked-link recovery, direct MP4, container remux, audio/video transcode, unsupported subtitle handling, resume/seek, network loss, X during loading/playback, no boot media fetches, and real Android/desktop playback measurements. Plex-hosted ad-supported/DRM catalogs are outside the initial personal-server client scope.
