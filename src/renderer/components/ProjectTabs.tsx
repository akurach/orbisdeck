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
        const isActive = p.id === activeId
        // Never show a stale failed dot on the tab you're looking at (a fast switch could set
        // it just after the focus-clear ran). One status slot, priority-ranked so a background
        // tab carries at most ONE dot: failed > waiting > working.
        const isFailed = failed[p.id] && !isActive
        const badge: { cls: string; title: string } | null = isFailed
          ? { cls: 'failed', title: t('tabs.runFailed') }
          : status === 'waiting'
            ? {
                cls: att?.kind === 'permission' ? 'waiting permission' : 'waiting',
                title:
                  att?.message ||
                  t(att?.kind === 'permission' ? 'tabs.waitPermission' : 'tabs.waiting')
              }
            : status === 'working'
              ? { cls: 'working', title: t('tabs.working') }
              : null
        const g = git[p.id]
        const dirty = g?.isRepo ? g.changed : 0
        return (
        <div
          key={p.id}
          className={`project-tab ${isActive ? 'active' : ''}`}
          onClick={() => onSelect(p.id)}
          {...dragTab(i)}
        >
          {badge && <span className={`project-tab-badge ${badge.cls}`} title={badge.title} />}
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
