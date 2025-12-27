import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Required for some wallet adapter dependencies
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Polyfills for Node.js modules used by wallet adapters
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})
