# PortfoliOS Mobile OS

Mobile is an independent browser-native operating experience. It shares neutral data and services with PortfoliOS Desktop, but it does not reuse the desktop app catalog, desktop windows, or desktop application interfaces.

## Framework

- `app-framework.js` validates mobile registrations and runs open/resume/pause/back/intent/state/close lifecycle hooks.
- `app-loader.js` lazily loads `mobile/apps/<id>/app.js` and `app.css`.
- `shell.js` owns retained tasks, Home, Back, Recents, task dismissal, notification shade, quick settings, gestures, lock/fullscreen/install actions, and mobile preferences.
- `data/mobile-apps.js` is the explicit mobile-only application catalog.

Home and experience changes pause an application without destroying it. Recents resumes the existing DOM and app state; dismissing a recent task runs `onClose` and unloads its module. Up to ten tasks are retained, with least-recently-used suspended tasks eligible for cleanup.

## Mobile applications

The current catalog combines phone utilities with mobile representations of portfolio systems:

- Browser, Files, Documents/PDF, Music, Gallery, Calculator, and Settings
- Dev Hub, Status, Home Lab, Automation, Addons, GuildCraft, Survival AI, and WardenIT
- Flappy Bird as a touch-native game

Files, Documents, Gallery, and Music use the shared IndexedDB-backed `SystemFS`. `core/file-intents.js` routes supported files between mobile apps. `core/media-service.js` owns persistent audio and Media Session controls outside any app task so music can continue while another app is foregrounded.

## Phone and PWA behavior

At 700px and below, Mobile fills `100dvh`, removes the simulated bezel and global top bar, and applies safe-area insets. Larger screens retain a framed phone preview. `manifest.webmanifest` provides a standalone Mobile start route, and the service worker precaches the mobile shell and first-party mobile app modules for offline startup.

Swipe down from the top edge for the shade, swipe up from the bottom for Home, swipe up and hold for Recents, or use the accessible Android-style navigation buttons. Gesture navigation can be selected in Mobile Settings.
