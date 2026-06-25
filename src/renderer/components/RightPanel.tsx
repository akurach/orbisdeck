import { useState } from 'react'
import type { Project, ProjectSettings } from '../../shared/types'
import { SettingsPanel } from './SettingsPanel'
import { FileTree } from './FileTree'
import { GitPanel } from './GitPanel'
import { ClaudePanel } from './ClaudePanel'
import { AgentsPanel } from './AgentsPanel'
import { DockerPanel } from './DockerPanel'
import { moveItem, useTabReorder } from '../state/useTabReorder'
import { useT } from '../i18n'

interface Props {
  project: Project
  selectedPath: string | null
  onSelectFile: (path: string) => void
  onSave: (patch: { name?: string; settings?: Partial<ProjectSettings> }) => void
  onRemove: () => void
  onOpenGlobalClaude: () => void
  width: number
  onCollapse: () => void
  onSwapSide: () => void
}

type Tab = 'files' | 'git' | 'claude' | 'agents' | 'docker' | 'settings'

const TABS: { key: Tab }[] = [
  { key: 'files' },
  { key: 'git' },
  { key: 'claude' },
  { key: 'agents' },
  { key: 'docker' },
  { key: 'settings' }
]

const ORDER_KEY = 'orbisdeck:right-tab-order'

function loadOrder(): Tab[] {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]') as Tab[]
    const valid = saved.filter((k) => TABS.some((t) => t.key === k))
    // Append any tabs missing from the saved order (e.g. new tabs added in an update).
    for (const t of TABS) if (!valid.includes(t.key)) valid.push(t.key)
    return valid
  } catch {
    return TABS.map((t) => t.key)
  }
}

export function RightPanel({
  project,
  selectedPath,
  onSelectFile,
  onSave,
  onRemove,
  onOpenGlobalClaude,
  width,
  onCollapse,
  onSwapSide
}: Props): JSX.Element {
  const t = useT()
  const [tab, setTab] = useState<Tab>('settings')
  const [order, setOrder] = useState<Tab[]>(loadOrder)

  const LABELS: Record<Tab, string> = {
    files: t('right.tabFiles'),
    git: 'Git',
    claude: 'Claude',
    agents: t('right.tabAgents'),
    docker: 'Docker',
    settings: t('right.tabSettings')
  }

  const dragTab = useTabReorder((from, to) => {
    setOrder((prev) => {
      const next = moveItem(prev, from, to)
      try {
        localStorage.setItem(ORDER_KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable */
      }
      return next
    })
  })

  const labelOf = (k: Tab): string => LABELS[k]

  return (
    <aside className="right-panel" style={{ width }}>
      <div className="right-tabs">
        {order.map((key, i) => (
          <div
            key={key}
            className={`right-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
            {...dragTab(i)}
          >
            {labelOf(key)}
          </div>
        ))}
        <button className="panel-collapse" title={t('right.swapSide')} onClick={onSwapSide}>
          ⇄
        </button>
        <button className="panel-collapse" title={t('right.collapsePanel')} onClick={onCollapse}>
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
