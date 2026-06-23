# PortfoliOS Extension App Development Guide

PortfoliOS supports dynamic loading and unloading of extension applications (like games, utilities, and music players) using a registry IIFE pattern.

---

## 1. Directory Structure

Place your extension in a dedicated directory:
```
apps/
└── <new-app-id>/
    ├── app.js      # Main code registration
    └── app.css     # Optional style rules
```

---

## 2. App Lifecycle Contract

Your `app.js` file should wrap itself in an IIFE and define its methods on `window.appRegistry.<new-app-id>`:

```javascript
(function() {
    window.appRegistry.myapp = {
        title: "My Application",
        icon: "fa-solid fa-gear", // FontAwesome class or image URL
        windowClass: "myapp-window", // Custom window style class
        
        // Returns the inner HTML markup of the window
        renderBody: () => {
            return `<div class="myapp-content">Hello, world!</div>`;
        },
        
        // Callback triggered when window is open and appended to DOM
        onOpen: (windowEl) => {
            console.log("App opened", windowEl);
        },
        
        // Callback triggered when window is closed, before teardown (supports async Promise)
        onClose: (windowEl) => {
            console.log("App closed");
        },
        
        // Optional callbacks
        onMinimize: (windowEl) => {},
        onMaximize: (windowEl) => {}
    };
})();
```

---

## 3. Integrating Game Runtimes (Iframe Factory)

If your app runs inside an iframe (like Diablo or Quake), you can use the shared iframe game factory function to reduce boilerplate code:

```javascript
(function() {
    window.appRegistry.mygame = window.createIframeGameApp({
        id: "mygame",
        title: "mygame.exe",
        icon: "fa-solid fa-gamepad",
        windowClass: "mygame-window game-window",
        iframeSrc: "mygame/index.html",
        saveDelay: 600, // Ms to wait before clearing iframe src on close
        controlsHtml: `
            <li><kbd>WASD</kbd><span>move</span></li>
            <li><kbd>Space</kbd><span>jump</span></li>
        `
    });
})();
```

Make sure your app's CSS imports the shared styling:
```css
@import "../_shared/iframe-game.css";

.desktop-window.mygame-window {
    width: 600px;
    height: 400px;
    left: 100px;
    top: 100px;
}
```

---

## 4. Inter-Module Communication

- **Events**: Subscribe to EventBus events to listen to system triggers:
  ```javascript
  const unsub = window.EventBus.on("fs:changed", (event) => {
      // respond to file updates
  });
  ```
- **State**: Read properties from the reactive global `window.state` object.
- **Files**: Use `window.SystemFS` to read or write persistent virtual files.
