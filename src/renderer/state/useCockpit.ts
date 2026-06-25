// Thin renderer-side state over the typed window.cockpit API. No electron imports.

import { useCallback, useEffect, useState } from 'react'
import type { AppState, Project, ProjectId, ProjectSettings } from '../../shared/types'

const EMPTY_SETTINGS: ProjectSettings = {
  path: '',
  runCommand: '',
  testCommand: '',
  buildCommand: '',
  docsPath: 'docs/',
  claudeMdPath: './CLAUDE.md',
  autoLaunchCommand: 'claude'
}

export function emptySettings(): ProjectSettings {
  return { ...EMPTY_SETTINGS }
}

export function useCockpit() {
  const [state, setState] = useState<AppState>({ projects: [], activeProjectId: null })
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const next = await window.cockpit.getState()
    setState(next)
  }, [])

  useEffect(() => {
    window.cockpit.getState().then((s) => {
      setState(s)
      setReady(true)
    })
  }, [])

  const addProject = useCallback(
    async (name: string, settings: ProjectSettings) => {
      const p = await window.cockpit.addProject({ name, settings })
      await window.cockpit.setActiveProject(p.id)
      await refresh()
      return p
    },
    [refresh]
  )

  const updateProject = useCallback(
    async (id: ProjectId, patch: { name?: string; settings?: Partial<ProjectSettings> }) => {
      await window.cockpit.updateProject(id, patch)
      await refresh()
    },
    [refresh]
  )

  const removeProject = useCallback(
    async (id: ProjectId) => {
      await window.cockpit.removeProject(id)
      await refresh()
    },
    [refresh]
  )

  const reorderProjects = useCallback(
    async (ids: ProjectId[]) => {
      await window.cockpit.reorderProjects(ids)
      await refresh()
    },
    [refresh]
  )

  const markAgentHooksPrompted = useCallback(async () => {
    await window.cockpit.markAgentHooksPrompted()
    await refresh()
  }, [refresh])

  const setActiveProject = useCallback(
    async (id: ProjectId) => {
      await window.cockpit.setActiveProject(id)
      await refresh()
    },
    [refresh]
  )

  const activeProject: Project | null =
    state.projects.find((p) => p.id === state.activeProjectId) ?? null

  return {
    state,
    ready,
    activeProject,
    addProject,
    updateProject,
    removeProject,
    reorderProjects,
    markAgentHooksPrompted,
    setActiveProject,
    refresh
  }
}
