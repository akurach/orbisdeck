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
