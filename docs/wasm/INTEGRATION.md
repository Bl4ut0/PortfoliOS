# WASM application integration guide

Reviewed 2026-10-10. Applies to proposed integrations; this document does not introduce a new executable app adapter API. Existing contracts are defined in [MODULAR_APPS.md](../../MODULAR_APPS.md) and [mobile/README.md](../../mobile/README.md).

## Choose the right integration

| Pattern | Suitable projects | Responsibility |
| --- | --- | --- |
| First-party interface with worker engine | FFmpeg, OCR, Python, SQLite, DuckDB, transcription | Build native Desktop/Mobile controls; explicitly move selected input/output bytes through the worker. |
| Self-hosted upstream app | Craft apps, Graphite, Wavacity, JupyterLite, OpenSCAD | Pin a static build and adapt its file/dialog/storage APIs; validate iframe messaging and teardown. |
| Existing game runner | Doom, OpenRCT2, ROM Player, Duke, Diablo, UT99 | Keep the current lifecycle/save boundary; pin engine provenance and validate title/core behavior. |

A link to an upstream website is a useful preview, but a hosted app's own accounts and storage do not become PortfoliOS private files automatically. Prefer a self-hosted build when deeper integration is required and its licenses permit it.

## Files, profiles, and Drive backup

1. Open files through the current profile's SystemFS-facing picker. Use public virtual paths; never expose internal /.workspaces storage records or another profile's home.
2. Route new external files through SecurityKernel.importFile, following the existing Files and Mobile Documents pattern. Do not bypass quarantine to satisfy an editor.
3. Stage only selected, accepted bytes into an engine's memory filesystem or temporary storage. Capture the profile identity and a task generation before starting asynchronous work.
4. Persist edits, exports, and recovery drafts through profile-scoped SystemFS. Cancel or reject late results if the profile/task changed; never resolve an old task's output against the new current user.
5. Close/flush editors and await pending writes before the shared account switch completes. A save-to-Drive switch must retain the private session if backup fails.
6. Treat an engine's own IndexedDB, OPFS, localStorage, worker memory, and service-worker cache as separate storage. Either avoid these persistent surfaces, partition them by profile, or explicitly import/export them. Clearing global engine storage must not delete another private account's data.
7. Keep installation binaries, models, fonts, language data, and emulation resources outside document backup. Separate removable runtime caches from recoverable user projects. Shared cache metadata must contain no private filenames or thumbnails.
8. Public profile documents, drafts, histories, and app state reset on reload. Private account data persist. Test the engine's recovery storage too, not only SystemFS.
9. Drive backup requires the selected private account's current authorization. Remembered identity and a running local app do not prove the latest output was uploaded.

### Formats and policy conflicts to resolve before launch

SecurityKernel currently blocks executable code imports and quarantines active formats such as SVG/HTML, large archives, and files larger than 64 MiB. A vector editor, Python runner, CAD project, video tool, or Flash/DOS launcher will encounter these rules.

Define a narrowly scoped approved flow before enabling such inputs. Do not globally allow scripts, WASM, SWF, arbitrary archives, or active SVG. Treat runtime installations separately from documents; use reviewed parsers and inert previews where appropriate. Python/SQL code runners need explicit execution boundaries and access only to selected files. Preserve scanner metadata on imports/restores.

Large video/RAW files and multi-file creative projects may need a revised sync-size policy, linked-asset packaging, resumable work, and explicit backup selection. Document limits in the app. Never promise that every byte of a runtime's browser database is backed up.

## Lifecycle and runtime ownership

Desktop apps register through core/app-loader.js and the app framework. Native Mobile apps use mobile/app-loader.js and its independent lifecycle. Share neutral engine/storage services without mounting Desktop's window shell into Mobile.

- Lazy-load and instantiate after opening an app. Show progress, cancel, retry, and an actionable startup error.
- Maintain one owner for workers, audio nodes, animation loops, object URLs, subscriptions, and engine memory.
- Pause interactive work when minimized or sent Home; resume appropriately from Recents. Deliberate music playback follows the existing media service.
- Abort initialization and jobs on close. Await durable save work, then terminate workers and release engine resources. Prove reopen does not accumulate stale state.
- Re-measure canvas/editor size after maximize, rotation, keyboard opening, and container resize.
- Bound concurrent heavy apps and release idle GPU/model resources. Do not infer usable RAM from desktop-only measurements.
- Respect shared volume, focus, keyboard shortcuts, pointer release, and mobile Back/Home behavior.

For iframe bridges, validate event.origin, event.source, message type/schema, operation size, and a task identifier. A same-origin iframe with scripts and same-origin privileges is not a strong security isolation boundary. Do not pass OAuth bearer tokens, broad filesystem handles, or secret settings to third-party application code.

## Hosting and offline behavior

Use the project's existing same-origin COOP/COEP policy. Verify the chosen build's WebGPU/WebGL, SharedArrayBuffer, worker, AudioWorklet, and cross-origin asset requirements. Serve WASM with application/wasm for streaming compilation. Do not relax the main shell's isolation headers to accommodate a new app; evaluate a compatible build or a deliberate separate-origin architecture.

Pin release artifacts and SHA-256 hashes. Record source commit, build toolchain, dependency notices, font/model licensing, and the correspondence between source and binary. Keep immutable runtime assets versioned. Publish referenced files before the app's entry HTML and verify production hashes.

Start with on-demand runtime caching, bounded by size and explicit removal. Do not add every engine/model to the mobile service-worker precache. Test offline startup only after the required runtime is installed; expose missing assets clearly. See [offline caching](../OFFLINE_CACHING.md).

## Desktop and Mobile presentation

Use semantic surface/text/action tokens for first-party chrome and verify every supported theme. Keep independent document/game rendering separate. Test native phone layouts, safe areas, virtual keyboards, touch target sizes, gesture conflicts, accessibility names, and keyboard navigation. An upstream canvas scaled to a phone is not sufficient mobile acceptance.

Expose honest Store availability: Desktop, native Mobile, tablet evaluation, or experimental. Do not list a candidate as installed. Compare Graphite and VectorCraft using the same task before adding overlapping vector apps.

## Acceptance evidence

| Area | Required evidence |
| --- | --- |
| Artifact | Exact release/source commit, hash, build steps, dependency/asset notices, rollback artifact. |
| Useful workflow | Open/import, meaningful edit/run, progress/error/cancel, save/export, and reopen with correct content. |
| Account boundaries | Public reload reset; private A/B separation; switch during a pending job; no stale profile writes or shared recovery leakage. |
| Backup | Edit, backup, restore into a disposable second browser, reopen; only included documents/assets restored. |
| Lifecycle | Close during initialization/job/save; minimize/Home/Recents; reopen; no continuing hidden loops/audio/worker leaks. |
| Performance | Cold/warm runtime bytes and launch, first useful action, peak JS/WASM/GPU memory where observable, main-thread responsiveness, cancellation, cleanup; browser/device/sample recorded. |
| Mobile | Real phone/tablet input, rotation, keyboard, navigation, memory, and suspend/resume evidence for each claimed workflow. |
| Release | Relevant automated checks, commit, push, asset-first deployment, production URL/hash/smoke check, and rollback instructions. |

Do not publish numerical budgets until baseline measurements exist. Existing [performance](../PERFORMANCE_AUDIT.md), [appearance](../APPEARANCE_AUDIT.md), and [mobile parity](../MOBILE_APP_PARITY.md) audits describe the shell and current scope, not a certification of new engines.
