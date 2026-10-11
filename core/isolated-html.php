<?php
// Fixed callers supply the HTML file. No request input is used as a filesystem path.
function serve_isolated_html(string $file): void {
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-store');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Cross-Origin-Embedder-Policy: require-corp');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('Permissions-Policy: cross-origin-isolated=(self)');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: base-uri 'self'; object-src 'none'; frame-ancestors 'self'");
    readfile($file);
}
