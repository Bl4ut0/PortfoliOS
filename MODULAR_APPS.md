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

After copying a template, add the new app ID to:

- `core/app-loader.js` in `window.modularApps`
- `data/apps.js` in `window.desktopApps`
- `data/apps.js` in `window.storeApps` if it should appear in the Store

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

- `onOpen(windowEl)`: called after the window is created and shown. It may return a Promise; the window manager catches failures but does not block initial display.
- `onClose(windowEl)`: called before modular teardown. It may return a Promise; teardown waits for it so save sync and cleanup can finish.
- `onMinimize(windowEl)`: pause timers, loops, animations, or audio.
- `onMaximize(windowEl)`: re-measure canvas/editor/game surfaces.

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
    beforeLoad: restoreSavesFromSystemFS,
    onSaveSync: syncSavesToSystemFS
});
```

Game windows should import the shared CSS:

```css
@import "../_shared/iframe-game.css?v=1.0.33";
```

The game helper:

- Renders a standard `.game-shell` and `.game-frame`.
- Delays assigning `iframe.src` until `beforeLoad` finishes.
- Posts `release-pointer-lock`, `focus-game`, `volume`, and `save-sync` using the iframe's resolved origin.
- Shows a controls card that includes the standard `Ctrl` + `Alt` cursor release hint.

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

For every new modular app:

- App opens, closes, reopens, minimizes, maximizes, drags, and resizes.
- Window fits at 390 x 844, 768 x 1024, 1366 x 768, and 1920 x 1080.
- Text and controls do not overflow at narrow sizes.
- `onClose` releases timers, event listeners, iframes, audio contexts, and pointer lock.
- Audio follows the PortfoliOS volume slider or clearly documents why it cannot.
- Saves restore on first launch and sync back into `/Saved Games` on close.
- Console has no uncaught hook errors, missing registration errors, or cross-origin message warnings.
