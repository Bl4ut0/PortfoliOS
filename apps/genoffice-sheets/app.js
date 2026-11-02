/**
 * GenSheets: AI-Native Spreadsheet Studio
 * Fast grid calculations, built-in formulas, CSV/TSV, and OOXML (.xlsx) editing with SystemFS.
 */
(function () {
    const APP_ID = "genoffice-sheets";

    window.appRegistry[APP_ID] = window.createGenOfficeApp({
        id: APP_ID,
        title: "GenSheets",
        icon: "apps/genoffice-sheets/icon.svg",
        windowClass: "genoffice-sheets-window app-window",
        defaultMode: "sheets",
        defaultFolder: "/documents/Sheets",
        defaultFileName: "Untitled Sheet.xlsx",
        allowedTypes: [".xlsx", ".xls", ".csv", ".tsv", ".ods"],
        hideTabs: true
    });
})();
