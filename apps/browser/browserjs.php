<?php
// Only the trusted browser chrome opts out; visited sites stay on isolated *.puter.zone origins.
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');
header('Cross-Origin-Opener-Policy: same-origin-allow-popups');
header('Cross-Origin-Embedder-Policy: unsafe-none');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss: data:; frame-src https://*.puter.zone; worker-src 'self' blob:; img-src 'self' data: blob: https:; font-src 'self' data:; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'");
$entry = file_get_contents(__DIR__ . '/browserjs/index.html');
echo str_replace('href="/icon.png"', 'href="/apps/browser/browserjs/icon.png"', $entry);
