import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'
import { startTestServer } from './helpers/vite.mjs'

const origin = process.env.LEARNVERSE_TEST_ORIGIN ?? 'http://127.0.0.1:4177'
let server
let browser

before(async () => {
  if (!process.env.LEARNVERSE_TEST_ORIGIN) {
    server = await startTestServer(4177)
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await fetch(origin).then((response) => response.ok).catch(() => false)) break
    if (attempt === 99) throw new Error(`Timed out waiting for ${origin}`)
    await delay(125)
  }
  browser = await chromium.launch().catch(() => chromium.launch({ channel: 'msedge' }))
})

after(async () => {
  try { await browser?.close() }
  finally { await server?.close() }
})

async function withPage(callback) {
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, isMobile: true })
  try {
    const harness = `${origin}/runner-test-host`
    await page.route(harness, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Runner test host</title><body></body>' }))
    await page.goto(harness)
    await callback(page)
  } finally {
    await page.close()
  }
}

function run(page, request) {
  return page.evaluate(async (request) => {
    const { runCode } = await import('/src/code/runner.ts')
    return runCode(request)
  }, request)
}

test('JavaScript executes in a browser worker and reports syntax, runtime errors, and warnings', () => withPage(async (page) => {
  const result = await run(page, { language: 'javascript', code: 'console.log([1, 2].map(n => n * 2));\nconsole.warn("check");\nmissing()' })
  assert.match(result.output, /2.*4/)
  assert.ok(result.diagnostics.some((entry) => entry.severity === 'warning' && entry.message.includes('check') && entry.line === 2))
  assert.ok(result.diagnostics.some((entry) => entry.severity === 'error' && entry.message.includes('ReferenceError') && entry.line === 3 && entry.column === 1))

  const syntax = await run(page, { language: 'javascript', code: 'const title = "Learnverse";\nlet = ;' })
  assert.ok(syntax.diagnostics.some((entry) => entry.severity === 'error' && entry.line === 2 && entry.column === 7))
}))

test('Python uses real input, the standard library, and traceback locations', () => withPage(async (page) => {
  const result = await run(page, { language: 'python', stdin: 'Ada\r\n5', code: 'import math, warnings\nname = input("Name? ")\nprint(name, math.sqrt(int(input())+4))\nwarnings.warn("check")\ndef validate():\n    raise ValueError("broken")\nvalidate()' })
  assert.equal(result.output.trim(), 'Name? Ada 3.0', JSON.stringify(result))
  assert.ok(result.diagnostics.some((entry) => entry.severity === 'warning' && entry.message.includes('check') && entry.line === 4))
  assert.ok(result.diagnostics.some((entry) => entry.severity === 'error' && entry.message.includes('ValueError: broken') && entry.line === 6), JSON.stringify(result))

  const syntax = await run(page, { language: 'python', code: 'print("ok")\nif True\n    print("broken")' })
  assert.ok(syntax.diagnostics.some((entry) => entry.severity === 'error' && entry.message.includes('SyntaxError') && entry.line === 2))
}))

test('SQL runs actual SQLite statements and reports errors', () => withPage(async (page) => {
  const result = await run(page, { language: 'sql', code: 'CREATE TABLE planet (name TEXT, moons INT); INSERT INTO planet VALUES (\'Earth\', 1), (\'Mars\', 2); SELECT sum(moons) AS total_moons FROM planet;' })
  assert.match(result.output, /total_moons\s+3/)
  assert.deepEqual(result.diagnostics, [])

  const error = await run(page, { language: 'sql', code: 'SELECT * FROM unknown_table;' })
  assert.ok(error.diagnostics.some((entry) => entry.severity === 'error' && entry.message.includes('no such table: unknown_table')))
}))

