(function() {
    window.appRegistry.duke32 = window.createIframeGameApp({
        id: "duke32",
        title: "duke3d.exe",
        icon: "fa-solid fa-radiation",
        windowClass: "duke32-window game-window",
        iframeSrc: "duke32/index.html?v=1.0.25",
        saveDelay: 600,
        controlsHtml: `
            <li><kbd>Click</kbd><span>focus game input</span></li>
            <li><kbd>W</kbd><kbd>S</kbd><span>move</span><kbd>A</kbd><kbd>D</kbd><span>strafe</span></li>
            <li><kbd>Mouse</kbd><span>look while locked</span></li>
            <li><kbd>Arrows</kbd><span>turn and look</span></li>
            <li><kbd>Q</kbd><span>fire</span><kbd>E</kbd><span>open/use</span></li>
            <li><kbd>Ctrl</kbd><span>backup fire</span><kbd>Shift</kbd><span>run</span></li>
            <li><kbd>Enter</kbd><span>select</span><kbd>Esc</kbd><span>menu</span></li>
        `
    });
})();
