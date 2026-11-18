import { runCode } from './runner'
import type { RunLanguage, RunRequest, RunResult } from './runner'

const localAddress = 'http://127.0.0.1:5174'
const endpoint = '/api/local-runner'

export function isNativeLanguage(language: RunLanguage): language is 'c' | 'java' {
  return language === 'c' || language === 'java'
}

async function runnerStatus(signal?: AbortSignal) {
  if (location.origin !== localAddress) return null
  const response = await fetch(endpoint, { cache: 'no-store', signal })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null
  return response.json() as Promise<{ token: string; languages: string[] }>
}

export async function checkNativeRunner(language: RunLanguage, signal?: AbortSignal): Promise<boolean> {
  if (!isNativeLanguage(language)) return false
  try {
    return (await runnerStatus(signal))?.languages.includes(language) ?? false
  } catch {
    return false
  }
}

export async function runWithNativeSupport(request: RunRequest, signal?: AbortSignal): Promise<RunResult> {
  if (!isNativeLanguage(request.language)) return runCode(request, signal)
  const unavailable: RunResult = {
    output: '',
    diagnostics: [{ severity: 'error', message: '无法连接本机编译环境。请在 Windows 电脑上运行安装并启动实验室.cmd。' }],
  }
  try {
    const status = await runnerStatus(signal)
    if (!status?.languages.includes(request.language)) return unavailable
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Learnverse-Lab': status.token },
      body: JSON.stringify(request),
      signal,
    })
    if (!response.ok) {
      return {
        output: '',
        diagnostics: [{ severity: 'error', message: response.status === 409 ? '本机正在运行另一段代码。结束后再试。' : '本机编译服务未能读取这次请求。' }],
      }
    }
    return response.json() as Promise<RunResult>
  } catch (error) {
    if (signal?.aborted) throw error
    return unavailable
  }
}
