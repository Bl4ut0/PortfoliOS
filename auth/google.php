<?php
// Explicit headers also work on hosts that ignore Apache .htaccess rules.
header("Cross-Origin-Opener-Policy: same-origin-allow-popups");
header_remove("Cross-Origin-Embedder-Policy");
header("Cross-Origin-Resource-Policy: same-origin");
header("Content-Type: text/html; charset=UTF-8");
header("Cache-Control: no-store");
header("Referrer-Policy: no-referrer");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: SAMEORIGIN");
readfile(__DIR__ . "/google.html");
?>
