# Plex Player Preview

An original, unofficial Plex-compatible PortfoliOS application with independent Desktop and Mobile adapters. It does not embed Plex Web. The Store installs the lightweight client; media is streamed from the selected Plex Media Server.

## Implemented

- Cancellable account linking through a separately opened Plex page; server-specific authorization and secure HTTPS discovery.
- Continue watching, library selection, search, paged titles, bounded artwork loading and show/season navigation.
- Browser video/audio decoding for conservative directly supported formats; explicit compatible-stream retry and 720p/1080p server conversion through native HLS or the existing Apache-2.0 hls.js vendor runtime, loaded on demand.
- Native video controls, fullscreen, desktop audio integration and Plex progress reporting.
- Credentials remain in memory and clear on app close, disconnect or OS profile change. No account token is saved to SystemFS, preferences, Drive or browser storage. Media URLs necessarily carry server authorization for the browser decoder; do not copy these URLs into logs or persisted state.
- App code does not load during boot. Closing the OS window never requires saving a media session.

## Validation and limits

Run `npm test` and `node scripts/check-plex-browser.js` with Playwright available. Browser fixtures validate API routing, server token isolation, direct/HLS selection, transcode stop requests, timeline reporting, profile teardown and cancellation of late linking results. Media methods and HLS are simulated in this regression; it does not certify actual decoding or real Plex service compatibility.

Test your server from the production HTTPS origin before relying on playback. CORS, secure server reachability, local-network permission, browser codec support, server transcoding capability and Plex remote-playback permissions apply. No media proxy, downloaded movie library, browser-side FFmpeg transcoding, Plex-hosted DRM content, Live TV or managed-user switching is included. Cancelling linking does not authorize a subsequent late PIN response.

See [Plex research and source documentation](../../docs/PLEX_CLIENT_RESEARCH.md). The amber player icon is an original compatibility icon, not an assertion of Plex endorsement. hls.js license/provenance remains with the existing IPTV vendor distribution.
