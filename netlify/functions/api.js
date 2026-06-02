import { createClient } from '@libsql/client'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'node:crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'sada-admin-secret-2024'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const SITE_URL = (process.env.SITE_URL || 'https://sadaequipamentos.netlify.app').replace(/\/+$/, '')

const CHECKLIST_FIELDS = [
  'check_integridade_fisica', 'check_relatorio_bateria', 'check_bios_senha', 'check_secure_boot',
  'check_login_local', 'check_hostname', 'check_dominio', 'check_ou_correta', 'check_gpupdate',
  'check_ativacao_windows', 'check_rede', 'check_remover_hp_support', 'check_instalar_hp_image',
  'check_atualizar_drivers_bios', 'check_ativar_hp_wxp', 'check_config_manager', 'check_bitlocker',
  'check_limpar_equipamento', 'check_backup_onedrive', 'check_instalar_softwares',
  'check_validar_softwares', 'check_office_teams', 'check_sincronizar_conta', 'check_migrar_certificados',
  'check_fila_impressao', 'check_config_gerais', 'check_assinatura_termo', 'check_embalar_antigo',
  'check_identificar_caixa',
]

function hashPassword(pwd) {
  return createHash('sha256').update(pwd).digest('hex')
}

async function getAdminPassword() {
  const client = getDb()
  try {
    const r = await client.execute("SELECT value FROM admin_settings WHERE key = 'password_hash'")
    if (r.rows.length > 0) return r.rows[0].value
  } catch {}
  return hashPassword(ADMIN_PASSWORD)
}

async function setAdminPassword(pwd) {
  const client = getDb()
  const hashed = hashPassword(pwd)
  await client.execute("DELETE FROM admin_settings WHERE key = 'password_hash'")
  await client.execute("INSERT INTO admin_settings (key, value) VALUES ('password_hash', ?)", [hashed])
}

let db

function getDb() {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return db
}

function parsePath(path) {
  const parts = path.replace(/^\/?\.netlify\/functions\/api\/?/, '').replace(/^\/?api\/?/, '').split('/')
  return parts.filter(Boolean)
}

function getBody(event) {
  try {
    return JSON.parse(event.body || '{}')
  } catch {
    return {}
  }
}

function json(data, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: JSON.stringify(data),
  }
}

function authenticate(event) {
  const auth = event.headers.authorization || event.headers.Authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.split(' ')[1]
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json({ ok: true })
  }

  const parts = parsePath(event.path)
  const method = event.httpMethod

  try {
    await initDb()
  } catch (err) {
    console.error('DB init error:', err)
    return json({ error: 'Erro interno do servidor' }, 500)
  }

  if (method === 'POST' && parts[0] === 'registrar') {
    return handleRegistrar(event)
  }

  if (method === 'POST' && parts[0] === 'registrar-publico') {
    return handleRegistrarPublico(event)
  }

  if (parts[0] === 'admin') {
    if (method === 'POST' && parts[1] === 'login') {
      return handleAdminLogin(event)
    }

    const user = authenticate(event)
    if (!user) {
      return json({ error: 'Não autorizado' }, 401)
    }

    if (method === 'GET' && parts[1] === 'registros') {
      if (parts[2]) return handleGetRegistro(event, parts[2])
      return handleListRegistros(event)
    }

    if (method === 'PUT' && parts[1] === 'registros' && parts[2]) {
      return handleEditRegistro(event, parts[2])
    }

    if (method === 'DELETE' && parts[1] === 'registros' && parts[2]) {
      return handleDeleteRegistro(event, parts[2])
    }

    if (method === 'POST' && parts[1] === 'enviar-link') {
      return handleEnviarLink(event)
    }

    if (method === 'POST' && parts[1] === 'alterar-senha') {
      return handleAlterarSenha(event)
    }

    if (method === 'POST' && parts[1] === 'gerar-convite') {
      return handleGerarConvite(event)
    }
  }

  if (method === 'GET' && parts[0] === 'validar-token') {
    return handleValidarToken(event)
  }

  if (method === 'GET' && parts[0] === 'convidado' && parts[1]) {
    return handleVisualizarConvidado(event, parts[1])
  }

  return json({ error: 'Rota não encontrada' }, 404)
}

