import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc, type Services } from './ipc'
import { Store } from './store'

let services: Services | null = null

// Bundled at <appRoot>/resources/icon.png in both dev (out/main → ../../resources)
// and packaged builds; the packaged app icon itself comes from resources/icon.icns.
const ICON_PATH = join(__dirname, '../../resources/icon.png')

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0d1117',
    title: 'OrbisDeck',
    icon: ICON_PATH,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // electron-vite injects ELECTRON_RENDERER_URL in dev; load the built file in prod.
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Dock icon for dev (packaged macOS builds use resources/icon.icns instead).
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(ICON_PATH)
    } catch {
      /* icon missing in some run modes — non-fatal */
    }
  }

  const store = new Store()
  services = registerIpc(store)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  services?.terminals.killAll()
  services?.files.closeAll()
})
