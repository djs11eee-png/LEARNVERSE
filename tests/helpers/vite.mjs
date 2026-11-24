import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'

export async function startTestServer(port = 0) {
  // Node test files run in parallel. Vite must not replace another server's dependencies.
  const root = await realpath(tmpdir())
  const cacheDir = await mkdtemp(path.join(root, 'learnverse-vite-test-'))
  let server

  async function close() {
    try { await server?.close() }
    finally {
      const resolved = await realpath(cacheDir).catch(() => '')
      if (resolved === cacheDir && path.dirname(resolved) === root) {
        await rm(resolved, { recursive: true, force: true, maxRetries: 2 })
      }
    }
  }

  try {
    server = await createServer({
      cacheDir,
      logLevel: 'error',
      server: { host: '127.0.0.1', port, strictPort: true, hmr: false },
    })
    await server.listen()
    const address = server.httpServer.address()
    return { origin: `http://127.0.0.1:${address.port}`, close }
  } catch (error) {
    await close()
    throw error
  }
}
