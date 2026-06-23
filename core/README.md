# PortfoliOS Core Systems

This directory houses the foundational services that drive PortfoliOS. These services are loaded before any interface-specific script.

---

## Files and Responsibilities

1. **[event-bus.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/core/event-bus.js)**
   - **Role**: Decentralized pub/sub message router.
   - **API**:
     - `EventBus.on(event, cb)`: Subscribes to an event. Returns an unsubscribe function.
     - `EventBus.off(event, cb)`: Unsubscribes from an event.
     - `EventBus.emit(event, data)`: Emits an event to all subscribers.
   - **Key Events**:
     - `app:opened` / `app:closed` (with appId)
     - `app:installed` / `app:uninstalled` (with appId)
     - `fs:changed` (with path details)
     - `state:changed:${key}` (with newValue, oldValue)

2. **[state.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/core/state.js)**
   - **Role**: Centralized system state.
   - **Design**: Implemented as a Proxy over a raw state object. Setting a property automatically notifies listeners via `EventBus.emit('state:changed', ...)`.
   - **Initial values**: Restored from `Storage` on boot.

3. **[storage.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/core/storage.js)**
   - **Role**: Unified interface for local and session storages.
   - **API**:
     - `Storage.local.get(key)` / `Storage.local.set(key, val)` (falls back to session storage on permission rejection)
     - `Storage.session.get(key)` / `Storage.session.set(key, val)`

4. **[filesystem.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/core/filesystem.js)**
   - **Role**: Virtual filesystem (`SystemFS`) backed by IndexedDB.
   - **Features**: Database upgrades to v2 to create an index on `parent` path, optimizing directory scanning. Emits `fs:changed` events on write/delete.

5. **[app-loader.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/core/app-loader.js)**
   - **Role**: Lazy-loader for modular applications. Injects scripts and links dynamically, resolving load promises.

6. **[app-framework.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/core/app-framework.js)**
   - **Role**: Shared modular app contract helpers.
   - **Features**: App registration validation, safe iframe `postMessage` targeting, lifecycle hook execution, modular teardown, and audio adapter registration.

7. **[preferences.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/core/preferences.js)**
   - **Role**: Applies user selections (volume percentages, color pickers, wallpaper choices, scaling adjustments). Handles volume updates for nested iframe runtimes.

8. **[utils.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/core/utils.js)**
   - **Role**: Common helper functions (`byId`, `getDesktopScale`, `formatBytes`, and icon template builder).
