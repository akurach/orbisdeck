// Live Claude sub-agent tracking via Claude Code hooks (opt-in).
//
// We install two hooks into ~/.claude/settings.json:
//   PreToolUse(Task|Agent) -> writes a 'start' event (carries subagent_type + description)
//   SubagentStop           -> writes a 'stop' event
// Both append to ~/.claude/orbisdeck/agents.jsonl, which we tail to show live agents.
// The hook command is `node $HOME/.claude/orbisdeck/hook.mjs start|stop`.
//
// Everything here is defensive and idempotent: install merges (never clobbers the
// user's existing hooks), uninstall removes ONLY our entries, and writes are atomic
// with a one-shot backup of settings.json.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentInfo } from '../shared/types'

// Cache of live `claude` process working dirs (cwds), refreshed at most every 3s.
let liveCache: { ts: number; cwds: string[] } = { ts: 0, cwds: [] }

function liveClaudeCwds(): string[] {
  const now = Date.now()
  if (now - liveCache.ts < 3000) return liveCache.cwds
  const cwds: string[] = []
  try {
    const pids = execFileSync('pgrep', ['-x', 'claude'], { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const pid of pids) {
      try {
        const out = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], {
          encoding: 'utf8'
        })
        const line = out.split('\n').find((l) => l.startsWith('n'))
        if (line) cwds.push(line.slice(1))
      } catch {
        /* pid gone */
      }
    }
  } catch {
    /* pgrep: no matches → no live claude */
  }
  liveCache = { ts: now, cwds }
  return cwds
}

function projectHasLiveClaude(projectPath: string): boolean {
  return liveClaudeCwds().some((c) => c === projectPath || c.startsWith(projectPath + '/'))
}

const CLAUDE_DIR = join(homedir(), '.claude')
const OD_DIR = join(CLAUDE_DIR, 'orbisdeck')
const SETTINGS = join(CLAUDE_DIR, 'settings.json')
const HOOK_PATH = join(OD_DIR, 'hook.mjs')
const EVENTS = join(OD_DIR, 'agents.jsonl')
const NOTIFY = join(OD_DIR, 'notify.jsonl')
const HOOK_MARKER = 'orbisdeck/hook.mjs'
const HOOK_CMD = (mode: string): string => `node "$HOME/.claude/orbisdeck/hook.mjs" ${mode}`

const HOOK_SCRIPT = `import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const mode = process.argv[2] // 'start' | 'stop' | 'notify'
let raw = ''
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  let p = {}
  try { p = JSON.parse(raw) } catch {}
  const dir = join(homedir(), '.claude', 'orbisdeck')
  try { mkdirSync(dir, { recursive: true }) } catch {}
  if (mode === 'notify') {
    // Notification hook: Claude needs the user (waiting for input / permission).
    const line = JSON.stringify({
      ts: Date.now(),
      cwd: p.cwd || '',
      session: p.session_id || '',
      message: p.message || 'Claude ждёт ответа'
    }) + '\\n'
    try { appendFileSync(join(dir, 'notify.jsonl'), line) } catch {}
  } else {
    const ti = p.tool_input || {}
    const line = JSON.stringify({
      event: mode,
      ts: Date.now(),
      cwd: p.cwd || '',
      session: p.session_id || '',
      type: ti.subagent_type || '',
      description: ti.description || ''
    }) + '\\n'
    try { appendFileSync(join(dir, 'agents.jsonl'), line) } catch {}
  }
  process.stdout.write('{}') // empty = allow; never blocks the tool
})
`

type HookEntry = { matcher?: string; hooks?: { type: string; command: string }[] }
type Settings = { hooks?: Record<string, HookEntry[]> } & Record<string, unknown>

function readSettings(): Settings {
  try {
    return JSON.parse(readFileSync(SETTINGS, 'utf8')) as Settings
  } catch {
    return {}
  }
}

function writeSettingsAtomic(s: Settings): void {
  mkdirSync(CLAUDE_DIR, { recursive: true })
  if (existsSync(SETTINGS)) {
    try {
      writeFileSync(SETTINGS + '.orbisdeck.bak', readFileSync(SETTINGS))
    } catch {
      /* backup best-effort */
    }
  }
  const tmp = SETTINGS + '.tmp'
  writeFileSync(tmp, JSON.stringify(s, null, 2))
  renameSync(tmp, SETTINGS)
}

function entryIsOurs(e: HookEntry): boolean {
  return !!e.hooks?.some((h) => h.command?.includes(HOOK_MARKER))
}

export interface AgentHooksStatus {
  installed: boolean
}

