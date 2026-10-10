# Staged loading architecture

Release 2026.10.10.1. This implements the loading work identified in the [performance audit](PERFORMANCE_AUDIT.md) before expanding the WASM catalog.

## Entry points and boundaries

| Stage | Entry point | Behavior |
| --- | --- | --- |
| Boot | index.html, core/boot.js, main.js | Critical boot styles, viewport setup, loading graph, original typed introduction and Desktop/Mobile/Quick buttons. No workspace markup, account storage initialization, app controller, model or game engine. |
| Login | core/staged-loader.js → shared graph | Account definitions, account chooser and shared storage/auth APIs. Desktop sign-in is full screen; Mobile sign-in uses an empty phone frame. No workspace is mounted and neither shell executes. Google sign-in code loads when the user chooses Google. |
| Prepare selected experience | low-priority prefetch links | Download only the chosen shell's scripts, styles and HTML while the chooser is visible. Prefetch never evaluates scripts or mounts HTML. Data-saving browsers skip speculative downloads. |
| Profile selected | prepareSessionStorage, startSelectedWorkspace | Initialize SystemFS/security, restore the selected account's preferences, fetch/clone its workspace HTML, then execute its shell entry. Keep sign-in over the interface until mounting finishes. |
| Workspace ready | deferred background task | Begin eligible private Drive backup without awaiting a full backup. Optional font styling loads without blocking entry. Public reset and private backup boundaries remain intact. |
| App opened | core/app-loader.js or mobile/app-loader.js | Resolve that app's declared controller/service dependencies, then load its module and styles. Engine assets continue to load through each app's runtime and installation rules. |

The loading graph lives in **core/loading-manifest.js**. Its release must match index.html, sw.js and both app-loader versions; npm test checks consistency. Required dependency groups download concurrently through preload links and execute in dependency order. It preserves classic-script dependencies while the existing app APIs remain compatible. A bundler or framework migration is not required.

Desktop mounts through mountDesktop, Mobile through mountMobile, and Quick through mountQuick. Each runs once. Switching experiences loads the destination on demand and retains existing windows/tasks. The typed introduction and selector always appear on reload, including remembered view URLs. Reduced-motion users receive the final introduction immediately.

Workspace markup moved to core/workspace.html and the selected desktop/workspace.html, mobile/workspace.html or quick/workspace.html. Desktop app templates remain inert inside the Desktop workspace. Mobile never loads the Desktop window manager, shell, terminal, settings controller or Desktop component stylesheet during its own entry.

## Optional code and services

- Terminal, settings, store, browser, dossier, network and Linux controllers load with their apps. AI code loads for AI consumers such as Lobe, CLI, Desktop Settings or the AI tray; model weights still require enabling a model.
- Mobile AI uses shared AI APIs without creating the Desktop mascot. Media/file-intent APIs load for their consumers; media indexing remains behind service initialization.
- Hidden Start menu content is rendered when the menu opens, avoiding the large game-icon download during boot.
- The network canvas pauses during login, hidden documents, other experiences and reduced motion. Starting it again does not create another animation loop.
- Shared escaping and backup orchestration live outside Desktop components so native Mobile account controls and automatic sync work independently.

## Offline and recovery

The worker installs an atomic **11-asset boot cache** with at most three downloads at a time. It no longer preloads every app or experience. Used versioned shell and app assets are cached on demand; exact cached versions avoid background revalidation. Navigation checks the network and falls back to cached boot HTML offline. Installed game binaries retain their existing SystemFS interception.

Previously visited experiences and apps can reopen offline once their assets have cached. An experience/app never visited is not promised offline. Google reconnection requires the network; remembered private local workspaces remain available through offline continuation.

Install failure removes the incomplete new cache and preserves the active release. Activation carries forward current-release assets fetched by the previous worker during an upgrade, retains one previous staged cache, and retires legacy broad caches. A missing requested asset version never silently falls back to different release code.

Script/style/HTML loads share promises and retry failed downloads. Account entry is serialized, and failed mounting leaves the chooser available to retry. Existing private-to-public backup failure behavior and account-scoped filesystem rules remain covered by their regression suites.

## Timing and checks

User Timing marks identify boot-start, selector-ready, experience:selected, experience:login-ready, experience:workspace-start, mounted and workspace-ready. Measures report the typed sequence, selection-to-login, and profile-entry-to-workspace durations. Workspace timings exclude the time spent choosing an account. Desktop Settings → Debug includes these measures with the release and loaded asset versions; no account identity or token is added to timing names.

Run:

```powershell
npm test
node scripts/check-staged-loading-browser.js
node scripts/check-mobile-apps-browser.js
node scripts/check-appearance-browser.js
```

Browser checks use disposable Chrome profiles. Set PORTFOLIOS_PLAYWRIGHT to the Playwright module path if it is outside the repository's Node resolution path. Staged checks cover separate entries, no shell execution/DOM before account selection, lazy services, concurrent app-load deduplication, Quick controls, experience switching, remembered private accounts, failed-download retries, atomic cache installation and offline app reload.

See [the loading measurements](LOADING_PERFORMANCE.md) for the reproducible lab scope and results. Live Google consent and a cross-device restore still require account-authorized verification; the automated account checks use isolated fixtures.

## Adding an app

Keep its engine imports, workers, models, WASM, fonts and heavyweight images out of boot and shell entries. Add consumer-specific dependencies to desktopApps or mobileApps in the manifest if necessary. Keep each Mobile implementation native. Follow the existing app registration/lifecycle contracts and [WASM integration checklist](wasm/INTEGRATION.md) for installation, profile-safe Open/Save, backup and memory budgets. Confirm the app starts on first use and stays absent from unrelated startup network/script traces.

Remaining performance work: optimize game icons at source, measure actual phones and throttled production user flows, split the remaining shared Desktop/Quick component CSS further where justified, and collect privacy-conscious field interaction metrics. This release does not claim a new Lighthouse score or field INP result.
