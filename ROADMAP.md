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
  **Multiple named run targets + pre-launch hooks — ✅ DONE:** `ProjectSettings.runTargets`
  (`{name, command, preLaunch?}`), each a button by Run/Tests/Build; `preLaunch` chained with
  `&&`. Editor in `SettingsPanel`. Still a profile, not a build system.
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
**Live log streaming — ✅ DONE:** the log buttons spawn a terminal tab running
`docker compose logs -f [service]` (via the `state/terminalBus.ts` spawn bus); the one-shot
`LogsModal` + `getDockerLogs` seam were removed. Future: per-service start/stop already shipped.

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
- **Notification when a terminal awaits input — ✅ DONE (native, hook path).** The
  `Notification` hook writes `~/.claude/orbisdeck/notify.jsonl`; the `lib.rs` poll raises a
  native OS notification (`tauri-plugin-notification`), suppressed when that project is already
  focused+active. Clicking it activates the window → the `on_window_event` focus handler emits
  `notify-activate` (TTL 20s) → the renderer jumps to that project (`setActiveProject`). The tab
  badge is the in-app counterpart. Chose the honest hook signal over pty-idle scraping.
- **Claude context inspector — ✅ DONE (read-only).** A "Контекст" view in the Claude tab
  (`ClaudeContext.tsx`) showing the full assembled context chain: global `~/.claude/CLAUDE.md`
  → project CLAUDE.md + resolved `@import` tree (backend `getClaudeChain`, cycle-guarded, capped)
  → settings/permissions/hooks/MCP/commands summary. Editable layers deep-link to the existing
  Global Claude editor; the rest is read-only. (Grew out of the old "CLAUDE.md as managed
  elements" tail; write-back editing of elements remains future.)

---

### M7 — Tauri-native + polish (make it shippable) — ✅ shipped

Full Tauri backend was ported; M7 made it the product. All eight items landed:

- ✅ **Make Tauri the only app; delete Electron.** `dev`/`build`/`dist` run Tauri; Electron,
  electron-vite/builder, `src/main/`, `src/preload/` and native rebuild scripts removed.
  Renderer tooling is plain `vite`; `shared/` (seam contract) + `src/renderer/` kept.
- ✅ **Repo hygiene.** Branding lives in `assets/` (README banner intact); `*.tsbuildinfo`
  gitignored + untracked; root tidied.
- ✅ **Package for easy launch.** `npm run build` (`tauri build`) → `.app` + `.dmg`; full icon
  set regenerated from the square mark via `tauri icon`; bundle category + descriptions set.
- ✅ **i18n RU + EN.** `src/renderer/i18n` — `LocaleProvider` + `useT()` + flat ru/en tables
  (180 keys, lockstep); language toggle in App Settings; default from system locale. All 18
  renderer components swept — no hardcoded Cyrillic left.
- ✅ **About OrbisDeck.** `productName` "OrbisDeck"; real multi-res `.icns` (fixes the About
  folder glyph); About block (name/version/tagline) in the App Settings modal.
- ✅ **In-app settings — accent color.** App Settings modal: preset swatches + custom picker,
  persisted in localStorage, applied via the `--accent` CSS variable before first paint.
- ✅ **Global Claude settings = a real generated form.** `ClaudeSettingsForm` — typed controls
  per known key (model dropdown, toggles, steppers, text); unknown keys → raw JSON tree; Raw
  mode shows the verbatim file. Sandboxed write-back unchanged.
- ✅ **Terminal encoding/emoji.** Emoji-capable font fallback added; UTF-8 verified end-to-end.

---

### Post-M7 posture (council decision) — audience = 1

> Convened the full council (CPO · CTO · Engineer · User Researcher · Executive) after the
> v1 roadmap closed. Near-unanimous. Recorded so it doesn't drift.

**Posture: audience = 1. STABILIZE + exactly one DEEPEN bet — a cross-project _attention
router_ ("which session is waiting on me"). BROADEN (distribution / notarize / auto-update)
is frozen until a real second user asks.**

Why: the single unique value of a cockpit over many projects is routing attention back to the
session that's blocked on you (dead time while you're heads-down in another project). Everything
else is pleasant sugar over tmux. The honest signal **already flows** — the `Notification` hook
writes `~/.claude/orbisdeck/notify.jsonl`; today it only fires an OS notification. The build is
mostly wiring data that already exists, not a new agent system.

