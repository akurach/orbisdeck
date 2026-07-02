import { useEffect } from 'react'
import type { GitSummary, Project, ProjectAttention, ProjectId } from '../../shared/types'
import { useT } from '../i18n'

interface Props {
  projects: Project[]
  activeId: ProjectId | null
  attention: Record<ProjectId, ProjectAttention>
  failed: Record<ProjectId, boolean>
  git: Record<ProjectId, GitSummary>
  onSelect: (id: ProjectId) => void
  onClose: () => void
}

// Mission Control (M9 W1, enriched W2): one screen, status of ALL projects at a glance —
// the core "which session needs me" job. Attention status + waiting message come from the
// live poll App already runs; git from the slow cross-project poll. Waiting rows float to
// the top ordered by how long they've waited (the longest-waiting queue). Click to jump.
export function MissionControl({
  projects,
  activeId,
  attention,
  failed,
  git,
  onSelect,
  onClose
}: Props): JSX.Element {
  const t = useT()
  // Close on Escape, like every other modal in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // Waiting first (longest wait leads), then working, then idle.
  const rank = (id: ProjectId): number => {
    const s = attention[id]?.status
    return s === 'waiting' ? 0 : s === 'working' ? 1 : 2
  }
  const ordered = [...projects].sort((a, b) => {
    const r = rank(a.id) - rank(b.id)
    if (r !== 0) return r
    // Within waiting, oldest `since` (longest wait) first.
    return (attention[a.id]?.since ?? 0) - (attention[b.id]?.since ?? 0)
  })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal mission" onClick={(e) => e.stopPropagation()}>
        <h2>{t('mission.title')}</h2>
        <div className="mission-list">
          {ordered.map((p) => {
            const att = attention[p.id]
            const status = att?.status
            const g = git[p.id]
            const label =
              status === 'waiting'
                ? t(att?.kind === 'permission' ? 'tabs.waitPermission' : 'tabs.waiting')
                : status === 'working'
                  ? t('tabs.working')
                  : t('mission.idle')
            return (
              <div
                key={p.id}
                className={`mission-row ${p.id === activeId ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelect(p.id)
                  onClose()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(p.id)
                    onClose()
                  }
                }}
              >
                <span
                  className={`mission-dot ${status ?? 'idle'}${status === 'waiting' && att?.kind === 'permission' ? ' permission' : ''}`}
                  title={label}
                />
                <span className="mission-name">{p.name}</span>
                <span className="mission-meta">
                  <span className={`mission-status ${status ?? 'idle'}`}>{label}</span>
                  {status === 'waiting' && att?.message && (
                    <span className="mission-msg">{att.message}</span>
                  )}
                  {failed[p.id] && <span className="mission-failed">{t('tabs.runFailed')}</span>}
                </span>
                {g?.isRepo && (
                  <span className="mission-git">
                    <span className="mission-branch">{g.branch || '—'}</span>
                    {g.changed > 0 && <span className="mission-dirty">±{g.changed}</span>}
                  </span>
                )}
              </div>
            )
          })}
          {projects.length === 0 && <div className="cmdk-empty">{t('app.noProjects')}</div>}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
