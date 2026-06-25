// Claude Code sub-agents, read from the live session transcript — the structured,
// authoritative source (NOT TUI scraping). Claude Code appends each session to
// ~/.claude/projects/<cwd-encoded>/<session-id>.jsonl; Task/Agent tool_use entries
// are sub-agent spawns, and a later tool_result with the same id means it finished.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentInfo } from '../shared/types'

const READ_CAP = 8 * 1024 * 1024 // tail cap for big transcripts

/** Claude encodes the project cwd into a dir name by replacing every
 *  non-alphanumeric character with '-' (so '/', '.', '_' all become '-'). */
function encodeProjectDir(projectPath: string): string {
  return projectPath.replace(/[^a-zA-Z0-9]/g, '-')
}

function newestTranscript(projectPath: string): string | null {
  const dir = join(homedir(), '.claude', 'projects', encodeProjectDir(projectPath))
  let files: string[]
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
  } catch {
    return null
  }
  let best: { path: string; mtime: number } | null = null
  for (const f of files) {
    const p = join(dir, f)
    try {
      const m = statSync(p).mtimeMs
      if (!best || m > best.mtime) best = { path: p, mtime: m }
    } catch {
      /* skip */
    }
  }
  return best?.path ?? null
}

function tailRead(path: string): string {
  const size = statSync(path).size
  const buf = readFileSync(path)
  return size > READ_CAP ? buf.subarray(size - READ_CAP).toString('utf8') : buf.toString('utf8')
}

export class AgentsService {
  /** Sub-agents of the project's most-recently-active Claude session. */
  list(projectPath: string): AgentInfo[] {
    if (!projectPath) return []
    const transcript = newestTranscript(projectPath)
    if (!transcript) return []

    let text: string
    try {
      text = tailRead(transcript)
    } catch {
      return []
    }

    const agents = new Map<string, AgentInfo>()
    const finished = new Set<string>()

    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      let row: Record<string, unknown>
      try {
        row = JSON.parse(line)
      } catch {
        continue // a truncated leading line from the tail cap, etc.
      }
      const ts = typeof row.timestamp === 'string' ? Date.parse(row.timestamp) : 0
      const msg = row.message as { content?: unknown } | undefined
      const content = Array.isArray(msg?.content) ? (msg!.content as Record<string, unknown>[]) : []
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
            startedAt: Number.isFinite(ts) ? ts : 0
          })
        } else if (block.type === 'tool_result') {
          const refId = String(block.tool_use_id ?? '')
          if (refId) finished.add(refId)
        }
      }
    }

    const out: AgentInfo[] = []
    for (const a of agents.values()) {
      out.push({ ...a, status: finished.has(a.id) ? 'done' : 'running' })
    }
    // Running first, then most-recently-started.
    out.sort((x, y) => {
      if (x.status !== y.status) return x.status === 'running' ? -1 : 1
      return y.startedAt - x.startedAt
    })
    return out
  }
}
