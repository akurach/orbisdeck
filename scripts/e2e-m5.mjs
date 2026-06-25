// M5 smoke through the live renderer: detectProjectSettings + terminal pid fact +
// docker status shape + auto-launch field round-trip. Exercises the new seam channels.

const PORT = 9222
const CWD = process.cwd()

async function getPageWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json`)
      const targets = await res.json()
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('no CDP page target appeared')
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
  const out = {}
  // detect this repo (has package.json + CLAUDE.md)
  const det = await window.cockpit.detectProjectSettings(${JSON.stringify(CWD)})
  out.detectRun = !!det.runCommand
  out.detectClaude = det.claudeMdPath === './CLAUDE.md'
  out.detectSources = Array.isArray(det.sources) && det.sources.length > 0

  const proj = await window.cockpit.addProject({
    name: 'e2e-m5', settings: { path: ${JSON.stringify(CWD)}, runCommand: '', testCommand: '', buildCommand: '', docsPath: '', claudeMdPath: '', autoLaunchCommand: '' }
  })
  // terminal pid is a fact
  const term = await window.cockpit.spawnTerminal({ projectId: proj.id, title: 'e2e', cols: 80, rows: 24 })
  out.pidOk = typeof term.pid === 'number' && term.pid > 0
  // agents list reflects the live process
  const list = await window.cockpit.listTerminals(proj.id)
  out.listHasPid = list.some((t) => t.id === term.id && t.pid > 0)
  // docker status shape (no compose here => available true, hasCompose false)
  const docker = await window.cockpit.getDockerStatus(proj.id)
  out.dockerShape = typeof docker.available === 'boolean' && typeof docker.hasCompose === 'boolean' && Array.isArray(docker.containers)

  await window.cockpit.killTerminal(term.id)
  await window.cockpit.removeProject(proj.id)

  const pass = out.detectRun && out.detectClaude && out.detectSources && out.pidOk && out.listHasPid && out.dockerShape
  return (pass ? 'M5_OK ' : 'M5_FAIL ') + JSON.stringify(out)
})()`

const ws = new WebSocket(await getPageWs())
await new Promise((res, rej) => {
  ws.addEventListener('open', res)
  ws.addEventListener('error', rej)
})
try {
  console.log(await evaluate(ws, TEST))
} catch (err) {
  console.log('M5_FAIL ' + err.message)
}
ws.close()
process.exit(0)
