# PortfoliOS Security Review Notes

## Scope

This review covers the browser-local filesystem, game-save backup flow, and planned OAuth-backed cloud sync.

## Current Storage Model

- `SystemFS` stores user files in IndexedDB under `PortfoliOS_FS`.
- File Explorer exposes user-visible folders, including `/Saved Games`.
- Doom writes saves directly to `SystemFS`.
- Quake mirrors browser `localStorage` saves into `/Saved Games/Quake`.
- Diablo mirrors `.sv` files from the port's `diablo_fs` IndexedDB store into `/Saved Games/Diablo`.
- Google Drive sync currently requests `drive.file`, which limits access to files created/opened by the app.

## Security Concerns

- OAuth tokens are currently stored in browser storage. Any XSS on the origin could read them.
- File names and text files are user-controlled input and must never be inserted into HTML without escaping.
- Cloud sync has delete propagation. A bug or compromised page could delete remote backup files.
- Hidden runtime assets such as WAD/MPQ data should not be synced as user backup data unless explicitly enabled.
- Cross-frame game bridges must only accept expected message shapes and same-origin frames.
- `allow-same-origin` on game iframes is useful for save access but raises the impact of any game-port script compromise.

## Mitigations Added

- Modular app registration now runs through `validateAppRegistration()`.
- Modular app lifecycle hooks now run through a shared hook runner that catches async failures.
- Game iframe messages now use `window.postMessageToIframe()` so runtime messages target the iframe's resolved origin instead of `*`.
- Store catalog display text is escaped before insertion into the Store UI.
- The modular app framework documentation now requires explicit origin checks, adaptive sizing, audio adapters, and `/Saved Games` save sync patterns.

## Required Before Public OAuth Launch

- Add a Content Security Policy that restricts scripts to trusted origins and blocks inline script where practical.
- Keep Google scope at `drive.file`; do not request broad Drive scopes.
- Move OAuth token handling toward short-lived in-memory tokens where possible.
- Add explicit sync preview before destructive remote/local deletes.
- Store a signed or checksummed sync manifest to detect unexpected deletion waves.
- Filter backup paths to user documents and `/Saved Games`; exclude hidden dotfiles and bundled game assets by default.
- Continue adding origin and source checks inside every iframe runtime that receives `postMessage` traffic.
- Add a manual "Export backup archive" path so users can back up saves without OAuth.

## Review Status

Current status: development-only. The local filesystem is suitable for browser-local saves, but OAuth cloud sync should remain gated until the checklist above is complete.
