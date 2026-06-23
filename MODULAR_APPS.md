# PortfoliOS Modular Application Framework

PortfoliOS features a modular, dynamic application framework designed to treat web applications and WebAssembly ports as proper desktop executables. Rather than eagerly loading scripts, styles, and iframe elements at system boot, resources are fetched dynamically on demand. When an application is closed, its memory, DOM container, script tags, and registry entries are fully unloaded and garbage-collected, ensuring a clean, low-overhead workspace.

---

## 1. Directory Structure

Each modular application resides in its own subdirectory under the `apps/` folder:

```
c:/Dev Projects/bl4ut0-portfolio-os/apps/
├── doomsource/
│   ├── app.js      # App registration, WebAssembly loader, and lifecycle hooks
│   └── app.css     # App-specific layout, loading panels, and canvas styling
├── duke32/
│   ├── app.js      # Iframe loader referencing duke32/index.html
│   └── app.css     # Sizing and positioning rules
└── <new-app-id>/
    ├── app.js
    └── app.css
```

---

## 2. Dynamic Loader & Registry

The framework centers around two structures:
1. `modularApps` array in `app.js` containing active modular app IDs (e.g. `["doomsource", "duke32", "diablo", "quake"]`).
2. `window.appRegistry` object where each loaded script registers its metadata, template renderer, and lifecycle hooks.

When an app is launched, `openDesktopWindow(name)` triggers `ensureAppLoaded(name)`. This helper injects the stylesheet and script:

```javascript
async function ensureAppLoaded(appId) {
    if (!modularApps.includes(appId) || window.appRegistry[appId]) return;
    
    // Inject app-specific styling
    if (!document.getElementById(`app-style-${appId}`)) {
        const link = document.createElement("link");
        link.id = `app-style-${appId}`;
        link.rel = "stylesheet";
        link.href = `apps/${appId}/app.css`;
        document.head.appendChild(link);
    }
    
    // Inject and execute app script
    if (!document.getElementById(`app-script-${appId}`)) {
        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.id = `app-script-${appId}`;
            script.src = `apps/${appId}/app.js`;
            script.onload = () => resolve();
            script.onerror = () => {
                console.error(`Failed to load script for app: ${appId}`);
                resolve();
            };
            document.head.appendChild(script);
        });
    }
}
```

---

## 3. App Script Specification (`app.js`)

An application script should wrap its logic inside an Immediately Invoked Function Expression (IIFE) to encapsulate its state variables. It must register a configuration object on `window.appRegistry[appId]` containing:

* `title` (string): Title displayed in the window bar.
* `icon` (string): FontAwesome class name (e.g. `fa-solid fa-radiation`) or image URL path (e.g. `doom-icon.png`).
* `windowClass` (string): Unique class added to the window element (e.g. `duke32-window`).
* `renderBody` (function): Returns the inner HTML template of the window (typically containing a `<canvas>` or `<iframe>`).
* `onOpen(windowEl)` (function): Callback triggered when the window is loaded and displayed. Used to initialize scripts, assign iframe sources, or kick off WASM executables.
* `onClose(windowEl)` (function): Callback triggered right before the window is destroyed. Used to close AudioContexts, release pointers, and clear internal variables.
* `onMinimize(windowEl)` (function): Callback triggered when minimizing. Used to pause main game loops or suspend audio.
* `onMaximize(windowEl)` (function): Callback triggered when maximizing.

### Example Iframe App Script

```javascript
(function() {
    window.appRegistry.duke32 = {
        title: "duke3d.exe",
        icon: "fa-solid fa-radiation",
        windowClass: "duke32-window",
        renderBody: () => `
            <div class="game-shell">
                <iframe data-src="duke32/index.html" class="game-frame" title="emduke32 runtime" sandbox="allow-scripts allow-same-origin allow-pointer-lock"></iframe>
            </div>
        `,
        onOpen: (windowEl) => {
            const iframe = windowEl.querySelector("iframe");
            if (iframe && !iframe.src) {
                iframe.src = iframe.dataset.src;
            }
        },
        onClose: (windowEl) => {
            const iframe = windowEl.querySelector("iframe");
            if (iframe) {
                iframe.src = "";
            }
        }
    };
})();
```

---

## 4. Adaptive Window Sizing Guidelines (`app.css`)

To support responsive layouts, dynamic viewport resizing, and adaptive wallpapers, **avoid static pixel widths/heights** (e.g. `width: 800px; height: 600px;`) on window containers. Instead, follow these adaptive rules:

1. **Flex Column Structure**: Always declare `display: flex; flex-direction: column;` on the window container. This allows the window bar to maintain its static height while the main content stretches to fill the remaining area.
2. **Flexible Container Constraints**: Style the window container using `min` and `calc` relative to the viewport:
   - Width: `min(54rem, calc(100% - 2rem))` (locks at `54rem` / `864px` on desktop, but shrinks to fit smaller screens with a `2rem` side margin).
   - Height: `min(38rem, calc(100% - 6rem))` (locks at `38rem` / `608px` on desktop, leaving room for taskbars and borders, while shrinking on short viewports).
3. **Internal Stretching**:
   - Set `.game-shell` to `flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden;`.
   - Set the `<iframe>` or `<canvas>` (`.game-frame`) to `flex: 1 1 auto; width: 100%; height: 100%;`.

### Example Adaptive Stylesheet

```css
.desktop-window.quake-window {
    display: flex;
    flex-direction: column;
    width: min(54rem, calc(100% - 2rem));
    height: min(38rem, calc(100% - 6rem));
    left: clamp(8rem, 14vw, 12rem);
    top: 5.6rem;
    background: #000;
}
.quake-window .game-shell {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: #000;
    overflow: hidden;
}
.quake-window .game-frame {
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    border: none;
    display: block;
}
```

---

## 5. Unloading & Process Termination Lifecycle

When a user clicks the close action (`xmark`) on a modular window:
1. `closeDesktopWindow()` triggers the app's `onClose` callback in the registry.
2. The window element `<section>` is removed from the DOM, destroying its embedded iframes or canvas nodes.
3. The loader script tag `#app-script-<name>` is deleted from `document.head`.
4. The registry entry `delete window.appRegistry[name]` is cleared.
5. In custom JS wrappers (like Doom), any global properties (`window.Module`, `window.SDL2`), event listeners, and Web Audio contexts are closed and deleted.

This ensures all memory is reclaimed, processes are halted, and the application opens 100% fresh on the next execution.

---

## 6. On-Demand Asset Installation Pattern (Large Apps)

For applications with substantial download requirements (e.g. Diablo's 500MB asset pack, LibreOffice's 100MB WASM package, or RCT2's data files), assets **must not** be loaded during primary system boot or installation.

### Design Standard
1. **Metadata Installation**: When a user clicks "Install" in the Store, PortfoliOS registers the application as installed in `localStorage` but does not download any large assets.
2. **First-Launch Bootstrapping**:
   - When the user first launches the app, the `onOpen` hook renders a download/extraction progress screen inside the window shell.
   - The app fetches the large assets (e.g., `.WAD`, `.MPQ`, or `.wasm` binaries) via a chunked `fetch` request, displaying an accurate progress bar.
3. **Local Storage Caching (IndexedDB)**:
   - Once fetched, store the binary files in the shared `IndexedDB` instance.
   - On subsequent launches, the app checks `IndexedDB` first. If present, it loads the assets locally in milliseconds without hitting the network.
   - This keeps the core PortfoliOS initial load size tiny (under 2MB) while allowing 100MB+ applications to function seamlessly.
