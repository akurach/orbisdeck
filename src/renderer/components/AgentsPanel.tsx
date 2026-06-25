import { useEffect, useState } from 'react'
import type { ProjectId, TerminalInfo } from '../../shared/types'

interface Props {
  projectId: ProjectId
}

function elapsed(startedAt: number): string {
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  if (s < 60) return `${s}с`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}м ${s % 60}с`
  const h = Math.floor(m / 60)
  return `${h}ч ${m % 60}м`
}

// Agents are cockpit-spawned supervised processes — every field shown here is a fact
// (pid / cwd / start / alive come from node-pty). No "waiting"/message heuristics.
export function AgentsPanel({ projectId }: Props): JSX.Element {
  const [list, setList] = useState<TerminalInfo[]>([])

  useEffect(() => {
    let alive = true
    const poll = (): void => {
      window.cockpit.listTerminals(projectId).then((l) => {
        if (alive) setList(l)
      })
    }
    poll()
    const id = setInterval(poll, 2000)
    const offExit = window.cockpit.onTerminalExit(poll)
    return () => {
      alive = false
      clearInterval(id)
      offExit()
    }
  }, [projectId])

  if (list.length === 0) {
    return <div className="deferred">Нет запущенных процессов в этом проекте.</div>
  }

  return (
    <div className="agents-panel">
      {list.map((t) => (
        <div key={t.id} className="agent-card">
          <div className="agent-row">
            <span className={`dot ${t.alive ? 'running' : 'finished'}`} />
            <span className="agent-title">{t.title}</span>
            <span className={`agent-status ${t.alive ? 'running' : 'finished'}`}>
              {t.alive ? 'Running' : 'Finished'}
            </span>
          </div>
          <div className="agent-cmd">{t.command}</div>
          <div className="agent-meta">
            <span>PID {t.pid || '—'}</span>
            <span>{elapsed(t.startedAt)}</span>
          </div>
          <div className="agent-cwd" title={t.cwd}>
            {t.cwd}
          </div>
        </div>
      ))}
    </div>
  )
}
