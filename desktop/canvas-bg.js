/**
 * PortfoliOS: Background Network Canvas Animation
 * Renders an interactive floating particle network on a full-screen canvas behind the desktop.
 */

window.startCanvas = () => {
    const canvas = window.byId ? window.byId("network-canvas") : document.getElementById("network-canvas");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const pointer = { x: 0, y: 0, active: false };
    const palette = ["#22d3ee", "#34d399", "#f59e0b", "#a78bfa", "#fb7185"];
    let nodes = [];

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const count = Math.max(28, Math.min(66, Math.floor(window.innerWidth / 24)));
        nodes = Array.from({ length: count }, (_, index) => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.22,
            vy: (Math.random() - 0.5) * 0.22,
            color: palette[index % palette.length]
        }));
    }

    function draw() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        nodes.forEach((node, index) => {
            node.x += node.vx;
            node.y += node.vy;

            if (node.x < 0 || node.x > window.innerWidth) node.vx *= -1;
            if (node.y < 0 || node.y > window.innerHeight) node.vy *= -1;

            for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
                const other = nodes[otherIndex];
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 150) {
                    ctx.strokeStyle = `rgba(148, 163, 184, ${0.09 * (1 - distance / 150)})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(node.x, node.y);
                    ctx.lineTo(other.x, other.y);
                    ctx.stroke();
                }
            }

            if (pointer.active) {
                const dx = node.x - pointer.x;
                const dy = node.y - pointer.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 190) {
                    ctx.strokeStyle = `rgba(34, 211, 238, ${0.18 * (1 - distance / 190)})`;
                    ctx.beginPath();
                    ctx.moveTo(node.x, node.y);
                    ctx.lineTo(pointer.x, pointer.y);
                    ctx.stroke();
                }
            }

            ctx.fillStyle = node.color;
            ctx.globalAlpha = 0.28;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        });

        requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
    });
    window.addEventListener("pointerleave", () => {
        pointer.active = false;
    });

    resize();
    draw();
};
