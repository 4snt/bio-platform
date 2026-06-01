const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000'

type JobStatusCallback = (jobId: string, status: string) => void

export function connectJobStatusSocket(onUpdate: JobStatusCallback): () => void {
  const ws = new WebSocket(`${WS_URL}/api/v1/jobs/ws/status`)

  ws.onmessage = (event) => {
    const [prefix, jobId, status] = (event.data as string).split(':')
    if (prefix === 'status' && jobId && status) {
      onUpdate(jobId, status)
    }
  }

  ws.onerror = () => {
    if (ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
      console.warn('[ws] conexão perdida — tentando reconectar...')
    }
  }

  return () => ws.close()
}
