import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginAdmin } from '../lib/api'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const data = await loginAdmin(username, password)
    if (data.token) {
      localStorage.setItem('admin_token', data.token)
      navigate('/admin')
    } else {
      setError(data.error || 'Credenciais inválidas')
    }
    setLoading(false)
  }

  return (
    <div className="page-center">
      <div className="card login-card">
        <div className="logo">SADA</div>
        <h2>Admin - Registro de Notebooks</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuário</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              placeholder="admin"
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="******"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
