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
- `.htaccess` disables directory listing, attempts the same isolation headers for static hosts that support them, and blocks direct requests for the large runtime zip files unless they are referred by the runtime page.
- This is a practical barrier, not a hard protection boundary. Browser-fetched files can still be copied by a determined user because the web app has to receive the bytes to run the game.
