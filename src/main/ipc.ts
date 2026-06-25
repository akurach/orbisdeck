// Wires the typed contract to Electron IPC. This is the Electron *implementation*
// of CockpitApi. All node-pty / fs access funnels through here — nothing leaks past.

import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IpcChannels, IpcEvents } from '../shared/ipc-contract'
import type { ProjectId, SpawnTerminalRequest, TerminalId } from '../shared/types'
import { Store } from './store'
import { TerminalManager } from './terminals'
import { GitService } from './git'
import { FileService } from './files'

export interface Services {
  terminals: TerminalManager
  files: FileService
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
    return terminals.spawn(req, project.settings.path)
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

  return { terminals, files }
}
