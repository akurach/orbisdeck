import { useState } from 'react'
import type { Project, ProjectSettings } from '../../shared/types'
import { SettingsPanel } from './SettingsPanel'

interface Props {
  project: Project
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

// Files / Git / Agents are deferred (roadmap M3 / M5). Stubbed honestly rather than
// faked, so the shell shows the intended layout without pretending data exists.
function Deferred({ milestone, note }: { milestone: string; note: string }): JSX.Element {
  return (
    <div className="deferred">
      <span className="deferred-badge">{milestone}</span>
      <p>{note}</p>
    </div>
  )
}

export function RightPanel({ project, onSave, onRemove }: Props): JSX.Element {
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
          <Deferred milestone="M3" note="Дерево файлов и read-only просмотр — следующий этап." />
        )}
        {tab === 'git' && (
          <Deferred milestone="M3" note="Git-сводка (ветка, изменения, коммиты) — следующий этап." />
        )}
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
