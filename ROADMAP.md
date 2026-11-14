# PortfoliOS Roadmap

Updated 2026-11-14. Priorities describe delivery order rather than promised dates. A milestone is complete only after checks, commit, push, production deployment, and release verification.

---

## Platform Delivery Strategy

> **Desktop 1st, Mobile 2nd (Mobile Last)**
>
> All milestones follow an explicit **Desktop-First** progression order. The **Desktop platform is the primary milestone target** where the complete windowed operating environment, Root `/` POSIX virtual filesystem, user-space Linux x86_64 syscall translation table, Zero-Knowledge Keyring Vault, terminal developer toolchain, and creative WASM engines are built, validated, and hardened.
>
> The **Mobile platform is secondary and scheduled last across all milestone tiers**. Mobile remains an independent, lightweight touch companion sharing core services with Desktop, but all primary feature development, runtime capabilities, and system enhancements land and stabilize on Desktop before mobile touch adaptations, mobile parity, and viewport passes are executed.

---

## Current credential and runtime milestone

The [encrypted credential broker](docs/VAULT_AUTH.md) now provides profile-scoped saved accounts, explicit per-subsystem bindings, temporary revocable access, reload/unlock persistence and a real Codex auth-file import path. New credentials are encrypted before every SystemFS write; unused logins are offered for explicit removal while referenced logins remain. Legacy unowned keyrings are hidden and retained for attributable recovery. Targeted startup restores now retain unprocessed files’ prior merge baselines; encrypted vault conflicts block overwrite, and offline file conflicts receive a recovery snapshot before replacement. Cancel Sync preserves the copies.

The credential implementation was published in release 2026.11.14.1; this is not evidence of native CLI compatibility. Earlier descriptions overstated plaintext keyring protection, synthetic OAuth success and the Git credential helper. Live CLI process execution, ephemeral auth-file/credential-protocol delivery, refresh writeback, a real provider request after reload and cloud recovery verification remain required. Antigravity needs its own validated connector. The Native Relay's network sockets alone do not supply those process capabilities.

---

## Loop Studio and shared sound library

Local implementation and fixtures now cover the Desktop Strudel workstation, bounded live patterns, an indexed eight-sound public kit, recordings and SystemFS projects, private reload/isolation, reviewed on-device AI draft plumbing, and browser-local MCP tools. The engine and sound assets load on use, outside boot/login. See [the app contract and limits](apps/loop-studio/README.md) and [sound-pack publishing](data/sounds/README.md).

Next music gates: physical-device audio latency/codec checks, real local-model composition quality, external MCP transport adapter, more curated sound packs, richer supported pattern functions and later native Mobile adaptation. The browser-local MessagePort connection does not provide an HTTP/stdio MCP listener.

---

## Delivered in the account-session release

- Shared Desktop/Mobile account chooser after experience selection: public portfolio, remembered private profiles, and another Google account.
- Google Drive sign-in activates a private profile before preferences and SystemFS backup are written.
- Stable Google subject IDs identify accounts across devices; display names do not identify backup folders.
- Documents, downloads, pictures, music, and SystemFS game saves are isolated per profile. Engine binaries and ROM installation storage remain shared device resources.
- File and preference changes schedule a debounced automatic Drive backup while the selected private account is connected.
- Live authorizations remain in memory and can be reused while switching accounts on the same page. Profile identity persists across reloads; Drive backup requires reconnecting.
- Compatible Google popup endpoint while the main shell retains game/AI cross-origin isolation.
- WardenIT moved from Planned to Active, with its verified website link at https://wardenit.com/.

---

## Delivered in the mobile app and public-switch release

- Explicit private-to-public controls in Desktop and Mobile Settings and the shared chooser, with save-to-Drive and offline local-only options.
- Backup failure retains the private profile; switching is serialized and waits for editors, imports, and scans before changing account scope.
- Mobile Store with search, categories, built-in app launch, optional ROM Player install/removal, and desktop game availability notes.
- Seven native mobile additions bring the catalog to 23 apps: Store, Lobe, Task Manager, Security Center, Identity, Dossier, and ROM Player.
- Mobile appearance and launcher layout changes now schedule private backup. Public chat/task state also resets on reload.
- Touch ROM launcher with lazy core loading and Home/Recents pause/resume; original NES diagnostic ROM checked in an isolated browser test.

---

## Delivered in the appearance and diagnostic release

