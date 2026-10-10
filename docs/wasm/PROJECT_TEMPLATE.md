# New WASM project worksheet

Copy this worksheet into a project-specific evaluation document when implementation starts. Add the corresponding entry to [catalog.json](catalog.json), regenerate, and link the evidence from the entry. Unknown is an acceptable research state; do not replace unknowns with estimates presented as measurements.

## Identity and user value

- Project/app ID and name:
- Category and runtime classification:
- Specific user workflow:
- Existing app overlap and reason to add:
- Desktop / phone / tablet scope:
- Upstream development status and reviewed date:
- PortfoliOS status and next action:

## Documentation and provenance

| Reference | Exact URL / evidence |
| --- | --- |
| Official project overview | |
| Source repository and commit | |
| Build/hosting instructions and toolchain | |
| API/file/worker/storage integration docs | |
| Download/release and artifact version | |
| Upstream issues/support | |
| Source license | |
| Dependency/font/icon/model/content notices | |
| Known limits and compatibility matrix | |

- Artifact filename and SHA-256:
- Reproducible build command:
- Source-to-binary correspondence:
- Separate commercial/user-provided data:
- Required branding or fork changes:
- Rollback artifact and procedure:

## Browser and resource requirements

- WASM / WebGPU / WebGL / threads / SharedArrayBuffer requirements:
- Browser/OS/device matrix and fallbacks:
- COOP/COEP/CORP/CSP, worker, AudioWorklet, MIME requirements:
- Cold compressed download and installed cache size:
- Cold/warm launch and first useful action:
- Peak memory and main-thread responsiveness:
- Cancellation latency and post-close resource cleanup:
- Sample input, measurement method, and report location:

## Files, execution, and account boundaries

- Accepted inputs, outputs, editable project format, and format fidelity:
- SecurityKernel import/quarantine policy and executable-content flow:
- Selected linked files/fonts/media packaging:
- SystemFS virtual paths and file-picker behavior:
- Engine memory/IndexedDB/OPFS/localStorage recovery behavior:
- Private A/B partitioning and stale-result rejection:
- Public reload reset:
- Shared binaries/models/cache contents and removal:
- Save/close/profile-switch ordering:
- Drive inclusion/exclusion, failure recovery, and second-browser restore:
- Temporary-data deletion and abandoned-job cleanup:

## Presentation and lifecycle

- First-party themes/contrast/keyboard/screen-reader checks:
- Mobile safe area, keyboard, touch/pen, Back/Home/Recents:
- Progress/error/retry/cancel and offline behavior:
- Initialize, resize, minimize/pause, restore/resume, close/dispose:
- Shared audio/volume and focus/pointer release:
- Explicit iframe messaging schema/origin/source validation, if used:

## Acceptance and release

- Workflow fixtures and meaningful expected outputs:
- Account/backup/lifecycle regression evidence:
- Browser/device measurements and supported limits:
- Store availability and experimental labeling:
- Relevant automated check commands/results:
- Commit and pushed branch:
- Production deployment command, URL, asset hashes, and smoke result:
- Remaining limitations, next evaluation, and owner:
