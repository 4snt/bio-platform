'use client'

import { useEffect, useRef } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function NetworkPage({ params }: { params: { id: string } }) {
  const { data, isLoading, error } = useSWR(
    ['analysis', params.id],
    () => api.getAnalysisResults(params.id)
  )
  const cyRef = useRef<HTMLDivElement>(null)
  const shortId = params.id.slice(0, 8)

  useEffect(() => {
    if (!data || !cyRef.current) return
    const spieceasi = data.find((r) => r.analysis_type === 'spieceasi')
    const network = (spieceasi?.result_data as { nodes?: Array<{ id: string; keystone_score?: number }>; edges?: Array<{ source: string; target: string; weight?: number }> }) ?? { nodes: [], edges: [] }

    import('cytoscape').then(({ default: cytoscape }) => {
      cytoscape({
        container: cyRef.current!,
        elements: [
          ...(network.nodes ?? []).map((n) => ({
            data: {
              id: n.id,
              label: n.id,
              keystone: n.keystone_score ?? 0,
            },
          })),
          ...(network.edges ?? []).map((e) => ({
            data: {
              source: e.source,
              target: e.target,
              weight: e.weight ?? 1,
            },
          })),
        ],
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              'font-size': 9,
              'font-family': 'JetBrains Mono, Fira Code, monospace',
              color: '#7a9cc0',
              'background-color': '#0f1e38',
              'border-color': 'rgba(0, 212, 255, 0.35)',
              'border-width': 1,
              width: 20,
              height: 20,
              'text-valign': 'bottom',
              'text-margin-y': 4,
            },
          },
          {
            selector: 'node[keystone > 0.5]',
            style: {
              'background-color': 'rgba(0, 212, 255, 0.2)',
              'border-color': '#00d4ff',
              'border-width': 2,
              color: '#00d4ff',
              width: 28,
              height: 28,
            },
          },
          {
            selector: 'edge',
            style: {
              width: 1,
              'line-color': 'rgba(0, 212, 255, 0.15)',
              'curve-style': 'bezier',
            },
          },
          {
            selector: 'node:selected',
            style: {
              'background-color': 'rgba(0, 212, 255, 0.35)',
              'border-color': '#00d4ff',
              'border-width': 2,
            },
          },
        ],
        layout: { name: 'cose', animate: false },
      })
    })
  }, [data])

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/">Dashboard</Link>
        <span className="breadcrumb-sep">/</span>
        <span>Redes</span>
        <span className="breadcrumb-sep">/</span>
        <span className="mono">{shortId}…</span>
      </div>

      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Rede Microbiana</h1>
        <p className="page-subtitle mono">{params.id}</p>
      </div>

      {isLoading && (
        <div className="plot-card">
          <div className="skeleton" style={{ width: '100%', height: 600, borderRadius: 8 }} />
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 24, color: 'var(--red)' }}>
          ⚠ Erro ao carregar rede microbiana.
        </div>
      )}

      {!isLoading && !error && (
        <div className="plot-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            ref={cyRef}
            style={{
              width: '100%',
              height: 640,
              background: '#050d1a',
              borderRadius: 'var(--radius)',
            }}
          />
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 20,
              fontSize: 11,
              color: 'var(--text-3)',
            }}
          >
            <span>
              <span className="dot dot-cyan" style={{ width: 6, height: 6, marginRight: 4 }} />
              Keystone taxa (score &gt; 0.5)
            </span>
            <span>Clique em um nó para selecionar</span>
          </div>
        </div>
      )}
    </>
  )
}
