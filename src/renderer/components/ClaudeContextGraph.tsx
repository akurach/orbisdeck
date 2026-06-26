import { useEffect, useRef, useState } from 'react'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY
} from 'd3-force'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import type { ClaudeContextMap, ClaudeMapNode, ProjectId } from '../../shared/types'
import { useT } from '../i18n'

interface Props {
  projectId: ProjectId | null
  /** Drill into a flat detail section when a node is clicked (null = no matching section). */
  onOpenSection: (section: string) => void
}

interface PNode extends ClaudeMapNode {
  x: number
  y: number
}

type SimNode = PNode & SimulationNodeDatum
type SimLink = SimulationLinkDatum<SimNode>

const W = 760
const H = 520

const GLYPH: Record<string, string> = {
  claudemd: '▣',
  import: '@',
  settings: '⚙',
  permissions: '⚷',
  hook: '⚓',
  mcp: '⧉',
  skill: '★',
  agent: '◆',
  command: '/'
}

function sectionFor(kind: string): string | null {
  switch (kind) {
    case 'claudemd':
      return 'claudemd'
    case 'settings':
      return 'settings'
    case 'permissions':
      return 'permissions'
    case 'hook':
      return 'hooks'
    case 'mcp':
      return 'mcp'
    case 'command':
      return 'commands'
    default:
      return null
  }
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

export function ClaudeContextGraph({ projectId, onOpenSection }: Props): JSX.Element {
  const t = useT()
  const [map, setMap] = useState<ClaudeContextMap | null>(null)
  const [nodes, setNodes] = useState<PNode[]>([])
  const [view, setView] = useState({ tx: 0, ty: 0, k: 1 })
  // pointer interaction: dragging a node, or panning the canvas
  const drag = useRef<{ id: string | null; moved: boolean; lastX: number; lastY: number } | null>(null)

  useEffect(() => {
    let alive = true
    window.cockpit.getClaudeContextMap(projectId ?? '').then((m) => {
      if (alive) setMap(m)
    })
    return () => {
      alive = false
    }
  }, [projectId])

  // Settle a force layout synchronously; keep global pulled left, project right.
  useEffect(() => {
    if (!map) return
    const sim: SimNode[] = map.nodes.map((n) => ({
      ...n,
      x: n.scope === 'global' ? W * 0.3 : W * 0.7,
      y: H / 2
    }))
    const links: SimLink[] = map.edges.map((e) => ({ source: e.from, target: e.to }))
    const s = forceSimulation<SimNode>(sim)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(72)
          .strength(0.35)
      )
      .force('charge', forceManyBody<SimNode>().strength(-280))
      .force('collide', forceCollide<SimNode>(36))
      .force('x', forceX<SimNode>((d) => (d.scope === 'global' ? W * 0.27 : W * 0.73)).strength(0.2))
      .force('y', forceY<SimNode>(H / 2).strength(0.06))
      .stop()
    for (let i = 0; i < 340; i++) s.tick()
    setNodes(sim.map((n) => ({ ...n, x: clamp(n.x, 40, W - 40), y: clamp(n.y, 40, H - 40) })))
    setView({ tx: 0, ty: 0, k: 1 })
  }, [map])

  const onPointerDownNode = (e: React.PointerEvent, id: string): void => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { id, moved: false, lastX: e.clientX, lastY: e.clientY }
  }
  const onPointerDownBg = (e: React.PointerEvent): void => {
    drag.current = { id: null, moved: false, lastX: e.clientX, lastY: e.clientY }
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.lastX
    const dy = e.clientY - d.lastY
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true
    d.lastX = e.clientX
    d.lastY = e.clientY
    if (d.id) {
      setNodes((prev) =>
        prev.map((n) => (n.id === d.id ? { ...n, x: n.x + dx / view.k, y: n.y + dy / view.k } : n))
      )
    } else {
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }))
    }
  }
  const onPointerUp = (id?: string): void => {
    const d = drag.current
    drag.current = null
    if (id && d && !d.moved) {
      const node = nodes.find((n) => n.id === id)
      const sec = node && sectionFor(node.kind)
      if (sec) onOpenSection(sec)
    }
  }
  const onWheel = (e: React.WheelEvent): void => {
    const k = clamp(view.k * (e.deltaY < 0 ? 1.1 : 0.9), 0.4, 2.5)
    setView((v) => ({ ...v, k }))
  }

  if (!map) return <div className="viewer-empty">{t('common.loading')}</div>

  const pos = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div className="ctx-graph">
      <div className="ctx-graph-legend">
        <span className="ctx-leg global">{t('map.global')}</span>
        <span className="ctx-leg project">{t('map.project')}</span>
        <span className="ctx-leg-delta">+ {t('map.added')}</span>
        <span className="ctx-leg-delta">Δ {t('map.override')}</span>
        <span className="ctx-graph-hint">{t('map.hint')}</span>
      </div>
      <svg
        className="ctx-graph-svg"
        viewBox={`0 0 ${W} ${H}`}
        onPointerDown={onPointerDownBg}
        onPointerMove={onPointerMove}
        onPointerUp={() => onPointerUp()}
        onWheel={onWheel}
      >
        <line className="ctx-divider" x1={W / 2} y1={8} x2={W / 2} y2={H - 8} />
        <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
          {map.edges.map((e, i) => {
            const a = pos.get(e.from)
            const b = pos.get(e.to)
            if (!a || !b) return null
            return (
              <line
                key={i}
                className={`ctx-edge ${e.kind}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
              />
            )
          })}
          {nodes.map((n) => (
            <g
              key={n.id}
              className={`ctx-node scope-${n.scope} ${sectionFor(n.kind) ? 'clickable' : ''}`}
              transform={`translate(${n.x},${n.y})`}
              onPointerDown={(e) => onPointerDownNode(e, n.id)}
              onPointerUp={() => onPointerUp(n.id)}
            >
              <circle className="ctx-node-dot" r={n.kind === 'claudemd' ? 22 : 17} />
              <text className="ctx-node-glyph" dy="0.32em">
                {GLYPH[n.kind] ?? '•'}
              </text>
              {n.delta && (
                <text className="ctx-node-delta" x={n.kind === 'claudemd' ? 20 : 15} y={-12}>
                  {n.delta === 'override' ? 'Δ' : '+'}
                </text>
              )}
              <text className="ctx-node-label" y={(n.kind === 'claudemd' ? 22 : 17) + 13}>
                {n.label}
                {n.detail ? ` ${n.detail}` : ''}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
