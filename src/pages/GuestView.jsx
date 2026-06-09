import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { visualizarConvidado } from '../lib/api'

const CHECKLIST_P1 = [
  'check_integridade_fisica', 'check_relatorio_bateria', 'check_bios_senha', 'check_secure_boot',
  'check_login_local', 'check_hostname', 'check_dominio', 'check_ou_correta', 'check_gpupdate',
  'check_ativacao_windows', 'check_rede', 'check_remover_hp_support', 'check_instalar_hp_image',
  'check_atualizar_drivers_bios', 'check_ativar_hp_wxp', 'check_config_manager', 'check_bitlocker',
  'check_limpar_equipamento',
]
const CHECKLIST_P2 = [
  'check_backup_onedrive', 'check_instalar_softwares', 'check_validar_softwares', 'check_office_teams',
  'check_sincronizar_conta', 'check_migrar_certificados', 'check_fila_impressao', 'check_config_gerais',
  'check_assinatura_termo',
]
const CHECKLIST_P3 = [
  'check_embalar_antigo', 'check_identificar_caixa',
]
const CHECKLIST_ALL = [...CHECKLIST_P1, ...CHECKLIST_P2, ...CHECKLIST_P3]

function countChecks(r, list) {
  return list.filter(c => Number(r[c])).length
}

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

  function checklistSummary(r) {
    const total = countChecks(r, CHECKLIST_ALL)
    return `${total}/${CHECKLIST_ALL.length}`
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>Rollout &mdash; Visualização</h1>
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
            <div className="stat-label">Concluídos</div>
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
                <th>Técnico</th>
                <th>Usuário</th>
                <th>Notebook Novo</th>
                <th>Notebook Antigo</th>
                <th>Checklist</th>
                <th>Assinatura</th>
                <th>Fotos</th>
                <th>Data</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr><td colSpan="9" className="empty">Nenhum registro encontrado</td></tr>
              ) : (
                registros.map(r => (
                  <tr key={r.id}>
                    <td className="cell-name">{r.tecnico_nome || '-'}</td>
                    <td style={{ fontSize: 12 }}>{r.nome || '-'}</td>
                    <td><code style={{ fontSize: 12 }}>{r.notebook_novo_serial || '-'}</code></td>
                    <td><code style={{ fontSize: 12 }}>{r.notebook_antigo_serial || '-'}</code></td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{checklistSummary(r)}</td>
                    <td style={{ fontSize: 12 }}>
                      {r.assinatura_url ? (
                        <img src={r.assinatura_url} alt="Ass" className="foto-thumb" style={{ width: 28, height: 28 }} title={`${r.assinatura_nome || ''} - ${r.assinatura_matricula || ''}`} />
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.assinatura_nome ? `${r.assinatura_nome.slice(0, 15)}...` : '-'}</span>
                      )}
                    </td>
                    <td>
                      <div className="foto-thumbs">
                        {[r.foto1_url, r.foto2_url, r.foto3_url, r.foto4_url].filter(Boolean).map((url, i) => (
                          <img key={i} src={url} alt={`Foto ${i + 1}`} className="foto-thumb" onClick={() => setSelectedFoto(url)} />
                        ))}
                        {![r.foto1_url, r.foto2_url, r.foto3_url, r.foto4_url].some(Boolean) && <span className="no-fotos">-</span>}
                      </div>
                    </td>
                    <td className="cell-date">{new Date(r.enviado_em || r.criado_em).toLocaleString('pt-BR')}</td>
                    <td>
                      <span className={`status-badge ${r.enviado_em ? 'status-ok' : 'status-pendente'}`}>
                        {r.enviado_em ? 'Concluído' : 'Pendente'}
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