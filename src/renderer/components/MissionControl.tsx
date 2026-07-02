import type { GitSummary, Project, ProjectActivity, ProjectId } from '../../shared/types'
import { useT } from '../i18n'

interface Props {
  projects: Project[]
  activeId: ProjectId | null
  states: Record<ProjectId, ProjectActivity>
  git: Record<ProjectId, GitSummary>
  onSelect: (id: ProjectId) => void
  onClose: () => void
}

// Mission Control (M9 W1): one screen, status of ALL projects at a glance — the core
// "which session needs me" job. Attention status comes from the live poll App already
// runs; git comes from the slow cross-project poll (fact, not live-watched). Click a row
// to jump. Read-only aggregate; no per-project actions here.
export function MissionControl({
  projects,
  activeId,
  states,
  git,
  onSelect,
  onClose
}: Props): JSX.Element {
  const t = useT()
  // Attention first (waiting, then working), then the rest — surface what needs you.
  const rank = (s: ProjectActivity | undefined): number =>
    s === 'waiting' ? 0 : s === 'working' ? 1 : 2
  const ordered = [...projects].sort((a, b) => rank(states[a.id]) - rank(states[b.id]))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal mission" onClick={(e) => e.stopPropagation()}>
        <h2>{t('mission.title')}</h2>
        <div className="mission-list">
          {ordered.map((p) => {
            const status = states[p.id]
            const g = git[p.id]
            const label =
              status === 'waiting'
                ? t('tabs.waiting')
                : status === 'working'
                  ? t('tabs.working')
                  : t('mission.idle')
            return (
              <div
                key={p.id}
                className={`mission-row ${p.id === activeId ? 'active' : ''}`}
                onClick={() => {
                  onSelect(p.id)
                  onClose()
                }}
              >
                <span className={`mission-dot ${status ?? 'idle'}`} title={label} />
                <span className="mission-name">{p.name}</span>
                <span className={`mission-status ${status ?? 'idle'}`}>{label}</span>
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
