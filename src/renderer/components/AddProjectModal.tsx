import { useState } from 'react'
import type { DetectedSettings, ProjectSettings } from '../../shared/types'
import { emptySettings } from '../state/useCockpit'
import { useT } from '../i18n'

interface Props {
  onCancel: () => void
  onCreate: (name: string, settings: ProjectSettings) => void
}

export function AddProjectModal({ onCancel, onCreate }: Props): JSX.Element {
  const t = useT()
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
      if (detected.env) settings.env = detected.env
    }
    onCreate(name.trim(), settings)
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('addProject.title')}</h2>
        <div className="field">
          <label>{t('addProject.nameLabel')}</label>
          <input
            autoFocus
            value={name}
            placeholder="File Manager App"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
        </div>
        <div className="field">
          <label>{t('addProject.folderLabel')}</label>
          <div className="path-pick">
            <button className="btn" onClick={pickFolder}>
              {t('addProject.pickFolder')}
            </button>
            <span className={`path-value ${path ? '' : 'empty'}`} title={path}>
              {path || t('addProject.noFolder')}
            </span>
          </div>
        </div>
        {detected && detected.sources.length > 0 && (
          <div className="detected">
            <div className="detected-head">
              {t('addProject.detected', { sources: detected.sources.join(', ') })}
            </div>
            <ul className="detected-list">
              {detected.runCommand && <li>{t('addProject.runLabel')} <code>{detected.runCommand}</code></li>}
              {detected.testCommand && <li>{t('addProject.testLabel')} <code>{detected.testCommand}</code></li>}
              {detected.buildCommand && <li>{t('addProject.buildLabel')} <code>{detected.buildCommand}</code></li>}
            </ul>
            <div className="detected-note">{t('addProject.detectedNote')}</div>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button className="btn primary" disabled={!canCreate} onClick={create}>
            {t('addProject.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