### Council round 2 (post-v0.7.0) — code-grounded audit

> Reconvened the council with the specialists READING THE REAL CODE, not just the brief.
> Two corrections to round 1 + a P0 bug list + refined M8 split.

**Correction that matters most (Engineer, verified in `agents.rs`):** the round-1 assumption
"`PreToolUse`/`Notification`/`SubagentStop` already flow, build a 3-state machine on them" is
**half-wrong**. Only `Notification` (→ waiting) flows honestly. `PreToolUse` is installed with
matcher `Task|Agent` (subagents only) — there is NO general "Claude is working" signal, and no
`Stop`/`UserPromptSubmit`/`SessionEnd`. An honest `working`/`idle` cannot be derived from current
events. Do NOT fake `working` from `pgrep`/pty activity — that is the forbidden invented signal.
Fix is cheap and honest: add a few hooks.

**P0 bugs to fix regardless of M8 (CTO + Engineer, with file refs):**
- **Unbounded hook logs + full reread.** `~/.claude/orbisdeck/agents.jsonl`/`notify.jsonl` only
  ever `appendFileSync` (no rotation); `read_events` / `read_notifications_since` do
  `fs::read_to_string` of the WHOLE file every 1.5s (notify poller) / 2s (agents panel). Becomes
  a scaling wall and the hot path under M8. Fix: tail-capped reads (like the transcript
  `READ_CAP`) + size-based rotation/compaction. **(P0 — do first.)**
- **FIFO correlation ignores `session_id`.** `read_events` pairs stop→oldest-open via
  `open.remove(0)` though the hook already writes `session_id`. Use it.
- **Silent `persist` failure** (`store.rs` `let _ = …`) — a command center can't silently fail to
  save state. Log + surface.
- **`claude_chain` is the one un-sandboxed reader** — follows `@import` to any path on disk.
  Align to the project-root ∪ `~/.claude` sandbox the other readers use.
- Nested-project prefix match (`cwd.starts_with("{path}/")`) zings the parent too → longest-prefix.

### M8 — Cross-project attention router · ✅ M8.0 + M8.1 SHIPPED

> The Executive gate (a week of counting the pain first) was **skipped by user call** — built
> both slices directly. The honest metric still applies in use: if the colored status rarely
> moves / you don't act on it, name the parallelism thesis as weaker than hoped and freeze.

- **M8.0 — ✅ DONE.** The already-honest `notify.jsonl` waiting signal is now a **persistent
  per-project badge** (stays until the project is focused) and is **seeded on app start**
  (`get_waiting_projects`, read off the capped `notify.jsonl` tail) so a project that was
  waiting before launch still shows. Paired with the **P0 tail-cap fix** (`read_log_capped` —
  256 KB tail + in-place rotation at 1 MB; both hook-log readers use it).
- **M8.1 — ✅ DONE.** Honest `working`/`idle` added: hooks `UserPromptSubmit`→busy,
  `Stop`/`SessionEnd`→idle write to a NEW `state.jsonl` (`agents.jsonl` untouched).
  **Edge-triggered** — working lives between a prompt and the stop, so no per-tool `node`
  spawns and no time-based guessing; a 30-min **staleness backstop** downgrades a crashed
  `working` (no Stop) to idle. `status()`/`install()`/`uninstall()` updated for the new events;
  `upgrade_hooks_if_present()` runs on startup so existing users get them without a re-prompt.
  Backend `latest_cwd_states()` merges `state.jsonl` + `notify.jsonl` (newest per cwd wins);
  `get_project_states` maps cwd→project by **longest-prefix** (nested project wins) and reduces
  per project. Renderer polls every 2s (subsumes the M8.0 seed), `onNotify` flips waiting
  instantly, focusing a waiting project clears it. **Colored status dot on each tab** —
  yellow=waiting, green=working, none=idle. Never fakes `working` from `pgrep`/pty.
