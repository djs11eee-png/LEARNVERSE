import { spawn } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'

const origin = 'http://127.0.0.1:5174'
const endpoint = '/api/local-runner'
const maxOutput = 26000
const token = randomBytes(32).toString('hex')
const root = fileURLToPath(new URL('..', import.meta.url))
const options = {
  cwd: root,
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(path|systemroot|windir|tmp|temp|comspec|homedrive|homepath|lang)$/i.test(key))),
  windowsHide: true,
}
const compiler = process.env.LEARNVERSE_GCC || 'gcc'
const javac = process.env.LEARNVERSE_JAVAC || 'javac'
const java = process.env.LEARNVERSE_JAVA || 'java'

function stopProcess(child) {
  if (!child.pid || child.exitCode !== null) return
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { ...options, stdio: 'ignore' })
    killer.once('error', () => child.kill())
    killer.once('close', (code) => { if (code !== 0) child.kill() })
  } else child.kill('SIGKILL')
}

function execute(command, args, { directory = root, input = '', timeout = 8000, signal } = {}) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve({ code: null, output: '', errors: '', stopped: '已停止运行。' })
    const child = spawn(command, args, { ...options, cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] })
    let output = ''
    let errors = ''
    let stopped = ''
    const stop = (message) => {
      if (stopped) return
      stopped = message
      stopProcess(child)
    }
    const abort = () => stop('已停止运行。')
    const timer = setTimeout(() => stop('运行时间过长，已停止。检查循环是否能结束。'), timeout)
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (text) => {
      output += text.slice(0, Math.max(0, maxOutput - output.length))
      if (output.length >= maxOutput) stop('输出过多，已停止。')
    })
    child.stderr.on('data', (text) => {
      errors += text.slice(0, Math.max(0, maxOutput - errors.length))
      if (errors.length >= maxOutput) stop('错误输出过多，已停止。')
    })
    child.stdin.on('error', () => {})
    child.stdin.end(input)
    child.once('error', (error) => { stopped = `无法启动程序（${error.code ?? '未知错误'}）。请检查安装。` })
    child.once('close', (code) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      resolve({ code, output, errors, stopped })
    })
  })
}

function compilerDiagnostics(stderr) {
  const lines = stderr.split(/\r?\n/)
  return lines.flatMap((text, index) => {
    const location = text.match(/^[^\r\n]+?\.(?:c|java):(\d+)(?::(\d+))?:\s*(fatal error|error|warning):\s*(.*)$/i)
    if (!location) return []
    const [, line, column, kind, message] = location
    const caret = lines[index + 2]?.match(/^(\s*)\^/)
    const locationColumn = column ? Number(column) : caret ? caret[1].length + 1 : undefined
    return [{ severity: kind.toLowerCase() === 'warning' ? 'warning' : 'error', message, line: Number(line), column: locationColumn }]
  })
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
    const build = await execute(isC ? compiler : javac, isC
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
    const run = await execute(isC ? executable : java, isC ? [] : ['-Xmx128m', '-Dfile.encoding=UTF-8', '-cp', directory, className],
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

function send(response, status, body) {
  if (response.destroyed) return
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(body))
}

function validToken(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
    && timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(token, 'hex'))
}

const checks = await Promise.all([
  execute(compiler, ['--version']), execute(javac, ['-version']), execute(java, ['-version']),
])
const languages = []
if (checks[0].code === 0) languages.push('c')
if (checks[1].code === 0 && checks[2].code === 0) languages.push('java')
let busy = false

function localApi(request, response, next) {
  if (request.url !== endpoint) return next()
  if (request.socket.remoteAddress !== '127.0.0.1' || request.headers.host !== new URL(origin).host
    || request.headers['sec-fetch-site'] !== 'same-origin') return send(response, 403, {})
  if (request.method === 'GET') return send(response, 200, { token, languages })
  if (request.method !== 'POST' || request.headers.origin !== origin || !validToken(request.headers['x-learnverse-lab'])
    || !String(request.headers['content-type']).startsWith('application/json')) return send(response, 403, {})
  if (busy) return send(response, 409, {})
  busy = true
  const controller = new AbortController()
  const deadline = setTimeout(() => { controller.abort(); request.destroy() }, 25000)
  response.once('close', () => { if (!response.writableEnded) controller.abort() })

  void (async () => {
    try {
      const chunks = []
      let size = 0
      for await (const chunk of request) {
        size += chunk.length
        if (size > 130000) return send(response, 413, {})
        chunks.push(chunk)
      }
      let decoded
      try { decoded = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return send(response, 400, {}) }
      const { code, language, stdin = '' } = decoded ?? {}
      if (!languages.includes(language) || typeof code !== 'string' || !code.trim() || code.length > 32000
        || typeof stdin !== 'string' || stdin.length > 8000) return send(response, 400, {})
      send(response, 200, await useCompiler(language, code, stdin, controller.signal))
    } catch {
      send(response, 500, {})
    } finally {
      clearTimeout(deadline)
      busy = false
    }
  })()
}

const server = await preview({
  root,
  preview: { host: '127.0.0.1', port: 5174, strictPort: true, cors: false, open: process.env.LEARNVERSE_LOCAL_NO_OPEN ? false : '/lab' },
  plugins: [{ name: 'learnverse-local-compiler', configurePreviewServer: ({ middlewares }) => { middlewares.use(localApi) } }],
})
console.log(`Local LEARNVERSE Lab: ${origin}/lab`)
console.log(`Detected native tools: ${languages.join(', ') || 'none'}`)
server.httpServer.requestTimeout = 30000
