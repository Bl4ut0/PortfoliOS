# Offline caching and runtime storage

Shared caching principles live in [Orchestration's architecture standard](https://github.com/Bl4ut0/PortfoliOS-Orchestration/blob/main/docs/core/ARCHITECTURE.md). This document describes the OS implementation; [staged loading](STAGED_LOADING.md) covers boot-cache installation, upgrades and recovery.

## Storage layers

| Layer | Owner | Contents and limits |
| --- | --- | --- |
| Boot cache | [sw.js](../sw.js) | Small atomic release-scoped entry graph; no blanket app/engine download |
| Used shell/app assets | [sw.js](../sw.js), [loading graph](../core/loading-manifest.js) | Selected-experience and app assets cached on demand after use |
| Installed engine binaries | [desktop/store.js](../desktop/store.js), SystemFS | Explicit installation files marked as runtime data and excluded from Drive backup |
| User documents and exposed saves | [SystemFS](../core/filesystem.js) | Profile-scoped user data, with approved paths eligible for private Drive backup |
| Engine-native storage | Individual runtime | Requires separate isolation and import/export verification; not automatically SystemFS backup |

Previously used/cached assets can support offline use. Never-downloaded apps and Google reconnect are not promised offline. Cache reads still take time and can fail; do not describe them as zero latency.

## Installation and request handling

The Store uses `GAME_INSTALL_CONFIGS` to fetch configured runtime files and report streamed download progress. It writes them to shared SystemFS runtime paths with `metadata.sync: false` and `kind: app-runtime`. Uninstall targets the configured runtime directory.

For supported same-origin game requests, the worker maps the URL to an installed SystemFS path. A matching record returns a response with its recorded content type and isolation-related headers. Missing records fall back to the network. Some runtimes have explicit data exclusions, so an installed wrapper does not prove that all game data are cached.

## Current engine mappings

| App | Runtime path | Existing interception limits |
| --- | --- | --- |
| UT99 | `/apps/ut99/runtime/` | PHP wrapper requests are mapped; `gamedata` requests bypass this path |
| DoomSource | `/apps/doomsource/` | Root `doom.js`, `doom.wasm` and `DOOM.WAD` requests are mapped |
| Duke3D | `/apps/duke32/` | Launcher and configured archive requests are mapped |
| Quake | `/apps/quake/` | Launcher, configured PAK and WebQuake scripts are mapped |
| Diablo | `/apps/diablo/` | Runtime requests are mapped; `DIABDAT.MPQ` bypasses the installed-cache path |
| OpenRCT2 | `/apps/openrct2/runtime/` | Runtime requests are mapped; `RCT.zip` bypasses the installed-cache path |

These are technical mappings, not blanket statements about an asset's license or DRM. Commercial game data remain subject to the project's [asset ownership requirements](../README.md#game-data--asset-ownership-compliance). A filename, download or cached response does not establish redistribution permission.

## Profiles and releases

Keep runtime binaries separate from private files and backup. Public reload resets installation selections and public user state while shared runtime caches remain device resources. Do not clear another private account's files or engine saves during public reset.

The worker's versioned shell cache is separate from installed SystemFS binaries. It preserves a previous release for recovery and does not silently substitute a different requested asset version. Follow [staged loading](STAGED_LOADING.md) and the owning repository's release checks when changing this behavior.
