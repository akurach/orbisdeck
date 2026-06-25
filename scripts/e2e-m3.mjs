// M3 end-to-end via CDP: point a project at this repo (a real git repo) and exercise
// getGitSummary + listDir + readFile + getDiff through the live renderer.

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
  const proj = await window.cockpit.addProject({
    name: 'm3', settings: { path: repo, runCommand: '', testCommand: '', buildCommand: '', docsPath: '', claudeMdPath: '' }
  })
  const out = {}
  const git = await window.cockpit.getGitSummary(proj.id)
  out.isRepo = git.isRepo
  out.branch = git.branch
  out.hasCommits = git.recent.length > 0
  const dir = await window.cockpit.listDir(proj.id, '')
  out.hasPackageJson = dir.some(e => e.name === 'package.json' && !e.isDir)
  out.hasSrcDir = dir.some(e => e.name === 'src' && e.isDir)
  out.ignoresNodeModules = !dir.some(e => e.name === 'node_modules')
  const file = await window.cockpit.readFile(proj.id, 'package.json')
  out.readWorks = file.content.includes('ai-project-cockpit')
  out.lang = file.language
  const diff = await window.cockpit.getDiff(proj.id)
  out.diffOk = typeof diff.text === 'string'
  await window.cockpit.removeProject(proj.id)
  const pass = out.isRepo && out.hasPackageJson && out.hasSrcDir && out.ignoresNodeModules && out.readWorks && out.diffOk
  return (pass ? 'M3_OK ' : 'M3_FAIL ') + JSON.stringify(out)
})()`

const ws = new WebSocket(await getPageWs())
await new Promise((res, rej) => {
  ws.addEventListener('open', res)
  ws.addEventListener('error', rej)
})
try {
  console.log(await evaluate(ws, TEST))
} catch (err) {
  console.log('M3_FAIL ' + err.message)
}
ws.close()
process.exit(0)
