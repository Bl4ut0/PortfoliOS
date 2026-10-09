# PortfoliOS performance audit — 8 October 2026

Audited production https://os.bl4ut0.dev/ at commit 5e2baa2. No runtime changes were made.

## Measurements and scope

Official Lighthouse 13.5.0 CLI, isolated headless Chrome profiles, performance category, cold navigation to the boot screen. Mobile uses simulated throttling (4× CPU slowdown, 150 ms RTT, approximately 1.6 Mbps throughput) and 412 × 823 viewport. Desktop uses Lighthouse desktop preset. These are lab measurements of initial navigation, not field measurements or authenticated Google sessions. Both baseline runs completed without warnings. A second valid mobile run scored 64/100 with FCP 3.9 s, LCP 4.1 s, TBT 80 ms and CLS 0.252. An earlier repeat attempt failed with Lighthouse NO_NAVSTART and was discarded; the saved repeat JSON is the valid retry. INP requires real interactions/field telemetry; this audit does not claim an INP result. TBT is a lab proxy, not INP.

| Metric | Desktop | Mobile | Interpretation |
| --- | ---: | ---: | --- |
| Lighthouse performance | 94/100 | 64–66/100 | Desktop good; mobile needs improvement |
| First contentful paint | 1.0 s | 3.8–3.9 s | Mobile first rendering is delayed |
| Largest contentful paint | 1.2 s | 4.0–4.1 s | Desktop good; mobile near the poor boundary |
| Total blocking time | 0 ms | 60–80 ms | Main-thread blocking is comparatively low |
| Cumulative layout shift | 0.066 | 0.252 | Desktop good; mobile poor |
| Speed index | 1.1 s | 3.8 s | Mobile visual completion is slower |
| INP | Not measured | Not measured | Requires an interaction audit/field data |

Google's good Core Web Vitals targets are LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1, assessed at the 75th percentile of real visits. These lab runs cannot establish real-user compliance. See https://web.dev/articles/vitals and https://developer.chrome.com/docs/lighthouse/performance/performance-scoring.

## Prioritized findings

### 1. Stabilize the typed boot panel — high priority

Lighthouse attributes mobile's largest shift (0.205 of total 0.252) to body > #boot-screen > .boot-panel. Another 0.022 shift lists late-loaded Inter, Space Grotesk, and JetBrains Mono fonts. desktop/boot.js clears textContent and then types text back into a vertically centered panel. Its height changes as text grows, moving the entire panel. styles/boot.css does not reserve final dimensions for all typed blocks.

Keep the typed introduction and experience selector. Reserve the final text geometry before typing: an invisible final-text sizing layer or measured, stable block heights at each responsive width, with the visible typewriter layered over it. Match fallback font metrics and avoid wrapping changes during font swap. Verify at 390/412 px, landscape, zoom, and reduced-motion settings. Target CLS <0.1; confirm a new trace rather than promising an exact score improvement.

### 2. Reduce blocking styles and font dependencies — high priority

Lighthouse estimates 2,870 ms mobile and 700 ms desktop FCP/LCP savings for render-blocking requests. This is modeled potential, not a guaranteed or additive saving. The head synchronously loads Google Fonts CSS, Font Awesome CSS, viewport.js, and styles-v1.css; the latter discovers ten stylesheets through CSS @import. Both complete shell styles and boot styles load before the user chooses an experience.

Serve a small critical boot/sign-in stylesheet first; load the selected shell styles afterwards. Replace the CSS import chain with a generated stylesheet or explicitly discover the necessary critical CSS in the HTML. Preserve the viewport initialization needed to prevent wrong mobile geometry; defer only the noncritical viewport work. Fonts transfer about 102 KiB for Google Fonts plus 153 KiB for the Font Awesome solid font. Use a small icon subset or existing SVGs for boot/sign-in, then load the full app icon set on entry. Self-host and preload only the font actually needed above the fold, with matching fallback metrics. Both Google Fonts preconnects are used; do not remove them as unused.

### 3. Avoid fetching the large Doom icon before entry — high priority for bandwidth

The navigation fetched doom-icon.png: 744,618 transfer bytes (727 KiB), approximately 53% of the measured 1.33 MiB page transfer. data/apps.js references it in app metadata, and desktop/start-menu.js eagerly renders all app icons during boot even though that menu is hidden. The two baseline runs each recorded 75 page requests and approximately 1.33 MiB total transfer.

Create appropriately sized icon variants (for example 64/128 px WebP or optimized PNG), set explicit dimensions, and delay menu-only images until the launcher opens. Preserve the original if another view needs it. Moving this request out of startup would avoid approximately 727 KiB of initial transfer; final resized-image savings require generating and comparing the replacement. Lighthouse's image insight estimates 0 ms for the current LCP, so this is a bandwidth/background-content optimization, not a claimed LCP saving.

