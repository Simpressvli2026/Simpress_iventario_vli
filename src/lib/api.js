const API_BASE = '/api'

export async function validarToken(token) {
  const res = await fetch(`${API_BASE}/validar-token?token=${token}`)
  return res.json()
}

export async function registrarDados(body) {
  const res = await fetch(`${API_BASE}/registrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function registrarPublico(body) {
  const res = await fetch(`${API_BASE}/registrar-publico`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function loginAdmin(username, password) {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return res.json()
}

export async function listarRegistros(token, params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await fetch(`${API_BASE}/admin/registros?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function enviarLink(token, body) {
  const res = await fetch(`${API_BASE}/admin/enviar-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function getRegistro(token, id) {
  const res = await fetch(`${API_BASE}/admin/registros/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function editarRegistro(token, id, body) {
  const res = await fetch(`${API_BASE}/admin/registros/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function deletarRegistro(token, id) {
  const res = await fetch(`${API_BASE}/admin/registros/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function alterarSenha(token, senha_atual, nova_senha) {
  const res = await fetch(`${API_BASE}/admin/alterar-senha`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ senha_atual, nova_senha }),
  })
  return res.json()
}
