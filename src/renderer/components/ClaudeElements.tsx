import { useMemo, useState } from 'react'

interface Section {
  level: number
  title: string
  body: string
}

// Non-destructive parse of a freeform CLAUDE.md into heading-delimited sections.
// Read-only view; shared by the project Claude tab and the Global Claude modal.
export function parseSections(md: string): Section[] {
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

export function ClaudeElements({ text }: { text: string }): JSX.Element {
  const sections = useMemo(() => parseSections(text), [text])
  return (
    <div className="claude-elements">
      {sections.map((s, i) => (
        <ClaudeSection key={i} section={s} />
      ))}
    </div>
  )
}
