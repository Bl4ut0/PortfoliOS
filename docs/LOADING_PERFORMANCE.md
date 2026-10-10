# Loading performance — 10 October 2026

Release 2026.10.10.2 implements the [staged-loading architecture](STAGED_LOADING.md). Baseline: 4dcc82a, immediately before restructuring. Machine-readable runs: [loading-audit-results.json](loading-audit-results.json).

## Comparable cold selector runs

Three independent cold Chrome contexts at 1440 × 1000 and three at 390 × 844, before and after. Local HTTP server, no network or CPU throttling, service workers blocked, third-party requests aborted in both sets. The original typed sequence ran naturally; reduced motion and fast-forward were not used in these measurements.

| Metric before the selector is ready | Before | After |
| --- | ---: | ---: |
| First-party asset requests, excluding the HTML document | 65 | 9 |
| Script resource requests | 51 | 5 |
| Required service-worker install assets | 119 | 11 |
| Decoded first-party asset bytes, excluding HTML | 1,923,867 | 43,900 |
| Desktop boot CLS, every run | 0.0838 | 0 |
| Narrow viewport boot CLS, every run | 0.3286 | 0 |
| Median selector visible, 1440 px | 5,812 ms | 5,434 ms |
| Median selector visible, 390 px | 5,666 ms | 5,459 ms |

Decoded selector asset bytes fell approximately **97.7%**. These are source/resource body sizes, not compressed production transfer bytes. The deliberate typed introduction still occupies roughly five to six seconds; this release primarily removes hidden loading/initialization and stabilizes layout. Six after-runs recorded no tasks longer than 50 ms during this narrow boot measurement. This does not establish field responsiveness.

The HTML entry now contains boot content rather than every workspace. Desktop, Mobile and Quick markup loads after profile selection. Mobile also avoids the roughly 120 KB Desktop component stylesheet and all Desktop controllers during its entry. Required boot script requests contain viewport, manifest, staged loader, boot animation and main entry only. No game image, model, engine or optional app module appears in that stage.

## Stage, cache and interaction checks

The staged browser suite exercises all three entries, profile-gated mounting, native phone sign-in, app/service loading, concurrent-load deduplication, Quick search/routes, remembered private profiles, experience switching without remounting, shared-dependency and Mobile-shell failure retries, small atomic boot caching, and offline reload of a visited Mobile workspace/app.

Stage measurements in one unthrottled local smoke run were 134–329 ms from experience selection to login, and 135–337 ms from workspace entry to readiness. These are diagnostic examples, not deployment latency guarantees or a benchmark against the old workspace flow. Production timings appear in Desktop Settings → Debug; profile selection time is excluded from the workspace measure.

Offline installation now downloads only 11 boot assets, with concurrency capped at three. Apps and other shells cache on use. Unit checks cover incomplete-install rollback, current-release asset migration from a previous worker, and refusal to substitute a different asset version when offline. Browser checks cover offline boot and reopening a visited app. An unvisited app/experience is not promised offline.

Final appearance regression: 535 scenarios, 12,340 rendered text checks, zero contrast failures. The native Mobile suite covers Store installation, original diagnostic NES ROM import/start/pause/resume, Lobe, account controls, private-to-public switching and public reload reset. Standard checks retain Google-session and SecurityKernel coverage. Automated sign-in uses fixture accounts; live Google consent was not repeated.

## Reproduce and remaining work

```powershell
node scripts/measure-loading.js --output=docs/loading-navigation-results.json
node scripts/check-staged-loading-browser.js
node scripts/check-mobile-apps-browser.js
node scripts/check-appearance-browser.js
npm test
```

Set PORTFOLIOS_PLAYWRIGHT if Playwright is outside normal Node resolution. The measurement harness always uses disposable profiles and blocks external requests for a consistent first-party comparison. Service-worker behavior is covered separately by the staged suite.

This is not a new Lighthouse run, throttled real-phone benchmark, authenticated cross-device restore, or field LCP/INP assessment. Next: production throttled user-flow traces, real Android/iOS memory and interaction measurements, smaller game icons, further justified CSS splitting, and immutable asset-path releases for stronger multi-tab rollout guarantees. Keep WASM expansion behind app-specific loading boundaries.
