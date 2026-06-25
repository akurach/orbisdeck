import { useEffect, useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import type { FileContent, GlobalClaudeConfig } from '../../shared/types'
import { ClaudeElements } from './ClaudeElements'
import { JsonTree, setAtPath } from './JsonTree'
import { PermissionsEditor } from './PermissionsEditor'

interface Props {
  onClose: () => void
}

type Section = 'settings' | 'permissions' | 'hooks' | 'mcp' | 'commands' | 'claudemd'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'settings', label: 'Settings' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'hooks', label: 'Hooks' },
  { key: 'mcp', label: 'MCP' },
  { key: 'commands', label: 'Команды' },
  { key: 'claudemd', label: 'CLAUDE.md' }
]

// Plain-language description of each Claude Code hook event.
const HOOK_EVENT_DESC: Record<string, string> = {
  PreToolUse: 'Перед вызовом инструмента (можно разрешить/заблокировать). matcher — по имени инструмента.',
  PostToolUse: 'После того как инструмент отработал.',
  UserPromptSubmit: 'Когда ты отправляешь сообщение — до того как Claude его обработает.',
  Notification: 'Когда Claude шлёт уведомление (ждёт ввода/разрешения).',
  Stop: 'Когда Claude закончил ответ (ход завершён).',
  SubagentStart: 'Когда запускается суб-агент (Task/Agent).',
  SubagentStop: 'Когда суб-агент завершился.',
  SessionStart: 'При старте сессии Claude.',
  SessionEnd: 'При завершении сессии.',
  PreCompact: 'Перед уплотнением контекста.'
}

function highlight(code: string, language: string): string {
  if (!code) return ''
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value
    }
    return hljs.highlightAuto(code).value
  } catch {
    return code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
  }
}

function Code({ code, language }: { code: string; language: string }): JSX.Element {
  const html = useMemo(() => highlight(code, language), [code, language])
  return (
    <pre className="claude-code hljs">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  )
}

