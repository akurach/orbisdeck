// Window onto the global Claude install (~/.claude). This is what makes the cockpit
// Claude-native rather than a generic terminal multiplexer (roadmap M4/M6): it surfaces
// settings, permissions, hooks, MCP servers and custom commands the user already has.
// Reads are best-effort (a missing/malformed file degrades to an empty section, never
// throws across the seam). Writes (settings.json / permissions, M6) are guarded: JSON is
// validated first, then written atomically with a one-shot backup.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import type {
  ClaudeCommand,
  ClaudeHook,
  ClaudeMcpServer,
  ClaudePermissions,
  FileContent,
  GlobalClaudeConfig
} from '../shared/types'

const READ_CAP = 512 * 1024
// ~/.claude.json carries the whole project history; only parse it for mcpServers
// if it's not absurdly large, so we never block the main process on a huge file.
const BIG_JSON_CAP = 16 * 1024 * 1024

const LANG_BY_EXT: Record<string, string> = {
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  zsh: 'bash',
  js: 'javascript',
  ts: 'typescript'
}

function readTextCapped(path: string): { text: string; truncated: boolean } {
  try {
    const buf = readFileSync(path)
    if (buf.length > READ_CAP) {
      return { text: buf.subarray(0, READ_CAP).toString('utf8'), truncated: true }
    }
    return { text: buf.toString('utf8'), truncated: false }
  } catch {
    return { text: '', truncated: false }
  }
}

