(() => {
  const send = globalThis.postMessage.bind(globalThis)
  const maxOutput = 24_000
  const maxMessages = 300
  const maxDiagnostics = 30
  const maxDisplay = 4_000
  const jsFilename = 'learnverse.js'
  const pythonFilename = 'learnverse.py'

  function disableGlobal(name) {
    for (let owner = globalThis; owner; owner = Object.getPrototypeOf(owner)) {
      const property = Object.getOwnPropertyDescriptor(owner, name)
      if (property?.configurable) Object.defineProperty(owner, name, { value: undefined })
    }
  }

  async function importAsset(asset) {
    const url = URL.createObjectURL(new Blob([asset], { type: 'text/javascript' }))
    try {
      return await import(url)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  function displayValues(values) {
    let text = ''
    const append = (part) => { text += part.slice(0, maxDisplay - text.length) }
    const full = () => text.length >= maxDisplay

    function show(value, depth) {
      if (full()) return
      if (value === null || typeof value !== 'object') {
        append(typeof value === 'string' ? value : String(value))
      } else if (value instanceof Error) {
        append(String(value.name))
        append(': ')
        append(String(value.message))
      } else if (depth > 2) {
        append(Array.isArray(value) ? '[…]' : '{…}')
      } else if (Array.isArray(value)) {
        append('[')
        for (let index = 0; index < Math.min(value.length, 30) && !full(); index++) {
          if (index > 0) append(', ')
          if (index in value) show(value[index], depth + 1)
        }
        append(value.length > 30 ? ', …]' : ']')
      } else {
        append('{')
        let count = 0
        for (const key in value) {
          if (full()) break
          if (!Object.hasOwn(value, key)) continue
          if (count++) append(', ')
          if (count > 12) { append('…'); break }
          append(key)
          append(': ')
          show(value[key], depth + 1)
        }
        append('}')
      }
    }

    for (let index = 0; index < values.length && !full(); index++) {
      if (index > 0) append(' ')
      show(values[index], 0)
    }
    return text
  }

  function jsLocation(error) {
    const stack = error?.stack
    const match = typeof stack === 'string' ? stack.match(/learnverse\.js:(\d+):(\d+)/) : null
    return match ? { line: Number(match[1]), column: Number(match[2]) } : {}
  }

  async function javascript(input, assets, reporter) {
    const acorn = await importAsset(assets.acorn)
    reporter.ready()

    try {
      acorn.parse(input.code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true })
    } catch (error) {
      reporter.diagnostic('error', `SyntaxError: ${error.message.replace(/ \(\d+:\d+\)$/, '')}`, {
        line: error.loc?.line,
        column: error.loc ? error.loc.column + 1 : undefined,
      })
      return
    }

    for (const method of ['log', 'info', 'debug', 'dir', 'table']) {
      console[method] = (...values) => {
        if (reporter.full()) return
        reporter.append(`${displayValues(values)}\n`)
      }
    }
    for (const [method, severity] of [['warn', 'warning'], ['error', 'error']]) {
      console[method] = (...values) => {
        reporter.diagnostic(severity, displayValues(values), jsLocation(new Error()))
      }
    }

    try {
      const evaluated = (0, eval)(`${input.code}\n//# sourceURL=${jsFilename}`)
      if (evaluated instanceof Promise) await evaluated
    } catch (error) {
      reporter.diagnostic('error', displayValues([error]), jsLocation(error))
    }
  }

  async function loadPython(assets) {
    const { loadPyodide } = await importAsset(assets.loader)
    const { default: createPyodideModule } = await importAsset(assets.core)
    const runtimeBase = 'https://learnverse.invalid/python/'
    const localFiles = new Map([
      [`${runtimeBase}pyodide.asm.wasm`, [assets.wasm, 'application/wasm']],
      [`${runtimeBase}python_stdlib.zip`, [assets.stdlib, 'application/zip']],
    ])

    // Pyodide expects file URLs. Resolve its two binary files in memory while
    // starting up. The worker's CSP keeps the actual network disabled.
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (resource) => {
      const file = localFiles.get(String(resource))
      if (!file) throw new TypeError('Only bundled Python runtime assets are available.')
      return new Response(file[0], { headers: { 'Content-Type': file[1] } })
    }

    try {
      return await loadPyodide({
        indexURL: runtimeBase,
        packageBaseUrl: runtimeBase,
        lockFileContents: await assets.lock.text(),
        createPyodideModule,
        enableRunUntilComplete: typeof WebAssembly.Suspending === 'function',
        stdout: () => {},
        stderr: () => {},
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  }

  async function python(input, assets, reporter) {
    const interpreter = await loadPython(assets)
    const text = input.stdin ?? ''
    const lineBreak = /\r\n?|\n/g
    let offset = 0
    const decoder = new TextDecoder()
    interpreter.setStdin({ stdin: () => {
      if (offset >= text.length) return null
      const delimiter = lineBreak.exec(text)
      const line = text.slice(offset, delimiter?.index ?? text.length)
      offset = delimiter ? lineBreak.lastIndex : text.length
      return line
    }, isatty: false })
    interpreter.setStdout({ write: (bytes) => {
      if (!reporter.full()) reporter.append(decoder.decode(bytes, { stream: true }))
      return bytes.length
    } })
    interpreter.setStderr({ batched: (line) => {
      const warning = line.match(/^learnverse\.py:(\d+): (.+)$/)
      if (warning) reporter.diagnostic('warning', warning[2], { line: Number(warning[1]) })
      else if (!line.startsWith('  ')) reporter.diagnostic('warning', line)
    } })

    reporter.ready()
    try {
      await interpreter.runPythonAsync(input.code, { filename: pythonFilename, dedent: false })
    } catch (error) {
      const traceback = String(error.message ?? error).trim()
      const frames = [...traceback.matchAll(/File "learnverse\.py", line (\d+)[^\n]*(?:\n[^\n]*)?(?:\n( +)\^)?/g)]
      const frame = frames.at(-1)
      reporter.diagnostic('error', traceback.split('\n').at(-1) || 'PythonError', {
        line: frame ? Number(frame[1]) : undefined,
        column: frame?.[2] ? Math.max(1, frame[2].length - 3) : undefined,
      })
    } finally {
      reporter.append(decoder.decode())
    }
  }

  async function loadSQL(assets) {
    const loader = URL.createObjectURL(new Blob([assets.loader], { type: 'text/javascript' }))
    try {
      importScripts(loader)
    } finally {
      URL.revokeObjectURL(loader)
    }
    return globalThis.initSqlJs({ wasmBinary: await assets.wasm.arrayBuffer(), useOldExtensionFunctions: false })
  }

  function field(value) {
    if (value instanceof Uint8Array) return `<BLOB ${value.length} 字节>`
    if (value === null) return 'NULL'
    return String(value).replace(/[\n\r\t]/g, ' ').slice(0, 500)
  }

  async function sql(input, assets, reporter) {
    const SQL = await loadSQL(assets)
    const database = new SQL.Database()
    let rowCount = 0
    let hasColumns = false
    reporter.ready()

    try {
      for (const statement of database.iterateStatements(input.code)) {
        const columns = statement.getColumnNames()
        if (columns.length > 0) {
          if (hasColumns) reporter.append('\n')
          hasColumns = true
          reporter.append(`${columns.map(field).join('\t')}\n`)
        }
        while (statement.step()) {
          if (++rowCount > 200 || reporter.full()) {
            reporter.diagnostic('warning', '查询结果已截断。请缩小查询范围。')
            return
          }
          reporter.append(`${statement.get().map(field).join('\t')}\n`)
        }
      }
      if (!hasColumns) reporter.append('语句已执行。\n')
    } catch (error) {
      reporter.diagnostic('error', `SQLite: ${error.message ?? error}`)
    } finally {
      database.close()
    }
  }

  addEventListener('message', async ({ data: { input, assets, token } }) => {
    const post = (data) => send({ ...data, token })
    let outputLength = 0
    let messages = 0
    let diagnostics = 0
    let truncated = false
    const full = () => outputLength >= maxOutput || messages >= maxMessages
    const reporter = {
      full,
      ready: () => post({ kind: 'ready' }),
      append(text) {
        if (!text) return
        const chunk = full() ? '' : text.slice(0, maxOutput - outputLength)
        outputLength += chunk.length
        if (chunk) {
          messages++
          post({ kind: 'output', text: chunk })
        }
        if (!truncated && (chunk.length < text.length || full())) {
          truncated = true
          reporter.diagnostic('warning', '输出达到显示上限。')
        }
      },
      diagnostic(severity, message, location = {}) {
        if (diagnostics >= maxDiagnostics || (diagnostics >= maxDiagnostics - 1 && severity === 'warning')) return
        diagnostics++
        post({ kind: 'diagnostic', diagnostic: { severity, message: message.slice(0, 4_000), ...location } })
      },
    }

    // Keep the runner's message channel private and prevent nested workers.
    for (const name of ['postMessage', 'Worker', 'SharedWorker', 'BroadcastChannel', 'close']) disableGlobal(name)

    try {
      const run = { python, javascript, sql }[input.language]
      await run(input, assets, reporter)
      post({ kind: 'done' })
    } catch (error) {
      post({ kind: 'failure', message: displayValues([error]) })
    }
  }, { once: true })
})()
