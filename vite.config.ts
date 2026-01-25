import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Read version from version.json
const versionPath = path.resolve(__dirname, 'version.json')
const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf-8'))
const appVersion = `${versionData.major}.${versionData.minor}.${versionData.build}`

export default defineConfig({
  base: '/Marcacao-Mestre/',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  server: {
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
