# PortfoliOS WASM application catalog

Reviewed 2026-10-10. 30 entries; 213 documentation references. Generated from [catalog.json](catalog.json); edit the JSON and run node scripts/build-wasm-catalog.js.

[Library home](README.md) | [Documentation index](DOCUMENTATION.md) | [Integration guide](INTEGRATION.md) | [Expansion roadmap](ROADMAP.md)

Candidate means researched, not installed. Upstream browser support is separate from PortfoliOS acceptance. This review did not execute the candidate engines or benchmark them. Null version/hash/measurement fields mean evidence still needs collecting. Related JavaScript/WebGPU apps and the simulated Office shell are labeled explicitly.

## First evaluations

| Project | Category | Runtime classification | Status |
| --- | --- | --- | --- |
| [PhotoCraft](#photocraft) | Image editing | wasm-application | candidate |
| [PdfCraft](#pdfcraft) | Documents | wasm-application | candidate |
| [VectorCraft](#vectorcraft) | Graphics | wasm-application | candidate |
| [Graphite](#graphite) | Graphics | wasm-application | candidate |
| [FFmpeg.wasm](#ffmpeg-wasm) | Media utilities | wasm-engine | candidate |
| [Tesseract.js OCR](#tesseract-js) | Documents | wasm-engine | candidate |

## Later evaluations

| Project | Category | Runtime classification | Status |
| --- | --- | --- | --- |
| [LightCraft](#lightcraft) | Photography | wasm-application | candidate |
| [DesignCraft](#designcraft) | Publishing | wasm-application | candidate |
| [Wavacity](#wavacity) | Audio | wasm-application | candidate |
| [Pyodide](#pyodide) | Development | wasm-engine | candidate |
| [OpenSCAD Playground](#openscad) | CAD | wasm-application | candidate |
| [DuckDB-Wasm](#duckdb-wasm) | Data analysis | wasm-engine | candidate |
| [SQLite WASM](#sqlite-wasm) | Development | wasm-engine | candidate |
| [JupyterLite](#jupyterlite) | Development | browser-app-with-wasm-kernel | candidate |
| [js-dos](#js-dos) | Games and preservation | wasm-engine | candidate |

## Experimental projects

| Project | Category | Runtime classification | Status |
| --- | --- | --- | --- |
| [FilmCraft](#filmcraft) | Video | wasm-application | candidate |
| [EffectCraft](#effectcraft) | Motion graphics | wasm-application | candidate |
| [Ruffle](#ruffle) | Games and preservation | wasm-engine | candidate |
| [whisper.cpp](#whisper-cpp) | Audio and AI | wasm-engine | candidate |
| [Godot Web exports](#godot-web) | Games and creation | wasm-engine | candidate |

## Existing integrations and related browser apps

| Project | Category | Runtime classification | Status |
| --- | --- | --- | --- |
| [Doom](#doomsource) | Existing games | wasm-runtime | integrated |
| [Duke Nukem 3D](#duke32) | Existing games | wasm-runtime | integrated |
| [Diablo](#diablo) | Existing games | wasm-runtime | integrated |
| [OpenRCT2](#openrct2) | Existing games | wasm-runtime | integrated |
| [UT99](#ut99) | Existing games | wasm-runtime | integrated |
| [ROM Player / EmulatorJS](#romplayer) | Existing games | wasm-runtime | integrated |
| [Quake / WebQuake](#quake) | Related browser apps | javascript-webgl | integrated |
| [Office / LibreOffice-labeled shell](#office) | Related browser apps | placeholder | shell-only |
| [Local AI / WebLLM](#local-ai) | Related browser apps | webgpu-runtime | integrated |
| [Webamp](#webamp) | Related browser apps | javascript-webgl | integrated |

## Project notes

<a id="photocraft"></a>

### PhotoCraft

Photoshop-style layers, brushes, image editing, and PSD workflows.

- **Classification:** wasm-application; candidate; evaluate-first.
- **Runtime:** Rust engine and egui UI compiled to WebAssembly; graphics requirements vary by build.
- **Upstream readiness:** Early alpha; upstream explicitly says it is not yet a daily professional Photoshop replacement.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Desktop/tablet evaluation first; phone tools and pen input need separate testing.
- **Files and backup:** Image documents and editable project files; export PNG/JPEG/PSD only after round-trip checks.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Open a layered sample, edit, export, reopen, then test the profile file adapter.
- **License review:** MIT/Apache-2.0 source licensing; review bundled font/asset notices and ArtCraft branding terms before distributing or modifying a build.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://getartcraft.com/apps/photocraft) (overview).
- [Source repository](https://github.com/storytold/photocraft) (source).
- [Build, hosting, or API documentation](https://github.com/storytold/photocraft#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/storytold/photocraft/releases) (releases).
- [Upstream issue tracker](https://github.com/storytold/photocraft/issues) (issues).
- [License and notices entry point](https://github.com/storytold/photocraft#license) (license).
- [Developer and integration documentation directory](https://github.com/storytold/photocraft/tree/main/docs) (documentation).
- [MIT license](https://github.com/storytold/photocraft/blob/main/LICENSE-MIT) (license).
- [Apache-2.0 license](https://github.com/storytold/photocraft/blob/main/LICENSE-APACHE) (license).

<a id="pdfcraft"></a>

### PdfCraft

PDF reading and page organization, combining, splitting, and protection.

- **Classification:** wasm-application; candidate; evaluate-first.
- **Runtime:** Rust engine and egui UI compiled to WebAssembly; graphics requirements vary by build.
- **Upstream readiness:** Early alpha according to the suite overview; validate each PDF workflow independently.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Prioritize a native phone page organizer; test touch selection and small-screen dialogs.
- **Files and backup:** PDF originals, edited outputs, and draft recovery must be profile-scoped.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Validate rotate/reorder/merge/split round trips using disposable documents and add SystemFS Open/Save.
- **License review:** MIT/Apache-2.0 source licensing; review bundled font/asset notices and ArtCraft branding terms before distributing or modifying a build.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://getartcraft.com/apps/pdfcraft) (overview).
- [Source repository](https://github.com/storytold/pdfcraft) (source).
- [Build, hosting, or API documentation](https://github.com/storytold/pdfcraft#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/storytold/pdfcraft/releases) (releases).
- [Upstream issue tracker](https://github.com/storytold/pdfcraft/issues) (issues).
- [License and notices entry point](https://github.com/storytold/pdfcraft#license) (license).
- [Developer and integration documentation directory](https://github.com/storytold/pdfcraft/tree/main/docs) (documentation).
- [MIT license](https://github.com/storytold/pdfcraft/blob/main/LICENSE-MIT) (license).
- [Apache-2.0 license](https://github.com/storytold/pdfcraft/blob/main/LICENSE-APACHE) (license).

<a id="vectorcraft"></a>

### VectorCraft

Vector illustration, paths, SVG artwork, and Illustrator-style workflows.

- **Classification:** wasm-application; candidate; evaluate-first.
- **Runtime:** Rust engine and egui UI compiled to WebAssembly; graphics requirements vary by build.
- **Upstream readiness:** Actively developing; upstream self-assessed feature parity is not PortfoliOS acceptance evidence.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Desktop/tablet first; full phone editing is untested.
- **Files and backup:** Native vector documents, SVG/PDF exports, linked images, and fonts need an explicit file adapter.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Compare a small SVG editing workflow against Graphite before choosing the first vector app.
- **License review:** MIT/Apache-2.0 source licensing; review bundled font/asset notices and ArtCraft branding terms before distributing or modifying a build.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://getartcraft.com/apps/vectorcraft) (overview).
- [Source repository](https://github.com/storytold/vectorcraft) (source).
- [Build, hosting, or API documentation](https://github.com/storytold/vectorcraft#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/storytold/vectorcraft/releases) (releases).
- [Upstream issue tracker](https://github.com/storytold/vectorcraft/issues) (issues).
- [License and notices entry point](https://github.com/storytold/vectorcraft#license) (license).
- [Developer and integration documentation directory](https://github.com/storytold/vectorcraft/tree/main/docs) (documentation).
- [MIT license](https://github.com/storytold/vectorcraft/blob/main/LICENSE-MIT) (license).
- [Apache-2.0 license](https://github.com/storytold/vectorcraft/blob/main/LICENSE-APACHE) (license).

<a id="lightcraft"></a>

### LightCraft

Photo library and RAW development in a local Rust application.

- **Classification:** wasm-application; candidate; evaluate-later.
- **Runtime:** Rust engine and egui UI compiled to WebAssembly; graphics requirements vary by build.
- **Upstream readiness:** In development; browser support is documented, camera-format fidelity still needs evaluation.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Begin with small image adjustments; do not assume large photo catalogs fit phone memory.
- **Files and backup:** RAW originals, adjustment sidecars, catalogs, and thumbnails have different backup needs.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Test representative camera files and decide which catalog data belongs in SystemFS.
- **License review:** MIT/Apache-2.0 source licensing; review bundled font/asset notices and ArtCraft branding terms before distributing or modifying a build.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://getartcraft.com/apps/lightcraft) (overview).
- [Source repository](https://github.com/storytold/lightcraft) (source).
- [Build, hosting, or API documentation](https://github.com/storytold/lightcraft#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/storytold/lightcraft/releases) (releases).
- [Upstream issue tracker](https://github.com/storytold/lightcraft/issues) (issues).
- [License and notices entry point](https://github.com/storytold/lightcraft#license) (license).
- [Developer and integration documentation directory](https://github.com/storytold/lightcraft/tree/main/docs) (documentation).
- [MIT license](https://github.com/storytold/lightcraft/blob/main/LICENSE-MIT) (license).
- [Apache-2.0 license](https://github.com/storytold/lightcraft/blob/main/LICENSE-APACHE) (license).

<a id="designcraft"></a>

### DesignCraft

Page layout and publishing for brochures and other multi-page documents.

- **Classification:** wasm-application; candidate; evaluate-later.
- **Runtime:** Rust engine and egui UI compiled to WebAssembly; graphics requirements vary by build.
- **Upstream readiness:** In development; evaluate layout interchange and font packaging before adoption.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Desktop/tablet authoring first; phone preview/export may be more practical.
- **Files and backup:** Editable layout projects, linked images, fonts, and PDF exports must travel together.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Build a two-page document and reopen it with linked assets after an account restore.
- **License review:** MIT/Apache-2.0 source licensing; review bundled font/asset notices and ArtCraft branding terms before distributing or modifying a build.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://getartcraft.com/apps/designcraft) (overview).
- [Source repository](https://github.com/storytold/designcraft) (source).
- [Build, hosting, or API documentation](https://github.com/storytold/designcraft#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/storytold/designcraft/releases) (releases).
- [Upstream issue tracker](https://github.com/storytold/designcraft/issues) (issues).
- [License and notices entry point](https://github.com/storytold/designcraft#license) (license).
- [Developer and integration documentation directory](https://github.com/storytold/designcraft/tree/main/docs) (documentation).
- [MIT license](https://github.com/storytold/designcraft/blob/main/LICENSE-MIT) (license).
- [Apache-2.0 license](https://github.com/storytold/designcraft/blob/main/LICENSE-APACHE) (license).

<a id="filmcraft"></a>

### FilmCraft

Nonlinear video editing, color, sound, and Premiere-style workflows.

- **Classification:** wasm-application; candidate; experimental.
- **Runtime:** Rust engine and egui UI compiled to WebAssembly; graphics requirements vary by build.
- **Upstream readiness:** In development; the repository and per-app download page list a web build even though the suite overview omits it.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Desktop first; phone import, codec support, heat, and memory need separate measurements.
- **Files and backup:** Project autosave and media use browser storage/OPFS upstream; bridge them explicitly to profile storage and backup selection.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Test a short local clip, save/reload the project, and measure media cache cleanup.
- **License review:** MIT/Apache-2.0 source licensing; review bundled font/asset notices and ArtCraft branding terms before distributing or modifying a build.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://getartcraft.com/apps/filmcraft) (overview).
- [Source repository](https://github.com/storytold/filmcraft) (source).
- [Build, hosting, or API documentation](https://github.com/storytold/filmcraft/blob/main/docs/web.md) (build-api).
- [Releases and downloadable artifacts](https://github.com/storytold/filmcraft/releases) (releases).
- [Upstream issue tracker](https://github.com/storytold/filmcraft/issues) (issues).
- [License and notices entry point](https://github.com/storytold/filmcraft#license) (license).
- [Developer and integration documentation directory](https://github.com/storytold/filmcraft/tree/main/docs) (documentation).
- [MIT license](https://github.com/storytold/filmcraft/blob/main/LICENSE-MIT) (license).
- [Apache-2.0 license](https://github.com/storytold/filmcraft/blob/main/LICENSE-APACHE) (license).

<a id="effectcraft"></a>

### EffectCraft

Motion graphics, visual effects, and compositing.

- **Classification:** wasm-application; candidate; experimental.
- **Runtime:** Rust engine and egui UI compiled to WebAssembly; graphics requirements vary by build.
- **Upstream readiness:** In development; do not equate a listed effect with verified behavior.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Desktop first; phone preview might be feasible after measurement.
- **Files and backup:** Composition files, linked assets, and rendered output require separate persistence decisions.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Test a short composition, import/export, and canceling a render without losing edits.
- **License review:** MIT/Apache-2.0 source licensing; review bundled font/asset notices and ArtCraft branding terms before distributing or modifying a build.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://getartcraft.com/apps/effectcraft) (overview).
- [Source repository](https://github.com/storytold/effectcraft) (source).
- [Build, hosting, or API documentation](https://github.com/storytold/effectcraft#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/storytold/effectcraft/releases) (releases).
- [Upstream issue tracker](https://github.com/storytold/effectcraft/issues) (issues).
- [License and notices entry point](https://github.com/storytold/effectcraft#license) (license).
- [Developer and integration documentation directory](https://github.com/storytold/effectcraft/tree/main/docs) (documentation).
- [MIT license](https://github.com/storytold/effectcraft/blob/main/LICENSE-MIT) (license).
- [Apache-2.0 license](https://github.com/storytold/effectcraft/blob/main/LICENSE-APACHE) (license).

<a id="graphite"></a>

### Graphite

Vector editing and procedural 2D design; compare with VectorCraft to avoid duplicating the first graphics workflow.

- **Classification:** wasm-application; candidate; evaluate-first.
- **Runtime:** Rust/WebAssembly with WebGPU; browser app runs locally.
- **Upstream readiness:** Alpha; current emphasis is procedural vector graphics. Do not advertise future raster/publishing features as delivered.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Professional desktop UI; phone usability is not established.
- **Files and backup:** Editable Graphite documents and exported artwork need profile-scoped Open/Save.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Compare SVG import, basic editing, export, reload, and GPU fallback on the same fixture.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://graphite.art/) (overview).
- [Source repository](https://github.com/GraphiteEditor/Graphite) (source).
- [Build, hosting, or API documentation](https://graphite.art/learn/) (build-api).
- [Releases and downloadable artifacts](https://github.com/GraphiteEditor/Graphite/releases) (releases).
- [Upstream issue tracker](https://github.com/GraphiteEditor/Graphite/issues) (issues).
- [License and notices entry point](https://github.com/GraphiteEditor/Graphite#license) (license).

<a id="wavacity"></a>

### Wavacity

Independent browser port of Audacity for audio editing.

- **Classification:** wasm-application; candidate; evaluate-later.
- **Runtime:** C/C++ audio editor port using Emscripten/WASM and browser audio.
- **Upstream readiness:** Browser port exists; upstream build instructions are sparse and native Audacity features must not be assumed available in this port.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Desktop first; phone recording, touch selection, and audio permissions need testing.
- **Files and backup:** Audio project data, imported clips, and exported audio need explicit save and recovery adapters.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Verify record/import/edit/export in the exact browser build and identify its maintainable build path.
- **License review:** Wavacity identifies GPL v2 licensing; inspect the distributed artifact and its dependencies.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://wavacity.com/) (overview).
- [Source repository](https://github.com/ahilss/wavacity) (source).
- [Build, hosting, or API documentation](https://github.com/ahilss/wavacity#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/ahilss/wavacity/releases) (releases).
- [Upstream issue tracker](https://github.com/ahilss/wavacity/issues) (issues).
- [License and notices entry point](https://github.com/ahilss/wavacity#license) (license).

<a id="ffmpeg-wasm"></a>

### FFmpeg.wasm

Build a native PortfoliOS media converter for short audio/video jobs, audio extraction, and GIF output.

- **Classification:** wasm-engine; candidate; evaluate-first.
- **Runtime:** FFmpeg compiled to WASM with JavaScript worker API; single/multithread variants.
- **Upstream readiness:** Browser engine and API available; this is not a complete editing app.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Use bounded jobs with native touch controls; benchmark single-thread mode on phones.
- **Files and backup:** Import media through SecurityKernel, stage working bytes temporarily, and save output into the current workspace.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured locally. Upstream reports slower execution than native FFmpeg and higher CPU/memory with multithreading. Set conservative job-size limits from measurements.
- **Next action:** Prototype one conversion, progress, cancel, failed-job cleanup, and output reopen.
- **License review:** JavaScript wrapper is MIT; the compiled FFmpeg core/codecs retain their own licenses. Audit the chosen build.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://ffmpegwasm.netlify.app/) (overview).
- [Source repository](https://github.com/ffmpegwasm/ffmpeg.wasm) (source).
- [Build, hosting, or API documentation](https://ffmpegwasm.netlify.app/docs/overview/) (build-api).
- [Releases and downloadable artifacts](https://github.com/ffmpegwasm/ffmpeg.wasm/releases) (releases).
- [Upstream issue tracker](https://github.com/ffmpegwasm/ffmpeg.wasm/issues) (issues).
- [License and notices entry point](https://github.com/ffmpegwasm/ffmpeg.wasm#license) (license).
- [FAQ, limits, and licensing](https://ffmpegwasm.netlify.app/docs/faq/) (documentation).
- [Performance notes](https://ffmpegwasm.netlify.app/docs/performance/) (documentation).

<a id="pyodide"></a>

### Pyodide

Python execution for a code workspace, CLI tools, and local data analysis.

- **Classification:** wasm-engine; candidate; evaluate-later.
- **Runtime:** CPython compiled to WASM; supported packages load separately.
- **Upstream readiness:** Browser Python distribution; native Python packages and operating-system features are not universally supported.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** A native console or script runner is possible; measure startup and avoid blocking the main thread.
- **Files and backup:** Mount only selected profile files into the interpreter; export explicit results through SystemFS.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Run a small script in a dedicated worker, interrupt it, and verify another profile cannot see its files.
- **License review:** Pyodide source is MPL-2.0; CPython and individual Python packages have separate licenses.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://pyodide.org/) (overview).
- [Source repository](https://github.com/pyodide/pyodide) (source).
- [Build, hosting, or API documentation](https://pyodide.org/en/stable/) (build-api).
- [Releases and downloadable artifacts](https://github.com/pyodide/pyodide/releases) (releases).
- [Upstream issue tracker](https://github.com/pyodide/pyodide/issues) (issues).
- [License and notices entry point](https://github.com/pyodide/pyodide#license) (license).
- [Worker execution](https://pyodide.org/en/stable/usage/webworker.html) (documentation).
- [Filesystem integration](https://pyodide.org/en/stable/usage/file-system.html) (documentation).

<a id="openscad"></a>

### OpenSCAD Playground

Script-based CAD and model generation.

- **Classification:** wasm-application; candidate; evaluate-later.
- **Runtime:** Limited OpenSCAD WASM port with a browser editor/viewer.
- **Upstream readiness:** Limited browser port; the full native OpenSCAD GUI is not reproduced.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Responsive upstream layout exists; heavy models and phone editing remain unmeasured.
- **Files and backup:** Keep SCAD source, imported models, libraries, and generated exports in deliberate profile paths.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Render a simple model, reopen source with dependencies, and test cancellation of a complex render.
- **License review:** Playground documentation describes GPL and third-party dependency obligations; review its LICENSE.md for the chosen build.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://openscad.org/) (overview).
- [Source repository](https://github.com/openscad/openscad-playground) (source).
- [Build, hosting, or API documentation](https://github.com/openscad/openscad-playground#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/openscad/openscad-playground/releases) (releases).
- [Upstream issue tracker](https://github.com/openscad/openscad-playground/issues) (issues).
- [License and notices entry point](https://github.com/openscad/openscad-playground#license) (license).
- [Official WASM download and limitations](https://openscad.org/downloads.html) (documentation).
- [Playground and dependency licenses](https://github.com/openscad/openscad-playground/blob/main/LICENSE.md) (license).

<a id="tesseract-js"></a>

### Tesseract.js OCR

Image-to-text extraction for a scanner feature and searchable documents.

- **Classification:** wasm-engine; candidate; evaluate-first.
- **Runtime:** JavaScript worker interface around the Tesseract WASM OCR engine.
- **Upstream readiness:** OCR library, not a complete scanner. It does not directly accept PDFs; render PDF pages with a separate component first.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Good evaluation candidate for a native phone capture/import screen; accuracy and memory still need measurement.
- **Files and backup:** Images, extracted text, and user corrections belong to the selected profile; language data are shared runtime assets.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Recognize a local image with progress/cancel, edit the result, and save/reopen the text.
- **License review:** Apache-2.0 source; retain notices for the OCR engine and language data.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview and demo references](https://github.com/naptha/tesseract.js#readme) (overview).
- [Source repository](https://github.com/naptha/tesseract.js) (source).
- [Build, hosting, or API documentation](https://github.com/naptha/tesseract.js/tree/master/docs) (build-api).
- [Releases and downloadable artifacts](https://github.com/naptha/tesseract.js/releases) (releases).
- [Upstream issue tracker](https://github.com/naptha/tesseract.js/issues) (issues).
- [License and notices entry point](https://github.com/naptha/tesseract.js#license) (license).
- [API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md) (documentation).

<a id="duckdb-wasm"></a>

### DuckDB-Wasm

Local SQL analysis of CSV/Parquet datasets in a future data workspace.

- **Classification:** wasm-engine; candidate; evaluate-later.
- **Runtime:** DuckDB compiled to WASM with a worker-oriented JavaScript client.
- **Upstream readiness:** Browser database engine; requires an app UI and file adapter.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Native query/results UI could work on mobile; dataset size must be measured.
- **Files and backup:** Import selected datasets and persist query scripts/results; isolate any browser database files by profile.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Query a small local CSV, cancel a large query, and verify export/profile switching.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://duckdb.org/) (overview).
- [Source repository](https://github.com/duckdb/duckdb-wasm) (source).
- [Build, hosting, or API documentation](https://duckdb.org/docs/stable/clients/wasm/overview.html) (build-api).
- [Releases and downloadable artifacts](https://github.com/duckdb/duckdb-wasm/releases) (releases).
- [Upstream issue tracker](https://github.com/duckdb/duckdb-wasm/issues) (issues).
- [License and notices entry point](https://github.com/duckdb/duckdb-wasm#license) (license).

<a id="sqlite-wasm"></a>

### SQLite WASM

Database viewer/editor and local application database tooling.

- **Classification:** wasm-engine; candidate; evaluate-later.
- **Runtime:** Official SQLite WebAssembly/JavaScript distribution; persistence mode depends on browser support.
- **Upstream readiness:** Browser/WASM support documented upstream; exact release artifact not yet evaluated in PortfoliOS.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** A small native database viewer is feasible to evaluate; OPFS requirements vary.
- **Files and backup:** Do not let a shared OPFS database bypass profile isolation; bridge/import/export database files deliberately.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Inspect a disposable SQLite file, edit in a transaction, export, and reopen it.
- **License review:** SQLite is public domain; review any added wrapper, UI, or extension separately.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Official WASM documentation index](https://sqlite.org/wasm/doc/trunk/index.md) (overview).
- [Official WASM source repository](https://sqlite.org/wasm/dir) (source).
- [WASM APIs, loading, and storage guides](https://sqlite.org/wasm/doc/trunk/index.md) (build-api).
- [Official downloads](https://sqlite.org/download.html) (releases).
- [SQLite support and forum](https://sqlite.org/support.html) (issues).
- [SQLite copyright and licensing](https://sqlite.org/copyright.html) (license).

<a id="jupyterlite"></a>

### JupyterLite

Notebook workspace for Python experiments and data exploration.

- **Classification:** browser-app-with-wasm-kernel; candidate; evaluate-later.
- **Runtime:** Browser Jupyter UI with optional Pyodide/Xeus WASM kernels; not every kernel is WASM.
- **Upstream readiness:** Browser notebook application; choose and pin a compatible kernel rather than assuming a full Jupyter server.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Desktop/tablet first; phone notebook navigation and memory need testing.
- **Files and backup:** Notebook storage and kernel filesystem are separate surfaces upstream; bridge both to profile-scoped files.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Use one notebook and a local CSV, then verify kernel access, save, restore, and switch.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://jupyterlite.readthedocs.io/en/stable/) (overview).
- [Source repository](https://github.com/jupyterlite/jupyterlite) (source).
- [Build, hosting, or API documentation](https://jupyterlite.readthedocs.io/en/stable/) (build-api).
- [Releases and downloadable artifacts](https://github.com/jupyterlite/jupyterlite/releases) (releases).
- [Upstream issue tracker](https://github.com/jupyterlite/jupyterlite/issues) (issues).
- [License and notices entry point](https://github.com/jupyterlite/jupyterlite#license) (license).
- [Pyodide kernel documentation](https://jupyterlite-pyodide-kernel.readthedocs.io/en/latest/) (documentation).

<a id="ruffle"></a>

### Ruffle

Preserve compatible Flash animations and games in an explicit runtime app.

- **Classification:** wasm-engine; candidate; experimental.
- **Runtime:** Rust emulator compiled to WebAssembly for browser use.
- **Upstream readiness:** Compatibility varies by Flash content; emulation is not universal.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Evaluate per title; mouse/keyboard-based content may need touch mapping.
- **Files and backup:** Treat SWF files as executable content, outside normal document imports; saves need a profile adapter.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Select redistributable test content and verify compatibility, storage, input, and networking.
- **License review:** Review emulator, bundled dependencies, and content redistribution rights independently.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://ruffle.rs/) (overview).
- [Source repository](https://github.com/ruffle-rs/ruffle) (source).
- [Browser integration and self-hosting guide](https://github.com/ruffle-rs/ruffle/wiki/Using-Ruffle#web) (build-api).
- [Releases and downloadable artifacts](https://github.com/ruffle-rs/ruffle/releases) (releases).
- [Upstream issue tracker](https://github.com/ruffle-rs/ruffle/issues) (issues).
- [License and notices entry point](https://github.com/ruffle-rs/ruffle#license) (license).
- [Self-hosting guide](https://github.com/ruffle-rs/ruffle/wiki/Using-Ruffle#web) (documentation).

<a id="js-dos"></a>

### js-dos

General DOS application/game launcher; shares technical ancestry with the existing Duke runtime.

- **Classification:** wasm-engine; candidate; evaluate-later.
- **Runtime:** Browser DOS emulator; runtime/API and licenses depend on selected major version.
- **Upstream readiness:** Browser runtime available; the existing Duke integration loads js-dos 6.22, not necessarily the current API.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Per-program touch layouts are required; native DOS UI is not automatically phone-friendly.
- **Files and backup:** Separate emulator bundles from user saves and imported disks; define supported save export before advertising backup.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Document current Duke 6.22 runtime first, then evaluate a separately pinned modern version.
- **License review:** Review the selected js-dos frontend/core version, associated service terms, and the rights to each DOS program.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [duke32/index.html](../../duke32/index.html).
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://js-dos.com/) (overview).
- [Source repository](https://github.com/caiiiycuk/js-dos) (source).
- [Build, hosting, or API documentation](https://github.com/caiiiycuk/js-dos#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/caiiiycuk/js-dos/releases) (releases).
- [Upstream issue tracker](https://github.com/caiiiycuk/js-dos/issues) (issues).
- [License and notices entry point](https://github.com/caiiiycuk/js-dos#license) (license).

<a id="whisper-cpp"></a>

### whisper.cpp

Local speech-to-text for recordings, notes, and caption workflows.

- **Classification:** wasm-engine; candidate; experimental.
- **Runtime:** C/C++ inference runtime with browser/WebAssembly examples; model files are separate assets.
- **Upstream readiness:** Browser examples exist; these are a starting point for integration, not a ready PortfoliOS transcription app.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Start with a small model and short recordings; benchmark battery, heat, latency, and RAM.
- **Files and backup:** Keep recordings/transcripts per profile; model cache is shared and excluded from document backup.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Evaluate one upstream WASM example with cancellation and transcript export.
- **License review:** Review source license, model license, and converted weight provenance separately.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://github.com/ggml-org/whisper.cpp) (overview).
- [Source repository](https://github.com/ggml-org/whisper.cpp) (source).
- [Build, hosting, or API documentation](https://github.com/ggml-org/whisper.cpp/tree/master/examples) (build-api).
- [Releases and downloadable artifacts](https://github.com/ggml-org/whisper.cpp/releases) (releases).
- [Upstream issue tracker](https://github.com/ggml-org/whisper.cpp/issues) (issues).
- [License and notices entry point](https://github.com/ggml-org/whisper.cpp#license) (license).

<a id="godot-web"></a>

### Godot Web exports

Host original interactive demos and games built with Godot.

- **Classification:** wasm-engine; candidate; experimental.
- **Runtime:** Godot web export uses WebAssembly and WebGL; export/thread constraints depend on engine version.
- **Upstream readiness:** Web-export toolchain; not a claim that the complete native editor is installed here.
- **PortfoliOS readiness:** Not installed or runtime-tested in PortfoliOS.
- **Desktop:** Evaluate a lazy-loaded app or engine adapter.
- **Mobile:** Touch support must be built into each game; test Safari/Chrome and device memory independently.
- **Files and backup:** Game saves need a bridge from the export filesystem to account-scoped SystemFS.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Export an original small project, implement save/restore, and test Home/Recents pause and teardown.
- **License review:** Godot is MIT; include required engine notices and audit project assets/addons.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Reviewed:** 2026-10-10 (upstream-documentation).

**Documentation**

- [Project overview](https://godotengine.org/) (overview).
- [Source repository](https://github.com/godotengine/godot) (source).
- [Build, hosting, or API documentation](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) (build-api).
- [Releases and downloadable artifacts](https://github.com/godotengine/godot/releases) (releases).
- [Upstream issue tracker](https://github.com/godotengine/godot/issues) (issues).
- [License and notices entry point](https://github.com/godotengine/godot#license) (license).

<a id="doomsource"></a>

### Doom

Existing Doom loader with SystemFS save hooks.

- **Classification:** wasm-runtime; integrated; maintain.
- **Runtime:** Emscripten engine loaded by apps/doomsource/app.js; root doom.js/doom.wasm.
- **Upstream readiness:** See linked upstream references and local evidence; exact artifact provenance must be recorded during maintenance.
- **PortfoliOS readiness:** Existing integration found in local code; this catalog review did not re-run or certify the game/runtime.
- **Desktop:** Existing Desktop integration; exact runtime behavior requires its own maintenance checks.
- **Mobile:** Desktop integration; native mobile adaptation remains roadmap work.
- **Files and backup:** Review engine save events and account-scoped restore; WAD/runtime files are excluded from backup.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Record the exact compiled source fork, version/hash, license notices, and mobile acceptance evidence.
- **License review:** Original source repository is context, not proof of the deployed browser fork. Game data ownership and binary license notices need separate records.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [apps/doomsource/app.js](../../apps/doomsource/app.js).
- **Reviewed:** 2026-10-10 (local-code-and-upstream).

**Documentation**

- [Project overview](https://github.com/id-Software/DOOM) (overview).
- [Source repository](https://github.com/id-Software/DOOM) (source).
- [Build, hosting, or API documentation](https://emscripten.org/docs/) (build-api).
- [Releases and downloadable artifacts](https://github.com/id-Software/DOOM/releases) (releases).
- [Upstream issue tracker](https://github.com/id-Software/DOOM/issues) (issues).
- [License and notices entry point](https://github.com/id-Software/DOOM#license) (license).
- [PortfoliOS integration issues](https://github.com/Bl4ut0/PortfoliOS/issues) (issues).

<a id="duke32"></a>

### Duke Nukem 3D

Existing DOS-emulated Duke launcher and save bridge.

- **Classification:** wasm-runtime; integrated; maintain.
- **Runtime:** Local runtime uses js-dos 6.22 / wdosbox; the app ID does not establish an EDuke32 port.
- **Upstream readiness:** See linked upstream references and local evidence; exact artifact provenance must be recorded during maintenance.
- **PortfoliOS readiness:** Existing integration found in local code; this catalog review did not re-run or certify the game/runtime.
- **Desktop:** Existing Desktop integration; exact runtime behavior requires its own maintenance checks.
- **Mobile:** Desktop integration; phone touch/controller mapping is unverified.
- **Files and backup:** Duke emulator filesystem exports are bridged to SystemFS; prove import/export and close-save integrity.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Document the actual DOS emulator bundle and test saved-game round trips before a runtime upgrade.
- **License review:** Check the deployed js-dos 6.22 core/frontend licenses and Duke data distribution rights separately.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [apps/duke32/app.js](../../apps/duke32/app.js), [duke32/index.html](../../duke32/index.html).
- **Reviewed:** 2026-10-10 (local-code-and-upstream).

**Documentation**

- [Project overview](https://js-dos.com/) (overview).
- [Source repository](https://github.com/caiiiycuk/js-dos) (source).
- [Build, hosting, or API documentation](https://github.com/caiiiycuk/js-dos#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/caiiiycuk/js-dos/releases) (releases).
- [Upstream issue tracker](https://github.com/caiiiycuk/js-dos/issues) (issues).
- [License and notices entry point](https://github.com/caiiiycuk/js-dos#license) (license).

<a id="diablo"></a>

### Diablo

Existing Diablo browser runtime with a local save-transfer bridge.

- **Classification:** wasm-runtime; integrated; maintain.
- **Runtime:** Local Diablo*.wasm and MpqCmp*.wasm bundles; exact upstream fork/version not pinned in this inventory.
- **Upstream readiness:** See linked upstream references and local evidence; exact artifact provenance must be recorded during maintenance.
- **PortfoliOS readiness:** Existing integration found in local code; this catalog review did not re-run or certify the game/runtime.
- **Desktop:** Existing Desktop integration; exact runtime behavior requires its own maintenance checks.
- **Mobile:** Desktop integration; touch UI and real-phone memory remain evaluation work.
- **Files and backup:** Current wrapper transfers runtime files into SystemFS; test restore and pending-save races.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Trace the exact distributed binary to its upstream build and validate save export/restore.
- **License review:** Diabloweb is a relevant browser-port reference, not a verified identification of the deployed artifact. Review engine and game-data licenses independently.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [apps/diablo/app.js](../../apps/diablo/app.js), [diablo/index.html](../../diablo/index.html).
- **Reviewed:** 2026-10-10 (local-code-and-upstream).

**Documentation**

- [Project overview](https://github.com/d07RiV/diabloweb) (overview).
- [Source repository](https://github.com/d07RiV/diabloweb) (source).
- [Build, hosting, or API documentation](https://github.com/d07RiV/diabloweb#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/d07RiV/diabloweb/releases) (releases).
- [Upstream issue tracker](https://github.com/d07RiV/diabloweb/issues) (issues).
- [License and notices entry point](https://github.com/d07RiV/diabloweb#license) (license).
- [PortfoliOS integration issues](https://github.com/Bl4ut0/PortfoliOS/issues) (issues).

<a id="openrct2"></a>

### OpenRCT2

Existing staged OpenRCT2 Emscripten runtime.

- **Classification:** wasm-runtime; integrated; maintain.
- **Runtime:** Official Emscripten bootstrap, staged engine/support archives, and locally configured game data.
- **Upstream readiness:** See linked upstream references and local evidence; exact artifact provenance must be recorded during maintenance.
- **PortfoliOS readiness:** Existing integration found in local code; this catalog review did not re-run or certify the game/runtime.
- **Desktop:** Existing Desktop integration; exact runtime behavior requires its own maintenance checks.
- **Mobile:** Desktop integration; performance and touch adaptation need a phone-specific decision.
- **Files and backup:** Wrapper exchanges saved park files with SystemFS; runtime/support/game archives are shared installation assets.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Record matching engine/support artifact versions and validate park saves and memory usage.
- **License review:** Open-source engine licensing does not grant rights to RollerCoaster Tycoon data. Audit staged archives before redistribution.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [apps/openrct2/app.js](../../apps/openrct2/app.js), [apps/openrct2/runtime/README.md](../../apps/openrct2/runtime/README.md).
- **Reviewed:** 2026-10-10 (local-code-and-upstream).

**Documentation**

- [Project overview](https://openrct2.org/) (overview).
- [Source repository](https://github.com/OpenRCT2/OpenRCT2) (source).
- [Build, hosting, or API documentation](https://github.com/OpenRCT2/OpenRCT2/tree/develop/emscripten) (build-api).
- [Releases and downloadable artifacts](https://github.com/OpenRCT2/OpenRCT2/releases) (releases).
- [Upstream issue tracker](https://github.com/OpenRCT2/OpenRCT2/issues) (issues).
- [License and notices entry point](https://github.com/OpenRCT2/OpenRCT2#license) (license).

<a id="ut99"></a>

### UT99

Existing UT99 flyby/practice browser runtime and relay integration work.

- **Classification:** wasm-runtime; integrated; maintain.
- **Runtime:** Proxy/staging entry points reference the icculus UT99 Emscripten distribution.
- **Upstream readiness:** See linked upstream references and local evidence; exact artifact provenance must be recorded during maintenance.
- **PortfoliOS readiness:** Existing integration found in local code; this catalog review did not re-run or certify the game/runtime.
- **Desktop:** Existing Desktop integration; exact runtime behavior requires its own maintenance checks.
- **Mobile:** Desktop-first; full phone play and multiplayer support are not established.
- **Files and backup:** Identify actual runtime save semantics separately from SystemFS export and relay state.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Pin the remote runtime artifact and document source/licensing, save support, and multiplayer limits.
- **License review:** Do not describe UT99 as an open-source application. Source availability, runtime permissions, and commercial game data rights require exact artifact evidence.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [apps/ut99/app.js](../../apps/ut99/app.js), [apps/ut99/runtime/index.php](../../apps/ut99/runtime/index.php), [docs/ut99-oldunreal-bridge.md](../../docs/ut99-oldunreal-bridge.md).
- **Reviewed:** 2026-10-10 (local-code-and-upstream).

**Documentation**

- [Author browser-port distribution](https://www.icculus.org/ut99-emscripten/) (overview).
- [Author distribution; complete source provenance still to establish](https://www.icculus.org/ut99-emscripten/) (source).
- [Emscripten documentation](https://emscripten.org/docs/) (build-api).
- [Author runtime distribution](https://www.icculus.org/ut99-emscripten/) (releases).
- [PortfoliOS integration issues](https://github.com/Bl4ut0/PortfoliOS/issues) (issues).
- [Author distribution; artifact license verification pending](https://www.icculus.org/ut99-emscripten/) (license).

<a id="romplayer"></a>

### ROM Player / EmulatorJS

Existing emulator launcher with native Desktop and Mobile wrappers.

- **Classification:** wasm-runtime; integrated; maintain.
- **Runtime:** EmulatorJS lazy-loads browser cores from its configured CDN.
- **Upstream readiness:** See linked upstream references and local evidence; exact artifact provenance must be recorded during maintenance.
- **PortfoliOS readiness:** Existing integration found in local code; this catalog review did not re-run or certify the game/runtime.
- **Desktop:** Existing Desktop integration; exact runtime behavior requires its own maintenance checks.
- **Mobile:** Native phone launcher and touch controls exist; support and memory vary by core/title.
- **Files and backup:** ROMs/core files are installation resources outside Drive backup; core-native save controls and SystemFS coverage must be documented separately.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Pin each core and test native save/export/resume per supported system.
- **License review:** Frontend, each emulator core, BIOS files, and ROM content have independent licensing/ownership requirements.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [apps/romplayer/app.js](../../apps/romplayer/app.js), [apps/romplayer/runtime.html](../../apps/romplayer/runtime.html), [mobile/apps/romplayer/app.js](../../mobile/apps/romplayer/app.js).
- **Reviewed:** 2026-10-10 (local-code-and-upstream).

**Documentation**

- [Project overview](https://emulatorjs.org/) (overview).
- [Source repository](https://github.com/EmulatorJS/EmulatorJS) (source).
- [Build, hosting, or API documentation](https://emulatorjs.org/docs/) (build-api).
- [Releases and downloadable artifacts](https://github.com/EmulatorJS/EmulatorJS/releases) (releases).
- [Upstream issue tracker](https://github.com/EmulatorJS/EmulatorJS/issues) (issues).
- [License and notices entry point](https://github.com/EmulatorJS/EmulatorJS#license) (license).

<a id="quake"></a>

### Quake / WebQuake

Existing Quake launcher; useful browser app reference alongside WASM games.

- **Classification:** javascript-webgl; integrated; maintain.
- **Runtime:** JavaScript/WebGL WebQuake files, not a WASM port in the current local runtime.
- **Upstream readiness:** See linked upstream references and local evidence; exact artifact provenance must be recorded during maintenance.
- **PortfoliOS readiness:** Existing integration found in local code; this catalog review did not re-run or certify the game/runtime.
- **Desktop:** Existing Desktop integration; exact runtime behavior requires its own maintenance checks.
- **Mobile:** Desktop integration; native phone input and memory testing remain open.
- **Files and backup:** Validate the existing save bridge and account-scoped outputs; PAK data are not user-document backups.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Identify the exact WebQuake fork/version; do not relabel it as WebAssembly.
- **License review:** Original Quake source is contextual; verify the deployed WebQuake fork and commercial data notices.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [apps/quake/app.js](../../apps/quake/app.js), [quake/index.html](../../quake/index.html).
- **Reviewed:** 2026-10-10 (local-code-and-upstream).

**Documentation**

- [Project overview](https://github.com/id-Software/Quake) (overview).
- [Source repository](https://github.com/id-Software/Quake) (source).
- [Build, hosting, or API documentation](https://github.com/id-Software/Quake#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/id-Software/Quake/releases) (releases).
- [Upstream issue tracker](https://github.com/id-Software/Quake/issues) (issues).
- [License and notices entry point](https://github.com/id-Software/Quake#license) (license).
- [PortfoliOS integration issues](https://github.com/Bl4ut0/PortfoliOS/issues) (issues).

<a id="office"></a>

### Office / LibreOffice-labeled shell

Existing local Writer/Calc-style workspace currently labeled LibreOffice WASM.

- **Classification:** placeholder; shell-only; maintain.
- **Runtime:** First-party JavaScript editors with a simulated WASM boot sequence; no real LibreOffice engine is established by the app code.
- **Upstream readiness:** This entry records a local implementation gap; native LibreOffice availability does not establish a supported browser engine.
- **PortfoliOS readiness:** Existing integration found in local code; this catalog review did not re-run or certify the game/runtime.
- **Desktop:** Existing first-party desktop editors; no genuine LibreOffice engine identified.
- **Mobile:** Mobile Documents is a separate native app; full Office parity is not implied.
- **Files and backup:** Current editors use SystemFS; real ODF/OOXML document fidelity needs a genuine engine evaluation.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Correct product labeling in a separate implementation, or evaluate and integrate an actual maintained browser office engine.
- **License review:** No upstream LibreOffice binary was identified in this shell. Review any future engine and its format/font dependencies independently.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [apps/office/app.js](../../apps/office/app.js), [mobile/apps/documents/app.js](../../mobile/apps/documents/app.js).
- **Reviewed:** 2026-10-10 (local-code-and-upstream).

**Documentation**

- [LibreOffice project (reference only)](https://www.libreoffice.org/) (overview).
- [LibreOffice development (not the current app engine)](https://www.libreoffice.org/about-us/source-code/) (source).
- [PortfoliOS modular app documentation](https://github.com/Bl4ut0/PortfoliOS/blob/main/MODULAR_APPS.md) (build-api).
- [LibreOffice downloads (native; not evidence of a web build)](https://www.libreoffice.org/download/download-libreoffice/) (releases).
- [PortfoliOS integration issues](https://github.com/Bl4ut0/PortfoliOS/issues) (issues).
- [LibreOffice license policy (reference only)](https://www.libreoffice.org/about-us/licenses/) (license).

<a id="local-ai"></a>

### Local AI / WebLLM

Existing local AI worker and model-selection integration.

- **Classification:** webgpu-runtime; integrated; maintain.
- **Runtime:** WebLLM primarily performs inference through WebGPU; WASM support components do not make it a general WASM application.
- **Upstream readiness:** See linked upstream references and local evidence; exact artifact provenance must be recorded during maintenance.
- **PortfoliOS readiness:** Existing integration found in local code; this catalog review did not re-run or certify the game/runtime.
- **Desktop:** Existing Desktop integration; exact runtime behavior requires its own maintenance checks.
- **Mobile:** Native Lobe interface exists; GPU/model support and memory depend on device.
- **Files and backup:** Chats/profile preferences are user data; model weights and compiled runtime caches are shared resources.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Record model/runtime pins, measured memory, worker shutdown, and authenticated-session context.
- **License review:** Inspect WebLLM, compiled model libraries, and each model's weights/license separately.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [core/local-ai.js](../../core/local-ai.js), [mobile/apps/local-ai/app.js](../../mobile/apps/local-ai/app.js).
- **Reviewed:** 2026-10-10 (local-code-and-upstream).

**Documentation**

- [Project overview](https://webllm.mlc.ai/) (overview).
- [Source repository](https://github.com/mlc-ai/web-llm) (source).
- [Build, hosting, or API documentation](https://webllm.mlc.ai/docs/) (build-api).
- [Releases and downloadable artifacts](https://github.com/mlc-ai/web-llm/releases) (releases).
- [Upstream issue tracker](https://github.com/mlc-ai/web-llm/issues) (issues).
- [License and notices entry point](https://github.com/mlc-ai/web-llm#license) (license).

<a id="webamp"></a>

### Webamp

Existing classic media player; retained as an adjacent browser app reference.

- **Classification:** javascript-webgl; integrated; maintain.
- **Runtime:** HTML/JavaScript media player; not classified as a WASM application.
- **Upstream readiness:** See linked upstream references and local evidence; exact artifact provenance must be recorded during maintenance.
- **PortfoliOS readiness:** Existing integration found in local code; this catalog review did not re-run or certify the game/runtime.
- **Desktop:** Existing Desktop integration; exact runtime behavior requires its own maintenance checks.
- **Mobile:** Desktop integration; native Music app covers the main phone playback workflow.
- **Files and backup:** Track playlists and imported audio deliberately; runtime/skin caches are separate from profile documents.
- **Lifecycle:** Cancel pending work on close; flush writes before profile switch; pause or stop background work according to app purpose.
- **Performance evidence:** Unmeasured. Record compressed download, cold/warm launch, peak memory, first useful action, and cleanup on representative devices.
- **Next action:** Keep its runtime classification accurate and verify playlist/profile persistence when adapting it.
- **License review:** Review player/visualizer/skin dependencies separately; do not infer rights to music or skins.
- **Artifact evidence:** version unrecorded; SHA-256 unrecorded; measurement report unrecorded.
- **Local evidence:** [apps/webamp/app.js](../../apps/webamp/app.js).
- **Reviewed:** 2026-10-10 (local-code-and-upstream).

**Documentation**

- [Project overview](https://webamp.org/) (overview).
- [Source repository](https://github.com/captbaritone/webamp) (source).
- [Build, hosting, or API documentation](https://github.com/captbaritone/webamp#readme) (build-api).
- [Releases and downloadable artifacts](https://github.com/captbaritone/webamp/releases) (releases).
- [Upstream issue tracker](https://github.com/captbaritone/webamp/issues) (issues).
- [License and notices entry point](https://github.com/captbaritone/webamp#license) (license).

