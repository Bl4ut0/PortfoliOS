# PortfoliOS Roadmap

Updated 2026-11-12. Priorities describe delivery order rather than promised dates. A milestone is complete only after checks, commit, push, production deployment, and release verification.

---

## Platform Delivery Strategy

> **Desktop 1st, Mobile 2nd (Mobile Last)**
>
> All milestones follow an explicit **Desktop-First** progression order. The **Desktop platform is the primary milestone target** where the complete windowed operating environment, Root `/` POSIX virtual filesystem, user-space Linux x86_64 syscall translation table, Zero-Knowledge Keyring Vault, terminal developer toolchain, and creative WASM engines are built, validated, and hardened.
>
> The **Mobile platform is secondary and scheduled last across all milestone tiers**. Mobile remains an independent, lightweight touch companion sharing core services with Desktop, but all primary feature development, runtime capabilities, and system enhancements land and stabilize on Desktop before mobile touch adaptations, mobile parity, and viewport passes are executed.

---

## Delivered in the Structured Access System and Zero-Knowledge Vault release

- **Root `/` POSIX Virtual Filesystem**:
  - Full root `/` mounting covering `/`, `/home/<user>`, `/usr/local/bin`, `/etc`, `/tmp`, and `/documents`.
  - Normalized path traversal guards blocking escapes above root `/`.
- **Zero-Knowledge Client-Side Keyring & Vault**:
  - Unified token store under `/etc/portfolios/vault/` protecting `codex` (ChatGPT), `agy` (Google Antigravity), `claude` (Claude Code), `xai` (xAI Grok), and `github` (Git Credential Helper).
  - Client-side AES-256-GCM encryption with 128-bit authentication tags and PBKDF2-HMAC-SHA512 key derivation at 600,000 rounds with rotating 32-byte salts.
  - Plain-text tokens stored exclusively in local IndexedDB; unencrypted `/etc` and dotfiles strictly blocked from cloud sync.
- **Setup & Recovery Option (Purge & Re-Initialize)**:
  - Addressed Zero-Knowledge lost-password scenario: because ciphertext cannot be cracked or backdoored, a safe recovery workflow (`vault purge` / `window.PortfoliOSVault.purgeAndReset()`) wipes locked keys, cleans `/etc/portfolios/vault/*.json`, and deletes `/documents/vault.enc`.
  - Allows users to re-initialize with a new Master Passphrase without breaking existing system files or leaving corrupted sessions.
- **Visual Multi-Program Authentication Modal**:
  - Top-level desktop overlay (`#vault-modal`) with **Unlock**, **Setup**, and **Purge & Reset** views.
  - Live criteria checklist for password strength (&ge;14 chars, character mix, &ge;60-bit entropy) and one-click unlock for all active programs.
- **User-space Linux x86_64 POSIX Syscall Translation Table**:
  - Directly translates Linux x86_64 syscalls (`sys_open`, `sys_read`, `sys_write`, `sys_close`, `sys_stat`, `sys_getdents64`, `sys_socket`, `sys_connect`, `sys_ioctl`, `sys_brk`) to browser secondary connectors without requiring heavy Linux container images or secondary loaders.
- **In-Browser Terminal CLI Toolchain**:
  - Added first-party commands: `vault`, `codex`, `agy`, `claude`, `xai`, `git-credential-portfolios`, `apt`, `npm`, `curl`, `wget`, `sh`.
- **Git Credential Helper**:
  - `/usr/local/bin/git-credential-portfolios` serves stored GitHub credentials from the vault to Git CLI over standard credential protocol.
- **Windows Native Messaging Relay**:
  - `PortfoliOS-NativeRelay` companion extension and host bridge enabling raw TCP/UDP duplex networking.
- **Dual Cloud Sync Drivers**:
  - Integrated Google Drive and OneDrive sync drivers, explicitly allowing `/documents/vault.enc` to sync while keeping credentials protected.

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
| **P0** | **Desktop Keyring & Developer Toolchain** | **Desktop** | Complete terminal package management workflows (`apt`, `npm`), PTY process streaming, and Zero-Knowledge Vault sync recovery integration. | Root `/` VFS & Vault Connector |
| **P1** | **Restore Across Devices** | **Desktop** | Two browsers restore the same account's documents, preferences, app-install selections, and desktop layouts. Other accounts' homes and metadata never enter the backup. Validate restore before applying it. | Stable subject IDs & conflict handling |
| **P1** | **Desktop WASM Application & Creative Expansion** | **Desktop** | Follow [the WASM expansion roadmap](docs/wasm/ROADMAP.md): evaluate layered PhotoCraft, multi-document VectorCraft/DesignCraft edit/save/reopen fixtures; LightCraft first useful interaction and larger libraries; FilmCraft/EffectCraft media-codec/render fixtures; Code OSS Documents filesystem provider. | Reliable backup & lifecycle boundaries |
| **P1** | **Public Portfolio and WardenIT** | **Desktop** | Add WardenIT/project screenshots and concise case studies, verify public contact/services flows, and keep portfolio milestones current. | Project media and outcomes |
| **P1** | **Release Reproducibility** | **Desktop** | Track root dependency manifests, add CI for app contracts and session/isolation regressions, record a release manifest, verify remote asset hashes, and document rollback. | Repository configuration |
| **P2** | **Observable Services & Desktop Performance** | **Desktop** | Status Console uses real service checks with checked-at timestamps, degraded/outage states, incident history, and maintenance notes. Measured cold-start budgets for Desktop. | Monitored service list |
| **P3 (Last)** | **Mobile Platform Parity & Touch Adaptations** | **Mobile** | Prioritize touch/controller support for Doom, Diablo, and Quake; measure real-phone memory before enabling them. Adapt IPTV and useful CLI operations with native navigation. Test import/save/resume and per-profile state for each port. See docs/MOBILE_APP_PARITY.md. | Desktop milestones stabilized |

---

## Release Checks

Run `npm test`. For storage changes, serve the repo and open `scripts/check-profile-filesystem.html`: its disposable IndexedDB audit must pass. Check Desktop and Mobile chooser entry, public access, saved account reconnect, another account, cancellation, offline continuation, reload, and profile switching during backup.
