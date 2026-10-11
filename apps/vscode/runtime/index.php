<?php
$name=ltrim($_SERVER['PATH_INFO'] ?? '/index.html','/');
$receipt=json_decode(file_get_contents(dirname(__DIR__).'/release.json'),true);
$shared=$name==='session-storage.js';
if(!$shared && !isset($receipt['files'][$name])){http_response_code(404);exit;}
$file=$shared?dirname(__DIR__,2).'/_shared/session-storage.js':__DIR__.'/dist/'.$name;
if(!is_file($file)){http_response_code(503);exit('Code OSS runtime is not installed.');}
$types=['html'=>'text/html; charset=utf-8','js'=>'text/javascript','css'=>'text/css','json'=>'application/json','wasm'=>'application/wasm','ttf'=>'font/ttf','svg'=>'image/svg+xml','png'=>'image/png'];
header('Content-Type: '.($types[pathinfo($name,PATHINFO_EXTENSION)]??'application/octet-stream'));
header('Access-Control-Allow-Origin: *');header('Cross-Origin-Resource-Policy: cross-origin');header('Cross-Origin-Embedder-Policy: require-corp');header('Cross-Origin-Opener-Policy: same-origin');header_remove('X-Frame-Options');header('X-Content-Type-Options: nosniff');header('Cache-Control: '.(!$shared && str_starts_with($name,'assets/')?'public, max-age=31536000, immutable':'no-cache'));header('Vary: Accept-Encoding');
if(!$shared && str_contains($_SERVER['HTTP_ACCEPT_ENCODING']??'','gzip') && is_file($file.'.gz')){$file.='.gz';header('Content-Encoding: gzip');}
header('Content-Length: '.filesize($file));readfile($file);