async function initDb() {
  const client = getDb()
  await client.execute(`
    CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      celular TEXT NOT NULL DEFAULT '',
      serial TEXT UNIQUE NOT NULL,
      modelo_notebook TEXT,
      foto1_url TEXT,
      foto2_url TEXT,
      foto3_url TEXT,
      foto4_url TEXT,
      observacao TEXT,
      com_mochila INTEGER DEFAULT 0,
      com_carregador INTEGER DEFAULT 0,
      com_teclado INTEGER DEFAULT 0,
      com_mouse INTEGER DEFAULT 0,
      setor TEXT,
      assinatura_nome TEXT,
      assinatura_matricula TEXT,
      tipo_atuacao TEXT,
      endereco_rua TEXT,
      endereco_bairro TEXT,
      endereco_cidade TEXT,
      endereco_cep TEXT,
      enviado_em TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)
  for (const col of ['observacao', 'com_mochila', 'com_carregador', 'com_teclado', 'com_mouse', 'setor', 'assinatura_nome', 'assinatura_matricula', 'assinatura_url', 'tipo_atuacao', 'endereco_rua', 'endereco_bairro', 'endereco_cidade', 'endereco_cep', 'foto4_url']) {
    try {
      await client.execute(`ALTER TABLE registros ADD COLUMN ${col} TEXT`)
    } catch {}
  }
  for (const col of ['tecnico_nome', 'notebook_novo_serial', 'monitor_novo_serial', 'notebook_antigo_serial', 'notebook_antigo_estado', 'foto5_url', 'foto6_url', ...CHECKLIST_FIELDS]) {
    try {
      await client.execute(`ALTER TABLE registros ADD COLUMN ${col} TEXT`)
    } catch {}
  }
  await client.execute(`CREATE TABLE IF NOT EXISTS admin_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  await client.execute(`CREATE TABLE IF NOT EXISTS guest_tokens (token TEXT PRIMARY KEY, usado INTEGER DEFAULT 0, criado_em TEXT DEFAULT CURRENT_TIMESTAMP)`)
}

async function handleValidarToken(event) {
  const token = event.queryStringParameters?.token
  if (!token) {
    return json({ error: 'Token não fornecido' }, 400)
  }

  if (token === 'unico' || token === 'publico') {
    return json({ valido: true, publico: true })
  }

  const client = getDb()
  const result = await client.execute({
    sql: 'SELECT id, enviado_em FROM registros WHERE token = ?',
    args: [token],
  })

  if (result.rows.length === 0) {
    return json({ valido: false, error: 'Token inválido' })
  }

  const row = result.rows[0]
  if (row.enviado_em) {
    return json({ valido: false, usado: true, error: 'Este link já foi utilizado.' })
  }

  return json({ valido: true })
}

function vliFields(body) {
  const f = {
    tecnico_nome: body.tecnico_nome || null,
    notebook_novo_serial: body.notebook_novo_serial || null,
    monitor_novo_serial: body.monitor_novo_serial || null,
    notebook_antigo_serial: body.notebook_antigo_serial || null,
    notebook_antigo_estado: body.notebook_antigo_estado || null,
  }
  for (const col of CHECKLIST_FIELDS) {
    f[col] = body[col] ? 1 : 0
  }
  return f
}

function vliSqlSet() {
  return CHECKLIST_FIELDS.map(c => `${c} = ?`).join(', ')
}

function vliArgs(body) {
  const f = vliFields(body)
  const vals = []
  for (const col of CHECKLIST_FIELDS) { vals.push(f[col]) }
  return vals
}

async function handleRegistrar(event) {
  try {
    const body = getBody(event)
    const { token, tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado,
      foto1_url, foto2_url, foto3_url, foto4_url, foto5_url, foto6_url,
      assinatura_nome, assinatura_matricula, assinatura_url } = body

    if (!token || !tecnico_nome || !notebook_novo_serial || !notebook_antigo_serial) {
      return json({ error: 'Campos obrigatórios: token, nome do técnico, séries' }, 400)
    }

    const client = getDb()

    const tokenResult = await client.execute({
      sql: 'SELECT id, enviado_em FROM registros WHERE token = ?',
      args: [token],
    })

    if (tokenResult.rows.length === 0) {
      return json({ error: 'Token inválido' }, 400)
    }

    if (tokenResult.rows[0].enviado_em) {
      return json({ error: 'Este link já foi utilizado.' }, 400)
    }

    const v = vliFields(body)

    await client.execute({
      sql: `UPDATE registros SET
        nome = ?, celular = ?, serial = ?,
        foto1_url = ?, foto2_url = ?, foto3_url = ?, foto4_url = ?, foto5_url = ?, foto6_url = ?,
        assinatura_nome = ?, assinatura_matricula = ?, assinatura_url = ?,
        tecnico_nome = ?, notebook_novo_serial = ?, monitor_novo_serial = ?,
        notebook_antigo_serial = ?, notebook_antigo_estado = ?, ${vliSqlSet()},
        enviado_em = ?
      WHERE token = ?`,
      args: [tecnico_nome, '', `${notebook_novo_serial} | antigo: ${notebook_antigo_serial}`,
        foto1_url || null, foto2_url || null, foto3_url || null, foto4_url || null, foto5_url || null, foto6_url || null,
        assinatura_nome || null, assinatura_matricula || null, assinatura_url || null,
        v.tecnico_nome, v.notebook_novo_serial, v.monitor_novo_serial, v.notebook_antigo_serial, v.notebook_antigo_estado,
        ...vliArgs(body), new Date().toISOString(), token],
    })

    return json({ sucesso: true, mensagem: 'Registro concluído com sucesso!' })
  } catch (err) {
    console.error('Erro em handleRegistrar:', err)
    return json({ error: 'Erro interno ao registrar: ' + err.message }, 500)
  }
}

async function handleRegistrarPublico(event) {
  try {
    const body = getBody(event)
    const { tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado,
      foto1_url, foto2_url, foto3_url, foto4_url, foto5_url, foto6_url,
      assinatura_nome, assinatura_matricula, assinatura_url } = body

    if (!tecnico_nome || !notebook_novo_serial || !notebook_antigo_serial || !assinatura_nome || !assinatura_matricula) {
      return json({ error: 'Campos obrigatórios: nome do técnico, séries, assinatura e matrícula' }, 400)
    }

    const client = getDb()
    const token = uuidv4()
    const v = vliFields(body)

    await client.execute({
      sql: `INSERT INTO registros (token, nome, email, celular, serial,
        foto1_url, foto2_url, foto3_url, foto4_url, foto5_url, foto6_url,
        assinatura_nome, assinatura_matricula, assinatura_url,
        tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado,
        ${CHECKLIST_FIELDS.join(', ')}, enviado_em)
      VALUES (?, ?, '', '', ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ${CHECKLIST_FIELDS.map(() => '?').join(', ')}, ?)`,
      args: [token, tecnico_nome, notebook_novo_serial,
        foto1_url || null, foto2_url || null, foto3_url || null, foto4_url || null, foto5_url || null, foto6_url || null,
        assinatura_nome || null, assinatura_matricula || null, assinatura_url || null,
        tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado,
        ...vliArgs(body), new Date().toISOString()],
    })

    return json({ sucesso: true, mensagem: 'Registro concluído com sucesso!' })
  } catch (err) {
    console.error('Erro em handleRegistrarPublico:', err)
    return json({ error: 'Erro interno ao registrar: ' + err.message }, 500)
  }
}

async function handleAdminLogin(event) {
  const { username, password } = getBody(event)

  const storedHash = await getAdminPassword()
  const inputHash = hashPassword(password)

  if (username !== ADMIN_USERNAME || inputHash !== storedHash) {
    return json({ error: 'Credenciais inválidas' }, 401)
  }

  const token = jwt.sign({ admin: true, username }, JWT_SECRET, { expiresIn: '24h' })
  return json({ token })
}

async function handleListRegistros(event) {
  const client = getDb()
  const busca = event.queryStringParameters?.busca || ''
  const status = event.queryStringParameters?.status || ''

  let sql = 'SELECT * FROM registros WHERE 1=1'
  const args = []

  if (busca) {
    sql += ' AND (tecnico_nome LIKE ? OR nome LIKE ? OR notebook_novo_serial LIKE ? OR notebook_antigo_serial LIKE ? OR email LIKE ?)'
    const term = `%${busca}%`
    args.push(term, term, term, term, term)
  }

  if (status === 'pendente') {
    sql += ' AND enviado_em IS NULL'
  } else if (status === 'registrado') {
    sql += ' AND enviado_em IS NOT NULL'
  }

  sql += ' ORDER BY criado_em DESC'

  const result = await client.execute({ sql, args })
  return json({ registros: result.rows })
}

async function handleEnviarLink(event) {
  const client = getDb()
  const token = uuidv4()

  await client.execute({
    sql: `INSERT INTO registros (token, nome, email, celular, serial, modelo_notebook, enviado_em)
    VALUES (?, '', '', '', ?, NULL, NULL)`,
    args: [token, token],
  })

  const link = `${SITE_URL}/registrar/${token}`

  return json({
    sucesso: true,
    mensagem: 'Link gerado com sucesso!',
    link,
    token,
  })
}

function mapRow(r) {
  return {
    ...r,
    com_mochila: Number(r.com_mochila || 0),
    com_carregador: Number(r.com_carregador || 0),
    com_teclado: Number(r.com_teclado || 0),
    com_mouse: Number(r.com_mouse || 0),
  }
}

async function handleGetRegistro(event, id) {
  const client = getDb()
  const result = await client.execute({
    sql: 'SELECT * FROM registros WHERE id = ?',
    args: [id],
  })
  if (result.rows.length === 0) {
    return json({ error: 'Registro não encontrado' }, 404)
  }
  return json({ registro: mapRow(result.rows[0]) })
}

async function handleEditRegistro(event, id) {
  const body = getBody(event)
  const { tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado,
    assinatura_nome, assinatura_matricula } = body

  if (!tecnico_nome || !notebook_novo_serial || !notebook_antigo_serial) {
    return json({ error: 'Campos obrigatórios: técnico e séries' }, 400)
  }

  const client = getDb()
  const v = vliFields(body)

  await client.execute({
    sql: `UPDATE registros SET nome = ?, celular = ?,
      assinatura_nome = ?, assinatura_matricula = ?,
      tecnico_nome = ?, notebook_novo_serial = ?, monitor_novo_serial = ?,
      notebook_antigo_serial = ?, notebook_antigo_estado = ?, ${vliSqlSet()}
    WHERE id = ?`,
    args: [tecnico_nome, '', assinatura_nome || null, assinatura_matricula || null,
      v.tecnico_nome, v.notebook_novo_serial, v.monitor_novo_serial, v.notebook_antigo_serial, v.notebook_antigo_estado,
      ...vliArgs(body), id],
  })

  return json({ sucesso: true, mensagem: 'Registro atualizado com sucesso!' })
}

async function handleDeleteRegistro(event, id) {
  const client = getDb()

  const result = await client.execute({
    sql: 'SELECT id FROM registros WHERE id = ?',
    args: [id],
  })

  if (result.rows.length === 0) {
    return json({ error: 'Registro não encontrado' }, 404)
  }

  await client.execute({
    sql: 'DELETE FROM registros WHERE id = ?',
    args: [id],
  })

  return json({ sucesso: true, mensagem: 'Registro excluído com sucesso!' })
}

async function handleAlterarSenha(event) {
  const { senha_atual, nova_senha } = getBody(event)

  if (!senha_atual || !nova_senha) {
    return json({ error: 'Campos obrigatórios: senha_atual, nova_senha' }, 400)
  }

  if (nova_senha.length < 6) {
    return json({ error: 'A nova senha deve ter no mínimo 6 caracteres' }, 400)
  }

  const storedHash = await getAdminPassword()
  if (hashPassword(senha_atual) !== storedHash) {
    return json({ error: 'Senha atual incorreta' }, 401)
  }

  await setAdminPassword(nova_senha)

  return json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' })
}

async function handleGerarConvite(event) {
  const token = uuidv4()
  const client = getDb()
  await client.execute({
    sql: 'INSERT INTO guest_tokens (token) VALUES (?)',
    args: [token],
  })
  const link = `${SITE_URL}/convidado/${token}`
  return json({ sucesso: true, link })
}

async function handleVisualizarConvidado(event, token) {
  const client = getDb()
  const result = await client.execute({
    sql: 'SELECT usado FROM guest_tokens WHERE token = ?',
    args: [token],
  })

  if (result.rows.length === 0) {
    return json({ error: 'Link inválido' }, 404)
  }

  if (result.rows[0].usado) {
    return json({ error: 'Este link já foi utilizado' }, 400)
  }

  await client.execute({
    sql: 'UPDATE guest_tokens SET usado = 1 WHERE token = ?',
    args: [token],
  })

  const registros = await client.execute('SELECT * FROM registros ORDER BY criado_em DESC')
  return json({ registros: registros.rows })
}
