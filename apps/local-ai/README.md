# Local AI Modular App

This folder contains the maintained, lazy-loaded Local AI control window. It uses the shared service in `core/local-ai.js` and mirrors status with Settings and the taskbar tray.

The `local-ai` catalog entry is declared modular in `data/apps.js`, registers through `window.appRegistry`, and owns its lifecycle subscriptions in `apps/local-ai/app.js`.

New modular apps should still start from `apps/_template/` or `apps/_template-game/` and declare `modular: true` in `data/apps.js`.
