import { useRef, type PointerEvent } from 'react'

interface Props {
  /** 'vertical' = a tall bar dragged horizontally (resizes neighbour width);
   *  'horizontal' = a wide bar dragged vertically (resizes neighbour height). */
  orientation: 'vertical' | 'horizontal'
  /** Pointer delta in px since the last move (+x / +y). Parent applies + clamps. */
  onResize: (delta: number) => void
  /** Fired once on drag end — parent persists the committed size here. */
  onResizeEnd?: () => void
  ariaLabel?: string
}

export function Splitter({ orientation, onResize, onResizeEnd, ariaLabel }: Props): JSX.Element {
  const dragging = useRef(false)
  const last = useRef(0)

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    e.preventDefault()
    dragging.current = true
    last.current = orientation === 'vertical' ? e.clientX : e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>): void {
    if (!dragging.current) return
    const pos = orientation === 'vertical' ? e.clientX : e.clientY
    const delta = pos - last.current
    if (delta !== 0) {
      last.current = pos
      onResize(delta)
    }
  }

  function endDrag(e: PointerEvent<HTMLDivElement>): void {
    if (!dragging.current) return
    dragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    onResizeEnd?.()
  }

  return (
    <div
      className={`splitter splitter-${orientation}`}
      role="separator"
      aria-orientation={orientation === 'vertical' ? 'vertical' : 'horizontal'}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  )
}
