/**
 * PortfoliOS: CLI Terminal Component
 * Handles parsing CLI commands, rendering outputs, and simulating streaming AI responses.
 */

window.handleCommand = (rawValue) => {
    const raw = rawValue.trim();
    if (!raw) return;
    window.addTerminalLine(`$ ${raw}`, "command");

    const [command, ...args] = raw.split(/\s+/);
    const target = args.join(" ");

    const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");

    if (command === "clear") {
        if (output) output.innerHTML = "";
        return;
    }

    if (command === "help") {
        window.addTerminalLine(window.cliCommands.help);
        return;
    }

    if (command === "whoami") {
        window.addTerminalLine(window.cliCommands.whoami);
        return;
    }

    if (command === "links") {
        window.addTerminalLine(window.cliCommands.links);
        return;
    }

    if (command === "projects") {
        const systems = window.systems || [];
        window.addTerminalLine(systems.map((item) => `${item.id.padEnd(12)} ${item.status.padEnd(8)} ${item.title}`).join("\n"));
        return;
    }

    if (command === "status") {
        window.addTerminalLine([
            "public-site    online   bl4ut0.dev",
            "guildcraft     dev      dev.guildcraft.io",
            "doomsource     playable Doom WAD loader",
            "status-console planned  local module",
            "wardenit       planned  professional node"
        ].join("\n"));
        return;
    }

    if (command === "quick") {
        if (window.switchView) window.switchView("quick");
        window.addTerminalLine("Quick Review opened.");
        return;
    }

    if (command === "play" || command === "doom" || command === "doomsource") {
        if (window.isAppInstalled && !window.isAppInstalled("doomsource")) {
            window.addTerminalLine("Error: Doom is not installed. Launch the Store from the desktop to install it.");
            return;
        }
        if (window.switchView) window.switchView("desktop");
        if (window.renderDossier) window.renderDossier("doomsource");
        if (window.openDesktopWindow) window.openDesktopWindow("doomsource");
        window.addTerminalLine("Doom opened. W/S move, A/D strafe, Left/Right look. Q shoots. E opens doors.");
        return;
    }

    if (command === "linux" || command === "workstation") {
        if (window.switchView) window.switchView("desktop");
        if (command === "linux") {
            if (window.openDesktopWindow) window.openDesktopWindow("linux");
            window.addTerminalLine("lab@bl4ut0 opened.");
        } else {
            if (window.openDesktopWindow) window.openDesktopWindow("profile");
            window.addTerminalLine("Desktop workspace focused.");
        }
        return;
    }

    if (command === "inspect") {
        const item = window.systemById ? window.systemById(target) : null;
        if (!item) {
            window.addTerminalLine(`No dossier found for "${target}". Try: projects`, "muted");
            return;
        }
        if (window.renderDossier) window.renderDossier(item.id);
        if (window.openDesktopWindow) window.openDesktopWindow("dossier");
        window.addTerminalLine([
            `# ${item.title}`,
            `${item.type} / ${item.status}`,
            "",
            item.summary,
            "",
            `Stack: ${item.tech.join(", ")}`,
            `Signal: ${item.signal}`
        ].join("\n"));
        return;
    }

    if (command === "open") {
        const openTargets = window.openTargets || {};
        const href = openTargets[target];
        if (!href) {
            window.addTerminalLine(`Unknown target "${target}". Try: open devhub`, "muted");
            return;
        }
        window.open(href, "_blank", "noopener,noreferrer");
        window.addTerminalLine(`Opening ${href}`);
        return;
    }

    window.simulateAiResponse(rawValue);
};

window.streamTextToTerminal = (text, className = "ai-response") => {
    const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
    if (!output) return;
    
    const container = document.createElement("div");
    container.className = `terminal-line ${className}`.trim();
    output.appendChild(container);

    container.innerHTML = `<span class="ai-thinking">Thinking...</span>`;
    output.scrollTop = output.scrollHeight;

    setTimeout(() => {
        container.innerHTML = "";
        let index = 0;
        function tick() {
            const currentText = text.slice(0, index)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            container.innerHTML = currentText + '<span class="ai-cursor"></span>';
            output.scrollTop = output.scrollHeight;
            index += 1;
            if (index <= text.length) {
                window.setTimeout(tick, 10 + Math.random() * 15);
            } else {
                container.innerHTML = currentText; 
            }
        }
        tick();
    }, 400 + Math.random() * 600);
};

