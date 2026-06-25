import { useState } from 'react'
import type { Project, ProjectSettings } from '../../shared/types'
import { SettingsPanel } from './SettingsPanel'
import { FileTree } from './FileTree'
import { GitPanel } from './GitPanel'
import { ClaudePanel } from './ClaudePanel'
import { AgentsPanel } from './AgentsPanel'
import { DockerPanel } from './DockerPanel'

interface Props {
  project: Project
  selectedPath: string | null
  onSelectFile: (path: string) => void
  onSave: (patch: { name?: string; settings?: Partial<ProjectSettings> }) => void
  onRemove: () => void
  onOpenGlobalClaude: () => void
  width: number
  onCollapse: () => void
}

type Tab = 'files' | 'git' | 'claude' | 'agents' | 'docker' | 'settings'

const TABS: { key: Tab; label: string }[] = [
  { key: 'files', label: 'Файлы' },
  { key: 'git', label: 'Git' },
  { key: 'claude', label: 'Claude' },
  { key: 'agents', label: 'Агенты' },
  { key: 'docker', label: 'Docker' },
  { key: 'settings', label: 'Настройки' }
]

export function RightPanel({
  project,
  selectedPath,
  onSelectFile,
  onSave,
  onRemove,
  onOpenGlobalClaude,
  width,
  onCollapse
}: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('settings')

  return (
    <aside className="right-panel" style={{ width }}>
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
        <button className="panel-collapse" title="Свернуть панель" onClick={onCollapse}>
          ›
        </button>
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
        {tab === 'claude' && (
          <ClaudePanel project={project} onOpenGlobal={onOpenGlobalClaude} />
        )}
        {tab === 'agents' && <AgentsPanel projectId={project.id} />}
        {tab === 'docker' && <DockerPanel projectId={project.id} />}
      </div>
    </aside>
  )
}
