/**
 * PortfoliOS: Matrix Wallpaper Rain
 * Renders the falling-code canvas used by the Matrix desktop wallpaper.
 */

(() => {
    const glyphs = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%&*+-/<>{}[]";
    const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;

    let canvas = null;
    let ctx = null;
    let surface = null;
    let resizeObserver = null;
    let frameId = null;
    let columns = [];
    let width = 0;
    let height = 0;
    let fontSize = 16;
    let initialized = false;
    let matrixSelected = false;
    let lastFrame = 0;

    const rand = (min, max) => min + Math.random() * (max - min);
    const glyph = () => glyphs[Math.floor(Math.random() * glyphs.length)];
    const reducedMotion = () => Boolean(reducedMotionQuery?.matches);

    function makeDrop() {
        return {
            y: rand(-24, 2),
            speed: rand(0.55, 1.45),
            glow: rand(0.65, 1)
        };
    }

    function paintBase() {
        if (!ctx || !width || !height) return;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#020804";
        ctx.fillRect(0, 0, width, height);
    }

    function resize() {
        if (!canvas || !ctx || !surface) return;

        width = Math.max(1, surface.clientWidth || Math.floor(surface.getBoundingClientRect().width));
        height = Math.max(1, surface.clientHeight || Math.floor(surface.getBoundingClientRect().height));

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        fontSize = Math.max(13, Math.min(18, Math.floor(width / 78)));
        const columnCount = Math.ceil(width / fontSize) + 1;
        columns = Array.from({ length: columnCount }, (_, index) => columns[index] || makeDrop());

        if (matrixSelected) paintBase();
    }

    function paintStaticRain() {
        if (!ctx || !width || !height) return;

        paintBase();
        ctx.font = `700 ${fontSize}px "JetBrains Mono", Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowBlur = 0;

        const rows = Math.ceil(height / fontSize) + 2;
        columns.forEach((_, index) => {
            const x = index * fontSize + fontSize / 2;
            for (let row = 0; row < rows; row += 1) {
                if (Math.random() < 0.36) continue;
                const alpha = Math.max(0.1, 0.72 - row / rows);
                ctx.fillStyle = `rgba(56, 255, 126, ${alpha})`;
                ctx.fillText(glyph(), x, row * fontSize);
            }
        });
    }

    function step(timestamp) {
        frameId = window.requestAnimationFrame(step);
        if (timestamp - lastFrame < 34) return;
        lastFrame = timestamp;

        if (!matrixSelected || reducedMotion() || document.hidden) return;
        if (!width || !height) resize();

        ctx.fillStyle = "rgba(1, 8, 4, 0.16)";
        ctx.fillRect(0, 0, width, height);
        ctx.font = `700 ${fontSize}px "JetBrains Mono", Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        columns.forEach((drop, index) => {
            const x = index * fontSize + fontSize / 2;
            const y = drop.y * fontSize;
            const isLead = Math.random() > 0.9;

            ctx.shadowColor = "rgba(72, 255, 134, 0.58)";
            ctx.shadowBlur = isLead ? 10 : 4;
            ctx.fillStyle = isLead
                ? "rgba(232, 255, 238, 0.94)"
                : `rgba(55, 255, 123, ${drop.glow})`;
            ctx.fillText(glyph(), x, y);

            if (Math.random() > 0.66) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = "rgba(22, 144, 72, 0.38)";
                ctx.fillText(glyph(), x, y - fontSize);
            }

            if (y > height + fontSize * rand(2, 12) && Math.random() > 0.965) {
                columns[index] = makeDrop();
            } else {
                drop.y += drop.speed;
            }
        });

        ctx.shadowBlur = 0;
    }

    function stop(clear = false) {
        if (frameId) {
            window.cancelAnimationFrame(frameId);
            frameId = null;
        }
        lastFrame = 0;
        if (clear) {
            paintBase();
            ctx?.clearRect(0, 0, width, height);
        }
    }

    function start() {
        if (frameId || reducedMotion() || document.hidden) return;
        resize();
        frameId = window.requestAnimationFrame(step);
    }

    function ensureMatrixRain() {
        if (initialized) return Boolean(canvas && ctx && surface);

        canvas = document.getElementById("matrix-rain-canvas");
        if (!canvas) return false;

        ctx = canvas.getContext("2d");
        surface = canvas.closest(".desktop-wallpaper");
        if (!ctx || !surface) return false;

        initialized = true;
        canvas.hidden = true;

        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                resize();
                if (matrixSelected && reducedMotion()) paintStaticRain();
            });
            resizeObserver.observe(surface);
        }

        window.addEventListener("resize", () => {
            resize();
            if (matrixSelected && reducedMotion()) paintStaticRain();
        });
        document.addEventListener("visibilitychange", () => {
            window.updateMatrixRain();
        });

        reducedMotionQuery?.addEventListener?.("change", () => {
            window.updateMatrixRain();
        });

        return true;
    }

    window.updateMatrixRain = (wallpaperId = window.state?.wallpaper) => {
        if (!ensureMatrixRain()) return;

        matrixSelected = wallpaperId === "matrix";
        canvas.hidden = !matrixSelected;

        if (!matrixSelected) {
            stop(true);
            return;
        }

        resize();

        if (reducedMotion()) {
            stop();
            paintStaticRain();
            return;
        }

        start();
    };

    window.initMatrixRain = () => {
        if (ensureMatrixRain()) window.updateMatrixRain();
    };

    window.initMatrixRain();
})();
