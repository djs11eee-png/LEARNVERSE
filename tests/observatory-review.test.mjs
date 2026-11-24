import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'
import { startTestServer } from './helpers/vite.mjs'

let server
let browser
before(async () => {
  server = await startTestServer()
  browser = await chromium.launch().catch(() => chromium.launch({ channel: 'msedge' }))
})
after(async () => {
  try { await browser?.close() } finally { await server?.close() }
})

async function openReview(options) {
  const page = await browser.newPage(options)
  try {
    await page.goto(server.origin + '/ui-review')
    await page.getByRole('heading', { name: '观测站联络台' }).waitFor({ timeout: 8000 })
    return page
  } catch (error) {
    await page.close()
    throw error
  }
}

async function loginDemo(page) {
  const auth = page.getByRole('dialog', { name: '登录观测站' })
  await auth.getByLabel('用户名或邮箱', { exact: true }).fill('observer')
  await auth.getByLabel('密码', { exact: true }).fill('sample-1234')
  const answer = await auth.getByRole('img', { name: '图形验证码' }).evaluate(img => {
    const svg = new DOMParser().parseFromString(decodeURIComponent(img.src.split(',')[1]), 'image/svg+xml')
    return Array.from(svg.querySelectorAll('text'), node => node.textContent).join('')
  })
  await auth.getByLabel('验证码', { exact: true }).fill(answer)
  await auth.getByRole('button', { name: '登录并继续' }).click()
}

