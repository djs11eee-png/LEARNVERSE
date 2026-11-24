import { randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import { createLocalProcessRunner, maxLocalOutput } from './local-process.mjs'

const origin = 'http://127.0.0.1:5174'
const endpoint = '/api/local-runner'
// Each UTF-16 unit can use up to six bytes in JSON's escaped representation.
const maxBodyBytes = 245_000
const maxBodyReaders = 3
const bodyDeadline = 3_000
const taskDeadline = 22_000
const maxDiagnostics = 32
const maxDiagnosticLength = 4_000
const token = randomBytes(32).toString('hex')
const root = fileURLToPath(new URL('..', import.meta.url))
const runner = await createLocalProcessRunner({
  cwd: root,
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(path|systemroot|windir|tmp|temp|comspec|homedrive|homepath|lang)$/i.test(key))),
})
const compiler = process.env.LEARNVERSE_GCC || 'gcc'
const javac = process.env.LEARNVERSE_JAVAC || 'javac'
const java = process.env.LEARNVERSE_JAVA || 'java'

function compilerDiagnostics(stderr) {
  const lines = stderr.split(/\r?\n/)
  return lines.flatMap((text, index) => {
    const location = text.match(/^[^\r\n]+?\.(?:c|java):(\d+)(?::(\d+))?:\s*(fatal error|error|warning):\s*(.*)$/i)
    if (!location) return []
    const [, line, column, kind, message] = location
    const caret = lines[index + 2]?.match(/^(\s*)\^/)
    const locationColumn = column ? Number(column) : caret ? caret[1].length + 1 : undefined
    return [{ severity: kind.toLowerCase() === 'warning' ? 'warning' : 'error', message, line: Number(line), column: locationColumn }]
  }).slice(0, maxDiagnostics - 1)
}

async function useCompiler(language, code, stdin, signal) {
  const result = { output: '', diagnostics: [] }
  const tempRoot = await realpath(os.tmpdir())
  const directory = await mkdtemp(path.join(tempRoot, 'learnverse-lab-'))
  try {
    const isC = language === 'c'
    // Remove quoted text and comments only for identifying the single source file and its entry class.
    const javaNames = isC ? '' : code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'/g, ' ')
    const className = javaNames.match(/\bpublic\s+(?:(?:final|abstract)\s+)?class\s+([A-Za-z_$][\w$]*)/)?.[1]
      ?? javaNames.match(/\bclass\s+([A-Za-z_$][\w$]*)/)?.[1]
    if (!isC && (!className || /\bpackage\s+[\w$]/.test(javaNames))) {
      result.diagnostics.push({ severity: 'error', message: '请用一个带 main 方法的 Java 类，并省略 package。类名使用英文字母、数字或下划线。' })
      return result
    }
    const source = isC ? 'main.c' : className + '.java'
    await writeFile(path.join(directory, source), code, 'utf8')
    const executable = path.join(directory, process.platform === 'win32' ? 'practice.exe' : 'practice')
    const build = await runner.run(isC ? compiler : javac, isC
      ? ['-std=c17', '-Wall', '-Wextra', '-Wpedantic', '-fdiagnostics-color=never', '-fmax-errors=10', source, '-o', executable]
      : ['-J-Xmx256m', '-J-Duser.language=en', '-J-Duser.country=US', '-encoding', 'UTF-8', '-Xlint:all', '-proc:none', source],
    { directory, timeout: 12000, signal })
    result.diagnostics.push(...compilerDiagnostics(build.errors))
    if (build.stopped || build.code !== 0) {
      if (build.stopped || !result.diagnostics.some(({ severity }) => severity === 'error')) {
        result.diagnostics.push({ severity: 'error', message: build.stopped || build.errors.trim() || '编译失败。' })
      }
      return result
    }
    const run = await runner.run(isC ? executable : java, isC ? [] : ['-Xmx128m', '-Dfile.encoding=UTF-8', '-cp', directory, className],
      { directory, input: stdin, timeout: 7000, signal })
    result.output = run.output
    if (run.stopped || run.code !== 0) {
      const line = run.errors.match(/\.java:(\d+)\)/)?.[1]
      result.diagnostics.push({ severity: 'error', message: run.stopped || run.errors.trim() || `程序结束，返回码为 ${run.code}。`, ...(line ? { line: Number(line) } : {}) })
    } else if (run.errors.trim()) result.output += (result.output && !result.output.endsWith('\n') ? '\n' : '') + run.errors
    return result
  } finally {
    const resolved = await realpath(directory).catch(() => '')
    if (resolved === directory && path.dirname(resolved) === tempRoot && path.basename(resolved).startsWith('learnverse-lab-')) {
      await rm(directory, { recursive: true, force: true, maxRetries: 2 }).catch(() => {})
    }
  }
}

