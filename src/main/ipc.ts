// Wires the typed contract to Electron IPC. This is the Electron *implementation*
// of CockpitApi. All node-pty / fs access funnels through here — nothing leaks past.

import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannels, IpcEvents } from '../shared/ipc-contract'
import type { ProjectId, SpawnTerminalRequest, TerminalId } from '../shared/types'
import { Store } from './store'
import { TerminalManager } from './terminals'

export function registerIpc(store: Store): TerminalManager {
  const broadcast = (channel: string, payload: unknown): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, payload)
    }
  }

  const terminals = new TerminalManager(
    (id, data) => broadcast(IpcEvents.terminalData, { id, data }),
    (id, exitCode, signal) => broadcast(IpcEvents.terminalExit, { id, exitCode, signal })
  )

  ipcMain.handle(IpcChannels.getState, () => store.getState())

  ipcMain.handle(IpcChannels.addProject, (_e, input) => store.addProject(input))

  ipcMain.handle(IpcChannels.updateProject, (_e, id: ProjectId, patch) =>
    store.updateProject(id, patch)
  )

  ipcMain.handle(IpcChannels.removeProject, (_e, id: ProjectId) => {
    for (const t of terminals.list(id)) terminals.kill(t.id)
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

  return terminals
}
