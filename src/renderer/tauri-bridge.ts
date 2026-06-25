// Tauri implementation of the CockpitApi seam. When the renderer runs inside the Tauri
// webview we install `window.cockpit` backed by Tauri commands/events instead of the
// Electron preload. The React UI is unchanged — only this provider differs.

import type { CockpitApi } from '../shared/ipc-contract'
import type { ProjectId } from '../shared/types'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function installTauriCockpit(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')

  const sub = <T>(event: string, handler: (e: T) => void): (() => void) => {
    let un: (() => void) | undefined
    listen<T>(event, (e) => handler(e.payload)).then((f) => (un = f))
    return () => un?.()
  }

  const api: CockpitApi = {
    pickDirectory: () => invoke('pick_directory'),
    detectProjectSettings: (path) => invoke('detect_project_settings', { path }),

    getState: () => invoke('get_state'),
    addProject: (input) => invoke('add_project', { input }),
    updateProject: (id, patch) => invoke('update_project', { id, patch }),
    removeProject: (id) => invoke('remove_project', { id }),
    setActiveProject: (id) => invoke('set_active_project', { id }),
    reorderProjects: (ids) => invoke('reorder_projects', { ids }),

    listTerminals: (projectId) => invoke('list_terminals', { projectId }),
    spawnTerminal: (req) =>
      invoke('spawn_terminal', {
        projectId: req.projectId,
        title: req.title ?? null,
        command: req.command ?? null,
        cols: req.cols,
        rows: req.rows
      }),
    writeTerminal: (id, data) => invoke('write_terminal', { id, data }),
    resizeTerminal: (id, cols, rows) => invoke('resize_terminal', { id, cols, rows }),
    killTerminal: (id) => invoke('kill_terminal', { id }),
    getTerminalBuffer: (id) => invoke('get_terminal_buffer', { id }),

    getGitSummary: (projectId) => invoke('get_git_summary', { projectId }),
    getDiff: (projectId, relPath) => invoke('get_diff', { projectId, relPath: relPath ?? null }),
    listDir: (projectId, relPath) => invoke('list_dir', { projectId, relPath }),
    readFile: (projectId, relPath) => invoke('read_file', { projectId, relPath }),
    watchProject: (projectId) => invoke('watch_project', { projectId }),
    unwatchProject: (projectId) => invoke('unwatch_project', { projectId }),

    getAgents: (projectId) => invoke('get_agents', { projectId }),
    getAgentHooksStatus: () => invoke('get_agent_hooks_status'),
    installAgentHooks: () => invoke('install_agent_hooks'),
    uninstallAgentHooks: () => invoke('uninstall_agent_hooks'),
    markAgentHooksPrompted: () => invoke('mark_agent_hooks_prompted'),
    getNote: (projectId) => invoke('get_note', { projectId }),
    setNote: (projectId, text) => invoke('set_note', { projectId, text }),

    getDockerStatus: (projectId) => invoke('get_docker_status', { projectId }),
    dockerAction: (projectId, action, service) =>
      invoke('docker_action', { projectId, action, service: service ?? null }),
    getDockerLogs: (projectId, service) =>
      invoke('get_docker_logs', { projectId, service: service ?? null }),

    getGlobalClaude: () => invoke('get_global_claude'),
    readClaudeFile: (relPath) => invoke('read_claude_file', { relPath }),
    writeClaudeSettings: (text) => invoke('write_claude_settings', { text }),
    setClaudePermissions: (perms) => invoke('set_claude_permissions', { perms }),

    onTerminalData: (handler) => sub('term-data', handler),
    onTerminalExit: (handler) => sub('term-exit', handler),
    onFilesChanged: (handler) => sub<{ projectId: ProjectId }>('files-changed', handler),
    onNotify: (handler) => sub('notify', handler)
  }

  ;(window as unknown as { cockpit: CockpitApi }).cockpit = api
}
