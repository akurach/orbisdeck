// Post-install repair for two macOS native-module issues seen with npm 11's
// allow-scripts gate + extract-zip on recent Node:
//
//  1. node-pty's prebuilt `spawn-helper` can land without its execute bit, which
//     makes every pty spawn fail with "posix_spawnp failed." We re-chmod it +x.
//  2. Electron's dist can extract incomplete (missing Frameworks) and its path.txt
//     can be absent. We verify and, if a full cached zip exists, re-extract with the
//     system `unzip` (handles the app-bundle symlinks extract-zip mishandles).
//
// Idempotent and best-effort: it only acts when something is actually wrong.

import { execSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const root = process.cwd()

function fixSpawnHelper() {
  const base = join(root, 'node_modules/node-pty/prebuilds')
  if (!existsSync(base)) return
  for (const dir of readdirSync(base)) {
    if (!dir.startsWith('darwin')) continue
    const helper = join(base, dir, 'spawn-helper')
    if (existsSync(helper)) {
      chmodSync(helper, 0o755)
      console.log(`[fix-native] chmod +x ${helper}`)
    }
  }
  // Some node-pty builds emit the helper under build/Release instead.
  const built = join(root, 'node_modules/node-pty/build/Release/spawn-helper')
  if (existsSync(built)) chmodSync(built, 0o755)
}

function fixElectronDist() {
  if (process.platform !== 'darwin') return
  const elDir = join(root, 'node_modules/electron')
  if (!existsSync(elDir)) return
  const frameworks = join(
    elDir,
    'dist/Electron.app/Contents/Frameworks/Electron Framework.framework'
  )
  const pathTxt = join(elDir, 'path.txt')
  if (existsSync(frameworks) && existsSync(pathTxt)) return // healthy

  // Find the cached full zip @electron/get downloaded.
  const cacheRoot = join(homedir(), 'Library/Caches/electron')
  if (!existsSync(cacheRoot)) {
    console.warn('[fix-native] electron dist incomplete and no cache to re-extract from')
    return
  }
  let zip = null
  for (const sub of readdirSync(cacheRoot)) {
    const dir = join(cacheRoot, sub)
    try {
      for (const f of readdirSync(dir)) {
        if (f.endsWith('darwin-arm64.zip') || f.endsWith('darwin-x64.zip')) zip = join(dir, f)
      }
    } catch {
      /* not a dir */
    }
  }
  if (!zip) {
    console.warn('[fix-native] no cached electron zip found')
    return
  }
  const dist = join(elDir, 'dist')
  rmSync(dist, { recursive: true, force: true })
  mkdirSync(dist, { recursive: true })
  execSync(`unzip -q "${zip}" -d "${dist}"`, { stdio: 'inherit' })
  writeFileSync(pathTxt, 'Electron.app/Contents/MacOS/Electron')
  console.log('[fix-native] re-extracted electron dist via unzip')
}

try {
  fixSpawnHelper()
  fixElectronDist()
} catch (err) {
  console.warn('[fix-native] non-fatal:', err.message)
}
