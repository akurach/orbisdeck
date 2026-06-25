// Preload is the ONLY place renderer-side code may touch Electron. It implements
// CockpitApi on top of ipcRenderer and exposes it as `window.cockpit`. The renderer
// imports nothing from electron/node — it sees only this typed surface.

import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, IpcEvents, type CockpitApi } from '../shared/ipc-contract'
import type { TerminalDataEvent, TerminalExitEvent } from '../shared/types'

const api: CockpitApi = {
  getState: () => ipcRenderer.invoke(IpcChannels.getState),
  addProject: (input) => ipcRenderer.invoke(IpcChannels.addProject, input),
  updateProject: (id, patch) => ipcRenderer.invoke(IpcChannels.updateProject, id, patch),
  removeProject: (id) => ipcRenderer.invoke(IpcChannels.removeProject, id),
  setActiveProject: (id) => ipcRenderer.invoke(IpcChannels.setActiveProject, id),

  listTerminals: (projectId) => ipcRenderer.invoke(IpcChannels.listTerminals, projectId),
  spawnTerminal: (req) => ipcRenderer.invoke(IpcChannels.spawnTerminal, req),
  writeTerminal: (id, data) => ipcRenderer.invoke(IpcChannels.writeTerminal, id, data),
  resizeTerminal: (id, cols, rows) =>
    ipcRenderer.invoke(IpcChannels.resizeTerminal, id, cols, rows),
  killTerminal: (id) => ipcRenderer.invoke(IpcChannels.killTerminal, id),
  getTerminalBuffer: (id) => ipcRenderer.invoke(IpcChannels.getTerminalBuffer, id),

  onTerminalData: (handler) => {
    const listener = (_e: unknown, payload: TerminalDataEvent): void => handler(payload)
    ipcRenderer.on(IpcEvents.terminalData, listener)
    return () => ipcRenderer.removeListener(IpcEvents.terminalData, listener)
  },
  onTerminalExit: (handler) => {
    const listener = (_e: unknown, payload: TerminalExitEvent): void => handler(payload)
    ipcRenderer.on(IpcEvents.terminalExit, listener)
    return () => ipcRenderer.removeListener(IpcEvents.terminalExit, listener)
  }
}

contextBridge.exposeInMainWorld('cockpit', api)
