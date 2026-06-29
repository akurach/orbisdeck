import { useEffect, useState } from 'react'
import type { ClaudeChainFile, GlobalClaudeConfig, ProjectId } from '../../shared/types'
import { ClaudeElements } from './ClaudeElements'
import { ClaudeContextGraph } from './ClaudeContextGraph'
import { useT } from '../i18n'

interface Props {
  projectId: ProjectId
  /** Deep-link to the Global Claude editors (settings form + permissions). */
  onOpenGlobal: () => void
}

// Read-only "context inspector": shows the whole chain that assembles Claude's context for the
// project — global CLAUDE.md → project CLAUDE.md → @import tree → settings/permissions/hooks/MCP
// summary. Editable layers deep-link to the existing editors; everything else is shown as text.
export function ClaudeContext({ projectId, onOpenGlobal }: Props): JSX.Element {
  const t = useT()
  const [global, setGlobal] = useState<GlobalClaudeConfig | null>(null)
  const [chain, setChain] = useState<ClaudeChainFile[] | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([window.cockpit.getGlobalClaude(), window.cockpit.getClaudeChain(projectId)]).then(
      ([g, c]) => {
        if (!alive) return
        setGlobal(g)
        setChain(c)
      }
    )
    return () => {
      alive = false
    }
  }, [projectId])

  if (!global || !chain) {
    return <div className="viewer-empty">{t('common.loading')}</div>
  }

  const p = global.permissions

  return (
    <div className="claude-context">
      <p className="cctx-intro">{t('cctx.intro')}</p>

      {/* The assembly map for THIS project: global vs project, with what the project adds (+)
          or overrides (Δ). This is where the override/delta view belongs (Global Claude is
          global-only). Clicking a node opens the Global Claude editors. */}
      <section className="cctx-layer">
        <div className="cctx-layer-head">
          <span className="cctx-scope">{t('cctx.scopeMap')}</span>
        </div>
        <ClaudeContextGraph projectId={projectId} onOpenSection={() => onOpenGlobal()} />
      </section>

      <section className="cctx-layer">
        <div className="cctx-layer-head">
          <span className="cctx-scope">{t('cctx.scopeGlobal')}</span>
          <span className="cctx-path">{global.claudeMdPath || '~/.claude/CLAUDE.md'}</span>
        </div>
        {global.claudeMdText ? (
          <ClaudeElements text={global.claudeMdText} />
        ) : (
          <div className="cctx-empty">{t('cctx.none')}</div>
        )}
      </section>

      <section className="cctx-layer">
        <div className="cctx-layer-head">
          <span className="cctx-scope">{t('cctx.scopeProject')}</span>
        </div>
        {chain.length === 0 ? (
          <div className="cctx-empty">{t('claude.notFound')}</div>
        ) : (
          chain.map((f, i) => (
            <div key={i} className="cctx-file" style={{ marginLeft: f.depth * 12 }}>
              <div className="cctx-file-head">
                {f.depth > 0 && <span className="cctx-import">@</span>}
                <span className="cctx-path">{f.path}</span>
                {f.missing && <span className="cctx-badge warn">{t('cctx.missing')}</span>}
                {f.truncated && <span className="cctx-badge">{t('cctx.truncated')}</span>}
              </div>
              {!f.missing && f.content && <ClaudeElements text={f.content} />}
            </div>
          ))
        )}
      </section>

      <section className="cctx-layer">
        <div className="cctx-layer-head">
          <span className="cctx-scope">{t('cctx.scopeSettings')}</span>
          <button className="btn xs" onClick={onOpenGlobal}>
            {t('cctx.edit')}
          </button>
        </div>
        <div className="cctx-summary">
          <div className="cctx-summary-row">
            <span>{t('cctx.permissions')}</span>
            <span className="cctx-counts">
              {p.allow.length} allow · {p.ask.length} ask · {p.deny.length} deny
            </span>
          </div>
          <div className="cctx-summary-row">
            <span>{t('cctx.hooks')}</span>
            <span className="cctx-counts">{global.hooks.length}</span>
          </div>
          <div className="cctx-summary-row">
            <span>{t('cctx.mcp')}</span>
            <span className="cctx-counts">{global.mcpServers.length}</span>
          </div>
          <div className="cctx-summary-row">
            <span>{t('cctx.commands')}</span>
            <span className="cctx-counts">{global.commands.length}</span>
          </div>
        </div>
      </section>
    </div>
  )
}