test('runner validates result shapes and applies language and preview limits', () => withPage(async (page) => {
  const result = await page.evaluate(async () => {
    const { parseRunnerMessage, parseNativeResult } = await import('/src/code/runnerProtocol.ts')
    const { runCode } = await import('/src/code/runner.ts')
    const valid = { severity: 'warning', message: '检查输入', line: 2 }
    const image = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==">'
    const preview = await runCode({ language: 'html', code: image.repeat(20) + '<p>保留正文</p>' })
    const tooManyLines = await runCode({ language: 'html', code: '\n'.repeat(12_001) })
    return {
      valid: parseRunnerMessage({ kind: 'diagnostic', diagnostic: valid }),
      badOutput: parseRunnerMessage({ kind: 'output', text: 12 }) === undefined,
      badLine: parseRunnerMessage({ kind: 'diagnostic', diagnostic: { ...valid, line: 0 } }) === undefined,
      badNative: parseNativeResult({ output: 'ok', diagnostics: 'warning' }) === undefined,
      goodNative: parseNativeResult({ output: 'ok', diagnostics: [valid] }),
      previewImageCount: preview.preview.match(/src="data:image/g)?.length,
      previewText: preview.preview.includes('保留正文'),
      previewNotice: preview.diagnostics.some(({ severity }) => severity === 'warning'),
      oversized: tooManyLines.diagnostics.some(({ severity }) => severity === 'error'),
    }
  })
  assert.deepEqual(result, {
    valid: { kind: 'diagnostic', diagnostic: { severity: 'warning', message: '检查输入', line: 2 } },
    badOutput: true, badLine: true, badNative: true,
    goodNative: { output: 'ok', diagnostics: [{ severity: 'warning', message: '检查输入', line: 2 }] },
    previewImageCount: 8, previewText: true, previewNotice: true, oversized: true,
  })
}))

test('the runner denies network and origin storage access and stops infinite loops', () => withPage(async (page) => {
  const canaryURL = `${origin}/runner-network-canary`
  const requests = []
  page.on('request', (request) => { if (request.url() === canaryURL) requests.push(request.url()) })
  const isolated = await run(page, { language: 'javascript', code: `(async () => {
    console.log(self.origin, typeof localStorage);
    try { await fetch(${JSON.stringify(canaryURL)}); console.log('bad network'); }
    catch { console.log('network denied'); }
    try { indexedDB.open('canary'); console.log('bad storage'); }
    catch { console.log('storage denied'); }
  })()` })
  assert.match(isolated.output, /null undefined\nnetwork denied\nstorage denied/)
  assert.deepEqual(requests, [])

  const workerStarted = page.waitForEvent('worker')
  const stopping = page.evaluate(async () => {
    const { runCode } = await import('/src/code/runner.ts')
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 500)
    return runCode({ language: 'javascript', code: 'while (true) {}' }, controller.signal)
  })
  const worker = await workerStarted
  const workerClosed = worker.waitForEvent('close', { timeout: 3_000 })
  const stopped = await stopping
  assert.ok(stopped.diagnostics.some((entry) => entry.severity === 'warning' && entry.message.includes('停止')))
  await workerClosed

  const timedOut = await run(page, { language: 'javascript', code: 'console.log("started"); while (true) {}' })
  assert.equal(timedOut.output.trim(), 'started')
  assert.ok(timedOut.diagnostics.some((entry) => entry.severity === 'error' && entry.message.includes('5 秒')))
  assert.equal((await run(page, { language: 'javascript', code: 'console.log("ready")' })).output.trim(), 'ready')
}))

