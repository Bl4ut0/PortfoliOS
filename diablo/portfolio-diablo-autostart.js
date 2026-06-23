(function () {
    "use strict";

    const mpqUrl = "/diablo/DIABDAT.MPQ";
    const mpqName = "DIABDAT.MPQ";
    const manualMode = new URLSearchParams(window.location.search).get("manual") === "1";

    if (manualMode || window.__portfolioDiabloAutostart) {
        return;
    }

    window.__portfolioDiabloAutostart = true;

    function createOverlay() {
        const overlay = document.createElement("div");
        overlay.id = "portfolio-diablo-autostart";
        overlay.setAttribute("role", "status");
        overlay.setAttribute("aria-live", "polite");
        overlay.innerHTML = [
            '<div class="portfolio-diablo-loader">',
            '  <strong>Loading DIABDAT.MPQ</strong>',
            '  <span data-diablo-autostart-label>Preparing the full game...</span>',
            '  <div class="portfolio-diablo-progress" aria-hidden="true">',
            '    <i data-diablo-autostart-bar></i>',
            "  </div>",
            "</div>"
        ].join("");

        const style = document.createElement("style");
        style.textContent = [
            "#portfolio-diablo-autostart{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#000;color:#eee;font:16px/1.4 Georgia,serif;transition:opacity .25s ease}",
            "#portfolio-diablo-autostart.is-hidden{opacity:0;pointer-events:none}",
            ".portfolio-diablo-loader{width:min(26rem,calc(100vw - 2rem));border:1px solid #666;background:#080808;padding:1.25rem;text-align:center;box-shadow:0 1rem 3rem rgba(0,0,0,.55)}",
            ".portfolio-diablo-loader strong{display:block;margin-bottom:.35rem;font-size:1.35rem;color:#fff}",
            ".portfolio-diablo-loader span{display:block;min-height:1.4em;color:#cfcfcf}",
            ".portfolio-diablo-progress{height:.5rem;margin-top:1rem;border:1px solid #444;background:#111;overflow:hidden}",
            ".portfolio-diablo-progress i{display:block;width:0;height:100%;background:#9f1d16;transition:width .12s linear}"
        ].join("");

        document.head.appendChild(style);
        document.body.appendChild(overlay);
        return overlay;
    }

    function setOverlayProgress(overlay, label, percent) {
        const labelEl = overlay.querySelector("[data-diablo-autostart-label]");
        const barEl = overlay.querySelector("[data-diablo-autostart-bar]");

        if (labelEl) {
            labelEl.textContent = label;
        }

        if (barEl && Number.isFinite(percent)) {
            barEl.style.width = Math.max(0, Math.min(100, percent)) + "%";
        }
    }

    function hideOverlay(overlay) {
        overlay.classList.add("is-hidden");
        window.setTimeout(function () {
            overlay.remove();
        }, 300);
    }

    function createMpqFile(blob) {
        if (typeof File === "function") {
            return new File([blob], mpqName, { type: "application/octet-stream" });
        }

        blob.name = mpqName;
        return blob;
    }

    function findAppInstance() {
        const root = document.getElementById("root");
        const directFiber = root &&
            root._reactRootContainer &&
            root._reactRootContainer._internalRoot &&
            root._reactRootContainer._internalRoot.current;

        function walkFiber(fiber, seen) {
            if (!fiber || seen.has(fiber)) {
                return null;
            }

            seen.add(fiber);

            if (fiber.stateNode && typeof fiber.stateNode.start === "function") {
                return fiber.stateNode;
            }

            return walkFiber(fiber.child, seen) || walkFiber(fiber.sibling, seen);
        }

        const appFromRoot = walkFiber(directFiber, new Set());
        if (appFromRoot) {
            return appFromRoot;
        }

        const appNode = document.querySelector(".App");
        const reactKey = appNode && Object.keys(appNode).find(function (key) {
            return key.indexOf("__reactInternalInstance$") === 0 || key.indexOf("__reactFiber$") === 0;
        });

        return reactKey ? walkFiber(appNode[reactKey], new Set()) : null;
    }

    function waitForAppInstance() {
        return new Promise(function (resolve, reject) {
            const startedAt = Date.now();
            const timer = window.setInterval(function () {
                const app = findAppInstance();
                if (app) {
                    window.clearInterval(timer);
                    resolve(app);
                    return;
                }

                if (Date.now() - startedAt > 15000) {
                    window.clearInterval(timer);
                    reject(new Error("Timed out waiting for Diablo app instance."));
                }
            }, 100);
        });
    }

    async function downloadMpq(overlay) {
        const response = await fetch(mpqUrl, { cache: "force-cache" });
        if (!response.ok) {
            throw new Error("DIABDAT.MPQ returned HTTP " + response.status + ".");
        }

        const total = Number(response.headers.get("content-length")) || 0;

        if (!response.body || typeof response.body.getReader !== "function") {
            setOverlayProgress(overlay, "Downloading hosted MPQ...", 35);
            const fallbackBlob = await response.blob();
            return createMpqFile(fallbackBlob);
        }

        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;

        while (true) {
            const result = await reader.read();
            if (result.done) {
                break;
            }

            chunks.push(result.value);
            loaded += result.value.byteLength;

            if (total) {
                const percent = loaded / total * 100;
                setOverlayProgress(overlay, "Downloading hosted MPQ... " + Math.round(percent) + "%", percent);
            } else {
                setOverlayProgress(overlay, "Downloading hosted MPQ... " + Math.round(loaded / 1048576) + " MB", 35);
            }
        }

        const blob = new Blob(chunks, { type: "application/octet-stream" });
        return createMpqFile(blob);
    }

    async function bootRetailDiablo() {
        const overlay = createOverlay();

        try {
            const app = await waitForAppInstance();

            if (app.state && (app.state.started || app.state.loading)) {
                hideOverlay(overlay);
                return;
            }

            const mpq = await downloadMpq(overlay);
            setOverlayProgress(overlay, "Starting Diablo...", 100);
            app.start(mpq);

            const timer = window.setInterval(function () {
                if (document.querySelector(".App.started")) {
                    window.clearInterval(timer);
                    hideOverlay(overlay);
                }
            }, 250);

            window.setTimeout(function () {
                window.clearInterval(timer);
                hideOverlay(overlay);
            }, 12000);
        } catch (error) {
            console.error("[PortfoliOS] Diablo autostart failed:", error);
            setOverlayProgress(overlay, "Could not load hosted MPQ. Use manual mode with ?manual=1.", 0);
            overlay.style.pointerEvents = "none";
            window.setTimeout(function () {
                hideOverlay(overlay);
            }, 5000);
        }
    }

    if (document.body) {
        bootRetailDiablo();
    } else if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootRetailDiablo, { once: true });
    } else {
        bootRetailDiablo();
    }
})();
