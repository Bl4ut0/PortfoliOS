# PortfoliOS Modular App Framework

This document is the source of truth for building apps inside PortfoliOS. The goal is to keep each app isolated in its own folder while sharing the same window lifecycle, adaptive sizing, audio routing, save storage, and security rules.

## Runtime Pieces

- `core/app-framework.js`: app validation, lifecycle hook runner, safe iframe messaging, modular teardown, and audio adapter registration.
- `core/app-loader.js`: lazy loads `apps/<app-id>/app.css` and `apps/<app-id>/app.js`, then validates registration.
- `core/window-manager.js`: creates, focuses, drags, resizes, minimizes, maximizes, and closes app windows.
- `apps/_shared/iframe-game.js`: factory for iframe/WASM games with controls overlay, pointer release, `beforeLoad`, and save sync hooks.
- `apps/_shared/iframe-game.css`: shared adaptive sizing and iframe fill rules for game windows.
- `core/filesystem.js`: IndexedDB-backed `SystemFS`, including `/Saved Games`.
- `core/preferences.js`: desktop preferences, volume propagation, and game iframe focus handling.

## Folder Shape

Each modular app owns a directory:

```text
apps/
  myapp/
    app.js
    app.css
```

Templates live in:

```text
apps/_template/
apps/_template-game/
```

After copying a template, add one entry to `window.desktopApps` in `data/apps.js` and set `modular: true`:

```javascript
{ id: "myapp", title: "My App", icon: "fa-solid fa-window-restore", modular: true }
```

`window.modularApps` is derived from that catalog. Add a `window.storeApps` entry only when the app should be installable from the Store. Start automatically places installed apps that are not in a configured group under **Other Apps**.

Every modular app must be reachable: include its ID in `window.standardInstalledAppIds` for a built-in app, or add an installable Store entry.

### Compatibility Modules

`apps/local-ai/` is a retained standalone UI implementation, not a loadable modular app or a template. The `local-ai` launcher intentionally opens **Settings > Local AI**, where the maintained controls live. Its catalog entry therefore must not set `modular: true`.

Any compatibility module under `apps/` must be explicitly listed in `scripts/check-app-contracts.js`, carry a local README explaining its active replacement, and have its launcher redirect verified by the audit. New apps should always start from `apps/_template/` or `apps/_template-game/`.

## App Registration Contract

Each `app.js` registers itself on `window.appRegistry[appId]`:

```javascript
(function() {
    const APP_ID = "myapp";

    window.appRegistry[APP_ID] = {
        title: "myapp.exe",
        icon: "fa-solid fa-window-restore",
        windowClass: "myapp-window utility-window",
        renderBody: () => `<div class="myapp-shell">...</div>`,
        onOpen: (windowEl) => {},
        onRestore: (windowEl) => {},
        onFocus: (windowEl) => {},
        onMinimize: (windowEl) => {},
        onMaximize: (windowEl) => {},
        onClose: async (windowEl) => {}
    };
})();
```

Required fields:

- `title`: text shown in the title bar.
- `icon`: Font Awesome class or image path.
- `windowClass`: unique app class plus a framework preset such as `utility-window`, `service-window`, `media-window`, `document-window`, or `game-window`.
- `renderBody()`: returns the app body HTML.

Lifecycle hooks:

- `onOpen(windowEl)`: called once after a mounted window is created and shown. Bind listeners and initialize persistent app state here. It may return a Promise; `openDesktopWindow()` resolves after that work finishes while the window remains visible.
- `onRestore(windowEl)`: called when a minimized window becomes visible. Resume paused loops, media, or runtime input here.
- `onFocus(windowEl)`: called when an already visible window becomes active. Use it for lightweight refresh or focus work, not initialization.
- `onClose(windowEl)`: called before modular teardown. It may return a Promise; teardown waits for it so save sync and cleanup can finish.
- `onMinimize(windowEl)`: pause timers, loops, animations, or audio.
- `onMaximize(windowEl, context)`: re-measure canvas/editor/game surfaces. `context.isMaximized` reports the new state.

Long `onOpen` work must be cancellable. Keep its `AbortController`, timer IDs, or initialization promise in module scope, cancel them in `onClose`, and prevent late completions from touching a detached window.

## Adaptive Window Sizing

Do not hard-code fixed `width: 800px` or `height: 600px` on app windows. Use a preset class and CSS variables:

```css
.desktop-window.myapp-window {
    --app-window-width: min(48rem, calc(100% - 2rem));
    --app-window-height: min(34rem, calc(100% - 6rem));
    --app-window-left: clamp(4rem, 10vw, 8rem);
    --app-window-top: 4.8rem;
}
```

The framework owns the root window's `display`, `width`, `height`, `left`, and `top` behavior. Do not set `display` on the app root, and express custom geometry through the `--app-window-*` variables.

Framework presets:

- `utility-window`: general tools and operational panels.
- `service-window`: hosted tools or external service launchers.
- `document-window`: editors, readers, and file-centric apps.
- `media-window`: audio/video apps.
- `game-window`: iframe/canvas/WASM games.

Inside the window body, use this pattern:

```css
.myapp-shell {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.myapp-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
}
```

## Iframe Game Apps

Use `window.createIframeGameApp()` for iframe-hosted games:

