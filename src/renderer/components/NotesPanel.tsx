import { useEffect, useRef, useState } from 'react'
import type { ProjectId } from '../../shared/types'

// Per-project free-text notes, persisted in the store (debounced save).
export function NotesPanel({ projectId }: { projectId: ProjectId }): JSX.Element {
  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    setLoaded(false)
    window.cockpit.getNote(projectId).then((t) => {
      if (!alive) return
      setText(t)
      setLoaded(true)
    })
    return () => {
      alive = false
      if (timer.current) clearTimeout(timer.current) // flush is handled by the 400ms save
    }
  }, [projectId])

  const onChange = (v: string): void => {
    setText(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => window.cockpit.setNote(projectId, v), 400)
  }

  return (
    <textarea
      className="notes-area"
      value={text}
      placeholder="Заметки по проекту — сохраняются автоматически…"
      spellCheck={false}
      disabled={!loaded}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
