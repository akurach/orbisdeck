import { useEffect, useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import type { FileContent, Project } from '../../shared/types'
import { ClaudeElements } from './ClaudeElements'
import { useT } from '../i18n'

interface Props {
  project: Project
  onOpenGlobal: () => void
}

type View = 'elements' | 'text'

export function ClaudePanel({ project, onOpenGlobal }: Props): JSX.Element {
  const t = useT()
  const [file, setFile] = useState<FileContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('elements')
  const relPath = project.settings.claudeMdPath || 'CLAUDE.md'

  useEffect(() => {
    let alive = true
    setLoading(true)
    window.cockpit.readFile(project.id, relPath).then((f) => {
      if (!alive) return
      setFile(f)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [project.id, relPath])

  const html = useMemo(() => {
    if (!file?.content) return ''
    try {
      return hljs.highlight(file.content, { language: 'markdown' }).value
    } catch {
      return file.content.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
    }
  }, [file])

  return (
    <div className="claude-panel">
      <button className="btn claude-global-btn" onClick={onOpenGlobal}>
        ⚙ {t('claude.globalConfig')}
      </button>

      <div className="claude-head">
        <div className="git-section-label">Project CLAUDE.md</div>
        {file?.content && (
          <div className="viewer-toggle">
            <button
              className={`viewer-toggle-btn ${view === 'elements' ? 'active' : ''}`}
              onClick={() => setView('elements')}
            >
              {t('claude.elements')}
            </button>
            <button
              className={`viewer-toggle-btn ${view === 'text' ? 'active' : ''}`}
              onClick={() => setView('text')}
            >
              {t('claude.text')}
            </button>
          </div>
        )}
      </div>
      <div className="claude-path">{relPath}</div>

      {loading ? (
        <div className="viewer-empty">{t('common.loading')}</div>
      ) : !file?.content ? (
        <div className="viewer-empty">{t('claude.notFound')}</div>
      ) : (
        <>
          {file.truncated && <div className="viewer-warn">{t('claude.truncated')}</div>}
          {view === 'elements' ? (
            <ClaudeElements text={file.content} />
          ) : (
            <pre className="claude-code hljs">
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          )}
        </>
      )}
    </div>
  )
}
