import { useEffect, useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import type { FileContent, ProjectId } from '../../shared/types'

interface Props {
  projectId: ProjectId
  path: string | null
}

export function FileViewer({ projectId, path }: Props): JSX.Element {
  const [file, setFile] = useState<FileContent | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!path) {
      setFile(null)
      return
    }
    let alive = true
    setLoading(true)
    window.cockpit.readFile(projectId, path).then((f) => {
      if (!alive) return
      setFile(f)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [projectId, path])

  const highlighted = useMemo(() => {
    if (!file || file.binary || !file.content) return ''
    try {
      if (file.language && hljs.getLanguage(file.language)) {
        return hljs.highlight(file.content, { language: file.language }).value
      }
      return hljs.highlightAuto(file.content).value
    } catch {
      return escapeHtml(file.content)
    }
  }, [file])

  if (!path) return <div className="viewer-empty">Выберите файл в дереве</div>
  if (loading) return <div className="viewer-empty">…</div>
  if (!file) return <div className="viewer-empty">—</div>
  if (file.binary) return <div className="viewer-empty">Бинарный файл — просмотр недоступен</div>

  const lineCount = file.content.split('\n').length

  return (
    <div className="file-viewer">
      <div className="viewer-head">
        <span className="viewer-path">{file.path}</span>
        {file.truncated && <span className="viewer-warn">обрезано (большой файл)</span>}
      </div>
      <div className="viewer-body">
        <div className="viewer-gutter" aria-hidden>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <pre className="viewer-code hljs">
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}
