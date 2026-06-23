(function() {
    window.appRegistry.diablo = window.createIframeGameApp({
        id: "diablo",
        title: "diablo.exe",
        icon: "fa-solid fa-skull",
        windowClass: "diablo-window game-window",
        iframeSrc: "diablo/index.html?v=1.0.24",
        saveDelay: 800,
        controlsHtml: `
            <li><kbd>Mouse</kbd><span>move, interact, attack</span></li>
            <li><kbd>Right</kbd><span>cast selected spell</span></li>
            <li><kbd>I</kbd><span>inventory</span><kbd>C</kbd><span>character</span></li>
            <li><kbd>1-8</kbd><span>belt items</span><kbd>Tab</kbd><span>map</span></li>
        `
    });
})();
