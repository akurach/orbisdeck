import { useEffect, useState } from 'react'
import type { ProjectActivity } from '../shared/types'
import { useCockpit } from './state/useCockpit'
import { useLayout } from './state/useLayout'
import { ProjectTabs } from './components/ProjectTabs'
import { TerminalPanel } from './components/TerminalPanel'
import { RightPanel } from './components/RightPanel'
import { BottomPanel } from './components/BottomPanel'
import { Splitter } from './components/Splitter'
import { AddProjectModal } from './components/AddProjectModal'
import { GlobalClaudeModal } from './components/GlobalClaudeModal'
import { AppSettingsModal } from './components/AppSettingsModal'
import { useT } from './i18n'

export function App(): JSX.Element {
  const t = useT()
  const cockpit = useCockpit()
  const [adding, setAdding] = useState(false)
  const [globalClaude, setGlobalClaude] = useState(false)
  const [appSettings, setAppSettings] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const activeId = cockpit.activeProject?.id ?? null
  const layout = useLayout(activeId ?? '__none__')
  const [hooksOffer, setHooksOffer] = useState(false)
  const [projectStates, setProjectStates] = useState<Record<string, ProjectActivity>>({})

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
        />
        <div className="topbar-right">
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
