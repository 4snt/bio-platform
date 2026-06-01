'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { api } from '@/lib/api'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Deg {
  gene_id: string
  log2_fold_change: number
  p_adjusted: number
  base_mean: number
}

interface DeseqResult {
  degs: Deg[]
  n_significant: number
}

// ── Constantes de estilo ──────────────────────────────────────────────────────

const DARK: Partial<Plotly.Layout> = {
  paper_bgcolor: '#0a1628',
  plot_bgcolor:  '#050d1a',
  font: { color: '#e2eeff', family: 'Inter, system-ui', size: 12 },
  margin: { t: 48, b: 52, l: 60, r: 24 },
  legend: {
    bgcolor: 'rgba(10,22,40,0.8)',
    bordercolor: 'rgba(0,212,255,0.15)',
    borderwidth: 1,
    font: { color: '#7a9cc0', size: 11 },
  },
  hoverlabel: { bgcolor: '#0f1e38', bordercolor: '#00d4ff', font: { color: '#e2eeff' } },
}

const AXIS = {
  gridcolor: 'rgba(0,212,255,0.07)',
  zerolinecolor: 'rgba(0,212,255,0.2)',
  tickfont: { color: '#7a9cc0' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSig(d: Deg) { return Math.abs(d.log2_fold_change) > 1 && d.p_adjusted < 0.05 }

function fmtPval(p: number) {
  if (p === 0) return '< 1e-300'
  if (p < 0.001) return p.toExponential(2)
  return p.toFixed(4)
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '14px 20px', minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)', color: color ?? 'var(--cyan)' }}>
        {value}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AnalysisPage() {
  const params  = useParams()
  const jobId   = params?.id as string
  const shortId = jobId?.slice(0, 8)

  const [sortKey,  setSortKey]  = useState<keyof Deg>('p_adjusted')
  const [sortAsc,  setSortAsc]  = useState(true)
  const [filterSig, setFilterSig] = useState(false)
  const [search,   setSearch]   = useState('')

  const { data, error, isLoading } = useSWR(
    jobId ? ['analysis', jobId] : null,
    () => api.getAnalysisResults(jobId),
  )

  const raw   = data?.[0]
  const rd    = raw?.result_data as unknown as DeseqResult | undefined
  const degs  = rd?.degs ?? []
  const nSig  = rd?.n_significant ?? 0
  const type  = raw?.analysis_type ?? 'deseq2'

  const sig = degs.filter(isSig)
  const ns  = degs.filter(d => !isSig(d))

  // Filtro + sort para a tabela
  const filtered = degs
    .filter(d => !filterSig || isSig(d))
    .filter(d => !search || d.gene_id.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] as number
      const bv = b[sortKey] as number
      return sortAsc ? av - bv : bv - av
    })

  function toggleSort(k: keyof Deg) {
    if (sortKey === k) setSortAsc(v => !v)
    else { setSortKey(k); setSortAsc(true) }
  }

  function SortHeader({ k, label }: { k: keyof Deg; label: string }) {
    const active = sortKey === k
    return (
      <span
        onClick={() => toggleSort(k)}
        style={{ cursor: 'pointer', color: active ? 'var(--cyan)' : 'var(--text-3)', userSelect: 'none' }}
      >
        {label} {active ? (sortAsc ? '↑' : '↓') : ''}
      </span>
    )
  }

  if (isLoading) return (
    <div style={{ padding: 32 }}>
      <div className="skeleton" style={{ height: 28, width: 300, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 500, borderRadius: 8 }} />
    </div>
  )

  if (error) return (
    <div className="card" style={{ padding: 24, color: 'var(--red)', margin: 24 }}>
      ⚠ Erro ao carregar resultados. Verifique se o job existe.
    </div>
  )

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/projects">Projetos</Link>
        <span className="breadcrumb-sep">/</span>
        <span>Análise</span>
        <span className="breadcrumb-sep">/</span>
        <span className="mono">{shortId}…</span>
      </div>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="page-title">{type.toUpperCase()}</h1>
          <span className="badge badge-cyan" style={{ fontSize: 11 }}>done</span>
        </div>
        <p className="page-subtitle mono" style={{ marginTop: 4 }}>{jobId}</p>
      </div>

      {degs.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <span className="empty-state-icon">◌</span>
          <span className="empty-state-title">Sem resultados</span>
          <span className="empty-state-desc">O job não gerou dados de expressão diferencial.</span>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <StatCard label="ASVs testados"       value={degs.length} color="var(--text)" />
            <StatCard label="Significativos"      value={nSig}         color={nSig > 0 ? 'var(--cyan)' : 'var(--text-2)'} />
            <StatCard label="Up-regulated"        value={sig.filter(d => d.log2_fold_change > 0).length} color="var(--green)" />
            <StatCard label="Down-regulated"      value={sig.filter(d => d.log2_fold_change < 0).length} color="var(--red)" />
          </div>

          {/* Plots */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {/* Volcano plot */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Volcano Plot
              </div>
              <Plot
                data={[
                  {
                    type: 'scatter', mode: 'markers', name: 'Não significativo',
                    x: ns.map(d => d.log2_fold_change),
                    y: ns.map(d => -Math.log10(d.p_adjusted)),
                    text: ns.map(d => d.gene_id),
                    hovertemplate: '<b>%{text}</b><br>log2FC: %{x:.3f}<br>-log10(padj): %{y:.3f}<extra></extra>',
                    marker: { color: '#3a5578', size: 4, opacity: 0.5 },
                  },
                  {
                    type: 'scatter', mode: 'markers', name: 'Significativo',
                    x: sig.map(d => d.log2_fold_change),
                    y: sig.map(d => -Math.log10(d.p_adjusted)),
                    text: sig.map(d => d.gene_id),
                    hovertemplate: '<b>%{text}</b><br>log2FC: %{x:.3f}<br>-log10(padj): %{y:.3f}<extra></extra>',
                    marker: { color: '#00d4ff', size: 7, opacity: 0.9, line: { color: 'rgba(0,0,0,0.3)', width: 0.5 } },
                  },
                ]}
                layout={{
                  ...DARK,
                  xaxis: { ...AXIS, title: { text: 'log₂ Fold Change', standoff: 8 } },
                  yaxis: { ...AXIS, title: { text: '-log₁₀(padj)', standoff: 8 } },
                  // Linhas de corte
                  shapes: [
                    { type: 'line', x0: -1, x1: -1, y0: 0, y1: 1, yref: 'paper', line: { color: 'rgba(255,100,100,0.3)', dash: 'dot', width: 1 } },
                    { type: 'line', x0:  1, x1:  1, y0: 0, y1: 1, yref: 'paper', line: { color: 'rgba(255,100,100,0.3)', dash: 'dot', width: 1 } },
                    { type: 'line', x0: -10, x1: 10, y0: -Math.log10(0.05), y1: -Math.log10(0.05), line: { color: 'rgba(255,100,100,0.3)', dash: 'dot', width: 1 } },
                  ],
                  height: 380, autosize: true,
                } as Partial<Plotly.Layout>}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>

            {/* MA plot */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                MA Plot
              </div>
              <Plot
                data={[
                  {
                    type: 'scatter', mode: 'markers', name: 'Não significativo',
                    x: ns.map(d => Math.log2(d.base_mean + 1)),
                    y: ns.map(d => d.log2_fold_change),
                    text: ns.map(d => d.gene_id),
                    hovertemplate: '<b>%{text}</b><br>log2(mean): %{x:.2f}<br>log2FC: %{y:.3f}<extra></extra>',
                    marker: { color: '#3a5578', size: 4, opacity: 0.5 },
                  },
                  {
                    type: 'scatter', mode: 'markers', name: 'Significativo',
                    x: sig.map(d => Math.log2(d.base_mean + 1)),
                    y: sig.map(d => d.log2_fold_change),
                    text: sig.map(d => d.gene_id),
                    hovertemplate: '<b>%{text}</b><br>log2(mean): %{x:.2f}<br>log2FC: %{y:.3f}<extra></extra>',
                    marker: { color: '#00d4ff', size: 7, opacity: 0.9 },
                  },
                ]}
                layout={{
                  ...DARK,
                  xaxis: { ...AXIS, title: { text: 'log₂ Mean Expression', standoff: 8 } },
                  yaxis: { ...AXIS, title: { text: 'log₂ Fold Change', standoff: 8 } },
                  shapes: [{ type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 0, line: { color: 'rgba(0,212,255,0.3)', width: 1 } }],
                  height: 380, autosize: true,
                } as Partial<Plotly.Layout>}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Tabela de DEGs */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                Resultados DESeq2
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  {filtered.length} de {degs.length}
                </span>
              </span>
              <input
                type="text"
                placeholder="Buscar ASV ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text)', padding: '5px 10px',
                  fontSize: 12, fontFamily: 'var(--mono)', width: 220,
                }}
              />
              <button
                onClick={() => setFilterSig(v => !v)}
                style={{
                  padding: '5px 12px',
                  background: filterSig ? 'rgba(0,212,255,0.12)' : 'var(--surface-2)',
                  border: `1px solid ${filterSig ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
                  borderRadius: 6, color: filterSig ? 'var(--cyan)' : 'var(--text-2)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {filterSig ? '✓ Só significativos' : 'Só significativos'}
              </button>
            </div>

            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px',
              padding: '8px 16px', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.07em',
              background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
            }}>
              <SortHeader k="gene_id"          label="ASV ID" />
              <SortHeader k="log2_fold_change" label="log2FC" />
              <SortHeader k="p_adjusted"       label="padj" />
              <SortHeader k="base_mean"        label="Base Mean" />
            </div>

            {/* Rows */}
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {filtered.slice(0, 500).map(d => {
                const significant = isSig(d)
                return (
                  <div
                    key={d.gene_id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px',
                      padding: '7px 16px', fontSize: 12,
                      borderBottom: '1px solid var(--border)',
                      background: significant ? 'rgba(0,212,255,0.03)' : 'transparent',
                    }}
                  >
                    <span className="mono" style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.gene_id}>
                      {d.gene_id.slice(0, 16)}…
                    </span>
                    <span className="mono" style={{ color: d.log2_fold_change > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {d.log2_fold_change > 0 ? '+' : ''}{d.log2_fold_change.toFixed(3)}
                    </span>
                    <span className="mono" style={{ color: significant ? 'var(--cyan)' : 'var(--text-3)' }}>
                      {fmtPval(d.p_adjusted)}
                    </span>
                    <span className="mono" style={{ color: 'var(--text-3)' }}>
                      {d.base_mean.toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
