(function() {
    let controller = null;

    async function start(root) {
        const launch = () => {
            controller = window.startFlappyBird?.("mobile-flappy-canvas") || null;
        };
        if (typeof window.startFlappyBird !== "function") {
            await window.loadScript("flappy.js?v=1.1.12");
        }
        if (root?.isConnected) launch();
    }

    window.mobileAppRegistry.flappybird = {
        title: "Flappy Bird",
        icon: "fa-solid fa-dove",
        viewClass: "mobile-flappybird-app",
        edgeToEdge: true,
        render: () => `
            <div class="mobile-flappy-stage">
                <canvas id="mobile-flappy-canvas" tabindex="0" role="img"
                    aria-label="Flappy Bird game" aria-describedby="mobile-flappy-instructions mobile-flappy-status"
                    data-flappy-status="mobile-flappy-status"></canvas>
                <p class="mobile-flappy-instructions" id="mobile-flappy-instructions">Tap the game or press Space or Enter to flap.</p>
                <p class="mobile-flappy-status" id="mobile-flappy-status" aria-live="polite">Ready. Press Space, Enter, or tap to start.</p>
            </div>
        `,
        onOpen: start,
        onPause: () => controller?.pause?.(),
        onResume: () => controller?.resume?.(),
        onClose: () => {
            controller?.destroy?.();
            controller = null;
        }
    };
})();
