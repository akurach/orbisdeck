import type { MouseEvent } from 'react'
import type { GitSummary, Project, ProjectAttention, ProjectId } from '../../shared/types'
import { moveItem, useTabReorder } from '../state/useTabReorder'
import { useT } from '../i18n'

interface Props {
  projects: Project[]
  activeId: ProjectId | null
  onSelect: (id: ProjectId) => void
  onAdd: () => void
  onClose: (id: ProjectId) => void
  onReorder: (ids: ProjectId[]) => void
  attention: Record<string, ProjectAttention>
  failed: Record<string, boolean>
  git: Record<string, GitSummary>
}

export function ProjectTabs({
  projects,
  activeId,
  onSelect,
  onAdd,
  onClose,
  onReorder,
  attention,
  failed,
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
        const att = attention[p.id]
        const status = att?.status
        const dot = status === 'waiting' || status === 'working'
        // Waiting preview: prefer the real message, else a kind label.
        const waitTitle =
          status === 'waiting'
            ? att?.message ||
              t(att?.kind === 'permission' ? 'tabs.waitPermission' : 'tabs.waiting')
            : t('tabs.working')
        const g = git[p.id]
        const dirty = g?.isRepo ? g.changed : 0
        const isFailed = failed[p.id]
        return (
        <div
          key={p.id}
          className={`project-tab ${p.id === activeId ? 'active' : ''}`}
          onClick={() => onSelect(p.id)}
          {...dragTab(i)}
        >
          {dot && (
            <span
              className={`project-tab-badge ${status}${status === 'waiting' && att?.kind === 'permission' ? ' permission' : ''}`}
              title={waitTitle}
            />
          )}
          {isFailed && (
            <span className="project-tab-badge failed" title={t('tabs.runFailed')} />
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
