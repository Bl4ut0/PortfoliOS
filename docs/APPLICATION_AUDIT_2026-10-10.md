# Application audit — 2026-10-10

Scope: PortfoliOS release 2026.10.10.7, Desktop/Mobile app catalog, private workspace behavior, game launchers and the maintained [Browser.js fork](https://github.com/Bl4ut0/PortfoliOS-Browser.JS). This is a functional/appearance audit, not certification of every external service, game or physical device.

## Changes

- Removed the retired Tools Hub and hosted PDF Tools from Store/bookmarks. Native local PDF viewing remains available. Their external hosting is not deleted or reconfigured.
- Browser is a default desktop shortcut for public and private profiles. Existing custom icon positions retain priority.
- Browser.js shares controller initialization across concurrent tabs, registers readiness before navigation, times out stalled isolation setup, removes failed frames and offers Retry website. The OS now uses the same partition key when checking local/Hosted Browser.js ownership across profiles.
- Fixed OpenRCT2 Store downloads rejected by the runtime hotlink rule. The Store downloads before a runtime iframe exists, so the root/index entry and query variants must be allowed.
- Added explicit isolated PHP entry points for Duke, Diablo and Quake, plus Diablo's storage helper. The production static layer did not emit `.htaccess` isolation headers. Installed HTML still uses its existing SystemFS paths through service-worker aliases.
- Duke's CDN script now uses anonymous CORS, matching the CDN's response policy and the isolated host; previously installed HTML is upgraded when served.
- Quake no longer tries to install a missing server PAK. Store installs its engine, then a setup screen accepts local pak0.pak data with a checked PACK header, directory, entry bounds and required base assets. Imported data lives in the shared device runtime cache, outside Drive backup. WebQuake bypasses service workers for synchronous XHR, so a runtime adapter preloads the PAK with Fetch and serves its directory/entries from memory before starting the engine. Legacy audio play interruptions are handled. The installed-file service worker also answers bounded, suffix, open-ended and unsatisfiable byte-range requests.
- Office is labelled Office Preview. Its existing first-party text/JSON sheet editor no longer simulates a LibreOffice WASM download or invents memory/thread figures. Full LibreOffice and standard binary office-file compatibility remain future work; legacy JSON sheets still use their existing `.ods` save naming.

## Reproducible checks

Run `npm test` for app contracts, 24 Desktop/24 Mobile modules, viewport/Home, staged-loading/cache contracts, Drive session simulations, local security policy and installed-file ranges.

With PHP/Playwright configured through PORTFOLIOS_PHP and PORTFOLIOS_PLAYWRIGHT:

- `node scripts/check-private-experience-browser.js`: 32 IndexedDB assertions plus Desktop/Mobile private saves, A/B separation, preference/install persistence, public reset and Codex Preview.
- `node scripts/check-staged-loading-browser.js`: isolated boot/chooser/shells, lazy AI/media, retry and offline exact-release caches.
- `node scripts/check-mobile-apps-browser.js`: actual original diagnostic NES program, Store install, touch runtime pause/resume, Lobe session answers, native utilities and account switching.
- `node scripts/check-appearance-browser.js`: 559 rendered scenarios covering all native app surfaces/engine-free game chrome, Quake data setup, seven Desktop palettes, Mobile palettes/accents and Quick. Set PORTFOLIOS_APPEARANCE_RESULTS to preserve older result files. Most recent pre-deployment result: 12,743 text checks, zero detected contrast failures; repeat after changed surfaces as needed.
- `node scripts/check-browserjs-browser.js` and `node scripts/check-browser-providers.js`: actual fork UI and simulated providers; proxy settings, scope, public reset, tab retention, ownership, failed discovery, concurrent controller setup, isolation timeout/retry and bounded remote sessions. These do not establish external relay uptime.
- `node scripts/check-openrct2-store-browser.js --origin=https://os.bl4ut0.dev`: real Store installation under the real service worker. Four files/75,692,538 bytes matched source SHA-256, runtime no-backup metadata and private reload state. It does not launch the game or download RCT.zip.
- `node scripts/check-quake-browser.js`: supply legally obtained local data via PORTFOLIOS_QUAKE_PAK. Checks actual Store engine install, missing-data setup, invalid-data rejection, import, WebGL initialization, installed byte ranges and reload persistence. Optional --origin selects production; no game data is downloaded or published by this check.
- `node scripts/check-game-entrypoints-browser.js --origin=https://os.bl4ut0.dev`: opt-in disposable engine launch probe. PORTFOLIOS_GAME_IDS can select engines; PORTFOLIOS_GAME_RESULTS and PORTFOLIOS_GAME_SCREENSHOTS select output locations. It records runtime/setup state and exceptions; a loader/canvas alone does not certify gameplay.

## Production verification — completed 2026-10-11

- Published the application release plus its runtime README (45 uploaded files total). All 29 selected source/artifact SHA-256 values matched; all 347 static manifest paths responded successfully and all 79 reported lengths matched source.
- The four new game/storage PHP entry points returned HTTP 200 and COEP require-corp. Quake's complete Store/import/WebGL/reload check passed against production using disposable device-local data.
- Live Desktop/Mobile tests passed chooser-before-workspace, private local saves/preferences/install persistence, A/B document separation, public reset and the Codex Preview gate.
- Six desktop game entry points were observed without JavaScript exceptions: DOOM reported running, Duke created a 640×400 isolated canvas, Diablo created its isolated canvas while downloading its MPQ, Quake showed its missing-data setup, and OpenRCT2/UT99 initialized their isolated modules while downloading game data. These observations do not establish completed gameplay for the large-download engines.
- The initial game probe also flagged optional workspace HTML prefetch responses of 503. Actual shell requests succeeded. A follow-up probe confirmed these responses were prefetch attempts with successful later responses and no unresolved failure; the audit tool now records recovery separately. Avoiding these redundant failed prefetches remains a loading improvement.
- Explicit Hosted Browser.js loaded its UI and isolation controller, but did not render Example Domain within the test window. It remains an available connection option, not a verified reliable workaround for the maintained fork's rejected automatic relay.

## Material limits and follow-up priorities

1. **External browser relay:** live Desktop and Mobile discovery returned HTTP 200 containing an authorization error, rather than a Wisp URL. A maintained fork needs an authorized external Wisp endpoint. Hosted Browser.js is an explicit connection option; its live website test did not complete. Relay and content-isolation availability both require production verification. No relay credentials are stored in this report, no arbitrary demo fallback was added, and the OS server remains outside destination traffic routing.
2. **Game data:** Quake needs a local PAK. Engine launch observations do not establish every map, multiplayer, sound, controller or save/export path. UT99 depends on its remote runtime and deployed asset subset; local PHP without the necessary remote-fetch support cannot run it. Games marked Desktop-only remain unavailable on Mobile pending adaptation.
3. **Private game saves:** core private SystemFS documents/preferences/install selections are tested. Legacy ROM libraries, engine-specific IndexedDB/OPFS and device-shared runtime caches require individual isolation/save audits; they are not a blanket private-backup guarantee.
4. **Google/remote services:** provider simulations do not replace live Google OAuth/cross-device restore, authorized IPTV sources, actual AI inference on target GPUs or paid Hyperbeam verification. Codex is a readiness Preview, without browser ChatGPT sign-in or coding.
5. **OpenRCT2 CDN:** fresh URL requests exercise the corrected origin rule, but warmed CDN responses can bypass its referrer check. The hosting layer did not emit requested CDN cache headers. Operator-level cache bypass/purge is required for a reliable hotlink barrier. This is not an authentication boundary and does not prevent the successful Store installation.
6. **Devices/accessibility:** Chromium phone emulation and computed contrast checks do not certify installed PWAs, physical phone memory/battery, all assistive technologies or text over images.

Prioritize an authorized production browser relay, per-engine save isolation, honest format support in Office Preview, and physical-device tests before expanding the WASM catalog. Keep engine/package downloads on app use so catalog growth does not enlarge boot.
