# OrbisDeck — Roadmap

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

> **Status: M0 + M1 + M2 + M3 + M4 SHIPPED.** Build/typecheck/lint green; node-pty proven
> under Electron's ABI; IPC→pty→data round-trip passes (`scripts/e2e.mjs` → E2E_OK);
> git summary + file tree + viewer + diff verified live (`scripts/e2e-m3.mjs` → M3_OK);
> global Claude config viewer + per-project CLAUDE.md verified live (`scripts/e2e-m4.mjs`
> → M4_OK). Next: M5 (Agents) — ONLY if a real signal source exists.

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

### M3 — Glanceable context (cheap, high-trust) · ✅ DONE
- Passive **git summary strip** (simple-git behind `isRepo()`): branch, changed/staged/
  unstaged counts, recent commits. Debounced poll, NOT live-watched.
- File tree (chokidar, aggressive `ignored:` for `.git`/`node_modules`/`dist`) +
  read-only viewer (Shiki). **No** live git badges synced to fs events (melts on big repos).
- Diff view (diff2html), size-capped — refuse to render bodies over N lines, offer
  "open in editor" instead. Handle binary files.

### M4 — Claude-native differentiation · ✅ DONE
- Global Claude config viewer: `~/.claude/settings.json` (+ `settings.local.json`), MCP,
  hooks, permissions, custom commands, global CLAUDE.md — read-only. Opened from the
  top-right "Global Claude" button; `readClaudeFile` sandboxed to `~/.claude`.
- Per-project CLAUDE.md surfacing — right-panel "Claude" tab, read via the project's
  `claudeMdPath` settings profile through the existing sandboxed `readFile` seam.
- *This is what makes it a Claude Code cockpit, not just a terminal multiplexer.*

### M5 — Beyond the shell · ✅ baseline shipped

The former parking lot, promoted to a committed milestone. Each feature passes the product
test: *orchestrate an existing local tool, don't reimplement it.* All six groups now have a
shipped baseline (marked ✅ below); the deferred extensions noted per-group are the remaining
tail. Built foundation-first: layout → settings → viewer → Docker → CLAUDE.md elements →
Agents.

**Resizable panels & dynamic layouts** — *(the explicit ask: be able to resize the panes.)*
- **Baseline — resizable splits. ✅ DONE.** Drag-resizable dividers between the 3 zones
  (terminal / right panel / bottom panel) with min/max clamps so nothing collapses to
  unusable; the terminal auto-refits (existing ResizeObserver). Sizes persist per project in
  localStorage and restore on relaunch. (`Splitter.tsx`, `state/useLayout.ts`.)
- **Then — dynamic panels. ✅ DONE (show/hide).** Right & bottom panels collapse to a slim
  restore rail and back, via a header chevron; collapsed state persists per project in
  `useLayout`. Reorder / re-dock / pop-out / tab-stacking remain future (the "maybe" tier).
- **Hard constraint:** stays inside the design system — snap to the 8px rhythm, hairline
  borders, near-zero motion, no free-floating chaos. Not a blank canvas; a small set of
  *sanctioned* arrangements + show/hide, so any state still looks like the mockup. Decide
  build-vs-buy on a docking lib (dockview/rc-dock) vs a constrained hand-rolled grid — most
  are dashboard-airy and fight the IDE-dense aesthetic; lean hand-rolled. The 🎨 Designer
  agent owns the sanctioned-layouts set.

**Smarter project settings** — three threads on the `ProjectSettings` profile
(`src/shared/types.ts`), today all hand-typed:
- *Auto-detect on add.* **✅ DONE.** On folder pick, `detectProjectSettings` (`main/detect.ts`)
  scans for `package.json` scripts (manager from the lockfile: pnpm/yarn/bun/npm), `Makefile`
  targets, `Cargo.toml`, `go.mod`, `pyproject.toml`/`setup.py`, plus `CLAUDE.md` & `docs/`.
  The Add-project modal shows the detections and pre-fills `run`/`test`/`build` as editable
  defaults (never forced; editable later in Settings).
