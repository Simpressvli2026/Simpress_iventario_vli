import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginAdmin } from '../lib/api'

const DEMO_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

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

    if (DEMO_MODE) {
      if (username === 'admin' && password === 'admin123') {
        localStorage.setItem('admin_token', 'demo-token')
        navigate('/admin')
      } else {
        setError('Credenciais inválidas. Tente: admin / admin123')
      }
      setLoading(false)
      return
    }

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
    <div className="page-center login-bg">
      <div className="card login-card">
        <div className="logo">
          <div className="logo-simpress-wrapper">
            <img src="/logo-simpress.png" alt="Simpress" className="logo-img" />
            <span className="logo-hp">an HP Company</span>
          </div>
        </div>
        <h2>Checklist de Preparação e Entrega</h2>
        <p className="subtitle">Entre com suas credenciais de administrador</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuário</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              placeholder="Digite seu usuário"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Digite sua senha"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? (
              <><span className="spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> Entrando...</>
            ) : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
