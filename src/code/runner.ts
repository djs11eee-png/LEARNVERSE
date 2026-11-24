import acornURL from 'acorn?url&no-inline'
import pythonWasmURL from 'pyodide/pyodide.asm.wasm?url&no-inline'
import pythonStdlibURL from 'pyodide/python_stdlib.zip?url&no-inline'
import pythonLockURL from 'pyodide/pyodide-lock.json?url&no-inline'
import sqlLoaderURL from 'sql.js/dist/sql-wasm-browser.js?url&no-inline'
import sqlWasmURL from 'sql.js/dist/sql-wasm-browser.wasm?url&no-inline'
import { makeHtmlPreview } from './preview'
import { fitsEditorLimits, workbenchInputLimits } from './runnerLimits'
import { isRunnerRecord, maxBrowserOutput, maxRunnerDiagnostics, maxRunnerOutputMessages, parseRunnerMessage } from './runnerProtocol'
import sandboxDocument from './runner.frame.html?raw'
import workerSource from './runner.worker.js?raw'

export type RunLanguage = 'python' | 'javascript' | 'sql' | 'html' | 'c' | 'java' | 'text'

export interface RunRequest {
  language: RunLanguage
  code: string
  stdin?: string
  interactivePreview?: boolean
  previewToken?: string
}

export interface Diagnostic {
  severity: 'error' | 'warning'
  message: string
  line?: number
  column?: number
}

export interface RunResult {
  output: string
  diagnostics: Diagnostic[]
  preview?: string
  previewInteractive?: boolean
}

type InterpreterLanguage = 'python' | 'javascript' | 'sql'
const assetURLs: Record<InterpreterLanguage, Record<string, string>> = {
  javascript: { acorn: acornURL },
  python: { wasm: pythonWasmURL, stdlib: pythonStdlibURL, lock: pythonLockURL },
  sql: { loader: sqlLoaderURL, wasm: sqlWasmURL },
}

const assetCache = new Map<string, Promise<Blob>>()
const bootTimeout = 35_000
const runTimeout = 5_000

function getAsset(url: string) {
  const cached = assetCache.get(url)
  if (cached) return cached
  const pending = fetch(url, { mode: 'same-origin', credentials: 'same-origin' }).then((response) => {
    if (!response.ok) throw new Error(`无法加载运行环境文件（${response.status}）。`)
    return response.blob()
  }).catch((error: unknown) => {
    assetCache.delete(url)
    throw error
  })
  assetCache.set(url, pending)
  return pending
}

async function prepareAssets(language: InterpreterLanguage) {
  const entries = Object.entries(assetURLs[language])
  const [files, scripts] = await Promise.all([
    Promise.all(entries.map(async ([key, url]) => [key, await getAsset(url)])),
    language === 'python' ? import('./pythonRuntime').then((runtime) => runtime.pythonScripts) : undefined,
  ])
  return { ...Object.fromEntries(files), ...scripts }
}

function diagnostic(message: string, severity: Diagnostic['severity'] = 'error'): RunResult {
  return { output: '', diagnostics: [{ severity, message }] }
}

export async function runCode(request: RunRequest, signal?: AbortSignal): Promise<RunResult> {
  if (signal?.aborted) return diagnostic('运行已停止。', 'warning')
  const limits = workbenchInputLimits(request.language)
  if (!fitsEditorLimits(request.code, limits.code) || (request.stdin?.length ?? 0) > limits.input) {
    return diagnostic('代码或标准输入超过运行上限。请缩短后重试。')
  }

  const { language } = request
  switch (language) {
    case 'html': {
      const interactive = Boolean(request.interactivePreview)
      const { preview, sanitized } = makeHtmlPreview(request.code, {
        interactive,
        token: request.previewToken,
      })
      const warning = interactive
        ? '交互预览沙箱已拦截外部脚本、内联事件属性、外部链接或不支持的内容（仅允许同页内联 <script> 与本地 DOM 交互）。'
        : '静态预览已移除脚本、外部链接、超出上限的图片或不支持的内容。'
      return {
        output: '',
        preview,
        previewInteractive: interactive,
        diagnostics: sanitized ? [{ severity: 'warning', message: warning }] : [],
      }
    }
    case 'c':
      return diagnostic('C 代码需要本地编译器。请连接 LEARNVERSE 本地运行器。')
    case 'java':
      return diagnostic('Java 代码需要本地 JDK。请连接 LEARNVERSE 本地运行器。')
    case 'text':
      return diagnostic('文本练习可编辑和阅读。请选择代码语言来运行程序。', 'warning')
    default:
      return runInSandbox(request, language, signal)
  }
}

