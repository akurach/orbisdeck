import { useCallback, useEffect, useState } from 'react'
import type { DockerAction, DockerStatus, ProjectId } from '../../shared/types'
import { LogsModal } from './LogsModal'
import { useT } from '../i18n'

interface Props {
  projectId: ProjectId
}

interface LogsState {
  service?: string
  title: string
  text: string
  loading: boolean
}

export function DockerPanel({ projectId }: Props): JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<DockerStatus | null>(null)
  const [busy, setBusy] = useState<string | null>(null) // `${action}:${service||'*'}`
  const [logs, setLogs] = useState<LogsState | null>(null)

  const refresh = useCallback(() => {
    window.cockpit.getDockerStatus(projectId).then(setStatus)
  }, [projectId])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [refresh])

  const act = async (action: DockerAction, service?: string): Promise<void> => {
    setBusy(`${action}:${service ?? '*'}`)
    await window.cockpit.dockerAction(projectId, action, service)
    setBusy(null)
    refresh()
  }

  const openLogs = useCallback(
    async (service?: string): Promise<void> => {
      const title = service ? t('docker.logsTitleService', { service }) : t('docker.logsTitleAll')
      setLogs({ service, title, text: '', loading: true })
      const text = await window.cockpit.getDockerLogs(projectId, service)
      setLogs({ service, title, text, loading: false })
    },
    [projectId, t]
  )

  if (!status) return <div className="deferred">{t('common.loading')}</div>
  if (!status.available) return <div className="deferred">{t('docker.dockerCliNotFound')}</div>
  if (!status.hasCompose) {
    return <div className="deferred">{t('docker.noComposeFile')}</div>
  }

  const b = (action: DockerAction, svc?: string): boolean => busy === `${action}:${svc ?? '*'}`

  return (
    <div className="docker-panel">
      <div className="docker-actions">
        <button className="btn" disabled={!!busy} onClick={() => act('up')}>
          ▶ Up all
        </button>
        <button className="btn" disabled={!!busy} onClick={() => act('down')}>
          ■ Down all
        </button>
        <button className="btn" onClick={() => openLogs()}>
          {t('docker.logsAll')}
        </button>
      </div>

      {status.error && <div className="docker-error">{status.error}</div>}

      {status.containers.length === 0 ? (
        <div className="deferred">{t('docker.noContainers')}</div>
      ) : (
        <div className="docker-list">
          {status.containers.map((c) => {
            const svc = c.service || c.name
            const running = c.state === 'running'
            return (
              <div key={c.id || c.name} className="docker-card">
                <div className="docker-row">
                  <span className={`dot ${running ? 'running' : 'finished'}`} />
                  <span className="docker-service">{svc}</span>
                  <span className="docker-state">{c.state || '—'}</span>
                </div>
                <div className="docker-status">{c.status}</div>
                {c.ports && <div className="docker-ports">{c.ports}</div>}
                <div className="docker-card-actions">
                  {running ? (
                    <>
                      <button className="btn xs" disabled={!!busy} onClick={() => act('restart', svc)}>
                        {b('restart', svc) ? t('common.loading') : '↻'}
                      </button>
                      <button className="btn xs" disabled={!!busy} onClick={() => act('stop', svc)}>
                        {b('stop', svc) ? t('common.loading') : '■ Stop'}
                      </button>
                    </>
                  ) : (
                    <button className="btn xs" disabled={!!busy} onClick={() => act('up', svc)}>
                      {b('up', svc) ? t('common.loading') : '▶ Up'}
                    </button>
                  )}
                  <button className="btn xs" onClick={() => openLogs(svc)}>
                    {t('docker.logs')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {logs && (
        <LogsModal
          title={logs.title}
          text={logs.text}
          loading={logs.loading}
          onRefresh={() => openLogs(logs.service)}
          onClose={() => setLogs(null)}
        />
      )}
    </div>
  )
}
