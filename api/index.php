<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

define('JWT_SECRET',     getenv('JWT_SECRET') ?: 'simpress-vli-jwt-secret-2026');
define('ADMIN_USERNAME', getenv('ADMIN_USERNAME') ?: 'admin');
define('ADMIN_PASSWORD', getenv('ADMIN_PASSWORD') ?: 'admin123');
define('SITE_URL',       (getenv('SITE_URL') ?: 'https://inventariovli.sistemtech.com.br'));
define('DB_HOST',        getenv('MYSQL_HOST') ?: 'localhost');
define('DB_PORT',        (int)(getenv('MYSQL_PORT') ?: '3306'));
define('DB_USER',        getenv('MYSQL_USER') ?: 'sistemtechcom_admin02');
define('DB_PASS',        getenv('MYSQL_PASSWORD') ?: 'Rodrigo2021.');
define('DB_NAME',        getenv('MYSQL_DATABASE') ?: 'sistemtechcom_inventariovli');

$CHECKLIST = [
  'check_integridade_fisica','check_relatorio_bateria','check_bios_senha','check_secure_boot',
  'check_login_local','check_hostname','check_dominio','check_ou_correta','check_gpupdate',
  'check_ativacao_windows','check_rede','check_remover_hp_support','check_instalar_hp_image',
  'check_atualizar_drivers_bios','check_ativar_hp_wxp','check_config_manager','check_bitlocker',
  'check_limpar_equipamento','check_backup_onedrive','check_instalar_softwares',
  'check_validar_softwares','check_office_teams','check_sincronizar_conta','check_migrar_certificados',
  'check_fila_impressao','check_config_gerais','check_assinatura_termo','check_embalar_antigo',
  'check_identificar_caixa',
];

function getDb() {
  static $db = null;
  if ($db === null) {
    $db = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
    if ($db->connect_error) {
      http_response_code(500);
      echo json_encode(['error' => 'Erro de conexão: ' . $db->connect_error]);
      exit;
    }
    $db->set_charset('utf8mb4');
  }
  return $db;
}

function initDb() {
  $db = getDb();
  $cols = implode(",\n    ", array_map(fn($c) => "`$c` TINYINT DEFAULT 0", $GLOBALS['CHECKLIST']));
  $db->query("CREATE TABLE IF NOT EXISTS registros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    celular TEXT NOT NULL DEFAULT '',
    serial TEXT UNIQUE NOT NULL,
    modelo_notebook TEXT,
    foto1_url TEXT, foto2_url TEXT, foto3_url TEXT, foto4_url TEXT, foto5_url TEXT, foto6_url TEXT,
    observacao TEXT,
    com_mochila TINYINT DEFAULT 0, com_carregador TINYINT DEFAULT 0,
    com_teclado TINYINT DEFAULT 0, com_mouse TINYINT DEFAULT 0,
    setor TEXT,
    assinatura_nome TEXT, assinatura_matricula TEXT, assinatura_url TEXT,
    tipo_atuacao TEXT,
    endereco_rua TEXT, endereco_bairro TEXT, endereco_cidade TEXT, endereco_cep TEXT,
    tecnico_nome TEXT, notebook_novo_serial TEXT, monitor_novo_serial TEXT,
    notebook_antigo_serial TEXT, notebook_antigo_estado TEXT,
    $cols,
    enviado_em TEXT,
    criado_em TEXT DEFAULT (CURRENT_TIMESTAMP)
  )");
  $db->query("CREATE TABLE IF NOT EXISTS admin_settings (
    `key` VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL
  )");
  $db->query("CREATE TABLE IF NOT EXISTS guest_tokens (
    token VARCHAR(255) PRIMARY KEY,
    usado TINYINT DEFAULT 0,
    criado_em TEXT DEFAULT (CURRENT_TIMESTAMP)
  )");
}

function b64urlEncode($d) { return rtrim(strtr(base64_encode($d), '+/', '-_'), '='); }
function b64urlDecode($d) { return base64_decode(strtr($d, '-_', '+/')); }

function jwtEncode($payload) {
  $h = b64urlEncode(json_encode(['alg'=>'HS256','typ'=>'JWT']));
  $p = b64urlEncode(json_encode($payload));
  $s = b64urlEncode(hash_hmac('sha256', "$h.$p", JWT_SECRET, true));
  return "$h.$p.$s";
}

function jwtDecode($token) {
  $parts = explode('.', $token);
  if (count($parts) !== 3) return null;
  [$h,$p,$s] = $parts;
  $e = b64urlEncode(hash_hmac('sha256', "$h.$p", JWT_SECRET, true));
  if (!hash_equals($e, $s)) return null;
  return json_decode(b64urlDecode($p), true);
}

