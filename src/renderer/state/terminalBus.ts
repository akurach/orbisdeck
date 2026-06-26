// Tiny renderer-only event bus to request a terminal spawn from any panel without
// lifting TerminalPanel's local tab state. A panel (e.g. Docker) calls requestSpawn();
// the live TerminalPanel for that project subscribes and spawns the tab locally, so its
// tab list stays the single owner of terminal state and there are no re-list races.

import type { ProjectId } from '../../shared/types'

export interface SpawnRequest {
  projectId: ProjectId
  title?: string
  command?: string
}

type Handler = (req: SpawnRequest) => void

const handlers = new Set<Handler>()

/** Ask the (currently mounted) TerminalPanel for `projectId` to open a new terminal tab. */
export function requestSpawn(req: SpawnRequest): void {
  for (const h of handlers) h(req)
}

/** Subscribe to spawn requests. Returns an unsubscribe fn. */
export function onSpawnRequest(handler: Handler): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}
