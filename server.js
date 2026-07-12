import 'dotenv/config'
import express from 'express'
import mysql from 'mysql2/promise'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const JWT_SECRET = process.env.JWT_SECRET || 'sada-admin-secret-2024'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const SITE_URL = (process.env.SITE_URL || 'https://seudominio.com').replace(/\/+$/, '')
const PORT = parseInt(process.env.PORT || '3000')

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

const app = express()
app.use(express.json({ limit: '50mb' }))

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  next()
})

function hashPassword(pwd) {
  return createHash('sha256').update(pwd).digest('hex')
}

const ALL_COLUMNS = [
  'id', 'token', 'nome', 'email', 'celular', 'serial', 'modelo_notebook',
  'foto1_url', 'foto2_url', 'foto3_url', 'foto4_url', 'foto5_url', 'foto6_url',
  'observacao', 'com_mochila', 'com_carregador', 'com_teclado', 'com_mouse',
  'setor', 'assinatura_nome', 'assinatura_matricula', 'assinatura_url',
  'tipo_atuacao', 'endereco_rua', 'endereco_bairro', 'endereco_cidade', 'endereco_cep',
  'tecnico_nome', 'notebook_novo_serial', 'monitor_novo_serial',
  'notebook_antigo_serial', 'notebook_antigo_estado',
  ...CHECKLIST_FIELDS,
  'enviado_em', 'criado_em',
]

let pool

function getDb() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'sada_equipamentos',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 10,
    })
  }
  return pool
}

async function initDb() {
  const db = getDb()

  const checklistCols = CHECKLIST_FIELDS.map(c => `\`${c}\` TINYINT DEFAULT 0`).join(',\n    ')

  await db.execute(`
    CREATE TABLE IF NOT EXISTS registros (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token VARCHAR(255) UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      celular TEXT NOT NULL DEFAULT '',
      serial TEXT UNIQUE NOT NULL,
      modelo_notebook TEXT,
      foto1_url TEXT,
      foto2_url TEXT,
      foto3_url TEXT,
      foto4_url TEXT,
      foto5_url TEXT,
      foto6_url TEXT,
      observacao TEXT,
      com_mochila TINYINT DEFAULT 0,
      com_carregador TINYINT DEFAULT 0,
      com_teclado TINYINT DEFAULT 0,
      com_mouse TINYINT DEFAULT 0,
      setor TEXT,
      assinatura_nome TEXT,
      assinatura_matricula TEXT,
      assinatura_url TEXT,
      tipo_atuacao TEXT,
      endereco_rua TEXT,
      endereco_bairro TEXT,
      endereco_cidade TEXT,
      endereco_cep TEXT,
      tecnico_nome TEXT,
      notebook_novo_serial TEXT,
      monitor_novo_serial TEXT,
      notebook_antigo_serial TEXT,
      notebook_antigo_estado TEXT,
      ${checklistCols},
      enviado_em TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      \`key\` VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS guest_tokens (
      token VARCHAR(255) PRIMARY KEY,
      usado TINYINT DEFAULT 0,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function getAdminPassword() {
  const db = getDb()
  try {
    const [rows] = await db.execute("SELECT value FROM admin_settings WHERE `key` = 'password_hash'")
    if (rows.length > 0) return rows[0].value
  } catch {}
  return hashPassword(ADMIN_PASSWORD)
}

async function setAdminPassword(pwd) {
  const db = getDb()
  const hashed = hashPassword(pwd)
  await db.execute("DELETE FROM admin_settings WHERE `key` = 'password_hash'")
  await db.execute("INSERT INTO admin_settings (`key`, value) VALUES ('password_hash', ?)", [hashed])
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
  return CHECKLIST_FIELDS.map(c => `\`${c}\` = ?`).join(', ')
}

function vliArgs(body) {
  const f = vliFields(body)
  const vals = []
  for (const col of CHECKLIST_FIELDS) { vals.push(f[col]) }
  return vals
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado' })
  }
  const token = auth.split(' ')[1]
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Não autorizado' })
  }
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

