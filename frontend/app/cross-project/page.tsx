'use client'

import dynamic from 'next/dynamic'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

interface SubplotConfig {
  title: string
  metric: string
  project: string
  color: string
  axisX: string
  axisY: string
}

const SUBPLOTS: SubplotConfig[] = [
  { title: 'INOVAHERB',       metric: 'Bray-Curtis', project: 'INOVAHERB',      color: '#a855f7', axisX: 'x1', axisY: 'y1' },
  { title: 'INOVAHERB',       metric: 'UniFrac',     project: 'INOVAHERB',      color: '#a855f7', axisX: 'x2', axisY: 'y2' },
  { title: 'Pós-Fogo',        metric: 'Bray-Curtis', project: 'Pós-Fogo',       color: '#3b82f6', axisX: 'x3', axisY: 'y3' },
  { title: 'Pós-Fogo',        metric: 'UniFrac',     project: 'Pós-Fogo',       color: '#3b82f6', axisX: 'x4', axisY: 'y4' },
  { title: 'Biorremediação',  metric: 'Bray-Curtis', project: 'Biorremediação', color: '#10d48a', axisX: 'x5', axisY: 'y5' },
  { title: 'Biorremediação',  metric: 'UniFrac',     project: 'Biorremediação', color: '#10d48a', axisX: 'x6', axisY: 'y6' },
]

const AXIS_STYLE = {
  gridcolor: 'rgba(0,212,255,0.07)',
  zerolinecolor: 'rgba(0,212,255,0.15)',
  tickfont: { color: '#3a5578', size: 9 },
  showticklabels: true,
}

function buildAnnotations(subplots: SubplotConfig[]) {
  // Position subplot titles based on a 2-column, 3-row grid
  const cols = 2
  const xPositions = [0.225, 0.775]
  const yPositions = [0.96, 0.63, 0.30]

  return subplots.map((s, i) => ({
    text: `<b>${s.title}</b> · ${s.metric}`,
    xref: 'paper' as const,
    yref: 'paper' as const,
    x: xPositions[i % cols],
    y: yPositions[Math.floor(i / cols)],
    xanchor: 'center' as const,
    yanchor: 'bottom' as const,
    showarrow: false,
    font: { color: s.color, size: 11, family: 'Inter, system-ui, sans-serif' },
  }))
}

export default function CrossProjectPage() {
  const traces = SUBPLOTS.map((s, i) => ({
    type: 'scatter' as const,
    mode: 'markers' as const,
    name: `${s.title} ${s.metric}`,
    x: [] as number[],
    y: [] as number[],
    xaxis: `x${i + 1}` as Plotly.AxisName,
    yaxis: `y${i + 1}` as Plotly.AxisName,
    showlegend: false,
    marker: {
      color: s.color,
      size: 7,
      opacity: 0.8,
      line: { color: 'rgba(0,0,0,0.3)', width: 0.5 },
    },
  }))

  const subplotAxes: Record<string, unknown> = {}
  SUBPLOTS.forEach((_, i) => {
    const n = i + 1
    subplotAxes[`xaxis${n}`] = { ...AXIS_STYLE, title: { text: `PC1`, font: { size: 9, color: '#3a5578' } } }
    subplotAxes[`yaxis${n}`] = { ...AXIS_STYLE, title: { text: `PC2`, font: { size: 9, color: '#3a5578' } } }
  })

  const layout: Partial<Plotly.Layout> = {
    paper_bgcolor: '#0a1628',
    plot_bgcolor: '#050d1a',
    font: { color: '#e2eeff', family: 'Inter, system-ui, sans-serif', size: 11 },
    grid: { rows: 3, columns: 2, pattern: 'independent', roworder: 'top to bottom' },
    height: 1050,
    autosize: true,
    margin: { t: 64, b: 40, l: 60, r: 30 },
    annotations: [
      {
        text: '6 PCoAs — Comparação Entre Projetos',
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: 1.02,
        xanchor: 'center',
        yanchor: 'bottom',
        showarrow: false,
        font: { color: '#00d4ff', size: 14, family: 'Inter, system-ui, sans-serif' },
      },
      ...buildAnnotations(SUBPLOTS),
    ],
    ...subplotAxes,
  } as Partial<Plotly.Layout>

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Figura TCC</h1>
          <span className="badge badge-cyan">✦ Figura Central</span>
        </div>
        <p className="page-subtitle">
          Painel de 6 PCoAs gerado após evento{' '}
          <code className="mono" style={{ color: 'var(--cyan)', fontSize: 12 }}>
            CrossProjectFigureReady
          </code>
        </p>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-3 mb-4">
        {[
          { label: 'INOVAHERB',      color: 'var(--purple)', icon: '◎' },
          { label: 'Pós-Fogo',       color: 'var(--blue)',   icon: '◎' },
          { label: 'Biorremediação', color: 'var(--green)',  icon: '◎' },
        ].map((p) => (
          <span
            key={p.label}
            className="badge"
            style={{
              background: `${p.color}18`,
              color: p.color,
              border: `1px solid ${p.color}35`,
            }}
          >
            {p.icon} {p.label}
          </span>
        ))}
        <span
          className="badge"
          style={{ background: 'var(--surface-2)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          ⏳ Aguardando dados
        </span>
      </div>

      {/* Plot */}
      <div className="plot-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Plot
          data={traces}
          layout={layout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>

      <div className="ws-status-bar" style={{ marginTop: 20 }}>
        <span className="dot dot-amber" style={{ width: 6, height: 6 }} />
        <span>
          Subplots populados automaticamente quando os 3 projetos concluírem as análises
        </span>
      </div>
    </>
  )
}
