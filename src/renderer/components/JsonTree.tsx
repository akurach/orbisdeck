import { useState } from 'react'

// Collapsible JSON viewer — turns a settings.json blob into a navigable tree
// instead of one flat highlighted wall. Read-only.

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

function isContainer(v: Json): v is Json[] | { [k: string]: Json } {
  return v !== null && typeof v === 'object'
}

function Leaf({ value }: { value: Json }): JSX.Element {
  const cls =
    typeof value === 'string'
      ? 'json-str'
      : typeof value === 'number'
        ? 'json-num'
        : typeof value === 'boolean'
          ? 'json-bool'
          : 'json-null'
  const text = typeof value === 'string' ? `"${value}"` : String(value)
  return <span className={cls}>{text}</span>
}

function Node({ name, value, depth }: { name?: string; value: Json; depth: number }): JSX.Element {
  const [open, setOpen] = useState(depth < 1)

  if (!isContainer(value)) {
    return (
      <div className="json-row" style={{ paddingLeft: depth * 14 }}>
        {name !== undefined && <span className="json-key">{name}: </span>}
        <Leaf value={value} />
      </div>
    )
  }

  const entries: [string, Json][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value)
  const summary = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`

  return (
    <div className="json-node">
      <div
        className="json-row json-toggle"
        style={{ paddingLeft: depth * 14 }}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="json-caret">{open ? '▾' : '▸'}</span>
        {name !== undefined && <span className="json-key">{name}</span>}
        {!open && <span className="json-summary"> {summary}</span>}
      </div>
      {open &&
        entries.map(([k, v]) => <Node key={k} name={k} value={v} depth={depth + 1} />)}
    </div>
  )
}

export function JsonTree({ json }: { json: Json }): JSX.Element {
  return (
    <div className="json-tree">
      <Node value={json} depth={0} />
    </div>
  )
}
