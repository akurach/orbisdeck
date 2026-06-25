import type { Project, ProjectId } from '../../shared/types'

interface Props {
  projects: Project[]
  activeId: ProjectId | null
  onSelect: (id: ProjectId) => void
  onAdd: () => void
}

export function ProjectTabs({ projects, activeId, onSelect, onAdd }: Props): JSX.Element {
  return (
    <div className="project-tabs">
      {projects.map((p) => (
        <div
          key={p.id}
          className={`project-tab ${p.id === activeId ? 'active' : ''}`}
          onClick={() => onSelect(p.id)}
        >
          {p.name}
        </div>
      ))}
      <div className="project-tab add" onClick={onAdd} title="Добавить проект">
        +
      </div>
    </div>
  )
}
