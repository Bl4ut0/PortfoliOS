# WASM expansion roadmap

Updated 2026-10-10. Phases describe evaluation order, not release dates. [The main roadmap](../../ROADMAP.md) retains P0 session/sync reliability ahead of shipping new stateful applications.

## Phase 0: catalog and documentation

Delivered by this documentation change:

- Curated inventory with runtime classifications, existing-code evidence, priorities, and next actions.
- Upstream overview/source/build/API/release/issues/license references.
- Editable JSON and deterministic Markdown/HTML generator with validation.
- Shared integration guide and reusable project worksheet.

No candidate has been installed by this phase. Artifact versions, hashes, and performance reports remain unrecorded until an evaluation actually occurs.

## Phase 1: prove the shared app boundary

Before selecting a production app:

- Choose one disposable PDF/image workflow; prototype its Open/Save adapter through SystemFS and SecurityKernel.
- Define supported formats, quarantine handling, draft storage, selected linked assets, and per-profile recovery.
- Demonstrate private A/B isolation, public reload reset, cancel/close, safe profile switching, and backup/restore across disposable browser contexts.
- Record a browser capability matrix and a reproducible source/artifact manifest.
- Resolve the current Office shell's misleading WASM labeling as its own implementation change; do not treat it as a working LibreOffice engine.
- Trace exact runtime provenance for the existing Doom, Diablo, Duke, and UT99 distributions without altering or redistributing game data.

Acceptance: an adapter prototype has tested save/restore and lifecycle behavior; formats/policies and artifact provenance are documented. Follow the delivery policy for any resulting implementation.

## Phase 2: first useful applications

| Workflow | Candidate | First test | Mobile direction |
| --- | --- | --- | --- |
| PDF organization | PdfCraft | Merge, reorder, split, save, and reopen disposable PDFs. | Native page organizer with touch selection. |
| Image editing | PhotoCraft | Layered sample, meaningful edit, export, reopen with expected layers/pixels. | Evaluate tablet UI; phone crop/resize tools can share an engine. |
| Vector design | VectorCraft and Graphite | Run the same SVG/path/export fixture; select the better fit. | Resolve quarantined SVG policy before claiming file support. |
| Media conversion | FFmpeg.wasm | Short conversion with progress/cancel and output reopen. | Native bounded-job UI; measure device memory first. |
| Scanner/OCR | Tesseract.js | Image recognition, edit extracted text, save/reopen. | Native camera/import screen; PDF rendering is a separate component. |

Acceptance: publish only workflows passing the integration guide's gates, with measured limits and accurate Store labels. Launching an upstream demo alone does not complete a milestone.

## Phase 3: audio, programming, data, CAD, and publishing

- Wavacity for audio editing after validating its actual browser build and save/export path.
- Pyodide for a worker-based Python workspace; JupyterLite if a notebook interface adds value beyond the console.
- SQLite WASM for database inspection; DuckDB-Wasm for local dataset analysis. Preserve transactions and profile-scoped persistence.
- OpenSCAD Playground for a limited CAD workflow with imported-library dependencies and cancellation.
- LightCraft for photo adjustments/library evaluation; DesignCraft for multi-page publishing.

Acceptance: each project includes a concrete user workflow, accurate format limits, measured resource use, and multi-file/profile backup behavior. Prefer shared engines and adapters where practical.

## Phase 4: experimental heavy and preservation projects

- FilmCraft and EffectCraft: start with short projects; assess codecs, OPFS, linked media, cancellation, and memory before broader editing.
- whisper.cpp: small-model transcription with recording permissions, cancellation, and bounded model cache.
- Ruffle and js-dos: vetted content, compatibility-specific input, executable-content policy, and save adapters.
- Godot web exports: original interactive projects with built-in touch input and an explicit save bridge.
- Existing mobile games remain governed by [mobile parity](../MOBILE_APP_PARITY.md), including real-phone tests.

Acceptance: keep experimental labels until production evidence supports specific devices/workflows. Program/content licensing is separate from emulator/engine licensing.

## Evidence to attach to every promotion

Use [PROJECT_TEMPLATE.md](PROJECT_TEMPLATE.md). Move a candidate to an integrated status only with source/build identity, artifact SHA-256, license/asset notices, format tests, account/backup/lifecycle tests, performance measurements, and production verification. Add its real launcher to the applicable Desktop/Mobile Store catalogs in the implementation release.

The catalog generator does not mark these gates complete. When an integration is delivered, update catalog.json, the relevant app documentation, the main roadmap, and the mobile parity map together.