function runInSandbox(request: RunRequest, language: InterpreterLanguage, signal?: AbortSignal): Promise<RunResult> {
  return new Promise((resolve) => {
    const token = [...crypto.getRandomValues(new Uint32Array(4))].join('.')
    const frame = document.createElement('iframe')
    frame.sandbox.add('allow-scripts')
    frame.hidden = true
    frame.title = '代码运行环境'
    frame.srcdoc = sandboxDocument

    const result: RunResult = { output: '', diagnostics: [] }
    let started = false
    let ready = false
    let outputMessages = 0
    let finished = false
    let timer = window.setTimeout(() => finish({ severity: 'error', message: '启动运行环境超时。请重试。' }), bootTimeout)

    function finish(entry?: Diagnostic) {
      if (finished) return
      finished = true
      if (entry) result.diagnostics.push(entry)
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      signal?.removeEventListener('abort', stop)
      frame.contentWindow?.postMessage({ kind: 'stop', token }, '*')
      frame.remove()
      resolve(result)
    }

    function stop() {
      finish({ severity: 'warning', message: '运行已停止。' })
    }

    function onMessage(event: MessageEvent<unknown>) {
      if (!started || event.source !== frame.contentWindow || event.origin !== 'null'
        || !isRunnerRecord(event.data) || event.data.token !== token) return
      const data = parseRunnerMessage(event.data)
      if (!data) return finish({ severity: 'error', message: '运行环境返回的数据格式无效。' })
      if (data.kind === 'ready' && ready) return
      if (!ready && data.kind !== 'ready' && data.kind !== 'failure') {
        return finish({ severity: 'error', message: '运行环境尚未就绪。' })
      }
      switch (data.kind) {
        case 'ready':
          ready = true
          window.clearTimeout(timer)
          timer = window.setTimeout(() => finish({ severity: 'error', message: '运行超过 5 秒，已停止。请检查循环或减少计算量。' }), runTimeout)
          break
        case 'output':
          if (++outputMessages > maxRunnerOutputMessages) return finish({ severity: 'error', message: '运行输出超过上限。' })
          result.output += data.text.slice(0, maxBrowserOutput - result.output.length)
          break
        case 'diagnostic':
          if (result.diagnostics.length >= maxRunnerDiagnostics - 1) return finish({ severity: 'error', message: '运行诊断超过上限。' })
          result.diagnostics.push(data.diagnostic)
          break
        case 'done':
          finish()
          break
        case 'failure':
          finish({ severity: 'error', message: `无法启动运行环境。${data.message ? ` ${data.message}` : ''}` })
      }
    }

    window.addEventListener('message', onMessage)
    signal?.addEventListener('abort', stop, { once: true })
    frame.addEventListener('load', async () => {
      if (finished) return
      try {
        const assets = await prepareAssets(language)
        if (!finished && frame.contentWindow) {
          started = true
          frame.contentWindow.postMessage({ kind: 'start', workerSource, input: request, assets, token }, '*')
        }
      } catch (error) {
        finish({ severity: 'error', message: error instanceof Error ? error.message : '无法加载运行环境文件。' })
      }
    }, { once: true })
    document.body.append(frame)
  })
}
