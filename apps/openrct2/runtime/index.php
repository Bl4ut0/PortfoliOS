<?php
header("Cross-Origin-Opener-Policy: same-origin");
header("Cross-Origin-Embedder-Policy: require-corp");
header("Cross-Origin-Resource-Policy: same-origin");
header("Permissions-Policy: cross-origin-isolated=(self)");
header("Content-Type: text/html; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("X-Robots-Tag: noindex, nofollow, nosnippet, noarchive");
header("Cache-Control: private, max-age=86400");
readfile(__DIR__ . "/index.html");
