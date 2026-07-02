import type { MouseEvent } from 'react'
import type { GitSummary, Project, ProjectActivity, ProjectId } from '../../shared/types'
import { moveItem, useTabReorder } from '../state/useTabReorder'
import { useT } from '../i18n'

interface Props {
  projects: Project[]
  activeId: ProjectId | null
  onSelect: (id: ProjectId) => void
  onAdd: () => void
  onClose: (id: ProjectId) => void
  onReorder: (ids: ProjectId[]) => void
  states: Record<string, ProjectActivity>
  git: Record<string, GitSummary>
}

export function ProjectTabs({
  projects,
  activeId,
  onSelect,
  onAdd,
  onClose,
  onReorder,
  states,
  git
}: Props): JSX.Element {
  const t = useT()
  const dragTab = useTabReorder((from, to) =>
    onReorder(moveItem(projects, from, to).map((p) => p.id))
  )
  const close = (e: MouseEvent, p: Project): void => {
    e.stopPropagation()
    if (confirm(t('tabs.closeConfirm', { name: p.name }))) onClose(p.id)
  }
  return (
    <div className="project-tabs">
      {projects.map((p, i) => {
        const status = states[p.id]
        const dot = status === 'waiting' || status === 'working'
        const g = git[p.id]
        const dirty = g?.isRepo ? g.changed : 0
        return (
        <div
          key={p.id}
          className={`project-tab ${p.id === activeId ? 'active' : ''}`}
          onClick={() => onSelect(p.id)}
          {...dragTab(i)}
        >
          {dot && (
            <span
              className={`project-tab-badge ${status}`}
              title={t(status === 'working' ? 'tabs.working' : 'tabs.waiting')}
            />
          )}
          <span className="project-tab-name">{p.name}</span>
          {dirty > 0 && (
            <span className="project-tab-git" title={t('tabs.gitDirty', { n: dirty })}>
              ±{dirty}
            </span>
          )}
          <span className="project-tab-close" title={t('tabs.closeProject')} onClick={(e) => close(e, p)}>
            ×
          </span>
        </div>
        )
      })}
      <div className="project-tab add" onClick={onAdd} title={t('tabs.addProject')}>
        +
      </div>
    </div>
  )
}
