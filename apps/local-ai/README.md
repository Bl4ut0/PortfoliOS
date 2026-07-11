# Local AI Compatibility Module

This folder contains the retired standalone Local AI window implementation for reference. PortfoliOS does not lazy-load it.

The `local-ai` catalog launcher is intentionally non-modular and redirects to **Settings > Local AI** in `core/window-manager.js`. The maintained service is `core/local-ai.js`, with controls in `desktop/settings.js` and the taskbar tray.

Do not use this folder as an app template. New modular apps must start from `apps/_template/` or `apps/_template-game/` and declare `modular: true` in `data/apps.js`.
