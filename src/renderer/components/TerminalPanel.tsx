import { useCallback, useEffect, useState } from 'react'
import type { Project, TerminalId, TerminalInfo } from '../../shared/types'
import { TerminalView } from './TerminalView'
import { moveItem, useTabReorder } from '../state/useTabReorder'
import { useT } from '../i18n'

interface Props {
  project: Project
}

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24

export function TerminalPanel({ project }: Props): JSX.Element {
  const t = useT()
  const [terminals, setTerminals] = useState<TerminalInfo[]>([])
  const [activeId, setActiveId] = useState<TerminalId | null>(null)

  const spawn = useCallback(
    async (opts: { title?: string; command?: string }) => {
      const info = await window.cockpit.spawnTerminal({
        projectId: project.id,
        title: opts.title,
        command: opts.command,
        cols: DEFAULT_COLS,
        rows: DEFAULT_ROWS
      })
      setTerminals((prev) => [...prev, info])
      setActiveId(info.id)
      return info
    },
    [project.id]
  )

  // On project switch: adopt its live terminals, or open a default shell if none.
  useEffect(() => {
    let cancelled = false
    window.cockpit.listTerminals(project.id).then((list) => {
      if (cancelled) return
      if (list.length > 0) {
        setTerminals(list)
        setActiveId(list[0].id)
      } else {
        setTerminals([])
        setActiveId(null)
        // Auto-launch the configured command (e.g. `claude`) on open; plain shell if unset.
        const auto = project.settings.autoLaunchCommand?.trim()
        if (auto) spawn({ title: auto.split(/\s+/)[0], command: auto })
        else spawn({ title: 'shell' })
      }
    })
    return () => {
      cancelled = true
    }
    // Intentionally keyed on project.id only — switching projects re-adopts terminals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  // Drop tabs whose pty has exited.
  useEffect(() => {
    const off = window.cockpit.onTerminalExit((e) => {
      setTerminals((prev) => prev.map((t) => (t.id === e.id ? { ...t, alive: false } : t)))
    })
    return off
  }, [])

  const closeTab = useCallback(
    async (id: TerminalId) => {
      await window.cockpit.killTerminal(id)
      setTerminals((prev) => {
        const next = prev.filter((t) => t.id !== id)
        if (activeId === id) setActiveId(next[0]?.id ?? null)
        return next
      })
    },
    [activeId]
  )

  const dragTab = useTabReorder((from, to) =>
    setTerminals((prev) => moveItem(prev, from, to))
  )

  const settings = project.settings
  const runDisabled = !settings.runCommand
  const testDisabled = !settings.testCommand
  const buildDisabled = !settings.buildCommand

  return (
    <section className="terminal-panel">
      <header className="panel-head">
        <span className="panel-title">{t('terminal.title')}</span>
        <span className="panel-cwd">{settings.path || '—'}</span>
        <div className="panel-actions">
          <button
            className="btn"
            disabled={runDisabled}
            title={settings.runCommand || t('terminal.runNotSet')}
            onClick={() => spawn({ title: 'run', command: settings.runCommand })}
          >
            ▶ Run
          </button>
          <button
            className="btn"
            disabled={testDisabled}
            title={settings.testCommand || t('terminal.testNotSet')}
            onClick={() => spawn({ title: 'tests', command: settings.testCommand })}
          >
            Tests
          </button>
          <button
            className="btn"
            disabled={buildDisabled}
            title={settings.buildCommand || t('terminal.buildNotSet')}
            onClick={() => spawn({ title: 'build', command: settings.buildCommand })}
          >
            Build
          </button>
        </div>
      </header>

      <div className="term-tabs">
        {terminals.map((t, i) => (
          <div
            key={t.id}
            className={`term-tab ${t.id === activeId ? 'active' : ''} ${t.alive ? '' : 'dead'}`}
            onClick={() => setActiveId(t.id)}
            {...dragTab(i)}
          >
            <span className={`dot ${t.alive ? 'running' : 'finished'}`} />
            <span className="term-tab-title">{t.title}</span>
            <span
              className="term-tab-close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(t.id)
              }}
            >
              ×
            </span>
          </div>
        ))}
        <div className="term-tab add" onClick={() => spawn({ title: 'shell' })}>
          +
        </div>
      </div>

      <div className="term-stage">
        {terminals.map((t) => (
          <TerminalView key={t.id} terminalId={t.id} active={t.id === activeId} />
        ))}
        {terminals.length === 0 && <div className="term-empty">{t('terminal.empty')}</div>}
      </div>
    </section>
  )
}
