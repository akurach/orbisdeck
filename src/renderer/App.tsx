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

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">⬡ OrbisDeck</span>
        <ProjectTabs
          projects={state.projects}
          activeId={state.activeProjectId}
          onSelect={cockpit.setActiveProject}
          onAdd={() => setAdding(true)}
        />
        <div className="topbar-right">
          <button className="btn global-claude-btn" onClick={() => setGlobalClaude(true)}>
            Global Claude
          </button>
        </div>
      </header>

      {activeProject ? (
        <>
          <main className="workspace">
            <TerminalPanel key={activeProject.id} project={activeProject} />
            {layout.rightCollapsed ? (
              <button
                className="panel-rail rail-right"
                title="Показать правую панель"
                onClick={layout.toggleRight}
              >
                ‹
              </button>
            ) : (
              <>
                <Splitter
                  orientation="vertical"
                  ariaLabel="Изменить ширину правой панели"
                  onResize={layout.resizeRight}
                  onResizeEnd={layout.commit}
                />
                <RightPanel
                  project={activeProject}
                  selectedPath={selectedFile}
                  onSelectFile={setSelectedFile}
                  onSave={(patch) => cockpit.updateProject(activeProject.id, patch)}
                  onRemove={() => cockpit.removeProject(activeProject.id)}
                  onOpenGlobalClaude={() => setGlobalClaude(true)}
                  width={layout.rightWidth}
                  onCollapse={layout.toggleRight}
                />
              </>
            )}
          </main>
          {layout.bottomCollapsed ? (
            <button
              className="panel-rail rail-bottom"
              title="Показать нижнюю панель"
              onClick={layout.toggleBottom}
            >
              ⌃ Нижняя панель
            </button>
          ) : (
            <>
              <Splitter
                orientation="horizontal"
                ariaLabel="Изменить высоту нижней панели"
                onResize={layout.resizeBottom}
                onResizeEnd={layout.commit}
              />
              <BottomPanel
                projectId={activeProject.id}
                selectedPath={selectedFile}
                height={layout.bottomHeight}
                onCollapse={layout.toggleBottom}
              />
            </>
          )}
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
    </div>
  )
}
