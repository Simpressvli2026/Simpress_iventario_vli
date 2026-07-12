<?php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (strpos($uri, '/api/') === 0) {
  require __DIR__ . '/api/index.php';
  return;
}

$distFile = __DIR__ . '/dist' . $uri;
if ($uri !== '/' && is_file($distFile)) {
  return false;
}

readfile(__DIR__ . '/dist/index.html');
