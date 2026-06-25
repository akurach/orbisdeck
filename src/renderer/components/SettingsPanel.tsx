import { useEffect, useState } from 'react'
import type { Project, ProjectSettings } from '../../shared/types'

interface Props {
  project: Project
  onSave: (patch: { name?: string; settings?: Partial<ProjectSettings> }) => void
  onRemove: () => void
}

const FIELDS: { key: keyof ProjectSettings; label: string; placeholder: string }[] = [
  { key: 'path', label: 'Путь', placeholder: '/Users/you/Projects/App' },
  { key: 'runCommand', label: 'Команда запуска', placeholder: 'npm run dev' },
  { key: 'testCommand', label: 'Тесты', placeholder: 'npm test' },
  { key: 'buildCommand', label: 'Сборка', placeholder: 'npm run build' },
  { key: 'docsPath', label: 'Документация', placeholder: 'docs/' },
  { key: 'claudeMdPath', label: 'CLAUDE.md', placeholder: './CLAUDE.md' },
  { key: 'autoLaunchCommand', label: 'Автозапуск при открытии', placeholder: 'claude (пусто = shell)' },
  { key: 'cwdSubdir', label: 'Рабочая подпапка', placeholder: 'packages/app (пусто = корень)' }
]

export function SettingsPanel({ project, onSave, onRemove }: Props): JSX.Element {
  const [name, setName] = useState(project.name)
  const [settings, setSettings] = useState<ProjectSettings>(project.settings)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setName(project.name)
    setSettings(project.settings)
    setDirty(false)
  }, [project.id, project.name, project.settings])

  const edit = (key: keyof ProjectSettings, value: string): void => {
    setSettings((s) => ({ ...s, [key]: value }))
    setDirty(true)
  }

  const pickFolder = async (): Promise<void> => {
    const chosen = await window.cockpit.pickDirectory()
    if (chosen) edit('path', chosen)
  }

  const save = (): void => {
    onSave({ name, settings })
    setDirty(false)
  }

  return (
    <div className="settings-panel">
      <div className="field">
        <label>Имя проекта</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setDirty(true)
          }}
        />
      </div>
      {FIELDS.map((f) =>
        f.key === 'path' ? (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            <div className="path-pick">
              <button className="btn" onClick={pickFolder}>
                Выбрать папку…
              </button>
              <span className={`path-value ${settings.path ? '' : 'empty'}`} title={settings.path}>
                {settings.path || 'папка не выбрана'}
              </span>
            </div>
          </div>
        ) : (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            <input
              value={settings[f.key] ?? ''}
              placeholder={f.placeholder}
              spellCheck={false}
              onChange={(e) => edit(f.key, e.target.value)}
            />
          </div>
        )
      )}
      <div className="field">
        <label>Переменные окружения (KEY=VALUE построчно)</label>
        <textarea
          className="settings-env"
          rows={3}
          value={settings.env ?? ''}
          placeholder={'API_URL=http://localhost:3000\nDEBUG=1'}
          spellCheck={false}
          onChange={(e) => edit('env', e.target.value)}
        />
      </div>
      <div className="settings-actions">
        <button className="btn primary" disabled={!dirty} onClick={save}>
          Сохранить
        </button>
        <button className="btn danger" onClick={onRemove}>
          Удалить проект
        </button>
      </div>
    </div>
  )
}
