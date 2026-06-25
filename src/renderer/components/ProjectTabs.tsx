import type { MouseEvent } from 'react'
import type { Project, ProjectId } from '../../shared/types'
import { moveItem, useTabReorder } from '../state/useTabReorder'

interface Props {
  projects: Project[]
  activeId: ProjectId | null
  onSelect: (id: ProjectId) => void
  onAdd: () => void
  onClose: (id: ProjectId) => void
  onReorder: (ids: ProjectId[]) => void
  badges: Set<string>
}

export function ProjectTabs({
  projects,
  activeId,
  onSelect,
  onAdd,
  onClose,
  onReorder,
  badges
}: Props): JSX.Element {
  const dragTab = useTabReorder((from, to) =>
    onReorder(moveItem(projects, from, to).map((p) => p.id))
  )
  const close = (e: MouseEvent, p: Project): void => {
    e.stopPropagation()
    if (confirm(`Закрыть проект «${p.name}»? Его терминалы будут остановлены.`)) onClose(p.id)
  }
  return (
    <div className="project-tabs">
      {projects.map((p, i) => (
        <div
          key={p.id}
          className={`project-tab ${p.id === activeId ? 'active' : ''}`}
          onClick={() => onSelect(p.id)}
          {...dragTab(i)}
        >
          {badges.has(p.id) && <span className="project-tab-badge" title="Ждёт ответа" />}
          <span className="project-tab-name">{p.name}</span>
          <span className="project-tab-close" title="Закрыть проект" onClick={(e) => close(e, p)}>
            ×
          </span>
        </div>
      ))}
      <div className="project-tab add" onClick={onAdd} title="Добавить проект">
        +
      </div>
    </div>
  )
}