### 4. Load only the selected experience and app controls — medium priority

index.html loads 49 first-party external scripts: 757,514 source bytes, approximately 180,705 bytes in local gzip estimates (HTTP headers add overhead). core/local-ai.js alone is 83,797 source bytes; desktop/terminal.js is 56,701. Mobile still loads desktop settings, terminal, network map, store, AI controls, and desktop shell. desktop/shell.js eagerly renders Desktop, Mobile, and Quick UI before running the typed introduction.

Split bootstrap + identity/storage from selected-shell entry, then lazy-load optional terminal/AI/settings controllers with the existing app loader. Audit event listeners and global symbol dependencies before moving files. Do not remove CSS based only on initial-page coverage: the UI needs many of those rules after sign-in. Lighthouse reports 36 KiB unused CSS on initial mobile load, including Font Awesome and components.css; defer it rather than deleting it wholesale.

### 5. Limit offline precache work during startup — medium priority

sw.js lists 102 required assets, including all mobile app scripts/styles. Installation launches every fetch through Promise.all with cache: reload. The page itself loads versioned URLs; precache uses unversioned paths. serveMobileShellAsset also starts a network fetch even when an exact cached asset exists. This preserves freshness but adds network work on repeat visits. The Lighthouse page-request total is not a complete count of separate service-worker background requests.

Precache a small required bootstrap/login/mobile-home core first. Cache app controllers on first use and populate optional offline resources after entry/idle with bounded concurrency. Keep atomic release activation and an explicit versioned manifest. Consider cache-first immutable fingerprinted assets and network-first navigation, rather than revalidating every unchanged versioned script. Test offline boot, missing optional assets, version upgrades, and private-profile restore before rollout.

### 6. Reduce viewport reflow and pause desktop animation — medium/low priority

Mobile's forced-reflow insight attributes about 75.5 ms of layout work to viewport.js (reported source lines 206 and 284). Its collect() reads root.clientWidth/clientHeight; a scheduled animation frame reruns viewport calculations. Separate layout reads from writes and skip unchanged dimensions/class updates. Retain keyboard, orientation, foldable and edge-presentation behavior. Mobile's longest observed task was 159 ms attributed to viewport.js; total blocking remained only 60 ms, so prioritize boot layout and network first.

Source inspection of desktop/canvas-bg.js shows a perpetual requestAnimationFrame loop, checking every node pair. At 66 nodes that is 2,145 pair comparisons per frame (~129,000 at 60 fps). It has no view, visibility, or reduced-motion pause guard. Pause it on mobile/login/hidden tabs and honor reduced motion. This is a source-backed battery/runtime concern; post-login animation CPU was not measured by the navigation Lighthouse run.

## What is already working

Production compression is enabled: HTML Brotli; sampled CSS/JS gzip. Direct production probes measured roughly 185–283 ms to response headers from this connection; Lighthouse document-latency insight estimated no savings. HTTP modernization, duplicate-JavaScript, viewport and DOM-size insights estimated no relevant savings. DOM count was 1,114 elements; avoid a broad DOM rewrite on that evidence alone. Minification opportunities were approximately 21 KiB JS + 5 KiB CSS with 0 ms estimated timing savings, so they are lower priority than layout and blocking dependency work. Do not weaken cross-origin isolation or authentication to improve a score.

## Delivery plan and success checks

1. Stabilize typed boot geometry and font fallback; target mobile CLS <0.1.
2. Split critical boot/sign-in CSS, slim boot icons/fonts, and stop eager hidden icon downloads.
3. Split experience/app loading and reduce precache contention.
4. Validate actual desktop/mobile sign-in, public reset, private preservation, offline entry and cache upgrade behavior.
5. Run at least three isolated cold mobile and desktop navigations plus warm-cache runs; compare medians. Add a user-flow trace for selector → login → workspace → launcher/settings. Collect privacy-conscious real-user LCP/CLS/INP before claiming field compliance.

The roughly 5-second intentional typed sequence is product behavior and should remain. Network, storage and hidden-shell initialization delays before that animation are separate optimization targets. Initial-navigation LCP nodes include the mobile advisory/desktop icons, not necessarily the final login UI; score gains should be checked alongside time to visible selector and time to usable workspace.

## Artifacts

- performance-mobile-2026-10-08.report.html / .report.json
- performance-desktop-2026-10-08.report.html / .report.json
- performance-mobile-repeat-2026-10-08.json (valid repeat result; see Measurements and scope)

No production behavior was changed as part of this audit.
