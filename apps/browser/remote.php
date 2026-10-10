<?php
// The parent remains cross-origin isolated for WASM/AI. Only this credentialless viewer opts out.
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');
header('Cross-Origin-Opener-Policy: same-origin-allow-popups');
header('Cross-Origin-Embedder-Policy: unsafe-none');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline'; connect-src https: wss:; frame-src https://*.hyperbeam.com; img-src 'self' data: https:; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'");
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Remote browser</title><link rel="stylesheet" href="remote.css?v=2026.10.10.4"></head><body><p id="remote-status" role="status">Connecting to your remote browser…</p><main id="remote-container"></main><script type="module" src="remote-viewer.js?v=2026.10.10.4"></script></body></html>
