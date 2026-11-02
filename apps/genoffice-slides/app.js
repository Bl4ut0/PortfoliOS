/**
 * GenSlides: AI-Native Presentation Studio
 * Deck building, templates, presenter preview, and OOXML (.pptx) editing with SystemFS.
 */
(function () {
    const APP_ID = "genoffice-slides";

    window.appRegistry[APP_ID] = window.createGenOfficeApp({
        id: APP_ID,
        title: "GenSlides",
        icon: "apps/genoffice-slides/icon.svg",
        windowClass: "genoffice-slides-window app-window",
        defaultMode: "slides",
        defaultFolder: "/documents/Slides",
        defaultFileName: "Untitled Presentation.pptx",
        allowedTypes: [".pptx", ".ppt", ".odp"],
        hideTabs: true
    });
})();