- **Deferred tail:** retiring the (now-redundant) facts-only Agents panel in favor of this
  status surface; a jump-to-longest-waiting hotkey; the dedicated `runstore.rs` module (current
  readers are capped + rotated, which removed the urgency).
- **Honest metric (still live):** does the status move and do you act on it? Replaces the spent
  "5 days straight" gate.

### Other threads (user-directed, round 2) — roadmap, not committed

- **Context graph — KEEP, but reshape (user call).** Don't cut it. Remove the non-actionable
  noise nodes (session start/stop, permissions — "непросматриваемое"); on the other side ADD a
  browsable view of **skills + agents** that exist, with the ability to edit them when needed.
  Shifts the graph from a static `@import` art piece toward an actionable skills/agents surface.
- **$EDITOR bridge (UR's "second silent exit": review→edit→commit).** "Open this file in
  $EDITOR at this line" from diff/tree + a quick stage/commit delegated to the terminal. A
  bridge, NOT an own editor/git client (v1 boundary holds). Roadmap.
- **Inline config editing (user).** Let configs (settings/CLAUDE.md/etc.) be edited inline via
  the existing atomic+backup writer, rather than read-only + deep-link out. Roadmap.

**Triggers that change this:** a concrete second user asks → reconsider BROADEN; blocked 3+×/week
by an unnoticed waiting session → build M8.1; a week of not opening Settings/roadmap to add
anything → it's done, freeze and use it (success, not failure).

### Council round 3 — convenience + visual (10-feature pool)

> Convened the full council (CPO · CTO · Engineer · User Researcher · Executive) + 🎨 Designer
> on "invent 10 features raising convenience + the visual layer." Near-unanimous, and it points
> at the SAME spine as M8: the product's one job is **routing attention across parallel Claude
> sessions**. Everything else is polish over a working shell.

**Selection frame (Executive):** score each candidate `(pain×2) + effort + wow`, then two hard
kill-gates — (1) **focus gate:** does it move toward "command center over projects" or drift into
editor / git-client / agent-orchestrator? Drift = cut regardless of score. (2) **maintenance-tax
gate:** does it bind a fragile dependency on someone else's CLI/format? If so → read-only/best-effort
or cut. Quota: **max 3–4 visual-only**, exactly **1 flagship**. 10 features = a 3-wave backlog, not
one sprint; ship each wave to polish before the next.

**Code-grounded correction (User Researcher, verified):** two signals the UI needs **already exist
and are thrown away** —
- The `Notification` hook already writes the **text** (`message`) into `notify.jsonl`
  (`agents.rs` `read_notifications_since`, ~L475) — "Claude needs permission to use Bash" /
  "waiting for your input". Today it fires a transient OS notification and lives nowhere in-app.
  The tab dot says *waiting* but not *what for*.
- Tab status (`latest_cwd_states`, ~L505) is built **only** on Claude hooks; **run/test/build exit
  codes never reach the tab** — a background build fails and the tab looks identical. node-pty knows
  the exit (`TerminalPanel.tsx`); it just isn't lifted to the tab.

So the cheapest × most-frequent win is not 10 new features — it's **surfacing the `message` already
caught + lifting exit codes to tabs + one jump-to-waiting hotkey.** Build attention as *layers of one
mechanism*, not breadth. UR's warning: value is in ACTION (see → jump → answer); a preview + queue
WITHOUT the hotkey is just another surface to read.

### M9 — Attention surface + navigation polish · roadmap, not committed

Ten features, ranked `(pain×2)+effort+wow`, in 3 waves. Waves 5–7 (attention layers) reuse
data already collected. Cross-cutting prerequisite for all keyboard features (Engineer): build
**one global keydown router** (capture phase, guard on `<input>`/textarea/modal) and reuse it —
xterm.js greedily eats keys, so don't scatter listeners.

**Wave 1 — quick wins (core job, cheap, daily pain) · ✅ SHIPPED.**
Global keydown router landed first (`state/keys.ts` `isTypingTarget` + one capture-phase
listener in `App.tsx`, reused by all keyboard features; xterm's helper-textarea excluded so
shortcuts fire from a focused terminal). typecheck + lint + `build:web` green.
1. **Mission Control — one screen, status of ALL projects** — ✅ `MissionControl.tsx` overlay:
   attention-ranked rows (waiting → working → idle) + branch + dirty count; click to jump.
   Reuses the live `getProjectStates` poll + the new slow git poll; refreshes git on open.
   Reachable via the topbar "Overview" button and the palette. (tests/docker glyphs → W2/W3.)
2. **Status glyphs on tabs** — ✅ (attention + git). The M8.1 waiting/working dot now sits beside
   a git dirty-count glyph (`±N`), fed by a **slow (8s) one-shot cross-project git poll** in
   `App.tsx` — deliberately not the live-watched hot path. tests-failed/docker-down deferred
   (tests-failed rides W2 #8 exit codes; docker-down needs a per-project docker poll → W3).
3. **Cmd+1..9 + Cmd+[ / ] project switch** — ✅ in the global router. Cmd+9 = last; stands down
   while typing in a real field or an overlay is open.
4. **Command palette (Cmd+K)** — ✅ `CommandPalette.tsx`: fuzzy subsequence filter over a
   registry built in `App.tsx` (switch-project / Mission Control / add / Global Claude / settings /
   new terminal / run·tests·build·run-targets via `terminalBus`). Owns its own arrow/enter/esc;
   Cmd+K toggle lives in the global router so it opens from anywhere. Registry is a static list —
   new actions must be registered there (Engineer's rot warning noted inline).

**Wave 2 — attention layers (from already-collected data) · ✅ SHIPPED.**
New backend `get_project_attention` (`agents::latest_cwd_attention` — mirrors `latest_cwd_states`
but carries the waiting `message`; longest-prefix cwd→project in `lib.rs`, kind classified from
the text). Renderer polls it in place of `getProjectStates`. cargo check + 2 lib tests +
typecheck + lint + build:web green.
5. **Last-`message` preview at the tab** — ✅ the `notify.jsonl` `message` (previously written then
   discarded) now rides `get_project_attention` → tab badge `title` shows the actual ask; the full
   text also lands in Mission Control rows. UR's "surface the caught message" fix.
6. **Attention queue + Cmd+↩ "jump to longest-waiting"** — ✅ Cmd+Enter in the global router jumps
   to the oldest-waiting project (`since` asc); Mission Control floats waiting rows to the top in
   the same order — the visible queue. Completes M8's own attention-router goal.
7. **Typed waiting** — ✅ `message` classified permission vs question (backend + a matching
   renderer `classifyWaiting` for the instant onNotify path). Permission badge gets a distinct ring
   (quick reflex) vs a plain waiting dot; labels differ. (completed/needs-input distinct types →
   later; failed is #8.)
8. **Run-target exit codes on the tab** — ✅ the pty reader now captures the **real** exit code
   (`try_wait` without holding the sessions lock; previously hardcoded 0) and the `term-exit` event
   carries `projectId` + `command`. App flags a red badge on a background project's tab when a
   non-zero exit came from a run/test/build/target (not the interactive Claude/shell, not a
   user-killed session — empty projectId). Cleared on focus. Closes the second silent blocker.

**Wave 3 — pickup · ✅ SHIPPED.** cargo check + 5 lib tests + typecheck + lint + build:web green.
9. **Resume-card (Notes)** — ✅ the `busy` hook (UserPromptSubmit) now also captures the prompt
   text (capped 500) into `state.jsonl`; existing users get it via `upgrade_hooks_if_present`.
   Backend `get_last_prompt` (agents::`last_prompt` — newest busy prompt in the project's cwd
   subtree) feeds a read-only "you stopped at: … · Nm" card atop NotesPanel. Not an editor.
10. **Global ripgrep search** — ✅ new `search.rs` (`search_projects` command): shells to `rg`
    per project (fixed-string, smart-case, .gitignore-respecting), hard-capped (12/project, 80
    total), maps abs paths back to project-relative + id; `rg` missing → available:false, not a
    crash. `SearchModal` (Cmd+Shift+F + palette entry) groups hits by project→file; a click jumps
    to the project and opens the file (pending-open survives the activeId reset). **Density toggle**
    — ✅ `state/density.ts` (chrome-only `data-density` twin of accent.ts) + App Settings toggle +
    compact CSS overrides on tabs/tree/lists; terminal deliberately untouched. Full theming stays
    out (xterm/highlight.js own themes; days of hardcoded-color audit).

**M9 review + hardening (council round 4: security · rust · react · silent-failure · design) — ✅ DONE.**
SAST clean (no XSS — all untrusted hook/prompt/search text is JSX-escaped; no injection — rg via
execve not shell). Fixed the shared must-finds:
- **Exit-code sentinel** (rust+silent+react all flagged): the pty give-up path emitted `0`
  (success), silently hiding a failed background run — the exact signal M9 W2 exists for. Now
  inits `-1`, breaks on `try_wait` `Err`, renderer treats non-zero (incl. unknown) as suspect.
- **rg robustness**: a moved/deleted project dir surfaced as NotFound and aborted the whole
  search with a false "rg not found". Now `is_dir` pre-check skips it; `available` set optimistically;
  real rg errors (exit ≥2) logged.
- **Mutex poison consistency**: all `pty.sessions.lock()` sites now recover via `into_inner()`
  (only the exit thread did) — a panic-while-locked no longer cascades to every terminal command.
- **Renderer**: search stale-guard was a no-op → monotonic request-id ref + unmount guard; git
  poll + exit listener no longer tear down on every tab switch (keyed on project-id set, refs for
  live reads); `palette` added to the overlay guard; Mission Control gets Escape + keyboard rows;
  failed dot never sits on the focused tab.
- **Design**: one `--yellow` for all waiting/permission (was 3 yellows); permission = hollow dot,
  no glow (dots must not shout); one status slot per tab, priority failed>waiting>working, `±N`
  only on active/hover; line-number off the accent. Deferred: font-scale tokenization (`--fs-*`),
  rg `--`/timeout, get_last_prompt hooks-installed gate — logged, not blocking.

**Won't-build from this round (focus/maintenance gates):** inline editor / own git-client /
agent auto-spawn orchestration; a full theme builder (max one light preset); cloud sync /
multi-device / theme marketplace; rich agent statuses over an unreliable source (hooks are opt-in) —
only dress the three honest states + a "last event N min ago" staleness stamp.

**Honest metric (carries M8's):** does the status move and do you act on it? If the colored
signal rarely moves or you don't jump on it, the parallelism thesis is weaker than hoped — name
it and freeze, don't keep adding surface.

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
- **(post-M7) No own agent orchestration** — spawning N sessions is cheap, but coordination/
  retry/lifecycle = a second Claude Code and a hard scope break. Fleet-status (read-only) yes;
  orchestration no.
- **(post-M7) No distribution / notarize / auto-update** until a real second user. Auto-update
  especially = signing keys + endpoint + manifest + permanent maintenance for ~zero single-user
  value. Sign+notarize stays a one-off "on demand" task, not a milestone.
- **(post-M7) No fake `working` signal** — never derive "Claude is working" from `pgrep`/pty
  activity. `working`/`idle` must come from real hook events (`UserPromptSubmit`/`Stop`), or not
  at all. (Round 2 supersedes the round-1 "deeper context-inspector is out": the user DID greenlight
  reshaping the context graph toward actionable skills/agents editing + inline config editing —
  see "Other threads". The discipline that remains: actionable, not another static visualization.)
- **(post-M7) No structured write-back into `~/.claude.json`** — it's parsed partially (mcp
  only, under cap); writing over a partial parse risks data loss. (Inline editing of the smaller
  config files — settings.json, CLAUDE.md — via atomic+backup is fine; the big blob is not.)

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
