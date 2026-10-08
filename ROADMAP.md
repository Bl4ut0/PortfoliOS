# PortfoliOS roadmap

Updated 2026-10-08. Priorities describe delivery order rather than promised dates. A milestone is complete only after checks, commit, push, production deployment, and release verification.

## Delivered in the account-session release

- Shared Desktop/Mobile account chooser after experience selection: public portfolio, remembered private profiles, and another Google account.
- Google Drive sign-in activates a private profile before preferences and SystemFS backup are written.
- Stable Google subject IDs identify accounts across devices; display names do not identify backup folders.
- Documents, downloads, pictures, music, and SystemFS game saves are isolated per profile. Engine binaries and ROM installation storage remain shared device resources.
- File and preference changes schedule a debounced automatic Drive backup while the selected private account is connected.
- Live authorizations remain in memory and can be reused while switching accounts on the same page. Profile identity persists across reloads; Drive backup requires reconnecting.
- Compatible Google popup endpoint while the main shell retains game/AI cross-origin isolation.
- WardenIT moved from Planned to Active because its website has been created. Its live outbound URL is still needed.

## Next milestones

| Priority | Milestone | Acceptance criteria | Dependencies |
| --- | --- | --- | --- |
| P0 | Sync recovery and conflict handling | Interrupted sync can retry; paginated remote discovery covers large backups; edit/delete conflicts retain recoverable versions; simultaneous tabs cannot overwrite each other silently. | Account-scoped storage |
| P0 | Account and backup controls | Show active email, connected/paused/offline state, last successful backup, restore preview, storage use, and per-account disconnect/forget controls on both Desktop and Mobile. Forgetting a local account never deletes its Drive backup. | Shared chooser |
| P1 | Restore across devices | Two browsers restore the same account's documents, preferences, app-install selections, and desktop/mobile layouts. Other accounts' homes and metadata never enter the backup. Validate restore before applying it. | Stable subject IDs and conflict handling |
| P1 | Persistent authenticated sessions | If continuous authorization after reload is required, add a server-side Google code flow and protected session cookie, with expiry, CSRF protection, logout, and revocation. Keep refresh tokens on the server. Remembered local identity alone is not authentication. | Hosting/session design decision |
| P1 | Public portfolio and WardenIT | Connect the supplied WardenIT URL, verify public contact/services routes, add project screenshots and concise case studies, and remove completed work from Planned cards. | WardenIT URL and project material |
| P1 | Release reproducibility | Track root dependency manifests, add CI for app contracts and session/isolation regressions, record a release manifest, verify remote asset hashes, and document rollback. | Repository configuration |
| P2 | Observable services | Status Console uses real service checks with checked-at timestamps, degraded/outage states, incident history, and maintenance notes. Keep public health independent of private workspace data. | Monitored service list |
| P2 | Accessibility and performance | Keyboard-only account/app flows, screen-reader checks, mobile touch/contrast checks, recovery from blocked storage, and measured cold-start budgets for Desktop/Mobile/Quick. | Browser smoke suite |
| P3 | App and AI expansion | Prioritize useful local documents/media workflows and bounded offline AI skills after session reliability. Validate game-engine-native saves independently of SystemFS exports. | Reliable backup and lifecycle boundaries |

## Release checks

Run npm test. For storage changes, serve the repo and open scripts/check-profile-filesystem.html: its disposable IndexedDB audit must pass. Check Desktop and Mobile chooser entry, public access, saved account reconnect, another account, cancellation, offline continuation, reload, and profile switching during backup. Google consent requires an authorized origin and a human account; mocked OAuth tests do not replace that final check.
