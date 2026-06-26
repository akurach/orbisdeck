# Global Claude context map — design

## Problem
The Global Claude modal (where the user actually looks) is flat read-only dumps
(Settings/Permissions/Hooks/MCP/Commands/CLAUDE.md). It shows no *взаимосвязь* — what assembles
from what, global vs project, what the project overrides. The earlier read-only inspector was
buried in a project right-panel sub-tab and went unseen.

## Goal
Make the **landing screen of the Global Claude modal** a **force-directed graph** of the whole
context "under the hood": CLAUDE.md (+@imports), settings, permissions, hooks, MCP, skills,
agents, commands. **Global and project clearly SEPARATED**; project nodes annotated with the
**delta vs global** (added / override). Clicking a node drills into the existing detail view.

## Data model (shared types)
```
ClaudeNodeKind = 'claudemd'|'import'|'settings'|'permissions'|'hook'|'mcp'|'skill'|'agent'|'command'
ClaudeMapNode  = { id, kind, scope:'global'|'project', label, detail?, delta?:'added'|'override' }
ClaudeMapEdge  = { from, to, kind:'import'|'registers'|'override' }
ClaudeContextMap = { nodes: ClaudeMapNode[], edges: ClaudeMapEdge[] }
```

## Backend — `getClaudeContextMap(projectId)` (claude.rs + lib.rs command)
- **Global nodes** (reuse `claude::global()`): a `claudemd` root + `import` nodes from the global
  CLAUDE.md `@import` chain; `settings`, `permissions`, one node per `hook`/`mcp`/`command`;
  NEW: enumerate `skill` (`~/.claude/skills/*/SKILL.md` or `*.md`) and `agent`
  (`~/.claude/agents/*.md`) — name + first-line/description.
- **Project nodes**: project CLAUDE.md root + its `@import` chain (reuse `claude_chain`); parse
  `<project>/.claude/settings.json` (+`settings.local.json`) with the existing parsers;
  `<project>/.mcp.json`; enumerate `<project>/.claude/{skills,agents,commands}`.
- **Edges**: scope root `claudemd` → each config node (`registers`); `claudemd` → imported file
  (`import`); project node → matching global node (`override`) when they collide by (kind,name).
- **Delta**: a project node is `added` if no global match by (kind, name/key); `override` if a
  global match exists (and, for settings/permissions, the value differs).
- Caps mirror existing readers (size/count). Read-only.

## Frontend — `ClaudeContextGraph.tsx`
- Layout: `d3-force` — `forceSimulation` + `forceLink(edges)` + `forceManyBody` + `forceCollide`
  + **`forceX` keyed by scope** (global pulled left, project pulled right) so the two scopes stay
  visually separated. Run the sim in a `useEffect`, store positions in state.
- Render: SVG. Nodes = circles colored by scope (global = accent/blue, project = green), kind
  shown via a small glyph/letter + label; edges = lines (`override` dashed). Project nodes carry
  a delta badge (`+` added / `Δ` override). Drag nodes (`d3-drag`); pan/zoom via SVG `viewBox`.
- Click a node → callback that opens the matching existing section in `GlobalClaudeModal`
  (settings/permissions/hooks/mcp/commands/claudemd), so the graph is the index and the flat
  sections become the detail layer.
- Mount: a new **"Карта" / "Map"** section in `GlobalClaudeModal`, set as the default landing
  section; the existing flat sections remain reachable (drill-down + their tabs).

## Scope guard (v1)
- Read-only graph; editable layers keep deep-linking to the existing editors.
- skills/agents = name + description only (not a graph of what each internally does).
- Scope separation via `forceX`, not a strict hierarchical layout.
- New dep: `d3-force` (+ `d3-drag`). Renderer-pure (no electron/fs).

## Deferred
- Editing from the graph; per-setting value diff popovers; memory files beyond CLAUDE.md/imports;
  true hierarchical/dagre layout.
