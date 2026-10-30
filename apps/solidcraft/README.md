# SolidCraft for PortfoliOS

SolidCraft is an open-source, parametric 3D CAD (Computer-Aided Design) application built entirely in pure Rust, designed for high-performance desktop and WebAssembly (WebGL2/WebGPU) in-browser execution.

- **Upstream Website:** [solidcraft.io](https://solidcraft.io/)
- **Upstream Repository:** [github.com/tangency-labs/solidcraft](https://github.com/tangency-labs/solidcraft)
- **PortfoliOS App ID:** `solidcraft`
- **Category:** Productivity / 3D CAD & Modeling

## Key Features

- **Parametric Feature Timeline:** Full history tree supporting 2D sketches with geometric constraints, dimensional expressions, and 3D operations (extrude, revolve, loft, sweep, fillet, chamfer, shell, linear/circular patterns). Changing any dimension automatically triggers a dynamic model rebuild.
- **Pure Rust Engine:** Compiled to WebAssembly for client-side execution in PortfoliOS without requiring external server compute.
- **Model Context Protocol (MCP) Server:** Native agent integration allowing local AI agents (including PortfoliOS Local AI and CLI) to programmatically query geometry, build sketches, modify feature dimensions, and export models.
- **Interoperability & Formats:**
  - Native models: `.solidcraft`
  - CAD interchange: STEP (`.step`, `.stp`), IGES (`.iges`, `.igs`)
  - 3D manufacturing & mesh: 3MF (`.3mf`), STL (`.stl`), OBJ (`.obj`), glTF/GLB (`.gltf`, `.glb`), DXF (`.dxf`)

## PortfoliOS Integration Contract

1. **File Explorer (`apps/files`):**
   - Direct double-click launch for all CAD and 3D geometry files (`.solidcraft`, `.step`, `.stp`, `.iges`, `.igs`, `.stl`, `.3mf`, `.obj`, `.gltf`, `.glb`, `.dxf`).
   - Context menu "Open with SolidCraft" with custom 3D cube iconography.
2. **SystemFS & SecurityKernel:**
   - Sandboxed iframe execution with strict postMessage protocol.
   - Saves automatically target `/documents/SolidCraft/` with conflict prevention.
   - All imported and exported files pass through `SecurityKernel` scan verification.
3. **App Store & Desktop Shell:**
   - Cataloged under Productivity in `window.storeApps` and `window.desktopApps`.
   - Desktop and Start Menu launcher support with responsive window geometry.
   - Clean lifecycle management: unsaved change verification on close (`beforeClose`), abort controllers, and background memory cleanup.
