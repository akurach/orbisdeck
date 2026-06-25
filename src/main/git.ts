// Git summary + diff via simple-git (a thin wrapper over the git CLI — inherits
// git's correctness and speed). Every call is gated behind checkIsRepo so a non-repo
// project simply reports isRepo:false rather than throwing all over the place.
//
// No watching here: the renderer polls getGitSummary on an interval while the Git
// panel is open (roadmap: debounced poll, NOT live-watching .git — that just causes
// a refresh storm).

import { simpleGit, type SimpleGit, type StatusResult } from 'simple-git'
import type { DiffResult, GitChangeKind, GitSummary } from '../shared/types'

const DIFF_CAP = 200 * 1024 // refuse to ship more than this; offer "open in editor"

const EMPTY: GitSummary = {
  isRepo: false,
  branch: '',
  changed: 0,
  staged: 0,
  unstaged: 0,
  recent: [],
  fileStatus: {}
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function kindFromCodes(index: string, working: string): GitChangeKind {
  const code = working !== ' ' && working !== '' ? working : index
  switch (code) {
    case '?':
      return 'untracked'
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    default:
      return 'modified'
  }
}

export class GitService {
  private clients = new Map<string, SimpleGit>()

  private client(projectPath: string): SimpleGit {
    let c = this.clients.get(projectPath)
    if (!c) {
      c = simpleGit({ baseDir: projectPath })
      this.clients.set(projectPath, c)
    }
    return c
  }

  async summary(projectPath: string): Promise<GitSummary> {
    if (!projectPath) return EMPTY
    const git = this.client(projectPath)
    let isRepo = false
    try {
      isRepo = await git.checkIsRepo()
    } catch {
      isRepo = false
    }
    if (!isRepo) return EMPTY

    let status: StatusResult
    try {
      status = await git.status()
    } catch {
      return { ...EMPTY, isRepo: true }
    }

    const fileStatus: Record<string, GitChangeKind> = {}
    let staged = 0
    let unstaged = 0
    for (const f of status.files) {
      const index = f.index ?? ' '
      const working = f.working_dir ?? ' '
      fileStatus[f.path.replace(/\\/g, '/')] = kindFromCodes(index, working)
      if (index !== ' ' && index !== '?') staged++
      if (working !== ' ' && working !== '') unstaged++
    }

    let recent: GitSummary['recent'] = []
    try {
      const log = await git.log({ maxCount: 5 })
      recent = log.all.map((c) => ({
        hash: c.hash.slice(0, 7),
        message: c.message,
        date: relativeTime(c.date)
      }))
    } catch {
      /* no commits yet */
    }

    return {
      isRepo: true,
      branch: status.current ?? '(detached)',
      changed: status.files.length,
      staged,
      unstaged,
      recent,
      fileStatus
    }
  }

  async diff(projectPath: string, relPath?: string): Promise<DiffResult> {
    const path = relPath ?? ''
    const result: DiffResult = { path, text: '', truncated: false, binary: false }
    if (!projectPath) return result
    const git = this.client(projectPath)
    try {
      if (!(await git.checkIsRepo())) return result
    } catch {
      return result
    }
    let text = ''
    try {
      // vs HEAD captures both staged and unstaged changes for the file.
      const args = relPath ? ['HEAD', '--', relPath] : ['HEAD']
      text = await git.diff(args)
    } catch {
      // No HEAD yet (fresh repo) — fall back to plain working-tree diff.
      try {
        text = await git.diff(relPath ? ['--', relPath] : [])
      } catch {
        return result
      }
    }
    if (/^Binary files /m.test(text)) result.binary = true
    if (text.length > DIFF_CAP) {
      result.text = text.slice(0, DIFF_CAP)
      result.truncated = true
    } else {
      result.text = text
    }
    return result
  }

  forget(projectPath: string): void {
    this.clients.delete(projectPath)
  }
}
