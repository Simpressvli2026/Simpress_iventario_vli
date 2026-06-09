import { useState, useRef } from 'react'
import { registrarPublico } from '../lib/api'
import SignatureCanvas from 'react-signature-canvas'

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const DEMO_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const CHECKLIST_P1 = [
  { id: 'check_integridade_fisica', label: 'Validar integridade física do equipamento (tela, teclado, bateria, câmera, som)' },
  { id: 'check_relatorio_bateria', label: 'Gerar e salvar relatório de bateria' },
  { id: 'check_bios_senha', label: 'Validar senha do BIOS' },
  { id: 'check_secure_boot', label: 'Validar/ativar Secure Boot' },
  { id: 'check_login_local', label: 'Realizar login com usuário local' },
  { id: 'check_hostname', label: 'Alterar hostname conforme padrão VLI' },
  { id: 'check_dominio', label: 'Ingressar equipamento no domínio' },
  { id: 'check_ou_correta', label: 'Validar se está na OU correta' },
  { id: 'check_gpupdate', label: 'Executar atualização de políticas (gpupdate /force)' },
  { id: 'check_ativacao_windows', label: 'Validar ativação do Windows' },
  { id: 'check_rede', label: 'Validar configuração de rede (Wi-Fi, energia, DNS)' },
  { id: 'check_remover_hp_support', label: 'Remover HP Support Assistant' },
  { id: 'check_instalar_hp_image', label: 'Instalação do HP Image Assistant' },
  { id: 'check_atualizar_drivers_bios', label: 'Atualizar drivers e BIOS (HP Image Assistant)' },
  { id: 'check_ativar_hp_wxp', label: 'Ativar HP WXP' },
  { id: 'check_config_manager', label: 'Validar Configuration Manager (7 ciclos)' },
  { id: 'check_bitlocker', label: 'Validar BitLocker ativo (100%)' },
  { id: 'check_limpar_equipamento', label: 'Limpar equipamento para entrega' },
]

const CHECKLIST_P2 = [
  { id: 'check_backup_onedrive', label: 'Confirmar backup do usuário (OneDrive)' },
  { id: 'check_instalar_softwares', label: 'Instalar softwares homologados' },
  { id: 'check_validar_softwares', label: 'Validar funcionamento dos softwares' },
  { id: 'check_office_teams', label: 'Ativar pacote Office e Teams com usuário' },
  { id: 'check_sincronizar_conta', label: 'Realizar sincronização da conta Microsoft' },
  { id: 'check_migrar_certificados', label: 'Migrar certificados' },
  { id: 'check_fila_impressao', label: 'Mapear fila de impressão' },
  { id: 'check_config_gerais', label: 'Validar configurações gerais com o usuário' },
  { id: 'check_assinatura_termo', label: 'Garantir assinatura do termo de responsabilidade' },
]

const CHECKLIST_P3 = [
  { id: 'check_embalar_antigo', label: 'Embalar equipamento antigo na caixa do novo' },
  { id: 'check_identificar_caixa', label: 'Identificar caixa (nome do usuário + série)' },
]

const FOTO_COUNT = 6

function buildInitialForm() {
  const f = {
    tecnico_nome: '',
    notebook_novo_serial: '',
    monitor_novo_serial: '',
    notebook_antigo_serial: '',
    notebook_antigo_estado: '',
    foto1_url: '', foto2_url: '', foto3_url: '', foto4_url: '', foto5_url: '', foto6_url: '',
    assinatura_nome: '',
    assinatura_matricula: '',
    assinatura_url: '',
  }
  for (const item of [...CHECKLIST_P1, ...CHECKLIST_P2, ...CHECKLIST_P3]) {
    f[item.id] = false
  }
  return f
}

