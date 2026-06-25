// THE seam. One interface describing every operation the renderer can ask of the
// backend, plus the event shapes flowing back. The renderer programs ONLY against
// `CockpitApi`. The Electron main process is one implementation; a future Tauri
// backend would be another behind the same contract.
//
// node-pty / fs / simple-git / electron live behind this. They never cross it.

import type {
  AppState,
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

  // --- projects ---
  getState(): Promise<AppState>
  addProject(input: { name: string; settings: ProjectSettings }): Promise<Project>
  updateProject(id: ProjectId, patch: Partial<Pick<Project, 'name'>> & { settings?: Partial<ProjectSettings> }): Promise<Project>
  removeProject(id: ProjectId): Promise<void>
  setActiveProject(id: ProjectId | null): Promise<void>

  // --- terminals ---
  listTerminals(projectId: ProjectId): Promise<TerminalInfo[]>
  spawnTerminal(req: SpawnTerminalRequest): Promise<TerminalInfo>
  writeTerminal(id: TerminalId, data: string): Promise<void>
  resizeTerminal(id: TerminalId, cols: number, rows: number): Promise<void>
  killTerminal(id: TerminalId): Promise<void>
  /** Replay buffered scrollback for a terminal (e.g. on tab activation). */
  getTerminalBuffer(id: TerminalId): Promise<string>

  // --- event subscriptions: return an unsubscribe fn ---
  onTerminalData(handler: (e: TerminalDataEvent) => void): () => void
  onTerminalExit(handler: (e: TerminalExitEvent) => void): () => void
}

/** IPC channel names — invoke (req/resp). Kept here so main + preload share one source. */
export const IpcChannels = {
  pickDirectory: 'cockpit:pickDirectory',
  getState: 'cockpit:getState',
  addProject: 'cockpit:addProject',
  updateProject: 'cockpit:updateProject',
  removeProject: 'cockpit:removeProject',
  setActiveProject: 'cockpit:setActiveProject',
  listTerminals: 'cockpit:listTerminals',
  spawnTerminal: 'cockpit:spawnTerminal',
  writeTerminal: 'cockpit:writeTerminal',
  resizeTerminal: 'cockpit:resizeTerminal',
  killTerminal: 'cockpit:killTerminal',
  getTerminalBuffer: 'cockpit:getTerminalBuffer'
} as const

/** Event channel names — main → renderer (push). */
export const IpcEvents = {
  terminalData: 'cockpit:event:terminalData',
  terminalExit: 'cockpit:event:terminalExit'
} as const

/** What preload exposes on `window`. */
declare global {
  interface Window {
    cockpit: CockpitApi
  }
}
