const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { calculate, chooseOrientation } = require("../mobile/viewport.js");

function environment(overrides = {}) {
    return {
        layoutWidth: 390,
        layoutHeight: 844,
        visibleWidth: 390,
        visibleHeight: 844,
        viewportScale: 1,
        outerWidth: 390,
        screenWidth: 390,
        touchPoints: 5,
        coarse: true,
        hoverNone: true,
        mobileUa: true,
        ipadOs: false,
        orientation: "portrait",
        display: "browser",
        override: null,
        ...overrides
    };
}

function approximately(actual, expected, tolerance = 0.01) {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
}

const phone = calculate(environment());
assert.equal(phone.presentation, "edge");
assert.equal(phone.presentationScale, 1);
assert.equal(phone.naturalWidth, 390);
assert.equal(phone.naturalHeight, 844);
assert.equal(phone.orientation, "portrait");
assert.equal(phone.size, "phone");

const desktopPreview = calculate(environment({
    layoutWidth: 1440,
    layoutHeight: 900,
    visibleWidth: 1440,
    visibleHeight: 900,
    outerWidth: 1440,
    screenWidth: 1440,
    touchPoints: 0,
    coarse: false,
    hoverNone: false,
    mobileUa: false
}));
assert.equal(desktopPreview.presentation, "preview");
assert.equal(desktopPreview.presentationScale, 1);

const androidDesktopViewport = calculate(environment({
    layoutWidth: 980,
    layoutHeight: 2100,
    visibleWidth: 980,
    visibleHeight: 2100,
    outerWidth: 390,
    screenWidth: 390,
    coarse: false,
    hoverNone: false,
    mobileUa: false
}));
assert.equal(androidDesktopViewport.presentation, "edge");
assert.equal(androidDesktopViewport.virtualMobileViewport, true);
approximately(androidDesktopViewport.presentationScale, 980 / 390);
approximately(androidDesktopViewport.naturalWidth, 390);
approximately(androidDesktopViewport.naturalHeight, 2100 / (980 / 390));

const visualScaleFallback = calculate(environment({
    layoutWidth: 980,
    layoutHeight: 2100,
    visibleWidth: 980,
    visibleHeight: 2100,
    viewportScale: 0.4,
    outerWidth: 980,
    screenWidth: 980,
    touchPoints: 0,
    coarse: false,
    hoverNone: false,
    mobileUa: false
}));
assert.equal(visualScaleFallback.virtualMobileViewport, true);
approximately(visualScaleFallback.presentationScale, 2.5);
approximately(visualScaleFallback.naturalWidth, 392);

const forcedPreview = calculate(environment({
    layoutWidth: 980,
    layoutHeight: 2100,
    visibleWidth: 980,
    visibleHeight: 2100,
    outerWidth: 390,
    screenWidth: 390,
    mobileUa: false,
    override: "preview"
}));
assert.equal(forcedPreview.presentation, "preview");
assert.equal(forcedPreview.presentationScale, 1);

const foldablePortrait = calculate(environment({
    layoutWidth: 673,
    layoutHeight: 841,
    visibleWidth: 673,
    visibleHeight: 841,
    outerWidth: 673,
    screenWidth: 673
}));
assert.equal(foldablePortrait.presentation, "edge");
assert.equal(foldablePortrait.orientation, "portrait");
assert.equal(foldablePortrait.size, "expanded");

const foldableLandscape = calculate(environment({
    layoutWidth: 840,
    layoutHeight: 720,
    visibleWidth: 840,
    visibleHeight: 720,
    outerWidth: 840,
    screenWidth: 840,
    orientation: "landscape"
}));
assert.equal(foldableLandscape.presentation, "edge");
assert.equal(foldableLandscape.orientation, "landscape");
assert.equal(foldableLandscape.size, "expanded");

const compactSplitScreen = calculate(environment({
    layoutWidth: 320,
    layoutHeight: 568,
    visibleWidth: 320,
    visibleHeight: 568,
    outerWidth: 720,
    screenWidth: 720
}));
assert.equal(compactSplitScreen.presentation, "edge");
assert.equal(compactSplitScreen.presentationScale, 1);
assert.equal(compactSplitScreen.size, "compact");
assert.equal(compactSplitScreen.height, "compact");

const touchLaptop = calculate(environment({
    layoutWidth: 1366,
    layoutHeight: 768,
    visibleWidth: 1366,
    visibleHeight: 768,
    outerWidth: 1366,
    screenWidth: 1366,
    touchPoints: 10,
    coarse: false,
    hoverNone: false,
    mobileUa: false,
    orientation: "landscape"
}));
assert.equal(touchLaptop.presentation, "preview");

const zoomedTouchLaptop = calculate(environment({
    layoutWidth: 1708,
    layoutHeight: 960,
    visibleWidth: 1708,
    visibleHeight: 960,
    outerWidth: 1366,
    screenWidth: 1366,
    touchPoints: 10,
    coarse: false,
    hoverNone: false,
    mobileUa: false,
    orientation: "landscape"
}));
assert.equal(zoomedTouchLaptop.presentation, "preview");
assert.equal(zoomedTouchLaptop.virtualMobileViewport, false);

