import { useEffect, useState } from 'react'
import type { Project, ProjectSettings } from '../../shared/types'

interface Props {
  project: Project
  onSave: (patch: { name?: string; settings?: Partial<ProjectSettings> }) => void
  onRemove: () => void
}

const FIELDS: { key: keyof ProjectSettings; label: string; placeholder: string; hint: string }[] = [
  {
    key: 'path',
    label: 'Путь',
    placeholder: '/Users/you/Projects/App',
    hint: 'Корневая папка проекта. Терминалы и git/файлы работают относительно неё.'
  },
  {
    key: 'runCommand',
    label: 'Команда запуска',
    placeholder: 'npm run dev',
    hint: 'Что выполняет кнопка ▶ Run — открывает терминал и запускает эту команду.'
  },
  {
    key: 'testCommand',
    label: 'Тесты',
    placeholder: 'npm test',
    hint: 'Команда для кнопки Tests.'
  },
  {
    key: 'buildCommand',
    label: 'Сборка',
    placeholder: 'npm run build',
    hint: 'Команда для кнопки Build.'
  },
  {
    key: 'docsPath',
    label: 'Документация',
    placeholder: 'docs/',
    hint: 'Папка с документацией проекта (относительно корня). Пока справочно.'
  },
  {
    key: 'claudeMdPath',
    label: 'CLAUDE.md',
    placeholder: './CLAUDE.md',
    hint: 'Путь к CLAUDE.md проекта — он показывается во вкладке «Claude».'
  },
  {
    key: 'autoLaunchCommand',
    label: 'Автозапуск при открытии',
    placeholder: 'claude (пусто = shell)',
    hint: 'Команда в первом терминале при открытии проекта. Пусто — обычный shell.'
  },
  {
    key: 'cwdSubdir',
    label: 'Рабочая подпапка',
    placeholder: 'packages/app (пусто = корень)',
    hint: 'Если терминалы должны стартовать в подпапке монорепо, а не в корне.'
  }
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

  // Re-scan the project structure and fill ONLY the empty run/test/build fields
  // (never overwrite a value the user already set).
  const detect = async (): Promise<void> => {
    if (!settings.path) return
    const d = await window.cockpit.detectProjectSettings(settings.path)
    setSettings((s) => ({
      ...s,
      runCommand: s.runCommand || d.runCommand || '',
      testCommand: s.testCommand || d.testCommand || '',
      buildCommand: s.buildCommand || d.buildCommand || '',
      env: s.env || d.env || ''
    }))
    setDirty(true)
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
            <span className="field-hint">{f.hint}</span>
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
            <span className="field-hint">{f.hint}</span>
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
        <span className="field-hint">
          Подмешиваются в окружение всех терминалов проекта. Файл .env проекта подхватывается
          автоматически — здесь только дополнения/переопределения.
        </span>
      </div>
      <div className="settings-actions">
        <button className="btn" disabled={!settings.path} onClick={detect} title="Определить run/test/build по структуре">
          Определить
        </button>
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
