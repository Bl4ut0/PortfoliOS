# PortfoliOS Styling System

This directory houses the segmented CSS style sheets for PortfoliOS. The styles are split into modular files to keep them maintainable, and are imported into the main system via [styles-v1.css](file:///c:/Dev Projects/bl4ut0-portfolio-os/styles-v1.css).

---

## 1. Directory Structure & Files

1. **[tokens.css](file:///c:/Dev Projects/bl4ut0-portfolio-os/styles/tokens.css)**
   - **Role**: Contains CSS variables (`:root`) defining the core design system: color palette, fonts, spacing, shadows, border radii, and transitions.

2. **[reset.css](file:///c:/Dev Projects/bl4ut0-portfolio-os/styles/reset.css)**
   - **Role**: Simple CSS reset ensuring unified cross-browser element baseline rendering.

3. **[layout.css](file:///c:/Dev Projects/bl4ut0-portfolio-os/styles/layout.css)**
   - **Role**: Defines global structural grids, flex alignments, and main container dimensions (such as the header topbar, top-dock panels, and responsive workspace boundaries).

4. **[windows.css](file:///c:/Dev Projects/bl4ut0-portfolio-os/styles/windows.css)**
   - **Role**: Controls the window styling: title bars, controls, drag and resize utilities, taskbars, and specific coordinates for stationary desktop panels (like the `profile` or `dossier` systems).

5. **[desktop.css](file:///c:/Dev Projects/bl4ut0-portfolio-os/styles/desktop.css)**
   - **Role**: Desktop-specific components, such as icons, snapping grid layouts, custom right-click context menus, calendar trays, and start menus.

6. **[mobile.css](file:///c:/Dev Projects/bl4ut0-portfolio-os/styles/mobile.css)**
   - **Role**: Stylesheet for the touch-friendly mobile phone simulator (device frame, status bar, app icon grids, navigation, and mobile home layouts).

7. **[quick.css](file:///c:/Dev Projects/bl4ut0-portfolio-os/styles/quick.css)**
   - **Role**: Styles the side-by-side split screen indexing panel used in the Quick Access review mode.

8. **[boot.css](file:///c:/Dev Projects/bl4ut0-portfolio-os/styles/boot.css)**
   - **Role**: Manages the loading screen animations, post console log outputs, and session action buttons.

9. **[components.css](file:///c:/Dev Projects/bl4ut0-portfolio-os/styles/components.css)**
   - **Role**: Large registry of individual project cards, badges, timeline items, interactive settings sliders, terminal lines, and app store listings.

---

## 2. Design Aesthetics

We utilize modern, premium web styling practices:
- **Glassmorphism**: Translucent panels using `backdrop-filter: blur(...)` combined with thin, semi-transparent borders.
- **Dynamic CSS Variables**: Root variables are modified on the fly by Javascript (e.g. `--theme-primary`, `--theme-accent`, `--desktop-volume`) to support real-time user customization.
