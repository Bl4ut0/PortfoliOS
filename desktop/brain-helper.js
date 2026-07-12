/**
 * PortfoliOS: Animated Brain Helper Mascot
 * Clippy-style local AI desktop assistant with interactive speech bubble and streaming chat.
 */
(function() {
    // Inject Styles
    const style = document.createElement("style");
    style.textContent = `
        /* Brain Helper Container */
        .brain-helper-container {
            position: fixed;
            bottom: 70px;
            right: clamp(12px, 2vw, 25px);
            z-index: 78;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            pointer-events: none;
            visibility: hidden;
            transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0;
            transform: translateY(20px) scale(0.9);
        }
        .brain-helper-container.visible {
            opacity: 1;
            visibility: visible;
            transform: translateY(0) scale(1);
            pointer-events: none;
        }

        /* Mascot Element */
        .brain-helper-mascot {
            width: 75px;
            height: 75px;
            cursor: pointer;
            position: relative;
            user-select: none;
            padding: 0;
            border: 0;
            color: inherit;
            background: transparent;
            line-height: 0;
            filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3));
            pointer-events: none;
        }
        .brain-helper-container.visible .brain-helper-mascot {
            pointer-events: auto;
        }
        .brain-helper-mascot:focus-visible {
            outline: 2px solid var(--theme-primary, #22d3ee);
            outline-offset: 2px;
            border-radius: 8px;
        }

        /* Floating Bobbing Animation */
        .brain-helper-mascot.idle .brain-helper-svg {
            animation: brain-bob 3.5s ease-in-out infinite;
        }
        .brain-helper-mascot.thinking .brain-helper-svg {
            animation: brain-bob 1.5s ease-in-out infinite, brain-pulse 1.5s ease-in-out infinite;
        }

        /* Eyes & Blinking Animation */
        .brain-helper-eye {
            transform-origin: center;
            animation: brain-blink 5s ease-in-out infinite;
        }

        /* Shadow Below Mascot */
        .brain-helper-shadow {
            width: 50px;
            height: 6px;
            background: rgba(0, 0, 0, 0.35);
            border-radius: 50%;
            margin-right: 12px;
            margin-top: 4px;
            filter: blur(2px);
            transform-origin: center;
            animation: shadow-scale 3.5s ease-in-out infinite;
            transition: all 0.3s ease;
            pointer-events: none;
        }
        .brain-helper-mascot.thinking + .brain-helper-shadow {
            animation: shadow-scale 1.5s ease-in-out infinite;
        }

        /* Glassmorphic Speech Bubble */
        .brain-helper-bubble {
            background: rgba(15, 17, 26, 0.85);
            backdrop-filter: blur(12px) saturate(180%);
            -webkit-backdrop-filter: blur(12px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            width: min(320px, calc(100vw - 24px));
            box-sizing: border-box;
            padding: 16px;
            margin-bottom: 12px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05);
            display: flex;
            flex-direction: column;
            gap: 12px;
            transform-origin: bottom right;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0;
            visibility: hidden;
            transform: scale(0.85) translateY(10px);
            pointer-events: none;
        }
        .brain-helper-container.visible .brain-helper-bubble.visible {
            opacity: 1;
            visibility: visible;
            transform: scale(1) translateY(0);
            pointer-events: auto;
        }

        /* Bubble Header */
        .brain-helper-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            padding-bottom: 8px;
        }
        .brain-helper-title {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--theme-primary, #22d3ee);
            display: flex;
            align-items: center;
            gap: 6px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .brain-helper-close {
            background: none;
            border: none;
            color: var(--text-soft, #9ca3af);
            cursor: pointer;
            font-size: 0.85rem;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .brain-helper-close:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.06);
        }

        /* Bubble Chat Feed & Stream */
        .brain-helper-output {
            max-height: 180px;
            overflow-y: auto;
            font-size: 0.88rem;
            line-height: 1.5;
            color: var(--text, #f3f4f6);
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }
        .brain-helper-output::-webkit-scrollbar {
            width: 4px;
        }
        .brain-helper-output::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
        }

        /* Prompt Textarea Form */
        .brain-helper-form {
            display: flex;
            flex-direction: column;
            gap: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 10px;
        }
        .brain-helper-input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }
        .brain-helper-input {
            width: 100%;
            height: 38px;
            min-height: 38px;
            max-height: 80px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            color: #fff;
            padding: 8px 36px 8px 10px;
            font-size: 0.85rem;
            outline: none;
            resize: none;
            font-family: inherit;
            transition: all 0.2s ease;
        }
        .brain-helper-input:focus {
            border-color: var(--theme-primary, #22d3ee);
            background: rgba(255, 255, 255, 0.05);
            box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.15);
        }
        .brain-helper-input::placeholder {
            color: var(--text-soft, #6b7280);
        }
        .brain-helper-submit {
            position: absolute;
            right: 8px;
            background: none;
            border: none;
            color: var(--theme-primary, #22d3ee);
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .brain-helper-submit:hover:not(:disabled) {
            background: rgba(34, 211, 238, 0.1);
            color: #fff;
        }
        .brain-helper-submit:disabled {
            color: var(--text-soft, #4b5563);
            cursor: not-allowed;
        }
        .brain-helper-submit[hidden] {
            display: none;
        }
        .brain-helper-stop {
            color: var(--rose, #f43f5e);
        }
        .brain-helper-stop:hover:not(:disabled) {
            color: #fff;
            background: rgba(244, 63, 94, 0.14);
        }

        /* Mini-text helpers */
        .brain-helper-hint {
            font-size: 0.72rem;
            color: var(--text-soft, #9ca3af);
            margin: 0;
            display: flex;
            justify-content: space-between;
        }

        /* SVG Glow & Gradient Definition */
        .brain-glow {
            filter: drop-shadow(0 0 4px var(--theme-primary, #22d3ee));
        }

        /* Speech bubble cursor */
        .brain-stream-cursor {
            display: inline-block;
            width: 6px;
            height: 14px;
            background: var(--theme-primary, #22d3ee);
            margin-left: 2px;
            animation: cursor-blink 0.8s step-end infinite;
            vertical-align: middle;
        }

        /* Neurons & Synapses */
        .neuron-connection {
            stroke: var(--theme-primary, #22d3ee);
            stroke-width: 1.2;
            stroke-linecap: round;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .neuron-node {
            fill: #fff;
            stroke: var(--theme-primary, #22d3ee);
            stroke-width: 0.8;
            r: 2;
            opacity: 0;
            transition: opacity 0.3s ease;
            transform-origin: center;
        }

        /* Firing active animations */
        .brain-helper-mascot.thinking .neuron-connection {
            opacity: 0.55;
            stroke-dasharray: 8, 4;
            animation: synapse-flow 1.2s linear infinite;
        }
        .brain-helper-mascot.thinking .neuron-node {
            opacity: 1;
            animation: neuron-pulse 1s ease-in-out infinite;
        }

        .brain-helper-mascot.thinking .neuron-node:nth-child(even) {
            animation-delay: 0.3s;
        }
        .brain-helper-mascot.thinking .neuron-node:nth-child(3n) {
            animation-delay: 0.6s;
        }

        @keyframes synapse-flow {
            from { stroke-dashoffset: 12; }
            to { stroke-dashoffset: 0; }
        }
        @keyframes neuron-pulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 1px #fff); }
            50% { transform: scale(1.5); fill: var(--theme-accent, #ec4899); filter: drop-shadow(0 0 3px var(--theme-primary, #22d3ee)); }
        }

        /* Animations Keyframes */
        @keyframes brain-bob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
        }
        @keyframes shadow-scale {
            0%, 100% { transform: scale(1); opacity: 0.35; filter: blur(2px); }
            50% { transform: scale(0.8); opacity: 0.18; filter: blur(3px); }
        }
        @keyframes brain-pulse {
            0%, 100% { filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3)) drop-shadow(0 0 0px rgba(34, 211, 238, 0)); }
            50% { filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3)) drop-shadow(0 0 8px rgba(34, 211, 238, 0.6)); }
        }
        @keyframes brain-blink {
            0%, 96%, 100% { transform: scaleY(1); }
            98% { transform: scaleY(0.1); }
        }
        @keyframes cursor-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    function getWelcomeMessage(isCloud) {
        if (isCloud) {
            return `Hi there! I am your Cloud AI brain helper. Ask me any question about the portfolio or commands!<br><br><span style="font-size: 0.76rem; opacity: 0.85; line-height: 1.4; display: block;">Running on a cloud-hosted model. You can switch models or manage connection settings in the <a href="#" data-action="open-local-ai" style="color: var(--theme-primary, #22d3ee); text-decoration: underline;">AI app</a>.</span>`;
        }
        return `Hi there! I am your Local AI brain helper. Ask me any question about the portfolio or commands!<br><br><span style="font-size: 0.76rem; opacity: 0.85; line-height: 1.4; display: block;">For lightweight chat, use SmolLM2 360M or Qwen 0.5B in <a href="#" data-action="open-local-ai" style="color: var(--theme-primary, #22d3ee); text-decoration: underline;">AI settings</a>.</span>`;
    }

    function getClearChatMessage(isCloud) {
        if (isCloud) {
            return `Clear screen. What would you like to know?<br><br><span style="font-size: 0.76rem; opacity: 0.85; line-height: 1.4; display: block;">Running on a cloud-hosted model. You can switch models or manage connection settings in the <a href="#" data-action="open-local-ai" style="color: var(--theme-primary, #22d3ee); text-decoration: underline;">AI app</a>.</span>`;
        }
        return `Clear screen. What would you like to know?<br><br><span style="font-size: 0.76rem; opacity: 0.85; line-height: 1.4; display: block;">Tip: You can select other local AI models in the <a href="#" data-action="open-local-ai" style="color: var(--theme-primary, #22d3ee); text-decoration: underline;">Local AI app</a>.</span>`;
    }

    const initialIsCloud = window.LocalAI && window.LocalAI.getStatus ? window.LocalAI.getStatus().modelType?.startsWith("cloud-") : false;

    // Create Mascot SVG & HTML Structure
    const container = document.createElement("div");
    container.className = "brain-helper-container";
    container.innerHTML = `
        <div class="brain-helper-bubble" id="brain-helper-bubble" role="dialog" aria-label="Lobe AI assistant" aria-hidden="true">
            <div class="brain-helper-header">
                <span class="brain-helper-title">
                    <i class="fa-solid fa-microchip-brain"></i> Lobe
                </span>
                <button type="button" class="brain-helper-close" id="brain-helper-close-btn" title="Minimize bubble">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div class="brain-helper-output" id="brain-helper-text" aria-live="polite">
                ${getWelcomeMessage(initialIsCloud)}
            </div>
            <form class="brain-helper-form" id="brain-helper-form">
                <div class="brain-helper-input-wrapper">
                    <textarea class="brain-helper-input" id="brain-helper-input" placeholder="Ask a question..." rows="1" required></textarea>
                    <button type="submit" class="brain-helper-submit" id="brain-helper-send" title="Send question">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                    <button type="button" class="brain-helper-submit brain-helper-stop" id="brain-helper-stop" title="Cancel response" hidden>
                        <i class="fa-solid fa-square"></i>
                    </button>
                </div>
                <div class="brain-helper-hint">
                    <span>Press Enter to send</span>
                    <a href="#" style="color: var(--theme-primary, #22d3ee); text-decoration: none;" id="brain-helper-clear-btn">Clear chat</a>
                </div>
            </form>
        </div>
        <button type="button" class="brain-helper-mascot idle" id="brain-helper-mascot" title="Chat with ${initialIsCloud ? 'Cloud AI' : 'Local AI'}" aria-label="Open Lobe AI assistant" aria-expanded="false" aria-controls="brain-helper-bubble">
            <svg class="brain-helper-svg" viewBox="0 0 100 100" width="100%" height="100%">
                <!-- Gradient for Brain Shape -->
                <defs>
                    <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ec4899" /> <!-- pink-500 -->
                        <stop offset="50%" stop-color="#a855f7" /> <!-- purple-500 -->
                        <stop offset="100%" stop-color="#3b82f6" /> <!-- blue-500 -->
                    </linearGradient>
                    <linearGradient id="brainGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#22d3ee" /> <!-- cyan-400 -->
                        <stop offset="100%" stop-color="#ec4899" />
                    </linearGradient>
                </defs>

                <!-- Brain Main Shape (Left & Right Hemispheres combined in a cute cartoon style) -->
                <!-- Left Hemisphere -->
                <path d="M 50 20 
                         C 35 20, 22 28, 22 45 
                         C 22 55, 28 62, 33 65 
                         C 30 70, 36 78, 45 76 
                         C 48 76, 50 73, 50 70 Z" 
                      fill="url(#brainGrad)" />
                <!-- Right Hemisphere -->
                <path d="M 50 20 
                         C 65 20, 78 28, 78 45 
                         C 78 55, 72 62, 67 65 
                         C 70 70, 64 78, 55 76 
                         C 52 76, 50 73, 50 70 Z" 
                      fill="url(#brainGrad)" />

                <!-- Brain Lobes Details (Cartoon Creases) -->
                <path d="M 33 35 C 38 38, 42 34, 45 38" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="2.5" stroke-linecap="round" />
                <path d="M 67 35 C 62 38, 58 34, 55 38" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="2.5" stroke-linecap="round" />
                <path d="M 28 48 C 34 50, 38 46, 46 50" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="2.5" stroke-linecap="round" />
                <path d="M 72 48 C 66 50, 62 46, 54 50" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="2.5" stroke-linecap="round" />
                <path d="M 38 60 C 42 62, 45 58, 48 64" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="2.5" stroke-linecap="round" />
                <path d="M 62 60 C 58 62, 55 58, 52 64" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="2.5" stroke-linecap="round" />

                <!-- Firing Neurons (glowing nodes & synapses) -->
                <g class="brain-neurons">
                    <!-- Synapses / Connection lines -->
                    <path class="neuron-connection" d="M 35 28 L 25 42" />
                    <path class="neuron-connection" d="M 25 42 L 38 68" />
                    <path class="neuron-connection" d="M 65 28 L 75 42" />
                    <path class="neuron-connection" d="M 75 42 L 62 68" />
                    <path class="neuron-connection" d="M 50 24 L 35 28" />
                    <path class="neuron-connection" d="M 50 24 L 65 28" />
                    <path class="neuron-connection" d="M 38 68 Q 50 72, 62 68" />
                    
                    <!-- Neurons / Firing points -->
                    <circle class="neuron-node" cx="35" cy="28" />
                    <circle class="neuron-node" cx="25" cy="42" />
                    <circle class="neuron-node" cx="38" cy="68" />
                    <circle class="neuron-node" cx="65" cy="28" />
                    <circle class="neuron-node" cx="75" cy="42" />
                    <circle class="neuron-node" cx="62" cy="68" />
                    <circle class="neuron-node" cx="50" cy="24" />
                </g>

                <!-- Left Eye -->
                <g class="brain-helper-eye" transform="translate(37, 48)">
                    <circle cx="0" cy="0" r="8" fill="white" />
                    <circle cx="1.5" cy="0" r="4.5" fill="#0f172a" />
                    <circle cx="-1" cy="-2.5" r="2.2" fill="white" />
                </g>

                <!-- Right Eye -->
                <g class="brain-helper-eye" transform="translate(63, 48)">
                    <circle cx="0" cy="0" r="8" fill="white" />
                    <circle cx="-1.5" cy="0" r="4.5" fill="#0f172a" />
                    <circle cx="-3" cy="-2.5" r="2.2" fill="white" />
                </g>

                <!-- Cute Mouth/Smile -->
                <path id="brainy-mouth" d="M 45 58 Q 50 63, 55 58" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />

                <!-- Little Rosy Cheeks -->
                <circle cx="27" cy="54" r="3.5" fill="#f43f5e" opacity="0.5" />
                <circle cx="73" cy="54" r="3.5" fill="#f43f5e" opacity="0.5" />
            </svg>
        </button>
        <div class="brain-helper-shadow"></div>
    `;
    document.body.appendChild(container);

    // DOM References
    const mascot = document.getElementById("brain-helper-mascot");
    const bubble = document.getElementById("brain-helper-bubble");
    const textOutput = document.getElementById("brain-helper-text");
    const form = document.getElementById("brain-helper-form");
    const input = document.getElementById("brain-helper-input");
    const sendBtn = document.getElementById("brain-helper-send");
    const stopBtn = document.getElementById("brain-helper-stop");
    const closeBtn = document.getElementById("brain-helper-close-btn");
    const clearBtn = document.getElementById("brain-helper-clear-btn");
    const mouth = document.getElementById("brainy-mouth");

    let isMascotVisible = false;
    let isBubbleVisible = false;
    let isGenerating = false;
    let lobeRequestId = 0;

    function renderAssistantText(value) {
        return escapeHtml(value)
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br>");
    }

    function setMascotThinking(thinking) {
        mascot.classList.toggle("thinking", thinking);
        mascot.classList.toggle("idle", !thinking);
        mouth.setAttribute("d", thinking ? "M 46 60 Q 50 60, 54 60" : "M 45 58 Q 50 63, 55 58");
    }

    function setGenerationControls(generating) {
        isGenerating = generating;
        form.setAttribute("aria-busy", String(generating));
        input.disabled = generating;
        sendBtn.disabled = generating;
        sendBtn.hidden = generating;
        stopBtn.hidden = !generating;
        stopBtn.disabled = false;
        setMascotThinking(generating);
    }

    // Toggle speech bubble on mascot click
    mascot.addEventListener("click", () => {
        setBubbleVisibility(!isBubbleVisible);
        if (isBubbleVisible) {
            setTimeout(() => input.focus(), 150);
        }
    });

    // Close/Minimize bubble
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setBubbleVisibility(false);
    });

    // Clear Chat
    clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        lobeRequestId += 1;
        if (isGenerating) {
            window.LocalAI?.cancelGeneration?.("lobe-clear");
        }
        const isCloud = window.LocalAI && window.LocalAI.getStatus ? window.LocalAI.getStatus().modelType?.startsWith("cloud-") : false;
        textOutput.innerHTML = getClearChatMessage(isCloud);
        input.value = "";
        input.focus();
    });

    stopBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!window.LocalAI?.cancelGeneration) return;

        stopBtn.disabled = true;
        try {
            await window.LocalAI.cancelGeneration("lobe");
        } finally {
            const stillGenerating = window.LocalAI.getStatus?.().status === "generating";
            setGenerationControls(stillGenerating);
        }
    });

    // Handle clicks on internal link actions
    textOutput.addEventListener("click", (e) => {
        const link = e.target.closest("[data-action='open-local-ai']");
        if (link) {
            e.preventDefault();
            if (window.openDesktopWindow) {
                window.openDesktopWindow("local-ai");
            }
            if (window.closeLocalAITrayPanel) {
                window.closeLocalAITrayPanel();
            }
        }
    });

    // Handle form auto-resize text area
    input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = `${Math.min(80, input.scrollHeight)}px`;
    });

    // Form submission with Enter key support
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            form.requestSubmit();
        }
    });

    function updateHelperMode(isCloud) {
        if (mascot) {
            const label = isCloud ? "Cloud AI" : "Local AI";
            mascot.title = `Chat with ${label}`;
            mascot.setAttribute("aria-label", `Open Lobe ${label} assistant`);
        }
        const welcomeTextLocal = "Hi there! I am your Local AI brain helper.";
        const welcomeTextCloud = "Hi there! I am your Cloud AI brain helper.";
        if (textOutput && (textOutput.innerHTML.includes(welcomeTextLocal) || textOutput.innerHTML.includes(welcomeTextCloud) || textOutput.innerHTML === "")) {
            textOutput.innerHTML = getWelcomeMessage(isCloud);
        }
    }

    // Set Mascot Visibility State
    function setMascotVisibility(visible) {
        if (visible === isMascotVisible) return;
        isMascotVisible = visible;
        if (visible) {
            container.classList.add("visible");
        } else {
            container.classList.remove("visible");
            setBubbleVisibility(false);
        }
    }

    // Set Bubble Visibility
    function setBubbleVisibility(visible) {
        isBubbleVisible = visible;
        mascot.setAttribute("aria-expanded", String(visible));
        bubble.setAttribute("aria-hidden", String(!visible));
        if (visible) {
            window.closeLocalAITrayPanel?.();
            bubble.classList.add("visible");
        } else {
            bubble.classList.remove("visible");
        }
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isBubbleVisible) {
            setBubbleVisibility(false);
            mascot.focus();
        }
    });

    // Handle Form Submit (AI prompt query)
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const prompt = input.value.trim();
        if (!prompt) return;

        if (isGenerating) {
            textOutput.textContent = "Local AI is already answering. Cancel the current response before sending another question.";
            return;
        }

        const requestId = ++lobeRequestId;
        input.value = "";
        input.style.height = "38px";
        input.blur();

        if (!window.LocalAI || !window.LocalAI.isReady()) {
            if (window.SimpleBrain) {
                const answer = window.SimpleBrain.query(prompt);
                if (answer) {
                    input.disabled = true;
                    sendBtn.disabled = true;
                    textOutput.innerHTML = "";
                    setMascotThinking(true);

                    setTimeout(() => {
                        if (requestId !== lobeRequestId || isGenerating) return;
                        setMascotThinking(false);
                        textOutput.innerHTML = renderAssistantText(answer);
                        input.disabled = false;
                        sendBtn.disabled = false;
                        textOutput.scrollTop = textOutput.scrollHeight;
                        input.focus();
                    }, 250);
                    return;
                }
            }

            textOutput.innerHTML = `I'm a basic offline helper. I can answer questions about Alex's <strong>profile</strong>, <strong>projects</strong>, <strong>skills</strong>, <strong>contacts</strong>, or <strong>games</strong>.<br><br>For complex questions like "${escapeHtml(prompt)}", please enable a higher-tier AI model in the <a href="#" data-action="open-local-ai" style="color: var(--theme-primary, #22d3ee); text-decoration: underline;">AI app</a>.`;
            return;
        }

        setGenerationControls(true);
        textOutput.innerHTML = "";
        let streamedText = "";

        const cursorSpan = document.createElement("span");
        cursorSpan.className = "brain-stream-cursor";
        textOutput.appendChild(cursorSpan);

        try {
            const onChunk = (delta) => {
                if (requestId !== lobeRequestId) return;
                streamedText += String(delta || "");
                textOutput.innerHTML = renderAssistantText(streamedText);
                textOutput.appendChild(cursorSpan);
                textOutput.scrollTop = textOutput.scrollHeight;

                if (Math.random() > 0.4) {
                    mouth.setAttribute("d", "M 46 61 Q 50 56, 54 61");
                } else {
                    mouth.setAttribute("d", "M 45 58 Q 50 63, 55 58");
                }
            };

            const result = await window.LocalAI.chat(prompt, {
                user: window.currentUser || "guest",
                cwd: window.currentDir || "/",
                mode: "chat"
            }, onChunk);

            if (requestId === lobeRequestId) {
                textOutput.innerHTML = renderAssistantText(result);
            }
        } catch (error) {
            if (requestId === lobeRequestId) {
                const isCloud = window.LocalAI?.getStatus?.().modelType?.startsWith("cloud-");
                const message = error?.message || (isCloud ? "Cloud AI failed to generate response." : "Local AI failed to generate response.");
                textOutput.innerHTML = `<span style="color: var(--rose, #f43f5e);">Error: ${escapeHtml(message)}</span>`;
            }
        } finally {
            if (requestId === lobeRequestId) {
                const stillGenerating = window.LocalAI?.getStatus?.().status === "generating";
                setGenerationControls(stillGenerating);
                textOutput.scrollTop = textOutput.scrollHeight;
                if (!stillGenerating) {
                    setTimeout(() => input.focus(), 50);
                }
            }
        }
    });

    // Helper helper to escape HTML characters
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Listen to Local AI Status events
    if (window.EventBus) {
        window.EventBus.on("local-ai:status", (status) => {
            const isReady = status.ready || status.status === "generating";
            setMascotVisibility(isReady);
            setGenerationControls(status.status === "generating");
            
            const isCloud = status.modelType && status.modelType.startsWith("cloud-");
            updateHelperMode(isCloud);
        });

        // Initialize visibility based on current status
        if (window.LocalAI) {
            const currentStatus = window.LocalAI.getStatus();
            const isReady = currentStatus.ready || currentStatus.status === "generating";
            setMascotVisibility(isReady);
            setGenerationControls(currentStatus.status === "generating");
            
            const isCloud = currentStatus.modelType && currentStatus.modelType.startsWith("cloud-");
            updateHelperMode(isCloud);
        }
    }
    // Expose BrainHelper globally to tie separate systems (like CLI) together
    window.BrainHelper = {
        show: () => setMascotVisibility(true),
        hide: () => setMascotVisibility(false),
        openBubble: () => setBubbleVisibility(true),
        closeBubble: () => setBubbleVisibility(false),
        cancel: () => window.LocalAI?.cancelGeneration?.("lobe-api"),
        isOpen: () => isBubbleVisible,
        ask: (promptText) => {
            setMascotVisibility(true);
            setBubbleVisibility(true);
            input.value = promptText;
            form.requestSubmit();
        }
    };
})();
