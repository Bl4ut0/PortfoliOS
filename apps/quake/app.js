(function() {
    window.appRegistry.quake = window.createIframeGameApp({
        id: "quake",
        title: "quake.exe",
        icon: "fa-solid fa-bolt",
        windowClass: "quake-window game-window",
        iframeSrc: "quake/index.html?v=1.0.22",
        saveDelay: 600,
        controlsHtml: `
            <li><kbd>WASD</kbd><span>move</span><kbd>Mouse</kbd><span>look</span></li>
            <li><kbd>Click</kbd><span>fire</span><kbd>Space</kbd><span>jump</span></li>
            <li><kbd>1-8</kbd><span>weapons</span><kbd>Esc</kbd><span>menu</span></li>
        `
    });
})();
