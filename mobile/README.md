# PortfoliOS Mobile OS

Mobile is an independent browser-native operating experience. It shares neutral data and services with PortfoliOS Desktop, but it does not reuse the desktop app catalog, desktop windows, or desktop application interfaces.

## Framework

- `app-framework.js` validates mobile registrations and runs open/resume/pause/back/intent/state/close lifecycle hooks.
- `app-loader.js` lazily loads `mobile/apps/<id>/app.js` and `app.css`.
- `viewport.js` classifies a physical mobile/PWA versus desktop preview before first paint and maintains adaptive viewport metrics across resize, rotation, split-screen, and fold/unfold changes.
- `home.js` owns the launcher pages, feed, app drawer, folders, widgets, Home customization, and per-user layout persistence.
- `shell.js` owns retained tasks, Home, Back, Recents, task dismissal, notification shade, quick settings, gesture arbitration, lock/fullscreen/install actions, and mobile preferences.
- `data/mobile-apps.js` is the explicit mobile-only application catalog.
- `data/mobile-home.js` is the DOM-free launcher configuration and search/layout helper layer.

Home and experience changes pause an application without destroying it. Recents resumes the existing DOM and app state; dismissing a recent task runs `onClose` and unloads its module. Up to ten tasks are retained, with least-recently-used suspended tasks eligible for cleanup.

## Mobile applications

The current catalog combines phone utilities with mobile representations of portfolio systems:

- Browser, Files, Documents/PDF, Music, Gallery, Calculator, and Settings
- Dev Hub, Status, Home Lab, Automation, Addons, GuildCraft, Survival AI, and WardenIT
- Flappy Bird as a touch-native game

Files, Documents, Gallery, and Music use the shared IndexedDB-backed `SystemFS`. The shared startup creates `/Downloads` and `/Pictures` alongside the existing document, music, ROM, and saved-game roots; Files exposes the user-facing storage locations directly. `core/file-intents.js` routes supported files between mobile apps. `core/media-service.js` owns persistent audio and Media Session controls outside any app task so music can continue while another app is foregrounded.

## Launcher and gestures

Home has independent Daily and Portfolio pages plus a PortfoliOS News & Signals feed to the left. Swipe left for the next Home page, swipe right from Daily for the feed, and swipe up for the searchable, categorized app drawer. The four-app dock remains stable across Home pages. Folders and widgets are profile-aware, so hidden apps are pruned automatically.

Press and hold a Home item for 500 ms to open its actions. Pointer movement cancels the hold, and context menu, Shift+F10, and the visible Customize Home control provide keyboard and browser alternatives. Launcher layouts are versioned and stored per user without overwriting shell appearance or navigation preferences.

Mobile apps share semantic surface, foreground, outline, accent-ink, and status-color tokens. Dark and light themes therefore keep the same hierarchy while allowing each app to retain its own decorative accent. Foreground apps, the shade, and launcher sheets use an opaque black system status bar with white icons so wallpaper or app content cannot bleed through it.

## Phone and PWA behavior

Physical touch devices and installed PWAs fill the live viewport, remove the simulated bezel and global top bar, and apply safe-area insets. Normal desktop browsers retain a framed phone preview independently of window width. Android's virtual desktop viewport is compensated back to the device's natural width so text, controls, and gestures remain phone-sized even when the browser reports roughly 980 CSS pixels. The runtime responds to compact phones, tall screens, landscape, split-screen, tablets, and foldable viewport changes without discarding the active task.

For deterministic testing, `mobilePresentation=edge` forces the device presentation and `mobilePresentation=preview` forces the framed desktop preview. `manifest.webmanifest` provides a standalone Mobile start route, and the service worker precaches the mobile shell, viewport runtime, and first-party mobile app modules for offline startup.

Swipe down from the top edge for the shade, swipe up from the bottom for Home, swipe up and hold for Recents, or use the accessible Android-style navigation buttons. Gesture navigation can be selected in Mobile Settings. The shell resolves system, launcher, and in-app gestures in one controller so Home paging never replaces app-level Back behavior.
