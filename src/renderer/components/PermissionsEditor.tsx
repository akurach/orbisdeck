import { useEffect, useState } from 'react'
import type { ClaudePermissions } from '../../shared/types'
import { useT } from '../i18n'

type Group = 'allow' | 'ask' | 'deny'

const GROUP_KEYS: Group[] = ['allow', 'ask', 'deny']

export function PermissionsEditor({
  perms,
  onSaved
}: {
  perms: ClaudePermissions
  onSaved: () => void
}): JSX.Element {
  const t = useT()
  const [allow, setAllow] = useState<string[]>(perms.allow)
  const [ask, setAsk] = useState<string[]>(perms.ask)
  const [deny, setDeny] = useState<string[]>(perms.deny)
  const [draft, setDraft] = useState<Record<Group, string>>({ allow: '', ask: '', deny: '' })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setAllow(perms.allow)
    setAsk(perms.ask)
    setDeny(perms.deny)
    setDirty(false)
    setError('')
  }, [perms])

  const lists: Record<Group, [string[], (v: string[]) => void]> = {
    allow: [allow, setAllow],
    ask: [ask, setAsk],
    deny: [deny, setDeny]
  }

  const add = (g: Group): void => {
    const rule = draft[g].trim()
    if (!rule) return
    const [list, set] = lists[g]
    if (!list.includes(rule)) set([...list, rule])
    setDraft((d) => ({ ...d, [g]: '' }))
    setDirty(true)
  }

  const remove = (g: Group, rule: string): void => {
    const [list, set] = lists[g]
    set(list.filter((r) => r !== rule))
    setDirty(true)
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    const res = await window.cockpit.setClaudePermissions({ allow, ask, deny })
    setSaving(false)
    if (res.ok) {
      setDirty(false)
      onSaved()
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="claude-perms">
      <p className="perms-explainer">
        {t('perms.explainerBefore')} <code>Tool(arg)</code>.
      </p>
      {GROUP_KEYS.map((key) => {
        const [list] = lists[key]
        return (
          <div key={key} className="claude-perm-group">
            <div className={`git-section-label perm-${key}`}>{key}</div>
            <div className="perm-hint">{t(`perms.hint_${key}`)}</div>
            {list.map((rule) => (
              <div key={rule} className="claude-rule">
                <span className="claude-rule-text">{rule}</span>
                <span className="claude-rule-x" title={t('common.remove')} onClick={() => remove(key, rule)}>
                  ×
                </span>
              </div>
            ))}
            <div className="perm-add">
              <input
                value={draft[key]}
                placeholder="Bash(npm run *)"
                spellCheck={false}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && add(key)}
              />
              <button className="btn xs" onClick={() => add(key)}>
                +
              </button>
            </div>
          </div>
        )
      })}
      {error && <div className="docker-error">{error}</div>}
      <div className="settings-edit-actions">
        <button className="btn primary" disabled={!dirty || saving} onClick={save}>
          {saving ? t('common.loading') : t('perms.savePermissions')}
        </button>
      </div>
    </div>
  )
}
