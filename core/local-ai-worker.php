<?php
header("Cross-Origin-Opener-Policy: same-origin");
header("Cross-Origin-Embedder-Policy: require-corp");
header("Cross-Origin-Resource-Policy: same-origin");
header("Permissions-Policy: cross-origin-isolated=(self)");
header("Content-Type: text/javascript; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("Cache-Control: private, max-age=300");
readfile(__DIR__ . "/local-ai-worker.js");
?>
