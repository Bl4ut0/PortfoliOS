# PortfoliOS Offline Caching & Storage Architecture

This document describes the design and implementation of the client-side progressive caching system used by games and applications inside PortfoliOS.

## Overview

To provide instant launch speeds, zero-latency asset loading, and offline capabilities while respecting licensing constraints, PortfoliOS splits application files into two distinct categories:

1.  **Non-DRM Protected Data (Engine wrappers, WebAssembly files, and Shareware/Demo files):**
    *   Downloaded and stored persistently inside the client's local IndexedDB virtual filesystem (`SystemFS`) during the **App Store installation** sequence.
    *   Intercepted and served locally by a global **Service Worker** in 0 milliseconds, bypassing the network entirely.
2.  **DRM Protected Data (Copyrighted retail maps, high-quality textures, CD soundtracks):**
    *   Commercial assets that were part of paid software.
    *   **Never** pre-downloaded or permanently cached on the user's client-side IndexedDB database.
    *   Streamed dynamically on demand from the server during gameplay or supplied locally by the user (e.g. Diablo's `DIABDAT.MPQ` or OpenRCT2's `RCT.zip`).

---

## The Core Components

```
┌──────────────────────────────────────────────────────────┐
│                      App Store                           │
│  (Click "Install" ➔ Streams files to SystemFS / Local)   │
└───────────┬──────────────────────────────────────────────┘
            │
            ▼ (Writes to)
┌──────────────────────────────────────────────────────────┐
│              SystemFS (IndexedDB Storage)                │
│  Stores: index.js, wdosbox.wasm, spawn.mpq, DOOM.WAD     │
└───────────▲──────────────────────────────────────────────┘
            │
            ├ (Reads from)
┌───────────┴──────────────────────────────────────────┐
│                 Service Worker (sw.js)                │
│  Intercepts SAME-ORIGIN requests from Iframe games    │
│  Serves cached files locally in 0 milliseconds        │
└───────────▲───────────────────────────────────────────┘
            │
            ├ (HTTP Request)
┌───────────┴──────────────────────────────────────────┐
│                Iframe Game Runtime                   │
│  e.g. <iframe src="apps/ut99/runtime/index.php">    │
└──────────────────────────────────────────────────────┘
```

### 1. The Centralized Installer (`desktop/store.js`)
When you click **Install** on an installable store item, the store downloader looks up the application in a unified configuration (`GAME_INSTALL_CONFIGS`).
*   If a configuration exists, it executes actual fetch response streams to download the game's launcher wrapper, JS engine, WASM binary, and shareware assets.
*   The download progress is calculated dynamically by summing up stream bytes and updating the store progress bar in real-time.
*   Once files are downloaded, they are written to `SystemFS` via `SystemFS.writeFile()`.
*   If you **Uninstall** the app, the store automatically runs `SystemFS.deleteFileRecursive()` on the corresponding virtual path to free up local disk space.

### 2. Service Worker Interceptor (`sw.js`)
A Service Worker registered at page startup (`main.js`) intercepts all outgoing same-origin requests for game engine folders:
*   It checks the `PortfoliOS_FS` IndexedDB database for a matching record.
*   If found, it returns a local `Response` constructed from the IndexedDB binary buffer, applying headers like `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` required for multithreaded WASM.
*   If missing, or if it is a DRM-protected asset, the Service Worker falls back to the standard network fetch, letting it download on demand.

---

## Game Mappings & Files Saved

| App ID | Virtual Directory | Cached Files (Non-DRM) | DRM-Protected Files (Server-only / User-supplied) |
| :--- | :--- | :--- | :--- |
| **UT99** | `/apps/ut99/runtime/` | `index.html`, `index.js`, `index.wasm`, `index.data` | Whitelisted maps, textures, music modules |
| **Doom** | `/apps/doomsource/` | `doom.js`, `doom.wasm`, `DOOM.WAD` (shareware) | Retail WAD expansions |
| **Duke3D** | `/apps/duke32/` | `index.html`, `duke3d.zip` (shareware) | Full retail GRP expansions |
| **Quake** | `/apps/quake/` | `index.html`, `pak0.pak` (shareware), `WebQuake/*.js` | Registered PAK files, custom maps |
| **Diablo** | `/apps/diablo/` | `index.html`, `spawn.mpq`, `*.worker.js`, static chunks | `DIABDAT.MPQ` (Retail CD file, user-supplied) |
| **OpenRCT2** | `/apps/openrct2/` | `index.html`, `index.js`, `openrct2.zip`, `assets.zip` | `RCT.zip` (Retail game assets) |
