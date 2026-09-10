import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  base: mode === 'ag' ? '/' : '/enterprise/',
  server: {
    host: true,
    port: 5175,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4001",
        changeOrigin: true,
      },
      "/inference-data": {
        target: "http://127.0.0.1:4001",
        changeOrigin: true,
      },
    },
  },
}))
