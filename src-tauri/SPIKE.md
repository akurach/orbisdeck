# Tauri spike — findings

**Verdict: viable. The seam architecture pays off — the React renderer ports unchanged;
only the native backend is a Rust rewrite.** Validated end-to-end on macOS.

## What was proven

- **Rust pty backend compiles and runs.** `portable-pty` (wezterm's crate) under Tauri 2:
  `spawn_terminal` opens a pty, spawns `/bin/zsh -l`, a reader thread streams output to the
  webview via a `term-data` event; `write_terminal` / `resize_terminal` / `kill_terminal`
  drive it. (`src-tauri/src/lib.rs`.)
- **The React renderer runs unchanged** inside the Tauri WebView. No component or CSS change.
  Only a new `window.cockpit` provider was added (`src/renderer/tauri-bridge.ts`): terminals
  call Tauri `invoke`/`listen`; the rest of `CockpitApi` is stubbed for the spike.
- **End-to-end confirmed:** launching the app, the renderer mounted, auto-spawned a terminal,
  `invoke('spawn_terminal')` reached Rust, and `/bin/zsh -l` ran as a live child of the app
  (output streaming to xterm). No panics.

## Gotchas hit

- `generate_context!` needs `src-tauri/icons/icon.png` (copied from `resources/`).
- The pty `Child` handle must be **kept** (stored in the session); dropping it reaps/kills
  the process — the first run spawned nothing visible until the handle was retained.
- Tauri 2 capabilities: `core:default` in `capabilities/default.json` covers invoke + events.

## Effort to a full port (estimate)

| Module | Node now | Rust target | Effort |
|--------|----------|-------------|--------|
| terminals | node-pty | `portable-pty` ✅ done in spike | — |
| files (tree/watch) | chokidar | `notify` + std fs | 🟡 |
| git | simple-git | `git2` (libgit2) or shell | 🟡 |
| docker | docker CLI | shell (same) | 🟢 |
| claude/agents/hooks/detect/store/notes | fs + json | std fs + serde_json | 🟢 |
| ipc seam | electron ipc | `#[tauri::command]` + events | 🟡 |
| renderer | — | reuse as-is via the bridge | 🟢 done |

Rough: **~1–2 weeks** for full parity; terminals (the risky bit) already work.

## Payoff

Bundle ~5–10 MB vs Electron ~150 MB; lower RAM; native WKWebView; stricter security.
Cost: maintain a Rust backend. The renderer-purity discipline (one typed `window.cockpit`
seam) is exactly what makes this a backend swap, not a rewrite.

## Run it

```bash
npm run build                 # build the renderer → out/renderer (Tauri frontendDist)
cd src-tauri && cargo run      # launches the Tauri window with a working terminal
```
