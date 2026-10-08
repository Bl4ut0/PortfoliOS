# Project review — 2026-10-08

## Scope and evidence

Reviewed the repository architecture and first-party shell, account, storage, sync, loader, desktop/mobile navigation, project data, security policy, service worker, release/deployment code, and existing relay/game integration contracts. The automated contract audit covers 23 desktop apps, 16 independent mobile apps, two templates, and first-party script syntax. This is a project/engineering review, not an exhaustive audit of third-party game engines or a penetration test.

The modular app contracts, separate mobile lifecycle, IndexedDB filesystem, and centralized import scanner provide a useful foundation. Keeping Google credentials out of persistent browser storage is also appropriate for the present client-side model.

## Findings addressed in this release

1. Google Drive OAuth previously updated cloud state without creating or activating a private profile. Account activation now happens before backup.
2. The user-change listener previously cleared authorization during profile changes. Verified sign-in preserves its token, and separate live account authorizations remain memory-only.
3. Boot treated the presence of any private-profile key as sufficient to force Private. Boot now validates metadata and honors the selected account, including explicit public access.
4. The private workspace previously had one identity and shared root documents/saves. Stable Google subject IDs and virtual filesystem namespaces now distinguish accounts and backup paths.
5. Name-derived cloud folders were unstable and could collide. Google profiles use subject-derived folders.
6. Settings rewrites advanced modification times even without changes. Equal content now retains its timestamp, and first sync restores an existing cloud preferences file before uploading local defaults.
7. Restoring preferences accepted arbitrary local-storage keys. Restoration now restricts writes to the active profile's settings, app selections, and icon positions.
8. Production responds with COOP same-origin and COEP require-corp, which can interfere with Google OAuth popups. A dedicated popup page gets compatible headers; the main shell keeps isolation.
9. Sync could record success after path failures. Failed paths now prevent the success manifest/timestamp from advancing.
10. WardenIT still said Planned after website creation. It now says Active; an outbound URL awaits the supplied address.

## Highest-value remaining work

- **Finish sync recovery.** Path failures now prevent false success. Add a retry queue, paginated remote file discovery, cancellation, and visible progress/errors on Mobile.
- **Resolve edit/delete conflicts.** The current timestamp/manifest approach needs recoverable versions and explicit conflict rules, especially across tabs or devices. A backup restore should not silently propagate unintended deletion.
- **Expose account state consistently.** The desktop settings now distinguish remembered identity from live cloud access. Extend per-account disconnect, forget, restore, and progress controls to native Mobile Settings.
- **Protect async profile boundaries.** App tasks are closed before normal account selection, and pending SystemFS writes reject changed profiles. Add stress tests for slow close hooks, pending imports, background media, and multi-tab writes.
- **Verify engine save coverage.** SystemFS namespaces isolate SystemFS game saves. Some engines maintain their own IndexedDB/Emscripten state; test export/import and account transitions per engine before claiming every game save is account-isolated.
- **Make builds reproducible.** .gitignore excludes root package.json and package-lock.json even though README and deployment depend on npm scripts and basic-ftp. Track manifests and lock versions, then add CI and a release manifest.
- **Improve deploy recoverability.** Assets-before-entry upload is good, but a deployment is not atomic. Add immutable release directories or a rollback manifest and remote hash verification. Review FTP TLS configuration separately; do not expose credentials in logs or commit .env.
- **Bring portfolio content forward.** WardenIT needs its real link; Status Console remains a placeholder. Add screenshots, concise outcomes, and real status timestamps before expanding the catalog further.
- **Measure the visitor path.** Keep Quick available without login, verify navigation and chooser accessibility on real phones, and measure cold-start script/asset cost. Existing mock/contract checks are useful but should be complemented by a repeatable browser smoke suite.

## Authentication boundary

A local remembered profile is a workspace choice, not a server-validated security boundary. Profiles on the same browser origin are not protection from someone controlling that browser, page scripts, or extensions. The popup token flow requires reconnecting after reload/expiry. Continuous authenticated sessions need a server-side session design.

Google references: [token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [popup setup and COOP](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [server-side OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).
