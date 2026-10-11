# OpenRCT2 Web Runtime

This folder stages the official OpenRCT2 Emscripten browser bootstrap inside PortfoliOS.

Source references:
- https://github.com/OpenRCT2/OpenRCT2/tree/develop/emscripten/static
- https://github.com/OpenRCT2/OpenRCT2/blob/develop/emscripten/deps.js
- https://archive.org/metadata/OpenRCT2Assets

Files already staged here:
- `index.php`
- `index.html`
- `index.js`
- `.htaccess`
- `openrct2.zip`, repackaged from the matching Emscripten CI artifact with root-level `openrct2.js` and `openrct2.wasm`.
- `assets.zip`, assembled from the matching Windows portable CI artifact's `data/` folder.
- `RCT.zip`, server-hosted RollerCoaster Tycoon game data from the Archive item. This file is 562,710,505 bytes and contains `RCT/Data/ch.dat`.

Fallback runtime behavior:
- If `openrct2.zip` is missing, the page tries loose `openrct2.js` and `openrct2.wasm`.
- If `RCT.zip` is missing, forbidden, or malformed, the page prompts the user to select a local zip containing `Data/ch.dat`.

Access notes:
- `index.php` sends the SharedArrayBuffer isolation headers before serving `index.html`. The desktop app embeds this PHP entrypoint in a same-origin iframe so the game runs inside a PortfoliOS window.
- `index.html` loads `/volume-hook.js` before the OpenRCT2 runtime so the desktop volume slider can control WebAudio output inside the iframe.
- `.htaccess` disables directory listing, attempts the same isolation headers for static hosts that support them, and blocks direct requests for the large runtime zip files unless they are referred by the main PortfoliOS page (root or index.html, including query strings) or this runtime page. The Store downloads the engine and assets before the game iframe exists. Fresh origin requests with no referrer, an external host, or an unrelated page are blocked. A CDN cache hit may skip this rule; see the hosting limitation below.
- This is a practical barrier, not a hard protection boundary. Browser-fetched files can still be copied by a determined user because the web app has to receive the bytes to run the game.

Validation:
- npm test includes the download-rule regression using the actual Store file URLs.
- With Playwright available, node scripts/check-openrct2-store-browser.js --origin=https://os.bl4ut0.dev checks actual Apache responses and installs the real engine/assets through the Store in a disposable profile. It verifies persisted bytes and reload state, without starting the game or downloading RCT.zip.

Shared caches must not retain the guarded runtime responses. `CDN-Cache-Control` and `Cloudflare-CDN-Cache-Control` use `no-store`, while the browser can retain its private cache. Without this, a CDN hit can skip the origin referrer rule. Existing edge entries require expiration or a targeted purge; live checks use a fresh query and test allowed requests followed by denied requests against the same URL. The referrer rule remains a hotlink barrier, not authentication. See [Cloudflare CDN cache controls](https://developers.cloudflare.com/cache/concepts/cdn-cache-control/).

Production check on 2026-10-10: the hosting static layer did not emit the requested CDN/private cache headers for archive responses. Fresh URLs exercised the corrected origin rule, but a warmed CDN response could still return 200 to a disallowed referrer. The hosting/CDN operator must bypass shared caching for these paths or apply the equivalent response policy and purge old entries. The Store installation succeeds independently of this hotlink limitation.
