import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { TerminalId } from '../../shared/types'

interface Props {
  terminalId: TerminalId
  /** Only the active tab is visible; inactive ones stay mounted (warm) but hidden. */
  active: boolean
}

const THEME = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  selectionBackground: '#264f78',
  black: '#0d1117',
  brightBlack: '#6e7681',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#c9d1d9',
  brightWhite: '#f0f6fc'
}

export function TerminalView({ terminalId, active }: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  // Create the xterm instance once for this terminal id.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      allowProposedApi: true,
      theme: THEME,
      scrollback: 10000
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    termRef.current = term
    fitRef.current = fit

    let disposed = false

    // Replay buffered scrollback captured in main while we weren't mounted.
    window.cockpit.getTerminalBuffer(terminalId).then((buf) => {
      if (!disposed && buf) term.write(buf)
    })

    // user input -> pty
    const onDataDisposable = term.onData((data) => {
      window.cockpit.writeTerminal(terminalId, data)
    })

    // pty output -> xterm (filter to this id)
    const offData = window.cockpit.onTerminalData((e) => {
      if (e.id === terminalId) term.write(e.data)
    })
    const offExit = window.cockpit.onTerminalExit((e) => {
      if (e.id === terminalId) {
        term.write(`\r\n\x1b[90m[process exited: code ${e.exitCode}]\x1b[0m\r\n`)
      }
    })

    const safeFit = (): void => {
      // Never fit a hidden (0x0) terminal — it would set cols=0 and corrupt the pty.
      if (host.clientWidth < 2 || host.clientHeight < 2) return
      try {
        fit.fit()
        window.cockpit.resizeTerminal(terminalId, term.cols, term.rows)
      } catch {
        /* layout not ready */
      }
    }

    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(safeFit)
    })
    ro.observe(host)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      onDataDisposable.dispose()
      offData()
      offExit()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [terminalId])

  // Refit + focus whenever this tab becomes the active (visible) one.
  useEffect(() => {
    if (!active) return
    const host = hostRef.current
    const term = termRef.current
    const fit = fitRef.current
    if (!host || !term || !fit) return
    // Defer to next frame so display:block has applied real dimensions.
    const id = requestAnimationFrame(() => {
      if (host.clientWidth < 2 || host.clientHeight < 2) return
      try {
        fit.fit()
        window.cockpit.resizeTerminal(terminalId, term.cols, term.rows)
        term.focus()
      } catch {
        /* not ready */
      }
    })
    return () => cancelAnimationFrame(id)
  }, [active, terminalId])

  return <div className="terminal-host" style={{ display: active ? 'block' : 'none' }} ref={hostRef} />
}