function send(response, status, body, close = false) {
  if (response.destroyed) return
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...(close ? { Connection: 'close' } : {}) })
  response.end(JSON.stringify(body))
}

function validToken(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
    && timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(token, 'hex'))
}

const checks = await Promise.all([
  runner.run(compiler, ['--version']), runner.run(javac, ['-version']), runner.run(java, ['-version']),
])
for (const [index, name] of ['GCC', 'javac', 'Java'].entries()) {
  const { code, stopped, errors } = checks[index]
  if (code === 0 && !stopped) continue
  const reason = stopped || errors.split(/\r?\n/, 1)[0]
  if (reason) console.warn(`${name}: ${reason}`)
}
const languages = []
if (checks[0].code === 0 && !checks[0].stopped) languages.push('c')
if (checks[1].code === 0 && !checks[1].stopped && checks[2].code === 0 && !checks[2].stopped) languages.push('java')
let busy = false
let readers = 0

async function readRequest(request) {
  readers++
  const deadline = setTimeout(() => request.destroy(), bodyDeadline)
  try {
    const chunks = []
    let bytes = 0
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      bytes += chunk.length
      if (bytes > maxBodyBytes) return { status: 413 }
      chunks.push(chunk)
    }
    const decoded = JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'))
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return { status: 400 }
    const { code, language, stdin = '' } = decoded
    if (!languages.includes(language) || typeof code !== 'string' || !code.trim() || code.length > 32_000
      || typeof stdin !== 'string' || stdin.length > 8_000) return { status: 400 }
    return { code, language, stdin }
  } catch {
    return { status: 400 }
  } finally {
    clearTimeout(deadline)
    readers--
  }
}

function localApi(request, response, next) {
  if (request.url !== endpoint) return next()
  if (request.socket.remoteAddress !== '127.0.0.1' || request.headers.host !== new URL(origin).host
    || request.headers['sec-fetch-site'] !== 'same-origin') return send(response, 403, {}, true)
  if (request.method === 'GET') return send(response, 200, { token, languages })
  if (request.method !== 'POST' || request.headers.origin !== origin || !validToken(request.headers['x-learnverse-lab'])
    || String(request.headers['content-type']).split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return send(response, 403, {}, true)
  }
  if (Number(request.headers['content-length']) > maxBodyBytes) return send(response, 413, {}, true)
  if (readers >= maxBodyReaders) return send(response, 429, {}, true)

  void (async () => {
    const decoded = await readRequest(request)
    if (response.destroyed || request.aborted) return
    if (decoded.status) return send(response, decoded.status, {}, decoded.status === 413)
    if (busy) return send(response, 409, {})

    busy = true
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), taskDeadline)
    const disconnect = () => { if (!response.writableEnded) controller.abort() }
    response.once('close', disconnect)
    try {
      const result = await useCompiler(decoded.language, decoded.code, decoded.stdin, controller.signal)
      send(response, 200, {
        output: result.output.slice(0, maxLocalOutput),
        diagnostics: result.diagnostics.map(entry => ({ ...entry, message: entry.message.slice(0, maxDiagnosticLength) })),
      })
    } catch {
      send(response, 500, {})
    } finally {
      clearTimeout(deadline)
      response.off('close', disconnect)
      busy = false
    }
  })()
}

const server = await preview({
  root,
  preview: {
    host: '127.0.0.1', port: 5174, strictPort: true, cors: false,
    open: process.env.LEARNVERSE_LOCAL_NO_OPEN ? false : '/lab',
    headers: { 'Content-Security-Policy': "frame-ancestors 'none'", 'X-Frame-Options': 'DENY' },
  },
  plugins: [{ name: 'learnverse-local-compiler', configurePreviewServer: ({ middlewares }) => { middlewares.use(localApi) } }],
}).catch(async (error) => {
  await runner.close()
  throw error
})
console.log(`Local LEARNVERSE Lab: ${origin}/lab`)
console.log(`Detected native tools: ${languages.join(', ') || 'none'}`)
server.httpServer.requestTimeout = 30000
server.httpServer.once('close', () => { void runner.close() })
process.once('SIGINT', () => { void server.close() })
process.once('SIGTERM', () => { void server.close() })
