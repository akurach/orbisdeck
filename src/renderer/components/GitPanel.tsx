import { useEffect, useState } from 'react'
import type { GitSummary, ProjectId } from '../../shared/types'
import { useT } from '../i18n'

interface Props {
  projectId: ProjectId
}

const POLL_MS = 1500

export function GitPanel({ projectId }: Props): JSX.Element {
  const t = useT()
  const [summary, setSummary] = useState<GitSummary | null>(null)

  // Poll while the panel is mounted (roadmap: debounced poll, not .git watching).
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async (): Promise<void> => {
      const s = await window.cockpit.getGitSummary(projectId)
      if (!alive) return
      setSummary(s)
      timer = setTimeout(tick, POLL_MS)
    }
    tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [projectId])

  if (!summary) return <div className="git-loading">{t('common.loading')}</div>
  if (!summary.isRepo) {
    return <div className="deferred">{t('git.notARepo')}</div>
  }

  return (
    <div className="git-panel">
      <div className="git-branch">
        <span className="git-branch-name">⎇ {summary.branch}</span>
      </div>
      <div className="git-counts">
        <div className="git-count">
          <span>{t('git.changes')}</span>
          <b className="badge-num">{summary.changed}</b>
        </div>
        <div className="git-count">
          <span>{t('git.staged')}</span>
          <b className="badge-num green">{summary.staged}</b>
        </div>
        <div className="git-count">
          <span>{t('git.unstaged')}</span>
          <b className="badge-num yellow">{summary.unstaged}</b>
        </div>
      </div>
      <div className="git-commits">
        <div className="git-section-label">{t('git.recentCommits')}</div>
        {summary.recent.length === 0 && <div className="git-empty">{t('git.noCommits')}</div>}
        {summary.recent.map((c) => (
          <div className="git-commit" key={c.hash}>
            <span className="git-commit-msg" title={c.message}>
              {c.message}
            </span>
            <span className="git-commit-meta">
              {c.hash} · {c.date}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
