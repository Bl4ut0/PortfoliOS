# PortfoliOS roadmap

Updated 2026-10-10. Priorities describe delivery order rather than promised dates. A milestone is complete only after checks, commit, push, production deployment, and release verification.

## Delivered in the account-session release

- Shared Desktop/Mobile account chooser after experience selection: public portfolio, remembered private profiles, and another Google account.
- Google Drive sign-in activates a private profile before preferences and SystemFS backup are written.
- Stable Google subject IDs identify accounts across devices; display names do not identify backup folders.
- Documents, downloads, pictures, music, and SystemFS game saves are isolated per profile. Engine binaries and ROM installation storage remain shared device resources.
- File and preference changes schedule a debounced automatic Drive backup while the selected private account is connected.
- Live authorizations remain in memory and can be reused while switching accounts on the same page. Profile identity persists across reloads; Drive backup requires reconnecting.
- Compatible Google popup endpoint while the main shell retains game/AI cross-origin isolation.
- WardenIT moved from Planned to Active, with its verified website link at https://wardenit.com/.

## Delivered in the mobile app and public-switch release

- Explicit private-to-public controls in Desktop and Mobile Settings and the shared chooser, with save-to-Drive and offline local-only options.
- Backup failure retains the private profile; switching is serialized and waits for editors, imports, and scans before changing account scope.
- Mobile Store with search, categories, built-in app launch, optional ROM Player install/removal, and desktop game availability notes.
- Seven native mobile additions bring the catalog to 23 apps: Store, Lobe, Task Manager, Security Center, Identity, Dossier, and ROM Player.
- Mobile appearance and launcher layout changes now schedule private backup. Public chat/task state also resets on reload.
- Touch ROM launcher with lazy core loading and Home/Recents pause/resume; original NES diagnostic ROM checked in an isolated browser test.

## Delivered in the appearance and diagnostic release

- Consistent surfaces and readable text across all seven Desktop themes, Quick, and native Mobile light/dark palettes; custom accent buttons choose a contrasting foreground.
- App, menu, dialog, placeholder, tray, assistant, and game-loader chrome corrected; independent document/game/media rendering retained.
- Phone sign-in respects its own palette; four distinct light wallpapers accompany the existing dark variants.
- Browser appearance/contrast regression audit, screenshots, and scope/limitations documented in docs/APPEARANCE_AUDIT.md.
- Existing Drive file updates retry temporary network/server failures with bounded exponential backoff. Debug exports identify the build, dates, key loaded asset versions, and current AI state.
- Next for sync: pagination, durable retry queues, conflict recovery, and verified cross-device restore. The P0 sync milestone remains open.


## Next milestones

| Priority | Milestone | Acceptance criteria | Dependencies |
| --- | --- | --- | --- |
| P0 | Sync recovery and conflict handling | Interrupted sync can retry; paginated remote discovery covers large backups; edit/delete conflicts retain recoverable versions; simultaneous tabs cannot overwrite each other silently. | Account-scoped storage |
| P0 | Account and backup controls | Extend delivered account/safe-switch controls with last successful backup, restore preview, storage use, and per-account disconnect/forget controls on both Desktop and Mobile. Forgetting a local account never deletes its Drive backup. | Shared chooser |
| P1 | Restore across devices | Two browsers restore the same account's documents, preferences, app-install selections, and desktop/mobile layouts. Other accounts' homes and metadata never enter the backup. Validate restore before applying it. | Stable subject IDs and conflict handling |
| P1 | Persistent authenticated sessions | If continuous authorization after reload is required, add a server-side Google code flow and protected session cookie, with expiry, CSRF protection, logout, and revocation. Keep refresh tokens on the server. Remembered local identity alone is not authentication. | Hosting/session design decision |
| P1 | Mobile app parity | Prioritize touch/controller support for Doom, Diablo, and Quake; measure real-phone memory before enabling them. Adapt IPTV and useful CLI operations with native navigation. Test import/save/resume and per-profile state for each port. See docs/MOBILE_APP_PARITY.md. | Mobile Store and lifecycle suite |
| P1 | Public portfolio and WardenIT | Add WardenIT/project screenshots and concise case studies, verify public contact/services flows, and keep portfolio milestones current. | Project media and outcomes |
| P1 | Release reproducibility | Track root dependency manifests, add CI for app contracts and session/isolation regressions, record a release manifest, verify remote asset hashes, and document rollback. | Repository configuration |
| P2 | Observable services | Status Console uses real service checks with checked-at timestamps, degraded/outage states, incident history, and maintenance notes. Keep public health independent of private workspace data. | Monitored service list |
| P2 | Accessibility and performance | Keyboard-only account/app flows, screen-reader checks, mobile touch/contrast checks, recovery from blocked storage, and measured cold-start budgets for Desktop/Mobile/Quick. | Browser smoke suite |
| P3 | WASM application and AI expansion | Follow [the WASM expansion roadmap](docs/wasm/ROADMAP.md): evaluate PDF/image/vector/media/OCR workflows, then programming/data/CAD/publishing tools. Require pinned artifacts, profile-safe Open/Save, backup/restore, lifecycle, measured limits, and explicit Desktop/Mobile support. Validate game-engine-native saves independently of SystemFS exports. | Reliable backup and lifecycle boundaries |

## Release checks

Run npm test. For storage changes, serve the repo and open scripts/check-profile-filesystem.html: its disposable IndexedDB audit must pass. Check Desktop and Mobile chooser entry, public access, saved account reconnect, another account, cancellation, offline continuation, reload, and profile switching during backup. Google consent requires an authorized origin and a human account; mocked OAuth tests do not replace that final check.
