import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { visualizarConvidado } from '../lib/api'

export default function GuestView() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [registros, setRegistros] = useState([])
  const [selectedFoto, setSelectedFoto] = useState(null)

  useEffect(() => {
    async function load() {
      const data = await visualizarConvidado(token)
      if (data.registros) {
        setRegistros(data.registros)
      } else {
        setError(data.error || 'Link inválido ou expirado')
      }
      setLoading(false)
    }
    load()
  }, [token])

  const stats = useMemo(() => {
    const total = registros.length
    const registrados = registros.filter(r => r.enviado_em).length
    const pendentes = total - registrados
    return { total, registrados, pendentes }
  }, [registros])

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner" />
        <p>Carregando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-center">
        <div className="card error-card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--error)', marginBottom: 8 }}>Link inválido</h2>
          <p>{error}</p>
          <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => navigate('/')}>Voltar</button>
        </div>
      </div>
    )
  }

  function acessoriosText(r) {
    const items = []
    if (Number(r.com_mochila)) items.push('Mochila')
    if (Number(r.com_carregador)) items.push('Carregador')
    if (Number(r.com_teclado)) items.push('Teclado')
    if (Number(r.com_mouse)) items.push('Mouse')
    return items.length ? items.join(', ') : '-'
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>SADA &mdash; Visualização de Registros</h1>
          <span style={{ fontSize: 13, opacity: 0.7 }}>Modo convidado &mdash; apenas visualização</span>
        </div>
      </header>

      <main className="admin-main">
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card stat-total">
            <div className="stat-label">Total de Registros</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card stat-ok">
            <div className="stat-label">Registrados</div>
            <div className="stat-value">{stats.registrados}</div>
          </div>
          <div className="stat-card stat-pending">
            <div className="stat-label">Pendentes</div>
            <div className="stat-value">{stats.pendentes}</div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Serial</th>
                <th>Modelo</th>
                <th>Setor</th>
                <th>Atuação</th>
                <th>Acessórios</th>
                <th>Assinatura</th>
                <th>Observações</th>
                <th>Data</th>
                <th>Fotos</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr><td colSpan="12" className="empty">Nenhum registro encontrado</td></tr>
              ) : (
                registros.map(r => (
                  <tr key={r.id}>
                    <td className="cell-name">{r.nome || '-'}</td>
                    <td>{r.email || '-'}</td>
                    <td><code>{r.serial}</code></td>
                    <td>{r.modelo_notebook || '-'}</td>
                    <td style={{ fontSize: 13 }}>{r.setor || '-'}</td>
                    <td style={{ fontSize: 13 }}>{r.tipo_atuacao || '-'}</td>
                    <td style={{ fontSize: 12 }}>{acessoriosText(r)}</td>
                    <td style={{ fontSize: 12 }}>
                      {r.assinatura_url ? (
                        <img src={r.assinatura_url} alt="Ass" className="foto-thumb" style={{ width: 28, height: 28 }} title={`${r.assinatura_nome || ''} - ${r.assinatura_matricula || ''}`} />
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.assinatura_nome ? `${r.assinatura_nome.slice(0, 15)}...` : '-'}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.observacao || '-'}
                    </td>
                    <td className="cell-date">{new Date(r.enviado_em || r.criado_em).toLocaleString('pt-BR')}</td>
                    <td>
                      <div className="foto-thumbs">
                        {[r.foto1_url, r.foto2_url, r.foto3_url, r.foto4_url].filter(Boolean).map((url, i) => (
                          <img key={i} src={url} alt={`Foto ${i + 1}`} className="foto-thumb" onClick={() => setSelectedFoto(url)} />
                        ))}
                        {![r.foto1_url, r.foto2_url, r.foto3_url, r.foto4_url].some(Boolean) && <span className="no-fotos">-</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${r.enviado_em ? 'status-ok' : 'status-pendente'}`}>
                        {r.enviado_em ? 'Registrado' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {selectedFoto && (
        <div className="overlay" onClick={() => setSelectedFoto(null)}>
          <div className="overlay-content" onClick={e => e.stopPropagation()}>
            <button className="overlay-close" onClick={() => setSelectedFoto(null)}>&times;</button>
            <img src={selectedFoto} alt="Foto" className="overlay-img" />
          </div>
        </div>
      )}
    </div>
  )
}