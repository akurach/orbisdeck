import { useEffect, useState } from 'react'
import type { Project, ProjectSettings, RunTarget } from '../../shared/types'
import { useT } from '../i18n'

interface Props {
  project: Project
  onSave: (patch: { name?: string; settings?: Partial<ProjectSettings> }) => void
  onRemove: () => void
}

// Stable field identifiers; label/placeholder/hint are resolved via t() at render time
// (keyed `settings.<field>.label|placeholder|hint`).
// Only the plain string-valued fields render as a single input here. Structured fields
// (runTargets) have their own editor below, so they're excluded from this list.
type StringField = Exclude<keyof ProjectSettings, 'runTargets'>
const FIELDS: StringField[] = [
  'path',
  'runCommand',
  'testCommand',
  'buildCommand',
  'docsPath',
  'claudeMdPath',
  'autoLaunchCommand',
  'cwdSubdir'
]

export function SettingsPanel({ project, onSave, onRemove }: Props): JSX.Element {
  const t = useT()
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

  const targets: RunTarget[] = settings.runTargets ?? []
  const setTargets = (next: RunTarget[]): void => {
    setSettings((s) => ({ ...s, runTargets: next }))
    setDirty(true)
  }
  const addTarget = (): void => setTargets([...targets, { name: '', command: '' }])
  const removeTarget = (i: number): void => setTargets(targets.filter((_, j) => j !== i))
  const editTarget = (i: number, key: keyof RunTarget, value: string): void =>
    setTargets(targets.map((tg, j) => (j === i ? { ...tg, [key]: value } : tg)))

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
        <label>{t('settings.nameLabel')}</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setDirty(true)
          }}
        />
      </div>
      {FIELDS.map((key) =>
        key === 'path' ? (
          <div className="field" key={key}>
            <label>{t('settings.path.label')}</label>
            <div className="path-pick">
              <button className="btn" onClick={pickFolder}>
                {t('settings.pickFolder')}
              </button>
              <span className={`path-value ${settings.path ? '' : 'empty'}`} title={settings.path}>
                {settings.path || t('settings.pathEmpty')}
              </span>
            </div>
            <span className="field-hint">{t('settings.path.hint')}</span>
          </div>
        ) : (
          <div className="field" key={key}>
            <label>{t(`settings.${key}.label`)}</label>
            <input
              value={settings[key] ?? ''}
              placeholder={t(`settings.${key}.placeholder`)}
              spellCheck={false}
              onChange={(e) => edit(key, e.target.value)}
            />
            <span className="field-hint">{t(`settings.${key}.hint`)}</span>
          </div>
        )
      )}
      <div className="field">
        <label>{t('settings.envLabel')}</label>
        <textarea
          className="settings-env"
          rows={3}
          value={settings.env ?? ''}
          placeholder={t('settings.envPlaceholder')}
          spellCheck={false}
          onChange={(e) => edit('env', e.target.value)}
        />
        <span className="field-hint">{t('settings.envHint')}</span>
      </div>
      <div className="field">
        <label>{t('settings.runTargets.label')}</label>
        <span className="field-hint">{t('settings.runTargets.hint')}</span>
        <div className="run-targets">
          {targets.map((tg, i) => (
            <div className="run-target-row" key={i}>
              <input
                className="run-target-name"
                value={tg.name}
                placeholder={t('settings.runTargets.namePlaceholder')}
                spellCheck={false}
                onChange={(e) => editTarget(i, 'name', e.target.value)}
              />
              <input
                className="run-target-cmd"
                value={tg.command}
                placeholder={t('settings.runTargets.commandPlaceholder')}
                spellCheck={false}
                onChange={(e) => editTarget(i, 'command', e.target.value)}
              />
              <input
                className="run-target-pre"
                value={tg.preLaunch ?? ''}
                placeholder={t('settings.runTargets.preLaunchPlaceholder')}
                spellCheck={false}
                onChange={(e) => editTarget(i, 'preLaunch', e.target.value)}
              />
              <button className="btn xs danger" onClick={() => removeTarget(i)} title={t('common.remove')}>
                ×
              </button>
            </div>
          ))}
          <button className="btn xs" onClick={addTarget}>
            + {t('settings.runTargets.add')}
          </button>
        </div>
      </div>
      <div className="settings-actions">
        <button className="btn" disabled={!settings.path} onClick={detect} title={t('settings.detectTitle')}>
          {t('settings.detect')}
        </button>
        <button className="btn primary" disabled={!dirty} onClick={save}>
          {t('common.save')}
        </button>
        <button className="btn danger" onClick={onRemove}>
          {t('settings.removeProject')}
        </button>
      </div>
    </div>
  )
}
