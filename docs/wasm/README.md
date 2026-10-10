# PortfoliOS WASM application library

Reviewed 2026-10-10. This is a curated, expandable inventory, not a claim to list every WebAssembly project or to have installed the candidates.

- [Application catalog](APPLICATIONS.md): priorities, browser readiness, integration notes, mobile direction, and current runtime evidence.
- [Upstream documentation index](DOCUMENTATION.md): overview, source, build/API documentation, releases, issues, and license references for every entry.
- [Integration guide](INTEGRATION.md): file/profile adapters, Drive backup, lifecycle, hosting, performance, and release gates.
- [Expansion roadmap](ROADMAP.md): phases, dependencies, and acceptance criteria.
- [New project worksheet](PROJECT_TEMPLATE.md): evidence to collect before adding or shipping a project.
- [Link audit](LINK_AUDIT.json): dated HTTP results for the unique upstream URLs, including corrected stale references.
- [Machine-readable inventory](catalog.json): editable source for generated catalog pages.
- [Published HTML catalog](index.html): a standalone reading view of the same inventory.

## Maintain the library

Use canonical Git repository URLs for source and cross-project documentation, with exact commit/tag links for release evidence. Use relative links for files in this repository; never publish machine-specific checkout paths.

Edit catalog.json when a project, URL, priority, or assessment changes. Regenerate and validate from the repository root:

```powershell
node scripts/build-wasm-catalog.js
node scripts/build-wasm-catalog.js --check
```

The generator validates metadata, unique IDs, HTTPS URL syntax, documentation categories, local evidence paths, and generated-file freshness. It does not certify third-party software or continuously check remote URLs.

Keep browser-build availability separate from PortfoliOS readiness. A new entry begins as a candidate; an upstream demo does not establish profile isolation, Drive restore, touch input, or close/save behavior here. Collect measurements and exact artifact versions during evaluation.

The runtime catalogs remain in data/apps.js and the independent mobile modules. This research library does not install apps or load third-party engines during shell startup.

## Publishing documentation

The documentation directory is outside the default runtime upload list. Publish its referenced files first and its HTML entry last:

```powershell
node deploy.js --only=docs/wasm/catalog.json,docs/wasm/README.md,docs/wasm/APPLICATIONS.md,docs/wasm/DOCUMENTATION.md,docs/wasm/INTEGRATION.md,docs/wasm/ROADMAP.md,docs/wasm/PROJECT_TEMPLATE.md,docs/wasm/LINK_AUDIT.json,docs/wasm/index.html
```

The self-contained HTML page loads no app engine. For runtime changes, follow [the delivery policy](../../AGENTS.md), [the main roadmap](../../ROADMAP.md), and [the modular app contract](../../MODULAR_APPS.md).

## Classification

- wasm-application: an upstream application with a documented browser/WASM build.
- wasm-engine: a library/toolchain needing a PortfoliOS interface and adapters.
- wasm-runtime: an existing integrated WASM runtime.
- browser-app-with-wasm-kernel: a browser UI whose selected computation kernel uses WASM.
- javascript-webgl / webgpu-runtime: related browser software, explicitly distinct from a WASM application.
- placeholder: a first-party shell whose product label suggests an engine that is not actually integrated.

Statuses describe integration, not quality: candidate, integrated, or shell-only. Priorities describe evaluation order: evaluate-first, evaluate-later, experimental, or maintain. An integrated entry can still have unrecorded artifact provenance or untested mobile behavior.
