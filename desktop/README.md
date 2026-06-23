# PortfoliOS Desktop Shell

This directory contains the views, taskbars, windows, and right-click configurations that render the Windows-style simulated operating system.

---

## Component Layout

1. **[shell.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/desktop/shell.js)**
   - Bootstraps the desktop by calling all module initializers (`initWindowManagement`, `renderDesktopIcons`, etc.).
   - Orchestrates global event capture (double-click icons, click window actions, dismiss dropdowns).

2. **[taskbar.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/desktop/taskbar.js)**
   - Renders task pins matching `state.openApps`.
   - Manages desktop window active and hidden visual state classes.
   - Listens to EventBus for updates.

3. **[desktop-icons.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/desktop/desktop-icons.js)**
   - Positions shortcut cards on a snapping visual grid.
   - Handles icon drags and snap-to-nearest grid cell, persisting coordinates to localStorage.

4. **[context-menu.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/desktop/context-menu.js)**
   - Listens for right-clicks (`contextmenu`) on the desktop workspace.
   - Generates contextual options (Copy, Paste, Reset positions, open Settings) depending on the click target.

5. **[terminal.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/desktop/terminal.js)**
   - Powers the CLI terminal application.
   - Parses keyboard entries and routes queries to `simulateAiResponse()` for natural chat streaming.

6. **[store.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/desktop/store.js)**
   - Renders available apps and categories in the Store window.
   - Orchestrates dynamic installs with progress animations.

7. **[calendar.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/desktop/calendar.js)**
   - Updates clock readouts and outputs a calendar layout.