export default function RegistroPage() {
  const [form, setForm] = useState(buildInitialForm)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(Array(FOTO_COUNT).fill(false))
  const [previews, setPreviews] = useState(Array(FOTO_COUNT).fill(null))
  const [signatureUploading, setSignatureUploading] = useState(false)
  const cameraInputs = Array.from({ length: FOTO_COUNT }, () => useRef())
  const galleryInputs = Array.from({ length: FOTO_COUNT }, () => useRef())
  const sigRef = useRef()
  const formRef = useRef()

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleUpload(index, inputRef) {
    if (DEMO_MODE) {
      setPreviews(prev => { const n = [...prev]; n[index] = '/placeholder-foto.jpg'; return n })
      return
    }
    const file = inputRef.current?.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('A foto deve ter no máximo 5MB'); return }
    setError('')
    setUploading(prev => { const n = [...prev]; n[index] = true; return n })
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', UPLOAD_PRESET)
    fd.append('folder', 'vli_rollout')
    try {
      const res = await fetch(url, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        const key = `foto${index + 1}_url`
        setForm(prev => ({ ...prev, [key]: data.secure_url }))
        setPreviews(prev => { const n = [...prev]; n[index] = data.secure_url; return n })
      } else { setError('Erro ao fazer upload da imagem') }
    } catch { setError('Erro ao conectar com Cloudinary') }
    finally { setUploading(prev => { const n = [...prev]; n[index] = false; return n }) }
  }

  function removeFoto(index) {
    const key = `foto${index + 1}_url`
    setForm(prev => ({ ...prev, [key]: '' }))
    setPreviews(prev => { const n = [...prev]; n[index] = null; return n })
    if (cameraInputs[index].current) cameraInputs[index].current.value = ''
    if (galleryInputs[index].current) galleryInputs[index].current.value = ''
  }

  async function uploadSignature(blob) {
    if (DEMO_MODE) {
      setForm(prev => ({ ...prev, assinatura_url: '/placeholder-assinatura.png' }))
      return
    }
    setSignatureUploading(true)
    setError('')
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
    const fd = new FormData()
    fd.append('file', blob, 'assinatura.png')
    fd.append('upload_preset', UPLOAD_PRESET)
    fd.append('folder', 'vli_rollout')
    try {
      const res = await fetch(url, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) { setForm(prev => ({ ...prev, assinatura_url: data.secure_url })) }
      else { setError('Erro ao enviar assinatura') }
    } catch { setError('Erro ao conectar com Cloudinary') }
    finally { setSignatureUploading(false) }
  }

  function handleSignatureEnd() {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      const canvas = sigRef.current.getTrimmedCanvas()
      canvas.toBlob(blob => { if (blob) uploadSignature(blob) })
    }
  }

  function clearSignature() {
    sigRef.current?.clear()
    setForm(prev => ({ ...prev, assinatura_url: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const checklistAll = [...CHECKLIST_P1, ...CHECKLIST_P2, ...CHECKLIST_P3]
    const unchecked = checklistAll.filter(item => !form[item.id])
    if (unchecked.length > 0) {
      setError(`Todos os itens do checklist devem ser confirmados. Faltam ${unchecked.length} item(ns).`)
      formRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    const missingFotos = Array.from({ length: FOTO_COUNT }, (_, i) => form[`foto${i + 1}_url`]).filter(Boolean).length
    if (missingFotos < FOTO_COUNT && !DEMO_MODE) { setError('Todas as 6 fotos são obrigatórias'); formRef.current?.scrollIntoView({ behavior: 'smooth' }); return }
    if (!form.assinatura_url) { setError('Desenhe sua assinatura no campo abaixo'); formRef.current?.scrollIntoView({ behavior: 'smooth' }); return }

    if (DEMO_MODE) {
      const saved = JSON.parse(localStorage.getItem('vli_registros') || '[]')
      saved.unshift({ ...form, criado_em: new Date().toISOString(), id: Date.now() })
      localStorage.setItem('vli_registros', JSON.stringify(saved))
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setForm(buildInitialForm())
        setPreviews(Array(FOTO_COUNT).fill(null))
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 2000)
      return
    }

    setSubmitting(true)
    try {
      const result = await registrarPublico(form)
      if (result.sucesso) {
        setSuccess(true)
        setTimeout(() => {
          setSuccess(false)
          setForm(buildInitialForm())
          setPreviews(Array(FOTO_COUNT).fill(null))
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }, 2000)
      } else { setError(result.error || 'Erro ao registrar') }
    } catch (err) { setError('Erro de conexão: ' + (err.message || 'erro inesperado')) }
    setSubmitting(false)
  }

  return (
    <div className="page-center vli-bg">
      <div className="card form-card form-card-wide">
        <div className="logo">
          <div className="logo-simpress-wrapper">
            <img src="/logo-simpress.png" alt="Simpress" className="logo-img" />
            <span className="logo-hp">an HP Company</span>
          </div>
        </div>
        <h2>Checklist de Preparação e Entrega</h2>
        <p className="subtitle">Preencha todos os campos e confirme cada etapa do processo</p>

        {success && (
          <div className="alert alert-success" style={{ textAlign: 'center', padding: '16px', fontSize: 15, fontWeight: 700 }}>
            &#10003; Concluído com sucesso! O formulário será limpo...
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} ref={formRef}>
          {/* INITIAL FIELDS */}
          <fieldset className="form-fieldset">
            <legend>Dados do Técnico e Equipamentos</legend>
            <div className="form-group">
              <label>Nome do técnico *</label>
              <input name="tecnico_nome" value={form.tecnico_nome} onChange={handleChange} required placeholder="Nome completo do técnico" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Série do notebook novo *</label>
                <input name="notebook_novo_serial" value={form.notebook_novo_serial} onChange={handleChange} required placeholder="Ex: 5CGXXXX" />
              </div>
              <div className="form-group">
                <label>Série do monitor novo *</label>
                <input name="monitor_novo_serial" value={form.monitor_novo_serial} onChange={handleChange} required placeholder="Ex: ABC123" />
              </div>
            </div>
            <div className="form-group">
              <label>Série do notebook antigo *</label>
              <input name="notebook_antigo_serial" value={form.notebook_antigo_serial} onChange={handleChange} required placeholder="Série do equipamento antigo" />
            </div>
            <div className="form-group">
              <label>Descreva o estado do notebook antigo, informando se há avarias ou danos identificados *</label>
              <textarea name="notebook_antigo_estado" value={form.notebook_antigo_estado} onChange={handleChange} required placeholder="Descreva o estado, avarias, danos, etc..." rows={2} />
            </div>
          </fieldset>

          {/* PHOTOS */}
          <fieldset className="form-fieldset">
            <legend>Fotos</legend>
            <div className="form-group">
              <label>Fotos do equipamento novo (com nº de série) e do equipamento antigo (estado e nº de série)</label>
              <div className="fotos-grid">
                {Array.from({ length: FOTO_COUNT }, (_, i) => i).map(i => (
                  <div key={i} className="foto-item">
                    <div className="foto-upload">
                      <input ref={cameraInputs[i]} type="file" accept="image/*" capture="environment" hidden onChange={() => handleUpload(i, cameraInputs[i])} />
                      <input ref={galleryInputs[i]} type="file" accept="image/*" hidden onChange={() => handleUpload(i, galleryInputs[i])} />
                      {uploading[i] ? (
                        <div className="uploading"><div className="spinner-sm" /><span>Enviando...</span></div>
                      ) : previews[i] ? (
                        <div className="preview-wrapper">
                          <img src={previews[i]} alt={`Foto ${i + 1}`} />
                          <button type="button" className="remove-foto" onClick={(e) => { e.stopPropagation(); removeFoto(i) }}>&times;</button>
                        </div>
                      ) : (
                        <div className="upload-placeholder">
                          <span className="plus-icon">+</span>
                          <span>Foto {i + 1}</span>
                        </div>
                      )}
                      {!previews[i] && !uploading[i] && (
                        <div className="foto-options">
                          <button type="button" className="foto-option-btn" onClick={() => cameraInputs[i].current?.click()}>&#128247; Câmera</button>
                          <button type="button" className="foto-option-btn" onClick={() => galleryInputs[i].current?.click()}>&#128193; Galeria</button>
                        </div>
                      )}
                    </div>
                    <div className="foto-legenda">
                      {i === 0 && <span>Equipamento novo — vista frontal</span>}
                      {i === 1 && <span>Equipamento novo — número de série</span>}
                      {i === 2 && <span>Monitor novo — número de série</span>}
                      {i === 3 && <span>Equipamento antigo — estado geral</span>}
                      {i === 4 && <span>Equipamento antigo — número de série</span>}
                      {i === 5 && <span>Monitor antigo — número de série</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </fieldset>

          {/* PHASE 1 */}
          <fieldset className="form-fieldset phase-phase1">
            <legend className="phase-legend">
              <span className="phase-badge phase-1">1</span>
              Preparação da Máquina <span className="phase-sub">(antes da entrega)</span>
            </legend>
            <p className="phase-intro">Confirme cada etapa concluída na preparação do equipamento:</p>
            <div className="checklist-grid">
              {CHECKLIST_P1.map(item => (
                <label key={item.id} className={`checklist-item ${form[item.id] ? 'checklist-done' : ''}`}>
                  <span className="checklist-check">
                    {form[item.id] ? '✓' : ''}
                  </span>
                  <input type="checkbox" name={item.id} checked={form[item.id]} onChange={handleChange} hidden />
                  <span className="checklist-label">{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* PHASE 2 */}
          <fieldset className="form-fieldset phase-phase2">
            <legend className="phase-legend">
              <span className="phase-badge phase-2">2</span>
              Entrega ao Usuário
            </legend>
            <p className="phase-intro">Confirme cada etapa concluída durante a entrega:</p>
            <div className="checklist-grid">
              {CHECKLIST_P2.map(item => (
                <label key={item.id} className={`checklist-item ${form[item.id] ? 'checklist-done' : ''}`}>
                  <span className="checklist-check">
                    {form[item.id] ? '✓' : ''}
                  </span>
                  <input type="checkbox" name={item.id} checked={form[item.id]} onChange={handleChange} hidden />
                  <span className="checklist-label">{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* PHASE 3 */}
          <fieldset className="form-fieldset phase-phase3">
            <legend className="phase-legend">
              <span className="phase-badge phase-3">3</span>
              Pós-Entrega
            </legend>
            <p className="phase-intro">Confirme as etapas finais:</p>
            <div className="checklist-grid">
              {CHECKLIST_P3.map(item => (
                <label key={item.id} className={`checklist-item ${form[item.id] ? 'checklist-done' : ''}`}>
                  <span className="checklist-check">
                    {form[item.id] ? '✓' : ''}
                  </span>
                  <input type="checkbox" name={item.id} checked={form[item.id]} onChange={handleChange} hidden />
                  <span className="checklist-label">{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* SIGNATURE */}
          <fieldset className="form-fieldset">
            <legend>Assinatura do Técnico</legend>
            <div className="form-group">
              <label>Nome completo (assinatura digital) *</label>
              <input name="assinatura_nome" value={form.assinatura_nome} onChange={handleChange} required placeholder="Digite seu nome completo" />
            </div>
            <div className="form-group">
              <label>Matrícula *</label>
              <input name="assinatura_matricula" value={form.assinatura_matricula} onChange={handleChange} required placeholder="Digite sua matrícula" />
            </div>
            <div className="form-group">
              <label>Assinatura desenhada na tela *</label>
              <div className="signature-wrapper">
                {form.assinatura_url ? (
                  <div className="signature-preview">
                    <img src={form.assinatura_url} alt="Assinatura" />
                    <button type="button" className="remove-foto" onClick={clearSignature}>&times;</button>
                  </div>
                ) : (
                  <>
                    <SignatureCanvas ref={sigRef} penColor="black" canvasProps={{ className: 'signature-canvas' }} onEnd={handleSignatureEnd} />
                    {signatureUploading && <div className="uploading"><div className="spinner-sm" /><span>Enviando assinatura...</span></div>}
                  </>
                )}
              </div>
              {!form.assinatura_url && (
                <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 8 }} onClick={clearSignature}>Limpar</button>
              )}
            </div>
          </fieldset>

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Finalizar Checklist'}
          </button>
        </form>
      </div>
    </div>
  )
}
