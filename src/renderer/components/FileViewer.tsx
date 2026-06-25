import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { FileContent, ProjectId } from '../../shared/types'
import { useT } from '../i18n'

interface Props {
  projectId: ProjectId
  path: string | null
}

type MdView = 'rendered' | 'code'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function FileViewer({ projectId, path }: Props): JSX.Element {
  const t = useT()
  const [file, setFile] = useState<FileContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [mdView, setMdView] = useState<MdView>('rendered')

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

  const isMarkdown = !!file && file.language === 'markdown' && !file.binary && !file.image

  const highlighted = useMemo(() => {
    if (!file || file.binary || file.image || !file.content) return ''
    try {
      if (file.language && hljs.getLanguage(file.language)) {
        return hljs.highlight(file.content, { language: file.language }).value
      }
      return hljs.highlightAuto(file.content).value
    } catch {
      return escapeHtml(file.content)
    }
  }, [file])

  // Markdown → HTML, then sanitized hard (DOMPurify strips scripts/handlers/etc).
  // CSP (img-src 'self' data:) additionally blocks any remote image fetch.
  const renderedMd = useMemo(() => {
    if (!isMarkdown || !file) return ''
    try {
      const html = marked.parse(file.content, { async: false }) as string
      return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
    } catch {
      return ''
    }
  }, [isMarkdown, file])

  if (!path) return <div className="viewer-empty">{t('viewer.selectFile')}</div>
  if (loading) return <div className="viewer-empty">{t('common.loading')}</div>
  if (!file) return <div className="viewer-empty">—</div>

  if (file.image) {
    if (file.image.tooLarge) {
      return (
        <div className="viewer-empty">
          {t('viewer.imageTooLarge', { size: formatBytes(file.image.bytes) })}
        </div>
      )
    }
    return (
      <div className="file-viewer">
        <div className="viewer-head">
          <span className="viewer-path">{file.path}</span>
          <span className="viewer-dim">
            {file.image.mime} · {formatBytes(file.image.bytes)}
          </span>
        </div>
        <div className="viewer-image-wrap">
          <img className="viewer-image" src={file.image.dataUrl} alt={file.path} />
        </div>
      </div>
    )
  }

  if (file.binary) return <div className="viewer-empty">{t('viewer.binaryFile')}</div>

  const lineCount = file.content.split('\n').length

  // Open links from rendered markdown externally (main denies in-window navigation
  // and routes window.open to the default browser via setWindowOpenHandler).
  function onMdClick(e: MouseEvent<HTMLDivElement>): void {
    const a = (e.target as HTMLElement).closest('a')
    if (a && a.getAttribute('href')) {
      e.preventDefault()
      window.open(a.href, '_blank')
    }
  }

  return (
    <div className="file-viewer">
      <div className="viewer-head">
        <span className="viewer-path">{file.path}</span>
        {file.truncated && <span className="viewer-warn">{t('viewer.truncated')}</span>}
        {isMarkdown && (
          <div className="viewer-toggle" role="tablist">
            <button
              className={`viewer-toggle-btn ${mdView === 'rendered' ? 'active' : ''}`}
              onClick={() => setMdView('rendered')}
            >
              {t('viewer.viewRendered')}
            </button>
            <button
              className={`viewer-toggle-btn ${mdView === 'code' ? 'active' : ''}`}
              onClick={() => setMdView('code')}
            >
              {t('viewer.viewCode')}
            </button>
          </div>
        )}
      </div>

      {isMarkdown && mdView === 'rendered' ? (
        <div
          className="viewer-body md-rendered"
          onClick={onMdClick}
          dangerouslySetInnerHTML={{ __html: renderedMd }}
        />
      ) : (
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
      )}
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}
