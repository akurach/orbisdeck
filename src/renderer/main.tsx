import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { installTauriCockpit } from './tauri-bridge'
import { LocaleProvider } from './i18n'
import { applyAccent } from './state/accent'
import { applyDensity } from './state/density'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

// Apply the saved accent + density before first paint so the UI never flashes the default.
applyAccent()
applyDensity()

// Under Tauri, install the Tauri-backed window.cockpit before mounting. Under Electron
// this is a no-op (preload already provides window.cockpit).
installTauriCockpit().finally(() => {
  createRoot(root).render(
    <React.StrictMode>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </React.StrictMode>
  )
})
