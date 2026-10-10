# Appearance audit

Reviewed 2026-10-09 for build 2026.10.09.4.

## What was wrong

The theme controller changed global text tokens while much of the shell retained fixed dark backgrounds. Light, Black Accent, and Glacier could therefore show dark text on dark Settings, Start, menus, dialogs, Store, media tools, and other surfaces. Desktop icon labels also inherited dark text over independent dark wallpapers.

Several apps defined their own fixed text colors, native AI selects forced dark rendering, and filled buttons assumed their accent would always be bright cyan. Nested labels sometimes overrode the button's foreground. Mobile had its own related gaps: sign-in labels retained desktop colors, low-contrast project labels, and one generic light wallpaper rule replaced all four wallpaper choices.

## Changes

- Shared opaque base, raised, inset, and overlay surfaces now follow the active palette. Preview artwork, game canvases, embedded web content, and document paper keep their own intentional colors.
- Text accents have a separate readable ink color. Filled action buttons choose black or white text from their actual accent color. Muted text is adjusted against both base and raised surfaces. This also covers custom black, white, yellow, blue, and magenta accents.
- Settings, Start, taskbar, calendar, volume/AI trays, assistant bubble, context menus, native form controls/placeholders, Store, and first-party desktop utility/media app chrome use the shared colors.
- File Explorer, CLI, Task Manager, Security Center, Office dashboard/Writer/Calc/save controls, Music Mini, Browser chrome, IPTV setup, ROM library, Doom loader/status, and Webamp status have consistent foreground/background pairs.
- Desktop wallpaper labels stay light with a dark shadow. Window title bars remain readable above independent black game surfaces.
- Phone sign-in follows the phone's own theme. Native mobile project/browser labels retain readable ink. Aurora, Ember, Forest, and Graphite each have distinct light and dark wallpapers.
- Desktop and Mobile appearance preferences remain independent and account-scoped. Shared semantic tokens resolve inside the selected phone palette.
- Changed styles/scripts have fresh cache versions, including dynamically loaded desktop/mobile app modules and the service-worker shell cache.

## Validation

Run npm test and scripts/check-appearance-browser.js. The latter requires Playwright and installed Chrome; PORTFOLIOS_PLAYWRIGHT can identify the module location. Set PORTFOLIOS_APPEARANCE_SCREENSHOTS=1 to refresh the visual evidence.

The browser audit uses disposable profiles and covers all seven Desktop palettes; all 23 desktop app shells including Settings, Writer/Calc and engine-free game/player loaders; Quick; all 23 native mobile apps; both phone themes and all five accents; phone sign-in; the four wallpapers; placeholders; assistant/tray panels; and custom accent extremes. It also checks that copied debug logs contain release/date/asset information and the current AI snapshot, including after clearing historical entries.

Computed foreground/background contrast uses the WCAG normal-text threshold of 4.5:1 and large-text threshold of 3:1. See the [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). The algorithm composites ancestor background colors and conservatively checks opaque gradient stops. It is a regression check, not an accessibility certification: backdrop blur, image backgrounds, text shadows, disabled controls, every hover state, third-party documents, game engines, and real-phone rendering still need human assessment.

Final local result: 535 scenarios and 12,434 rendered text checks, with zero contrast failures. The debug Copy/Clear regression checks and npm test passed. Results are recorded in appearance-audit-results.json. Screenshot evidence: appearance-light-desktop.png and appearance-light-mobile.png. Existing mobile browser smoke also checks app install/remove, the original diagnostic NES ROM, pause/resume, native tools, account switching, and public reload reset.

## Follow-up priorities

1. Keep app foregrounds/backgrounds on semantic tokens; include the appearance browser audit in CI before adding new palettes or app surfaces.
2. Add manual keyboard/focus, zoom, high-contrast/forced-colors, reduced-motion, and real Android/iOS checks. Include populated libraries, error/quarantine states, and restore dialogs.
3. Continue the performance roadmap: stable boot layout, smaller game icons, demand-loaded assets, and real-phone memory budgets. This appearance release does not claim a new Lighthouse score.
4. Preserve independent artwork, media, document paper, and engine skins. Theme the host controls around them rather than changing user content.

## Pasted debug log assessment

The supplied log's Drive/settings stack traces reference older 2026.10.08 assets. Its time-only timestamps do not identify an exact release or calendar date. The unchanged local-AI worker version alone cannot date the whole application.

Local AI successfully fell back from unavailable Gemma 3 1B to SmolLM2 360M, loaded cached weights, became ready, and completed generation cycles. The earlier cloud-model permission denial was a cancelled AI permission request, not Google account rejection. Engine readiness does not establish answer quality.

The genuine failures were Google Drive HTTP 500 responses while updating two Diablo save files. The existing incomplete-backup behavior withheld the success timestamp/manifest. This release adds up to three retries of the same captured file-update body after temporary network errors or HTTP 429/500/502/503/504, with exponential backoff and jitter. Authentication/permanent failures and explicit cancellation propagate immediately. Creation POSTs are excluded to avoid duplicate remote objects. This follows [Google's Drive error recovery guidance](https://developers.google.com/workspace/drive/api/guides/handle-errors).

Future copied logs include the build, page load/export dates, loaded key script versions, an AI snapshot, and ISO timestamps for entries. No live Google account was used for these automated checks; server errors were simulated. Pagination, conflict recovery, durable retry queues, and cross-device restore remain roadmap work.