- *Richer profile.* **✅ DONE (env + subdir).** `ProjectSettings.env` (KEY=VALUE lines, parsed
  in `ipc.ts` and merged into every terminal's env) and `cwdSubdir` (terminals start there).
  Multiple named run targets / pre-launch hooks remain future. Still a profile, not a build
  system.
- *Auto-launch on open.* **✅ DONE.** `ProjectSettings.autoLaunchCommand` (default `claude`,
  empty = plain shell). On open with no live terminals, TerminalPanel spawns it via the login
  shell (PATH resolves); editable/opt-out in the Settings panel. Persists in the project store.

**Better file viewer — images + rendered markdown** — extends the M3 read-only viewer
(today: text-only via highlight.js, binaries refused, `.md` shown as source).
- *Image preview.* **✅ DONE.** `png/jpg/jpeg/gif/webp/bmp/ico/svg` render inline (8 MB cap →
  "too large" message above it). Main `readFile` returns a base64 `data:` URL on the existing
  capped seam; CSP already allows `img-src data:`. No editing.
- *Markdown dual-mode.* **✅ DONE.** Toggle on `.md`: **Просмотр** (rendered) ↔ **Код**.
  `marked` → `DOMPurify.sanitize` (scripts/handlers stripped); links open in the external
  browser via the main window-open handler. Default = rendered.

**Project Docker management** — **✅ DONE (compose-scoped MVP).** `main/docker.ts` shells out to
the `docker` CLI behind the service seam (like `git.ts`). A "Docker" right-panel tab polls
`docker compose ps --format json` (status = fact); Up (`up -d`) / Restart / Down run via an
exec IPC, and "Логи" tails `compose logs`. Panel only acts when a compose file
(`docker-compose.yml`/`compose.yaml`/`compose.yml`) exists; missing CLI / errors are reported
states, never throws. **Not** a Docker Desktop clone (no image building, registry, volumes).
Future: live log streaming into a terminal, per-service actions.

**CLAUDE.md as managed elements** — **✅ DONE (non-destructive view).** The Claude tab now has
an **Элементы / Текст** toggle; "Элементы" parses the project CLAUDE.md by heading into
collapsible read-only cards (preamble + each `#…` section), indented by level. This is the
non-destructive *view as elements* step the plan called for. Future (deferred until round-trip
is proven safe): enable/disable toggles, editing the skill/agent/hook/MCP registrations, and
write-back through the sandboxed seam.

**Agents (cockpit-spawned supervised processes)** — **✅ DONE (facts-only).** The Agents tab
lists this project's cockpit-spawned terminals with only facts from node-pty: title, command,
**PID**, cwd, elapsed since start, and Running/Finished from the live `alive` flag (polled +
refreshed on the exit event). No "waiting"/message heuristics, no TUI-scraping — exactly the
CTO's Option B. `TerminalInfo.pid` was added to carry the fact. Future: idle/“waiting”
heuristic and recent-output preview if a trustworthy signal emerges.

---

### M6 — Make it usable (post-dogfood feedback)

Requests from real use; ordered roughly by value/effort.

- **Bottom panel: Logs + Notes are stubs.** *Notes* — per-project free-text notes, editable,
  persisted in the store (cheap, do first). *Logs* — decide what it shows (app/main-process
  log? the active terminal's captured output? run/test/build history?) before building.
- **Project Settings clarity.** Each field needs an inline description of what it does
  (run/test/build/docs/CLAUDE.md/autoLaunch/env/cwdSubdir); the panel reads as a bare form
  today. Possibly group + add examples.
- **Global Claude `settings.json` — editable, not a blob.** Currently a read-only JSON tree.
  Parse the known keys into real controls (toggles, inputs, dropdowns) with labels/help, and
  write back through a sandboxed writer (atomic + backup, like the hooks installer). Unknown
  keys fall back to raw JSON. This is the real ask behind "сделай нормальные настройки".
- **Permissions — explain + manage.** Show allow/ask/deny with a plain-language explainer of
  what each means; ideally add/remove rules with validation (not just view).
- **Hooks — readable view.** Present hooks (event → matcher → commands) in a clean, grouped,
  human layout instead of the current flat list; explain each event.
- **Notification when a terminal awaits input.** Detect when the active claude/terminal is
  waiting for the user (idle after a prompt / known "waiting" output) and surface a desktop
  notification + a tab badge. Hard part: a *reliable* "is waiting" signal without TUI
  scraping — candidates: pty idle (no output for N s after a write), or a Notification/Stop
  hook. Prefer the hook path (we already install hooks).

---

### M7 — Tauri-native + polish (make it shippable)

Full Tauri backend is ported (branch `spike/tauri`). M7 makes it the product.

- **Make Tauri the only app; delete Electron.** Switch `dev`/`build`/`dist` to Tauri; remove
  `electron`, `electron-vite`, `electron-builder`, `src/main/`, `src/preload/`, native rebuild
  scripts and electron e2e. Move renderer tooling to plain `vite`. Keep `shared/` (the seam
  contract + types) and `src/renderer/`.
- **Repo hygiene — root is a mess.** Move branding (`orbisdeck_logo.png`, `orbisdeck_banner.png`)
  into `assets/`/`branding/`; keep README banner links working. Ensure `*.tsbuildinfo` is
  gitignored and untracked. General tidy of root.
- **Package for easy launch.** `cargo tauri build` → `.app`/`.dmg`; proper icon set, app
  metadata, a one-command run.
- **i18n RU + EN.** Today strings are mixed. Add a real i18n layer (dictionary + `t()`), a
  language toggle in settings, consistent coverage. Default by system locale.
- **About OrbisDeck.** macOS About shows the wrong name casing and a *folder* glyph instead of
  the icon. Fix `productName` to "OrbisDeck" and wire the real app icon into the About panel.
- **In-app settings — accent color.** Not light theme yet: let the user change the accent
  (active-tab blue) — a color picker / preset swatches, persisted, applied via a CSS variable.
- **Global Claude settings = a real generated form.** Replace the editable JSON tree with a
  classic settings form: typed controls per known key (e.g. `model` → dropdown of available
  models, booleans → toggles, numbers → steppers), labels + help; unknown keys fall back to
  raw. Write-back already exists.
- **Terminal encoding/emoji.** The pty statusline shows `??` for emoji/glyphs — xterm font
  lacks them. Add an emoji-capable font fallback (and verify UTF-8 end-to-end).

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

**Consistency (requirement, not nice-to-have)** — one shared size scale, no ad-hoc values.
Buttons, headers, inputs, tabs, panel chrome, icons, row heights all draw from a single set
of design tokens (height/padding/font-size/radius steps on the 8px rhythm). Same element
type = identical size everywhere; a button in Settings matches a button in the toolbar. No
one-off `px` in components — tokens only. The 🎨 Designer agent defines the scale; treat a
drift as a bug.

> Read `~/.claude/design-principles.md` before any visual work; the 🎨 Designer agent owns
> the detailed pass once M1 has a real shell to dress.
