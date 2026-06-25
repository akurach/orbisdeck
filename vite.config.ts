import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Renderer build for the Tauri app. The React UI lives in src/renderer; Tauri loads
// the dev server (dev) or the dist/ output (build). No Electron.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
})
