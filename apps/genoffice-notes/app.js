/**
 * GenNotes: AI-Native Markdown & Documentation Editor
 * Live side-by-side preview, syntax markup, notes, and technical briefings with SystemFS.
 */
(function () {
    const APP_ID = "genoffice-notes";

    window.appRegistry[APP_ID] = window.createGenOfficeApp({
        id: APP_ID,
        title: "GenNotes",
        icon: "apps/genoffice-notes/icon.svg",
        windowClass: "genoffice-notes-window app-window",
        defaultMode: "markdown",
        defaultFolder: "/documents/Notes",
        defaultFileName: "Untitled Notes.md",
        allowedTypes: [".md", ".markdown", ".txt"],
        hideTabs: true
    });
})();
