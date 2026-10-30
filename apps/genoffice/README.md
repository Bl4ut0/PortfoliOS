# GenOffice for PortfoliOS

GenOffice is an open-source, AI-native desktop office suite developed by Genspark ([genspark-ai/genoffice](https://github.com/genspark-ai/genoffice)). It natively reads, edits, and saves standard office file formats—including Microsoft Word (`.docx`), Excel (`.xlsx`), PowerPoint (`.pptx`), and PDF—with byte-preserving patch mechanisms and integrated AI Copilot skills.

- **Upstream Repository:** [github.com/genspark-ai/genoffice](https://github.com/genspark-ai/genoffice)
- **License:** Apache-2.0
- **PortfoliOS App ID:** `genoffice`
- **Category:** Productivity / AI Office Suite

## Key Workspaces & Capabilities

1. **Docs (Word Processing):**
   - Native OOXML (`.docx`, `.doc`) and rich text editing.
   - Semantic formatting (headings, lists, blockquotes, tables, alignments).
   - Live word count and character statistics.
   - Byte-preserving patch engine ensuring macros, styles, and document metadata remain intact.

2. **Sheets (Spreadsheets & Models):**
   - Grid calculation engine supporting arithmetic and core formula functions (`=SUM`, `=AVERAGE`, `=MIN`, `=MAX`, `=COUNT`).
   - Formula bar with active coordinate indicator (`fx` bar).
   - Full CSV and XLSX import/export.

3. **Slides (Presentations):**
   - Presentation deck editor with multi-slide thumbnail strip.
   - Editable titles, subtitles, and structured bullet items.
   - Clean presenter mode.

4. **PDF & Markup:**
   - Document viewer with page navigation and annotation highlight overlays.
   - Direct integration with PortfoliOS SecurityKernel scan verification.

5. **Notes & Technical Documentation:**
   - Split-pane Markdown editor with real-time rendered preview.
   - Code block syntax styling, tables, and HTML support.

6. **Contextual AI Copilot & Agent Skills:**
   - In-app Copilot sidebar connected to `window.SimpleBrain` / `window.LocalAI`.
   - One-click prompt chips: "Draft executive summary", "Analyze data trends", "Generate slide outline", "Summarize takeaways".
   - Compatible with the upstream `genoffice` CLI and agent skills for autonomous document generation.

## Supported Formats

- **Documents:** `.docx`, `.doc`, `.odt`, `.rtf`, `.txt`
- **Spreadsheets:** `.xlsx`, `.xls`, `.ods`, `.csv`, `.tsv`
- **Presentations:** `.pptx`, `.ppt`, `.odp`
- **Fixed & Technical Documents:** `.pdf`, `.md`, `.markdown`, `.html`, `.htm`

## PortfoliOS Integration Contract

1. **File Explorer (`apps/files`):**
   - Direct double-click routing for all Office and document files.
   - Specialized document iconography (`fa-file-word`, `fa-file-excel`, `fa-file-powerpoint`, `fa-file-pdf`).
   - Context menu ("Open with GenOffice") on all document formats.
2. **SystemFS & SecurityKernel:**
   - Files save locally to `/documents/GenOffice/` or their existing paths.
   - Every file import and export is scanned through PortfoliOS `SecurityKernel` hash and quarantine checks.
3. **App Store & Shell:**
   - Pinned desktop launcher item in `window.desktopApps` (`modular: true`).
   - Cataloged under Productivity in `window.storeApps`.
   - Clean lifecycle management: prompts on unsaved modifications (`beforeClose`), abort controllers, and background memory cleanup.
