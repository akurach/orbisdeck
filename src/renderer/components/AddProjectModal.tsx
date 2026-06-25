import { useState } from 'react'
import type { ProjectSettings } from '../../shared/types'
import { emptySettings } from '../state/useCockpit'

interface Props {
  onCancel: () => void
  onCreate: (name: string, settings: ProjectSettings) => void
}

export function AddProjectModal({ onCancel, onCreate }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')

  const canCreate = name.trim().length > 0

  const create = (): void => {
    if (!canCreate) return
    onCreate(name.trim(), { ...emptySettings(), path: path.trim() })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Новый проект</h2>
        <div className="field">
          <label>Имя</label>
          <input
            autoFocus
            value={name}
            placeholder="File Manager App"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
        </div>
        <div className="field">
          <label>Путь</label>
          <input
            value={path}
            placeholder="/Users/you/Projects/App"
            spellCheck={false}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Отмена
          </button>
          <button className="btn primary" disabled={!canCreate} onClick={create}>
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}
