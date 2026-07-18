/**
 * PortfoliOS Mobile viewport presentation.
 *
 * Keeps the desktop handset preview separate from a physical mobile surface.
 * Some Android browsers expose a ~980px desktop layout viewport even on a
 * phone. In that case the shell is rendered at the device's natural width and
 * scaled back across the virtual viewport so controls retain their physical
 * size instead of becoming a tiny phone inside the page.
 */
(function() {
    "use strict";

    function positiveNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : fallback;
    }

    function normalizeOverride(value) {
        const normalized = String(value || "").trim().toLowerCase();
        if (["edge", "device", "native"].includes(normalized)) return "edge";
        if (["preview", "frame", "desktop"].includes(normalized)) return "preview";
        return null;
    }

    function chooseOrientation(input = {}) {
        const layoutWidth = positiveNumber(input.layoutWidth, 1);
        const layoutHeight = positiveNumber(input.layoutHeight, 1);
        const viewportOrientation = layoutWidth > layoutHeight ? "landscape" : "portrait";
        if (input.mobileIdentity !== true) return viewportOrientation;

        const previousOrientation = String(input.previousOrientation || "").toLowerCase();
        const previousWidth = positiveNumber(input.previousWidth, 0);
        if ((previousOrientation === "portrait" || previousOrientation === "landscape")
            && previousWidth > 0
            && Math.abs(layoutWidth - previousWidth) <= 2) {
            // Keyboard and browser-chrome height changes keep the prior
            // orientation. Width changes (including split-screen/fold changes)
            // deliberately follow the live window aspect instead.
            return previousOrientation;
        }

        const physicalOrientation = String(input.physicalOrientation || "").toLowerCase();
        if (!previousOrientation
            && viewportOrientation === "landscape"
            && physicalOrientation === "portrait") {
            // Covers a page whose keyboard is already open on first paint.
            return "portrait";
        }
        return viewportOrientation;
    }

    function calculate(input = {}) {
        const layoutWidth = positiveNumber(input.layoutWidth, 1);
        const layoutHeight = positiveNumber(input.layoutHeight, 1);
        const visibleWidth = positiveNumber(input.visibleWidth, layoutWidth);
        const visibleHeight = positiveNumber(input.visibleHeight, layoutHeight);
        const outerWidth = positiveNumber(input.outerWidth, layoutWidth);
        const screenWidth = positiveNumber(input.screenWidth, layoutWidth);
        const screenLongEdge = positiveNumber(input.screenLongEdge, screenWidth);
        const naturalWidth = Math.max(1, Math.min(layoutWidth, outerWidth, screenWidth));
        const viewportScale = positiveNumber(input.viewportScale, 1);
        const geometryRatio = layoutWidth / naturalWidth;
        const visualScaleRatio = viewportScale < 0.85 ? 1 / viewportScale : 1;
        const virtualRatio = Math.max(geometryRatio, visualScaleRatio);
        const geometryDifference = layoutWidth - naturalWidth;
        const touchPoints = Math.max(0, Number(input.touchPoints) || 0);
        const display = input.display || "browser";
        const installed = display !== "browser";
        const compactPhysicalSurface = screenLongEdge <= 1024;
        // A virtual mobile viewport is only plausible while the physical
        // surface is tablet-sized or smaller. This avoids treating a zoomed
        // touch laptop as a phone, while still covering landscape phones whose
        // 980px layout viewport is only modestly wider than the display.
        const geometryLooksVirtual = naturalWidth <= 1024
            && geometryDifference >= 72
            && geometryRatio >= 1.08;
        const visualLooksVirtual = naturalWidth <= 1024 && visualScaleRatio >= 1.08;
        const virtualMobileViewport = (input.mobileUa === true
            || input.ipadOs === true
            || (touchPoints > 0 && compactPhysicalSurface)
            || (installed && compactPhysicalSurface)
            || visualLooksVirtual)
            && (geometryLooksVirtual || visualLooksVirtual);
        const touchSurface = touchPoints > 0
            && input.coarse === true
            && input.hoverNone === true
            && naturalWidth <= 1400
            && screenWidth <= 1400;
        const override = normalizeOverride(input.override);
        const presentation = override || (
            installed
            || input.mobileUa === true
            || input.ipadOs === true
            || virtualMobileViewport
            || touchSurface
                ? "edge"
                : "preview"
        );
        const presentationScale = presentation === "edge" && virtualMobileViewport
            ? virtualRatio
            : 1;
        // Width follows the layout viewport so classic scroll-bar gutters do
        // not leave a strip beside the edge-to-edge shell. Height follows the
        // visual viewport only while it is not pinch-zoomed; this lets browser
        // chrome and the on-screen keyboard resize the shell without making
        // browser zoom reflow the mobile UI.
        const logicalWidth = Math.max(1, layoutWidth / presentationScale);
        const visibleWidthCoverage = visibleWidth / layoutWidth;
        const visualViewportIsUnzoomed = visibleWidthCoverage >= 0.92 && visibleWidthCoverage <= 1.08;
        const usableHeight = visualViewportIsUnzoomed ? visibleHeight : layoutHeight;
        const logicalHeight = Math.max(1, usableHeight / presentationScale);
        const requestedOrientation = String(input.orientation || "").toLowerCase();
        const orientation = requestedOrientation === "portrait" || requestedOrientation === "landscape"
            ? requestedOrientation
            : logicalWidth > (layoutHeight / presentationScale) ? "landscape" : "portrait";
        const size = logicalWidth <= 360 ? "compact" : logicalWidth >= 600 ? "expanded" : "phone";
        const height = logicalHeight <= 690 ? "compact" : logicalHeight >= 900 ? "tall" : "regular";
        const visibleOffsetLeft = visualViewportIsUnzoomed
            ? Math.max(0, Number(input.visibleOffsetLeft) || 0)
            : 0;
        const visibleOffsetTop = visualViewportIsUnzoomed
            ? Math.max(0, Number(input.visibleOffsetTop) || 0)
            : 0;

        return {
            display,
            presentation,
            presentationScale,
            virtualMobileViewport,
            layoutWidth,
            layoutHeight,
            visibleWidth,
            visibleHeight,
            visibleOffsetLeft,
            visibleOffsetTop,
            naturalWidth: logicalWidth,
            naturalHeight: logicalHeight,
            orientation,
            size,
            height
        };
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = { calculate, chooseOrientation };
    }
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.MobileViewport?.version) {
        window.MobileViewport.sync?.();
        return;
    }

    const VERSION = "1.1.13";
    const root = document.documentElement;
    const displayQueries = {
        fullscreen: window.matchMedia?.("(display-mode: fullscreen)"),
        standalone: window.matchMedia?.("(display-mode: standalone)"),
        minimalUi: window.matchMedia?.("(display-mode: minimal-ui)")
    };
    let scheduledFrame = 0;
    let metrics = null;
    let lastOrientation = null;
    let lastLayoutWidth = 0;

    function currentDisplayMode() {
        if (document.fullscreenElement || displayQueries.fullscreen?.matches) return "fullscreen";
        if (displayQueries.standalone?.matches || navigator.standalone === true) return "standalone";
        if (displayQueries.minimalUi?.matches) return "minimal-ui";
        return "browser";
    }

    function physicalOrientation() {
        const screenType = String(window.screen?.orientation?.type || "").toLowerCase();
        if (screenType.startsWith("portrait")) return "portrait";
        if (screenType.startsWith("landscape")) return "landscape";

        const legacyValue = window.orientation;
        const legacyOrientation = Number(legacyValue);
        if (legacyValue !== undefined && legacyValue !== null && Number.isFinite(legacyOrientation)) {
            return Math.abs(legacyOrientation) === 90 ? "landscape" : "portrait";
        }
        return null;
    }

    function currentOrientation(layoutWidth, layoutHeight, mobileIdentity) {
        return chooseOrientation({
            layoutWidth,
            layoutHeight,
            mobileIdentity,
            physicalOrientation: physicalOrientation(),
            previousOrientation: lastOrientation,
            previousWidth: lastLayoutWidth
        });
    }

    function orientedScreenWidth(layoutWidth, orientation) {
        const width = positiveNumber(window.screen?.width, layoutWidth);
        const height = positiveNumber(window.screen?.height, width);
        return orientation === "landscape" ? Math.max(width, height) : Math.min(width, height);
    }

    function collect() {
        const visualViewport = window.visualViewport;
        const layoutWidth = Math.max(
            1,
            positiveNumber(root.clientWidth, 1),
            positiveNumber(window.innerWidth, 1)
        );
        const layoutHeight = Math.max(
            1,
            positiveNumber(root.clientHeight, 1),
            positiveNumber(window.innerHeight, 1)
        );
        const params = new URLSearchParams(window.location.search);
        const userAgent = navigator.userAgent || "";
        const touchPoints = navigator.maxTouchPoints || 0;
        const coarse = window.matchMedia?.("(pointer: coarse)")?.matches === true;
        const hoverNone = window.matchMedia?.("(hover: none)")?.matches === true;
        const ipadOs = touchPoints > 1
            && (/Macintosh/i.test(userAgent) || /MacIntel/i.test(navigator.platform || ""));
        const mobileUa = navigator.userAgentData?.mobile === true
            || /Android|iPhone|iPad|iPod|IEMobile|Mobile/i.test(userAgent);
        const mobileIdentity = mobileUa || ipadOs || (touchPoints > 0 && coarse);
        const orientation = currentOrientation(layoutWidth, layoutHeight, mobileIdentity);
        lastOrientation = orientation;
        lastLayoutWidth = layoutWidth;

        return {
            layoutWidth,
            layoutHeight,
            visibleWidth: positiveNumber(visualViewport?.width, window.innerWidth || layoutWidth),
            visibleHeight: positiveNumber(visualViewport?.height, window.innerHeight || layoutHeight),
            visibleOffsetLeft: Math.max(0, Number(visualViewport?.offsetLeft) || 0),
            visibleOffsetTop: Math.max(0, Number(visualViewport?.offsetTop) || 0),
            viewportScale: positiveNumber(visualViewport?.scale, 1),
            outerWidth: positiveNumber(window.outerWidth, layoutWidth),
            screenWidth: orientedScreenWidth(layoutWidth, orientation),
            screenLongEdge: Math.max(
                positiveNumber(window.screen?.width, layoutWidth),
                positiveNumber(window.screen?.height, layoutWidth)
            ),
            touchPoints,
            coarse,
            hoverNone,
            mobileUa,
            ipadOs,
            orientation,
            display: currentDisplayMode(),
            override: params.get("mobilePresentation")
        };
    }

    function setCssNumber(name, value) {
        root.style.setProperty(name, `${Math.round(value * 1000) / 1000}px`);
    }

    function sync() {
        const next = calculate(collect());
        const previousSignature = metrics ? JSON.stringify(metrics) : "";
        metrics = next;

        root.dataset.mobilePresentation = next.presentation;
        root.dataset.mobileDisplay = next.display;
        root.dataset.mobileViewport = next.virtualMobileViewport ? "virtual" : "native";
        root.dataset.mobileOrientation = next.orientation;
        root.dataset.mobileSize = next.size;
        root.dataset.mobileHeight = next.height;
        root.style.setProperty("--mobile-presentation-scale", String(next.presentationScale));
        setCssNumber("--mobile-natural-width", next.naturalWidth);
        setCssNumber("--mobile-natural-height", next.naturalHeight);
        setCssNumber("--mobile-visible-width", next.visibleWidth);
        setCssNumber("--mobile-visible-height", next.visibleHeight);
        setCssNumber("--mobile-visual-offset-left", next.visibleOffsetLeft);
        setCssNumber("--mobile-visual-offset-top", next.visibleOffsetTop);

        if (JSON.stringify(next) !== previousSignature) {
            window.dispatchEvent(new CustomEvent("mobileviewportchange", { detail: { ...next } }));
        }
        return { ...next };
    }

    function schedule() {
        if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
        scheduledFrame = requestAnimationFrame(() => {
            scheduledFrame = 0;
            sync();
        });
    }

    window.MobileViewport = Object.freeze({
        version: VERSION,
        calculate,
        sync,
        schedule,
        getMetrics: () => metrics ? { ...metrics } : sync(),
        normalizeDistance: (value) => Number(value) / Math.max(1, metrics?.presentationScale || 1)
    });

    sync();
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", () => {
        lastOrientation = null;
        lastLayoutWidth = 0;
        schedule();
        window.setTimeout(schedule, 160);
    }, { passive: true });
    window.addEventListener("pageshow", schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("scroll", schedule, { passive: true });
    Object.values(displayQueries).forEach((query) => query?.addEventListener?.("change", schedule));
    document.addEventListener("fullscreenchange", schedule);
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
})();