const narrowedTouchLaptop = calculate(environment({
    layoutWidth: 1000,
    layoutHeight: 700,
    visibleWidth: 1000,
    visibleHeight: 700,
    outerWidth: 800,
    screenWidth: 1920,
    touchPoints: 10,
    coarse: false,
    hoverNone: false,
    mobileUa: false,
    orientation: "landscape"
}));
assert.equal(narrowedTouchLaptop.presentation, "preview");
assert.equal(narrowedTouchLaptop.virtualMobileViewport, false);

const portraitWindowOnTouchLaptop = calculate(environment({
    layoutWidth: 1000,
    layoutHeight: 1200,
    visibleWidth: 1000,
    visibleHeight: 1200,
    outerWidth: 800,
    screenWidth: 768,
    screenLongEdge: 1366,
    touchPoints: 10,
    coarse: false,
    hoverNone: false,
    mobileUa: false,
    orientation: "portrait"
}));
assert.equal(portraitWindowOnTouchLaptop.presentation, "preview");
assert.equal(portraitWindowOnTouchLaptop.virtualMobileViewport, false);

const virtualLandscapePhone = calculate(environment({
    layoutWidth: 980,
    layoutHeight: 450,
    visibleWidth: 980,
    visibleHeight: 450,
    outerWidth: 844,
    screenWidth: 844,
    mobileUa: false,
    orientation: "landscape"
}));
assert.equal(virtualLandscapePhone.presentation, "edge");
assert.equal(virtualLandscapePhone.virtualMobileViewport, true);
approximately(virtualLandscapePhone.presentationScale, 980 / 844);
approximately(virtualLandscapePhone.naturalWidth, 844);

const keyboardPhone = calculate(environment({
    layoutHeight: 360,
    visibleHeight: 330,
    orientation: "portrait",
    visibleOffsetTop: 24
}));
assert.equal(keyboardPhone.orientation, "portrait");
assert.equal(keyboardPhone.naturalHeight, 330);
assert.equal(keyboardPhone.visibleOffsetTop, 24);

assert.equal(chooseOrientation({
    layoutWidth: 390,
    layoutHeight: 330,
    mobileIdentity: true,
    physicalOrientation: "portrait",
    previousOrientation: "portrait",
    previousWidth: 390
}), "portrait");
assert.equal(chooseOrientation({
    layoutWidth: 520,
    layoutHeight: 800,
    mobileIdentity: true,
    physicalOrientation: "landscape",
    previousOrientation: "landscape",
    previousWidth: 844
}), "portrait");
assert.equal(chooseOrientation({
    layoutWidth: 844,
    layoutHeight: 390,
    mobileIdentity: true,
    physicalOrientation: "landscape",
    previousOrientation: "portrait",
    previousWidth: 390
}), "landscape");

const pinchZoomedPhone = calculate(environment({
    visibleWidth: 195,
    visibleHeight: 422,
    viewportScale: 2,
    visibleOffsetLeft: 40,
    visibleOffsetTop: 120
}));
assert.equal(pinchZoomedPhone.orientation, "portrait");
assert.equal(pinchZoomedPhone.presentationScale, 1);
assert.equal(pinchZoomedPhone.naturalHeight, 844);
assert.equal(pinchZoomedPhone.visibleOffsetLeft, 0);
assert.equal(pinchZoomedPhone.visibleOffsetTop, 0);

const ipadWithTrackpad = calculate(environment({
    layoutWidth: 1024,
    layoutHeight: 1366,
    visibleWidth: 1024,
    visibleHeight: 1366,
    outerWidth: 1024,
    screenWidth: 1024,
    coarse: false,
    hoverNone: false,
    mobileUa: false,
    ipadOs: true
}));
assert.equal(ipadWithTrackpad.presentation, "edge");

const installedWideSurface = calculate(environment({
    layoutWidth: 1024,
    layoutHeight: 1366,
    visibleWidth: 1024,
    visibleHeight: 1366,
    outerWidth: 1024,
    screenWidth: 1024,
    touchPoints: 0,
    coarse: false,
    hoverNone: false,
    mobileUa: false,
    display: "standalone"
}));
assert.equal(installedWideSurface.presentation, "edge");

const mobileShellSource = fs.readFileSync(path.join(__dirname, "..", "mobile", "shell.js"), "utf8");
assert.match(mobileShellSource, /const target = document\.documentElement;/);
assert.doesNotMatch(mobileShellSource, /const target = elements\(\)\.device/);

console.log("Mobile viewport audit passed: browser preview, phones, Android virtual viewports, keyboard and pinch zoom, split screen, foldables, iPadOS, touch laptops, fullscreen, and installed PWA checked.");