window.simulateAiResponse = (query) => {
    const lower = query.toLowerCase();
    let response = "I'm a simulated AI assistant for PortfoliOS. Try asking about **projects**, **skills**, or my **purpose**.";
    
    if (lower.includes("who") || lower.includes("about") || lower.includes("yourself")) {
        response = "I am a simulated assistant built into **PortfoliOS**. I can tell you about Alex (Bl4ut0), an infrastructure operator and systems builder focused on connecting self-hosted tools and gaming ecosystems.";
    } else if (lower.includes("project") || lower.includes("portfolio") || lower.includes("built")) {
        response = "There are several active nodes in the portfolio:\n**Bl4ut0.dev** - The main dev portal.\n**GuildCraft** - A gaming community platform.\n**DOOM Source** - An embedded WASM Doom engine.\nType `projects` or `status` to see standard system lists.";
    } else if (lower.includes("skill") || lower.includes("tech") || lower.includes("stack") || lower.includes("experience")) {
        response = "Core skills include:\n- **Infrastructure**: Linux, Proxmox, Docker, Cloudflare\n- **Development**: Node.js, Lua (WoW), React, Python\n- **Operations**: Self-hosting, homelab automation, system administration";
    } else if (lower.includes("contact") || lower.includes("discord") || lower.includes("github")) {
        response = "You can find Alex on:\n- **GitHub**: github.com/Bl4ut0\n- **Discord**: discord.gg/fEwanmFR9m\nType `links` for a full directory.";
    } else if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
        response = "Hello! I'm the PortfoliOS Assistant. How can I help you navigate the system today?";
    } else if (lower.includes("doom") || lower.includes("game") || lower.includes("play")) {
        response = "Ah, DOOM. You can play it right here in the browser. Just type `play doom` to launch the engine.";
    } else if (lower.includes("clear")) {
        response = "Type `clear` as a raw command to clear the terminal screen.";
    } else if (lower.includes("joke") || lower.includes("funny")) {
        response = "Why do programmers prefer dark mode?\nBecause light attracts bugs.";
    }

    window.streamTextToTerminal(response);
};

window.addTerminalLine = (text, className = "") => {
    const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
    if (!output) return;
    
    const line = document.createElement("p");
    line.className = `terminal-line ${className}`.trim();
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
};

window.typeTerminalLine = (text, className = "", speed = 7) => {
    const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
    if (!output) return;
    
    const line = document.createElement("p");
    line.className = `terminal-line ${className}`.trim();
    output.appendChild(line);

    let index = 0;
    function tick() {
        line.textContent = text.slice(0, index);
        output.scrollTop = output.scrollHeight;
        index += 1;
        if (index <= text.length) {
            window.setTimeout(tick, speed);
        }
    }
    tick();
};

window.asciiMotd = `
<pre class="cli-motd" style="color: var(--theme-primary); font-size: 0.65rem; line-height: 1.0; margin-bottom: 1rem; overflow-x: auto;">
██████╗  ██████╗ ██████╗ ████████╗███████╗ ██████╗ ██╗     ██╗ ██████╗ ███████╗
██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██╔═══██╗██║     ██║██╔═══██╗██╔════╝
██████╔╝██║   ██║██████╔╝   ██║   █████╗  ██║   ██║██║     ██║██║   ██║███████╗
██╔═══╝ ██║   ██║██╔══██╗   ██║   ██╔══╝  ██║   ██║██║     ██║██║   ██║╚════██║
██║     ╚██████╔╝██║  ██║   ██║   ██║     ╚██████╔╝███████╗██║╚██████╔╝███████║
╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚══════╝╚═╝ ╚═════╝ ╚══════╝
</pre>
<div style="margin-bottom: 0.5rem">System: <strong style="color: var(--text)">PortfoliOS v1.0.0</strong> (x86_64-browser)</div>
<div style="margin-bottom: 1rem">Access Level: <strong style="color: var(--theme-accent)">GUEST</strong></div>
<div style="color: var(--text-soft)">Type <strong style="color: var(--theme-primary)">help</strong> for system commands, or type natural language to chat with the AI assistant.</div>
<br/>
`;

window.startCliIntro = () => {
    const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
    if (!output) return;
    
    output.innerHTML = window.asciiMotd;
    let delay = 120;
    
    const cliIntroLines = window.cliIntroLines || [];
    cliIntroLines.forEach(([text, className]) => {
        window.setTimeout(() => window.typeTerminalLine(text, className), delay);
        delay += Math.min(1800, 220 + text.length * 7);
    });
};

// Form submission handler
document.addEventListener("submit", (event) => {
    if (event.target.id === "terminal-form") {
        event.preventDefault();
        const input = window.byId ? window.byId("terminal-input") : document.getElementById("terminal-input");
        if (!input) return;
        const val = input.value;
        input.value = "";
        window.handleCommand(val);
    }
});
