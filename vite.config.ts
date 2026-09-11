import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Renderer only. The main process and preload are compiled by tsc (CommonJS),
// which is the least surprising setup for Electron.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
  },
})
