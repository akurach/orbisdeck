// Wires the typed contract to Electron IPC. This is the Electron *implementation*
// of CockpitApi. All node-pty / fs access funnels through here — nothing leaks past.

import { BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { IpcChannels, IpcEvents } from '../shared/ipc-contract'
import type { ProjectId, SpawnTerminalRequest, TerminalId } from '../shared/types'
import { Store } from './store'
import { TerminalManager } from './terminals'
import { GitService } from './git'
import { FileService } from './files'
import { ClaudeService } from './claude'
import { DockerService } from './docker'
import { detectProjectSettings } from './detect'
import type { DockerAction } from '../shared/types'

export interface Services {
  terminals: TerminalManager
  files: FileService
}

/** Parse KEY=VALUE lines (blanks and #comments ignored) into an env record. */
function parseEnv(text?: string): Record<string, string> | undefined {
  if (!text) return undefined
  const env: Record<string, string> = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return Object.keys(env).length ? env : undefined
}

export function registerIpc(store: Store): Services {
  const broadcast = (channel: string, payload: unknown): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, payload)
    }
  }

  const terminals = new TerminalManager(
    (id, data) => broadcast(IpcEvents.terminalData, { id, data }),
    (id, exitCode, signal) => broadcast(IpcEvents.terminalExit, { id, exitCode, signal })
  )
  const git = new GitService()
  const files = new FileService()
  const claude = new ClaudeService()
  const docker = new DockerService()

  const projectPath = (id: ProjectId): string => store.getProject(id)?.settings.path ?? ''

  ipcMain.handle(IpcChannels.pickDirectory, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const res = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Выберите папку проекта'
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle(IpcChannels.detectProjectSettings, (_e, path: string) =>
    detectProjectSettings(path)
  )

  ipcMain.handle(IpcChannels.getState, () => store.getState())

  ipcMain.handle(IpcChannels.addProject, (_e, input) => store.addProject(input))

  ipcMain.handle(IpcChannels.updateProject, (_e, id: ProjectId, patch) =>
    store.updateProject(id, patch)
  )

  ipcMain.handle(IpcChannels.removeProject, (_e, id: ProjectId) => {
    for (const t of terminals.list(id)) terminals.kill(t.id)
    files.unwatch(id)
    store.removeProject(id)
  })

  ipcMain.handle(IpcChannels.setActiveProject, (_e, id: ProjectId | null) =>
    store.setActiveProject(id)
  )

  ipcMain.handle(IpcChannels.listTerminals, (_e, projectId: ProjectId) =>
    terminals.list(projectId)
  )

  ipcMain.handle(IpcChannels.spawnTerminal, (_e, req: SpawnTerminalRequest) => {
    const project = store.getProject(req.projectId)
    if (!project) throw new Error(`unknown project: ${req.projectId}`)
    const { path, env, cwdSubdir } = project.settings
    const cwd = req.cwd || (cwdSubdir ? join(path, cwdSubdir) : path)
    return terminals.spawn({ ...req, cwd, env: parseEnv(env) }, path)
  })

  ipcMain.handle(IpcChannels.writeTerminal, (_e, id: TerminalId, data: string) =>
    terminals.write(id, data)
  )

  ipcMain.handle(IpcChannels.resizeTerminal, (_e, id: TerminalId, cols: number, rows: number) =>
    terminals.resize(id, cols, rows)
  )

  ipcMain.handle(IpcChannels.killTerminal, (_e, id: TerminalId) => terminals.kill(id))

  ipcMain.handle(IpcChannels.getTerminalBuffer, (_e, id: TerminalId) => terminals.getBuffer(id))

  // --- git (M3) ---
  ipcMain.handle(IpcChannels.getGitSummary, (_e, id: ProjectId) => git.summary(projectPath(id)))
  ipcMain.handle(IpcChannels.getDiff, (_e, id: ProjectId, relPath?: string) =>
    git.diff(projectPath(id), relPath)
  )

  // --- files (M3) ---
  ipcMain.handle(IpcChannels.listDir, (_e, id: ProjectId, relPath: string) =>
    files.listDir(projectPath(id), relPath)
  )
  ipcMain.handle(IpcChannels.readFile, (_e, id: ProjectId, relPath: string) =>
    files.readFile(projectPath(id), relPath)
  )
  ipcMain.handle(IpcChannels.watchProject, (_e, id: ProjectId) => {
    files.watch(id, projectPath(id), () => broadcast(IpcEvents.filesChanged, { projectId: id }))
  })
  ipcMain.handle(IpcChannels.unwatchProject, (_e, id: ProjectId) => files.unwatch(id))

  // --- docker (M5) ---
  ipcMain.handle(IpcChannels.getDockerStatus, (_e, id: ProjectId) => docker.status(projectPath(id)))
  ipcMain.handle(IpcChannels.dockerAction, (_e, id: ProjectId, action: DockerAction) =>
    docker.action(projectPath(id), action)
  )
  ipcMain.handle(IpcChannels.getDockerLogs, (_e, id: ProjectId, service?: string) =>
    docker.logs(projectPath(id), service)
  )

  // --- global Claude config (M4), read-only ---
  ipcMain.handle(IpcChannels.getGlobalClaude, () => claude.global())
  ipcMain.handle(IpcChannels.readClaudeFile, (_e, relPath: string) => claude.readFile(relPath))

  return { terminals, files }
}
