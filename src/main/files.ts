// Read-only file tree + viewer backing. Lazy: listDir reads one directory on demand
// (the renderer expands nodes). Heavy dirs are never walked. A debounced chokidar
// watcher per project tells the renderer "something changed" — the renderer then
// re-lists whatever it has expanded. We never sync per-fs-event badges (melts on big
// repos); badges come from the git poll instead.

import chokidar, { type FSWatcher } from 'chokidar'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { DirEntry, FileContent } from '../shared/types'

const READ_CAP = 512 * 1024
const IMAGE_CAP = 8 * 1024 * 1024

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml'
}
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'release',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'coverage',
  '.DS_Store'
])

const LANG_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  swift: 'swift',
  py: 'python',
  sh: 'bash',
  zsh: 'bash',
  css: 'css',
  html: 'xml',
  txt: ''
}

/** Resolve a project-relative path and refuse anything that escapes the root. */
function safeResolve(root: string, relPath: string): string {
  const abs = resolve(root, relPath)
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error('path escapes project root')
  }
  return abs
}

function toRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join('/')
}

export class FileService {
  private watchers = new Map<string, FSWatcher>()

  listDir(root: string, relPath: string): DirEntry[] {
    if (!root) return []
    const abs = safeResolve(root, relPath || '.')
    let names: string[]
    try {
      names = readdirSync(abs)
    } catch {
      return []
    }
    const entries: DirEntry[] = []
    for (const name of names) {
      if (IGNORED_DIRS.has(name) || name.startsWith('.DS_Store')) continue
      let isDir = false
      try {
        isDir = statSync(join(abs, name)).isDirectory()
      } catch {
        continue
      }
      entries.push({ name, path: toRel(root, join(abs, name)), isDir })
    }
    // Dirs first, then files; each alphabetical, case-insensitive.
    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    return entries
  }

  readFile(root: string, relPath: string): FileContent {
    const abs = safeResolve(root, relPath)
    const ext = relPath.includes('.') ? relPath.split('.').pop()!.toLowerCase() : ''
    const result: FileContent = {
      path: relPath,
      content: '',
      language: LANG_BY_EXT[ext] ?? '',
      truncated: false,
      binary: false
    }
    // Images: return an inline preview payload instead of refusing as binary.
    const mime = IMAGE_MIME_BY_EXT[ext]
    if (mime) {
      let bytes = 0
      try {
        bytes = statSync(abs).size
      } catch {
        return result
      }
      if (bytes > IMAGE_CAP) {
        result.image = { dataUrl: '', mime, bytes, tooLarge: true }
        return result
      }
      try {
        const data = readFileSync(abs)
        result.image = {
          dataUrl: `data:${mime};base64,${data.toString('base64')}`,
          mime,
          bytes,
          tooLarge: false
        }
      } catch {
        return result
      }
      return result
    }

    let buf: Buffer
    try {
      buf = readFileSync(abs)
    } catch {
      return result
    }
    // Binary heuristic: a NUL byte in the first 8KB.
    const probe = buf.subarray(0, 8192)
    if (probe.includes(0)) {
      result.binary = true
      return result
    }
    if (buf.length > READ_CAP) {
      result.content = buf.subarray(0, READ_CAP).toString('utf8')
      result.truncated = true
    } else {
      result.content = buf.toString('utf8')
    }
    return result
  }

  watch(projectId: string, root: string, onChange: () => void): void {
    if (!root || this.watchers.has(projectId)) return
    const watcher = chokidar.watch(root, {
      ignoreInitial: true,
      ignored: (p: string) => {
        // ignore any path segment that is a heavy dir
        return p.split(sep).some((seg) => IGNORED_DIRS.has(seg))
      },
      // fsevents on macOS avoids the fd-exhaustion that polling/native-watch hit
      // on large trees; chokidar falls back gracefully if it's unavailable.
      usePolling: false
    })
    let timer: NodeJS.Timeout | null = null
    const debounced = (): void => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(onChange, 400)
    }
    watcher.on('add', debounced).on('addDir', debounced).on('unlink', debounced)
    watcher.on('unlinkDir', debounced).on('change', debounced)
    watcher.on('error', (e) => console.error('[watch]', e))
    this.watchers.set(projectId, watcher)
  }

  unwatch(projectId: string): void {
    const w = this.watchers.get(projectId)
    if (w) {
      w.close()
      this.watchers.delete(projectId)
    }
  }

  closeAll(): void {
    for (const id of [...this.watchers.keys()]) this.unwatch(id)
  }
}
