import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'
import { startTestServer } from './helpers/vite.mjs'

let server
let browser
let origin

before(async () => {
  server = await startTestServer()
  origin = server.origin
  browser = await chromium.launch().catch(() => chromium.launch({ channel: 'msedge' }))
})

after(async () => {
  try { await browser?.close() }
  finally { await server?.close() }
})

async function inBrowser(run) {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  try {
    await run(context)
  } finally {
    await context.close()
  }
}

const field = (page, name) => page.locator('.lab-free-practice').getByRole('textbox', { name, exact: true })

async function openLab(page, url = origin) {
  await page.bringToFront()
  await page.goto(url + '/lab')
  const pack = page.getByRole('dialog', { name: '知识补给包' })
  await pack.getByRole('button', { name: '关闭', exact: true }).click()
  await pack.waitFor({ state: 'hidden' })
}

test('different tabs merge code and input while reading legacy drafts', () => inBrowser(async (context) => {
  const a = await context.newPage()
  const b = await context.newPage()
  await a.addInitScript(() => {
    const key = 'learnverse:code-draft:python:lab/free'
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ code: 'print("legacy")', input: 'legacy input' }))
  })
  await openLab(a)
  await openLab(b)
  assert.equal(await field(a, '源代码').inputValue(), 'print("legacy")')
  assert.equal(await field(b, '标准输入').inputValue(), 'legacy input')
  await a.bringToFront()
  await field(a, '源代码').fill('print("edited in A")')
  await b.bringToFront()
  await field(b, '标准输入').fill('edited in B')
  await a.reload()
  assert.equal(await field(a, '源代码').inputValue(), 'print("edited in A")')
  assert.equal(await field(a, '标准输入').inputValue(), 'edited in B')
}))

test('a failed draft edit cannot overwrite a newer saved revision of the same field', () => inBrowser(async (context) => {
  const a = await context.newPage()
  const b = await context.newPage()
  await a.addInitScript(() => {
    const set = Storage.prototype.setItem
    let fail = true
    Storage.prototype.setItem = function (key, value) {
      if (fail && key.startsWith('learnverse:code-draft')) {
        fail = false
        throw new DOMException('One-time draft failure', 'QuotaExceededError')
      }
      return set.call(this, key, value)
    }
  })
  await openLab(a)
  await openLab(b)
  await a.bringToFront()
  await field(a, '源代码').fill('print("pending edit")')
  assert.equal(await field(a, '源代码').inputValue(), 'print("pending edit")')
  await b.bringToFront()
  await field(b, '源代码').fill('print("saved edit")')
  await a.bringToFront()
  await field(a, '标准输入').fill('save the other field')
  await b.reload()
  assert.equal(await field(b, '源代码').inputValue(), 'print("saved edit")')
  assert.equal(await field(b, '标准输入').inputValue(), 'save the other field')
  assert.equal(await field(a, '源代码').inputValue(), 'print("pending edit")')
  await a.getByText(/草稿.*未保存/).waitFor()
  const selectSaved = a.getByRole('button', { name: '使用其他标签页的版本', exact: true })
  await selectSaved.click()
  await selectSaved.waitFor({ state: 'hidden' })
  assert.equal(await field(a, '源代码').inputValue(), 'print("saved edit")')
}))

test('an oversized legacy draft remains available for download without loading it into the editor', () => inBrowser(async (context) => {
  const page = await context.newPage()
  const legacyKey = 'learnverse:code-draft:python:lab/free'
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ code: '# legacy\n'.repeat(12_001), input: 'older input' }))
  }, legacyKey)
  await openLab(page)
  const editor = field(page, '源代码')
  const starter = await editor.inputValue()
  assert.match(starter, /LEARNVERSE/)
  await page.getByText(/已保存的草稿超过编辑器上限/).waitFor()
  assert.equal(await field(page, '标准输入').inputValue(), 'older input')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载原草稿', exact: true }).click()
  const download = await downloadEvent
  assert.equal(download.suggestedFilename(), 'learnverse-原草稿.txt')

  const accepted = await editor.evaluate((element) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', '\n'.repeat(12_001))
    const event = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
    return element.dispatchEvent(event)
  })
  assert.equal(accepted, false)
  await page.getByText(/源代码最多.*此次编辑未应用/).waitFor()
  assert.equal(await editor.inputValue(), starter)
  const legacyLength = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).code.length, legacyKey)
  assert.equal(legacyLength, '# legacy\n'.length * 12_001)
}))

