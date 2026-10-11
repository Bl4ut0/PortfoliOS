<?php
// Only immutable, public upstream artifacts are CORS-readable. No user files.
$types = ['index.html'=>'text/html; charset=utf-8', 'pdfcraft-web-9fbc20856b2df0f8.js'=>'text/javascript', 'pdfcraft-web-9fbc20856b2df0f8_bg.wasm'=>'application/wasm'];
$types['host.html'] = 'text/html; charset=utf-8';
$types['host-bridge.js'] = 'text/javascript';
$name = ltrim($_SERVER['PATH_INFO'] ?? '/index.html', '/');
if (!isset($types[$name])) { http_response_code(404); exit; }
$file = __DIR__. (in_array($name, ['host.html', 'host-bridge.js'], true) ? '/' : '/v0.6.0/').$name;
if (!is_file($file)) { http_response_code(503); exit('PdfCraft runtime is not installed on this server.'); }
header('Content-Type: '.$types[$name]);
header('Access-Control-Allow-Origin: *');
header('Cross-Origin-Embedder-Policy: require-corp');
header('Cross-Origin-Resource-Policy: cross-origin');
header('Cross-Origin-Opener-Policy: same-origin');
header('Cache-Control: '.(in_array($name, ['index.html', 'host.html', 'host-bridge.js'], true) ? 'no-cache' : 'public, max-age=31536000, immutable'));
header('X-Content-Type-Options: nosniff');
header('Content-Length: '.filesize($file));
readfile($file);