test('HTML preview remains static and removes embedded scripts and network sources', () => withPage(async (page) => {
  const canaryURL = `${origin}/preview-network-canary`
  const requests = []
  page.on('request', (request) => { if (request.url() === canaryURL) requests.push(request.url()) })
  const result = await run(page, { language: 'html', code: `<h1>Station log</h1><img src="${canaryURL}" onerror="alert(1)"><a href="${canaryURL}">Next</a><a href="#notes">Jump to notes</a><style>@import url(${canaryURL}); p { color: red; }</style><p id="notes">Notes</p><form action="${canaryURL}"><label>Topic <input name="topic" required></label><button type="submit">Submit</button></form><script>document.body.innerHTML = 'replaced'</script><iframe src="${canaryURL}"></iframe>` })
  assert.ok(result.preview)
  await page.evaluate((preview) => {
    const frame = document.createElement('iframe')
    frame.sandbox = ''
    frame.id = 'test-preview'
    frame.srcdoc = preview
    document.body.append(frame)
  }, result.preview)
  const frame = page.frameLocator('#test-preview')
  await frame.getByRole('heading', { name: 'Station log' }).waitFor()
  assert.equal(await frame.getByText('Notes', { exact: true }).evaluate((element) => getComputedStyle(element).color), 'rgb(255, 0, 0)')
  assert.equal(await frame.getByText('Next', { exact: true }).getAttribute('href'), null)
  const previewFrame = await (await page.locator('#test-preview').elementHandle()).contentFrame()
  assert.ok(previewFrame)
  await Promise.all([
    previewFrame.waitForURL('about:srcdoc#notes'),
    frame.getByRole('link', { name: 'Jump to notes' }).click(),
  ])
  assert.equal(await frame.locator('script,iframe,[onerror]').count(), 0)
  assert.equal(await frame.locator('form').getAttribute('action', { timeout: 3_000 }), null)
  await frame.getByRole('textbox', { name: 'Topic' }).fill('HTML')
  await frame.getByRole('button', { name: 'Submit' }).click()
  assert.deepEqual(requests, [])
}))

test('controlled interactive HTML preview runs same-page DOM scripts while blocking network, inline handlers and parent access', () => withPage(async (page) => {
  const canaryURL = `${origin}/interactive-preview-canary`
  const requests = []
  page.on('request', (request) => { if (request.url() === canaryURL) requests.push(request.url()) })
  const code = `
    <main>
      <button id="btn" type="button" data-task="A">完成</button>
      <form id="f"><input name="title" value="复习"><button type="submit">新增</button></form>
      <p id="out">待点击</p>
      <p id="sec">检查中</p>
      <img src="${canaryURL}" onerror="document.querySelector('#out').textContent='xss'">
      <iframe src="${canaryURL}"></iframe>
      <script src="${canaryURL}"></script>
      <script>
        const out = document.querySelector("#out");
        const sec = document.querySelector("#sec");
        document.querySelector("#btn").addEventListener("click", (e) => {
          out.textContent = "已点击：" + e.currentTarget.dataset.task;
        });
        document.querySelector("#f").addEventListener("submit", (e) => {
          e.preventDefault();
          out.textContent = "表单提交：" + new FormData(e.currentTarget).get("title");
        });
        let blockedFetch = false;
        let blockedParent = false;
        try { fetch(${JSON.stringify(canaryURL)}); } catch { blockedFetch = true; }
        try { void window.parent.document.title; } catch { blockedParent = true; }
        sec.textContent = "fetch:" + blockedFetch + ",parent:" + blockedParent;
      </script>
    </main>
  `
  const result = await run(page, { language: 'html', code, interactivePreview: true, previewToken: 'test-token' })
  assert.equal(result.previewInteractive, true)
  assert.ok(result.preview)
  await page.evaluate((preview) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts allow-forms')
    frame.id = 'interactive-test-preview'
    frame.srcdoc = preview
    document.body.append(frame)
  }, result.preview)
  const frame = page.frameLocator('#interactive-test-preview')
  await frame.locator('#sec').filter({ hasText: 'fetch:true,parent:true' }).waitFor()
  assert.equal(await frame.locator('iframe,[onerror],script[src]').count(), 0)
  await frame.locator('#btn').click()
  await frame.locator('#out').filter({ hasText: '已点击：A' }).waitFor()
  await frame.getByRole('button', { name: '新增' }).click()
  await frame.locator('#out').filter({ hasText: '表单提交：复习' }).waitFor()
  assert.deepEqual(requests, [])
}))
