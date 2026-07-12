<?php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (strpos($uri, '/api/') === 0) {
  require __DIR__ . '/api/index.php';
  return;
}

$distFile = __DIR__ . '/dist' . $uri;
if ($uri !== '/' && is_file($distFile)) {
  $ext = pathinfo($distFile, PATHINFO_EXTENSION);
  $mime = ['js'=>'application/javascript','css'=>'text/css','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','gif'=>'image/gif','svg'=>'image/svg+xml','ico'=>'image/x-icon','woff'=>'font/woff','woff2'=>'font/woff2','json'=>'application/json','html'=>'text/html'];
  header('Content-Type: ' . ($mime[$ext] ?? 'application/octet-stream'));
  readfile($distFile);
  return;
}

readfile(__DIR__ . '/dist/index.html');
