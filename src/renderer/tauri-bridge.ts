// Tauri implementation of the CockpitApi seam (spike). When the renderer runs inside
// the Tauri webview we install `window.cockpit` backed by Tauri commands/events instead
// of the Electron preload. Only terminals are wired to the native (Rust) backend; the
// rest is stubbed so the existing React UI loads and a real pty can be exercised.

import type {
  AgentHooksStatus,
  AgentInfo,
  AppState,
  ClaudePermissions,
  DetectedSettings,
  DiffResult,
  DirEntry,
  DockerStatus,
  FileContent,
  GitSummary,
  GlobalClaudeConfig,
  Project,
  SpawnTerminalRequest,
  TerminalInfo,
  TerminalDataEvent,
  TerminalExitEvent
} from '../shared/types'
import type { CockpitApi } from '../shared/ipc-contract'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// One hardcoded project for the spike so the UI mounts a project and the terminal
// panel auto-spawns into a real directory.
const SPIKE_PATH = '/Users/avkurach/Documents/AI-Claude-Cockpit'
const SPIKE_PROJECT: Project = {
  id: 'spike',
  name: 'spike (tauri)',
  settings: {
    path: SPIKE_PATH,
    runCommand: '',
    testCommand: '',
    buildCommand: '',
    docsPath: '',
    claudeMdPath: './CLAUDE.md',
    autoLaunchCommand: '' // plain shell — exercises the pty without launching claude
  }
}

const EMPTY_GIT: GitSummary = {
  isRepo: false,
  branch: '',
  changed: 0,
  staged: 0,
  unstaged: 0,
  recent: [],
  fileStatus: {}
}

export async function installTauriCockpit(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')

  const subscribe = <T>(event: string, handler: (e: T) => void): (() => void) => {
    let un: (() => void) | undefined
    listen<T>(event, (e) => handler(e.payload)).then((f) => (un = f))
    return () => un?.()
  }

  const api: CockpitApi = {
    // dialogs / detect
    pickDirectory: async () => null,
    detectProjectSettings: async (): Promise<DetectedSettings> => ({ sources: [] }),

    // projects (single spike project, in-memory)
    getState: async (): Promise<AppState> => ({
      projects: [SPIKE_PROJECT],
      activeProjectId: SPIKE_PROJECT.id,
      agentHooksPrompted: true
    }),
    addProject: async (input) => ({ id: 'spike', name: input.name, settings: input.settings }),
    updateProject: async (_id, patch) => ({
      ...SPIKE_PROJECT,
      name: patch.name ?? SPIKE_PROJECT.name,
      settings: { ...SPIKE_PROJECT.settings, ...(patch.settings ?? {}) }
    }),
    removeProject: async () => {},
    reorderProjects: async () => {},
    setActiveProject: async () => {},

    // terminals — wired to the Rust pty backend
    listTerminals: async () => [],
    spawnTerminal: async (req: SpawnTerminalRequest): Promise<TerminalInfo> => {
      const id = await invoke<string>('spawn_terminal', {
        cwd: req.cwd || SPIKE_PATH,
        command: req.command ?? null,
        cols: req.cols || 80,
        rows: req.rows || 24
      })
      return {
        id,
        projectId: req.projectId,
        title: req.title || (req.command ? req.command : 'shell'),
        command: req.command || '',
        cwd: req.cwd || SPIKE_PATH,
        startedAt: Date.now(),
        alive: true,
        pid: 0
      }
    },
    writeTerminal: async (id, data) => invoke('write_terminal', { id, data }),
    resizeTerminal: async (id, cols, rows) => invoke('resize_terminal', { id, cols, rows }),
    killTerminal: async (id) => invoke('kill_terminal', { id }),
    getTerminalBuffer: async () => '',

    // everything else — stubbed for the spike
    getGitSummary: async () => EMPTY_GIT,
    getDiff: async (): Promise<DiffResult> => ({ path: '', text: '', truncated: false, binary: false }),
    listDir: async (): Promise<DirEntry[]> => [],
    readFile: async (): Promise<FileContent> => ({
      path: '',
      content: '',
      language: '',
      truncated: false,
      binary: false
    }),
    watchProject: async () => {},
    unwatchProject: async () => {},
    getAgents: async (): Promise<AgentInfo[]> => [],
    getAgentHooksStatus: async (): Promise<AgentHooksStatus> => ({ installed: false }),
    installAgentHooks: async (): Promise<AgentHooksStatus> => ({ installed: false }),
    uninstallAgentHooks: async (): Promise<AgentHooksStatus> => ({ installed: false }),
    markAgentHooksPrompted: async () => {},
    getNote: async () => '',
    setNote: async () => {},
    getDockerStatus: async (): Promise<DockerStatus> => ({
      available: false,
      hasCompose: false,
      containers: [],
      error: ''
    }),
    dockerAction: async () => ({ ok: false, error: 'spike' }),
    getDockerLogs: async () => '',
    getGlobalClaude: async (): Promise<GlobalClaudeConfig> => ({
      claudeDir: '',
      exists: false,
      settingsText: '',
      settingsPath: '',
      localSettingsText: '',
      localSettingsPath: '',
      claudeMdText: '',
      claudeMdPath: '',
      permissions: { allow: [], ask: [], deny: [] } as ClaudePermissions,
      hooks: [],
      mcpServers: [],
      commands: []
    }),
    readClaudeFile: async (): Promise<FileContent> => ({
      path: '',
      content: '',
      language: '',
      truncated: false,
      binary: false
    }),
    writeClaudeSettings: async () => ({ ok: false, error: 'spike' }),
    setClaudePermissions: async () => ({ ok: false, error: 'spike' }),

    // events
    onTerminalData: (handler) => subscribe<TerminalDataEvent>('term-data', handler),
    onTerminalExit: (handler) => subscribe<TerminalExitEvent>('term-exit', handler),
    onFilesChanged: () => () => {},
    onNotify: () => () => {}
  }

  ;(window as unknown as { cockpit: CockpitApi }).cockpit = api
}
