// End-to-end through the running built app via Chrome DevTools Protocol.
// Exercises the full seam: window.cockpit.addProject -> spawnTerminal -> writeTerminal
// -> onTerminalData round-trip. Proves IPC + node-pty work inside the real renderer.

const PORT = 9222

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
  const marker = 'COCKPIT_E2E_' + 'OK'
  const proj = await window.cockpit.addProject({
    name: 'e2e', settings: { path: '', runCommand: '', testCommand: '', buildCommand: '', docsPath: '', claudeMdPath: '' }
  })
  const term = await window.cockpit.spawnTerminal({ projectId: proj.id, title: 'e2e', cols: 80, rows: 24 })
  const got = await new Promise((resolve) => {
    let buf = ''
    const off = window.cockpit.onTerminalData((e) => {
      if (e.id !== term.id) return
      buf += e.data
      if (buf.includes(marker)) { off(); resolve(true) }
    })
    setTimeout(() => window.cockpit.writeTerminal(term.id, 'echo ' + marker + '\\n'), 300)
    setTimeout(() => { off(); resolve(false) }, 6000)
  })
  await window.cockpit.killTerminal(term.id)
  await window.cockpit.removeProject(proj.id)
  return got ? 'E2E_OK' : 'E2E_FAIL_no_marker'
})()`

const ws = new WebSocket(await getPageWs())
await new Promise((res, rej) => {
  ws.addEventListener('open', res)
  ws.addEventListener('error', rej)
})
try {
  const result = await evaluate(ws, TEST)
  console.log(result)
} catch (err) {
  console.log('E2E_FAIL ' + err.message)
}
ws.close()
process.exit(0)
