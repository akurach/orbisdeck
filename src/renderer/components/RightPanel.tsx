import { useState } from 'react'
import type { Project, ProjectSettings } from '../../shared/types'
import { SettingsPanel } from './SettingsPanel'
import { FileTree } from './FileTree'
import { GitPanel } from './GitPanel'

interface Props {
  project: Project
  selectedPath: string | null
  onSelectFile: (path: string) => void
  onSave: (patch: { name?: string; settings?: Partial<ProjectSettings> }) => void
  onRemove: () => void
}

type Tab = 'files' | 'git' | 'agents' | 'settings'

const TABS: { key: Tab; label: string }[] = [
  { key: 'files', label: 'Файлы' },
  { key: 'git', label: 'Git' },
  { key: 'agents', label: 'Агенты' },
  { key: 'settings', label: 'Настройки' }
]

// Agents is deferred (roadmap M5). Stubbed honestly rather than faked.
function Deferred({ milestone, note }: { milestone: string; note: string }): JSX.Element {
  return (
    <div className="deferred">
      <span className="deferred-badge">{milestone}</span>
      <p>{note}</p>
    </div>
  )
}

export function RightPanel({
  project,
  selectedPath,
  onSelectFile,
  onSave,
  onRemove
}: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('settings')

  return (
    <aside className="right-panel">
      <div className="right-tabs">
        {TABS.map((t) => (
          <div
            key={t.key}
            className={`right-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div className="right-body">
        {tab === 'settings' && (
          <SettingsPanel project={project} onSave={onSave} onRemove={onRemove} />
        )}
        {tab === 'files' && (
          <FileTree
            projectId={project.id}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
          />
        )}
        {tab === 'git' && <GitPanel projectId={project.id} />}
        {tab === 'agents' && (
          <Deferred
            milestone="M5"
            note="Панель агентов появится только при наличии надёжного источника статусов."
          />
        )}
      </div>
    </aside>
  )
}
