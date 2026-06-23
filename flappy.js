window.startFlappyBird = function(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d", { alpha: false });
    
    const parent = canvas.parentElement;
    let dpr = window.devicePixelRatio || 1;
    let logicalWidth, logicalHeight;
    let groundHeight = 112;
    
    function resize() {
        dpr = window.devicePixelRatio || 1;
        logicalWidth = parent.clientWidth;
        logicalHeight = parent.clientHeight;
        canvas.width = logicalWidth * dpr;
        canvas.height = logicalHeight * dpr;
        ctx.scale(dpr, dpr);
        // Turn off image smoothing for pixel art look
        ctx.imageSmoothingEnabled = false;
    }
    
    window.addEventListener("resize", resize);
    resize();

    // -- ASSET GENERATOR (Pixel Art) --
    // We generate sprites to avoid external image dependencies
    function createBirdSprite(wingState) {
        // wingState: 0=up, 1=mid, 2=down
        const s = 3; // internal scale
        const c = document.createElement("canvas");
        c.width = 17 * s; c.height = 12 * s;
        const x = c.getContext("2d");
        
        const colors = {
            '0': 'transparent',
            '1': '#543847', // black/outline
            '2': '#f4d84c', // yellow
            '3': '#eab528', // dark yellow
            '4': '#ffffff', // white
            '5': '#f46c24', // orange
            '6': '#e44c18', // dark orange
            '7': '#ffffff'  // wing highlight
        };

        const base = [
            "00000111111000000",
            "00011222221100000",
            "00122222222111000",
            "01222222222144100",
            "01222111122141410",
            "01221444412144410",
            "01331444413111111",
            "00133111133155551",
            "00013333333111110",
            "00001133333316661",
            "00000011111111110",
            "00000000000000000"
        ];
        
        // modify wing based on state
        const pixels = base.map(row => row.split(''));
        if (wingState === 0) { // Wing up
            pixels[4].splice(5, 4, '1','1','1','1');
            pixels[5].splice(4, 6, '1','4','4','4','4','1');
            pixels[6].splice(4, 6, '1','4','4','4','4','1');
            pixels[7].splice(5, 4, '1','1','1','1');
        } else if (wingState === 1) { // Wing mid
            pixels[5].splice(5, 4, '1','1','1','1');
            pixels[6].splice(4, 6, '1','4','4','4','4','1');
            pixels[7].splice(4, 6, '1','4','4','4','4','1');
            pixels[8].splice(5, 4, '1','1','1','1');
        } else { // Wing down
            pixels[6].splice(5, 4, '1','1','1','1');
            pixels[7].splice(4, 6, '1','4','4','4','4','1');
            pixels[8].splice(4, 6, '1','4','4','4','4','1');
            pixels[9].splice(5, 4, '1','1','1','1');
        }

        for (let row = 0; row < 12; row++) {
            for (let col = 0; col < 17; col++) {
                const color = colors[pixels[row][col]];
                if (color !== 'transparent') {
                    x.fillStyle = color;
                    x.fillRect(col * s, row * s, s, s);
                }
            }
        }
        return c;
    }

    const birdFrames = [createBirdSprite(0), createBirdSprite(1), createBirdSprite(2), createBirdSprite(1)];

    // -- GAME CONSTANTS --
    const GRAVITY = 0.25;
    const JUMP = -4.5;
    const SPEED = 2.5;
    const PIPE_WIDTH = 52;
    const PIPE_GAP = 135;
    
    // -- STATE --
    let frames = 0;
    let score = 0;
    let bestScore = localStorage.getItem("flappy_best") || 0;
    let state = 0; // 0: Splash, 1: Playing, 2: Hit/Fall, 3: Game Over
    let animationReq;
    let flashOpacity = 0;

    const bg = {
        x: 0,
        draw() {
            // Sky
            ctx.fillStyle = "#70c5ce";
            ctx.fillRect(0, 0, logicalWidth, logicalHeight);
            
            // City Silhouette (simple representation)
            ctx.fillStyle = "#d0f4f7"; // clouds
            ctx.fillRect(0, logicalHeight - groundHeight - 60, logicalWidth, 60);
            ctx.fillStyle = "#73bf2e"; // bushes
            ctx.fillRect(0, logicalHeight - groundHeight - 30, logicalWidth, 30);
            ctx.fillStyle = "#558022"; // darker bushes
            ctx.fillRect(0, logicalHeight - groundHeight - 15, logicalWidth, 15);
        }
    };

    const ground = {
        x: 0,
        draw() {
            ctx.fillStyle = "#ded895";
            ctx.fillRect(0, logicalHeight - groundHeight, logicalWidth, groundHeight);
            
            // Draw striped pattern
            ctx.fillStyle = "#e8e6b1";
            for (let i = 0; i < logicalWidth + 40; i += 40) {
                ctx.beginPath();
                ctx.moveTo(i + this.x, logicalHeight - groundHeight + 10);
                ctx.lineTo(i + 20 + this.x, logicalHeight - groundHeight + 10);
                ctx.lineTo(i + 10 + this.x, logicalHeight);
                ctx.lineTo(i - 10 + this.x, logicalHeight);
                ctx.fill();
            }
            
            // Top grass border
            ctx.fillStyle = "#73bf2e";
            ctx.fillRect(0, logicalHeight - groundHeight, logicalWidth, 10);
            ctx.fillStyle = "#543847"; // top line
            ctx.fillRect(0, logicalHeight - groundHeight, logicalWidth, 3);
            ctx.fillRect(0, logicalHeight - groundHeight + 10, logicalWidth, 3); // bottom grass line
        },
        update() {
            if (state === 0 || state === 1) {
                this.x = (this.x - SPEED) % 40;
            }
        }
    };

    const bird = {
        x: logicalWidth / 2 - 30,
        y: logicalHeight / 2,
        w: 34,
        h: 24,
        velocity: 0,
        rotation: 0,
        frame: 0,
        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation * Math.PI / 180);
            
            // Draw sprite
            const sprite = birdFrames[this.frame];
            ctx.drawImage(sprite, -this.w/2, -this.h/2, this.w, this.h);
            
            ctx.restore();
        },
        update() {
            // Flap animation
            if (state === 0) {
                this.y = (logicalHeight / 2) + Math.cos(frames / 10) * 5; // bobbing
                if (frames % 10 === 0) this.frame = (this.frame + 1) % birdFrames.length;
                this.rotation = 0;
            } else if (state === 1) {
                if (frames % 5 === 0) this.frame = (this.frame + 1) % birdFrames.length;
                
                this.velocity += GRAVITY;
                this.y += this.velocity;
                
                // Rotation logic
                if (this.velocity < JUMP + 2) {
                    this.rotation = -25;
                } else if (this.rotation < 90) {
                    this.rotation += 4;
                }
                
                // Ground collision
                if (this.y + this.h/2 >= logicalHeight - groundHeight) {
                    this.y = logicalHeight - groundHeight - this.h/2;
                    hit();
                }
                // Ceiling collision
                if (this.y - this.h/2 <= 0) {
                    this.y = this.h/2;
                    this.velocity = 0;
                }
            } else if (state === 2 || state === 3) {
                // Falling to ground
                this.frame = 1; // freeze frame
                if (this.y + this.h/2 < logicalHeight - groundHeight) {
                    this.velocity += GRAVITY;
                    this.y += this.velocity;
                    if (this.rotation < 90) this.rotation += 8;
                } else {
                    this.y = logicalHeight - groundHeight - this.h/2;
                    if (state === 2) {
                        state = 3; // Reached ground, show game over
                    }
                }
            }
        },
        flap() {
            this.velocity = JUMP;
            this.rotation = -25;
        },
        reset() {
            this.y = logicalHeight / 2;
            this.velocity = 0;
            this.rotation = 0;
            this.frame = 0;
        }
    };

    const pipes = {
        items: [],
        draw() {
            for (let i = 0; i < this.items.length; i++) {
                let p = this.items[i];
                
                // Helper to draw a single pipe
                const drawPipe = (x, y, w, h, isTop) => {
                    ctx.fillStyle = "#73bf2e"; // base green
                    ctx.fillRect(x, y, w, h);
                    
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = "#543847"; // outline
                    ctx.strokeRect(x, y, w, h);
                    
                    ctx.fillStyle = "#9ce659"; // highlight
                    ctx.fillRect(x + 3, y + 3, 4, h - 6);
                    ctx.fillStyle = "#558022"; // shadow
                    ctx.fillRect(x + w - 7, y + 3, 4, h - 6);
                    
                    // Cap
                    const capY = isTop ? y + h - 24 : y;
                    ctx.fillStyle = "#73bf2e";
                    ctx.fillRect(x - 2, capY, w + 4, 24);
                    ctx.strokeRect(x - 2, capY, w + 4, 24);
                    ctx.fillStyle = "#9ce659"; // cap highlight
                    ctx.fillRect(x + 1, capY + 3, 4, 18);
                    ctx.fillStyle = "#558022"; // cap shadow
                    ctx.fillRect(x + w - 3, capY + 3, 4, 18);
                };

                // Top pipe
                drawPipe(p.x, 0, PIPE_WIDTH, p.y, true);
                // Bottom pipe
                const bottomY = p.y + PIPE_GAP;
                const bottomHeight = (logicalHeight - groundHeight) - bottomY;
                drawPipe(p.x, bottomY, PIPE_WIDTH, bottomHeight, false);
            }
        },
        update() {
            if (state !== 1) return;
            
            // Add new pipe
            if (frames % 90 === 0) { // spawn rate
                const minY = 50;
                const maxY = logicalHeight - groundHeight - PIPE_GAP - 50;
                const y = minY + (Math.random() * (maxY - minY));
                
                this.items.push({ x: logicalWidth, y: y, passed: false });
            }
            
            for (let i = 0; i < this.items.length; i++) {
                let p = this.items[i];
                p.x -= SPEED;
                
                // Collision (bird bounding box vs pipes)
                const cx = bird.x;
                const cy = bird.y;
                const r = bird.h/2 - 2; // slightly forgiving radius
                
                // Check X bounds
                if (cx + r > p.x && cx - r < p.x + PIPE_WIDTH) {
                    // Check Y bounds (top pipe or bottom pipe)
                    if (cy - r < p.y || cy + r > p.y + PIPE_GAP) {
                        hit();
                    }
                }
                
                // Score
                if (!p.passed && p.x + PIPE_WIDTH < bird.x) {
                    score++;
                    p.passed = true;
                }
                
                // Remove off-screen
                if (p.x + PIPE_WIDTH < 0) {
                    this.items.shift();
                    i--;
                }
            }
        },
        reset() {
            this.items = [];
        }
    };
    
    function hit() {
        if (state === 1) {
            state = 2; // Fall state
            flashOpacity = 1;
            if (score > bestScore) {
                bestScore = score;
                localStorage.setItem("flappy_best", bestScore);
            }
        }
    }

    function drawScore() {
        ctx.fillStyle = "white";
        ctx.strokeStyle = "#543847"; // thick dark outline
        ctx.lineWidth = 6;
        ctx.font = "900 48px sans-serif";
        ctx.textAlign = "center";
        
        ctx.strokeText(score, logicalWidth / 2, Math.max(80, logicalHeight * 0.15));
        ctx.fillText(score, logicalWidth / 2, Math.max(80, logicalHeight * 0.15));
        ctx.textAlign = "left";
    }
    
    function drawGameOver() {
        // Game Over Text
        ctx.fillStyle = "#e86100"; // orange text
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.font = "900 40px sans-serif";
        ctx.textAlign = "center";
        
        const textY = logicalHeight/2 - 80;
        ctx.strokeText("GAME OVER", logicalWidth / 2, textY);
        ctx.fillText("GAME OVER", logicalWidth / 2, textY);
        
        ctx.strokeStyle = "#543847";
        ctx.lineWidth = 2;
        ctx.strokeText("GAME OVER", logicalWidth / 2, textY);
        
        // Score Board
        const boardW = 200;
        const boardH = 100;
        const boardX = logicalWidth/2 - boardW/2;
        const boardY = logicalHeight/2 - 30;
        
        ctx.fillStyle = "#ded895";
        ctx.fillRect(boardX, boardY, boardW, boardH);
        ctx.strokeStyle = "#543847";
        ctx.lineWidth = 4;
        ctx.strokeRect(boardX, boardY, boardW, boardH);
        
        ctx.fillStyle = "#f46c24";
        ctx.font = "900 18px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("SCORE", boardX + boardW - 20, boardY + 30);
        ctx.fillText("BEST", boardX + boardW - 20, boardY + 70);
        
        ctx.fillStyle = "white";
        ctx.font = "900 24px sans-serif";
        ctx.strokeText(score, boardX + boardW - 20, boardY + 50);
        ctx.fillText(score, boardX + boardW - 20, boardY + 50);
        
        ctx.strokeText(bestScore, boardX + boardW - 20, boardY + 90);
        ctx.fillText(bestScore, boardX + boardW - 20, boardY + 90);
        
        // Play button indicator
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "bold 20px sans-serif";
        ctx.strokeText("TAP TO RESTART", logicalWidth/2, boardY + boardH + 40);
        ctx.fillText("TAP TO RESTART", logicalWidth/2, boardY + boardH + 40);
        
        ctx.textAlign = "left";
    }
    
    function drawGetReady() {
        ctx.fillStyle = "#e86100";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.font = "900 40px sans-serif";
        ctx.textAlign = "center";
        
        const textY = logicalHeight/2 - 60;
        ctx.strokeText("GET READY", logicalWidth / 2, textY);
        ctx.fillText("GET READY", logicalWidth / 2, textY);
        
        ctx.strokeStyle = "#543847";
        ctx.lineWidth = 2;
        ctx.strokeText("GET READY", logicalWidth / 2, textY);
        
        ctx.fillStyle = "white";
        ctx.font = "bold 20px sans-serif";
        ctx.strokeText("TAP TO FLAP", logicalWidth / 2, textY + 60);
        ctx.fillText("TAP TO FLAP", logicalWidth / 2, textY + 60);
        
        ctx.textAlign = "left";
    }

    function loop() {
        bg.draw();
        pipes.draw();
        ground.draw();
        bird.draw();
        
        if (state === 0) { // Get Ready
            drawGetReady();
            ground.update();
            bird.update();
        } else if (state === 1) { // Playing
            pipes.update();
            ground.update();
            bird.update();
            drawScore();
        } else if (state === 2) { // Hit
            bird.update();
            // Flash effect
            if (flashOpacity > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
                ctx.fillRect(0, 0, logicalWidth, logicalHeight);
                flashOpacity -= 0.1;
            }
        } else if (state === 3) { // Game Over
            drawGameOver();
        }
        
        frames++;
        animationReq = requestAnimationFrame(loop);
    }
    
    function onInteract(e) {
        if (e.type === "touchstart") e.preventDefault(); 
        
        switch (state) {
            case 0:
                state = 1;
                bird.flap();
                break;
            case 1:
                bird.flap();
                break;
            case 2:
                // Do nothing while falling
                break;
            case 3:
                // Reset
                bird.reset();
                pipes.reset();
                score = 0;
                frames = 0;
                state = 0;
                break;
        }
    }
    
    canvas.addEventListener("touchstart", onInteract, { passive: false });
    canvas.addEventListener("mousedown", onInteract);
    
    // Start game loop
    loop();
    
    const observer = new MutationObserver((mutations) => {
        if (!document.body.contains(canvas)) {
            cancelAnimationFrame(animationReq);
            window.removeEventListener("resize", resize);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
};
