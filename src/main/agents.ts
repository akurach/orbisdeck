// Claude Code sub-agents, read from the live session transcript — the structured,
// authoritative source (NOT TUI scraping). Claude appends each session to
// ~/.claude/projects/<cwd-encoded>/<session-id>.jsonl; Task/Agent tool_use entries
// are sub-agent spawns (subagent_type + description), and a later tool_result with
// the same id means it finished. We read the most-recently-active session.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentInfo } from '../shared/types'

const READ_CAP = 8 * 1024 * 1024

/** Claude encodes the project cwd into a dir name by replacing every
 *  non-alphanumeric character with '-' (so '/', '.', '_' all become '-'). */
function encodeProjectDir(projectPath: string): string {
  return projectPath.replace(/\/+$/, '').replace(/[^a-zA-Z0-9]/g, '-')
}

const MAX_SESSIONS = 3 // aggregate across the few most-recent sessions
const RECENT_MS = 2 * 60 * 60 * 1000 // only sessions/agents from the last 2h are "current"

/** The most-recently-modified top-level session .jsonl paths (ignores subagent
 *  subdirs). Several Claude sessions in one project write concurrently, so the
 *  single newest file flickers — reading the top few smooths that out. */
function recentTranscripts(projectPath: string): string[] {
  const dir = join(homedir(), '.claude', 'projects', encodeProjectDir(projectPath))
  let files: string[]
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
  } catch {
    return []
  }
  const cutoff = Date.now() - RECENT_MS
  const withMtime: { path: string; mtime: number }[] = []
  for (const f of files) {
    const p = join(dir, f)
    try {
      const mtime = statSync(p).mtimeMs
      if (mtime >= cutoff) withMtime.push({ path: p, mtime }) // ignore stale sessions
    } catch {
      /* skip */
    }
  }
  return withMtime
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, MAX_SESSIONS)
    .map((x) => x.path)
}

function tailRead(path: string): string {
  const size = statSync(path).size
  const buf = readFileSync(path)
  return size > READ_CAP ? buf.subarray(size - READ_CAP).toString('utf8') : buf.toString('utf8')
}

export class AgentsService {
  /** Sub-agents across the project's most-recently-active Claude sessions. */
  list(projectPath: string): AgentInfo[] {
    if (!projectPath) return []
    const transcripts = recentTranscripts(projectPath)
    if (transcripts.length === 0) return []

    const agents = new Map<string, AgentInfo>()
    const finished = new Set<string>()

    for (const transcript of transcripts) {
      let text: string
      try {
        text = tailRead(transcript)
      } catch {
        continue
      }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue
        let row: Record<string, unknown>
        try {
          row = JSON.parse(line)
        } catch {
          continue // a truncated leading line from the tail cap
        }
        const ts = typeof row.timestamp === 'string' ? Date.parse(row.timestamp) : 0
        const msg = row.message as { content?: unknown } | undefined
        const content = Array.isArray(msg?.content)
          ? (msg!.content as Record<string, unknown>[])
          : []
        for (const block of content) {
          if (block.type === 'tool_use' && (block.name === 'Task' || block.name === 'Agent')) {
            const input = (block.input as Record<string, unknown>) ?? {}
            const id = String(block.id ?? '')
            if (!id) continue
            agents.set(id, {
              id,
              type: String(input.subagent_type ?? 'agent'),
              description: String(input.description ?? ''),
              status: 'running',
              startedAt: Number.isFinite(ts) ? ts : 0,
              endedAt: 0
            })
          } else if (block.type === 'tool_result') {
            const refId = String(block.tool_use_id ?? '')
            if (refId) finished.add(refId)
          }
        }
      }
    }

    const recentCutoff = Date.now() - RECENT_MS
    const out = [...agents.values()]
      .map((a) => ({
        ...a,
        status: finished.has(a.id) ? ('done' as const) : ('running' as const)
      }))
      // Keep running agents; drop long-finished ones so the panel reflects now.
      .filter((a) => a.status === 'running' || a.startedAt === 0 || a.startedAt >= recentCutoff)
    out.sort((x, y) => {
      if (x.status !== y.status) return x.status === 'running' ? -1 : 1
      return y.startedAt - x.startedAt
    })
    return out
  }
}
