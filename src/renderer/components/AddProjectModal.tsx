import { useState } from 'react'
import type { DetectedSettings, ProjectSettings } from '../../shared/types'
import { emptySettings } from '../state/useCockpit'

interface Props {
  onCancel: () => void
  onCreate: (name: string, settings: ProjectSettings) => void
}

export function AddProjectModal({ onCancel, onCreate }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [detected, setDetected] = useState<DetectedSettings | null>(null)

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
    // Scan an existing project's structure for run/test/build defaults.
    try {
      setDetected(await window.cockpit.detectProjectSettings(chosen))
    } catch {
      setDetected(null)
    }
  }

  const create = (): void => {
    if (!canCreate) return
    // Detected values are editable defaults: applied only where they were inferred,
    // never overriding anything (settings are otherwise empty at creation).
    const settings: ProjectSettings = { ...emptySettings(), path: path.trim() }
    if (detected) {
      if (detected.runCommand) settings.runCommand = detected.runCommand
      if (detected.testCommand) settings.testCommand = detected.testCommand
      if (detected.buildCommand) settings.buildCommand = detected.buildCommand
      if (detected.docsPath) settings.docsPath = detected.docsPath
      if (detected.claudeMdPath) settings.claudeMdPath = detected.claudeMdPath
    }
    onCreate(name.trim(), settings)
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
        {detected && detected.sources.length > 0 && (
          <div className="detected">
            <div className="detected-head">
              Обнаружено: {detected.sources.join(', ')}
            </div>
            <ul className="detected-list">
              {detected.runCommand && <li>Запуск: <code>{detected.runCommand}</code></li>}
              {detected.testCommand && <li>Тесты: <code>{detected.testCommand}</code></li>}
              {detected.buildCommand && <li>Сборка: <code>{detected.buildCommand}</code></li>}
            </ul>
            <div className="detected-note">Можно изменить в настройках после создания.</div>
          </div>
        )}
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
