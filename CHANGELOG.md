# Changelog

All notable changes to OrbisDeck. The project is built in milestones (M0–M6); each is
listed newest-first.

## M6 — Make it usable

- **Editable global Claude config.** `~/.claude/settings.json` is now an editable field tree
  (text/number/checkbox), saved atomically with a backup; raw-text view kept as a fallback.
- **Permissions** explained in plain language (allow / ask / deny) with add/remove of rules.
- **Hooks** shown with a description of each event (PreToolUse, SubagentStop, Notification, …).
- **Notification when a terminal awaits input** — opt-in Claude `Notification` hook → native
  desktop alert + a badge on the project tab, cleared when the project is focused.
- **Interrupted-agent detection** — a sub-agent whose Claude session died (no stop event) is
  shown as “interrupted”, not stuck on “running”.
- **Per-project Notes**; **project Settings** fields now have inline descriptions.
- Removed the empty Logs tab.

## M5 — Beyond the shell

- **Resizable / collapsible / swappable panels** (right ↔ left, bottom ↔ top), persisted
  per project; drag-reorder of project / right-panel / terminal tabs.
- **Live agents panel** — Claude sub-agents from the session transcript and opt-in hooks.
- **Docker management** — compose-scoped container status with Up / Down / Restart / per-service
  actions and logs, via the `docker` CLI.
- **Smarter project settings** — auto-detect run/test/build on add, auto-launch command,
  env vars (+ auto-loaded `.env`), working subdirectory.
- **Richer file viewer** — inline image preview and Markdown rendered/source toggle.
- **CLAUDE.md as managed elements** — heading-parsed collapsible cards.
- Rebranded to **OrbisDeck**; relicensed under **GPLv3**.

## M4 — Claude-native config

- Read-only viewer for the global `~/.claude` install: settings, permissions, hooks, MCP
  servers and custom commands, plus per-project `CLAUDE.md`.

## M3 — Glanceable context

- Git summary (branch, change counts, recent commits) and size-capped diff (simple-git).
- Lazy, watched file tree (chokidar) with git badges and a read-only file viewer.

## M2 — Terminals

- Per-project, multi-tab persistent terminals (node-pty + xterm.js) with coalesced output
  and replayed scrollback; Run / Tests / Build spawn buttons.

## M1 — The shell

- Electron + React + TypeScript shell: project tabs, native folder picker, JSON state store,
  single typed IPC seam between the renderer and the main process.

## M0 — Spike

- Validated node-pty under Electron’s ABI and the IPC → pty → data round-trip.