test('accepting another tab’s conflicting code preserves the pending input', () => inBrowser(async (context) => {
  const a = await context.newPage()
  const b = await context.newPage()
  await a.addInitScript(() => {
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (!window.draftWritesRestored && key.startsWith('learnverse:code-draft')) {
        throw new DOMException('Draft storage temporarily unavailable', 'QuotaExceededError')
      }
      return set.call(this, key, value)
    }
  })
  await openLab(a)
  await openLab(b)
  await a.bringToFront()
  await field(a, '源代码').fill('print("A code")')
  await a.getByRole('button', { name: '重试保存草稿', exact: true }).waitFor()
  await field(a, '标准输入').fill('A unsaved input')
  await b.bringToFront()
  await field(b, '源代码').fill('print("B code")')
  await a.bringToFront()
  const selectSaved = a.getByRole('button', { name: '使用其他标签页的版本', exact: true })
  await selectSaved.waitFor()
  await a.evaluate(() => { window.draftWritesRestored = true })
  await selectSaved.click()
  await a.getByText(/草稿修改未保存/).waitFor({ state: 'hidden' })
  assert.equal(await field(a, '源代码').inputValue(), 'print("B code")')
  assert.equal(await field(a, '标准输入').inputValue(), 'A unsaved input')
  await b.reload()
  assert.equal(await field(b, '标准输入').inputValue(), 'A unsaved input')
}))

test('failed time entries are reported, then saved on top of other tabs’ progress', () => inBrowser(async (context) => {
  const a = await context.newPage()
  const b = await context.newPage()
  await a.addInitScript(() => {
    const set = Storage.prototype.setItem
    let fail = true
    Storage.prototype.setItem = function (key, value) {
      if (fail && key === 'learnverse.learning-progress.v1') {
        fail = false
        throw new DOMException('One-time progress failure', 'QuotaExceededError')
      }
      return set.call(this, key, value)
    }
  })
  await a.goto(origin + '/my-universe#study')
  await b.goto(origin + '/my-universe#study')
  async function record(page, minutes) {
    await page.bringToFront()
    await page.getByLabel('记录学习时长', { exact: true }).fill(String(minutes))
    await page.getByRole('button', { name: '记录', exact: true }).click()
  }
  await record(a, 25)
  await a.getByText('25 分钟', { exact: true }).waitFor()
  await a.getByRole('button', { name: '重试保存', exact: true }).waitFor({ timeout: 5000 })
  const falseSuccess = await a.getByText('已记录 25 分钟。', { exact: true }).count()
  await record(b, 10)
  await b.getByText('已记录 10 分钟。', { exact: true }).waitFor()
  await record(a, 5)
  await a.getByText('已记录 5 分钟。', { exact: true }).waitFor()
  await b.reload()
  const total = b.getByText('累计学习时长', { exact: true }).locator('..')
  assert.match(await total.textContent(), /40 分钟/)
  assert.equal(falseSuccess, 0)
}))

test('a correct set of labeled results in the wrong order shows the failed full-output check', () => inBrowser(async (context) => {
  const page = await context.newPage()
  const course = 'lv-javascript-foundations'
  await page.goto(origin + '/academy/' + course)
  await page.getByRole('link', { name: /结课项目/ }).click()
  const reversed = await page.evaluate(async (course) => {
    const { courseProjects } = await import('/src/data/curriculum/index.ts')
    const [first, second, ...rest] = courseProjects[course].exercises[0].expectedOutput.split('\n')
    return [second, first, ...rest].join('\n')
  }, course)
  const editor = page.getByRole('region', { name: '在这里写代码' }).first()
  await editor.getByRole('textbox', { name: '源代码' }).fill('console.log(' + JSON.stringify(reversed) + ')')
  await editor.getByRole('button', { name: '运行代码' }).click()
  await editor.getByText('输出与预期不同。', { exact: true }).waitFor()
  assert.equal(await editor.getByRole('list', { name: '用例结果' }).getByText('通过', { exact: true }).count(), 5)
  assert.equal(await editor.getByText('完整输出校验未通过：用例顺序与预期不同。', { exact: true }).count(), 1)
}))

