'use client'

import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR, { mutate } from 'swr'
import { api, type Project, type Job, type Sample, type PresignedPair, type ProjectArtifacts, type ArtifactUploadUrl } from '@/lib/api'

const ANALYSIS_TYPES = [
  'deseq2', 'ancombc2', 'maaslin2', 'spieceasi',
  'random_forest', 'gsea', 'funguild', 'picrust2',
]

function markerBadge(marker: string) {
  if (marker === 'ITS') return <span className="badge badge-purple">ITS</span>
  return <span className="badge badge-blue">16S</span>
}

function statusDot(status: string) {
  if (status === 'active')    return <span className="dot dot-green" />
  if (status === 'running')   return <span className="dot dot-cyan pulse" />
  if (status === 'completed') return <span className="dot dot-green" />
  return <span className="dot dot-gray" />
}

function jobStatusBadge(status: string) {
  if (status === 'queued')  return <span className="badge badge-amber">queued</span>
  if (status === 'running') return <span className="badge badge-cyan">running</span>
  if (status === 'done')    return <span className="badge badge-green">done</span>
  if (status === 'failed')  return <span className="badge badge-red">failed</span>
  return <span className="badge">{status}</span>
}

function truncateKey(key: string, maxLen = 32): string {
  if (key.length <= maxLen) return key
  return '…' + key.slice(-(maxLen - 1))
}

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const { data: project, error: projectError } = useSWR(
    id ? ['project', id] : null,
    () => api.getProject(id),
  )

  const { data: samples, error: samplesError } = useSWR(
    id ? ['samples', id] : null,
    () => api.getSamples(id),
    { refreshInterval: 10000 },
  )

  const { data: jobs, error: jobsError } = useSWR(
    id ? ['jobs', id] : null,
    () => api.getJobs(id),
    { refreshInterval: 5000 },
  )

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [r1File, setR1File] = useState<File | null>(null)
  const [presigned, setPresigned] = useState<PresignedPair | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Artefatos disponíveis no MinIO para este projeto
  const { data: artifacts } = useSWR<ProjectArtifacts>(
    id ? ['artifacts', id] : null,
    () => api.getArtifacts(id),
    { refreshInterval: 30000 }
  )

  // Enqueue state — auto-preenche com o caminho padrão quando disponível
  // Upload de artefato RDS
  const [showArtifactUpload, setShowArtifactUpload] = useState(false)
  const [artifactFile, setArtifactFile] = useState<File | null>(null)
  const [artifactUploading, setArtifactUploading] = useState(false)
  const [artifactStatus, setArtifactStatus] = useState('')
  const artifactInputRef = useRef<HTMLInputElement>(null)

  async function handleArtifactUpload() {
    if (!artifactFile || !id) return
    setArtifactUploading(true)
    setArtifactStatus('gerando URL...')
    try {
      const { upload_url, key } = await api.getArtifactUploadUrl(id, artifactFile.name)
      setArtifactStatus('enviando para MinIO...')
      const res = await fetch(upload_url, {
        method: 'PUT',
        body: artifactFile,
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setArtifactStatus('concluido')
      mutate(['artifacts', id])
      // auto-preenche o enqueue com o arquivo que acabou de subir
      setPhyloseqKey(key)
      setTimeout(() => {
        setArtifactFile(null)
        setArtifactStatus('')
        setShowArtifactUpload(false)
        if (artifactInputRef.current) artifactInputRef.current.value = ''
      }, 1500)
    } catch (e) {
      setArtifactStatus('Erro no upload. Tente novamente.')
    } finally {
      setArtifactUploading(false)
    }
  }

  // Enqueue state
  const [showEnqueue, setShowEnqueue] = useState(false)
  const [selectedJobType, setSelectedJobType] = useState(ANALYSIS_TYPES[0])
  const [phyloseqKey, setPhyloseqKey] = useState('')
  const [enqueueing, setEnqueueing] = useState(false)

  // Preenche automaticamente quando artifacts carrega ou enqueue panel abre
  function openEnqueue() {
    if (artifacts?.default_key && !phyloseqKey) {
      setPhyloseqKey(artifacts.default_key)
    }
    setShowEnqueue(v => !v)
  }

  async function handleR1Change(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setR1File(file)
    setPresigned(null)
    setUploadStatus('')
    setUploadProgress(0)
    try {
      const pair = await api.getPresignedPair(file.name, id)
      setPresigned(pair)
    } catch (err) {
      setUploadStatus('Erro ao gerar URLs de upload. Verifique o nome do arquivo.')
    }
  }

  async function handleUpload() {
    if (!r1File || !presigned || !id) return
    setUploading(true)
    setUploadProgress(0)

    try {
      // Upload R1
      setUploadStatus('enviando R1...')
      await fetch(presigned.r1.upload_url, {
        method: 'PUT',
        body: r1File,
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      setUploadProgress(50)

      // Upload R2 placeholder (empty body for dev)
      setUploadStatus('enviando R2 (placeholder)...')
      await fetch(presigned.r2.upload_url, {
        method: 'PUT',
        body: new Blob([]),
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      setUploadProgress(90)

      // Confirm pair
      setUploadStatus('registrando no banco...')
      await api.confirmPair({
        project_id: id,
        r1_key: presigned.r1.key,
        r2_key: presigned.r2.key,
        r1_filename: r1File.name,
      })
      setUploadProgress(100)
      setUploadStatus('concluido')

      // Invalidate samples SWR
      mutate(['samples', id])

      // Reset form after short delay
      setTimeout(() => {
        setR1File(null)
        setPresigned(null)
        setUploadProgress(0)
        setUploadStatus('')
        setShowUpload(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }, 1500)
    } catch (err) {
      setUploadStatus('Erro durante o upload. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  async function handleEnqueue() {
    if (!id) return
    setEnqueueing(true)
    try {
      const payload: Record<string, string> = {}
      if (phyloseqKey.trim()) payload.phyloseq_key = phyloseqKey.trim()
      await api.enqueueJob(id, selectedJobType, payload)
      mutate(['jobs', id])
      setShowEnqueue(false)
      setPhyloseqKey('')
    } catch (err) {
      alert('Erro ao enfileirar job. Verifique o console.')
    } finally {
      setEnqueueing(false)
    }
  }

  if (projectError) {
    return (
      <div className="card" style={{ padding: 20, color: 'var(--red)' }}>
        Erro ao carregar projeto.
      </div>
    )
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/projects">Projetos</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{project?.code ?? '...'}</span>
      </div>

      {/* Header */}
      <div className="page-header">
        {project ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="page-title mono" style={{ color: 'var(--cyan)' }}>{project.code}</h1>
            {markerBadge(project.marker_type)}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
              {statusDot(project.status)} {project.status}
            </span>
          </div>
        ) : (
          <div className="skeleton" style={{ height: 28, width: 240 }} />
        )}
        {project && (
          <p className="page-subtitle" style={{ marginTop: 4 }}>{project.name}</p>
        )}
      </div>

      {/* Amostras */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span className="section-title" style={{ flex: 1 }}>Amostras</span>
          <button
            onClick={() => setShowUpload(v => !v)}
            style={{
              marginLeft: 16,
              padding: '6px 14px',
              background: 'var(--cyan-dim)',
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: 8,
              color: 'var(--cyan)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showUpload ? '✕ Fechar' : '↑ Upload FASTQ'}
          </button>
        </div>

        {/* Upload Panel */}
        {showUpload && (
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 14, fontSize: 14 }}>
              Upload de Par FASTQ
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                Arquivo R1:
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".fastq,.fastq.gz"
                onChange={handleR1Change}
                style={{ color: 'var(--text)', fontSize: 13 }}
              />
            </div>

            {presigned && (
              <>
                <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 10 }}>
                  ✓ R2 detectado: <span className="mono">{presigned.r2.key.split('/').pop()}</span>
                </div>
                <div style={{
                  display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-2)',
                  marginBottom: 12, flexWrap: 'wrap',
                  background: 'var(--surface-2)', borderRadius: 6, padding: '8px 12px',
                }}>
                  <span>Marcador: <span className="mono" style={{ color: 'var(--cyan)' }}>{presigned.parsed.marker_type}</span></span>
                  <span>Amostra: <span className="mono">{presigned.parsed.sample_number}</span></span>
                  <span>Grupo: <span className="mono">{presigned.parsed.treatment_group}</span></span>
                  <span>Réplica: <span className="mono">{presigned.parsed.replicate}</span></span>
                </div>
              </>
            )}

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', marginBottom: 6,
                }}>
                  <div style={{
                    height: '100%',
                    width: `${uploadProgress}%`,
                    background: 'linear-gradient(90deg, var(--cyan), rgba(0,212,255,0.5))',
                    borderRadius: 99,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  {uploadProgress}% — {uploadStatus}
                </div>
              </div>
            )}

            {uploadStatus === 'concluido' && (
              <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 12 }}>
                Upload concluido com sucesso.
              </div>
            )}

            {uploadStatus.startsWith('Erro') && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>
                {uploadStatus}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!presigned || uploading}
              style={{
                padding: '8px 18px',
                background: presigned && !uploading ? 'var(--cyan)' : 'var(--surface-2)',
                color: presigned && !uploading ? '#050d1a' : 'var(--text-3)',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: presigned && !uploading ? 'pointer' : 'not-allowed',
              }}
            >
              {uploading ? 'Enviando...' : 'Confirmar Upload'}
            </button>
          </div>
        )}

        {/* Samples Table */}
        {!samples && !samplesError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[1, 2].map(i => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
            ))}
          </div>
        )}

        {samples && samples.length === 0 && (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <span className="empty-state-icon">◌</span>
            <span className="empty-state-title">Nenhuma amostra.</span>
            <span className="empty-state-desc">Faca upload do primeiro par FASTQ.</span>
          </div>
        )}

        {samples && samples.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Filename</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Grupo</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Replica</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>R1 Key</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>R2 Key</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s: Sample) => (
                  <tr
                    key={s.id}
                    style={{
                      background: 'var(--surface)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <span className="mono" style={{ color: 'var(--text)' }}>{s.filename}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>{s.treatment_group}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>{s.replicate}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }} title={s.fastq_r1_key}>
                        {truncateKey(s.fastq_r1_key)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }} title={s.fastq_r2_key}>
                        {truncateKey(s.fastq_r2_key)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Artefatos phyloseq */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <span className="section-title">Artefatos</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 10 }}>
              arquivos .rds usados como entrada nas análises
            </span>
          </div>
          <button
            onClick={() => setShowArtifactUpload(v => !v)}
            style={{
              padding: '6px 14px', background: 'rgba(168,85,247,0.1)',
              border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8,
              color: 'var(--purple)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {showArtifactUpload ? '✕ Fechar' : '↑ Upload .rds'}
          </button>
        </div>

        {/* Upload panel */}
        {showArtifactUpload && (
          <div className="card" style={{ padding: 20, marginBottom: 16, borderColor: 'rgba(168,85,247,0.2)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 14, fontSize: 14 }}>
              Upload de Artefato phyloseq
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
              Selecione um arquivo <span className="mono">.rds</span> gerado pelo script{' '}
              <span className="mono">tsv_to_phyloseq.R</span> ou exportado pelo R.
              O nome do arquivo será preservado (ex: <span className="mono">phyloseq.rds</span>,{' '}
              <span className="mono">phyloseq_fungi.rds</span>).
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                  Arquivo .rds
                </label>
                <input
                  ref={artifactInputRef}
                  type="file"
                  accept=".rds,.RDS"
                  onChange={e => setArtifactFile(e.target.files?.[0] ?? null)}
                  style={{ color: 'var(--text)', fontSize: 13 }}
                />
              </div>
              <button
                onClick={handleArtifactUpload}
                disabled={!artifactFile || artifactUploading}
                style={{
                  padding: '7px 18px',
                  background: artifactFile && !artifactUploading ? 'var(--purple)' : 'var(--surface-2)',
                  color: artifactFile && !artifactUploading ? '#fff' : 'var(--text-3)',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: artifactFile && !artifactUploading ? 'pointer' : 'not-allowed',
                }}
              >
                {artifactUploading ? 'Enviando...' : 'Confirmar Upload'}
              </button>
            </div>
            {artifactStatus === 'concluido' && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--green)' }}>
                ✓ Upload concluído — artefato disponível para análise.
              </div>
            )}
            {artifactStatus.startsWith('Erro') && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)' }}>{artifactStatus}</div>
            )}
            {artifactUploading && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                {artifactStatus}
              </div>
            )}
          </div>
        )}

        {/* Lista de artefatos */}
        {artifacts && artifacts.available.length === 0 && (
          <div style={{
            padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, fontSize: 13, color: 'var(--text-3)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>◌</span>
            <div>
              <div style={{ color: 'var(--text-2)', fontWeight: 600, marginBottom: 2 }}>Nenhum artefato no MinIO</div>
              <div style={{ fontSize: 12 }}>
                Faça upload de um <span className="mono">.rds</span> ou use o script{' '}
                <span className="mono">scripts/data-prep/tsv_to_phyloseq.R</span> para converter as tabelas do laboratório.
              </div>
            </div>
          </div>
        )}

        {artifacts && artifacts.available.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {artifacts.available.map(key => {
              const filename = key.replace('pipeline-artifacts/', '')
              const isSelected = phyloseqKey === key
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: 'var(--surface)',
                    border: `1px solid ${isSelected ? 'rgba(168,85,247,0.4)' : 'var(--border)'}`,
                    borderRadius: 8, gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>📦</span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>{filename}</span>
                  </div>
                  <button
                    onClick={() => { setPhyloseqKey(key); setShowEnqueue(true) }}
                    style={{
                      padding: '4px 12px',
                      background: isSelected ? 'rgba(168,85,247,0.15)' : 'var(--surface-2)',
                      border: `1px solid ${isSelected ? 'rgba(168,85,247,0.35)' : 'var(--border)'}`,
                      borderRadius: 6, color: isSelected ? 'var(--purple)' : 'var(--text-2)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {isSelected ? '✓ Selecionado' : 'Usar nesta análise'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Analises */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span className="section-title" style={{ flex: 1 }}>Analises</span>
          <button
            onClick={openEnqueue}
            style={{
              marginLeft: 16,
              padding: '6px 14px',
              background: 'rgba(16,212,138,0.1)',
              border: '1px solid rgba(16,212,138,0.25)',
              borderRadius: 8,
              color: 'var(--green)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showEnqueue ? '✕ Fechar' : '▶ Enfileirar Analise'}
          </button>
        </div>

        {/* Enqueue Panel */}
        {showEnqueue && (
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 14, fontSize: 14 }}>
              Nova Analise
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                  Tipo de analise
                </label>
                <select
                  value={selectedJobType}
                  onChange={e => setSelectedJobType(e.target.value)}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text)',
                    padding: '6px 10px',
                    fontSize: 13,
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {ANALYSIS_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 280 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                  <span>Arquivo phyloseq</span>
                  {artifacts && (
                    <span style={{
                      fontSize: 10, fontFamily: 'var(--mono)', padding: '1px 6px', borderRadius: 4,
                      background: artifacts.available.length > 0 ? 'rgba(16,212,138,0.12)' : 'rgba(245,158,11,0.12)',
                      color: artifacts.available.length > 0 ? 'var(--green)' : 'var(--amber)',
                      border: `1px solid ${artifacts.available.length > 0 ? 'rgba(16,212,138,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    }}>
                      {artifacts.available.length > 0 ? `${artifacts.available.length} arquivo(s) no MinIO` : 'MinIO vazio — execute QIIME2 primeiro'}
                    </span>
                  )}
                </label>

                {/* Dropdown se existirem arquivos, input manual caso contrário */}
                {artifacts && artifacts.available.length > 0 ? (
                  <select
                    value={phyloseqKey}
                    onChange={e => setPhyloseqKey(e.target.value)}
                    style={{
                      width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 8, color: 'var(--text)', padding: '6px 10px',
                      fontSize: 12, fontFamily: 'var(--mono)',
                    }}
                  >
                    <option value="">— selecionar arquivo —</option>
                    {artifacts.available.map(k => (
                      <option key={k} value={k}>{k.replace('pipeline-artifacts/', '')}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={phyloseqKey}
                    onChange={e => setPhyloseqKey(e.target.value)}
                    placeholder={artifacts?.default_key ?? 'pipeline-artifacts/...'}
                    style={{
                      width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 8, color: 'var(--text)', padding: '6px 10px',
                      fontSize: 12, fontFamily: 'var(--mono)',
                    }}
                  />
                )}
              </div>

              <button
                onClick={handleEnqueue}
                disabled={enqueueing || !phyloseqKey.trim()}
                style={{
                  alignSelf: 'flex-end',
                  padding: '7px 18px',
                  background: enqueueing || !phyloseqKey.trim() ? 'var(--surface-2)' : 'var(--green)',
                  color: enqueueing || !phyloseqKey.trim() ? 'var(--text-3)' : '#050d1a',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: enqueueing || !phyloseqKey.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {enqueueing ? 'Enfileirando...' : 'Enfileirar'}
              </button>
            </div>
          </div>
        )}

        {/* Jobs Table */}
        {!jobs && !jobsError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
            ))}
          </div>
        )}

        {jobs && jobs.length === 0 && (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <span className="empty-state-icon">◌</span>
            <span className="empty-state-title">Nenhuma analise enfileirada.</span>
          </div>
        )}

        {jobs && jobs.length > 0 && (
          <div className="jobs-table">
            <div className="jobs-table-header" style={{ gridTemplateColumns: '130px 1fr 90px 140px 36px' }}>
              <span>Job ID</span>
              <span>Tipo</span>
              <span>Status</span>
              <span>Criado em</span>
              <span />
            </div>
            {jobs.map((j: Job) => (
              <div key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  className="jobs-row"
                  style={{
                    gridTemplateColumns: '130px 1fr 90px 140px 36px',
                    ...(j.status === 'done' ? { cursor: 'pointer' } : {}),
                  }}
                  onClick={() => j.status === 'done' && (window.location.href = `/analysis/${j.id}`)}
                  title={j.status === 'done' ? 'Ver análise completa' : undefined}
                >
                  <span className="job-id mono" title={j.id}>{j.id.slice(0, 8)}…</span>
                  <span className="job-type mono">{j.job_type}</span>
                  <span>{jobStatusBadge(j.status)}</span>
                  <span className="job-time">{j.created_at ? new Date(j.created_at).toLocaleString('pt-BR') : '—'}</span>
                  {j.status === 'done' && (
                    <Link href={`/analysis/${j.id}`}
                      onClick={e => e.stopPropagation()}
                      style={{ color: 'var(--cyan)', fontSize: 16, textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                      title="Ver análise">
                      →
                    </Link>
                  )}
                  {j.status !== 'done' && <span />}
                </div>
                {j.status === 'failed' && j.error_msg && (
                  <div style={{
                    padding: '6px 12px 10px 12px',
                    background: 'rgba(239,68,68,0.05)',
                    borderTop: '1px solid rgba(239,68,68,0.15)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}>
                    <span style={{ color: 'var(--red)', fontSize: 11, marginTop: 1 }}>✗</span>
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      color: 'var(--red)',
                      opacity: 0.85,
                      wordBreak: 'break-all',
                      lineHeight: 1.5,
                    }}>
                      {j.error_msg}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
