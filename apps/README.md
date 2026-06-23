# PortfoliOS Apps

Apps in this folder are lazy-loaded modules. Start from one of the templates, then follow the framework contract in `../MODULAR_APPS.md`.

## Templates

```text
apps/_template/       # utility/service/document app
apps/_template-game/  # iframe game app
```

Copy a template to `apps/<app-id>/`, then update:

- `APP_ID` in `app.js`
- `.desktop-window.<app-id>-window` selectors in `app.css`
- `window.modularApps` in `../core/app-loader.js`
- `window.desktopApps` and optionally `window.storeApps` in `../data/apps.js`

## Required App Shape

```javascript
(function() {
    const APP_ID = "myapp";

    window.appRegistry[APP_ID] = {
        title: "myapp.exe",
        icon: "fa-solid fa-window-restore",
        windowClass: "myapp-window utility-window",
        renderBody: () => `<div class="myapp-shell">...</div>`,
        onOpen: (windowEl) => {},
        onClose: async (windowEl) => {},
        onMinimize: (windowEl) => {},
        onMaximize: (windowEl) => {}
    };
})();
```

Use `utility-window`, `service-window`, `document-window`, `media-window`, or `game-window` as the shared sizing preset.

## Window Sizing

App CSS should set variables, not fixed pixels:

```css
.desktop-window.myapp-window {
    --app-window-width: min(48rem, calc(100% - 2rem));
    --app-window-height: min(34rem, calc(100% - 6rem));
    --app-window-left: clamp(4rem, 10vw, 8rem);
    --app-window-top: 4.8rem;
}
```

The window body should use `flex: 1 1 auto` and `min-height: 0` so it can shrink inside the desktop surface.

## Game Apps

Iframe games should use `window.createIframeGameApp()` and import the shared CSS:

```css
@import "../_shared/iframe-game.css?v=1.0.33";
```

Provide:

- `controlsHtml` for keyboard/mouse help.
- `beforeLoad` for save restore.
- `onSaveSync` for save export to `/Saved Games/<Game>`.
- Pointer release support through `Ctrl` + `Alt` where the runtime can cooperate.

## Audio And Saves

- Direct audio apps register with `window.registerAppAudioAdapter(appId, { setVolume })`.
- Iframe apps should listen for `{ type: "volume", value }` messages from PortfoliOS.
- Persistent game files should use `window.SystemFS.ensureSavedGameDirectory(gameName)`.
- Hidden runtime assets and OAuth tokens should not be cloud-synced by default.