function authenticate() {
  $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (!preg_match('/^Bearer\s+(.+)$/', $auth, $m)) {
    http_response_code(401); echo json_encode(['error'=>'Não autorizado']); exit;
  }
  $user = jwtDecode($m[1]);
  if (!$user) {
    http_response_code(401); echo json_encode(['error'=>'Não autorizado']); exit;
  }
  return $user;
}

function hashPwd($pwd) { return hash('sha256', $pwd); }

function getAdminPassword() {
  $r = getDb()->query("SELECT value FROM admin_settings WHERE `key`='password_hash'");
  if ($r && $row = $r->fetch_assoc()) return $row['value'];
  return hashPwd(ADMIN_PASSWORD);
}

function setAdminPassword($pwd) {
  $db = getDb();
  $h = hashPwd($pwd);
  $db->query("DELETE FROM admin_settings WHERE `key`='password_hash'");
  $st = $db->prepare("INSERT INTO admin_settings (`key`, value) VALUES ('password_hash', ?)");
  $st->bind_param('s', $h);
  $st->execute();
}

function vliFields($b) {
  $f = [
    'tecnico_nome' => $b['tecnico_nome'] ?? null,
    'notebook_novo_serial' => $b['notebook_novo_serial'] ?? null,
    'monitor_novo_serial' => $b['monitor_novo_serial'] ?? null,
    'notebook_antigo_serial' => $b['notebook_antigo_serial'] ?? null,
    'notebook_antigo_estado' => $b['notebook_antigo_estado'] ?? null,
  ];
  foreach ($GLOBALS['CHECKLIST'] as $c) $f[$c] = !empty($b[$c]) ? 1 : 0;
  return $f;
}

function vliPlaceholders() {
  return implode(',', array_fill(0, count($GLOBALS['CHECKLIST']), '?'));
}

function vliArgs($b) {
  $vals = [];
  foreach ($GLOBALS['CHECKLIST'] as $c) $vals[] = !empty($b[$c]) ? 1 : 0;
  return $vals;
}

function vliSqlSet() {
  return implode(', ', array_map(fn($c) => "`$c` = ?", $GLOBALS['CHECKLIST']));
}

function mapRow($r) {
  $r['com_mochila'] = (int)($r['com_mochila'] ?? 0);
  $r['com_carregador'] = (int)($r['com_carregador'] ?? 0);
  $r['com_teclado'] = (int)($r['com_teclado'] ?? 0);
  $r['com_mouse'] = (int)($r['com_mouse'] ?? 0);
  return $r;
}

function json($data) { echo json_encode($data); exit; }
function jsonError($msg, $code = 400) { http_response_code($code); json(['error'=>$msg]); }

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

initDb();

