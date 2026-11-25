import { runCode } from './runner'
import type { RunLanguage, RunRequest, RunResult } from './runner'
import { fitsEditorLimits, workbenchInputLimits } from './runnerLimits'
import { isRunnerRecord, parseNativeResult } from './runnerProtocol'

const localAddress = 'http://127.0.0.1:5174'
const endpoint = '/api/local-runner'

export function isNativeLanguage(language: RunLanguage): language is 'c' | 'java' {
  return language === 'c' || language === 'java'
}

export function isLocalLabOrigin() {
  return location.origin === localAddress
    || (location.hostname !== '127.0.0.1' && location.hostname !== 'localhost')
    || Boolean((window as { __LEARNVERSE_CLOUD_SANDBOX__?: boolean }).__LEARNVERSE_CLOUD_SANDBOX__)
}

async function readLocalJson(response: Response, maxBytes: number): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) return undefined
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return JSON.parse(text + decoder.decode())
      bytes += value.byteLength
      if (bytes > maxBytes) {
        await reader.cancel()
        return undefined
      }
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
}

export type NativeRunnerProbe = 'available' | 'auth_required' | 'unavailable'

async function runnerStatus(signal?: AbortSignal): Promise<
  | { state: 'ok'; token: string; languages: ('c' | 'java')[] }
  | { state: 'auth_required' }
  | { state: 'unavailable' }
> {
  if (!isLocalLabOrigin()) return { state: 'unavailable' }
  const response = await fetch(endpoint, {
    cache: 'no-store',
    credentials: 'include',
    signal,
  })
  if (response.status === 401) return { state: 'auth_required' }
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    return { state: 'unavailable' }
  }
  const value = await readLocalJson(response, 512)
  if (!isRunnerRecord(value) || typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token)
    || !Array.isArray(value.languages) || value.languages.length > 2
    || !value.languages.every((language) => language === 'c' || language === 'java')) {
    return { state: 'unavailable' }
  }
  return { state: 'ok', token: value.token, languages: value.languages }
}

export async function probeNativeRunner(language: RunLanguage, signal?: AbortSignal): Promise<NativeRunnerProbe> {
  if (!isNativeLanguage(language)) return 'unavailable'
  try {
    const status = await runnerStatus(signal)
    if (status.state === 'auth_required') return 'auth_required'
    if (status.state === 'ok' && status.languages.includes(language)) return 'available'
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export async function checkNativeRunner(language: RunLanguage, signal?: AbortSignal): Promise<boolean> {
  return (await probeNativeRunner(language, signal)) === 'available'
}

export async function runWithNativeSupport(request: RunRequest, signal?: AbortSignal): Promise<RunResult> {
  if (!isNativeLanguage(request.language)) return runCode(request, signal)
  const limits = workbenchInputLimits(request.language)
  if (!fitsEditorLimits(request.code, limits.code) || (request.stdin?.length ?? 0) > limits.input) {
    return { output: '', diagnostics: [{ severity: 'error', message: '代码或标准输入超过本机运行上限。请缩短后重试。' }] }
  }
  const unavailable: RunResult = {
    output: '',
    diagnostics: [{ severity: 'error', message: '无法连接本机编译环境。请在 Windows 电脑上运行安装并启动实验室.cmd。' }],
  }
  try {
    const status = await runnerStatus(signal)
    if (status.state === 'auth_required') {
      return {
        output: '',
        diagnostics: [{ severity: 'error', message: '请先登录观测站账号后再使用云端 C / Java 安全沙盒。' }],
      }
    }
    if (status.state !== 'ok' || !status.languages.includes(request.language)) return unavailable
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Learnverse-Lab': status.token },
      body: JSON.stringify(request),
      signal,
    })
    if (!response.ok) {
      const payload = response.headers.get('content-type')?.includes('application/json')
        ? parseNativeResult(await readLocalJson(response, 16_000)) : undefined
      if (payload?.diagnostics.length) return payload
      const message = response.status === 401
        ? '登录状态已过期，请重新登录后再运行 C / Java 代码。'
        : response.status === 409 || response.status === 429
          ? '编译运行环境正忙，请稍后重试。'
          : response.status === 413 ? '代码或标准输入超过请求上限。请缩短后重试。' : '编译服务未能读取这次请求。'
      return {
        output: '',
        diagnostics: [{ severity: 'error', message }],
      }
    }
    const result = response.headers.get('content-type')?.includes('application/json')
      ? parseNativeResult(await readLocalJson(response, 1_000_000)) : undefined
    return result ?? { output: '', diagnostics: [{ severity: 'error', message: '本机运行器返回的数据格式无效。' }] }
  } catch (error) {
    if (signal?.aborted) throw error
    return unavailable
  }
}
