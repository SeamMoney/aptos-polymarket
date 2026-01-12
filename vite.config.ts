import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(), // Enable HTTPS for local dev (required for Google/Petra Web login)
  ],
  server: {
    https: true,
    port: 5174,
  },
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
