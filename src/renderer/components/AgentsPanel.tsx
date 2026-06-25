import { useEffect, useState } from 'react'
import type { AgentInfo, ProjectId, TerminalInfo } from '../../shared/types'
import { useT, type TFn } from '../i18n'

interface Props {
  projectId: ProjectId
}

function fmtDur(t: TFn, ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}${t('agents.unitSec')}`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}${t('agents.unitMin')} ${s % 60}${t('agents.unitSec')}`
  return `${Math.floor(m / 60)}${t('agents.unitHour')} ${m % 60}${t('agents.unitMin')}`
}

/** Running → ticking elapsed; done → frozen duration (end − start). */
function agentTime(t: TFn, a: AgentInfo): string {
  if (!a.startedAt) return ''
  if (a.status === 'running') return fmtDur(t, Date.now() - a.startedAt)
  if (a.endedAt > a.startedAt) return fmtDur(t, a.endedAt - a.startedAt)
  return ''
}

// Two honest, structured sources:
//  - Claude sub-agents from the live session transcript (Task/Agent tool_use).
//  - Cockpit-spawned terminal processes (PID/cwd/start from node-pty).
export function AgentsPanel({ projectId }: Props): JSX.Element {
  const t = useT()
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [procs, setProcs] = useState<TerminalInfo[]>([])
  const [hooksInstalled, setHooksInstalled] = useState<boolean | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    let alive = true
    const poll = (): void => {
      window.cockpit.getAgents(projectId).then((a) => alive && setAgents(a))
      window.cockpit.listTerminals(projectId).then((l) => alive && setProcs(l))
    }
    poll()
    window.cockpit.getAgentHooksStatus().then((s) => alive && setHooksInstalled(s.installed))
    const id = setInterval(poll, 2000)
    const offExit = window.cockpit.onTerminalExit(poll)
    return () => {
      alive = false
      clearInterval(id)
      offExit()
    }
  }, [projectId])

  const enableLive = async (): Promise<void> => {
    setInstalling(true)
    const s = await window.cockpit.installAgentHooks()
    setHooksInstalled(s.installed)
    setInstalling(false)
  }

  const running = agents.filter((a) => a.status === 'running').length

  return (
    <div className="agents-panel">
      {hooksInstalled === false && (
        <div className="agent-hint">
          {t('agents.liveDisabled')}
          <button className="btn xs" disabled={installing} onClick={enableLive}>
            {installing ? t('common.loading') : t('agents.enableLive')}
          </button>
        </div>
      )}
      <div className="git-section-label">
        {t('agents.subAgentsTitle')}
        {running > 0 ? t('agents.activeCount', { count: running }) : ''}
        {hooksInstalled ? ' · live' : ''}
      </div>
      {agents.length === 0 ? (
        <div className="deferred">{t('agents.noSubAgents')}</div>
      ) : (
        agents.map((a) => (
          <div key={a.id} className="agent-card">
            <div className="agent-row">
              <span
                className={`dot ${a.status === 'running' ? 'running' : a.status === 'interrupted' ? 'waiting' : 'finished'}`}
              />
              <span className="agent-title">{a.type}</span>
              <span className={`agent-status ${a.status}`}>
                {a.status === 'running'
                  ? 'Running'
                  : a.status === 'interrupted'
                    ? t('agents.interrupted')
                    : 'Done'}
              </span>
            </div>
            {a.description && <div className="agent-cmd">{a.description}</div>}
            {agentTime(t, a) && <div className="agent-meta">{agentTime(t, a)}</div>}
          </div>
        ))
      )}

      <div className="git-section-label agents-procs-label">{t('agents.processesLabel')}</div>
      {procs.length === 0 ? (
        <div className="deferred">{t('agents.noTerminals')}</div>
      ) : (
        procs.map((term) => (
          <div key={term.id} className="agent-card">
            <div className="agent-row">
              <span className={`dot ${term.alive ? 'running' : 'finished'}`} />
              <span className="agent-title">{term.title}</span>
              <span className={`agent-status ${term.alive ? 'running' : 'finished'}`}>
                {term.alive ? 'Running' : 'Finished'}
              </span>
            </div>
            <div className="agent-cmd">{term.command}</div>
            <div className="agent-meta">
              <span>PID {term.pid || '—'}</span>
              <span>{term.startedAt ? fmtDur(t, Date.now() - term.startedAt) : ''}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
