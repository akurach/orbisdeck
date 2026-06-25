// Docker management, compose-scoped, over the `docker` CLI. We orchestrate the
// existing tool — no Docker Desktop reimplementation. Status is a fact from
// `docker compose ps`; actions shell out to compose. Everything is defensive:
// a missing CLI or a compose error becomes a reported state, never a throw.

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { DockerAction, DockerContainer, DockerStatus } from '../shared/types'

const exec = promisify(execFile)
const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']

function composeFile(root: string): string | null {
  for (const f of COMPOSE_FILES) {
    if (existsSync(join(root, f))) return f
  }
  return null
}

async function run(root: string, args: string[], timeout = 15_000): Promise<string> {
  const { stdout } = await exec('docker', args, { cwd: root, timeout, maxBuffer: 4 * 1024 * 1024 })
  return stdout
}

/** `docker compose ps` emits either JSON-lines or a JSON array depending on version. */
function parsePs(stdout: string): DockerContainer[] {
  const text = stdout.trim()
  if (!text) return []
  const rows: Record<string, unknown>[] = []
  try {
    const asArray = JSON.parse(text)
    if (Array.isArray(asArray)) rows.push(...asArray)
    else rows.push(asArray)
  } catch {
    for (const line of text.split('\n')) {
      const l = line.trim()
      if (!l) continue
      try {
        rows.push(JSON.parse(l))
      } catch {
        /* skip unparseable line */
      }
    }
  }
  return rows.map((r) => ({
    id: String(r.ID ?? r.Id ?? ''),
    name: String(r.Name ?? r.Names ?? ''),
    service: String(r.Service ?? ''),
    state: String(r.State ?? '').toLowerCase(),
    status: String(r.Status ?? r.Health ?? ''),
    ports: String(r.Ports ?? r.Publishers ?? '')
  }))
}

export class DockerService {
  async status(root: string): Promise<DockerStatus> {
    const empty: DockerStatus = { available: false, hasCompose: false, containers: [], error: '' }
    if (!root) return empty

    const file = composeFile(root)
    if (!file) return { ...empty, available: true, hasCompose: false }

    try {
      const out = await run(root, ['compose', 'ps', '--format', 'json', '--all'])
      return { available: true, hasCompose: true, containers: parsePs(out), error: '' }
    } catch (e) {
      const err = e as { code?: string; stderr?: string; message?: string }
      // ENOENT => docker binary not found.
      if (err.code === 'ENOENT') {
        return { available: false, hasCompose: true, containers: [], error: 'docker CLI не найден' }
      }
      return {
        available: true,
        hasCompose: true,
        containers: [],
        error: (err.stderr || err.message || 'ошибка docker').trim().slice(0, 500)
      }
    }
  }

  async action(root: string, action: DockerAction): Promise<{ ok: boolean; error: string }> {
    if (!root || !composeFile(root)) return { ok: false, error: 'нет compose-файла' }
    const args =
      action === 'up'
        ? ['compose', 'up', '-d']
        : action === 'down'
          ? ['compose', 'down']
          : ['compose', 'restart']
    try {
      await run(root, args, 120_000)
      return { ok: true, error: '' }
    } catch (e) {
      const err = e as { stderr?: string; message?: string }
      return { ok: false, error: (err.stderr || err.message || 'ошибка').trim().slice(0, 500) }
    }
  }

  async logs(root: string, service?: string): Promise<string> {
    if (!root || !composeFile(root)) return ''
    const args = ['compose', 'logs', '--tail', '200', '--no-color']
    if (service) args.push(service)
    try {
      return await run(root, args, 20_000)
    } catch (e) {
      const err = e as { stderr?: string; message?: string }
      return (err.stderr || err.message || '').trim()
    }
  }
}