test('favorite recovery preserves the desired setting and rapid clicks retain their order', () => inBrowser(async (context) => {
  const a = await context.newPage()
  const b = await context.newPage()
  await a.addInitScript(() => {
    const set = Storage.prototype.setItem
    let fail = true
    Storage.prototype.setItem = function (key, value) {
      if (fail && key === 'learnverse.learning-progress.v1') {
        fail = false
        throw new DOMException('One-time progress failure', 'QuotaExceededError')
      }
      return set.call(this, key, value)
    }
  })
  const bookmarkName = '收藏 Exercism Python Track'
  const bookmark = (page, pressed) => page.getByRole('button', { name: bookmarkName, exact: true, pressed })
  const library = origin + '/library?q=exercism'
  await a.goto(library)
  await b.goto(library)
  await a.bringToFront()
  await bookmark(a, false).click()
  await bookmark(a, true).waitFor()
  await b.bringToFront()
  await bookmark(b, false).click()
  await bookmark(b, true).waitFor()
  await a.bringToFront()
  await a.getByRole('link', { name: '学习记录', exact: true }).click()
  await a.getByRole('button', { name: '重试保存', exact: true }).click()
  await a.getByText('暂存的学习记录已保存。', { exact: true }).waitFor()
  await b.reload()
  assert.equal(await bookmark(b).getAttribute('aria-pressed'), 'true')

  await bookmark(b).evaluate(async (button) => {
    const key = 'learnverse.learning-progress.v1'
    await navigator.locks.request(key, () => {
      button.click()
      button.click()
    })
    // Wait for both queued progress writes instead of sampling the previous value.
    await navigator.locks.request(key, () => {})
  })
  await b.reload()
  assert.equal(await bookmark(b).getAttribute('aria-pressed'), 'true')
}))

test('the local lab can retry a failed environment check', () => inBrowser(async (context) => {
  const page = await context.newPage()
  const lab = 'http://127.0.0.1:5174'
  let checks = 0
  let ready = false
  // Serve the lab in this browser only and keep the developer's actual port untouched.
  await page.routeWebSocket('ws://127.0.0.1:5174/**', (socket) => socket.close())
  await page.route(lab + '/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/local-runner') {
      checks += 1
      return route.fulfill(ready
        ? { json: { languages: ['c'], token: 'a'.repeat(64) } }
        : { status: 503, body: 'Not ready' })
    }
    return route.fulfill({ response: await route.fetch({ url: origin + url.pathname + url.search }) })
  })
  await openLab(page, lab)
  await page.getByRole('button', { name: /编程语言/ }).click()
  await page.getByRole('option', { name: 'C · Windows 本机' }).click()
  const editor = page.locator('.lab-free-practice')
  await editor.locator('[id$="-availability"]').filter({ hasText: /安装并启动实验室.cmd/ }).waitFor({ timeout: 6000 })
  const retry = editor.getByRole('button', { name: '重新检测', exact: true })
  assert.equal(await retry.count(), 1)
  assert.ok(checks > 0)
  const beforeRetry = checks
  ready = true
  await retry.click()
  await editor.getByRole('button', { name: '运行代码', exact: true }).waitFor({ timeout: 6000 })
  assert.ok(checks > beforeRetry)

  await openLab(page)
  await page.getByRole('button', { name: /编程语言/ }).click()
  await page.getByRole('option', { name: 'C · Windows 本机' }).click()
  await editor.locator('[id$="-availability"]').filter({ hasText: /安装并启动实验室.cmd/ }).waitFor({ timeout: 6000 })
  assert.equal(await retry.count(), 0)
  assert.equal(await editor.getByRole('button', { name: '运行代码', exact: true }).count(), 0)
}))

