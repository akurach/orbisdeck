import { useEffect, useState } from 'react'
import type { AgentInfo, ProjectId, TerminalInfo } from '../../shared/types'

interface Props {
  projectId: ProjectId
}

function elapsed(ms: number): string {
  if (!ms) return ''
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return `${s}с`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}м ${s % 60}с`
  return `${Math.floor(m / 60)}ч ${m % 60}м`
}

// Two honest, structured sources:
//  - Claude sub-agents from the live session transcript (Task/Agent tool_use).
//  - Cockpit-spawned terminal processes (PID/cwd/start from node-pty).
export function AgentsPanel({ projectId }: Props): JSX.Element {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [procs, setProcs] = useState<TerminalInfo[]>([])

  useEffect(() => {
    let alive = true
    const poll = (): void => {
      window.cockpit.getAgents(projectId).then((a) => alive && setAgents(a))
      window.cockpit.listTerminals(projectId).then((l) => alive && setProcs(l))
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

  const running = agents.filter((a) => a.status === 'running').length

  return (
    <div className="agents-panel">
      <div className="git-section-label">
        Суб-агенты Claude{running > 0 ? ` · ${running} активных` : ''}
      </div>
      {agents.length === 0 ? (
        <div className="deferred">
          Нет суб-агентов в активной сессии. Появятся, когда Claude запустит Task/агентов.
        </div>
      ) : (
        agents.map((a) => (
          <div key={a.id} className="agent-card">
            <div className="agent-row">
              <span className={`dot ${a.status === 'running' ? 'running' : 'finished'}`} />
              <span className="agent-title">{a.type}</span>
              <span className={`agent-status ${a.status === 'running' ? 'running' : 'finished'}`}>
                {a.status === 'running' ? 'Running' : 'Done'}
              </span>
            </div>
            {a.description && <div className="agent-cmd">{a.description}</div>}
            {a.startedAt > 0 && <div className="agent-meta">{elapsed(a.startedAt)}</div>}
          </div>
        ))
      )}

      <div className="git-section-label agents-procs-label">Процессы (терминалы)</div>
      {procs.length === 0 ? (
        <div className="deferred">Нет запущенных терминалов.</div>
      ) : (
        procs.map((t) => (
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
          </div>
        ))
      )}
    </div>
  )
}
