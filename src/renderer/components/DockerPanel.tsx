import { useCallback, useEffect, useState } from 'react'
import type { DockerAction, DockerStatus, ProjectId } from '../../shared/types'

interface Props {
  projectId: ProjectId
}

export function DockerPanel({ projectId }: Props): JSX.Element {
  const [status, setStatus] = useState<DockerStatus | null>(null)
  const [busy, setBusy] = useState<DockerAction | null>(null)
  const [logs, setLogs] = useState<string | null>(null)

  const refresh = useCallback(() => {
    window.cockpit.getDockerStatus(projectId).then(setStatus)
  }, [projectId])

  useEffect(() => {
    setLogs(null)
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [refresh])

  const act = async (action: DockerAction): Promise<void> => {
    setBusy(action)
    await window.cockpit.dockerAction(projectId, action)
    setBusy(null)
    refresh()
  }

  const showLogs = async (): Promise<void> => {
    setLogs('…')
    setLogs((await window.cockpit.getDockerLogs(projectId)) || '(пусто)')
  }

  if (!status) return <div className="deferred">…</div>
  if (!status.available) return <div className="deferred">Docker CLI не найден в PATH.</div>
  if (!status.hasCompose) {
    return <div className="deferred">В корне проекта нет docker-compose.yml / compose.yaml.</div>
  }

  return (
    <div className="docker-panel">
      <div className="docker-actions">
        <button className="btn" disabled={!!busy} onClick={() => act('up')}>
          {busy === 'up' ? '…' : '▶ Up'}
        </button>
        <button className="btn" disabled={!!busy} onClick={() => act('restart')}>
          {busy === 'restart' ? '…' : '↻ Restart'}
        </button>
        <button className="btn" disabled={!!busy} onClick={() => act('down')}>
          {busy === 'down' ? '…' : '■ Down'}
        </button>
        <button className="btn" onClick={showLogs}>
          Логи
        </button>
      </div>

      {status.error && <div className="docker-error">{status.error}</div>}

      {status.containers.length === 0 ? (
        <div className="deferred">Нет контейнеров. Нажмите «Up» для запуска.</div>
      ) : (
        <div className="docker-list">
          {status.containers.map((c) => (
            <div key={c.id || c.name} className="docker-card">
              <div className="docker-row">
                <span className={`dot ${c.state === 'running' ? 'running' : 'finished'}`} />
                <span className="docker-service">{c.service || c.name}</span>
                <span className="docker-state">{c.state || '—'}</span>
              </div>
              <div className="docker-status">{c.status}</div>
              {c.ports && <div className="docker-ports">{c.ports}</div>}
            </div>
          ))}
        </div>
      )}

      {logs !== null && (
        <pre className="docker-logs">
          <code>{logs}</code>
        </pre>
      )}
    </div>
  )
}
