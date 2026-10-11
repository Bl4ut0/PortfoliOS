# ArtCraft and Code OSS integration review

Reviewed 2026-10-11. This report distinguishes adapter checks from certification of every upstream feature. Engine source stays upstream; exact tags, source commits and artifact hashes are recorded in each app's release.json. Shared standards live in [Orchestration](https://github.com/Bl4ut0/PortfoliOS-Orchestration/tree/main/docs/core).

## Corrections

The Gemini adapters initialized engines in same-origin frames, offered a competing wrapper file picker, and did not reliably retain native downloads in SystemFS. The six Craft adapters now use the same bounded file-input/download contract: an opaque frame, a contextual OS file dialog, owner-checked asynchronous imports, scanned writes and retained failed output. Their compiled upstream engines are unchanged. Apps load only when opened; installed icons do not start their runtimes.

The file dialog navigates SystemFS folders, accepts device upload and drag/drop, creates folders and confirms overwrites. PdfCraft keeps its proven contextual dialog. Actual upstream app icons and their licenses replace generic blue glyphs for all seven Craft apps. The canonical PortfoliOS white-chevron/cyan-cursor mark and contained public portrait remain unchanged from the branding release.

Private-to-public selection flushes eligible editors, saves preferences, optionally completes a live authorized Drive backup, then activates fresh public SystemFS and opens the public portfolio page. Save/backup failure retains the private identity. A remembered account without a live token remains a private local workspace. Desktop/Mobile startup still waits for profile selection.

## App evidence and limits

| App | Verified here | Remaining limits |
| --- | --- | --- |
| PdfCraft 0.6.0 | Native Open/import, edit/page rotation, Save/Save As, retained failed output, reopen, A/B isolation and public reset | Not every PDF tool, OCR language or encrypted file; engine-local preferences/recovery remain ephemeral |
| PhotoCraft 0.7.0 | Native engine startup/canvas and opaque frame; native PSD Open, Save and reopen through SystemFS | Layered multi-document PSD/ORA round trips need broader manual fixtures; native unsaved-document guard retained |
| VectorCraft 0.9.0 | Native startup/canvas; narrowly validated passive SVG import/output | Scripts, external resources and unsupported XML remain quarantined; close requires confirmation that other tabs are saved |
| DesignCraft 0.6.0 | Native startup/canvas and shared document bridge | This is page layout, not a Figma replacement; close requires confirmation of other saved documents |
| LightCraft 0.6.0 | Native startup; known files-store checkpoint close/reopen restores exact bytes into a new isolated engine | Experimental upstream; 48 MiB raw library checkpoint limit, originals should also be retained externally; workers disabled because frame-local IDB is not shared with workers; native ZIP restore/reload needs further fixtures |
| FilmCraft 0.6.0 | Native engine, native editable .fcproj save through SystemFS | Codec/media/render compatibility needs format-by-format fixtures |
| EffectCraft 0.8.0 | Native engine, responsive WebGL canvas and native .ecproj save through SystemFS | WebGPU stalled animation frames in this Chrome environment; adapter uses WebGL presentation and one frame worker; no origin-wide OPFS cache |
| Code OSS / monaco-vscode-api 37.3.11 | Actual web workbench Explorer, file edit/save/reopen, A/B isolation and draft save before public switch | Documents-only provider, files up to 4 MiB; folder rename unsupported; native terminals/extensions require a separate runtime; source-code cloud restore remains subject to existing quarantine policy |

Code OSS is the real browser workbench, not a claim that the entire desktop VS Code binary is WASM. Its bundle includes a WASM diff component. [VS Code web limitations](https://code.visualstudio.com/docs/remote/vscode-web) and [virtual filesystem extension guidance](https://code.visualstudio.com/api/extension-guides/virtual-workspaces) define the relevant constraints. Build source and pinned package lock live in apps/vscode/build; runtime/dist is ignored and restored by node scripts/build-vscode.mjs --install. Build output is not boot-cached.

The local Code OSS writer can save validated UTF-8 source as inert text. The general importer and cloud downloader still quarantine active source/documents. A proposed broader cloud policy change was rejected by automatic approval review and was not applied. Do not claim full code-file Drive restoration until that separate policy is reviewed.

## Loading and performance

LightCraft checkpoints are debounced and limited to at most one background full checkpoint per 30 seconds, with an explicit flush on close. The six uncompressed Craft releases range from approximately 25 MB to 84 MB, before optional compression. They are not part of boot, login, shell preparation or Drive backups. Gateways select supplied Brotli/gzip assets and cache only content-hashed assets immutably. Stable filenames use revalidation. LightCraft's optional Chinese font loads only for Chinese locales. Code OSS's main workbench bundle is approximately 8.5 MB uncompressed / 2.16 MB gzip and is fetched only on launch.

Local staged checks observed Desktop login-ready 35 ms / workspace-ready 71 ms and Mobile 45 ms / 31 ms in one unthrottled run. These are stage-duration diagnostics, not field Core Web Vitals or phone performance guarantees. Craft engine-initialized messages were generally subsecond, FilmCraft several seconds; LightCraft's first screenshot took approximately 17 seconds despite its early initialized message. Do not equate initialized with usable. LightCraft preview/first-action profiling and worker-safe storage are the next optimization targets. No Lighthouse score is claimed.

Desktop Auto sizing also fills the dynamic viewport below the old 821 px breakpoint, including fold/rotation/browser-height changes; fixed resolutions retain their configured aspect ratio. Automated viewport checks cannot replace a physical Galaxy Fold test with its browser chrome and safe-area insets.

## Reproduce

Run npm test, scripts/check-staged-loading-browser.js, scripts/check-private-experience-browser.js, scripts/check-pdfcraft-browser.js, scripts/check-craft-browser.js, scripts/check-vscode-browser.js and scripts/check-desktop-viewport-browser.js. Browser checks require Playwright/Chrome and PHP through PORTFOLIOS_PLAYWRIGHT and PORTFOLIOS_PHP. They create disposable local accounts and never use Google credentials. Production verification must additionally check Apache headers, PHP PATH_INFO routes and exact deployed asset hashes.

## Next candidates

- [Penpot](https://penpot.app/self-host): best next Figma-style design evaluation, but requires its backend and a separate service/storage integration.
- [Graphite](https://graphite.art/volunteer/guide/codebase-overview/): Rust/WASM graphics candidate with a browser architecture worth evaluating after document round-trip fixtures.
- [Blockbench](https://github.com/JannisX11/blockbench): practical browser 3D modelling candidate; classify as JavaScript/WebGL, not Blender WASM.
- Blender: retain as research until a maintained browser artifact, licensing, memory/graphics requirements and project-file round trip are verified. This review did not establish a production-ready Blender WASM build.

Phone adaptations remain separate native Mobile work. A Desktop canvas becoming visible on a phone does not establish a useful touch experience.

Desktop on narrow physical screens now opens apps over the workspace rather than stacking them below the icons. Window bounds reserve the taskbar; automated browser checks cover Settings, File Explorer and Store across six viewport sizes. Physical Fold hardware still needs confirmation.