try {
  if ($uri === '/api/registrar' && $method === 'POST') {
    $token = $body['token'] ?? '';
    $tn = $body['tecnico_nome'] ?? '';
    $nns = $body['notebook_novo_serial'] ?? '';
    $nas = $body['notebook_antigo_serial'] ?? '';
    if (!$token || !$tn || !$nns || !$nas) jsonError('Campos obrigatórios: token, nome do técnico, séries');

    $db = getDb();
    $st = $db->prepare("SELECT id, enviado_em FROM registros WHERE token = ?");
    $st->bind_param('s', $token);
    $st->execute();
    $r = $st->get_result()->fetch_assoc();
    if (!$r) jsonError('Token inválido');
    if ($r['enviado_em']) jsonError('Este link já foi utilizado.');

    $v = vliFields($body);
    $serial = "$nns | antigo: $nas";
    $agora = date('c');
    $args = [$tn, '', $serial,
      $body['foto1_url']??null, $body['foto2_url']??null, $body['foto3_url']??null,
      $body['foto4_url']??null, $body['foto5_url']??null, $body['foto6_url']??null,
      $body['assinatura_nome']??null, $body['assinatura_matricula']??null, $body['assinatura_url']??null,
      $v['tecnico_nome'], $v['notebook_novo_serial'], $v['monitor_novo_serial'],
      $v['notebook_antigo_serial'], $v['notebook_antigo_estado']];
    $args = array_merge($args, vliArgs($body), [$agora, $token]);

    $types = str_repeat('s', count($args));
    $sql = "UPDATE registros SET nome=?, celular=?, serial=?,
      foto1_url=?, foto2_url=?, foto3_url=?, foto4_url=?, foto5_url=?, foto6_url=?,
      assinatura_nome=?, assinatura_matricula=?, assinatura_url=?,
      tecnico_nome=?, notebook_novo_serial=?, monitor_novo_serial=?,
      notebook_antigo_serial=?, notebook_antigo_estado=?, " . vliSqlSet() . ",
      enviado_em=? WHERE token=?";
    $st = $db->prepare($sql);
    $st->bind_param($types, ...$args);
    $st->execute();
    json(['sucesso'=>true, 'mensagem'=>'Registro concluído com sucesso!']);
  }

  elseif ($uri === '/api/registrar-publico' && $method === 'POST') {
    $tn = $body['tecnico_nome'] ?? '';
    $nns = $body['notebook_novo_serial'] ?? '';
    $nas = $body['notebook_antigo_serial'] ?? '';
    $an = $body['assinatura_nome'] ?? '';
    $am = $body['assinatura_matricula'] ?? '';
    if (!$tn || !$nns || !$nas || !$an || !$am) jsonError('Campos obrigatórios: nome do técnico, séries, assinatura e matrícula');

    $db = getDb();
    $token = bin2hex(random_bytes(16));
    $v = vliFields($body);
    $agora = date('c');

    $cols = 'token, nome, email, celular, serial, foto1_url, foto2_url, foto3_url, foto4_url, foto5_url, foto6_url, assinatura_nome, assinatura_matricula, assinatura_url, tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado, ' . implode(',', $GLOBALS['CHECKLIST']) . ', enviado_em';
    $ph = '?,' . str_repeat('?,', 19) . vliPlaceholders() . ',?';
    $args = [$token, $tn, '', '', $nns,
      $body['foto1_url']??null, $body['foto2_url']??null, $body['foto3_url']??null,
      $body['foto4_url']??null, $body['foto5_url']??null, $body['foto6_url']??null,
      $body['assinatura_nome']??null, $body['assinatura_matricula']??null, $body['assinatura_url']??null,
      $tn, $nns, $body['monitor_novo_serial']??null, $nas, $body['notebook_antigo_estado']??null];
    $args = array_merge($args, vliArgs($body), [$agora]);

    $types = str_repeat('s', count($args));
    $st = $db->prepare("INSERT INTO registros ($cols) VALUES ($ph)");
    $st->bind_param($types, ...$args);
    $st->execute();
    json(['sucesso'=>true, 'mensagem'=>'Registro concluído com sucesso!']);
  }

  elseif ($uri === '/api/validar-token' && $method === 'GET') {
    $token = $_GET['token'] ?? '';
    if (!$token) jsonError('Token não fornecido');
    if ($token === 'unico' || $token === 'publico') json(['valido'=>true, 'publico'=>true]);

    $db = getDb();
    $st = $db->prepare("SELECT id, enviado_em FROM registros WHERE token = ?");
    $st->bind_param('s', $token);
    $st->execute();
    $r = $st->get_result()->fetch_assoc();
    if (!$r) json(['valido'=>false, 'error'=>'Token inválido']);
    if ($r['enviado_em']) json(['valido'=>false, 'usado'=>true, 'error'=>'Este link já foi utilizado.']);
    json(['valido'=>true]);
  }

  elseif ($uri === '/api/admin/login' && $method === 'POST') {
    $username = $body['username'] ?? '';
    $password = $body['password'] ?? '';
    $stored = getAdminPassword();
    if ($username !== ADMIN_USERNAME || hashPwd($password) !== $stored) jsonError('Credenciais inválidas', 401);
    $token = jwtEncode(['admin'=>true, 'username'=>$username, 'exp'=>time()+86400]);
    json(['token'=>$token]);
  }

  elseif (preg_match('#^/api/admin/registros/?(\d*)$#', $uri, $m) && $method === 'GET') {
    authenticate();
    $db = getDb();
    if ($m[1] !== '') {
      $st = $db->prepare("SELECT * FROM registros WHERE id = ?");
      $st->bind_param('i', $m[1]);
      $st->execute();
      $r = $st->get_result()->fetch_assoc();
      if (!$r) jsonError('Registro não encontrado', 404);
      json(['registro'=>mapRow($r)]);
    } else {
      $busca = $_GET['busca'] ?? '';
      $status = $_GET['status'] ?? '';
      $sql = "SELECT * FROM registros WHERE 1=1";
      $args = [];
      $types = '';
      if ($busca) {
        $sql .= " AND (tecnico_nome LIKE ? OR nome LIKE ? OR notebook_novo_serial LIKE ? OR notebook_antigo_serial LIKE ? OR email LIKE ?)";
        $term = "%$busca%";
        $args = [$term, $term, $term, $term, $term];
        $types = 'sssss';
      }
      if ($status === 'pendente') $sql .= " AND enviado_em IS NULL";
      elseif ($status === 'registrado') $sql .= " AND enviado_em IS NOT NULL";
      $sql .= " ORDER BY criado_em DESC";

      if ($args) {
        $st = $db->prepare($sql);
        $st->bind_param($types, ...$args);
        $st->execute();
        $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
      } else {
        $rows = $db->query($sql)->fetch_all(MYSQLI_ASSOC);
      }
      json(['registros'=>$rows]);
    }
  }

  elseif (preg_match('#^/api/admin/registros/(\d+)$#', $uri, $m) && $method === 'PUT') {
    authenticate();
    $tn = $body['tecnico_nome'] ?? '';
    $nns = $body['notebook_novo_serial'] ?? '';
    $nas = $body['notebook_antigo_serial'] ?? '';
    if (!$tn || !$nns || !$nas) jsonError('Campos obrigatórios: técnico e séries');
    $db = getDb();
    $v = vliFields($body);
    $args = [$tn, '', $body['assinatura_nome']??null, $body['assinatura_matricula']??null,
      $v['tecnico_nome'], $v['notebook_novo_serial'], $v['monitor_novo_serial'],
      $v['notebook_antigo_serial'], $v['notebook_antigo_estado']];
    $args = array_merge($args, vliArgs($body), [$m[1]]);
    $types = str_repeat('s', count($args));
    $sql = "UPDATE registros SET nome=?, celular=?, assinatura_nome=?, assinatura_matricula=?,
      tecnico_nome=?, notebook_novo_serial=?, monitor_novo_serial=?,
      notebook_antigo_serial=?, notebook_antigo_estado=?, " . vliSqlSet() . " WHERE id=?";
    $st = $db->prepare($sql);
    $st->bind_param($types, ...$args);
    $st->execute();
    json(['sucesso'=>true, 'mensagem'=>'Registro atualizado com sucesso!']);
  }

  elseif (preg_match('#^/api/admin/registros/(\d+)$#', $uri, $m) && $method === 'DELETE') {
    authenticate();
    $db = getDb();
    $st = $db->prepare("SELECT id FROM registros WHERE id = ?");
    $st->bind_param('i', $m[1]);
    $st->execute();
    if (!$st->get_result()->fetch_assoc()) jsonError('Registro não encontrado', 404);
    $st = $db->prepare("DELETE FROM registros WHERE id = ?");
    $st->bind_param('i', $m[1]);
    $st->execute();
    json(['sucesso'=>true, 'mensagem'=>'Registro excluído com sucesso!']);
  }

  elseif ($uri === '/api/admin/enviar-link' && $method === 'POST') {
    authenticate();
    $db = getDb();
    $token = bin2hex(random_bytes(16));
    $st = $db->prepare("INSERT INTO registros (token, nome, email, celular, serial, modelo_notebook, enviado_em) VALUES (?, '', '', '', ?, NULL, NULL)");
    $st->bind_param('ss', $token, $token);
    $st->execute();
    $link = SITE_URL . "/registrar/$token";
    json(['sucesso'=>true, 'mensagem'=>'Link gerado com sucesso!', 'link'=>$link, 'token'=>$token]);
  }

  elseif ($uri === '/api/admin/alterar-senha' && $method === 'POST') {
    authenticate();
    $sa = $body['senha_atual'] ?? '';
    $ns = $body['nova_senha'] ?? '';
    if (!$sa || !$ns) jsonError('Campos obrigatórios: senha_atual, nova_senha');
    if (strlen($ns) < 6) jsonError('A nova senha deve ter no mínimo 6 caracteres');
    $stored = getAdminPassword();
    if (hashPwd($sa) !== $stored) jsonError('Senha atual incorreta', 401);
    setAdminPassword($ns);
    json(['sucesso'=>true, 'mensagem'=>'Senha alterada com sucesso!']);
  }

  elseif ($uri === '/api/admin/gerar-convite' && $method === 'POST') {
    authenticate();
    $db = getDb();
    $token = bin2hex(random_bytes(16));
    $st = $db->prepare("INSERT INTO guest_tokens (token) VALUES (?)");
    $st->bind_param('s', $token);
    $st->execute();
    $link = SITE_URL . "/convidado/$token";
    json(['sucesso'=>true, 'link'=>$link]);
  }

  elseif (preg_match('#^/api/convidado/([a-f0-9]+)$#', $uri, $m) && $method === 'GET') {
    $db = getDb();
    $st = $db->prepare("SELECT usado FROM guest_tokens WHERE token = ?");
    $st->bind_param('s', $m[1]);
    $st->execute();
    $r = $st->get_result()->fetch_assoc();
    if (!$r) jsonError('Link inválido', 404);
    if ($r['usado']) jsonError('Este link já foi utilizado');
    $st = $db->prepare("UPDATE guest_tokens SET usado = 1 WHERE token = ?");
    $st->bind_param('s', $m[1]);
    $st->execute();
    $rows = $db->query("SELECT * FROM registros ORDER BY criado_em DESC")->fetch_all(MYSQLI_ASSOC);
    json(['registros'=>$rows]);
  }

  else {
    http_response_code(404);
    json(['error'=>'Rota não encontrada']);
  }
} catch (Throwable $e) {
  http_response_code(500);
  json(['error'=>'Erro interno: ' . $e->getMessage()]);
}
