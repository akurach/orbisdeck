import { useCallback, useEffect, useState } from 'react'
import type { DirEntry, GitChangeKind, ProjectId } from '../../shared/types'

interface Props {
  projectId: ProjectId
  selectedPath: string | null
  onSelectFile: (path: string) => void
}

const BADGE: Record<GitChangeKind, { letter: string; cls: string }> = {
  added: { letter: 'A', cls: 'green' },
  modified: { letter: 'M', cls: 'yellow' },
  deleted: { letter: 'D', cls: 'red' },
  renamed: { letter: 'R', cls: 'yellow' },
  untracked: { letter: '?', cls: 'faint' }
}

export function FileTree({ projectId, selectedPath, onSelectFile }: Props): JSX.Element {
  const [children, setChildren] = useState<Record<string, DirEntry[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<Record<string, GitChangeKind>>({})

  const loadDir = useCallback(
    async (path: string) => {
      const entries = await window.cockpit.listDir(projectId, path)
      setChildren((prev) => ({ ...prev, [path]: entries }))
    },
    [projectId]
  )

  const refreshStatus = useCallback(async () => {
    const s = await window.cockpit.getGitSummary(projectId)
    setStatus(s.isRepo ? s.fileStatus : {})
  }, [projectId])

  // Initial load + reset on project switch.
  useEffect(() => {
    setChildren({})
    setExpanded(new Set())
    loadDir('')
    refreshStatus()
  }, [projectId, loadDir, refreshStatus])

  // Refresh loaded dirs + badges when the watched tree changes (debounced in main).
  useEffect(() => {
    const off = window.cockpit.onFilesChanged((e) => {
      if (e.projectId !== projectId) return
      setChildren((prev) => {
        for (const path of Object.keys(prev)) loadDir(path)
        return prev
      })
      refreshStatus()
    })
    return off
  }, [projectId, loadDir, refreshStatus])

  const toggle = (path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
        if (!children[path]) loadDir(path)
      }
      return next
    })
  }

  const renderEntries = (path: string, depth: number): JSX.Element[] => {
    const entries = children[path] ?? []
    const rows: JSX.Element[] = []
    for (const entry of entries) {
      const badge = status[entry.path]
      const isOpen = expanded.has(entry.path)
      rows.push(
        <div
          key={entry.path}
          className={`tree-row ${selectedPath === entry.path ? 'selected' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => (entry.isDir ? toggle(entry.path) : onSelectFile(entry.path))}
        >
          <span className="tree-caret">{entry.isDir ? (isOpen ? '▾' : '▸') : ''}</span>
          <span className="tree-icon">{entry.isDir ? '📁' : '📄'}</span>
          <span className="tree-name">{entry.name}</span>
          {badge && <span className={`tree-badge ${BADGE[badge].cls}`}>{BADGE[badge].letter}</span>}
        </div>
      )
      if (entry.isDir && isOpen) rows.push(...renderEntries(entry.path, depth + 1))
    }
    return rows
  }

  return <div className="file-tree">{renderEntries('', 0)}</div>
}
