// M4 end-to-end via CDP: exercise the global Claude config read path
// (getGlobalClaude + readClaudeFile) and per-project CLAUDE.md surfacing through
// the live renderer. Assumes the machine has a real ~/.claude install.

const PORT = 9222
const REPO = process.argv[2] || process.cwd()

async function getPageWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json`)
      const targets = await res.json()
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {
      /* not up */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('no CDP page target')
}

function evaluate(ws, expression) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9)
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id !== id) return
      ws.removeEventListener('message', onMsg)
      if (msg.error) return reject(new Error(JSON.stringify(msg.error)))
      const r = msg.result?.result
      if (r?.subtype === 'error') return reject(new Error(r.description))
      resolve(r?.value)
    }
    ws.addEventListener('message', onMsg)
    ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true }
      })
    )
  })
}

const TEST = `(async () => {
  const repo = ${JSON.stringify(REPO)}
  const out = {}
  const g = await window.cockpit.getGlobalClaude()
  out.exists = g.exists
  out.claudeDirOk = typeof g.claudeDir === 'string' && g.claudeDir.endsWith('.claude')
  out.settingsJson = g.settingsText.length > 0
  out.hooksIsArray = Array.isArray(g.hooks)
  out.mcpIsArray = Array.isArray(g.mcpServers)
  out.commandsIsArray = Array.isArray(g.commands)
  out.permsShape = !!g.permissions && Array.isArray(g.permissions.allow)
  // read one command's markdown if present (sandboxed reader)
  if (g.commands.length > 0) {
    const f = await window.cockpit.readClaudeFile(g.commands[0].path)
    out.cmdReadOk = typeof f.content === 'string' && f.content.length > 0
  } else {
    out.cmdReadOk = true
  }
  // escape attempt must be refused (empty content)
  const escape = await window.cockpit.readClaudeFile('../../etc/passwd')
  out.sandboxOk = escape.content === ''
  // per-project CLAUDE.md surfacing via readFile
  const proj = await window.cockpit.addProject({
    name: 'm4', settings: { path: repo, runCommand: '', testCommand: '', buildCommand: '', docsPath: '', claudeMdPath: 'CLAUDE.md' }
  })
  const md = await window.cockpit.readFile(proj.id, 'CLAUDE.md')
  out.projectClaudeMd = md.content.includes('AI Project Cockpit')
  await window.cockpit.removeProject(proj.id)
  const pass = out.claudeDirOk && out.hooksIsArray && out.mcpIsArray && out.commandsIsArray &&
    out.permsShape && out.cmdReadOk && out.sandboxOk && out.projectClaudeMd
  return (pass ? 'M4_OK ' : 'M4_FAIL ') + JSON.stringify(out)
})()`

const ws = new WebSocket(await getPageWs())
await new Promise((res, rej) => {
  ws.addEventListener('open', res)
  ws.addEventListener('error', rej)
})
try {
  console.log(await evaluate(ws, TEST))
} catch (err) {
  console.log('M4_FAIL ' + err.message)
}
ws.close()
process.exit(0)
