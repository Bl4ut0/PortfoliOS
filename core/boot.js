/** The original typed introduction, independent of every workspace. */
window.runBootSequence = () => {
    const screen = document.getElementById("boot-screen");
    if (!screen) return;
    const lines = Array.from(screen.querySelectorAll(".boot-lines > span"));
    const mark = screen.querySelector(".boot-mark");
    const fields = [...lines, screen.querySelector(".eyebrow"), document.getElementById("boot-title"), document.getElementById("boot-summary")];
    const text = fields.map(node => node.textContent.trim());
    fields.forEach((node, i) => {
        node.dataset.bootText = text[i];
        node.setAttribute("aria-label", text[i]);
        node.textContent = "";
        const copy = document.createElement("span");
        copy.className = "boot-typed-text"; copy.setAttribute("aria-hidden", "true");
        node.appendChild(copy); node.style.opacity = "0";
    });
    mark.style.opacity = "0";

    const isFastBoot = Boolean(window.PortfoliOS_BIOS?.get("fastBoot"));
    let fast = isFastBoot;
    let isReady = false;

    const hold = event => { if (!screen.classList.contains("is-ready") && !event.target.closest("button")) { fast = true; screen.classList.add("is-fast-forwarding"); } };
    const release = () => { if (!isFastBoot) { fast = false; screen.classList.remove("is-fast-forwarding"); } };
    screen.addEventListener("pointerdown", hold);
    ["pointerup", "pointercancel", "pointerleave"].forEach(name => screen.addEventListener(name, release));
    const pause = ms => new Promise(resolve => setTimeout(resolve, fast ? 0 : ms));
    const ready = () => {
        if (isReady) return;
        isReady = true;
        release(); screen.classList.add("is-ready");
        window.PortfolioLoader?.mark("selector-ready");
        screen.dispatchEvent(new Event("portfolio:selector-ready"));
    };
    const type = async (index, speed) => {
        const node = fields[index]; node.style.opacity = "1";
        const copy = node.querySelector(".boot-typed-text");
        for (let i = 0; i < text[index].length; i++) {
            if (fast) { copy.textContent = text[index]; break; }
            copy.textContent += text[index][i]; await pause(speed);
        }
    };

    // Wire BIOS Setup entry handlers
    const openBiosHandler = (event) => {
        event?.preventDefault();
        event?.stopPropagation();
        window.openBiosSetup?.();
    };
    document.getElementById("boot-bios-hint-btn")?.addEventListener("click", openBiosHandler);
    document.getElementById("boot-bios-btn")?.addEventListener("click", openBiosHandler);

    if (matchMedia("(prefers-reduced-motion: reduce)").matches || isFastBoot) {
        fields.forEach((node, i) => { node.querySelector(".boot-typed-text").textContent = text[i]; node.style.opacity = "1"; });
        mark.style.opacity = "1"; ready(); return;
    }
    void (async () => {
        // Authentic POST beep if enabled
        if (window.PortfoliOS_BIOS?.get("bootBeep")) {
            try { window.PortfoliOS_BIOS.beep(880, 0.08, "square"); } catch (_) {}
        }
        await pause(300);
        for (let i = 0; i < lines.length; i++) { await type(i, 25); await pause(150); }
        mark.style.opacity = "1"; await pause(200);
        await type(3, 20); await pause(100);
        await type(4, 40); await pause(150);
        await type(5, 12); await pause(250); ready();
    })();
};
