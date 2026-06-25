# AI Project Cockpit — Roadmap

> Council-derived plan (CPO · CTO · Engineer · Executive · Chief of Staff).
> Mockup (`cockpit.png` reference) is the **visual target**, NOT the v1 backlog.
> Build the value layer, not the panel grid.

## Core decision

**The product is a terminal multiplexer with project memory + Claude-config awareness.**
The embedded persistent terminal IS the spine — not a read-only dashboard. One job:
*run multiple Claude Code sessions across projects in one window, never lose them.*

The whole project lives or dies on one fact, proven in week one: **does node-pty build,
package, and resize cleanly?** Everything else is "just more panels."

---

## Milestones

> **Status: M0 + M1 + M2 SHIPPED.** Build/typecheck/lint green; node-pty proven under
> Electron's ABI; full IPC→pty→data round-trip passes via `scripts/e2e.mjs` (E2E_OK).
> Next: M3 (git summary + file tree) — gated on daily use.

### M0 — Spike (3–5 days) · GO/NO-GO GATE · ✅ PASSED
The load-bearing risk, isolated. Build *packaged*, not just `dev`.
- electron-vite + `@electron/rebuild`; `node-pty` marked **external**.
- One hardcoded project dir → one xterm (`@xterm/xterm` + `addon-fit`).
- Resize/reflow test. Quit → relaunch.
- Lay the two retrofit-brutal seams now (cheap now, brutal later):
  - **One typed IPC interface.** ESLint `no-restricted-imports` in CI — renderer never
    imports `electron`/`fs`/`node-pty`/`simple-git`/`chokidar`.
  - **Stable project UUID** (not path, not name) as the key for all state; one state store
    (single JSON file given single-user).
- **GATE:** node-pty won't package, or terminal stutters/garbles on resize → **STOP.**
  Fall back to tmux + a status script. Cheap honest answer, not failure.

### M1 — The Shell · ✅ DONE
- Electron main/renderer split + the typed IPC seam from M0.
- Project tabs + add-project; per-project state model keyed on UUID.
- xterm ↔ node-pty bridge, one terminal per project.
- *Unlocks:* a place for panels + the process layer for everything OS-level.

### M2 — Terminal that earns daily use · **REAL v1** · ✅ DONE
- Multiple terminal tabs per project; instant project switch (keep sessions warm).
- Persistence across app restart (plain pty into project dir; **NOT** tmux-managed).
- **Batched/backpressured PTY output from day 1** — coalesce output ~8–16ms, buffer
  hidden tabs, flush on tab activation. Non-negotiable or it stutters at 4+ projects.
- Project settings profile (path + run/test/build cmds) → "add project" is one dialog;
  run/test buttons spawn into a terminal.
- **DAILY-USE GATE:** opened ≥5 days straight as the actual way you run your 4 projects?
  **No → kill it, back to tmux.** Yes → proceed. No M3+ code until this passes.

### M3 — Glanceable context (cheap, high-trust)
- Passive **git summary strip** (simple-git behind `isRepo()`): branch, changed/staged/
  unstaged counts, recent commits. Debounced poll, NOT live-watched.
- File tree (chokidar, aggressive `ignored:` for `.git`/`node_modules`/`dist`) +
  read-only viewer (Shiki). **No** live git badges synced to fs events (melts on big repos).
- Diff view (diff2html), size-capped — refuse to render bodies over N lines, offer
  "open in editor" instead. Handle binary files.

### M4 — Claude-native differentiation
- Global Claude config viewer: `~/.claude/settings.json`, MCP, hooks, permissions,
  custom commands — read-only.
- Per-project CLAUDE.md surfacing.
- *This is what makes it a Claude Code cockpit, not just a terminal multiplexer.*

### M5 — Agents (ONLY if a real signal source exists)
- Revisit only via CTO's Option B: agents = **cockpit-spawned supervised processes**, so
  PID/cwd/start/exit are *facts*. "Waiting"/"recent messages" stay best-effort heuristics
  (idle = no output N seconds; messages = last K ANSI-stripped lines).
- **Never** a TUI-scraper that parses Claude Code's screen output as source of truth.

---

## What we deliberately won't do

- No read-only-only dashboard (dodges the core risk, ships a launcher).
- No Agents panel until a real signal source — it can't be populated honestly (mockup hero shot, a trap).
- No tmux session management / reattach selector in v1 — plain pty into project dir.
- No "agent tabs" — they're just terminals.
- No Preview, Notes, fancy syntax highlighting in v1.
- No generic multi-backend / Electron→Tauri abstraction. **node-pty has no Tauri equivalent** —
  the native layer (PTY/watch/git/spawn) is a Rust rewrite, not a swap. Portability protects
  only the React renderer. One interface, one impl, one lint rule.
- No live git badges on the file tree synced to chokidar.
- No full-mockup build (3–6 months vs a single user with 4 real projects elsewhere = abandonment).

---

## Design direction (from the mockup)

Dark, calm, dense-but-quiet IDE shell. The terminal is the hero; panels are quiet context.

**Layout** — 3 zones: top project-tab bar (+ Settings / Global Claude top-right) ·
center terminal (dominant, ~55% width) · right context panel (Files/Git/Agents/Settings
tabs) · bottom panel (Preview/Diff/Logs/Notes). Resizable splits.

**Palette** — near-black base (`#0d1117`-ish), subtle elevated panels, hairline borders
(`#ffffff` @ ~8%). One accent (the active-tab blue). Git/status semantics: green=added/
running, yellow=modified/waiting, red=deleted/failed, muted gray=untracked/finished.
Status dots small, never shouting.

**Type** — UI in a clean sans (Inter/SF). Terminal + code + tree in a mono with good
Cyrillic + ligatures (JetBrains Mono / Berkeley). Tight line-height in tree/lists.

**Density** — IDE-dense, not dashboard-airy. Small row heights, 8px rhythm, icons carry
git state inline (M/A/D badges right-aligned). Panel headers small-caps muted labels.

**Motion** — near-zero. Instant tab switch (no fade). No spinners on the terminal.
Restraint signals "tool," not "app."

> Read `~/.claude/design-principles.md` before any visual work; the 🎨 Designer agent owns
> the detailed pass once M1 has a real shell to dress.
