import acornURL from 'acorn?url&no-inline'
import pythonWasmURL from 'pyodide/pyodide.asm.wasm?url&no-inline'
import pythonStdlibURL from 'pyodide/python_stdlib.zip?url&no-inline'
import pythonLockURL from 'pyodide/pyodide-lock.json?url&no-inline'
import sqlLoaderURL from 'sql.js/dist/sql-wasm-browser.js?url&no-inline'
import sqlWasmURL from 'sql.js/dist/sql-wasm-browser.wasm?url&no-inline'
import { makeHtmlPreview } from './preview'
import sandboxDocument from './runner.frame.html?raw'
import workerSource from './runner.worker.js?raw'

export type RunLanguage = 'python' | 'javascript' | 'sql' | 'html' | 'c' | 'java' | 'text'

export interface RunRequest {
  language: RunLanguage
  code: string
  stdin?: string
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
}

type InterpreterLanguage = 'python' | 'javascript' | 'sql'
type WorkerEvent =
  | { kind: 'ready'; token: string }
  | { kind: 'output'; token: string; text: string }
  | { kind: 'diagnostic'; token: string; diagnostic: Diagnostic }
  | { kind: 'done'; token: string }
  | { kind: 'failure'; token: string; message: string }

const assetURLs: Record<InterpreterLanguage, Record<string, string>> = {
  javascript: { acorn: acornURL },
  python: { wasm: pythonWasmURL, stdlib: pythonStdlibURL, lock: pythonLockURL },
  sql: { loader: sqlLoaderURL, wasm: sqlWasmURL },
}

const assetCache = new Map<string, Promise<Blob>>()
const maxSourceLength = 256_000
const maxOutputLength = 24_000
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
  if (request.code.length > maxSourceLength || (request.stdin?.length ?? 0) > maxSourceLength) {
    return diagnostic('代码或标准输入超过运行上限。请缩短后重试。')
  }

  const { language } = request
  switch (language) {
    case 'html': {
      const { preview, sanitized } = makeHtmlPreview(request.code)
      return {
        output: '',
        preview,
        diagnostics: sanitized ? [{ severity: 'warning', message: '静态预览已移除脚本、外部链接或不受支持的内容。' }] : [],
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

    function onMessage(event: MessageEvent<WorkerEvent>) {
      if (event.source !== frame.contentWindow || event.origin !== 'null' || event.data?.token !== token) return
      const data = event.data
      switch (data.kind) {
        case 'ready':
          window.clearTimeout(timer)
          timer = window.setTimeout(() => finish({ severity: 'error', message: '运行超过 5 秒，已停止。请检查循环或减少计算量。' }), runTimeout)
          break
        case 'output':
          result.output += data.text.slice(0, maxOutputLength - result.output.length)
          break
        case 'diagnostic':
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
        if (!finished) frame.contentWindow?.postMessage({ kind: 'start', workerSource, input: request, assets, token }, '*')
      } catch (error) {
        finish({ severity: 'error', message: error instanceof Error ? error.message : '无法加载运行环境文件。' })
      }
    }, { once: true })
    document.body.append(frame)
  })
}
