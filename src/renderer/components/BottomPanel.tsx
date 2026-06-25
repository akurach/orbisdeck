import { useState } from 'react'
import type { ProjectId } from '../../shared/types'
import { FileViewer } from './FileViewer'
import { DiffViewer } from './DiffViewer'
import { NotesPanel } from './NotesPanel'

interface Props {
  projectId: ProjectId
  selectedPath: string | null
  height: number
  onCollapse: () => void
  onSwapVertical: () => void
}

type Tab = 'preview' | 'diff' | 'notes'

const TABS: { key: Tab; label: string }[] = [
  { key: 'preview', label: 'Preview' },
  { key: 'diff', label: 'Diff' },
  { key: 'notes', label: 'Заметки' }
]

export function BottomPanel({
  projectId,
  selectedPath,
  height,
  onCollapse,
  onSwapVertical
}: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('preview')

  return (
    <section className="bottom-panel" style={{ height }}>
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
        <button
          className="panel-collapse bottom-swap"
          title="Поменять местами с консолью (вверх/вниз)"
          onClick={onSwapVertical}
        >
          ⇅
        </button>
        <button className="panel-collapse" title="Свернуть панель" onClick={onCollapse}>
          ⌄
        </button>
      </div>
      <div className="bottom-body">
        {tab === 'preview' && <FileViewer projectId={projectId} path={selectedPath} />}
        {tab === 'diff' && <DiffViewer projectId={projectId} path={selectedPath} />}
        {tab === 'notes' && <NotesPanel projectId={projectId} />}
      </div>
    </section>
  )
}
