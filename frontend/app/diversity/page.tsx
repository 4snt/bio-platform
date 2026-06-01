'use client'

import dynamic from 'next/dynamic'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

const PROJECTS = [
  { code: 'INOVAHERB', color: '#a855f7', marker: 'ITS' },
  { code: 'Pós-Fogo',  color: '#3b82f6', marker: '16S' },
  { code: 'Biorremediação', color: '#10d48a', marker: 'ITS+16S' },
]

const darkLayout: Partial<Plotly.Layout> = {
  paper_bgcolor: '#0a1628',
  plot_bgcolor:  '#050d1a',
  font: { color: '#e2eeff', family: 'Inter, system-ui, sans-serif', size: 12 },
  margin: { t: 48, b: 56, l: 60, r: 20 },
  legend: {
    bgcolor: 'rgba(10,22,40,0.9)',
    bordercolor: 'rgba(0,212,255,0.15)',
    borderwidth: 1,
    font: { color: '#7a9cc0', size: 11 },
  },
  hoverlabel: {
    bgcolor: '#0f1e38',
    bordercolor: '#00d4ff',
    font: { color: '#e2eeff' },
  },
}

const axisStyle = {
  gridcolor: 'rgba(0,212,255,0.08)',
  zerolinecolor: 'rgba(0,212,255,0.15)',
  tickfont: { color: '#7a9cc0' },
}

export default function DiversityPage() {
  const emptyTrace = (name: string, color: string) => ({
    type: 'scatter' as const,
    mode: 'markers' as const,
    name,
    x: [] as number[],
    y: [] as number[],
    marker: { color, size: 8, line: { color: 'rgba(0,0,0,0.4)', width: 0.5 } },
  })

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Beta Diversity</h1>
        <p className="page-subtitle">
          PCoA — visualização da diversidade beta entre grupos
        </p>
      </div>

      {/* PCoA placeholder */}
      <div className="plot-card" style={{ marginBottom: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <span className="section-title" style={{ marginBottom: 0 }}>PCoA — Bray-Curtis</span>
          <div className="flex items-center gap-2">
            {PROJECTS.map((p) => (
              <span key={p.code} className="badge" style={{
                background: `${p.color}18`,
                color: p.color,
                border: `1px solid ${p.color}40`,
              }}>
                {p.code}
              </span>
            ))}
          </div>
        </div>
        <Plot
          data={PROJECTS.map((p) => emptyTrace(p.code, p.color))}
          layout={{
            ...darkLayout,
            xaxis: { ...axisStyle, title: { text: 'PC1' } },
            yaxis: { ...axisStyle, title: { text: 'PC2' } },
            title: {
              text: 'PCoA — Beta Diversidade (Bray-Curtis)',
              font: { color: '#00d4ff', size: 15 },
              x: 0.02,
              xanchor: 'left',
            },
            height: 480,
            autosize: true,
          } as Partial<Plotly.Layout>}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>

      {/* Alpha diversity placeholder */}
      <div className="plot-card">
        <div className="flex items-center justify-between mb-4">
          <span className="section-title" style={{ marginBottom: 0 }}>Alpha Diversity — Shannon Index</span>
        </div>
        <Plot
          data={PROJECTS.map((p) => ({
            type: 'box' as const,
            name: p.code,
            y: [] as number[],
            marker: { color: p.color },
            fillcolor: `${p.color}18`,
            line: { color: p.color },
          }))}
          layout={{
            ...darkLayout,
            xaxis: { ...axisStyle },
            yaxis: { ...axisStyle, title: { text: 'Shannon Index' } },
            title: {
              text: 'Diversidade Alpha por Projeto',
              font: { color: '#00d4ff', size: 15 },
              x: 0.02,
              xanchor: 'left',
            },
            height: 380,
            autosize: true,
          } as Partial<Plotly.Layout>}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>

      <div className="ws-status-bar" style={{ marginTop: 20 }}>
        <span className="dot dot-amber" style={{ width: 6, height: 6 }} />
        <span>Aguardando dados — conecte via SWR ao endpoint de diversidade quando disponível</span>
      </div>
    </>
  )
}
