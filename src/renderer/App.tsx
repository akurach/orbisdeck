import { useEffect, useState } from 'react'
import { useCockpit } from './state/useCockpit'
import { useLayout } from './state/useLayout'
import { ProjectTabs } from './components/ProjectTabs'
import { TerminalPanel } from './components/TerminalPanel'
import { RightPanel } from './components/RightPanel'
import { BottomPanel } from './components/BottomPanel'
import { Splitter } from './components/Splitter'
import { AddProjectModal } from './components/AddProjectModal'
import { GlobalClaudeModal } from './components/GlobalClaudeModal'

export function App(): JSX.Element {
  const cockpit = useCockpit()
  const [adding, setAdding] = useState(false)
  const [globalClaude, setGlobalClaude] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const activeId = cockpit.activeProject?.id ?? null
  const layout = useLayout(activeId ?? '__none__')
  const [hooksOffer, setHooksOffer] = useState(false)

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
          title="Показать нижнюю панель"
          onClick={layout.toggleBottom}
        >
          {onTop ? '⌄' : '⌃'} Нижняя панель
        </button>
      )
    }
    const splitter = (
      <Splitter
        orientation="horizontal"
        ariaLabel="Изменить высоту нижней панели"
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
        />
        <div className="topbar-right">
          <button className="btn global-claude-btn" onClick={() => setGlobalClaude(true)}>
            Global Claude
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
                  title="Показать панель"
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
                  ariaLabel="Изменить ширину панели"
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
            <p>Нет проектов</p>
            <button className="btn primary" onClick={() => setAdding(true)}>
              Добавить проект
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

      {globalClaude && <GlobalClaudeModal onClose={() => setGlobalClaude(false)} />}

      {hooksOffer && (
        <div className="modal-backdrop" onClick={() => closeHooksOffer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Live-агенты Claude</h2>
            <p className="modal-text">
              OrbisDeck может показывать суб-агентов Claude в реальном времени (тип, статус),
              если установить два хука в <code>~/.claude/settings.json</code>. Хуки лишь пишут
              события запуска/остановки агентов в лог — твою конфигурацию они не трогают, а
              выключить можно в любой момент в настройках. Без них агенты видны с задержкой.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => closeHooksOffer(false)}>
                Позже
              </button>
              <button className="btn primary" onClick={() => closeHooksOffer(true)}>
                Включить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
