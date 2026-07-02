import { useEffect, useMemo, useRef, useState } from 'react'
import type { Project, ProjectId, SearchMatch, SearchResult } from '../../shared/types'
import { useT } from '../i18n'

interface Props {
  projects: Project[]
  onOpen: (projectId: ProjectId, file: string) => void
  onClose: () => void
}

// Global cross-project search (M9 W3). Debounced ripgrep query; results grouped by project
// then file. Read-only locator — click or Enter on a hit to jump to that project + file. rg
// missing is a reported state, never a crash.
export function SearchModal({ projects, onOpen, onClose }: Props): JSX.Element {
  const t = useT()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Monotonic request id: only the latest in-flight search may apply its result. The previous
  // closure-compared guard was a no-op (it compared two values from the same closure).
  const reqId = useRef(0)

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
    let alive = true
    if (timer.current) clearTimeout(timer.current)
    const q = query.trim()
    if (!q) {
      setResult(null)
      setBusy(false)
      return
    }
    setBusy(true)
    timer.current = setTimeout(() => {
      const id = ++reqId.current
      window.cockpit.searchProjects(q).then((r) => {
        // Drop this response if a newer search started or the modal unmounted.
        if (!alive || id !== reqId.current) return
        setResult(r)
        setBusy(false)
        setSel(0)
      })
    }, 250)
    return () => {
      alive = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query])

  const hits: SearchMatch[] = result?.matches ?? []

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

  // Keep the selection in range + scrolled into view.
  useEffect(() => {
    setSel((s) => (s >= hits.length ? Math.max(0, hits.length - 1) : s))
  }, [hits.length])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.search-hit.active')?.scrollIntoView({
      block: 'nearest'
    })
  }, [sel])

  const openAt = (i: number): void => {
    const m = hits[i]
    if (!m) return
    onClose()
    onOpen(m.projectId, m.file)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(hits.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      openAt(sel)
    }
  }

  // Track a flat index across groups for selection highlight + click.
  let flat = -1

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
        <div className="cmdk-list" ref={listRef}>
          {result && !result.available && (
            <div className="cmdk-empty">{result.error || t('search.noRg')}</div>
          )}
          {result?.available && groups.length === 0 && !busy && query.trim() && (
            <div className="cmdk-empty">{t('search.empty')}</div>
          )}
          {groups.map((g) => (
            <div key={g.projectId}>
              <div className="cmdk-group">{name[g.projectId] ?? g.projectId}</div>
              {g.items.map((m) => {
                flat++
                const i = flat
                return (
                  <div
                    key={`${m.file}:${m.line}:${i}`}
                    className={`search-hit ${i === sel ? 'active' : ''}`}
                    role="option"
                    aria-selected={i === sel}
                    onMouseMove={() => setSel(i)}
                    onClick={() => openAt(i)}
                  >
                    <span className="search-loc">
                      {m.file}
                      <span className="search-line">:{m.line}</span>
                    </span>
                    <span className="search-text">{m.text}</span>
                  </div>
                )
              })}
            </div>
          ))}
          {result?.truncated && <div className="cmdk-empty">{t('search.truncated')}</div>}
        </div>
      </div>
    </div>
  )
}
