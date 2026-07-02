import { useEffect, useRef, useState } from 'react'
import type { LastPrompt, ProjectId } from '../../shared/types'
import { useT } from '../i18n'

// Short relative age, e.g. "2m", "3h", "just now". Renderer-local so no backend round trip.
function relAge(ts: number, now: number): string {
  if (!ts) return ''
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// Per-project free-text notes (persisted, debounced) + a read-only "you stopped at" resume
// card (M9 W3): the newest prompt you sent, so re-entering a project after juggling others
// restores context in a glance. Not a note editor — just a reminder pulled from state.jsonl.
export function NotesPanel({ projectId }: { projectId: ProjectId }): JSX.Element {
  const t = useT()
  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [resume, setResume] = useState<LastPrompt | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    setLoaded(false)
    setResume(null)
    window.cockpit.getNote(projectId).then((t) => {
      if (!alive) return
      setText(t)
      setLoaded(true)
    })
    window.cockpit.getLastPrompt(projectId).then((p) => {
      if (alive && p.text) setResume(p)
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
    <div className="notes-wrap">
      {resume && (
        <div className="resume-card" title={resume.text}>
          <span className="resume-label">
            {t('notes.resumeLabel')}
            {resume.ts > 0 && <span className="resume-age"> · {relAge(resume.ts, Date.now())}</span>}
          </span>
          <span className="resume-text">{resume.text}</span>
        </div>
      )}
      <textarea
        className="notes-area"
        value={text}
        placeholder={t('notes.placeholder')}
        spellCheck={false}
        disabled={!loaded}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
