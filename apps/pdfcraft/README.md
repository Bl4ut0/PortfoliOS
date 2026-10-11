# PdfCraft Desktop integration

The Store installs a lightweight PortfoliOS adapter. Opening it loads the official, unmodified [PdfCraft v0.6.0](https://github.com/storytold/pdfcraft/releases/tag/v0.6.0) WASM editor. [release.json](release.json) pins its source commit, release ZIP SHA-256 and every imported artifact. Restore ignored artifacts before deploying from a fresh checkout:

```powershell
python scripts/import-pdfcraft.py
```

The importer verifies the archive and all files before writing; it extracts only receipt-listed names. Generated runtime artifacts remain outside Git. Deploy `apps/pdfcraft` including its restored runtime and nested Apache headers; the PHP gateway permits only three exact upstream editor filenames and two first-party host adapter filenames. The source corresponding to this build is [commit 53a5880](https://github.com/storytold/pdfcraft/tree/53a5880386789fc3531e54f6e6ffdef9a8e41f1a). Source maintenance stays upstream; the adapter preserves all upstream artifacts byte-for-byte. Its separate host entry document loads the official glue/WASM and adapts browser file-input requests to OS events; it does not edit upstream engine source or branding.

## Supported workflow

Install PdfCraft from the Desktop Store. The editor fills the application window with no permanent wrapper toolbar or workspace selector. Its own Open action opens an OS file dialog listing PDFs in the active profile, with device import and Cancel. The profile comes from the loaded OS session, never an in-app account selection. Double-click a PDF in File Explorer to launch the installed editor directly. Files up to 64 MiB pass through SecurityKernel. Use the editor's Save command (Ctrl+S) to write the result to SystemFS. Save As creates a new workspace copy. Existing opened files retain their paths; names are sanitized and duplicate tab names disambiguated. Inspect saved files in File Explorer. Private outputs participate in the existing Drive policy; this integration does not create or retain Google credentials. Public workspace files and installation flags reset on reload.

The iframe has `allow-scripts allow-downloads`, with no same-origin privilege. It cannot access OS IndexedDB, localStorage, accounts or the parent document. Messages require the owned frame's WindowProxy, opaque origin, recognized type and bounded payload. Selected PDF bytes cross the bridge; credentials and filesystem access do not. Same-origin public assets have narrowly scoped CORS headers so the opaque frame can initialize. Engine-local preferences/recovery are ephemeral; durable content comes from SystemFS Save.

Dirty edits, pending writes and failed exports prevent closing or switching profiles. An explicit switch to public first requests native Save and waits for scanned durable output; failure preserves the private workspace. Save failures retain per-document output bytes and offer Retry save. The host does not claim durability merely because upstream posted Save; success appears after the scanned SystemFS write. Beforeunload requests the browser's standard unsaved-work prompt. Closing tears down the iframe, timers and listeners. A 90-second startup deadline permits close/reopen retry.

## Evidence and limits

[Browser check](../../scripts/check-pdfcraft-browser.js) uses the real WASM and an original generated PDF: Store installation, no engine at boot, native Open/cancel/import and File Explorer launch, persistent page rotation, dirty-close/profile-switch vetoes, Ctrl+S, scanned output, teardown/reopen, spoof rejection, private A/B isolation and public reset. Existing Drive/session, app and security suites are also required. These checks do not certify every upstream tool, encrypted PDFs, OCR quality, all file formats, physical phones or live Drive round trips.

Desktop first. Mobile Store lists Desktop availability; the phone experience retains its native Documents app. A native touch organizer remains future work. The official engine has its own appearance controls; OS themes style contextual file/error dialogs. Runtime is about 40.6 MB WASM plus 163 KB glue, downloaded on first launch; it is not added to boot precache or Drive backups. Ordinary HTTP caching can reuse immutable engine assets; offline installation and portable engine recovery are not yet promised.

The wider suite is covered by the [2026-10-11 integration review](../../docs/ARTCRAFT_REVIEW.md); its evidence differs by application.

## Notices

The official source uses MIT/Apache-2.0; fonts and branding have separate terms. Preserved [notices](licenses/NOTICE) and [licenses](licenses/) accompany the unmodified engine. ArtCraft marks identify upstream PdfCraft; PortfoliOS uses the licensed upstream application icon and does not claim endorsement. Derived engine forks require a new branding review rather than silently editing this release.
