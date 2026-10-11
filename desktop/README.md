# PortfoliOS Desktop Shell

This directory contains the views, taskbars, windows, and right-click configurations that render the Windows-style simulated operating system.

---

## Component Layout

1. **[shell.js](shell.js)**
   - Bootstraps the desktop by calling all module initializers (`initWindowManagement`, `renderDesktopIcons`, etc.).
   - Orchestrates global event capture (double-click icons, click window actions, dismiss dropdowns).

2. **[taskbar.js](taskbar.js)**
   - Renders task pins matching `state.openApps`.
   - Manages desktop window active and hidden visual state classes.
   - Listens to EventBus for updates.

3. **[desktop-icons.js](desktop-icons.js)**
   - Positions shortcut cards on a snapping visual grid.
   - Handles icon drags and snap-to-nearest grid cell, persisting coordinates to localStorage.

4. **[context-menu.js](context-menu.js)**
   - Listens for right-clicks (`contextmenu`) on the desktop workspace.
   - Generates contextual options (Copy, Paste, Reset positions, open Settings) depending on the click target.

5. **[terminal.js](terminal.js)**
   - Powers the CLI terminal application.
   - Parses keyboard entries and routes queries to `simulateAiResponse()` for natural chat streaming.

6. **[store.js](store.js)**
   - Renders available apps and categories in the Store window.
   - Orchestrates dynamic installs with progress animations.

7. **[calendar.js](calendar.js)**
   - Updates clock readouts and outputs a calendar layout.

## Desktop folders and square icon grid

Desktop content lives under `/Desktop` in the active profile's SystemFS. The New folder tile and desktop context menu create real directories; opening one uses File Explorer's existing path and file associations. File Explorer also has a Desktop sidebar entry. Delete, upload and nested-folder operations use its existing controls.

Default launchers are real `.portfolios-link.json` files in `/Desktop`. Dragging an app icon onto a folder moves its shortcut into that folder. Start-menu launchers remain available. The layout records which defaults have been seeded, so deleting or moving a shortcut does not recreate it on reload. Shortcut JSON contains only a known app identifier and optional known portfolio system identifier; no executable code or paths to another profile are accepted. Its file content can restore the association without IndexedDB metadata. Private desktop contents participate in existing eligible Drive backup; public desktop contents reset with the public workspace.

Icon cells use equal horizontal and vertical 7.2rem snapping intervals, with square 6.6rem selection areas. The icon surface scrolls when full instead of placing overflow columns outside the display. Desktop on a phone uses this same grid while apps remain above the taskbar.

Icon positions are saved as grid coordinates in `/Desktop/desktop-layout.json`. Existing private browser-stored positions migrate after the layout file is durably written. The layout file is reserved from desktop icon display and participates in the existing Drive backup alongside folders and shortcuts. Open windows are not restored as a complete session. Run `node scripts/check-desktop-folders-browser.js` for real folder creation, dragging, shortcut activation/restoration, private isolation/reload, public reset, overflow and square-grid checks.

On a first Drive sync, generated desktop defaults defer to an existing saved cloud desktop; moved/deleted cloud shortcuts are not recreated from those local defaults. Deliberate local desktop edits and user files retain normal merge behaviour. This is covered by the mocked Drive merge regression; the browser checks use disposable local accounts, not Google credentials.

Installed Desktop Store apps are included in default shortcut seeding without a separate pin-list edit. An explicit installation restores a missing shortcut immediately, but retains existing shortcuts moved into `/Desktop` subfolders. Ordinary reload/refresh does not recreate intentionally deleted or moved shortcuts. Uninstalled app shortcuts remain stored but hidden until the app is installed again. Native Mobile-only apps do not create nonfunctional Desktop launchers.