test('guest auth appears on demand, traps Tab and restores the trigger', async () => {
  const page = await openReview({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  try {
    assert.equal(await page.locator('dialog[open]').count(), 0)
    const trigger = page.getByRole('button', { name: '同步卡册' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: '登录观测站' })
    await dialog.getByRole('heading').waitFor()
    await page.keyboard.press('Tab')
    assert.equal(await dialog.getByRole('button', { name: '关闭登录弹窗' }).evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await dialog.getByRole('button', { name: '继续游客探索' }).evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true)
  } finally { await page.close() }
})

test('mobile keeps bottom-left Vesper clear of editor and opens a structured diagnosis from a fresh error', async () => {
  const page = await openReview({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  try {
    const editor = page.locator('.code-workbench-editor textarea')
    const bubble = page.getByRole('button', { name: '打开 Vesper 小助手' })
    const box = await bubble.boundingBox()
    assert.ok(box && box.x < 100, 'mobile Vesper should dock on the bottom-left')
    await bubble.tap()
    await page.getByRole('dialog', { name: '登录观测站' }).getByText('登录后即可和 Vesper 对话。').waitFor()
    await page.keyboard.press('Escape')
    await editor.focus()
    await bubble.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '运行代码', exact: true }).click()
    await page.getByRole('button', { name: '一键带错问小助手' }).click()
    const auth = page.getByRole('dialog', { name: '登录观测站' })
    await auth.getByLabel('用户名或邮箱', { exact: true }).fill('observer')
    await auth.getByLabel('密码', { exact: true }).fill('sample-1234')
    await auth.getByLabel('验证码', { exact: true }).fill('0000')
    await auth.getByRole('button', { name: '登录并继续' }).click()
    await auth.getByRole('alert').filter({ hasText: '验证码不正确' }).waitFor()
    const answer = await auth.getByRole('img', { name: '图形验证码' }).evaluate(img => {
      const svg = new DOMParser().parseFromString(decodeURIComponent(img.src.split(',')[1]), 'image/svg+xml')
      return Array.from(svg.querySelectorAll('text'), node => node.textContent).join('')
    })
    await auth.getByLabel('验证码', { exact: true }).fill(answer)
    await auth.getByRole('button', { name: '登录并继续' }).click()
    const drawer = page.getByRole('dialog', { name: '和 Vesper 对话' })
    await drawer.getByRole('heading', { name: '代码片段引用' }).waitFor()
    await drawer.getByRole('button', { name: '发送给 Vesper' }).click()
    await drawer.getByRole('heading', { name: '报错诊断' }).waitFor()
    await drawer.getByRole('button', { name: '展开提示 1' }).click()
    await drawer.getByText('检查循环结束的位置', { exact: false }).waitFor()
    await drawer.getByRole('button', { name: '展开至全屏' }).click()
    assert.equal(await drawer.evaluate(el => Math.abs(el.getBoundingClientRect().height - visualViewport.height) <= 1), true)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.keyboard.press('Escape')
    await editor.fill('console.log(42)')
    assert.equal(await page.getByRole('button', { name: '一键带错问小助手' }).count(), 0)
  } finally { await page.close() }
})

test('desktop Vesper docks bottom-left, supports click, drag, left-edge fold and upper-right gaze bubble', async () => {
  const page = await openReview({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  try {
    const pet = page.getByRole('button', { name: '打开 Vesper 桌宠对话' })
    const start = await pet.boundingBox()
    assert.ok(start && start.x < 260 && start.y > 450, 'desktop Vesper should dock on the bottom-left')

    // Single click opens auth / chat
    await pet.click()
    const auth = page.getByRole('dialog', { name: '登录观测站' })
    await auth.getByText('登录后即可和 Vesper 对话。').waitFor()
    await page.keyboard.press('Escape')
    await auth.waitFor({ state: 'hidden' })

    // Drag moves Vesper without opening dialog (dx = +160, dy = -80)
    await page.mouse.move(start.x + 60, start.y + 80)
    await page.mouse.down()
    await page.mouse.move(start.x + 220, start.y, { steps: 8 })
    await page.mouse.up()
    assert.equal(await page.locator('dialog[open]').count(), 0)
    const movedBox = await pet.boundingBox()
    assert.ok(movedBox && movedBox.x > start.x + 120 && movedBox.y < start.y - 40, 'drag should move Vesper in both X and Y')

    // Preview thinking illuminates upper-right gaze bubble
    await page.getByRole('button', { name: '思考中', exact: true }).click()
    const gaze = page.locator('.lvo-gaze[data-visible="true"][data-kind="thinking"]')
    await gaze.waitFor()
    const gazeBox = await gaze.boundingBox()
    const petNow = await pet.boundingBox()
    assert.ok(gazeBox && petNow && gazeBox.x > petNow.x && gazeBox.y < petNow.y + 80, 'thinking gaze bubble must sit upper-right of Vesper')

    // Fold to left edge and restore with keyboard Enter
    await page.getByRole('button', { name: '折叠桌宠' }).click()
    const restore = page.getByRole('button', { name: '恢复 Vesper 桌宠' })
    await restore.waitFor()
    assert.equal(await restore.evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Enter')
    await pet.waitFor()
    assert.equal(await pet.evaluate(el => el === document.activeElement), true)
  } finally { await page.close() }
})

test('Vesper enters success after reply, immediately interrupts success on new prompt, and auto-returns to idle', async () => {
  const page = await openReview({ viewport: { width: 1360, height: 840 }, reducedMotion: 'reduce' })
  try {
    await page.getByRole('button', { name: '和 Vesper 对话' }).click()
    await loginDemo(page)
    const drawer = page.getByRole('dialog', { name: '和 Vesper 对话' })
    await drawer.waitFor()

    // Ask first question -> thinking -> success
    const input = drawer.getByLabel('给 Vesper 的问题')
    await input.fill('帮我总结一套快速定位语法错误的三步法。')
    await drawer.getByRole('button', { name: '发送给 Vesper' }).click()
    await drawer.locator('[data-mood="success"]').first().waitFor({ timeout: 5000 })

    // Immediately interrupt ongoing success with a new question (must not block!)
    await input.fill('那运行时报错应该怎么排查？')
    await drawer.getByRole('button', { name: '发送给 Vesper' }).click()
    // Should finish second turn cleanly and settle back to success -> then auto-return to idle
    await drawer.getByText('那运行时报错应该怎么排查？').waitFor()
    await drawer.locator('.lvo-turn').nth(1).locator('.lvo-markdown').waitFor({ timeout: 5000 })
    // Auto-return to idle (reducedMotion fallback timer is 2400ms)
    await page.waitForFunction(() => document.querySelector('.lvo-drawer')?.getAttribute('data-mood') === 'idle', null, { timeout: 6000 })
  } finally { await page.close() }
})
