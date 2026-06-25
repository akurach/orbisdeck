import { useEffect, useMemo, useState } from 'react'
import type { TFn } from '../i18n'
import { JsonTree } from './JsonTree'

// A classic settings form over ~/.claude/settings.json: each KNOWN key renders a typed
// control (dropdown / toggle / stepper / text) with a label + help line; everything else
// falls back to a read-only raw JSON tree so nothing is hidden. Edits go back through the
// existing sandboxed writeClaudeSettings round-trip (atomic + backup) in the parent.

type FieldType = 'select' | 'toggle' | 'number' | 'text'

interface KnownField {
  key: string
  type: FieldType
  label: string
  hint: string
  options?: string[]
  min?: number
  max?: number
  placeholder?: string
}

// Common Claude Code settings keys. `model` lists the current ids; an empty value means
// "let Claude Code decide" (the default).
const MODEL_OPTIONS = ['', 'default', 'opus', 'sonnet', 'haiku', 'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
const OUTPUT_STYLE_OPTIONS = ['', 'default', 'Explanatory', 'Concise']
const LOGIN_OPTIONS = ['', 'claudeai', 'console']

function knownFields(t: TFn): KnownField[] {
  return [
    {
      key: 'model',
      type: 'select',
      options: MODEL_OPTIONS,
      label: t('claudeForm.model.label'),
      hint: t('claudeForm.model.hint')
    },
    {
      key: 'includeCoAuthoredBy',
      type: 'toggle',
      label: t('claudeForm.coAuthored.label'),
      hint: t('claudeForm.coAuthored.hint')
    },
    {
      key: 'cleanupPeriodDays',
      type: 'number',
      min: 0,
      max: 3650,
      label: t('claudeForm.cleanup.label'),
      hint: t('claudeForm.cleanup.hint')
    },
    {
      key: 'outputStyle',
      type: 'select',
      options: OUTPUT_STYLE_OPTIONS,
      label: t('claudeForm.outputStyle.label'),
      hint: t('claudeForm.outputStyle.hint')
    },
    {
      key: 'enableAllProjectMcpServers',
      type: 'toggle',
      label: t('claudeForm.mcpAll.label'),
      hint: t('claudeForm.mcpAll.hint')
    },
    {
      key: 'forceLoginMethod',
      type: 'select',
      options: LOGIN_OPTIONS,
      label: t('claudeForm.login.label'),
      hint: t('claudeForm.login.hint')
    },
    {
      key: 'apiKeyHelper',
      type: 'text',
      placeholder: '/bin/generate_api_key.sh',
      label: t('claudeForm.apiKeyHelper.label'),
      hint: t('claudeForm.apiKeyHelper.hint')
    }
  ]
}

// Keys the form owns explicitly + keys that have their own dedicated section elsewhere
// (permissions/hooks/MCP are surfaced in their own tabs, so they never fall to "raw").
const HANDLED_ELSEWHERE = new Set(['permissions', 'hooks', 'mcpServers', 'env', 'statusLine'])

interface Props {
  text: string
  t: TFn
  onSave: (json: string) => Promise<{ ok: boolean; error?: string }>
}

export function ClaudeSettingsForm({ text, t, onSave }: Props): JSX.Element {
  const parsed = useMemo<Record<string, unknown> | undefined>(() => {
    if (!text) return undefined
    try {
      const v = JSON.parse(text)
      return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
    } catch {
      return undefined
    }
  }, [text])

  const [draft, setDraft] = useState<Record<string, unknown>>(parsed ?? {})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(parsed ?? {})
    setDirty(false)
    setError('')
  }, [parsed])

  const fields = useMemo(() => knownFields(t), [t])

  // If the file isn't a JSON object we can't form-edit it — show it raw.
  if (!text) return <div className="viewer-empty">{t('claudeForm.missing')}</div>
  if (parsed === undefined) {
    return <div className="viewer-empty">{t('claudeForm.notObject')}</div>
  }

  const set = (key: string, value: unknown): void => {
    setDraft((d) => {
      const next = { ...d }
      // Empty string / undefined clears the key entirely (so it reverts to the default).
      if (value === '' || value === undefined) delete next[key]
      else next[key] = value
      return next
    })
    setDirty(true)
  }

  const knownKeys = new Set(fields.map((f) => f.key))
  const rawKeys = Object.keys(draft).filter((k) => !knownKeys.has(k) && !HANDLED_ELSEWHERE.has(k))
  const rawObject: Record<string, unknown> = {}
  for (const k of rawKeys) rawObject[k] = draft[k]

  const save = async (): Promise<void> => {
    setSaving(true)
    setError('')
    const res = await onSave(JSON.stringify(draft, null, 2))
    setSaving(false)
    if (res.ok) setDirty(false)
    else setError(res.error || 'error')
  }

  const reset = (): void => {
    setDraft(parsed ?? {})
    setDirty(false)
    setError('')
  }

  return (
    <div className="claude-form">
      {fields.map((f) => {
        const v = draft[f.key]
        return (
          <div className="field claude-form-field" key={f.key}>
            <label>{f.label}</label>
            {f.type === 'toggle' ? (
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={v === true}
                  onChange={(e) => set(f.key, e.target.checked)}
                />
                <span className="field-hint">{f.hint}</span>
              </label>
            ) : (
              <>
                {f.type === 'select' && (
                  <select value={(v as string) ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                    {f.options!.map((o) => (
                      <option key={o} value={o}>
                        {o === '' ? t('claudeForm.unset') : o}
                      </option>
                    ))}
                  </select>
                )}
                {f.type === 'number' && (
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    value={v === undefined ? '' : (v as number)}
                    onChange={(e) => set(f.key, e.target.value === '' ? undefined : Number(e.target.value))}
                  />
                )}
                {f.type === 'text' && (
                  <input
                    type="text"
                    spellCheck={false}
                    placeholder={f.placeholder}
                    value={(v as string) ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
                <span className="field-hint">{f.hint}</span>
              </>
            )}
          </div>
        )
      })}

      {rawKeys.length > 0 && (
        <div className="claude-form-raw">
          <div className="git-section-label">{t('claudeForm.otherKeys')}</div>
          <JsonTree json={rawObject as never} />
        </div>
      )}

      {error && <div className="docker-error">{error}</div>}
      <div className="settings-edit-actions">
        <button className="btn" disabled={!dirty || saving} onClick={reset}>
          {t('common.reset')}
        </button>
        <button className="btn primary" disabled={!dirty || saving} onClick={save}>
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </div>
  )
}
