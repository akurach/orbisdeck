import { useEffect, useState } from 'react'
import { useCockpit } from './state/useCockpit'
import { ProjectTabs } from './components/ProjectTabs'
import { TerminalPanel } from './components/TerminalPanel'
import { RightPanel } from './components/RightPanel'
import { BottomPanel } from './components/BottomPanel'
import { AddProjectModal } from './components/AddProjectModal'

export function App(): JSX.Element {
  const cockpit = useCockpit()
  const [adding, setAdding] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const activeId = cockpit.activeProject?.id ?? null

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
        <span className="brand">◧ Cockpit</span>
        <ProjectTabs
          projects={state.projects}
          activeId={state.activeProjectId}
          onSelect={cockpit.setActiveProject}
          onAdd={() => setAdding(true)}
        />
        <div className="topbar-right">
          <span className="muted">Global Claude</span>
        </div>
      </header>

      {activeProject ? (
        <>
          <main className="workspace">
            <TerminalPanel key={activeProject.id} project={activeProject} />
            <RightPanel
              project={activeProject}
              selectedPath={selectedFile}
              onSelectFile={setSelectedFile}
              onSave={(patch) => cockpit.updateProject(activeProject.id, patch)}
              onRemove={() => cockpit.removeProject(activeProject.id)}
            />
          </main>
          <BottomPanel projectId={activeProject.id} selectedPath={selectedFile} />
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
    </div>
  )
}
