import { useEffect, useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import type { FileContent, Project } from '../../shared/types'

interface Props {
  project: Project
  onOpenGlobal: () => void
}

interface Section {
  level: number
  title: string
  body: string
}

// Non-destructive "view as elements": split CLAUDE.md into heading-delimited sections.
// Read-only for now (roadmap: write/toggle only once round-trip is proven safe).
function parseSections(md: string): Section[] {
  const out: Section[] = []
  let cur: Section | null = null
  for (const line of md.split('\n')) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (m) {
      if (cur) out.push(cur)
      cur = { level: m[1].length, title: m[2].trim(), body: '' }
    } else if (cur) {
      cur.body += (cur.body ? '\n' : '') + line
    } else if (line.trim()) {
      cur = { level: 0, title: '(вступление)', body: line }
    }
  }
  if (cur) out.push(cur)
  return out.map((s) => ({ ...s, body: s.body.trim() }))
}

type View = 'elements' | 'text'

export function ClaudePanel({ project, onOpenGlobal }: Props): JSX.Element {
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

  const sections = useMemo(() => (file?.content ? parseSections(file.content) : []), [file])

  return (
    <div className="claude-panel">
      <button className="btn claude-global-btn" onClick={onOpenGlobal}>
        ⚙ Глобальная конфигурация Claude
      </button>

      <div className="claude-head">
        <div className="git-section-label">Project CLAUDE.md</div>
        {file?.content && (
          <div className="viewer-toggle">
            <button
              className={`viewer-toggle-btn ${view === 'elements' ? 'active' : ''}`}
              onClick={() => setView('elements')}
            >
              Элементы
            </button>
            <button
              className={`viewer-toggle-btn ${view === 'text' ? 'active' : ''}`}
              onClick={() => setView('text')}
            >
              Текст
            </button>
          </div>
        )}
      </div>
      <div className="claude-path">{relPath}</div>

      {loading ? (
        <div className="viewer-empty">…</div>
      ) : !file?.content ? (
        <div className="viewer-empty">CLAUDE.md не найден в этом проекте</div>
      ) : (
        <>
          {file.truncated && <div className="viewer-warn">обрезано (большой файл)</div>}
          {view === 'elements' ? (
            <div className="claude-elements">
              {sections.map((s, i) => (
                <ClaudeSection key={i} section={s} />
              ))}
            </div>
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

function ClaudeSection({ section }: { section: Section }): JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className={`claude-element lvl-${section.level}`}>
      <button className="claude-element-head" onClick={() => setOpen((o) => !o)}>
        <span className="claude-element-caret">{open ? '▾' : '▸'}</span>
        <span className="claude-element-title">{section.title}</span>
      </button>
      {open && section.body && <pre className="claude-element-body">{section.body}</pre>}
    </div>
  )
}
