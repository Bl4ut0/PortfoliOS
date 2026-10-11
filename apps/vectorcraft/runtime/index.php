<?php
// Exact public release assets only; never OS files or user documents.
$types = ['vectorcraft-web-243cdb1020baca4_bg.wasm' => 'application/wasm','index.html' => 'text/html; charset=utf-8','vectorcraft-web-243cdb1020baca4.js' => 'text/javascript'];
$name = ltrim($_SERVER['PATH_INFO'] ?? '/host.html', '/');
$local = in_array($name, ['host.html', 'host-bridge.js', 'session-storage.js'], true);
if (!$local && !isset($types[$name])) { http_response_code(404); exit; }
$file = $name === 'session-storage.js' ? dirname(__DIR__, 2).'/_shared/session-storage.js' : ($name === 'host-bridge.js' ? dirname(__DIR__, 2).'/_shared/craft-host.js' : ($local ? __DIR__.'/'.$name : __DIR__.'/v0.9.0/'.$name));
if (!is_file($file)) { http_response_code(503); exit('Runtime is not installed on this server.'); }
header('Content-Type: '.(in_array($name, ['host-bridge.js','session-storage.js'], true) ? 'text/javascript' : ($local ? 'text/html; charset=utf-8' : $types[$name])));
header('Access-Control-Allow-Origin: *');
header('Cross-Origin-Embedder-Policy: require-corp');
header('Cross-Origin-Resource-Policy: cross-origin');
header('Cross-Origin-Opener-Policy: same-origin');
header_remove('X-Frame-Options');
header('Cache-Control: '.(!$local && preg_match('/-[a-f0-9]{12,}(_bg)?\.(js|wasm)$/', $name) ? 'public, max-age=31536000, immutable' : 'no-cache'));
header('X-Content-Type-Options: nosniff');
header('Vary: Accept-Encoding');
$accept = $_SERVER['HTTP_ACCEPT_ENCODING'] ?? '';
foreach (['br', 'gzip'] as $encoding) {
    $suffix = $encoding === 'br' ? '.br' : '.gz';
    if (!$local && strpos($accept, $encoding) !== false && is_file($file.$suffix)) { $file .= $suffix; header('Content-Encoding: '.$encoding); break; }
}
header('Content-Length: '.filesize($file));
readfile($file);
