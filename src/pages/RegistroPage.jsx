import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { validarToken, registrarDados, registrarPublico } from '../lib/api'
import SignatureCanvas from 'react-signature-canvas'

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export default function RegistroPage() {
  const { token } = useParams()
  const isPublico = token === 'unico' || token === 'publico'
  const [loading, setLoading] = useState(!isPublico)
  const [valido, setValido] = useState(isPublico)
  const [usado, setUsado] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState([false, false, false, false])
  const [previews, setPreviews] = useState([null, null, null, null])
  const [signatureUploading, setSignatureUploading] = useState(false)
  const cameraInputs = [useRef(), useRef(), useRef(), useRef()]
  const galleryInputs = [useRef(), useRef(), useRef(), useRef()]
  const sigRef = useRef()

  const [form, setForm] = useState({
    nome: '',
    email: '',
    serial: '',
    modelo_notebook: 'EliteBook 645 G11 da HP',
    foto1_url: '',
    foto2_url: '',
    foto3_url: '',
    foto4_url: '',
    observacao: '',
    com_mochila: false,
    com_carregador: false,
    com_teclado: false,
    com_mouse: false,
    setor: '',
    assinatura_nome: '',
    assinatura_matricula: '',
    assinatura_url: '',
    tipo_atuacao: '',
    endereco_rua: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_cep: '',
  })

  useEffect(() => {
    if (isPublico) return
    async function check() {
      const data = await validarToken(token)
      if (data.valido) {
        setValido(true)
      } else if (data.usado) {
        setUsado(true)
      }
      setLoading(false)
    }
    check()
  }, [token, isPublico])

  function resetForm() {
    setForm({
      nome: '', email: '', serial: '', modelo_notebook: 'EliteBook 645 G11 da HP',
      foto1_url: '', foto2_url: '', foto3_url: '', foto4_url: '', observacao: '',
      com_mochila: false, com_carregador: false, com_teclado: false, com_mouse: false, setor: '',
      assinatura_nome: '', assinatura_matricula: '', assinatura_url: '', tipo_atuacao: '',
      endereco_rua: '', endereco_bairro: '', endereco_cidade: '', endereco_cep: '',
    })
    setPreviews([null, null, null, null])
    setSignatureUploading(false)
    setError('')
    setSuccess(false)
    setSubmitting(false)
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  async function handleUpload(index, inputRef) {
    const file = inputRef.current?.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('A foto deve ter no máximo 5MB')
      return
    }

    setError('')
    setUploading(prev => { const n = [...prev]; n[index] = true; return n })

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', UPLOAD_PRESET)
    fd.append('folder', 'registro_sada')

    try {
      const res = await fetch(url, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        const key = `foto${index + 1}_url`
        setForm(prev => ({ ...prev, [key]: data.secure_url }))
        setPreviews(prev => { const n = [...prev]; n[index] = data.secure_url; return n })
      } else {
        setError('Erro ao fazer upload da imagem')
      }
    } catch {
      setError('Erro ao conectar com Cloudinary')
    } finally {
      setUploading(prev => { const n = [...prev]; n[index] = false; return n })
    }
  }

  function removeFoto(index) {
    const key = `foto${index + 1}_url`
    setForm(prev => ({ ...prev, [key]: '' }))
    setPreviews(prev => { const n = [...prev]; n[index] = null; return n })
    if (cameraInputs[index].current) cameraInputs[index].current.value = ''
    if (galleryInputs[index].current) galleryInputs[index].current.value = ''
  }

  async function uploadSignature(blob) {
    setSignatureUploading(true)
    setError('')
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
    const fd = new FormData()
    fd.append('file', blob, 'assinatura.png')
    fd.append('upload_preset', UPLOAD_PRESET)
    fd.append('folder', 'registro_sada')
    try {
      const res = await fetch(url, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        setForm(prev => ({ ...prev, assinatura_url: data.secure_url }))
      } else {
        setError('Erro ao enviar assinatura')
      }
    } catch {
      setError('Erro ao conectar com Cloudinary')
    } finally {
      setSignatureUploading(false)
    }
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

    if (!form.foto1_url || !form.foto2_url || !form.foto3_url || !form.foto4_url) {
      setError('Todas as 4 fotos são obrigatórias. Tire uma foto do equipamento e do número de série.')
      return
    }

    if (!form.assinatura_url) {
      setError('Desenhe sua assinatura no campo abaixo')
      return
    }

    setSubmitting(true)

    try {
      const fn = isPublico ? registrarPublico : registrarDados
      const body = isPublico ? form : { ...form, token }

      const result = await fn(body)
      if (result.sucesso) {
        setSuccess(true)
        if (isPublico) {
          setTimeout(resetForm, 5000)
        }
      } else {
        setError(result.error || 'Erro ao registrar')
      }
    } catch (err) {
      setError('Erro de conexão: ' + (err.message || 'erro inesperado'))
    }
    setSubmitting(false)
  }

  if (!isPublico && loading) {
    return (
      <div className="page-center">
        <div className="spinner" />
        <p>Validando link...</p>
      </div>
    )
  }

  if (!isPublico && !valido) {
    return (
      <div className="page-center">
        <div className="card error-card">
          <h2>Link inválido</h2>
          <p>{usado ? 'Este link já foi utilizado.' : 'Este link de registro não é válido ou expirou.'}</p>
        </div>
      </div>
    )
  }

  if (success && !isPublico) {
    return (
      <div className="page-center">
        <div className="card success-card">
          <div className="success-icon">&#10003;</div>
          <h2>Registro concluído com sucesso!</h2>
          <p>Seu notebook HP foi registrado. Em breve a equipe de TI entrará em contato se necessário.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-center">
      <div className="card form-card">
        <div className="logo">SADA</div>
        <h2>Registro do Notebook HP</h2>
        <p className="subtitle">Preencha seus dados e as informações do equipamento</p>

        {error && <div className="alert alert-error">{error}</div>}

        {success && isPublico && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            Registro concluído com sucesso! Novo formulário será aberto em instantes...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome completo *</label>
            <input name="nome" value={form.nome} onChange={handleChange} required placeholder="Seu nome" />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="seu@email.com" />
          </div>

          <div className="form-group">
            <label>Número de série do notebook *</label>
            <input name="serial" value={form.serial} onChange={handleChange} required placeholder="Ex: 5CGXXXX" />
          </div>

          <div className="form-group">
            <label>Modelo do notebook</label>
            <input name="modelo_notebook" value={form.modelo_notebook} onChange={handleChange} required disabled style={{ background: '#f3f4f6', cursor: 'not-allowed' }} />
          </div>

          <div className="form-group">
            <label>Setor</label>
            <input name="setor" value={form.setor} onChange={handleChange} placeholder="Ex: TI, RH, Financeiro..." />
          </div>

          <div className="form-group">
            <label>Tipo de Atuação *</label>
            <select name="tipo_atuacao" value={form.tipo_atuacao} onChange={handleChange} required className="form-select">
              <option value="">Selecione...</option>
              <option value="Home Office">Home Office</option>
              <option value="Híbrido">Híbrido</option>
              <option value="Presencial Fixo">Presencial Fixo</option>
            </select>
          </div>

          <fieldset className="form-fieldset">
            <legend>Endereço Completo</legend>
            <div className="form-group">
              <label>Rua *</label>
              <input name="endereco_rua" value={form.endereco_rua} onChange={handleChange} required placeholder="Rua, número, complemento" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Bairro *</label>
                <input name="endereco_bairro" value={form.endereco_bairro} onChange={handleChange} required placeholder="Bairro" />
              </div>
              <div className="form-group">
                <label>Cidade *</label>
                <input name="endereco_cidade" value={form.endereco_cidade} onChange={handleChange} required placeholder="Belo Horizonte" />
              </div>
              <div className="form-group form-group-sm">
                <label>CEP *</label>
                <input name="endereco_cep" value={form.endereco_cep} onChange={handleChange} required placeholder="30000-000" />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-fieldset">
            <legend>Assinatura de Recebimento</legend>
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
                    <SignatureCanvas
                      ref={sigRef}
                      penColor="black"
                      canvasProps={{ className: 'signature-canvas' }}
                      onEnd={handleSignatureEnd}
                    />
                    {signatureUploading && <div className="uploading"><div className="spinner-sm" /><span>Enviando assinatura...</span></div>}
                  </>
                )}
              </div>
              {!form.assinatura_url && (
                <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 8 }} onClick={clearSignature}>Limpar</button>
              )}
            </div>
          </fieldset>

          <div className="form-group">
            <label>Acessórios</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input type="checkbox" name="com_mochila" checked={form.com_mochila} onChange={handleChange} />
                <span>Mochila</span>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="com_carregador" checked={form.com_carregador} onChange={handleChange} />
                <span>Carregador</span>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="com_teclado" checked={form.com_teclado} onChange={handleChange} />
                <span>Teclado</span>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="com_mouse" checked={form.com_mouse} onChange={handleChange} />
                <span>Mouse</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Observações (avarias, cabos faltando, etc.)</label>
            <textarea
              name="observacao"
              value={form.observacao}
              onChange={handleChange}
              placeholder="Descreva qualquer avaria ou item faltante..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Fotos do equipamento * (máx. 5MB cada) <span className="required-hint">— todas as fotos são obrigatórias</span></label>
            <div className="fotos-grid">
              {[0, 1, 2, 3].map(i => (
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
                        <button type="button" className="foto-option-btn" onClick={() => cameraInputs[i].current?.click()} title="Usar câmera">&#128247; Câmera</button>
                        <button type="button" className="foto-option-btn" onClick={() => galleryInputs[i].current?.click()} title="Escolher da galeria">&#128193; Galeria</button>
                      </div>
                    )}
                  </div>
                  <div className="foto-legenda">
                    {i === 0 && <span>Foto 1 — Equipamento (vista frontal)</span>}
                    {i === 1 && <span>Foto 2 — Equipamento (vista lateral/inferior)</span>}
                    {i === 2 && <span>Foto 3 — Equipamento (vista adicional)</span>}
                    {i === 3 && <span>Foto 4 — Número de série do equipamento *</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Confirmar Registro'}
          </button>
        </form>
      </div>
    </div>
  )
}