export class AgentHooksService {
  status(): AgentHooksStatus {
    if (!existsSync(HOOK_PATH)) return { installed: false }
    const s = readSettings()
    const pre = s.hooks?.PreToolUse?.some(entryIsOurs) ?? false
    const stop = s.hooks?.SubagentStop?.some(entryIsOurs) ?? false
    return { installed: pre && stop }
  }

  install(): AgentHooksStatus {
    mkdirSync(OD_DIR, { recursive: true })
    writeFileSync(HOOK_PATH, HOOK_SCRIPT)

    const s = readSettings()
    s.hooks = s.hooks ?? {}
    s.hooks.PreToolUse = s.hooks.PreToolUse ?? []
    s.hooks.SubagentStop = s.hooks.SubagentStop ?? []
    s.hooks.Notification = s.hooks.Notification ?? []

    if (!s.hooks.PreToolUse.some(entryIsOurs)) {
      s.hooks.PreToolUse.push({
        matcher: 'Task|Agent',
        hooks: [{ type: 'command', command: HOOK_CMD('start') }]
      })
    }
    if (!s.hooks.SubagentStop.some(entryIsOurs)) {
      s.hooks.SubagentStop.push({
        hooks: [{ type: 'command', command: HOOK_CMD('stop') }]
      })
    }
    // Notification hook → desktop alert + tab badge when a terminal awaits input.
    if (!s.hooks.Notification.some(entryIsOurs)) {
      s.hooks.Notification.push({
        hooks: [{ type: 'command', command: HOOK_CMD('notify') }]
      })
    }
    writeSettingsAtomic(s)
    return { installed: true }
  }

  uninstall(): AgentHooksStatus {
    const s = readSettings()
    if (s.hooks) {
      for (const key of ['PreToolUse', 'SubagentStop', 'Notification'] as const) {
        const arr = s.hooks[key]
        if (Array.isArray(arr)) {
          s.hooks[key] = arr.filter((e) => !entryIsOurs(e))
          if (s.hooks[key].length === 0) delete s.hooks[key]
        }
      }
      if (Object.keys(s.hooks).length === 0) delete s.hooks
      writeSettingsAtomic(s)
    }
    try {
      unlinkSync(HOOK_PATH)
    } catch {
      /* already gone */
    }
    return { installed: false }
  }

  /** Notification events (Claude awaiting input) newer than `since` (epoch ms). */
  readNotificationsSince(since: number): { ts: number; cwd: string; message: string }[] {
    if (!existsSync(NOTIFY)) return []
    let text: string
    try {
      text = readFileSync(NOTIFY, 'utf8')
    } catch {
      return []
    }
    const out: { ts: number; cwd: string; message: string }[] = []
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try {
        const e = JSON.parse(line)
        const ts = Number(e.ts) || 0
        if (ts > since) out.push({ ts, cwd: String(e.cwd ?? ''), message: String(e.message ?? '') })
      } catch {
        /* skip */
      }
    }
    return out
  }

  /** Live agents for a project, paired from the hook event log (FIFO per cwd). */
  readEvents(projectPath: string): AgentInfo[] {
    if (!projectPath || !existsSync(EVENTS)) return []
    let text: string
    try {
      text = readFileSync(EVENTS, 'utf8')
    } catch {
      return []
    }
    const cutoff = Date.now() - 6 * 60 * 60 * 1000 // ignore events older than 6h
    const open: AgentInfo[] = []
    const done: AgentInfo[] = []
    let seq = 0
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      let e: Record<string, unknown>
      try {
        e = JSON.parse(line)
      } catch {
        continue
      }
      // Match the project and anything under it (agents often run in a subdir).
      const cwd = String(e.cwd ?? '')
      if (cwd !== projectPath && !cwd.startsWith(projectPath + '/')) continue
      const ts = Number(e.ts) || 0
      if (ts && ts < cutoff) continue
      if (e.event === 'start') {
        open.push({
          id: `ev-${ts}-${seq++}`,
          type: String(e.type || 'agent'),
          description: String(e.description || ''),
          status: 'running',
          startedAt: ts,
          endedAt: 0
        })
      } else if (e.event === 'stop') {
        const a = open.shift() // close the oldest open agent for this project
        if (a) done.push({ ...a, status: 'done', endedAt: ts }) // freeze finish time
      }
    }
    // If no Claude is alive under this project, anything still "open" was interrupted
    // (its session died before SubagentStop fired) — don't show it as Running forever.
    const alive = projectHasLiveClaude(projectPath)
    const running = alive ? open : open.map((a) => ({ ...a, status: 'interrupted' as const }))
    return [...running, ...done.reverse()]
  }
}
