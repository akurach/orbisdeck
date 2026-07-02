import { useEffect, useMemo, useRef, useState } from 'react'
import { fuzzyMatch } from '../state/keys'
import { useT } from '../i18n'

export interface Command {
  id: string
  /** visible label, already localized */
  label: string
  /** short right-aligned hint, e.g. a path or shortcut */
  hint?: string
  /** group heading, already localized */
  group?: string
  run: () => void
}

interface Props {
  commands: Command[]
  onClose: () => void
}

// Cmd+K command palette (M9 W1). Fuzzy-filters a flat action registry supplied by App;
// owns its own arrow/enter/esc navigation. Toggle/close via Cmd+K is handled by the
// global router in App so it works from anywhere, including a focused terminal.
export function CommandPalette({ commands, onClose }: Props): JSX.Element {
  const t = useT()
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(
    () => commands.filter((c) => fuzzyMatch(`${c.group ?? ''} ${c.label} ${c.hint ?? ''}`, query)),
    [commands, query]
  )

  // Keep the selection in range as the filter narrows.
  useEffect(() => {
    setSel((s) => (s >= filtered.length ? Math.max(0, filtered.length - 1) : s))
  }, [filtered.length])

  // Scroll the active row into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.cmdk-item.active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const runAt = (i: number): void => {
    const cmd = filtered[i]
    if (!cmd) return
    onClose()
    cmd.run()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(filtered.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runAt(sel)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // Render with group separators, tracking the flat index for selection/click.
  let flat = -1
  let lastGroup: string | undefined

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          value={query}
          placeholder={t('cmd.placeholder')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="cmdk-list" ref={listRef}>
          {filtered.length === 0 && <div className="cmdk-empty">{t('cmd.empty')}</div>}
          {filtered.map((c) => {
            flat++
            const i = flat
            const header = c.group && c.group !== lastGroup ? c.group : null
            lastGroup = c.group
            return (
              <div key={c.id}>
                {header && <div className="cmdk-group">{header}</div>}
                <div
                  className={`cmdk-item ${i === sel ? 'active' : ''}`}
                  onMouseMove={() => setSel(i)}
                  onClick={() => runAt(i)}
                >
                  <span className="cmdk-label">{c.label}</span>
                  {c.hint && <span className="cmdk-hint">{c.hint}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