function readJson(path: string, maxBytes = BIG_JSON_CAP): any | null {
  try {
    if (statSync(path).size > maxBytes) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function prettyJson(path: string): string {
  const obj = readJson(path, READ_CAP)
  if (obj == null) {
    // fall back to raw (still capped) so the user sees *something*
    return readTextCapped(path).text
  }
  return JSON.stringify(obj, null, 2)
}

/** Claude settings.json `permissions` block, defensively normalized. */
function parsePermissions(...settings: any[]): ClaudePermissions {
  const out: ClaudePermissions = { allow: [], deny: [], ask: [] }
  for (const s of settings) {
    const p = s?.permissions
    if (!p) continue
    for (const k of ['allow', 'deny', 'ask'] as const) {
      if (Array.isArray(p[k])) out[k].push(...p[k].filter((x: unknown) => typeof x === 'string'))
    }
  }
  return out
}

/** Flatten the settings `hooks` map into a flat, displayable list. */
function parseHooks(settings: any): ClaudeHook[] {
  const hooks = settings?.hooks
  if (!hooks || typeof hooks !== 'object') return []
  const out: ClaudeHook[] = []
  for (const [event, bindings] of Object.entries<any>(hooks)) {
    if (!Array.isArray(bindings)) continue
    for (const b of bindings) {
      const commands: string[] = []
      for (const h of b?.hooks ?? []) {
        if (typeof h?.command === 'string') commands.push(h.command)
      }
      if (commands.length === 0) continue
      out.push({ event, matcher: typeof b?.matcher === 'string' ? b.matcher : '', commands })
    }
  }
  return out
}

/** Pull MCP servers from any object that has an `mcpServers` map. */
function parseMcp(obj: any, source: string): ClaudeMcpServer[] {
  const servers = obj?.mcpServers
  if (!servers || typeof servers !== 'object') return []
  const out: ClaudeMcpServer[] = []
  for (const [name, cfg] of Object.entries<any>(servers)) {
    let kind = typeof cfg?.type === 'string' ? cfg.type : ''
    let detail = ''
    if (cfg?.command) {
      kind = kind || 'stdio'
      detail = [cfg.command, ...(Array.isArray(cfg.args) ? cfg.args : [])].join(' ')
    } else if (cfg?.url) {
      kind = kind || 'http'
      detail = cfg.url
    }
    out.push({ name, kind, detail, source })
  }
  return out
}

/** Walk ~/.claude/commands recursively for *.md slash commands. */
function listCommands(commandsDir: string, claudeDir: string): ClaudeCommand[] {
  const out: ClaudeCommand[] = []
  const walk = (dir: string): void => {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      return
    }
    for (const name of names) {
      const abs = join(dir, name)
      let isDir = false
      try {
        isDir = statSync(abs).isDirectory()
      } catch {
        continue
      }
      if (isDir) {
        walk(abs)
      } else if (name.endsWith('.md')) {
        const rel = relative(claudeDir, abs).split(sep).join('/')
        // command name is the path under commands/ without the .md extension
        const cmd = relative(commandsDir, abs).split(sep).join('/').replace(/\.md$/, '')
        out.push({ name: cmd, path: rel, description: describeCommand(abs) })
      }
    }
  }
  walk(commandsDir)
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

/** Best-effort one-liner: frontmatter `description:`, else first prose line. */
function describeCommand(path: string): string {
  const { text } = readTextCapped(path)
  if (!text) return ''
  const fm = /^---\n([\s\S]*?)\n---/.exec(text)
  if (fm) {
    const m = /^description:\s*(.+)$/m.exec(fm[1])
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('---') || t.startsWith('#')) continue
    return t.slice(0, 200)
  }
  return ''
}

export class ClaudeService {
  private readonly claudeDir = join(homedir(), '.claude')

  global(): GlobalClaudeConfig {
    const dir = this.claudeDir
    const exists = existsSync(dir)

    const settingsPath = join(dir, 'settings.json')
    const localSettingsPath = join(dir, 'settings.local.json')
    const claudeMdPath = join(dir, 'CLAUDE.md')

    const settings = readJson(settingsPath, READ_CAP)
    const localSettings = readJson(localSettingsPath, READ_CAP)
    const homeJson = readJson(join(homedir(), '.claude.json'))

    const mcpServers = [
      ...parseMcp(settings, 'settings.json'),
      ...parseMcp(localSettings, 'settings.local.json'),
      ...parseMcp(homeJson, '~/.claude.json')
    ]

    return {
      claudeDir: dir,
      exists,
      settingsPath,
      settingsText: existsSync(settingsPath) ? prettyJson(settingsPath) : '',
      localSettingsPath,
      localSettingsText: existsSync(localSettingsPath) ? prettyJson(localSettingsPath) : '',
      claudeMdPath,
      claudeMdText: readTextCapped(claudeMdPath).text,
      permissions: parsePermissions(settings, localSettings),
      hooks: [...parseHooks(settings), ...parseHooks(localSettings)],
      mcpServers,
      commands: listCommands(join(dir, 'commands'), dir)
    }
  }

  /** Read a single file under ~/.claude. Refuses any path escaping the dir. */
  readFile(relPath: string): FileContent {
    const abs = resolve(this.claudeDir, relPath)
    const result: FileContent = {
      path: relPath,
      content: '',
      language: '',
      truncated: false,
      binary: false
    }
    if (abs !== this.claudeDir && !abs.startsWith(this.claudeDir + sep)) {
      return result // escapes ~/.claude — refuse silently
    }
    const ext = relPath.includes('.') ? relPath.split('.').pop()!.toLowerCase() : ''
    result.language = LANG_BY_EXT[ext] ?? ''
    let buf: Buffer
    try {
      buf = readFileSync(abs)
    } catch {
      return result
    }
    if (buf.subarray(0, 8192).includes(0)) {
      result.binary = true
      return result
    }
    if (buf.length > READ_CAP) {
      result.content = buf.subarray(0, READ_CAP).toString('utf8')
      result.truncated = true
    } else {
      result.content = buf.toString('utf8')
    }
    return result
  }

  private settingsFile(): string {
    return join(this.claudeDir, 'settings.json')
  }

  private writeJsonAtomic(file: string, value: unknown): void {
    mkdirSync(this.claudeDir, { recursive: true })
    if (existsSync(file)) {
      try {
        writeFileSync(file + '.orbisdeck.bak', readFileSync(file))
      } catch {
        /* backup best-effort */
      }
    }
    const tmp = file + '.tmp'
    writeFileSync(tmp, JSON.stringify(value, null, 2))
    renameSync(tmp, file)
  }

  /** Overwrite ~/.claude/settings.json from edited text. Validates JSON first. */
  writeSettings(text: string): { ok: boolean; error: string } {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      return { ok: false, error: 'Невалидный JSON: ' + (e as Error).message }
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Ожидался объект настроек' }
    }
    try {
      this.writeJsonAtomic(this.settingsFile(), parsed)
      return { ok: true, error: '' }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }

  /** Replace the `permissions` block in settings.json, preserving everything else. */
  setPermissions(perms: ClaudePermissions): { ok: boolean; error: string } {
    const file = this.settingsFile()
    let settings: Record<string, unknown> = {}
    try {
      if (existsSync(file)) settings = JSON.parse(readFileSync(file, 'utf8'))
    } catch (e) {
      return { ok: false, error: 'settings.json не парсится: ' + (e as Error).message }
    }
    settings.permissions = {
      allow: perms.allow,
      ask: perms.ask,
      deny: perms.deny
    }
    try {
      this.writeJsonAtomic(file, settings)
      return { ok: true, error: '' }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }
}
