import { useEffect, useMemo, useRef, useState } from 'react'
import type { GitSummary, ProjectActivity } from '../shared/types'
import { useCockpit } from './state/useCockpit'
import { useLayout } from './state/useLayout'
import { isTypingTarget } from './state/keys'
import { requestSpawn } from './state/terminalBus'
import { ProjectTabs } from './components/ProjectTabs'
import { TerminalPanel } from './components/TerminalPanel'
import { RightPanel } from './components/RightPanel'
import { BottomPanel } from './components/BottomPanel'
import { Splitter } from './components/Splitter'
import { AddProjectModal } from './components/AddProjectModal'
import { GlobalClaudeModal } from './components/GlobalClaudeModal'
import { AppSettingsModal } from './components/AppSettingsModal'
import { CommandPalette, type Command } from './components/CommandPalette'
import { MissionControl } from './components/MissionControl'
import { useT } from './i18n'

export function App(): JSX.Element {
  const t = useT()
  const cockpit = useCockpit()
  const [adding, setAdding] = useState(false)
  const [globalClaude, setGlobalClaude] = useState(false)
  const [appSettings, setAppSettings] = useState(false)
  const [palette, setPalette] = useState(false)
  const [mission, setMission] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const activeId = cockpit.activeProject?.id ?? null
  const layout = useLayout(activeId ?? '__none__')
  const [hooksOffer, setHooksOffer] = useState(false)
  const [projectStates, setProjectStates] = useState<Record<string, ProjectActivity>>({})
  const [gitByProject, setGitByProject] = useState<Record<string, GitSummary>>({})

  // Poll per-project attention status (working/waiting/idle) from the hook logs (M8.1).
  // Runs immediately on ready (subsumes the startup waiting-seed) then every 2s.
  useEffect(() => {
    if (!cockpit.ready) return
    let alive = true
    const tick = (): void => {
      window.cockpit.getProjectStates().then((s) => {
        if (alive) setProjectStates(s)
      })
    }
    tick()
    const h = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(h)
    }
  }, [cockpit.ready])

  // Instant waiting on a Notification (don't wait for the next poll) for non-active projects.
  useEffect(() => {
    return window.cockpit.onNotify((e) => {
      if (e.projectId && e.projectId !== activeId) {
        setProjectStates((prev) => ({ ...prev, [e.projectId as string]: 'waiting' }))
      }
    })
  }, [activeId])

  // Slow cross-project git poll (M9 W1). Facts for the tab dirty-count + Mission Control;
  // deliberately unhurried (8s) and one-shot per project — never the live-watched hot path
  // the Engineer warned against. Refreshed immediately when Mission Control opens.
  const projects = cockpit.state.projects
  useEffect(() => {
    if (!cockpit.ready || projects.length === 0) return
    let alive = true
    const tick = (): void => {
      Promise.all(
        projects.map((p) =>
          window.cockpit
            .getGitSummary(p.id)
            .then((g) => [p.id, g] as const)
            .catch(() => null)
        )
      ).then((pairs) => {
        if (!alive) return
        const next: Record<string, GitSummary> = {}
        for (const pair of pairs) if (pair) next[pair[0]] = pair[1]
        setGitByProject(next)
      })
    }
    tick()
    const h = setInterval(tick, 8000)
    return () => {
      alive = false
      clearInterval(h)
    }
    // Re-poll set changes when the project list changes (add/remove/reorder).
  }, [cockpit.ready, projects])

  // Refresh git the moment Mission Control opens (don't wait up to 8s for the next tick).
  useEffect(() => {
    if (!mission) return
    projects.forEach((p) => {
      window.cockpit
        .getGitSummary(p.id)
        .then((g) => setGitByProject((prev) => ({ ...prev, [p.id]: g })))
        .catch(() => {})
    })
  }, [mission, projects])

  // --- single global keydown router (M9 W1) ---
  // One capture-phase listener wins over xterm's greedy helper-textarea. Refs keep the
  // handler stable (no re-register churn) while reading current projects/active/overlay.
  const setActiveProjectRef = useRef(cockpit.setActiveProject)
  setActiveProjectRef.current = cockpit.setActiveProject
  const projectsRef = useRef(projects)
  projectsRef.current = projects
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const overlayOpen = adding || globalClaude || appSettings || mission || hooksOffer
  const overlayRef = useRef(overlayOpen)
  overlayRef.current = overlayOpen

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      // App-level toggles work from anywhere, including a focused terminal or the palette.
      if (e.key === ',') {
        e.preventDefault()
        setAppSettings(true)
        return
      }
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((o) => !o)
        return
      }
      // Navigation shortcuts stand down while typing in a real field or an overlay is up.
      if (isTypingTarget(e) || overlayRef.current) return
      const list = projectsRef.current
      if (list.length === 0) return
      if (e.key >= '1' && e.key <= '9') {
        // Cmd+9 = last (browser convention); Cmd+1..8 = that index.
        const idx = e.key === '9' ? list.length - 1 : Number(e.key) - 1
        const p = list[idx]
        if (p) {
          e.preventDefault()
          setActiveProjectRef.current(p.id)
        }
        return
      }
      if (e.key === '[' || e.key === ']') {
        const cur = list.findIndex((p) => p.id === activeIdRef.current)
        const delta = e.key === ']' ? 1 : -1
        const next = list[(Math.max(0, cur) + delta + list.length) % list.length]
        if (next) {
          e.preventDefault()
          setActiveProjectRef.current(next.id)
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Clicking the OS "awaiting input" notification jumps straight to that project.
  const setActiveProject = cockpit.setActiveProject
  useEffect(() => {
    return window.cockpit.onNotifyActivate((e) => {
      if (e.projectId) setActiveProject(e.projectId)
    })
  }, [setActiveProject])

  // Focusing a waiting project acknowledges it — drop the waiting status (the poll refills the
  // real working/idle within ~2s). Working/idle on the active project stay as-is.
  useEffect(() => {
    if (!activeId) return
    setProjectStates((prev) => {
      if (prev[activeId] !== 'waiting') return prev
      const next = { ...prev }
      delete next[activeId]
      return next
    })
  }, [activeId])

  // One-time offer to enable live-agents hooks (writes ~/.claude/settings.json).
  useEffect(() => {
    if (!cockpit.ready || cockpit.state.agentHooksPrompted) return
    let alive = true
    window.cockpit.getAgentHooksStatus().then((s) => {
      if (alive && !s.installed) setHooksOffer(true)
    })
    return () => {
      alive = false
    }
  }, [cockpit.ready, cockpit.state.agentHooksPrompted])

  // Command palette registry (M9 W1). Static-ish list rebuilt from current state; every
  // new action must be registered here or the palette silently rots (Engineer's warning).
  const setActiveProject2 = cockpit.setActiveProject
  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = []
    const gNav = t('cmd.groupNav')
    const gAction = t('cmd.groupActions')
    const gRun = t('cmd.groupRun')
    for (const p of projects) {
      if (p.id === activeId) continue
      cmds.push({
        id: `switch:${p.id}`,
        group: gNav,
        label: t('cmd.switchTo', { name: p.name }),
        run: () => setActiveProject2(p.id)
      })
    }
    cmds.push({ id: 'mission', group: gNav, label: t('mission.title'), run: () => setMission(true) })
    cmds.push({ id: 'add', group: gAction, label: t('app.addProject'), run: () => setAdding(true) })
    cmds.push({
      id: 'global',
      group: gAction,
      label: t('app.globalClaude'),
      run: () => setGlobalClaude(true)
    })
    cmds.push({
      id: 'settings',
      group: gAction,
      label: t('app.settings'),
      hint: '⌘,',
      run: () => setAppSettings(true)
    })
    const ap = projects.find((p) => p.id === activeId)
    if (ap) {
      cmds.push({
        id: 'term:new',
        group: gRun,
        label: t('cmd.newTerminal'),
        run: () => requestSpawn({ projectId: ap.id, title: 'shell' })
      })
      const s = ap.settings
      const spawnCmd = (title: string, command: string): void => {
        requestSpawn({ projectId: ap.id, title, command })
      }
      if (s.runCommand)
        cmds.push({
          id: 'run',
          group: gRun,
          label: `Run`,
          hint: s.runCommand,
          run: () => spawnCmd('run', s.runCommand)
        })
      if (s.testCommand)
        cmds.push({
          id: 'test',
          group: gRun,
          label: `Tests`,
          hint: s.testCommand,
          run: () => spawnCmd('tests', s.testCommand)
        })
      if (s.buildCommand)
        cmds.push({
          id: 'build',
          group: gRun,
          label: `Build`,
          hint: s.buildCommand,
          run: () => spawnCmd('build', s.buildCommand)
        })
      for (const rt of s.runTargets ?? []) {
        if (!rt.name || !rt.command) continue
        const command = rt.preLaunch ? `${rt.preLaunch} && ${rt.command}` : rt.command
        cmds.push({
          id: `rt:${rt.name}`,
          group: gRun,
          label: rt.name,
          hint: command,
          run: () => spawnCmd(rt.name, command)
        })
      }
    }
    return cmds
  }, [projects, activeId, t, setActiveProject2])

  const closeHooksOffer = async (install: boolean): Promise<void> => {
    if (install) await window.cockpit.installAgentHooks()
    await cockpit.markAgentHooksPrompted()
    setHooksOffer(false)
  }

  // Watch the active project's tree (debounced change events drive the file panels).
  // Reset the selected file when switching projects.
  useEffect(() => {
    if (!activeId) return
    setSelectedFile(null)
    window.cockpit.watchProject(activeId)
    return () => {
      window.cockpit.unwatchProject(activeId)
    }
  }, [activeId])

  if (!cockpit.ready) {
    return <div className="boot">…</div>
  }

  const { state, activeProject } = cockpit

  // Bottom dock — rendered above or below the workspace depending on bottomSide.
  const renderBottomDock = (projectId: string): JSX.Element => {
    const onTop = layout.bottomSide === 'top'
    if (layout.bottomCollapsed) {
      return (
        <button
          className={`panel-rail rail-bottom ${onTop ? 'rail-bottom-top' : ''}`}
          title={t('app.showBottomPanel')}
          onClick={layout.toggleBottom}
        >
          {onTop ? '⌄' : '⌃'} {t('app.bottomPanel')}
        </button>
      )
    }
    const splitter = (
      <Splitter
        orientation="horizontal"
        ariaLabel={t('app.resizeBottom')}
        onResize={(d) => layout.resizeBottom(onTop ? -d : d)}
        onResizeEnd={layout.commit}
      />
    )
    const panel = (
      <BottomPanel
        projectId={projectId}
        selectedPath={selectedFile}
        height={layout.bottomHeight}
        onCollapse={layout.toggleBottom}
        onSwapVertical={layout.toggleBottomSide}
      />
    )
    return onTop ? (
      <>
        {panel}
        {splitter}
      </>
    ) : (
      <>
        {splitter}
        {panel}
      </>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">⬡ OrbisDeck</span>
        <ProjectTabs
          projects={state.projects}
          activeId={state.activeProjectId}
          onSelect={cockpit.setActiveProject}
          onAdd={() => setAdding(true)}
          onClose={cockpit.removeProject}
          onReorder={cockpit.reorderProjects}
          states={projectStates}
          git={gitByProject}
        />
        <div className="topbar-right">
          <button
            className="btn"
            title={t('mission.title')}
            onClick={() => setMission(true)}
          >
            {t('mission.short')}
          </button>
          <button className="btn global-claude-btn" onClick={() => setGlobalClaude(true)}>
            {t('app.globalClaude')}
          </button>
          <button
            className="btn icon-btn"
            title={t('app.settings')}
            aria-label={t('app.settings')}
            onClick={() => setAppSettings(true)}
          >
            ⚙
          </button>
        </div>
      </header>

      {activeProject ? (
        <>
          {layout.bottomSide === 'top' && renderBottomDock(activeProject.id)}
          <main className="workspace">
            {(() => {
              const onLeft = layout.panelSide === 'left'
              const terminal = (
                <TerminalPanel key={activeProject.id} project={activeProject} />
              )
              const context = layout.rightCollapsed ? (
                <button
                  className="panel-rail rail-right"
                  title={t('app.showPanel')}
                  onClick={layout.toggleRight}
                >
                  {onLeft ? '›' : '‹'}
                </button>
              ) : (
                <RightPanel
                  project={activeProject}
                  selectedPath={selectedFile}
                  onSelectFile={setSelectedFile}
                  onSave={(patch) => cockpit.updateProject(activeProject.id, patch)}
                  onRemove={() => cockpit.removeProject(activeProject.id)}
                  onOpenGlobalClaude={() => setGlobalClaude(true)}
                  width={layout.rightWidth}
                  onCollapse={layout.toggleRight}
                  onSwapSide={layout.toggleSide}
                />
              )
              // Splitter sits between terminal and the docked panel; dragging toward the
              // panel must shrink it regardless of side, so invert the delta on the left.
              const splitter = layout.rightCollapsed ? null : (
                <Splitter
                  orientation="vertical"
                  ariaLabel={t('app.resizeRight')}
                  onResize={(d) => layout.resizeRight(onLeft ? -d : d)}
                  onResizeEnd={layout.commit}
                />
              )
              return onLeft ? (
                <>
                  {context}
                  {splitter}
                  {terminal}
                </>
              ) : (
                <>
                  {terminal}
                  {splitter}
                  {context}
                </>
              )
            })()}
          </main>
          {layout.bottomSide === 'bottom' && renderBottomDock(activeProject.id)}
        </>
      ) : (
        <main className="workspace">
          <div className="empty-state">
            <p>{t('app.noProjects')}</p>
            <button className="btn primary" onClick={() => setAdding(true)}>
              {t('app.addProject')}
            </button>
          </div>
        </main>
      )}

      {adding && (
        <AddProjectModal
          onCancel={() => setAdding(false)}
          onCreate={async (name, settings) => {
            await cockpit.addProject(name, settings)
            setAdding(false)
          }}
        />
      )}

      {globalClaude && (
        <GlobalClaudeModal projectId={activeId} onClose={() => setGlobalClaude(false)} />
      )}

      {appSettings && <AppSettingsModal onClose={() => setAppSettings(false)} />}

      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}

      {mission && (
        <MissionControl
          projects={state.projects}
          activeId={activeId}
          states={projectStates}
          git={gitByProject}
          onSelect={cockpit.setActiveProject}
          onClose={() => setMission(false)}
        />
      )}

      {hooksOffer && (
        <div className="modal-backdrop" onClick={() => closeHooksOffer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('app.hooksTitle')}</h2>
            <p className="modal-text">{t('app.hooksText')}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => closeHooksOffer(false)}>
                {t('common.later')}
              </button>
              <button className="btn primary" onClick={() => closeHooksOffer(true)}>
                {t('common.enable')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
