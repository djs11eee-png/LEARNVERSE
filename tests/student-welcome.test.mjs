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

async function openAccountAction(page, name) {
  await page.getByLabel('个人菜单').click()
  await page.getByRole('button', { name, exact: true }).click()
}

test('a new student can choose from bilingual majors, save a nickname and follow their route', async () => {
  const page = await browser.newPage({ viewport: { width: 375, height: 760 }, reducedMotion: 'reduce' })
  try {
    await page.goto(server.origin + '/academy/lv-python-foundations/learn')
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('learnverse.learning-progress.v1'))?.activeCourse === 'lv-python-foundations')
    await page.getByRole('button', { name: '选择路线', exact: true }).click()
    await page.getByLabel('计算机类专业', { exact: true }).check()
    const majors = page.getByRole('combobox', { name: '选择所学专业' })
    assert.equal(await majors.locator('optgroup option').count(), 19)
    await majors.selectOption({ label: '软件工程 · Software Engineering' })
    await page.locator('summary').filter({ hasText: '昵称与头像' }).click()
    await page.getByRole('textbox', { name: '昵称' }).fill('  小林  ')
    await page.getByRole('button', { name: '设为我的路线' }).click()
    await page.getByRole('heading', { name: '你的推荐路线' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: '软件工程', exact: true }).isVisible(), true)
    await page.getByRole('link', { name: '查看推荐路线' }).click()
    await page.waitForURL('**/explore/major-080902')
    await page.reload()
    await page.getByLabel('个人菜单').click()
    await page.getByText('小林', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('新生学习引导').count(), 0)
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('learnverse.learning-progress.v1')).activeRoute), 'major-080902')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.goto(server.origin + '/my-universe#study')
    const routeCard = page.locator('section').filter({ has: page.getByRole('heading', { name: '当前学习路线' }) }).last()
    await routeCard.getByText('软件工程', { exact: true }).waitFor()
    assert.equal(await routeCard.getByRole('link', { name: '在星图中查看' }).getAttribute('href'), '/explore/major-080902')
    await page.goto(server.origin)
    await page.getByRole('dialog', { name: 'Learnverse 开场动画' }).waitFor({ state: 'hidden' })
    assert.equal(await page.getByRole('link', { name: /当前路线.*软件工程/ }).getAttribute('href'), '/explore/major-080902')
  } finally { await page.close() }
})

test('skip persists and editing a local portrait keeps a previously chosen route', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  try {
    await page.goto(server.origin + '/academy')
    await page.getByRole('button', { name: '跳过', exact: true }).click()
    await page.reload()
    await page.getByRole('heading', { level: 1 }).waitFor()
    assert.equal(await page.getByLabel('新生学习引导').count(), 0)
    await page.evaluate(() => localStorage.setItem('learnverse.learning-progress.v1', JSON.stringify({ activeRoute: 'algorithmic-thinking' })))
    await page.reload()
    await openAccountAction(page, '个人资料')
    const fileInput = page.getByLabel('选择头像', { exact: true })
    await fileInput.setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('text') })
    await page.getByRole('alert').filter({ hasText: '请选择 JPG' }).waitFor()
    await fileInput.setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('text') })
    await page.getByRole('alert').filter({ hasText: '图片内容和文件格式不符' }).waitFor()
    await fileInput.setInputFiles({ name: 'oversize.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
    await page.getByRole('alert').filter({ hasText: '图片超过' }).waitFor()
    const png = await page.evaluate(() => document.createElement('canvas').toDataURL('image/png').split(',')[1])
    await fileInput.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await page.getByRole('img', { name: '头像预览' }).waitFor()
    await page.getByRole('button', { name: '保存资料' }).click()
    await page.getByRole('button', { name: '完成', exact: true }).click()
    await page.reload()
    assert.match(await page.locator('.account-avatar img').getAttribute('src'), /^data:image\/jpeg;base64,/)
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('learnverse.learning-progress.v1')).activeRoute), 'algorithmic-thinking')
    await openAccountAction(page, '个人资料')
    await page.getByRole('button', { name: '移除头像' }).click()
    await page.getByRole('button', { name: '保存资料' }).click()
    await page.getByRole('button', { name: '完成', exact: true }).click()
    assert.equal(await page.locator('.account-avatar img').count(), 0)
  } finally { await page.close() }
})

test('interest and undecided paths resolve to their existing domain URLs', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  try {
    await page.goto(server.origin + '/library')
    await page.getByRole('button', { name: '选择路线', exact: true }).click()
    await page.getByLabel('跨专业 / 兴趣学习', { exact: true }).check()
    await page.getByRole('combobox', { name: '你想先做什么？' }).selectOption({ label: '让程序更快地找到答案' })
    await page.getByRole('button', { name: '设为我的路线' }).click()
    await page.getByRole('link', { name: '查看推荐路线' }).click()
    await page.waitForURL('**/explore/algorithms')
    await page.getByRole('heading', { name: '算法与数据结构', exact: true }).waitFor()
    await openAccountAction(page, '选择学习路线')
    await page.getByLabel('还没想好', { exact: true }).check()
    await page.getByRole('button', { name: '设为我的路线' }).click()
    await page.getByRole('link', { name: '查看推荐路线' }).click()
    await page.waitForURL('**/explore/programming')
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('learnverse.learning-progress.v1')).activeRoute), 'programming-foundations')
  } finally { await page.close() }
})
