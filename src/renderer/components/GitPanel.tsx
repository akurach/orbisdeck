import { useEffect, useState } from 'react'
import type { GitSummary, ProjectId } from '../../shared/types'

interface Props {
  projectId: ProjectId
}

const POLL_MS = 1500

export function GitPanel({ projectId }: Props): JSX.Element {
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

  if (!summary) return <div className="git-loading">…</div>
  if (!summary.isRepo) {
    return <div className="deferred">Папка не является git-репозиторием.</div>
  }

  return (
    <div className="git-panel">
      <div className="git-branch">
        <span className="git-branch-name">⎇ {summary.branch}</span>
      </div>
      <div className="git-counts">
        <div className="git-count">
          <span>Изменения</span>
          <b className="badge-num">{summary.changed}</b>
        </div>
        <div className="git-count">
          <span>Staged</span>
          <b className="badge-num green">{summary.staged}</b>
        </div>
        <div className="git-count">
          <span>Unstaged</span>
          <b className="badge-num yellow">{summary.unstaged}</b>
        </div>
      </div>
      <div className="git-commits">
        <div className="git-section-label">Последние коммиты</div>
        {summary.recent.length === 0 && <div className="git-empty">нет коммитов</div>}
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
