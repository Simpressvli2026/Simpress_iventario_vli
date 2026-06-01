import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listarRegistros, getRegistro, editarRegistro, deletarRegistro, alterarSenha, gerarConvite } from '../lib/api'
import * as XLSX from 'xlsx'

const TOTAL_NOTEBOOKS = 4000

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {}
}

function showBrowserNotification(title, body) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body, icon: '/favicon.ico' })
    })
  }
}

function Toast({ message, onClose }) {
  useEffect(() => {
    playNotificationSound()
    showBrowserNotification('SADA - Novo Registro', message)
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="toast">
      <div className="toast-icon">&#128226;</div>
      <div className="toast-body">
        <div className="toast-title">Novo Registro!</div>
        <div className="toast-msg">{message}</div>
      </div>
      <button className="toast-close" onClick={onClose}>&times;</button>
    </div>
  )
}

function countChecks(r, list) {
  return list.filter(c => Number(r[c])).length
}

function DetailModal({ registro, onClose, onEdit }) {
  if (!registro) return null
  const fotos = [registro.foto1_url, registro.foto2_url, registro.foto3_url, registro.foto4_url].filter(Boolean)

  const p1 = countChecks(registro, CHECKLIST_P1)
  const p2 = countChecks(registro, CHECKLIST_P2)
  const p3 = countChecks(registro, CHECKLIST_P3)
  const total = p1 + p2 + p3
  const totalMax = CHECKLIST_ALL.length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2 className="modal-title">Detalhes do Rollout VLI</h2>

        <div className="detail-grid">
          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">Técnico Responsável</span>
            <span className="detail-value">{registro.tecnico_nome || '-'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Notebook Novo (Série)</span>
            <span className="detail-value"><code>{registro.notebook_novo_serial || '-'}</code></span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Monitor Novo (Série)</span>
            <span className="detail-value"><code>{registro.monitor_novo_serial || '-'}</code></span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Notebook Antigo (Série)</span>
            <span className="detail-value"><code>{registro.notebook_antigo_serial || '-'}</code></span>
          </div>
          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">Usuário</span>
            <span className="detail-value">{registro.nome || '-'} ({registro.email || '-'})</span>
          </div>
          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">Estado do Notebook Antigo</span>
            <span className="detail-value">{registro.notebook_antigo_estado || '-'}</span>
          </div>

          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">Checklist — Fase 1 (Preparação)</span>
            <span className="detail-value">{p1}/{CHECKLIST_P1.length} itens concluídos</span>
          </div>
          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">Checklist — Fase 2 (Entrega)</span>
            <span className="detail-value">{p2}/{CHECKLIST_P2.length} itens concluídos</span>
          </div>
          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">Checklist — Fase 3 (Pós-Entrega)</span>
            <span className="detail-value">{p3}/{CHECKLIST_P3.length} itens concluídos</span>
          </div>
          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">Total do Checklist</span>
            <span className="detail-value">{total}/{totalMax} ({totalMax > 0 ? Math.round(total/totalMax*100) : 0}%)</span>
          </div>

          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">Assinatura do Técnico</span>
            <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span><strong>Nome:</strong> {registro.assinatura_nome || '-'}</span>
              <span><strong>Matrícula:</strong> {registro.assinatura_matricula || '-'}</span>
              {registro.assinatura_url && (
                <img src={registro.assinatura_url} alt="Assinatura" className="signature-thumb" />
              )}
            </span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Status</span>
            <span className={`status-badge ${registro.enviado_em ? 'status-ok' : 'status-pendente'}`}>
              {registro.enviado_em ? 'Concluído' : 'Pendente'}
            </span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Registrado em</span>
            <span className="detail-value">{registro.enviado_em ? new Date(registro.enviado_em).toLocaleString('pt-BR') : '-'}</span>
          </div>
        </div>

        {fotos.length > 0 && (
          <div className="detail-fotos">
            <span className="detail-label">Fotos</span>
            <div className="detail-fotos-grid">
              {fotos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Foto ${i + 1}`} className="detail-foto" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-sm" onClick={() => { onEdit(registro); onClose() }}>Editar</button>
          <button className="btn btn-sm btn-outline" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ registro, onClose, onSave, demo }) {
  const [form, setForm] = useState({ nome: '', email: '', serial: '', modelo_notebook: '', setor: '', observacao: '', com_mochila: false, com_carregador: false, com_teclado: false, com_mouse: false, assinatura_nome: '', assinatura_matricula: '', tipo_atuacao: '', endereco_rua: '', endereco_bairro: '', endereco_cidade: '', endereco_cep: '', tecnico_nome: '', notebook_novo_serial: '', monitor_novo_serial: '', notebook_antigo_serial: '', notebook_antigo_estado: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (registro) {
      const f = {
        nome: registro.nome || '',
        email: registro.email || '',
        serial: registro.serial || '',
        modelo_notebook: registro.modelo_notebook || '',
        setor: registro.setor || '',
        observacao: registro.observacao || '',
        com_mochila: !!Number(registro.com_mochila),
        com_carregador: !!Number(registro.com_carregador),
        com_teclado: !!Number(registro.com_teclado),
        com_mouse: !!Number(registro.com_mouse),
        assinatura_nome: registro.assinatura_nome || '',
        assinatura_matricula: registro.assinatura_matricula || '',
        tipo_atuacao: registro.tipo_atuacao || '',
        endereco_rua: registro.endereco_rua || '',
        endereco_bairro: registro.endereco_bairro || '',
        endereco_cidade: registro.endereco_cidade || '',
        endereco_cep: registro.endereco_cep || '',
        tecnico_nome: registro.tecnico_nome || '',
        notebook_novo_serial: registro.notebook_novo_serial || '',
        monitor_novo_serial: registro.monitor_novo_serial || '',
        notebook_antigo_serial: registro.notebook_antigo_serial || '',
        notebook_antigo_estado: registro.notebook_antigo_estado || '',
      }
      setForm(f)
    }
  }, [registro])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const data = await editarRegistro(localStorage.getItem('admin_token'), registro.id, form)
    if (data.sucesso) {
      onSave()
      onClose()
    } else {
      setError(data.error || 'Erro ao atualizar')
    }
    setSaving(false)
  }

  if (!registro) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2 className="modal-title">Editar Registro</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome</label>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Serial</label>
            <input value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Modelo</label>
            <input value={form.modelo_notebook} onChange={e => setForm({ ...form, modelo_notebook: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Setor</label>
            <input value={form.setor} onChange={e => setForm({ ...form, setor: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Tipo de Atuação</label>
            <select value={form.tipo_atuacao} onChange={e => setForm({ ...form, tipo_atuacao: e.target.value })} className="form-select">
              <option value="">Selecione...</option>
              <option value="Home Office">Home Office</option>
              <option value="Híbrido">Híbrido</option>
              <option value="Presencial Fixo">Presencial Fixo</option>
            </select>
          </div>
          <div className="form-group">
            <label>Endereço (Rua)</label>
            <input value={form.endereco_rua} onChange={e => setForm({ ...form, endereco_rua: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Bairro</label>
            <input value={form.endereco_bairro} onChange={e => setForm({ ...form, endereco_bairro: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Cidade</label>
            <input value={form.endereco_cidade} onChange={e => setForm({ ...form, endereco_cidade: e.target.value })} />
          </div>
          <div className="form-group">
            <label>CEP</label>
            <input value={form.endereco_cep} onChange={e => setForm({ ...form, endereco_cep: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Assinatura (Nome)</label>
            <input value={form.assinatura_nome} onChange={e => setForm({ ...form, assinatura_nome: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Matrícula</label>
            <input value={form.assinatura_matricula} onChange={e => setForm({ ...form, assinatura_matricula: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Acessórios</label>
            <div className="checkbox-group" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.com_mochila} onChange={e => setForm({ ...form, com_mochila: e.target.checked })} />
                <span>Mochila</span>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.com_carregador} onChange={e => setForm({ ...form, com_carregador: e.target.checked })} />
                <span>Carregador</span>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.com_teclado} onChange={e => setForm({ ...form, com_teclado: e.target.checked })} />
                <span>Teclado</span>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={form.com_mouse} onChange={e => setForm({ ...form, com_mouse: e.target.checked })} />
                <span>Mouse</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>Observações</label>
            <textarea value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} rows={3} />
          </div>
          <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid var(--gray-200)' }} />
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 12 }}>Dados do Rollout VLI</h4>
          <div className="form-group">
            <label>Técnico Responsável</label>
            <input value={form.tecnico_nome} onChange={e => setForm({ ...form, tecnico_nome: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Notebook Novo (Série)</label>
              <input value={form.notebook_novo_serial} onChange={e => setForm({ ...form, notebook_novo_serial: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Monitor Novo (Série)</label>
              <input value={form.monitor_novo_serial} onChange={e => setForm({ ...form, monitor_novo_serial: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Notebook Antigo (Série)</label>
            <input value={form.notebook_antigo_serial} onChange={e => setForm({ ...form, notebook_antigo_serial: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Estado do Notebook Antigo</label>
            <textarea value={form.notebook_antigo_estado} onChange={e => setForm({ ...form, notebook_antigo_estado: e.target.value })} rows={2} />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-sm" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" className="btn btn-sm btn-outline" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirm({ registro, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setError('')
    setDeleting(true)
    const data = await deletarRegistro(localStorage.getItem('admin_token'), registro.id)
    if (data.sucesso) {
      onDeleted()
      onClose()
    } else {
      setError(data.error || 'Erro ao excluir')
    }
    setDeleting(false)
  }

  if (!registro) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2 className="modal-title">Confirmar Exclusão</h2>
        <p style={{ marginBottom: 16, color: 'var(--gray-600)' }}>
          Tem certeza que deseja excluir o registro de <strong>{registro.nome}</strong>?
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-sm btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Excluindo...' : 'Excluir'}
          </button>
          <button className="btn btn-sm btn-outline" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function PasswordModal({ onClose }) {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (novaSenha.length < 6) { setError('A nova senha deve ter no mínimo 6 caracteres'); return }
    if (novaSenha !== confirmar) { setError('As senhas não conferem'); return }

    setSaving(true)
    const data = await alterarSenha(localStorage.getItem('admin_token'), senhaAtual, novaSenha)
    if (data.sucesso) {
      setSuccess('Senha alterada com sucesso!')
      setTimeout(onClose, 1500)
    } else {
      setError(data.error || 'Erro ao alterar senha')
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2 className="modal-title">Alterar Senha</h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Senha atual</label>
            <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} required placeholder="Digite a senha atual" />
          </div>
          <div className="form-group">
            <label>Nova senha (mín. 6 caracteres)</label>
            <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required placeholder="Nova senha" />
          </div>
          <div className="form-group">
            <label>Confirmar nova senha</label>
            <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} required placeholder="Confirme a nova senha" />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-sm" disabled={saving}>{saving ? 'Alterando...' : 'Alterar Senha'}</button>
            <button type="button" className="btn btn-sm btn-outline" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DEMO_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

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

const DEMO_DATA = [
  { id: 1, tecnico_nome: 'João Técnico', notebook_novo_serial: '5CG12345', monitor_novo_serial: 'MON001', notebook_antigo_serial: '5CG98765', notebook_antigo_estado: 'Bom estado, pequenos arranhões na tampa', nome: 'Ana Silva', email: 'ana.silga@vli.com.br', serial: '5CG12345', assinatura_nome: 'João Técnico', assinatura_matricula: '12345', assinatura_url: '', enviado_em: '2026-05-28T10:30:00', criado_em: '2026-05-25T08:00:00', foto1_url: '', foto2_url: '', foto3_url: '', foto4_url: '', token: 'abc123', check_integridade_fisica: 1, check_relatorio_bateria: 1, check_bios_senha: 1, check_secure_boot: 1, check_login_local: 1, check_hostname: 1, check_dominio: 1, check_ou_correta: 1, check_gpupdate: 1, check_ativacao_windows: 1, check_rede: 1, check_remover_hp_support: 1, check_instalar_hp_image: 1, check_atualizar_drivers_bios: 1, check_ativar_hp_wxp: 1, check_config_manager: 1, check_bitlocker: 1, check_limpar_equipamento: 1, check_backup_onedrive: 1, check_instalar_softwares: 1, check_validar_softwares: 1, check_office_teams: 1, check_sincronizar_conta: 1, check_migrar_certificados: 1, check_fila_impressao: 1, check_config_gerais: 1, check_assinatura_termo: 1, check_embalar_antigo: 1, check_identificar_caixa: 1 },
  { id: 2, tecnico_nome: 'Maria Técnica', notebook_novo_serial: '5CG54321', monitor_novo_serial: 'MON002', notebook_antigo_serial: '5CG11111', notebook_antigo_estado: 'Tela com risco, teclado funcionando', nome: 'Carlos Oliveira', email: 'carlos@vli.com.br', serial: '5CG54321', assinatura_nome: 'Maria Técnica', assinatura_matricula: '12346', assinatura_url: '', enviado_em: null, criado_em: '2026-05-26T09:00:00', foto1_url: '', foto2_url: '', foto3_url: '', foto4_url: '', token: 'def456', check_integridade_fisica: 1, check_relatorio_bateria: 1, check_bios_senha: 1, check_secure_boot: 1, check_login_local: 1, check_hostname: 0, check_dominio: 0, check_ou_correta: 0, check_gpupdate: 0, check_ativacao_windows: 0, check_rede: 0, check_remover_hp_support: 0, check_instalar_hp_image: 0, check_atualizar_drivers_bios: 0, check_ativar_hp_wxp: 0, check_config_manager: 0, check_bitlocker: 0, check_limpar_equipamento: 0, check_backup_onedrive: 0, check_instalar_softwares: 0, check_validar_softwares: 0, check_office_teams: 0, check_sincronizar_conta: 0, check_migrar_certificados: 0, check_fila_impressao: 0, check_config_gerais: 0, check_assinatura_termo: 0, check_embalar_antigo: 0, check_identificar_caixa: 0 },
]

export default function AdminDashboard() {
  const [allRegistros, setAllRegistros] = useState(() => {
    if (!DEMO_MODE) return []
    const saved = JSON.parse(localStorage.getItem('vli_registros') || '[]')
    return [...saved, ...DEMO_DATA]
  })
  const [busca, setBusca] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(!DEMO_MODE)
  const [error, setError] = useState('')
  const [selectedFoto, setSelectedFoto] = useState(null)
  const [detailRegistro, setDetailRegistro] = useState(null)
  const [editRegistro, setEditRegistro] = useState(null)
  const [deleteRegistro, setDeleteRegistro] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [conviteLink, setConviteLink] = useState('')
  const [gerandoConvite, setGerandoConvite] = useState(false)
  const [toast, setToast] = useState(null)
  const prevCount = useRef(0)
  const navigate = useNavigate()
  const token = localStorage.getItem('admin_token')

  const fetchRegistros = useCallback(async () => {
    if (DEMO_MODE) return
    if (!token) return
    const data = await listarRegistros(token)
    if (data.registros) {
      const registrados = data.registros.filter(r => r.enviado_em).length
      if (prevCount.current > 0 && registrados > prevCount.current) {
        setToast('Novo registro recebido!')
      }
      prevCount.current = registrados
      setAllRegistros(data.registros)
    } else {
      setError(data.error || 'Erro ao carregar')
    }
  }, [token])

  useEffect(() => {
    if (DEMO_MODE) { setLoading(false); return }
    if (!token) { navigate('/admin/login'); return }
    setLoading(true)
    fetchRegistros().then(() => setLoading(false))
    const interval = setInterval(fetchRegistros, 15000)
    return () => clearInterval(interval)
  }, [token, navigate, fetchRegistros])

  const stats = useMemo(() => {
    const total = allRegistros.length
    const registrados = allRegistros.filter(r => r.enviado_em).length
    const pendentes = total - registrados
    const porcentagem = TOTAL_NOTEBOOKS > 0 ? ((registrados / TOTAL_NOTEBOOKS) * 100) : 0
    return { total, registrados, pendentes, porcentagem }
  }, [allRegistros])

  const filteredRegistros = useMemo(() => {
    let list = allRegistros
    if (busca) {
      const term = busca.toLowerCase()
      list = list.filter(r =>
        (r.tecnico_nome || '').toLowerCase().includes(term) ||
        (r.nome || '').toLowerCase().includes(term) ||
        (r.notebook_novo_serial || '').toLowerCase().includes(term) ||
        (r.notebook_antigo_serial || '').toLowerCase().includes(term)
      )
    }
    if (statusFilter === 'pendente') list = list.filter(r => !r.enviado_em)
    else if (statusFilter === 'registrado') list = list.filter(r => r.enviado_em)
    return list
  }, [allRegistros, busca, statusFilter])

  async function handleRowClick(r) {
    if (DEMO_MODE) { setDetailRegistro(r); return }
    const data = await getRegistro(token, r.id)
    if (data.registro) setDetailRegistro(data.registro)
  }

  function handleEditClick(r, e) { e.stopPropagation(); setEditRegistro(r) }
  function handleDeleteClick(r, e) { e.stopPropagation(); setDeleteRegistro(r) }
  function handleLogout() { localStorage.removeItem('admin_token'); navigate('/admin/login') }

  async function handleGerarConvite() {
    setGerandoConvite(true)
    setConviteLink('')
    if (DEMO_MODE) {
      setConviteLink(`${window.location.origin}/registrar/demo-token-${Date.now()}`)
      setGerandoConvite(false)
      return
    }
    const data = await gerarConvite(token)
    if (data.link) {
      setConviteLink(data.link)
    } else {
      setError(data.error || 'Erro ao gerar link')
    }
    setGerandoConvite(false)
  }

  function exportXLSX() {
    const headers = ['Técnico', 'Notebook Novo', 'Monitor Novo', 'Notebook Antigo', 'Estado Antigo', 'Usuário', 'Email', 'Fase1 %', 'Fase2 %', 'Fase3 %', 'Total %', 'Assinatura', 'Matrícula', 'Data', 'Status']
    const data = filteredRegistros.map(r => {
      const p1 = countChecks(r, CHECKLIST_P1)
      const p2 = countChecks(r, CHECKLIST_P2)
      const p3 = countChecks(r, CHECKLIST_P3)
      const total = p1 + p2 + p3
      const totalMax = CHECKLIST_ALL.length
      return {
        'Técnico': r.tecnico_nome || '',
        'Notebook Novo': r.notebook_novo_serial || '',
        'Monitor Novo': r.monitor_novo_serial || '',
        'Notebook Antigo': r.notebook_antigo_serial || '',
        'Estado Antigo': r.notebook_antigo_estado || '',
        'Usuário': r.nome || '',
        'Email': r.email || '',
        'Fase1 %': totalMax > 0 ? `${Math.round(p1/CHECKLIST_P1.length*100)}%` : '',
        'Fase2 %': totalMax > 0 ? `${Math.round(p2/CHECKLIST_P2.length*100)}%` : '',
        'Fase3 %': totalMax > 0 ? `${Math.round(p3/CHECKLIST_P3.length*100)}%` : '',
        'Total %': totalMax > 0 ? `${Math.round(total/totalMax*100)}%` : '',
        'Assinatura': r.assinatura_nome || '',
        'Matrícula': r.assinatura_matricula || '',
        'Data': r.enviado_em || r.criado_em,
        'Status': r.enviado_em ? 'Concluído' : 'Pendente',
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Registros')
    XLSX.writeFile(wb, `registros_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function checklistSummary(r) {
    const p1 = countChecks(r, CHECKLIST_P1)
    const p2 = countChecks(r, CHECKLIST_P2)
    const p3 = countChecks(r, CHECKLIST_P3)
    const total = p1 + p2 + p3
    const totalMax = CHECKLIST_ALL.length
    return `${total}/${totalMax}`
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-left">
            <img src="/logo-vli.svg" alt="VLI" className="admin-header-logo" />
            <div className="admin-header-divider" />
            <h1>Rollout VLI</h1>
          </div>
          <div className="admin-header-actions">
            <button className="btn" onClick={() => navigate('/admin/enviar')}>Links</button>
            <button className="btn" onClick={handleGerarConvite} disabled={gerandoConvite}>{gerandoConvite ? 'Gerando...' : 'Link Convidado'}</button>
            <button className="btn" onClick={() => setShowPasswordModal(true)}>Alterar Senha</button>
            <button className="btn btn-logout" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      </header>

      <main className="admin-main">
        {loading ? (
          <div className="page-center" style={{ minHeight: 400 }}><div className="spinner" /></div>
        ) : (
          <>
            <div className="stats-grid">
                <div className="stat-card stat-total">
                  <div className="stat-label">Total de Checklists</div>
                  <div className="stat-value">{stats.total}</div>
                  <div className="stat-sub">rollouts iniciados</div>
                </div>
                <div className="stat-card stat-ok">
                  <div className="stat-label">Concluídos</div>
                  <div className="stat-value">{stats.registrados}</div>
                  <div className="stat-sub">rollouts finalizados</div>
                </div>
                <div className="stat-card stat-pending">
                  <div className="stat-label">Pendentes</div>
                  <div className="stat-value">{stats.pendentes}</div>
                  <div className="stat-sub">aguardando conclusão</div>
                </div>
                <div className="stat-card stat-meta">
                  <div className="stat-label">Meta Total</div>
                  <div className="stat-value">{TOTAL_NOTEBOOKS}</div>
                  <div className="stat-sub">equipamentos a entregar</div>
                </div>
            </div>

            <div className="progress-section">
              <div className="progress-header">
                <span className="progress-title">Progresso do Rollout VLI</span>
                <span className="progress-percent">{stats.porcentagem.toFixed(1)}%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${Math.min(stats.porcentagem, 100)}%` }} />
              </div>
              <div className="progress-footer">
                <span>{stats.registrados} de {TOTAL_NOTEBOOKS} equipamentos entregues</span>
                <span>{Math.round(TOTAL_NOTEBOOKS - stats.registrados)} restantes</span>
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {conviteLink && (
              <div className="link-box" style={{ marginBottom: 20 }}>
                <label>Link de convite (uso único) — compartilhe com quem precisa visualizar</label>
                <div className="link-row">
                  <input className="link-input" value={conviteLink} readOnly onClick={e => e.target.select()} />
                  <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(conviteLink); setConviteLink('') }}>Copiar</button>
                </div>
              </div>
            )}

            <div className="admin-toolbar">
              <div className="toolbar-left">
                <input className="search-input" placeholder="Buscar por nome, serial ou email..." value={busca} onChange={e => setBusca(e.target.value)} />
                <div className="filter-group">
                  <button className={`filter-btn ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>Todos ({stats.total})</button>
                  <button className={`filter-btn ${statusFilter === 'pendente' ? 'active' : ''}`} onClick={() => setStatusFilter('pendente')}>Pendentes ({stats.pendentes})</button>
                  <button className={`filter-btn ${statusFilter === 'registrado' ? 'active' : ''}`} onClick={() => setStatusFilter('registrado')}>Concluídos ({stats.registrados})</button>
                </div>
              </div>
              <div className="toolbar-right">
                <span className="reg-count">{filteredRegistros.length} registro(s)</span>
                <button className="btn btn-outline btn-sm" onClick={exportXLSX}>Exportar XLSX</button>
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
                    <th style={{ width: 80 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistros.length === 0 ? (
                    <tr><td colSpan="10" className="empty">Nenhum registro encontrado</td></tr>
                  ) : (
                    filteredRegistros.map(r => (
                      <tr key={r.id} className="clickable-row" onClick={() => handleRowClick(r)}>
                        <td className="cell-name">{r.tecnico_nome || <span className="empty-field">-</span>}</td>
                        <td style={{ fontSize: 12 }}>{r.nome || <span className="empty-field">-</span>}</td>
                        <td><code style={{ fontSize: 12 }}>{r.notebook_novo_serial || '-'}</code></td>
                        <td><code style={{ fontSize: 12 }}>{r.notebook_antigo_serial || '-'}</code></td>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>{checklistSummary(r)}</td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {r.assinatura_url ? (
                            <img src={r.assinatura_url} alt="Ass" className="foto-thumb" style={{ width: 28, height: 28 }} title={`${r.assinatura_nome || ''} - ${r.assinatura_matricula || ''}`} />
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.assinatura_nome ? `${r.assinatura_nome.slice(0, 15)}...` : '-'}</span>
                          )}
                        </td>
                        <td>
                          <div className="foto-thumbs">
                            {[r.foto1_url, r.foto2_url, r.foto3_url, r.foto4_url].filter(Boolean).map((url, i) => (
                              <img key={i} src={url} alt={`Foto ${i + 1}`} className="foto-thumb" onClick={e => { e.stopPropagation(); setSelectedFoto(url) }} />
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
                        <td>
                          <div className="row-actions">
                            <button className="action-btn" title="Editar" onClick={(e) => handleEditClick(r, e)}>&#9998;</button>
                            <button className="action-btn action-delete" title="Excluir" onClick={(e) => handleDeleteClick(r, e)}>&#10005;</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {selectedFoto && (
        <div className="overlay" onClick={() => setSelectedFoto(null)}>
          <div className="overlay-content" onClick={e => e.stopPropagation()}>
            <button className="overlay-close" onClick={() => setSelectedFoto(null)}>&times;</button>
            <img src={selectedFoto} alt="Foto ampliada" className="overlay-img" />
          </div>
        </div>
      )}

      {showPasswordModal && <PasswordModal onClose={() => setShowPasswordModal(false)} />}

      <DetailModal registro={detailRegistro} onClose={() => setDetailRegistro(null)} onEdit={(r) => setEditRegistro(r)} />
      <EditModal registro={editRegistro} onClose={() => setEditRegistro(null)} onSave={fetchRegistros} />
      <DeleteConfirm registro={deleteRegistro} onClose={() => setDeleteRegistro(null)} onDeleted={fetchRegistros} />
    </div>
  )
}
