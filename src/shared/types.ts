// Shared domain types. Transport-agnostic on purpose: this file is the only
// vocabulary the renderer and the backend agree on. No Electron/Node types here.

/** Stable project identity. NEVER the path or display name — both change. */
export type ProjectId = string

/** Stable terminal identity within a project. */
export type TerminalId = string

export interface ProjectSettings {
  /** Absolute path to the project directory. */
  path: string
  /** Command to run the project (spawned into a fresh terminal tab). */
  runCommand: string
  /** Command to run tests. */
  testCommand: string
  /** Command to build. */
  buildCommand: string
  /** Relative path to docs, e.g. "docs/". */
  docsPath: string
  /** Path to the project's CLAUDE.md. */
  claudeMdPath: string
}

export interface Project {
  id: ProjectId
  name: string
  settings: ProjectSettings
}

export interface TerminalInfo {
  id: TerminalId
  projectId: ProjectId
  title: string
  /** Shell or command this terminal was started with. */
  command: string
  cwd: string
  /** Epoch ms. Pass-through value; backend stamps it. */
  startedAt: number
  /** false once the pty has exited. */
  alive: boolean
}

export interface SpawnTerminalRequest {
  projectId: ProjectId
  title?: string
  /** Command to run; defaults to the user's login shell when omitted. */
  command?: string
  /** Working dir; defaults to the project path. */
  cwd?: string
  cols: number
  rows: number
}

/** Coalesced terminal output — many pty chunks batched into one IPC message. */
export interface TerminalDataEvent {
  id: TerminalId
  data: string
}

export interface TerminalExitEvent {
  id: TerminalId
  exitCode: number
  signal?: number
}

export interface AppState {
  projects: Project[]
  activeProjectId: ProjectId | null
}

// --- M3: git summary ---

export type GitChangeKind = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'

export interface GitCommitSummary {
  hash: string
  message: string
  /** Relative age string, e.g. "2h ago" — computed pass-through. */
  date: string
}

export interface GitSummary {
  isRepo: boolean
  branch: string
  /** total changed (staged + unstaged + untracked) */
  changed: number
  staged: number
  unstaged: number
  recent: GitCommitSummary[]
  /** Map of repo-relative path -> change kind, for tree badges (from the same poll). */
  fileStatus: Record<string, GitChangeKind>
}

// --- M3: file tree + viewer ---

export interface DirEntry {
  name: string
  /** repo/project-relative path with forward slashes */
  path: string
  isDir: boolean
}

export interface FileContent {
  path: string
  content: string
  /** language id for highlight.js, '' if unknown */
  language: string
  /** true if the file exceeded the read cap and content is partial */
  truncated: boolean
  /** true if detected binary (content not returned) */
  binary: boolean
}

export interface DiffResult {
  path: string
  /** unified diff text, possibly truncated */
  text: string
  truncated: boolean
  binary: boolean
}

// --- M4: Claude-native config (read-only) ---

/** A configured MCP server, flattened across whatever file declared it. */
export interface ClaudeMcpServer {
  name: string
  /** "stdio" | "sse" | "http" | "" (inferred) */
  kind: string
  /** command (stdio) or url (sse/http) — the human-meaningful detail */
  detail: string
  /** which file declared it, e.g. "settings.json" or "~/.claude.json" */
  source: string
}

/** One hook binding: an event + its matcher + the commands it fires. */
export interface ClaudeHook {
  /** event name, e.g. "PreToolUse", "SessionStart", "Stop" */
  event: string
  /** matcher pattern, '' when the event takes none */
  matcher: string
  /** the shell commands run, in order */
  commands: string[]
}

/** A custom slash command discovered under ~/.claude/commands. */
export interface ClaudeCommand {
  /** invocation name, e.g. "all" for commands/all.md */
  name: string
  /** path relative to ~/.claude, forward slashes */
  path: string
  /** first sentence / frontmatter description, best-effort, '' if none */
  description: string
}

export interface ClaudePermissions {
  allow: string[]
  deny: string[]
  ask: string[]
}

/** Read-only snapshot of the global Claude install (~/.claude). */
export interface GlobalClaudeConfig {
  /** absolute ~/.claude path */
  claudeDir: string
  /** false if ~/.claude doesn't exist */
  exists: boolean
  /** pretty-printed settings.json, '' if absent */
  settingsText: string
  settingsPath: string
  /** pretty-printed settings.local.json, '' if absent */
  localSettingsText: string
  localSettingsPath: string
  /** global CLAUDE.md (capped), '' if absent */
  claudeMdText: string
  claudeMdPath: string
  permissions: ClaudePermissions
  hooks: ClaudeHook[]
  mcpServers: ClaudeMcpServer[]
  commands: ClaudeCommand[]
}