- Consistent surfaces and readable text across all seven Desktop themes, Quick, and native Mobile light/dark palettes; custom accent buttons choose a contrasting foreground.
- App, menu, dialog, placeholder, tray, assistant, and game-loader chrome corrected; independent document/game/media rendering retained.
- Phone sign-in respects its own palette; four distinct light wallpapers accompany the existing dark variants.
- Browser appearance/contrast regression audit, screenshots, and scope/limitations documented in docs/APPEARANCE_AUDIT.md.
- Existing Drive file updates retry temporary network/server failures with bounded exponential backoff. Debug exports identify the build, dates, key loaded asset versions, and current AI state.

---

## Delivered in the staged-loading release

- Separate boot, account selection, Desktop, Mobile, and Quick entry points; only the selected experience executes, after profile storage/preferences are ready.
- Low-priority shell prefetch during login, deferred app controllers and optional AI/media services, and selected-experience HTML/CSS.
- Original typed selector preserved with stable geometry; no workspace flash before sign-in. Mobile excludes Desktop controllers and component styling.
- Small atomic boot cache, on-use app caching, download retry and upgrade migration checks, and stage timings in Debug.

---

## Single-session handoff and recovery framework

Build `2026.10.11.15` implements one active Google workspace, saved handoff, explicit forced takeover, immutable recovery deltas, content-based reconciliation, per-key preference merging, and file deletion intent/tombstones. Native recovery uses SystemFS Save As. Automated checks use isolated service fixtures; real Google-account validation, atomic folder moves, recovery pruning, and durable resumable retries remain open. See [scope and verification](docs/SESSION_HANDOFF.md).

---

## Next Milestones (Desktop 1st, Mobile 2nd / Last)

| Priority | Milestone | Platform Scope | Acceptance criteria | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | **Sync Recovery and Conflict Handling** | **Desktop** | Validate handoff/recovery framework with real cloud accounts; add durable resumable retry queues, snapshot retention controls, folder deletion review, and stable-identity atomic moves. | Account-scoped storage |
| **P0** | **Desktop Keyring & Developer Toolchain** | **Desktop** | Connect a real CLI process/PTY through the installed user bridge; scope ephemeral credential files, persist provider refresh output through the encrypted broker, and verify Codex request → reload/unlock → repeat. Then validate Antigravity, Git credentials and cloud restore. Package metadata/mock commands are not executable compatibility. | Root `/` VFS & Vault Connector |
| **P1** | **Restore Across Devices** | **Desktop** | Two browsers restore the same account's documents, preferences, app-install selections, and desktop layouts. Other accounts' homes and metadata never enter the backup. Validate restore before applying it. | Stable subject IDs & conflict handling |
| **P1** | **Desktop WASM Application & Creative Expansion** | **Desktop** | Follow [the WASM expansion roadmap](docs/wasm/ROADMAP.md): evaluate layered PhotoCraft, multi-document VectorCraft/DesignCraft edit/save/reopen fixtures; LightCraft first useful interaction and larger libraries; FilmCraft/EffectCraft media-codec/render fixtures; Code OSS Documents filesystem provider. | Reliable backup & lifecycle boundaries |
| **P1** | **Public Portfolio and WardenIT** | **Desktop** | Add WardenIT/project screenshots and concise case studies, verify public contact/services flows, and keep portfolio milestones current. | Project media and outcomes |
| **P1** | **Release Reproducibility** | **Desktop** | Track root dependency manifests, add CI for app contracts and session/isolation regressions, record a release manifest, verify remote asset hashes, and document rollback. | Repository configuration |
| **P2** | **Observable Services & Desktop Performance** | **Desktop** | Status Console uses real service checks with checked-at timestamps, degraded/outage states, incident history, and maintenance notes. Measured cold-start budgets for Desktop. | Monitored service list |
| **P3 (Last)** | **Mobile Platform Parity & Touch Adaptations** | **Mobile** | Prioritize touch/controller support for Doom, Diablo, and Quake; measure real-phone memory before enabling them. Adapt IPTV and useful CLI operations with native navigation. Test import/save/resume and per-profile state for each port. See docs/MOBILE_APP_PARITY.md. | Desktop milestones stabilized |

---

## Release Checks

Run `npm test` and `node scripts/check-credential-vault-browser.js` for credential changes. For storage changes, serve the repo and open `scripts/check-profile-filesystem.html`: its disposable IndexedDB audit must pass. Check Desktop and Mobile chooser entry, public access, saved account reconnect, another account, cancellation, offline continuation, reload, and profile switching during backup.
