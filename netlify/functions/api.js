import { createClient } from '@libsql/client'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'node:crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'sada-admin-secret-2024'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const SITE_URL = process.env.SITE_URL || 'https://sadanotebook.netlify.app'

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

async function handleRegistrar(event) {
  try {
    const { token, nome, email, serial, modelo_notebook, foto1_url, foto2_url, foto3_url, foto4_url, observacao, com_mochila, com_carregador, com_teclado, com_mouse, setor, assinatura_nome, assinatura_matricula, assinatura_url, tipo_atuacao, endereco_rua, endereco_bairro, endereco_cidade, endereco_cep } = getBody(event)

    if (!token || !nome || !email || !serial) {
      return json({ error: 'Campos obrigatórios: token, nome, email, serial' }, 400)
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

    const serialResult = await client.execute({
      sql: 'SELECT nome, criado_em FROM registros WHERE serial = ?',
      args: [serial],
    })

    if (serialResult.rows.length > 0) {
      const existing = serialResult.rows[0]
      return json({
        error: `Este equipamento já foi registrado em ${existing.criado_em} por ${existing.nome}`,
      }, 409)
    }

    await client.execute({
      sql: `UPDATE registros SET
        nome = ?, email = ?, celular = ?, serial = ?,
        modelo_notebook = ?, foto1_url = ?, foto2_url = ?, foto3_url = ?, foto4_url = ?,
        observacao = ?, com_mochila = ?, com_carregador = ?, com_teclado = ?, com_mouse = ?, setor = ?,
        assinatura_nome = ?, assinatura_matricula = ?, assinatura_url = ?, tipo_atuacao = ?,
        endereco_rua = ?, endereco_bairro = ?, endereco_cidade = ?, endereco_cep = ?,
        enviado_em = ?
      WHERE token = ?`,
      args: [nome, email, '', serial, modelo_notebook || null, foto1_url || null, foto2_url || null, foto3_url || null, foto4_url || null, observacao || null, com_mochila ? 1 : 0, com_carregador ? 1 : 0, com_teclado ? 1 : 0, com_mouse ? 1 : 0, setor || null, assinatura_nome || null, assinatura_matricula || null, assinatura_url || null, tipo_atuacao || null, endereco_rua || null, endereco_bairro || null, endereco_cidade || null, endereco_cep || null, new Date().toISOString(), token],
    })

    return json({ sucesso: true, mensagem: 'Registro concluído com sucesso!' })
  } catch (err) {
    console.error('Erro em handleRegistrar:', err)
    return json({ error: 'Erro interno ao registrar: ' + err.message }, 500)
  }
}

async function handleRegistrarPublico(event) {
  try {
    const { nome, email, serial, modelo_notebook, foto1_url, foto2_url, foto3_url, foto4_url, observacao, com_mochila, com_carregador, com_teclado, com_mouse, setor, assinatura_nome, assinatura_matricula, assinatura_url, tipo_atuacao, endereco_rua, endereco_bairro, endereco_cidade, endereco_cep } = getBody(event)

    if (!nome || !email || !serial) {
      return json({ error: 'Campos obrigatórios: nome, email, serial' }, 400)
    }

    const client = getDb()

    const serialResult = await client.execute({
      sql: 'SELECT nome, criado_em FROM registros WHERE serial = ?',
      args: [serial],
    })

    if (serialResult.rows.length > 0) {
      const existing = serialResult.rows[0]
      return json({
        error: `Este equipamento já foi registrado em ${existing.criado_em} por ${existing.nome}`,
      }, 409)
    }

    const token = uuidv4()

    await client.execute({
      sql: `INSERT INTO registros (token, nome, email, celular, serial, modelo_notebook,
        foto1_url, foto2_url, foto3_url, foto4_url, observacao, com_mochila, com_carregador, com_teclado, com_mouse, setor,
        assinatura_nome, assinatura_matricula, assinatura_url, tipo_atuacao,
        endereco_rua, endereco_bairro, endereco_cidade, endereco_cep, enviado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [token, nome, email, '', serial, modelo_notebook || null,
        foto1_url || null, foto2_url || null, foto3_url || null, foto4_url || null,
        observacao || null, com_mochila ? 1 : 0, com_carregador ? 1 : 0, com_teclado ? 1 : 0, com_mouse ? 1 : 0, setor || null,
        assinatura_nome || null, assinatura_matricula || null, assinatura_url || null, tipo_atuacao || null,
        endereco_rua || null, endereco_bairro || null, endereco_cidade || null, endereco_cep || null, new Date().toISOString()],
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
    sql += ' AND (nome LIKE ? OR email LIKE ? OR serial LIKE ? OR assinatura_matricula LIKE ?)'
    const term = `%${busca}%`
    args.push(term, term, term, term)
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
  const { nome, email, serial, modelo_notebook, observacao, com_mochila, com_carregador, com_teclado, com_mouse, setor, assinatura_nome, assinatura_matricula, tipo_atuacao, endereco_rua, endereco_bairro, endereco_cidade, endereco_cep } = getBody(event)

  if (!nome || !email || !serial) {
    return json({ error: 'Campos obrigatórios: nome, email, serial' }, 400)
  }

  const client = getDb()

  const existing = await client.execute({
    sql: 'SELECT id FROM registros WHERE serial = ? AND id != ?',
    args: [serial, id],
  })

  if (existing.rows.length > 0) {
    return json({ error: 'Este número de série já está em uso por outro registro' }, 409)
  }

    await client.execute({
    sql: `UPDATE registros SET nome = ?, email = ?, celular = ?, serial = ?,
      modelo_notebook = ?, observacao = ?, com_mochila = ?, com_carregador = ?, com_teclado = ?, com_mouse = ?, setor = ?,
      assinatura_nome = ?, assinatura_matricula = ?, assinatura_url = ?, tipo_atuacao = ?,
      endereco_rua = ?, endereco_bairro = ?, endereco_cidade = ?, endereco_cep = ?
    WHERE id = ?`,
    args: [nome, email, '', serial, modelo_notebook || null, observacao || null, com_mochila ? 1 : 0, com_carregador ? 1 : 0, com_teclado ? 1 : 0, com_mouse ? 1 : 0, setor || null, assinatura_nome || null, assinatura_matricula || null, assinatura_url || null, tipo_atuacao || null, endereco_rua || null, endereco_bairro || null, endereco_cidade || null, endereco_cep || null, id],
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
