/**
 * GenOffice: AI-Native Office Suite
 * Open-source multi-app office suite for Docs (.docx), Sheets (.xlsx), Slides (.pptx),
 * PDF, Markdown, and HTML with byte-preserving patch engines and integrated AI Copilot.
 * Upstream: https://github.com/genspark-ai/genoffice
 */
(function () {
    const APP_ID = "genoffice";

    window.appRegistry[APP_ID] = window.createGenOfficeApp({
        id: APP_ID,
        title: "GenOffice",
        icon: "apps/genoffice/icon.svg",
        windowClass: "genoffice-window app-window",
        defaultMode: "docs",
        defaultFolder: "/documents",
        defaultFileName: "Untitled Document.docx",
        allowedTypes: [".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".md", ".markdown", ".txt", ".pdf", ".csv", ".tsv", ".html"],
        hideTabs: false
    });
})();
