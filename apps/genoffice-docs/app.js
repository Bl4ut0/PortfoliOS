/**
 * GenDocs: AI-Native Word Processor
 * Document editing for OOXML (.docx), .doc, .txt, and rich documents with SystemFS integration.
 */
(function () {
    const APP_ID = "genoffice-docs";

    window.appRegistry[APP_ID] = window.createGenOfficeApp({
        id: APP_ID,
        title: "GenDocs",
        icon: "apps/genoffice-docs/icon.svg",
        windowClass: "genoffice-docs-window app-window",
        defaultMode: "docs",
        defaultFolder: "/documents/Docs",
        defaultFileName: "Untitled Document.docx",
        allowedTypes: [".docx", ".doc", ".txt", ".html", ".rtf"],
        hideTabs: true
    });
})();
