import { useState } from 'react'
import { useCockpit } from './state/useCockpit'
import { ProjectTabs } from './components/ProjectTabs'
import { TerminalPanel } from './components/TerminalPanel'
import { RightPanel } from './components/RightPanel'
import { AddProjectModal } from './components/AddProjectModal'

export function App(): JSX.Element {
  const cockpit = useCockpit()
  const [adding, setAdding] = useState(false)

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

      <main className="workspace">
        {activeProject ? (
          <>
            <TerminalPanel key={activeProject.id} project={activeProject} />
            <RightPanel
              project={activeProject}
              onSave={(patch) => cockpit.updateProject(activeProject.id, patch)}
              onRemove={() => cockpit.removeProject(activeProject.id)}
            />
          </>
        ) : (
          <div className="empty-state">
            <p>Нет проектов</p>
            <button className="btn primary" onClick={() => setAdding(true)}>
              Добавить проект
            </button>
          </div>
        )}
      </main>

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