```javascript
window.appRegistry.mygame = window.createIframeGameApp({
    id: "mygame",
    title: "mygame.exe",
    icon: "fa-solid fa-gamepad",
    windowClass: "mygame-window game-window",
    iframeSrc: "mygame/index.html",
    controlsHtml: `
        <li><kbd>WASD</kbd><span>move</span></li>
        <li><kbd>Ctrl</kbd><kbd>Alt</kbd><span>release cursor</span></li>
    `,
    beforeLoad: restoreSavesFromSystemFS, // receives (windowEl, { signal })
    onSaveSync: syncSavesToSystemFS
});
```

Game windows should import the shared CSS:

```css
@import "../_shared/iframe-game.css?v=1.0.33";
```

The game helper:

- Renders a standard `.game-shell` and `.game-frame`.
- Delays assigning `iframe.src` until `beforeLoad` finishes and passes it an abort signal for close-during-startup cancellation.
- Posts `release-pointer-lock`, `focus-game`, `volume`, and `save-sync` using the iframe's resolved origin.
- Shows a controls card that includes the standard `Ctrl` + `Alt` cursor release hint.
- Resynchronizes volume, focus, and controls on restore and focus.

## Audio Layer

Apps with direct audio control should register an audio adapter on open and unregister on close:

```javascript
let unregisterAudio = null;

function setVolume(volume) {
    gainNode.gain.value = volume / 100;
}

onOpen: () => {
    unregisterAudio = window.registerAppAudioAdapter("myapp", { setVolume });
},
onClose: () => {
    unregisterAudio?.();
}
```

Iframe games should listen for:

```javascript
window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "volume") {
        setRuntimeVolume(event.data.value);
    }
});
```

If a third-party iframe runtime cannot change volume through JavaScript, document that limitation in the app file and keep the PortfoliOS controls visible.

## Save Storage

Apps are local-first. They must write user data to `SystemFS` and must not authenticate, connect, disconnect, or invoke cloud synchronization directly. Cloud ownership belongs exclusively to **Settings > Cloud Sync**.

To point a user toward optional backup without implementing sync in the app, use the shell route:

```html
<button type="button" data-open-settings-panel="cloud-sync">
    Cloud Sync Settings
</button>
```

The contract audit rejects modular apps that access `window.GDriveSync` or Google Drive client configuration. Runtime assets, ROMs, hidden cache paths, system account files, and records with `metadata.sync: false` remain local when Settings performs a sync.

All game saves that should be visible in File Explorer belong under:

```text
/Saved Games/<Game Name>/
```

Use:

```javascript
const saveDir = await window.SystemFS.ensureSavedGameDirectory("My Game");
await window.SystemFS.writeFile(
    `${saveDir}/slot1.sav`,
    "slot1.sav",
    saveDir,
    blob,
    blob.size,
    "application/octet-stream",
    false,
    { metadata: { game: "mygame" } }
);
```

Game save lifecycle:

1. `beforeLoad`: restore saves from `SystemFS` into the runtime before launch.
2. Runtime play: write saves normally inside the game engine.
3. `onSaveSync` or `onClose`: flush runtime saves back into `SystemFS`.
4. File Explorer: users can see `/Saved Games/<Game Name>`.
5. Cloud sync: only sync user files and saves, not hidden runtime assets or secrets.

## Store And Service Apps

Use `data/apps.js` categories consistently:

- `Games`: installable browser/WASM games.
- `Services`: hosted apps such as `tools.bl4ut0.com` and `pdf.bl4ut0.com`.
- `Productivity`: editors, document tools, and future office apps.
- `Media`: players, visualizers, and audio tools.

For hosted services, set:

```javascript
{
    id: "tools",
    title: "Tools Hub",
    category: "Services",
    bookmarkId: "tools",
    installable: false
}
```

## Security Rules

- Never use `postMessage(..., "*")` for game/runtime messages. Use `window.postMessageToIframe()`.
- Validate `event.origin` and message shape before trusting iframe messages.
- Treat same-origin game iframes with `allow-same-origin` as privileged code.
- Do not place OAuth client secrets in the frontend.
- Access tokens are sensitive. The current Google Drive flow stores a short-lived access token in local storage for convenience; this should be revisited before broader user accounts.
- Sync only approved `SystemFS` paths. Hidden dotfiles and runtime assets should stay local unless explicitly exported.
- Escape user-visible file names and external catalog text before inserting HTML.

## Verification Checklist

Run the automated contract and syntax audit first:

```powershell
node scripts/check-app-contracts.js
```

For every new modular app:

- App opens, closes, reopens, minimizes, maximizes, drags, and resizes.
- Closing during startup cancels pending fetches, timers, workers, and runtime initialization without reviving the app later.
- Window fits at 390 x 844, 768 x 1024, 1366 x 768, and 1920 x 1080.
- Text and controls do not overflow at narrow sizes.
- `onClose` releases timers, event listeners, iframes, audio contexts, and pointer lock.
- Audio follows the PortfoliOS volume slider or clearly documents why it cannot.
- Saves restore on first launch and sync back into `/Saved Games` on close.
- Console has no uncaught hook errors, missing registration errors, or cross-origin message warnings.
- A loader failure shows a useful error and the app can retry without reloading PortfoliOS.
