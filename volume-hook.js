(function () {
    function clampVolume(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0.7;
        const normalized = numeric > 1 ? numeric / 100 : numeric;
        return Math.max(0, Math.min(1, normalized));
    }

    function getStoredVolume() {
        try {
            return clampVolume(window.localStorage.getItem("bl4ut0Volume") || 70);
        } catch (error) {
            return 0.7;
        }
    }

    function postGameMessage(payload) {
        if (!window.parent || window.parent === window) return;
        window.parent.postMessage({
            ...payload,
            source: "portfolio-game-runtime",
            path: window.location.pathname
        }, "*");
    }

    window.osVolume = getStoredVolume();
    window.osGainNodes = [];
    window.osAudioElements = [];

    function applyOsVolume(value) {
        window.osVolume = clampVolume(value);
        window.osGainNodes.forEach((gain) => {
            if (gain?.gain) gain.gain.value = window.osVolume;
        });
        window.osAudioElements.forEach((audio) => {
            audio.volume = window.osVolume;
        });
    }

    // Intercept Web Audio API before the embedded game creates its audio context.
    const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
    if (OriginalAudioContext) {
        window.AudioContext = new Proxy(OriginalAudioContext, {
            construct(target, args) {
                const ctx = new target(...args);
                const originalDestination = ctx.destination;
                const gain = ctx.createGain();
                gain.gain.value = window.osVolume;
                gain.connect(originalDestination);

                window.osGainNodes.push(gain);

                Object.defineProperty(ctx, "destination", {
                    configurable: true,
                    get: () => gain
                });
                return ctx;
            }
        });
        window.webkitAudioContext = window.AudioContext;
    }

    // Intercept HTML5 Audio constructor.
    const OriginalAudio = window.Audio;
    if (OriginalAudio) {
        window.Audio = new Proxy(OriginalAudio, {
            construct(target, args) {
                const audio = new target(...args);
                audio.volume = window.osVolume;
                window.osAudioElements.push(audio);
                return audio;
            }
        });
    }

    // Intercept HTMLAudioElement cloneNode.
    const OriginalNodeClone = Node.prototype.cloneNode;
    Node.prototype.cloneNode = function (deep) {
        const clone = OriginalNodeClone.call(this, deep);
        if (clone instanceof HTMLAudioElement) {
            clone.volume = window.osVolume;
            window.osAudioElements.push(clone);
        }
        return clone;
    };

    let hadPointerLock = false;
    function releasePointerLock(reason) {
        if (!document.pointerLockElement) return;
        try {
            document.exitPointerLock?.();
        } catch (error) {}
        postGameMessage({ type: "game-pointer-release", reason });
    }

    window.addEventListener("message", (event) => {
        if (!event.data) return;
        if (event.data.type === "volume") {
            applyOsVolume(event.data.value);
        }
        if (event.data.type === "release-pointer-lock") {
            releasePointerLock("parent-request");
        }
    });

    window.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.altKey) {
            event.preventDefault();
            releasePointerLock("ctrl-alt");
            return;
        }
        if (event.key === "Escape") {
            releasePointerLock("escape");
        }
    }, true);

    document.addEventListener("pointerlockchange", () => {
        const hasPointerLock = Boolean(document.pointerLockElement);
        if (hadPointerLock && !hasPointerLock) {
            postGameMessage({ type: "game-pointer-release", reason: "pointerlockchange" });
        }
        hadPointerLock = hasPointerLock;
    });
})();
