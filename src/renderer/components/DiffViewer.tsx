import { useEffect, useState } from 'react'
import type { DiffResult, ProjectId } from '../../shared/types'
import { useT } from '../i18n'

interface Props {
  projectId: ProjectId
  path: string | null
}

function lineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'diff-file'
  if (line.startsWith('@@')) return 'diff-hunk'
  if (line.startsWith('+')) return 'diff-add'
  if (line.startsWith('-')) return 'diff-del'
  if (line.startsWith('diff ') || line.startsWith('index ')) return 'diff-meta'
  return 'diff-ctx'
}

export function DiffViewer({ projectId, path }: Props): JSX.Element {
  const t = useT()
  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    window.cockpit.getDiff(projectId, path ?? undefined).then((d) => {
      if (!alive) return
      setDiff(d)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [projectId, path])

  if (loading) return <div className="viewer-empty">{t('common.loading')}</div>
  if (!diff) return <div className="viewer-empty">—</div>
  if (diff.binary) return <div className="viewer-empty">{t('diff.binaryUnavailable')}</div>
  if (!diff.text.trim()) return <div className="viewer-empty">{t('diff.noChanges')}</div>

  const lines = diff.text.split('\n')

  return (
    <div className="diff-viewer">
      <div className="viewer-head">
        <span className="viewer-path">{path || t('diff.wholeRepo')}</span>
        {diff.truncated && <span className="viewer-warn">{t('diff.truncated')}</span>}
      </div>
      <pre className="diff-body">
        {lines.map((line, i) => (
          <div key={i} className={`diff-line ${lineClass(line)}`}>
            {line || ' '}
          </div>
        ))}
      </pre>
    </div>
  )
}
