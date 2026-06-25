// Single durable state store. One JSON file under userData. Given single-user,
// low-volume, this is the boring correct choice over sqlite. Everything keys off
// an immutable project UUID — never the path or display name.

import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AppState, Project, ProjectId, ProjectSettings } from '../shared/types'

const EMPTY: AppState = { projects: [], activeProjectId: null }

export class Store {
  private file: string
  private state: AppState

  constructor() {
    this.file = join(app.getPath('userData'), 'cockpit-state.json')
    this.state = this.load()
  }

  private load(): AppState {
    try {
      if (existsSync(this.file)) {
        const raw = JSON.parse(readFileSync(this.file, 'utf8'))
        return { projects: raw.projects ?? [], activeProjectId: raw.activeProjectId ?? null }
      }
    } catch (err) {
      console.error('[store] failed to load, starting empty:', err)
    }
    return { ...EMPTY }
  }

  /** Atomic write: tmp file + rename, so a crash mid-write can't corrupt state. */
  private persist(): void {
    const dir = dirname(this.file)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }

  getState(): AppState {
    return this.state
  }

  addProject(input: { name: string; settings: ProjectSettings }): Project {
    const project: Project = { id: randomUUID(), name: input.name, settings: input.settings }
    this.state.projects.push(project)
    if (!this.state.activeProjectId) this.state.activeProjectId = project.id
    this.persist()
    return project
  }

  updateProject(
    id: ProjectId,
    patch: { name?: string; settings?: Partial<ProjectSettings> }
  ): Project {
    const p = this.state.projects.find((x) => x.id === id)
    if (!p) throw new Error(`project not found: ${id}`)
    if (patch.name !== undefined) p.name = patch.name
    if (patch.settings) p.settings = { ...p.settings, ...patch.settings }
    this.persist()
    return p
  }

  removeProject(id: ProjectId): void {
    this.state.projects = this.state.projects.filter((x) => x.id !== id)
    if (this.state.activeProjectId === id) {
      this.state.activeProjectId = this.state.projects[0]?.id ?? null
    }
    this.persist()
  }

  setActiveProject(id: ProjectId | null): void {
    this.state.activeProjectId = id
    this.persist()
  }

  /** Reorder projects to match the given id order; any ids not listed keep their tail order. */
  reorderProjects(ids: ProjectId[]): void {
    const byId = new Map(this.state.projects.map((p) => [p.id, p]))
    const next = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p)
    for (const p of this.state.projects) if (!ids.includes(p.id)) next.push(p)
    this.state.projects = next
    this.persist()
  }

  getProject(id: ProjectId): Project | undefined {
    return this.state.projects.find((x) => x.id === id)
  }
}
