// node-pty session manager. Owns every PTY. Two non-negotiables baked in here:
//
//  1. Batched output — pty.onData fires thousands of tiny chunks on a chatty build
//     or a streaming `claude`. We coalesce on a short timer before crossing IPC, or
//     the renderer bridge becomes the bottleneck and the UI stutters at 4+ projects.
//
//  2. Scrollback buffer — each terminal keeps a capped tail of output in main, so a
//     backgrounded tab need not push every byte to a hidden xterm (which measures 0x0
//     and corrupts cols anyway). On tab activation the renderer replays the buffer.
//
// This file is the reason the "instant switch + many alive sessions" premise is affordable.

import * as os from 'node:os'
import * as pty from 'node-pty'
import { randomUUID } from 'node:crypto'
import type { SpawnTerminalRequest, TerminalInfo } from '../shared/types'

const FLUSH_MS = 12 // coalesce window; ~1 frame
const MAX_BUFFER = 256 * 1024 // per-terminal scrollback cap (chars)

interface Session {
  info: TerminalInfo
  proc: pty.IPty
  buffer: string
  pending: string
  flushTimer: NodeJS.Timeout | null
}

type DataSink = (id: string, data: string) => void
type ExitSink = (id: string, exitCode: number, signal?: number) => void

function defaultShell(): string {
  if (process.platform === 'win32') return process.env.COMSPEC || 'powershell.exe'
  return process.env.SHELL || '/bin/zsh'
}

export class TerminalManager {
  private sessions = new Map<string, Session>()

  constructor(
    private onData: DataSink,
    private onExit: ExitSink
  ) {}

  spawn(req: SpawnTerminalRequest, projectPath: string): TerminalInfo {
    const id = randomUUID()
    const cwd = req.cwd || projectPath || os.homedir()
    const command = req.command || defaultShell()
    // When a command is given, run it through the login shell so PATH/aliases resolve;
    // otherwise spawn an interactive login shell directly.
    const useShell = !!req.command
    const fileToRun = useShell ? defaultShell() : command
    const argsToRun = useShell ? ['-l', '-c', command] : ['-l']

    const proc = pty.spawn(fileToRun, argsToRun, {
      name: 'xterm-256color',
      cols: req.cols || 80,
      rows: req.rows || 24,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color', ...(req.env ?? {}) } as Record<string, string>
    })

    const info: TerminalInfo = {
      id,
      projectId: req.projectId,
      title: req.title || (useShell ? command : 'shell'),
      command,
      cwd,
      startedAt: Date.now(),
      alive: true,
      pid: proc.pid ?? 0
    }

    const session: Session = { info, proc, buffer: '', pending: '', flushTimer: null }
    this.sessions.set(id, session)

    proc.onData((chunk) => this.enqueue(session, chunk))
    proc.onExit(({ exitCode, signal }) => {
      this.flush(session) // drain any buffered tail before signalling exit
      session.info.alive = false
      this.onExit(id, exitCode, signal)
    })

    return info
  }

  private enqueue(session: Session, chunk: string): void {
    session.pending += chunk
    // Maintain the scrollback tail incrementally.
    session.buffer += chunk
    if (session.buffer.length > MAX_BUFFER) {
      let cut = session.buffer.slice(session.buffer.length - MAX_BUFFER)
      // Don't start the replayed tail mid-escape-sequence (corrupts the screen on
      // reattach). Drop the leading partial line up to the first newline.
      const nl = cut.indexOf('\n')
      if (nl > 0) cut = cut.slice(nl + 1)
      session.buffer = cut
    }
    if (session.flushTimer) return
    session.flushTimer = setTimeout(() => this.flush(session), FLUSH_MS)
  }

  private flush(session: Session): void {
    if (session.flushTimer) {
      clearTimeout(session.flushTimer)
      session.flushTimer = null
    }
    if (!session.pending) return
    const data = session.pending
    session.pending = ''
    this.onData(session.info.id, data)
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.proc.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    const s = this.sessions.get(id)
    if (!s || !s.info.alive) return
    // Guard against a hidden (0x0) terminal corrupting the pty geometry.
    if (cols < 1 || rows < 1) return
    try {
      s.proc.resize(cols, rows)
    } catch (err) {
      console.error('[pty] resize failed:', err)
    }
  }

  kill(id: string): void {
    const s = this.sessions.get(id)
    if (!s) return
    try {
      s.proc.kill()
    } catch {
      /* already dead */
    }
    this.sessions.delete(id)
  }

  getBuffer(id: string): string {
    return this.sessions.get(id)?.buffer ?? ''
  }

  list(projectId: string): TerminalInfo[] {
    return [...this.sessions.values()]
      .filter((s) => s.info.projectId === projectId)
      .map((s) => s.info)
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id)
  }
}
