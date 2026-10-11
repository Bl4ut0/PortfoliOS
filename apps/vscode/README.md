# PortfoliOS Code OSS

Real Code OSS web workbench using the pinned [CodinGame integration](https://github.com/CodinGame/monaco-vscode-api). Install from the Desktop Store; Explorer opens the active profile's Documents folder. File Explorer text documents launch it when installed. The iframe has no same-origin privilege; the parent owns all SystemFS operations and verifies account identity around asynchronous requests. Saves pass through SecurityKernel as bounded inert UTF-8 source.

Build from this repository root:

```sh
node scripts/build-vscode.mjs --install
```

This installs the exact package lock, builds ignored runtime/dist, generates gzip assets and release hashes, and preserves dependency notices. Deployment checks all receipt-listed bytes, including compressed variants. No engine is fetched during boot/login. See [review and limitations](../../docs/ARTCRAFT_REVIEW.md), [browser proof](../../scripts/check-vscode-browser.js), and [VS Code web](https://code.visualstudio.com/docs/remote/vscode-web).

This provider is Documents-only, with a 4 MiB file limit and file-only rename. Desktop native terminals and extensions are not provided. Source files restored from Google Drive remain subject to the existing active-content quarantine policy. Never infer that a successful local editor save proves cloud restore.
