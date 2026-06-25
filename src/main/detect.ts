// Infer run/test/build (and docs/CLAUDE.md paths) from an existing project's structure.
// Best-effort and conservative: only emit a value when a recognised marker is found.
// The renderer presents these as editable defaults — never silently authoritative.

import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { DetectedSettings } from '../shared/types'

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

/** Pick the JS package manager from whichever lockfile is present. */
function jsManager(root: string): string {
  if (isFile(join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (isFile(join(root, 'yarn.lock'))) return 'yarn'
  if (isFile(join(root, 'bun.lockb'))) return 'bun'
  return 'npm'
}

function runScript(mgr: string, script: string): string {
  // `npm run X` / `pnpm run X` / `yarn X` / `bun run X`
  return mgr === 'yarn' ? `yarn ${script}` : `${mgr} run ${script}`
}

function fromPackageJson(root: string, out: DetectedSettings): boolean {
  const pkgPath = join(root, 'package.json')
  if (!isFile(pkgPath)) return false
  let scripts: Record<string, string> = {}
  try {
    const raw = readFileSync(pkgPath, 'utf8')
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
    scripts = pkg.scripts ?? {}
  } catch {
    return false
  }
  const mgr = jsManager(root)
  out.sources.push(`package.json (${mgr})`)

  const runKey = ['dev', 'start', 'serve'].find((k) => scripts[k])
  if (runKey) out.runCommand = runScript(mgr, runKey)

  if (scripts.test) out.testCommand = mgr === 'yarn' ? 'yarn test' : `${mgr} test`

  const buildKey = ['build', 'compile'].find((k) => scripts[k])
  if (buildKey) out.buildCommand = runScript(mgr, buildKey)
  return true
}

function fromMakefile(root: string, out: DetectedSettings): boolean {
  const mk = join(root, 'Makefile')
  if (!isFile(mk)) return false
  const targets = new Set<string>()
  try {
    const text = readFileSync(mk, 'utf8')
    for (const line of text.split('\n')) {
      const m = /^([A-Za-z0-9_.-]+)\s*:/.exec(line)
      if (m) targets.add(m[1])
    }
  } catch {
    return false
  }
  out.sources.push('Makefile')
  if (!out.runCommand && targets.has('run')) out.runCommand = 'make run'
  if (!out.testCommand && targets.has('test')) out.testCommand = 'make test'
  if (!out.buildCommand && targets.has('build')) out.buildCommand = 'make build'
  return true
}

function fromCargo(root: string, out: DetectedSettings): boolean {
  if (!isFile(join(root, 'Cargo.toml'))) return false
  out.sources.push('Cargo.toml')
  out.runCommand ??= 'cargo run'
  out.testCommand ??= 'cargo test'
  out.buildCommand ??= 'cargo build'
  return true
}

function fromPython(root: string, out: DetectedSettings): boolean {
  const py = isFile(join(root, 'pyproject.toml'))
    ? 'pyproject.toml'
    : isFile(join(root, 'setup.py'))
      ? 'setup.py'
      : ''
  if (!py) return false
  out.sources.push(py)
  out.testCommand ??= 'pytest'
  return true
}

function fromGo(root: string, out: DetectedSettings): boolean {
  if (!isFile(join(root, 'go.mod'))) return false
  out.sources.push('go.mod')
  out.runCommand ??= 'go run .'
  out.testCommand ??= 'go test ./...'
  out.buildCommand ??= 'go build ./...'
  return true
}

const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']

function fromCompose(root: string, out: DetectedSettings): boolean {
  if (!COMPOSE_FILES.some((f) => isFile(join(root, f)))) return false
  out.sources.push('docker compose')
  // Fill run/build only if no richer toolchain already did — compose is the fallback.
  out.runCommand ??= 'docker compose up'
  out.buildCommand ??= 'docker compose build'
  return true
}

export function detectProjectSettings(root: string): DetectedSettings {
  const out: DetectedSettings = { sources: [] }
  if (!root || !isDir(root)) return out

  // JS toolchain wins for run/test/build; other stacks fill gaps they recognise.
  fromPackageJson(root, out)
  fromMakefile(root, out)
  fromCargo(root, out)
  fromGo(root, out)
  fromPython(root, out)
  fromCompose(root, out) // fallback run/build for compose-only projects

  // Surface .env so the user can see/edit the variables (they're also auto-merged at spawn).
  const envPath = join(root, '.env')
  if (isFile(envPath)) {
    try {
      if (statSync(envPath).size <= 256 * 1024) {
        const text = readFileSync(envPath, 'utf8').trim()
        if (text) {
          out.env = text
          out.sources.push('.env')
        }
      }
    } catch {
      /* unreadable .env — ignore */
    }
  }

  if (isFile(join(root, 'CLAUDE.md'))) {
    out.claudeMdPath = './CLAUDE.md'
    out.sources.push('CLAUDE.md')
  }
  if (isDir(join(root, 'docs'))) {
    out.docsPath = 'docs/'
    out.sources.push('docs/')
  }

  return out
}
