import { useState } from 'react'

// Collapsible JSON viewer/editor — turns a settings.json blob into a navigable tree
// of fields. In editable mode each scalar leaf becomes an input (text/number/checkbox)
// and edits are reported by path so the parent can rebuild the object.

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type Path = (string | number)[]

function isContainer(v: Json): v is Json[] | { [k: string]: Json } {
  return v !== null && typeof v === 'object'
}

function Leaf({
  value,
  path,
  editable,
  onEdit
}: {
  value: Json
  path: Path
  editable: boolean
  onEdit?: (path: Path, value: Json) => void
}): JSX.Element {
  if (editable && onEdit && typeof value === 'boolean') {
    return (
      <input
        type="checkbox"
        className="json-edit-bool"
        checked={value}
        onChange={(e) => onEdit(path, e.target.checked)}
      />
    )
  }
  if (editable && onEdit && (typeof value === 'string' || typeof value === 'number')) {
    const isNum = typeof value === 'number'
    return (
      <input
        className={`json-edit ${isNum ? 'json-num' : 'json-str'}`}
        value={String(value)}
        size={Math.max(4, String(value).length)}
        onChange={(e) => {
          const v = e.target.value
          onEdit(path, isNum && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : v)
        }}
      />
    )
  }
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

function Node({
  name,
  value,
  depth,
  path,
  editable,
  onEdit
}: {
  name?: string
  value: Json
  depth: number
  path: Path
  editable: boolean
  onEdit?: (path: Path, value: Json) => void
}): JSX.Element {
  const [open, setOpen] = useState(depth < 1)

  if (!isContainer(value)) {
    return (
      <div className="json-row" style={{ paddingLeft: depth * 14 }}>
        {name !== undefined && <span className="json-key">{name}: </span>}
        <Leaf value={value} path={path} editable={editable} onEdit={onEdit} />
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
        entries.map(([k, v]) => (
          <Node
            key={k}
            name={k}
            value={v}
            depth={depth + 1}
            path={[...path, Array.isArray(value) ? Number(k) : k]}
            editable={editable}
            onEdit={onEdit}
          />
        ))}
    </div>
  )
}

export function JsonTree({
  json,
  editable = false,
  onEdit
}: {
  json: Json
  editable?: boolean
  onEdit?: (path: Path, value: Json) => void
}): JSX.Element {
  return (
    <div className="json-tree">
      <Node value={json} depth={0} path={[]} editable={editable} onEdit={onEdit} />
    </div>
  )
}

/** Immutably set a value at a path inside a JSON object/array. */
export function setAtPath(root: Json, path: Path, value: Json): Json {
  if (path.length === 0) return value
  const [head, ...rest] = path
  if (Array.isArray(root)) {
    const copy = root.slice()
    copy[head as number] = setAtPath(copy[head as number] ?? null, rest, value)
    return copy
  }
  const obj = (root && typeof root === 'object' ? root : {}) as { [k: string]: Json }
  return { ...obj, [head as string]: setAtPath(obj[head as string] ?? null, rest, value) }
}
