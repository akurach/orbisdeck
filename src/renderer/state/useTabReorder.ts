import { useRef } from 'react'
import type { DragEvent } from 'react'

/** Move an item within an array (returns a new array). */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** HTML5 drag-and-drop reordering for a horizontal tab strip. Returns a props
 *  factory: spread `drag(index)` onto each tab element. */
export function useTabReorder(onReorder: (from: number, to: number) => void): (index: number) => {
  draggable: true
  onDragStart: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
} {
  const from = useRef<number | null>(null)
  return (index: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      from.current = index
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      if (from.current !== null && from.current !== index) onReorder(from.current, index)
      from.current = null
    }
  })
}