app.post('/api/registrar', async (req, res) => {
  try {
    const body = req.body
    const { token, tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado,
      foto1_url, foto2_url, foto3_url, foto4_url, foto5_url, foto6_url,
      assinatura_nome, assinatura_matricula, assinatura_url } = body

    if (!token || !tecnico_nome || !notebook_novo_serial || !notebook_antigo_serial) {
      return res.status(400).json({ error: 'Campos obrigatórios: token, nome do técnico, séries' })
    }

    const db = getDb()
    const [rows] = await db.execute('SELECT id, enviado_em FROM registros WHERE token = ?', [token])

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido' })
    }

    if (rows[0].enviado_em) {
      return res.status(400).json({ error: 'Este link já foi utilizado.' })
    }

    const v = vliFields(body)

    await db.execute(
      `UPDATE registros SET
        nome = ?, celular = ?, serial = ?,
        foto1_url = ?, foto2_url = ?, foto3_url = ?, foto4_url = ?, foto5_url = ?, foto6_url = ?,
        assinatura_nome = ?, assinatura_matricula = ?, assinatura_url = ?,
        tecnico_nome = ?, notebook_novo_serial = ?, monitor_novo_serial = ?,
        notebook_antigo_serial = ?, notebook_antigo_estado = ?, ${vliSqlSet()},
        enviado_em = ?
      WHERE token = ?`,
      [tecnico_nome, '', `${notebook_novo_serial} | antigo: ${notebook_antigo_serial}`,
        foto1_url || null, foto2_url || null, foto3_url || null, foto4_url || null, foto5_url || null, foto6_url || null,
        assinatura_nome || null, assinatura_matricula || null, assinatura_url || null,
        v.tecnico_nome, v.notebook_novo_serial, v.monitor_novo_serial, v.notebook_antigo_serial, v.notebook_antigo_estado,
        ...vliArgs(body), new Date().toISOString(), token],
    )

    return res.json({ sucesso: true, mensagem: 'Registro concluído com sucesso!' })
  } catch (err) {
    console.error('Erro em handleRegistrar:', err)
    return res.status(500).json({ error: 'Erro interno ao registrar: ' + err.message })
  }
})

app.post('/api/registrar-publico', async (req, res) => {
  try {
    const body = req.body
    const { tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado,
      foto1_url, foto2_url, foto3_url, foto4_url, foto5_url, foto6_url,
      assinatura_nome, assinatura_matricula, assinatura_url } = body

    if (!tecnico_nome || !notebook_novo_serial || !notebook_antigo_serial || !assinatura_nome || !assinatura_matricula) {
      return res.status(400).json({ error: 'Campos obrigatórios: nome do técnico, séries, assinatura e matrícula' })
    }

    const db = getDb()
    const token = uuidv4()
    const v = vliFields(body)

    await db.execute(
      `INSERT INTO registros (token, nome, email, celular, serial,
        foto1_url, foto2_url, foto3_url, foto4_url, foto5_url, foto6_url,
        assinatura_nome, assinatura_matricula, assinatura_url,
        tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado,
        ${CHECKLIST_FIELDS.join(', ')}, enviado_em)
      VALUES (?, ?, '', '', ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ${CHECKLIST_FIELDS.map(() => '?').join(', ')}, ?)`,
      [token, tecnico_nome, notebook_novo_serial,
        foto1_url || null, foto2_url || null, foto3_url || null, foto4_url || null, foto5_url || null, foto6_url || null,
        assinatura_nome || null, assinatura_matricula || null, assinatura_url || null,
        tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado,
        ...vliArgs(body), new Date().toISOString()],
    )

    return res.json({ sucesso: true, mensagem: 'Registro concluído com sucesso!' })
  } catch (err) {
    console.error('Erro em handleRegistrarPublico:', err)
    return res.status(500).json({ error: 'Erro interno ao registrar: ' + err.message })
  }
})

app.get('/api/validar-token', async (req, res) => {
  const token = req.query.token
  if (!token) {
    return res.status(400).json({ error: 'Token não fornecido' })
  }

  if (token === 'unico' || token === 'publico') {
    return res.json({ valido: true, publico: true })
  }

  const db = getDb()
  const [rows] = await db.execute('SELECT id, enviado_em FROM registros WHERE token = ?', [token])

  if (rows.length === 0) {
    return res.json({ valido: false, error: 'Token inválido' })
  }

  const row = rows[0]
  if (row.enviado_em) {
    return res.json({ valido: false, usado: true, error: 'Este link já foi utilizado.' })
  }

  return res.json({ valido: true })
})

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body
  const storedHash = await getAdminPassword()
  const inputHash = hashPassword(password)

  if (username !== ADMIN_USERNAME || inputHash !== storedHash) {
    return res.status(401).json({ error: 'Credenciais inválidas' })
  }

  const token = jwt.sign({ admin: true, username }, JWT_SECRET, { expiresIn: '24h' })
  return res.json({ token })
})

