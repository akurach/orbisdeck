import { useState } from 'react'
import type { ProjectId } from '../../shared/types'
import { useT } from '../i18n'
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

export function BottomPanel({
  projectId,
  selectedPath,
  height,
  onCollapse,
  onSwapVertical
}: Props): JSX.Element {
  const t = useT()
  const [tab, setTab] = useState<Tab>('preview')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'preview', label: 'Preview' },
    { key: 'diff', label: 'Diff' },
    { key: 'notes', label: t('bottom.notes') }
  ]

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
          title={t('bottom.swapWithConsole')}
          onClick={onSwapVertical}
        >
          ⇅
        </button>
        <button className="panel-collapse" title={t('bottom.collapsePanel')} onClick={onCollapse}>
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
