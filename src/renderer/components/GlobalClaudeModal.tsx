import { useEffect, useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import type { FileContent, GlobalClaudeConfig } from '../../shared/types'

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

export function GlobalClaudeModal({ onClose }: Props): JSX.Element {
  const [cfg, setCfg] = useState<GlobalClaudeConfig | null>(null)
  const [section, setSection] = useState<Section>('settings')
  const [openCmd, setOpenCmd] = useState<FileContent | null>(null)

  useEffect(() => {
    window.cockpit.getGlobalClaude().then(setCfg)
  }, [])

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
                  <div className="claude-path">{cfg.settingsPath}</div>
                  {cfg.settingsText ? (
                    <Code code={cfg.settingsText} language="json" />
                  ) : (
                    <div className="viewer-empty">settings.json отсутствует</div>
                  )}
                  {cfg.localSettingsText && (
                    <>
                      <div className="claude-path">{cfg.localSettingsPath}</div>
                      <Code code={cfg.localSettingsText} language="json" />
                    </>
                  )}
                </>
              )}

              {section === 'permissions' && (
                <div className="claude-perms">
                  {(['allow', 'ask', 'deny'] as const).map((k) => (
                    <div key={k} className="claude-perm-group">
                      <div className={`git-section-label perm-${k}`}>{k}</div>
                      {cfg.permissions[k].length === 0 ? (
                        <div className="viewer-empty">—</div>
                      ) : (
                        cfg.permissions[k].map((rule, i) => (
                          <div key={i} className="claude-rule">
                            {rule}
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
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
                    <div className="claude-path">{cfg.claudeMdPath}</div>
                    <Code code={cfg.claudeMdText} language="markdown" />
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
