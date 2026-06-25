// THE seam. One interface describing every operation the renderer can ask of the
// backend, plus the event shapes flowing back. The renderer programs ONLY against
// `CockpitApi`. The Electron main process is one implementation; a future Tauri
// backend would be another behind the same contract.
//
// node-pty / fs / simple-git / electron live behind this. They never cross it.

import type {
  AgentHooksStatus,
  AgentInfo,
  AppState,
  DetectedSettings,
  DiffResult,
  DirEntry,
  DockerAction,
  DockerStatus,
  FileContent,
  GitSummary,
  GlobalClaudeConfig,
  Project,
  ProjectId,
  ProjectSettings,
  SpawnTerminalRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalId,
  TerminalInfo
} from './types'

/** Request/response surface. All async, all serializable. */
export interface CockpitApi {
  // --- dialogs ---
  /** Open a native folder picker. Returns the chosen absolute path, or null if cancelled. */
  pickDirectory(): Promise<string | null>

  /** Infer run/test/build (+ docs/CLAUDE.md) from an existing project folder's structure. */
  detectProjectSettings(path: string): Promise<DetectedSettings>

  // --- projects ---
  getState(): Promise<AppState>
  addProject(input: { name: string; settings: ProjectSettings }): Promise<Project>
  updateProject(id: ProjectId, patch: Partial<Pick<Project, 'name'>> & { settings?: Partial<ProjectSettings> }): Promise<Project>
  removeProject(id: ProjectId): Promise<void>
  setActiveProject(id: ProjectId | null): Promise<void>
  /** Persist a new project tab order (array of project ids). */
  reorderProjects(ids: ProjectId[]): Promise<void>

  // --- terminals ---
  listTerminals(projectId: ProjectId): Promise<TerminalInfo[]>
  spawnTerminal(req: SpawnTerminalRequest): Promise<TerminalInfo>
  writeTerminal(id: TerminalId, data: string): Promise<void>
  resizeTerminal(id: TerminalId, cols: number, rows: number): Promise<void>
  killTerminal(id: TerminalId): Promise<void>
  /** Replay buffered scrollback for a terminal (e.g. on tab activation). */
  getTerminalBuffer(id: TerminalId): Promise<string>

  // --- git (M3) ---
  getGitSummary(projectId: ProjectId): Promise<GitSummary>
  getDiff(projectId: ProjectId, relPath?: string): Promise<DiffResult>

  // --- files (M3) ---
  listDir(projectId: ProjectId, relPath: string): Promise<DirEntry[]>
  readFile(projectId: ProjectId, relPath: string): Promise<FileContent>
  /** Start watching a project's tree; debounced change events arrive via onFilesChanged. */
  watchProject(projectId: ProjectId): Promise<void>
  unwatchProject(projectId: ProjectId): Promise<void>

  // --- agents (M5): Claude sub-agents (hook events when installed, else transcript) ---
  getAgents(projectId: ProjectId): Promise<AgentInfo[]>
  /** Are the live-agents hooks installed in ~/.claude/settings.json? */
  getAgentHooksStatus(): Promise<AgentHooksStatus>
  /** Install the hooks + hook script (opt-in; merges, never clobbers). */
  installAgentHooks(): Promise<AgentHooksStatus>
  /** Remove only our hooks + script. */
  uninstallAgentHooks(): Promise<AgentHooksStatus>
  /** Remember that the one-time live-agents offer was shown. */
  markAgentHooksPrompted(): Promise<void>

  // --- docker (M5), compose-scoped via the docker CLI ---
  getDockerStatus(projectId: ProjectId): Promise<DockerStatus>
  dockerAction(
    projectId: ProjectId,
    action: DockerAction,
    service?: string
  ): Promise<{ ok: boolean; error: string }>
  getDockerLogs(projectId: ProjectId, service?: string): Promise<string>

  // --- global Claude config (M4), all read-only ---
  /** Snapshot of ~/.claude: settings, permissions, hooks, MCP servers, commands, CLAUDE.md. */
  getGlobalClaude(): Promise<GlobalClaudeConfig>
  /** Read one file under ~/.claude (sandboxed), e.g. a command's markdown. */
  readClaudeFile(relPath: string): Promise<FileContent>

  // --- event subscriptions: return an unsubscribe fn ---
  onTerminalData(handler: (e: TerminalDataEvent) => void): () => void
  onTerminalExit(handler: (e: TerminalExitEvent) => void): () => void
  /** Fires (debounced) when a watched project's files change. */
  onFilesChanged(handler: (e: { projectId: ProjectId }) => void): () => void
}

/** IPC channel names — invoke (req/resp). Kept here so main + preload share one source. */
export const IpcChannels = {
  pickDirectory: 'cockpit:pickDirectory',
  detectProjectSettings: 'cockpit:detectProjectSettings',
  getState: 'cockpit:getState',
  addProject: 'cockpit:addProject',
  updateProject: 'cockpit:updateProject',
  removeProject: 'cockpit:removeProject',
  setActiveProject: 'cockpit:setActiveProject',
  reorderProjects: 'cockpit:reorderProjects',
  listTerminals: 'cockpit:listTerminals',
  spawnTerminal: 'cockpit:spawnTerminal',
  writeTerminal: 'cockpit:writeTerminal',
  resizeTerminal: 'cockpit:resizeTerminal',
  killTerminal: 'cockpit:killTerminal',
  getTerminalBuffer: 'cockpit:getTerminalBuffer',
  getGitSummary: 'cockpit:getGitSummary',
  getDiff: 'cockpit:getDiff',
  listDir: 'cockpit:listDir',
  readFile: 'cockpit:readFile',
  watchProject: 'cockpit:watchProject',
  unwatchProject: 'cockpit:unwatchProject',
  getAgents: 'cockpit:getAgents',
  getAgentHooksStatus: 'cockpit:getAgentHooksStatus',
  installAgentHooks: 'cockpit:installAgentHooks',
  uninstallAgentHooks: 'cockpit:uninstallAgentHooks',
  markAgentHooksPrompted: 'cockpit:markAgentHooksPrompted',
  getDockerStatus: 'cockpit:getDockerStatus',
  dockerAction: 'cockpit:dockerAction',
  getDockerLogs: 'cockpit:getDockerLogs',
  getGlobalClaude: 'cockpit:getGlobalClaude',
  readClaudeFile: 'cockpit:readClaudeFile'
} as const

/** Event channel names — main → renderer (push). */
export const IpcEvents = {
  terminalData: 'cockpit:event:terminalData',
  terminalExit: 'cockpit:event:terminalExit',
  filesChanged: 'cockpit:event:filesChanged'
} as const

/** What preload exposes on `window`. */
declare global {
  interface Window {
    cockpit: CockpitApi
  }
}
