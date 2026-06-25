import { useCallback, useEffect, useState } from 'react'

/** Per-project pane sizes (px). UI-only preference; persisted in localStorage
 *  (not the typed project store) since it never crosses the IPC seam. */
export interface Layout {
  rightWidth: number
  bottomHeight: number
  rightCollapsed: boolean
  bottomCollapsed: boolean
  /** which side the context (right) panel docks: 'right' (default) or 'left' */
  panelSide: 'right' | 'left'
  /** where the bottom panel docks: 'bottom' (default) or 'top' */
  bottomSide: 'bottom' | 'top'
}

const DEFAULTS: Layout = {
  rightWidth: 380,
  bottomHeight: 280,
  rightCollapsed: false,
  bottomCollapsed: false,
  panelSide: 'right',
  bottomSide: 'bottom'
}

const RIGHT_MIN = 300
const RIGHT_MAX = 760
const BOTTOM_MIN = 140

// Keep the workspace (terminal) from being squeezed to nothing.
const WORKSPACE_RESERVE = 240

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

function bottomMax(): number {
  // Guard against SSR-less but defensive; renderer always has window.
  const h = typeof window !== 'undefined' ? window.innerHeight : 900
  return Math.max(BOTTOM_MIN, h - WORKSPACE_RESERVE)
}

function keyFor(projectId: string): string {
  return `orbisdeck:layout:${projectId}`
}

export interface UseLayout extends Layout {
  resizeRight: (delta: number) => void
  resizeBottom: (delta: number) => void
  commit: () => void
  toggleRight: () => void
  toggleBottom: () => void
  toggleSide: () => void
  toggleBottomSide: () => void
}

export function useLayout(projectId: string): UseLayout {
  const [layout, setLayout] = useState<Layout>(DEFAULTS)

  // Load this project's saved sizes (re-clamped to the current viewport).
  useEffect(() => {
    let next = DEFAULTS
    try {
      const raw = localStorage.getItem(keyFor(projectId))
      if (raw) next = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Layout>) }
    } catch {
      next = DEFAULTS
    }
    setLayout({
      rightWidth: clamp(next.rightWidth, RIGHT_MIN, RIGHT_MAX),
      bottomHeight: clamp(next.bottomHeight, BOTTOM_MIN, bottomMax()),
      rightCollapsed: !!next.rightCollapsed,
      bottomCollapsed: !!next.bottomCollapsed,
      panelSide: next.panelSide === 'left' ? 'left' : 'right',
      bottomSide: next.bottomSide === 'top' ? 'top' : 'bottom'
    })
  }, [projectId])

  const persist = useCallback(
    (l: Layout) => {
      try {
        localStorage.setItem(keyFor(projectId), JSON.stringify(l))
      } catch {
        /* storage unavailable — keep in-memory */
      }
    },
    [projectId]
  )

  // The splitter sits before the resized pane, so growing the pane = -delta.
  const resizeRight = useCallback((delta: number) => {
    setLayout((p) => ({ ...p, rightWidth: clamp(p.rightWidth - delta, RIGHT_MIN, RIGHT_MAX) }))
  }, [])

  const resizeBottom = useCallback((delta: number) => {
    setLayout((p) => ({ ...p, bottomHeight: clamp(p.bottomHeight - delta, BOTTOM_MIN, bottomMax()) }))
  }, [])

  // Persist on drag-end only (avoid a localStorage write per pointer move).
  const commit = useCallback(() => {
    setLayout((p) => {
      persist(p)
      return p
    })
  }, [persist])

  const toggleRight = useCallback(() => {
    setLayout((p) => {
      const next = { ...p, rightCollapsed: !p.rightCollapsed }
      persist(next)
      return next
    })
  }, [persist])

  const toggleBottom = useCallback(() => {
    setLayout((p) => {
      const next = { ...p, bottomCollapsed: !p.bottomCollapsed }
      persist(next)
      return next
    })
  }, [persist])

  const toggleSide = useCallback(() => {
    setLayout((p) => {
      const next: Layout = { ...p, panelSide: p.panelSide === 'left' ? 'right' : 'left' }
      persist(next)
      return next
    })
  }, [persist])

  const toggleBottomSide = useCallback(() => {
    setLayout((p) => {
      const next: Layout = { ...p, bottomSide: p.bottomSide === 'top' ? 'bottom' : 'top' }
      persist(next)
      return next
    })
  }, [persist])

  return {
    ...layout,
    resizeRight,
    resizeBottom,
    commit,
    toggleRight,
    toggleBottom,
    toggleSide,
    toggleBottomSide
  }
}
