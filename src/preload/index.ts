// Preload is the ONLY place renderer-side code may touch Electron. It implements
// CockpitApi on top of ipcRenderer and exposes it as `window.cockpit`. The renderer
// imports nothing from electron/node — it sees only this typed surface.

import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, IpcEvents, type CockpitApi } from '../shared/ipc-contract'
import type { ProjectId, TerminalDataEvent, TerminalExitEvent } from '../shared/types'

const api: CockpitApi = {
  pickDirectory: () => ipcRenderer.invoke(IpcChannels.pickDirectory),
  detectProjectSettings: (path) => ipcRenderer.invoke(IpcChannels.detectProjectSettings, path),
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

  getGitSummary: (projectId) => ipcRenderer.invoke(IpcChannels.getGitSummary, projectId),
  getDiff: (projectId, relPath) => ipcRenderer.invoke(IpcChannels.getDiff, projectId, relPath),
  listDir: (projectId, relPath) => ipcRenderer.invoke(IpcChannels.listDir, projectId, relPath),
  readFile: (projectId, relPath) => ipcRenderer.invoke(IpcChannels.readFile, projectId, relPath),
  watchProject: (projectId) => ipcRenderer.invoke(IpcChannels.watchProject, projectId),
  unwatchProject: (projectId) => ipcRenderer.invoke(IpcChannels.unwatchProject, projectId),

  getDockerStatus: (projectId) => ipcRenderer.invoke(IpcChannels.getDockerStatus, projectId),
  dockerAction: (projectId, action) =>
    ipcRenderer.invoke(IpcChannels.dockerAction, projectId, action),
  getDockerLogs: (projectId, service) =>
    ipcRenderer.invoke(IpcChannels.getDockerLogs, projectId, service),

  getGlobalClaude: () => ipcRenderer.invoke(IpcChannels.getGlobalClaude),
  readClaudeFile: (relPath) => ipcRenderer.invoke(IpcChannels.readClaudeFile, relPath),

  onTerminalData: (handler) => {
    const listener = (_e: unknown, payload: TerminalDataEvent): void => handler(payload)
    ipcRenderer.on(IpcEvents.terminalData, listener)
    return () => ipcRenderer.removeListener(IpcEvents.terminalData, listener)
  },
  onTerminalExit: (handler) => {
    const listener = (_e: unknown, payload: TerminalExitEvent): void => handler(payload)
    ipcRenderer.on(IpcEvents.terminalExit, listener)
    return () => ipcRenderer.removeListener(IpcEvents.terminalExit, listener)
  },
  onFilesChanged: (handler) => {
    const listener = (_e: unknown, payload: { projectId: ProjectId }): void => handler(payload)
    ipcRenderer.on(IpcEvents.filesChanged, listener)
    return () => ipcRenderer.removeListener(IpcEvents.filesChanged, listener)
  }
}

contextBridge.exposeInMainWorld('cockpit', api)
