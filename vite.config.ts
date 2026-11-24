import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { chapterDiscussions } from './scripts/discussions.mjs'

const backendUrl = process.env.LEARNVERSE_BACKEND_URL?.trim()

export default defineConfig({
  // In production Nginx proxies /api/* to FastAPI; in dev setting LEARNVERSE_BACKEND_URL=http://127.0.0.1:8000 delegates all /api/* to FastAPI.
  plugins: backendUrl ? [react()] : [react(), chapterDiscussions()],
  server: {
    ...(backendUrl
      ? {
          proxy: {
            '/api': {
              target: backendUrl,
              changeOrigin: false,
            },
          },
        }
      : {}),
    fs: {
      // Vite replaces the default deny list when it is configured.
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/.learnverse/**', 'discussions.sqlite*', 'learnverse.sqlite*', '**/backend/**'],
    },
  },
  build: { license: true },
})
