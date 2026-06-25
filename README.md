<div align="center">

![OrbisDeck — Project Command Center](./assets/orbisdeck_banner.png)

# OrbisDeck

**Project command center — one place, full context, total control.**

*A macOS desktop shell for running multiple Claude Code projects from a single window.*

**English** · [Русский](./README.ru.md)

</div>

---

## What it is

OrbisDeck is a control center over your projects, terminals, agents, docs, and config — it
**orchestrates existing local tools**, it does not replace them. It is *not* a code editor,
*not* a Git client, *not* an agent system, and *not* an LLM.

> *"GitKraken + Ghostty + Claude Code + Project Dashboard in one window."*

Each project is independent: its own persistent terminal session(s), file watcher, git
context, and settings profile. Project switching is instant — sessions stay alive in the
background.

## Features

- **Terminals** — multiple persistent terminal tabs per project (node-pty + xterm.js);
  one-click Run / Tests / Build; optionally auto-launch `claude` on open; drag to reorder.
- **Agents** — live view of Claude Code sub-agents (Task/Agent) with type, status and
  duration, read from the session transcript and (opt-in) Claude hooks — not screen-scraping.
- **Git** — current branch, changed/staged counts, recent commits and a size-capped diff
  (simple-git), without being a git client.
- **Files** — lazy, watched file tree with git badges and a read-only viewer for code,
  images and rendered/raw Markdown.
- **Docker** — per-project, compose-scoped: container status with per-service Up / Restart /
  Stop and logs in a modal (orchestrates the `docker` CLI, not a Docker Desktop clone).
- **Claude-native config** — browse and edit global `~/.claude` settings, permissions (with
  plain-language explanations), hooks and MCP servers; per-project `CLAUDE.md` as collapsible
  elements.
- **Layout** — resizable, collapsible and swappable panels; sizes and arrangement persist
  per project.
- **Notes & notifications** — per-project notes; a desktop alert and tab badge when a
  terminal is waiting for your input.

Version history lives in [`CHANGELOG.md`](./CHANGELOG.md); the product spec is
[`IDEA.md`](./IDEA.md) and the working plan is [`ROADMAP.md`](./ROADMAP.md).

## Stack

**Electron** (desktop shell) · **React + TypeScript** (UI) · **xterm.js** (terminal render) ·
**node-pty** (PTY / process spawn) · **chokidar** (file watching) · **simple-git** (git).

**Architecture** — strict two-process split. The renderer talks to the main process through a
single typed IPC seam (`src/shared/ipc-contract.ts`, exposed as `window.cockpit`); a lint rule
fails CI if the renderer reaches past it into `electron`/`fs`/`node-pty`. All OS/native concerns
(PTY, watchers, git, `~/.claude` reads) live in `src/main/`.

## Commands

```bash
npm run dev        # electron-vite dev (HMR renderer + main/preload watch)
npm run build      # build all three targets to out/
npm start          # preview the built app
npm run typecheck  # tsc over node + web projects (no emit)
npm run lint       # ESLint — enforces renderer purity
npm run rebuild    # rebuild node-pty against Electron's ABI
npm run pack       # electron-builder package (mac dir target)
```

If terminals won't spawn or Electron won't launch after `npm install`, run
`node scripts/fix-native.mjs` (repairs node-pty's `spawn-helper` exec bit and incomplete
Electron extraction — see [`CLAUDE.md`](./CLAUDE.md) for details).

## License

**GNU General Public License v3.0** © 2026 Alexander Kurach — see [`LICENSE`](./LICENSE).

Copyleft: you may use, study, modify, and redistribute this software, but **any distributed
derivative must remain open under GPLv3** — it cannot be closed-sourced or rolled into a
proprietary product.
