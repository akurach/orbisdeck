import { useEffect, useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import type { FileContent, Project } from '../../shared/types'

interface Props {
  project: Project
  onOpenGlobal: () => void
}

// Per-project CLAUDE.md surfacing (roadmap M4). Reads the path from the project's
// settings profile through the same sandboxed readFile seam used by the viewer.
export function ClaudePanel({ project, onOpenGlobal }: Props): JSX.Element {
  const [file, setFile] = useState<FileContent | null>(null)
  const [loading, setLoading] = useState(true)
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
        ⚙ Глобальная конфигурация Claude
      </button>

      <div className="git-section-label">Project CLAUDE.md</div>
      <div className="claude-path">{relPath}</div>

      {loading ? (
        <div className="viewer-empty">…</div>
      ) : !file?.content ? (
        <div className="viewer-empty">CLAUDE.md не найден в этом проекте</div>
      ) : (
        <>
          {file.truncated && <div className="viewer-warn">обрезано (большой файл)</div>}
          <pre className="claude-code hljs">
            <code dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        </>
      )}
    </div>
  )
}
