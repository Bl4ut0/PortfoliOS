<?php
// Match production static-file 404s instead of PHP built-in directory fallback.
$root = realpath(__DIR__ . '/..');
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$file = realpath($root . $path);
if ($file !== false && ($file === $root || str_starts_with($file, $root . DIRECTORY_SEPARATOR))) {
    if (is_file($file) || (is_dir($file) && (is_file($file . '/index.php') || is_file($file . '/index.html')))) {
        return false;
    }
}
http_response_code(404);
header('Content-Type: text/plain');
echo 'Not found';
