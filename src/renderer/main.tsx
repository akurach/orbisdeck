import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { installTauriCockpit } from './tauri-bridge'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

// Under Tauri, install the Tauri-backed window.cockpit before mounting. Under Electron
// this is a no-op (preload already provides window.cockpit).
installTauriCockpit().finally(() => {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
