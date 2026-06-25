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

  const canCreate = name.trim().length > 0 && path.trim().length > 0

  const pickFolder = async (): Promise<void> => {
    const chosen = await window.cockpit.pickDirectory()
    if (!chosen) return
    setPath(chosen)
    // Auto-fill the name from the folder basename when the user hasn't typed one.
    if (!name.trim()) {
      const base = chosen.split('/').filter(Boolean).pop()
      if (base) setName(base)
    }
  }

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
          <label>Папка проекта</label>
          <div className="path-pick">
            <button className="btn" onClick={pickFolder}>
              Выбрать папку…
            </button>
            <span className={`path-value ${path ? '' : 'empty'}`} title={path}>
              {path || 'папка не выбрана'}
            </span>
          </div>
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
