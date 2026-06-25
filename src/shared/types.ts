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
  /** Command auto-run in the first terminal when the project opens with no live
   *  terminals (e.g. "claude"). Empty string = open a plain shell instead. */
  autoLaunchCommand: string
  /** Extra environment for every terminal in this project, as KEY=VALUE lines. */
  env?: string
  /** Working subdirectory (relative to path) terminals start in. Empty = project root. */
  cwdSubdir?: string
}

export interface Project {
  id: ProjectId
  name: string
  settings: ProjectSettings
}

/** Best-effort settings inferred from an existing project's structure. Only keys we
 *  could infer are present; the UI offers them as editable defaults, never forced. */
export interface DetectedSettings {
  runCommand?: string
  testCommand?: string
  buildCommand?: string
  docsPath?: string
  claudeMdPath?: string
  /** raw contents of the project's .env, surfaced so the user can see/edit it */
  env?: string
  /** human-readable detections, e.g. ["package.json (pnpm)", "CLAUDE.md", "docs/"] */
  sources: string[]
}

/** A Claude Code sub-agent (Task/Agent tool) read from the live session transcript
 *  (~/.claude/projects/<cwd>/<session>.jsonl) — structured facts, not TUI scraping. */
export interface AgentInfo {
  /** the tool_use id (toolu_…) */
  id: string
  /** subagent_type, e.g. "ecc:architect" or "general-purpose" */
  type: string
  /** the task description */
  description: string
  /** 'running' = in flight; 'done' = finished; 'interrupted' = was running but its
   *  Claude session is no longer alive (stop event never arrived) */
  status: 'running' | 'done' | 'interrupted'
  /** epoch ms from the transcript line timestamp, 0 if unknown */
  startedAt: number
  /** epoch ms when the agent finished, 0 if still running / unknown. Frozen so the
   *  UI shows a fixed duration for done agents instead of a ticking clock. */
  endedAt: number
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
  /** OS process id of the pty (fact, from node-pty). 0 if unavailable. */
  pid: number
}

export interface SpawnTerminalRequest {
  projectId: ProjectId
  title?: string
  /** Command to run; defaults to the user's login shell when omitted. */
  command?: string
  /** Working dir; defaults to the project path. */
  cwd?: string
  /** Extra environment merged over the inherited process env. */
  env?: Record<string, string>
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
  /** true once the user has been offered the live-agents (hooks) setup, so we don't re-ask */
  agentHooksPrompted?: boolean
  /** per-project free-text notes (bottom panel) */
  notes?: Record<ProjectId, string>
}

/** Whether the live-agents Claude hooks are installed in ~/.claude/settings.json. */
export interface AgentHooksStatus {
  installed: boolean
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

export interface ImagePreview {
  /** data: URL for inline <img>; '' when the image exceeded the image cap */
  dataUrl: string
  /** e.g. "image/png", "image/svg+xml" */
  mime: string
  /** file size in bytes */
  bytes: number
  /** true if the image exceeded the image read cap and was not loaded */
  tooLarge: boolean
}

export interface FileContent {
  path: string
  content: string
  /** language id for highlight.js, '' if unknown */
  language: string
  /** true if the file exceeded the read cap and content is partial */
  truncated: boolean
  /** true if detected binary (content not returned). Images are NOT flagged binary. */
  binary: boolean
  /** present only for image files — inline preview payload, no editing */
  image?: ImagePreview
}

export interface DiffResult {
  path: string
  /** unified diff text, possibly truncated */
  text: string
  truncated: boolean
  binary: boolean
}

// --- M5: Docker (compose-scoped, via the docker CLI) ---

export interface DockerContainer {
  id: string
  name: string
  service: string
  /** running | exited | paused | restarting | created | … (from `docker compose ps`) */
  state: string
  /** human status, e.g. "Up 3 minutes" */
  status: string
  /** published ports, best-effort */
  ports: string
}

export interface DockerStatus {
  /** docker CLI present & responsive */
  available: boolean
  /** a compose file exists in the project root */
  hasCompose: boolean
  containers: DockerContainer[]
  /** non-empty when something went wrong (CLI missing, compose error) */
  error: string
}

export type DockerAction = 'up' | 'down' | 'restart' | 'start' | 'stop'

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
