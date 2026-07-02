import { useEffect, useMemo, useRef, useState } from 'react'
import type { Project, ProjectId, SearchMatch, SearchResult } from '../../shared/types'
import { useT } from '../i18n'

interface Props {
  projects: Project[]
  onOpen: (projectId: ProjectId, file: string, line: number) => void
  onClose: () => void
}

// Global cross-project search (M9 W3). Debounced ripgrep query; results grouped by project
// then file. Read-only locator — click a hit to jump to that project + file. rg missing is a
// reported state, never a crash.
export function SearchModal({ projects, onOpen, onClose }: Props): JSX.Element {
  const t = useT()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const name = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of projects) m[p.id] = p.name
    return m
  }, [projects])

  // Debounced query — don't spawn rg on every keystroke.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const q = query.trim()
    if (!q) {
      setResult(null)
      setBusy(false)
      return
    }
    setBusy(true)
    timer.current = setTimeout(() => {
      const mine = q
      window.cockpit.searchProjects(q).then((r) => {
        // Ignore a stale response if the query moved on.
        if (mine === query.trim()) {
          setResult(r)
          setBusy(false)
        }
      })
    }, 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query])

  // Group matches by project, preserving order.
  const groups = useMemo(() => {
    const g: { projectId: ProjectId; items: SearchMatch[] }[] = []
    for (const m of result?.matches ?? []) {
      let bucket = g.find((x) => x.projectId === m.projectId)
      if (!bucket) {
        bucket = { projectId: m.projectId, items: [] }
        g.push(bucket)
      }
      bucket.items.push(m)
    }
    return g
  }, [result])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk search-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="cmdk-list">
          {result && !result.available && (
            <div className="cmdk-empty">{result.error || t('search.noRg')}</div>
          )}
          {result?.available && groups.length === 0 && !busy && query.trim() && (
            <div className="cmdk-empty">{t('search.empty')}</div>
          )}
          {groups.map((g) => (
            <div key={g.projectId}>
              <div className="cmdk-group">{name[g.projectId] ?? g.projectId}</div>
              {g.items.map((m, i) => (
                <div
                  key={`${m.file}:${m.line}:${i}`}
                  className="search-hit"
                  onClick={() => {
                    onClose()
                    onOpen(m.projectId, m.file, m.line)
                  }}
                >
                  <span className="search-loc">
                    {m.file}
                    <span className="search-line">:{m.line}</span>
                  </span>
                  <span className="search-text">{m.text}</span>
                </div>
              ))}
            </div>
          ))}
          {result?.truncated && <div className="cmdk-empty">{t('search.truncated')}</div>}
        </div>
      </div>
    </div>
  )
}