// settings.json as a collapsible tree of editable fields (default) or raw text.
// Editing is allowed only for the main settings.json; edits write back atomically.
function SettingsView({
  text,
  view,
  editable,
  onSaved
}: {
  text: string
  view: 'tree' | 'text'
  editable?: boolean
  onSaved?: () => void
}): JSX.Element {
  const parsed = useMemo(() => {
    if (!text) return undefined
    try {
      return JSON.parse(text)
    } catch {
      return undefined
    }
  }, [text])

  const [draft, setDraft] = useState<unknown>(parsed)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(parsed)
    setDirty(false)
    setError('')
  }, [parsed])

  if (!text) return <div className="viewer-empty">settings.json отсутствует</div>
  if (view === 'text' || parsed === undefined) return <Code code={text} language="json" />

  if (!editable) return <JsonTree json={parsed as never} />

  const save = async (): Promise<void> => {
    setSaving(true)
    const res = await window.cockpit.writeClaudeSettings(JSON.stringify(draft, null, 2))
    setSaving(false)
    if (res.ok) {
      setDirty(false)
      onSaved?.()
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="settings-edit">
      <JsonTree
        json={draft as never}
        editable
        onEdit={(path, value) => {
          setDraft((d: unknown) => setAtPath(d as never, path, value))
          setDirty(true)
        }}
      />
      {error && <div className="docker-error">{error}</div>}
      <div className="settings-edit-actions">
        <button
          className="btn"
          disabled={!dirty || saving}
          onClick={() => {
            setDraft(parsed)
            setDirty(false)
            setError('')
          }}
        >
          Сбросить
        </button>
        <button className="btn primary" disabled={!dirty || saving} onClick={save}>
          {saving ? '…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

export function GlobalClaudeModal({ onClose }: Props): JSX.Element {
  const [cfg, setCfg] = useState<GlobalClaudeConfig | null>(null)
  const [section, setSection] = useState<Section>('settings')
  const [openCmd, setOpenCmd] = useState<FileContent | null>(null)
  const [mdView, setMdView] = useState<'elements' | 'text'>('elements')
  const [settingsView, setSettingsView] = useState<'tree' | 'text'>('tree')
  const [hooksInstalled, setHooksInstalled] = useState<boolean | null>(null)
  const [hooksBusy, setHooksBusy] = useState(false)

  useEffect(() => {
    window.cockpit.getGlobalClaude().then(setCfg)
    window.cockpit.getAgentHooksStatus().then((s) => setHooksInstalled(s.installed))
  }, [])

  const toggleHooks = async (): Promise<void> => {
    setHooksBusy(true)
    const s = hooksInstalled
      ? await window.cockpit.uninstallAgentHooks()
      : await window.cockpit.installAgentHooks()
    setHooksInstalled(s.installed)
    setHooksBusy(false)
  }

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const openCommand = (relPath: string): void => {
    setOpenCmd(null)
    window.cockpit.readClaudeFile(relPath).then(setOpenCmd)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal claude-modal" onClick={(e) => e.stopPropagation()}>
        <div className="claude-modal-head">
          <h2>Global Claude</h2>
          {cfg && <span className="claude-dir">{cfg.claudeDir}</span>}
          <button className="btn" onClick={onClose}>
            Закрыть
          </button>
        </div>

        {hooksInstalled !== null && (
          <div className="hooks-row">
            <span className={`dot ${hooksInstalled ? 'running' : 'finished'}`} />
            <span className="hooks-label">
              Live-агенты (хуки в settings.json): {hooksInstalled ? 'включены' : 'выключены'}
            </span>
            <button className="btn xs" disabled={hooksBusy} onClick={toggleHooks}>
              {hooksBusy ? '…' : hooksInstalled ? 'Выключить' : 'Включить'}
            </button>
          </div>
        )}

        {!cfg ? (
          <div className="viewer-empty">…</div>
        ) : !cfg.exists ? (
          <div className="deferred">
            ~/.claude не найден — глобальная конфигурация Claude отсутствует.
          </div>
        ) : (
          <div className="claude-modal-body">
            <div className="claude-sections">
              {SECTIONS.map((s) => (
                <div
                  key={s.key}
                  className={`right-tab ${section === s.key ? 'active' : ''}`}
                  onClick={() => setSection(s.key)}
                >
                  {s.label}
                  {s.key === 'hooks' && cfg.hooks.length > 0 && (
                    <span className="claude-count"> {cfg.hooks.length}</span>
                  )}
                  {s.key === 'mcp' && cfg.mcpServers.length > 0 && (
                    <span className="claude-count"> {cfg.mcpServers.length}</span>
                  )}
                  {s.key === 'commands' && cfg.commands.length > 0 && (
                    <span className="claude-count"> {cfg.commands.length}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="claude-section-body">
              {section === 'settings' && (
                <>
                  <div className="claude-head">
                    <div className="git-section-label">settings.json</div>
                    <div className="viewer-toggle">
                      <button
                        className={`viewer-toggle-btn ${settingsView === 'tree' ? 'active' : ''}`}
                        onClick={() => setSettingsView('tree')}
                      >
                        Дерево
                      </button>
                      <button
                        className={`viewer-toggle-btn ${settingsView === 'text' ? 'active' : ''}`}
                        onClick={() => setSettingsView('text')}
                      >
                        Текст
                      </button>
                    </div>
                  </div>
                  <div className="claude-path">{cfg.settingsPath}</div>
                  <SettingsView
                    text={cfg.settingsText}
                    view={settingsView}
                    editable
                    onSaved={() => window.cockpit.getGlobalClaude().then(setCfg)}
                  />
                  {cfg.localSettingsText && (
                    <>
                      <div className="claude-path">{cfg.localSettingsPath}</div>
                      <SettingsView text={cfg.localSettingsText} view={settingsView} />
                    </>
                  )}
                </>
              )}

              {section === 'permissions' && (
                <PermissionsEditor
                  perms={cfg.permissions}
                  onSaved={() => window.cockpit.getGlobalClaude().then(setCfg)}
                />
              )}

              {section === 'hooks' &&
                (cfg.hooks.length === 0 ? (
                  <div className="viewer-empty">Хуки не настроены</div>
                ) : (
                  <div className="claude-hooks">
                    {cfg.hooks.map((h, i) => (
                      <div key={i} className="claude-hook">
                        <div className="claude-hook-head">
                          <span className="claude-event">{h.event}</span>
                          {h.matcher && <span className="claude-matcher">{h.matcher}</span>}
                        </div>
                        {HOOK_EVENT_DESC[h.event] && (
                          <div className="hook-desc">{HOOK_EVENT_DESC[h.event]}</div>
                        )}
                        {h.commands.map((c, j) => (
                          <code key={j} className="claude-hook-cmd">
                            {c}
                          </code>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}

              {section === 'mcp' &&
                (cfg.mcpServers.length === 0 ? (
                  <div className="viewer-empty">MCP-серверы не объявлены</div>
                ) : (
                  <div className="claude-mcp">
                    {cfg.mcpServers.map((m, i) => (
                      <div key={i} className="claude-mcp-row">
                        <span className="claude-mcp-name">{m.name}</span>
                        {m.kind && <span className="claude-kind">{m.kind}</span>}
                        <span className="claude-mcp-detail" title={m.detail}>
                          {m.detail}
                        </span>
                        <span className="claude-source">{m.source}</span>
                      </div>
                    ))}
                  </div>
                ))}

              {section === 'commands' &&
                (cfg.commands.length === 0 ? (
                  <div className="viewer-empty">Нет пользовательских команд</div>
                ) : openCmd ? (
                  <>
                    <div className="claude-path">
                      <button className="btn" onClick={() => setOpenCmd(null)}>
                        ← Назад
                      </button>
                      <span>{openCmd.path}</span>
                    </div>
                    <Code code={openCmd.content} language={openCmd.language || 'markdown'} />
                  </>
                ) : (
                  <div className="claude-commands">
                    {cfg.commands.map((c) => (
                      <div
                        key={c.path}
                        className="claude-command"
                        onClick={() => openCommand(c.path)}
                      >
                        <span className="claude-cmd-name">/{c.name}</span>
                        <span className="claude-cmd-desc">{c.description}</span>
                      </div>
                    ))}
                  </div>
                ))}

              {section === 'claudemd' &&
                (cfg.claudeMdText ? (
                  <>
                    <div className="claude-head">
                      <div className="claude-path">{cfg.claudeMdPath}</div>
                      <div className="viewer-toggle">
                        <button
                          className={`viewer-toggle-btn ${mdView === 'elements' ? 'active' : ''}`}
                          onClick={() => setMdView('elements')}
                        >
                          Элементы
                        </button>
                        <button
                          className={`viewer-toggle-btn ${mdView === 'text' ? 'active' : ''}`}
                          onClick={() => setMdView('text')}
                        >
                          Текст
                        </button>
                      </div>
                    </div>
                    {mdView === 'elements' ? (
                      <ClaudeElements text={cfg.claudeMdText} />
                    ) : (
                      <Code code={cfg.claudeMdText} language="markdown" />
                    )}
                  </>
                ) : (
                  <div className="viewer-empty">Глобальный CLAUDE.md отсутствует</div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
