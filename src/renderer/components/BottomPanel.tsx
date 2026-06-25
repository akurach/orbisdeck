import { useState } from 'react'
import type { ProjectId } from '../../shared/types'
import { FileViewer } from './FileViewer'
import { DiffViewer } from './DiffViewer'

interface Props {
  projectId: ProjectId
  selectedPath: string | null
}

type Tab = 'preview' | 'diff' | 'logs' | 'notes'

const TABS: { key: Tab; label: string }[] = [
  { key: 'preview', label: 'Preview' },
  { key: 'diff', label: 'Diff' },
  { key: 'logs', label: 'Logs' },
  { key: 'notes', label: 'Заметки' }
]

export function BottomPanel({ projectId, selectedPath }: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('preview')

  return (
    <section className="bottom-panel">
      <div className="bottom-tabs">
        {TABS.map((t) => (
          <div
            key={t.key}
            className={`bottom-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </div>
        ))}
        {selectedPath && <span className="bottom-current">{selectedPath}</span>}
      </div>
      <div className="bottom-body">
        {tab === 'preview' && <FileViewer projectId={projectId} path={selectedPath} />}
        {tab === 'diff' && <DiffViewer projectId={projectId} path={selectedPath} />}
        {tab === 'logs' && <div className="deferred">Логи появятся позже.</div>}
        {tab === 'notes' && <div className="deferred">Заметки появятся позже.</div>}
      </div>
    </section>
  )
}
