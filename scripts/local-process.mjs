import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const maxLocalOutput = 26_000
const stdioGraceMs = 750
const onWindows = process.platform === 'win32'

function execute(command, args, { cwd, env, group, input = '', timeout = 8_000, signal }) {
  return new Promise((resolve) => {
    const result = { code: null, output: '', errors: '', stopped: '' }
    if (signal?.aborted) return resolve({ ...result, stopped: '已停止运行。' })

    const child = spawn(command, args, { cwd, env, detached: group, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let complete = false
    let grace
    let timer

    function finish(code) {
      if (complete) return
      complete = true
      clearTimeout(grace)
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      child.stdin.destroy()
      child.stdout.destroy()
      child.stderr.destroy()
      resolve({ ...result, code })
    }

    function stopGroup() {
      if (!group || !child.pid) return
      // On POSIX the dedicated process group remains addressable after its leader exits.
      try { process.kill(-child.pid, 'SIGKILL') } catch { /* The group may have already exited. */ }
    }

    function drain(code) {
      if (grace === undefined) grace = setTimeout(() => finish(code), stdioGraceMs)
    }

    function stop(message) {
      if (result.stopped) return
      result.stopped = message
      stopGroup()
      if (child.exitCode === null && child.signalCode === null) child.kill()
      drain(null)
    }

    const abort = () => stop('已停止运行。')
    timer = setTimeout(() => stop('运行时间过长，已停止。检查循环是否能结束。'), timeout)
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.setEncoding('utf8').on('data', (text) => {
      result.output += text.slice(0, maxLocalOutput - result.output.length)
      if (result.output.length >= maxLocalOutput) stop('输出过多，已停止。')
    })
    child.stderr.setEncoding('utf8').on('data', (text) => {
      result.errors += text.slice(0, maxLocalOutput - result.errors.length)
      if (result.errors.length >= maxLocalOutput) stop('错误输出过多，已停止。')
    })
    child.stdin.on('error', () => {})
    child.stdin.end(input)
    child.once('error', (error) => {
      result.stopped ||= `无法启动程序（${error.code ?? '未知错误'}）。请检查安装。`
      drain(null)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      stopGroup()
      drain(code)
    })
    child.once('close', finish)
  })
}

export async function createLocalProcessRunner({ cwd, env }) {
  const tempRoot = await realpath(os.tmpdir())
  let directory
  let launcher

  async function close() {
    if (!directory) return
    const resolved = await realpath(directory).catch(() => '')
    if (resolved === directory && path.dirname(resolved) === tempRoot && path.basename(resolved).startsWith('learnverse-job-')) {
      await rm(resolved, { recursive: true, force: true, maxRetries: 2 }).catch(() => {})
    }
  }

  if (onWindows) {
    directory = await mkdtemp(path.join(tempRoot, 'learnverse-job-'))
    launcher = path.join(directory, 'LearnverseJob.exe')
    const tool = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    const build = await execute(tool, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      '$ErrorActionPreference = "Stop"; Add-Type -Path $env:LEARNVERSE_JOB_SOURCE -OutputAssembly $env:LEARNVERSE_JOB_EXE -OutputType ConsoleApplication'], {
      cwd, timeout: 15_000, group: false,
      env: { ...env, LEARNVERSE_JOB_SOURCE: fileURLToPath(new URL('./windows-lab-job.cs', import.meta.url)), LEARNVERSE_JOB_EXE: launcher },
    })
    if (build.code !== 0 || build.stopped) {
      await close()
      throw new Error(`无法初始化本机运行资源限制。${build.stopped || build.errors.trim() || build.output.trim()}`)
    }
  }

  return {
    run(command, args, { directory = cwd, timeout = 8_000, ...options } = {}) {
      const taskEnv = launcher ? { ...env, LEARNVERSE_JOB_WALL_MS: String(timeout + 1_000) } : env
      return execute(launcher ?? command, launcher ? [command, ...args] : args, {
        ...options, timeout, cwd: directory, env: taskEnv, group: !onWindows,
      })
    },
    close,
  }
}
