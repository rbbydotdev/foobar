import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://rbby.dev/foobar-clickhouse/ on GitHub Pages.
  base: '/foobar-clickhouse/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  optimizeDeps: {
    // sqlite-wasm ships its own .wasm asset + worker; don't pre-bundle it.
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  worker: {
    format: 'es',
  },
  build: {
    // The SQLite WASM glue + CodeMirror push the main chunk past the default
    // 500 kB hint; faker and the AI SDK are already split into lazy chunks.
    chunkSizeWarningLimit: 1200,
  },
})