app.get('/api/admin/registros', authenticate, async (req, res) => {
  const db = getDb()
  const busca = req.query.busca || ''
  const status = req.query.status || ''

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

  const [rows] = await db.execute(sql, args)
  return res.json({ registros: rows })
})

app.get('/api/admin/registros/:id', authenticate, async (req, res) => {
  const db = getDb()
  const [rows] = await db.execute('SELECT * FROM registros WHERE id = ?', [req.params.id])
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Registro não encontrado' })
  }
  return res.json({ registro: mapRow(rows[0]) })
})

app.put('/api/admin/registros/:id', authenticate, async (req, res) => {
  const body = req.body
  const { tecnico_nome, notebook_novo_serial, monitor_novo_serial, notebook_antigo_serial, notebook_antigo_estado,
    assinatura_nome, assinatura_matricula } = body

  if (!tecnico_nome || !notebook_novo_serial || !notebook_antigo_serial) {
    return res.status(400).json({ error: 'Campos obrigatórios: técnico e séries' })
  }

  const db = getDb()
  const v = vliFields(body)

  await db.execute(
    `UPDATE registros SET nome = ?, celular = ?,
      assinatura_nome = ?, assinatura_matricula = ?,
      tecnico_nome = ?, notebook_novo_serial = ?, monitor_novo_serial = ?,
      notebook_antigo_serial = ?, notebook_antigo_estado = ?, ${vliSqlSet()}
    WHERE id = ?`,
    [tecnico_nome, '', assinatura_nome || null, assinatura_matricula || null,
      v.tecnico_nome, v.notebook_novo_serial, v.monitor_novo_serial, v.notebook_antigo_serial, v.notebook_antigo_estado,
      ...vliArgs(body), req.params.id],
  )

  return res.json({ sucesso: true, mensagem: 'Registro atualizado com sucesso!' })
})

app.delete('/api/admin/registros/:id', authenticate, async (req, res) => {
  const db = getDb()
  const [rows] = await db.execute('SELECT id FROM registros WHERE id = ?', [req.params.id])
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Registro não encontrado' })
  }
  await db.execute('DELETE FROM registros WHERE id = ?', [req.params.id])
  return res.json({ sucesso: true, mensagem: 'Registro excluído com sucesso!' })
})

app.post('/api/admin/enviar-link', authenticate, async (req, res) => {
  const db = getDb()
  const token = uuidv4()

  await db.execute(
    'INSERT INTO registros (token, nome, email, celular, serial, modelo_notebook, enviado_em) VALUES (?, \'\', \'\', \'\', ?, NULL, NULL)',
    [token, token],
  )

  const link = `${SITE_URL}/registrar/${token}`

  return res.json({
    sucesso: true,
    mensagem: 'Link gerado com sucesso!',
    link,
    token,
  })
})

app.post('/api/admin/alterar-senha', authenticate, async (req, res) => {
  const { senha_atual, nova_senha } = req.body

  if (!senha_atual || !nova_senha) {
    return res.status(400).json({ error: 'Campos obrigatórios: senha_atual, nova_senha' })
  }

  if (nova_senha.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' })
  }

  const storedHash = await getAdminPassword()
  if (hashPassword(senha_atual) !== storedHash) {
    return res.status(401).json({ error: 'Senha atual incorreta' })
  }

  await setAdminPassword(nova_senha)
  return res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' })
})

app.post('/api/admin/gerar-convite', authenticate, async (req, res) => {
  const token = uuidv4()
  const db = getDb()
  await db.execute('INSERT INTO guest_tokens (token) VALUES (?)', [token])
  const link = `${SITE_URL}/convidado/${token}`
  return res.json({ sucesso: true, link })
})

app.get('/api/convidado/:token', async (req, res) => {
  const db = getDb()
  const [rows] = await db.execute('SELECT usado FROM guest_tokens WHERE token = ?', [req.params.token])

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Link inválido' })
  }

  if (rows[0].usado) {
    return res.status(400).json({ error: 'Este link já foi utilizado' })
  }

  await db.execute('UPDATE guest_tokens SET usado = 1 WHERE token = ?', [req.params.token])

  const [registros] = await db.execute('SELECT * FROM registros ORDER BY criado_em DESC')
  return res.json({ registros })
})

const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err)
  res.status(500).json({ error: 'Erro interno do servidor' })
})

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`)
  })
}).catch(err => {
  console.error('Erro ao iniciar banco:', err)
  process.exit(1)
})
