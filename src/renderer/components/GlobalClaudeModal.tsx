import { useEffect, useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import type { ClaudeCommand, FileContent, GlobalClaudeConfig, ProjectId } from '../../shared/types'
import { useT } from '../i18n'
import { ClaudeElements } from './ClaudeElements'
import { ClaudeSettingsForm } from './ClaudeSettingsForm'
import { PermissionsEditor } from './PermissionsEditor'
import { ClaudeContextGraph } from './ClaudeContextGraph'

interface Props {
  onClose: () => void
  /** Active project — drives the project column of the context map (null = global only). */
  projectId: ProjectId | null
}

type Section =
  | 'map'
  | 'settings'
  | 'permissions'
  | 'hooks'
  | 'mcp'
  | 'skills'
  | 'agents'
  | 'commands'
  | 'claudemd'

// Plain-language hook-event descriptions, keyed so each resolves through i18n at render.
const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'Notification',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'SessionStart',
  'SessionEnd',
  'PreCompact'
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
  const t = useT()
  const [cfg, setCfg] = useState<GlobalClaudeConfig | null>(null)
  const [section, setSection] = useState<Section>('map')
  const [openCmd, setOpenCmd] = useState<FileContent | null>(null)
  const [mdView, setMdView] = useState<'elements' | 'text'>('elements')
  const [settingsView, setSettingsView] = useState<'form' | 'raw'>('form')
  const [hooksInstalled, setHooksInstalled] = useState<boolean | null>(null)
  const [hooksBusy, setHooksBusy] = useState(false)

  const SECTIONS: { key: Section; label: string }[] = [
    { key: 'map', label: t('map.tab') },
    { key: 'settings', label: 'Settings' },
    { key: 'permissions', label: 'Permissions' },
    { key: 'hooks', label: 'Hooks' },
    { key: 'mcp', label: 'MCP' },
    { key: 'skills', label: t('gc.skills') },
    { key: 'agents', label: t('gc.agents') },
    { key: 'commands', label: t('gc.commands') },
    { key: 'claudemd', label: 'CLAUDE.md' }
  ]

  const hookDesc = (event: string): string => (HOOK_EVENTS.includes(event) ? t(`hookEvent.${event}`) : '')

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

  const reloadCfg = (): void => {
    window.cockpit.getGlobalClaude().then(setCfg)
  }

  // Shared "list of files → open one" view for commands / skills / agents (all read via
  // readClaudeFile and shown with the openCmd viewer).
  const renderFiles = (list: ClaudeCommand[], emptyKey: string, prefix: string): JSX.Element =>
    list.length === 0 ? (
      <div className="viewer-empty">{t(emptyKey)}</div>
    ) : openCmd ? (
      <>
        <div className="claude-path">
          <button className="btn" onClick={() => setOpenCmd(null)}>
            ← {t('common.back')}
          </button>
          <span>{openCmd.path}</span>
        </div>
        <Code code={openCmd.content} language={openCmd.language || 'markdown'} />
      </>
    ) : (
      <div className="claude-commands">
        {list.map((c) => (
          <div key={c.path} className="claude-command" onClick={() => openCommand(c.path)}>
            <span className="claude-cmd-name">
              {prefix}
              {c.name}
            </span>
            <span className="claude-cmd-desc">{c.description}</span>
          </div>
        ))}
      </div>
    )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal claude-modal" onClick={(e) => e.stopPropagation()}>
        <div className="claude-modal-head">
          <h2>{t('app.globalClaude')}</h2>
          {cfg && <span className="claude-dir">{cfg.claudeDir}</span>}
          <button className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>

        {hooksInstalled !== null && (
          <div className="hooks-row">
            <span className={`dot ${hooksInstalled ? 'running' : 'finished'}`} />
            <span className="hooks-label">
              {t('gc.hooksRow')}: {hooksInstalled ? t('gc.hooksOn') : t('gc.hooksOff')}
            </span>
            <button className="btn xs" disabled={hooksBusy} onClick={toggleHooks}>
              {hooksBusy ? t('common.loading') : hooksInstalled ? t('common.disable') : t('common.enable')}
            </button>
          </div>
        )}

        {!cfg ? (
          <div className="viewer-empty">{t('common.loading')}</div>
        ) : !cfg.exists ? (
          <div className="deferred">{t('gc.notFound')}</div>
        ) : (
          <div className="claude-modal-body">
            <div className="claude-sections">
              {SECTIONS.map((s) => (
                <div
                  key={s.key}
                  className={`right-tab ${section === s.key ? 'active' : ''}`}
                  onClick={() => {
                    setOpenCmd(null)
                    setSection(s.key)
                  }}
                >
                  {s.label}
                  {s.key === 'hooks' && cfg.hooks.length > 0 && (
                    <span className="claude-count"> {cfg.hooks.length}</span>
                  )}
                  {s.key === 'mcp' && cfg.mcpServers.length > 0 && (
                    <span className="claude-count"> {cfg.mcpServers.length}</span>
                  )}
                  {s.key === 'skills' && cfg.skills.length > 0 && (
                    <span className="claude-count"> {cfg.skills.length}</span>
                  )}
                  {s.key === 'agents' && cfg.agents.length > 0 && (
                    <span className="claude-count"> {cfg.agents.length}</span>
                  )}
                  {s.key === 'commands' && cfg.commands.length > 0 && (
                    <span className="claude-count"> {cfg.commands.length}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="claude-section-body">
              {section === 'map' && (
                // Global Claude is the engine's GLOBAL config only — project overrides/deltas
                // live in the per-project context inspector, not here. So the map is global-only.
                <ClaudeContextGraph
                  projectId={null}
                  onOpenSection={(s) => setSection(s as Section)}
                />
              )}

              {section === 'settings' && (
                <>
                  <div className="claude-head">
                    <div className="git-section-label">settings.json</div>
                    <div className="viewer-toggle">
                      <button
                        className={`viewer-toggle-btn ${settingsView === 'form' ? 'active' : ''}`}
                        onClick={() => setSettingsView('form')}
                      >
                        {t('gc.form')}
                      </button>
                      <button
                        className={`viewer-toggle-btn ${settingsView === 'raw' ? 'active' : ''}`}
                        onClick={() => setSettingsView('raw')}
                      >
                        {t('gc.raw')}
                      </button>
                    </div>
                  </div>
                  <div className="claude-path">{cfg.settingsPath}</div>
                  {settingsView === 'form' ? (
                    <ClaudeSettingsForm
                      text={cfg.settingsText}
                      t={t}
                      onSave={(json) => window.cockpit.writeClaudeSettings(json).then((r) => {
                        if (r.ok) reloadCfg()
                        return r
                      })}
                    />
                  ) : cfg.settingsText ? (
                    <Code code={cfg.settingsText} language="json" />
                  ) : (
                    <div className="viewer-empty">{t('claudeForm.missing')}</div>
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
                <PermissionsEditor perms={cfg.permissions} onSaved={reloadCfg} />
              )}

              {section === 'hooks' &&
                (cfg.hooks.length === 0 ? (
                  <div className="viewer-empty">{t('gc.noHooks')}</div>
                ) : (
                  <div className="claude-hooks">
                    {cfg.hooks.map((h, i) => (
                      <div key={i} className="claude-hook">
                        <div className="claude-hook-head">
                          <span className="claude-event">{h.event}</span>
                          {h.matcher && <span className="claude-matcher">{h.matcher}</span>}
                        </div>
                        {hookDesc(h.event) && <div className="hook-desc">{hookDesc(h.event)}</div>}
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
                  <div className="viewer-empty">{t('gc.noMcp')}</div>
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

              {section === 'skills' && renderFiles(cfg.skills, 'gc.noSkills', '')}
              {section === 'agents' && renderFiles(cfg.agents, 'gc.noAgents', '')}
              {section === 'commands' && renderFiles(cfg.commands, 'gc.noCommands', '/')}

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
                          {t('gc.elements')}
                        </button>
                        <button
                          className={`viewer-toggle-btn ${mdView === 'text' ? 'active' : ''}`}
                          onClick={() => setMdView('text')}
                        >
                          {t('gc.text')}
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
                  <div className="viewer-empty">{t('gc.noClaudeMd')}</div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
