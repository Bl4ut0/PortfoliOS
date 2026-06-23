/**
 * PortfoliOS: Boot Sequence Screen
 * Manages the animated terminal diagnostic POST sequence on start-up.
 * Includes interactive fast-forward on press/pointerdown.
 */

window.runBootSequence = () => {
    const bootScreen = window.byId ? window.byId("boot-screen") : document.getElementById("boot-screen");
    if (!bootScreen) return;

    const bootLines = bootScreen.querySelectorAll(".boot-lines span");
    const bootMark = bootScreen.querySelector(".boot-mark");
    const eyebrow = bootScreen.querySelector(".eyebrow");
    const title = window.byId ? window.byId("boot-title") : document.getElementById("boot-title");
    const summary = window.byId ? window.byId("boot-summary") : document.getElementById("boot-summary");

    // Capture texts from HTML
    const linesTexts = Array.from(bootLines).map(el => el.textContent.trim());
    const eyebrowText = eyebrow ? eyebrow.textContent.trim() : "";
    const titleText = title ? title.textContent.trim() : "";
    const summaryText = summary ? summary.textContent.trim() : "";

    // Clear contents and hide initially
    bootLines.forEach(el => {
        el.textContent = "";
        el.style.opacity = "0";
    });
    if (bootMark) {
        bootMark.style.opacity = "0";
        bootMark.style.transition = "opacity 0.3s ease";
    }
    if (eyebrow) {
        eyebrow.textContent = "";
        eyebrow.style.opacity = "0";
    }
    if (title) {
        title.textContent = "";
        title.style.opacity = "0";
    }
    if (summary) {
        summary.textContent = "";
        summary.style.opacity = "0";
    }

    let bootFastMode = false;
    let bootTimeout = null;
    const bootDelay = (ms) => bootFastMode ? 30 : ms;

    const setBootFastMode = (value) => {
        bootFastMode = value;
        bootScreen.classList.toggle("is-fast-forwarding", value);
    };

    bootScreen.addEventListener("pointerdown", (event) => {
        if (bootScreen.classList.contains("is-ready") || event.target.closest("[data-enter-view]")) return;
        setBootFastMode(true);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
        bootScreen.addEventListener(eventName, () => setBootFastMode(false));
    });

    function type(element, text, speed, callback) {
        element.style.opacity = "1";
        let index = 0;
        element.textContent = "";
        function nextChar() {
            if (bootFastMode) {
                element.textContent = text;
                if (callback) callback();
                return;
            }
            if (index < text.length) {
                element.textContent += text[index];
                index++;
                bootTimeout = setTimeout(nextChar, speed);
            } else if (callback) {
                callback();
            }
        }
        nextChar();
    }

    // Sequence
    let currentLine = 0;
    function typeNextLine() {
        if (currentLine < bootLines.length) {
            type(bootLines[currentLine], linesTexts[currentLine], 25, () => {
                currentLine++;
                bootTimeout = setTimeout(typeNextLine, bootDelay(150));
            });
        } else {
            if (bootMark) {
                bootMark.style.opacity = "1";
            }
            bootTimeout = setTimeout(typeEyebrow, bootDelay(200));
        }
    }

    function typeEyebrow() {
        if (eyebrow) {
            type(eyebrow, eyebrowText, 20, () => {
                bootTimeout = setTimeout(typeTitle, bootDelay(100));
            });
        } else {
            typeTitle();
        }
    }

    function typeTitle() {
        if (title) {
            type(title, titleText, 40, () => {
                bootTimeout = setTimeout(typeSummary, bootDelay(150));
            });
        } else {
            typeSummary();
        }
    }

    function typeSummary() {
        if (summary) {
            type(summary, summaryText, 12, () => {
                bootTimeout = setTimeout(showButtons, bootDelay(250));
            });
        } else {
            showButtons();
        }
    }

    function showButtons() {
        bootFastMode = false;
        bootScreen.classList.remove("is-fast-forwarding");
        bootScreen.classList.add("is-ready");
    }

    bootTimeout = setTimeout(typeNextLine, 300);
};
