import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'
import { startTestServer } from './helpers/vite.mjs'

const url = 'http://127.0.0.1:4176'
let server
let browser

before(async () => {
  server = await startTestServer(4176)
  browser = await chromium.launch().catch(() => chromium.launch({ channel: 'msedge' }))
})

after(async () => {
  try { await browser?.close() }
  finally { await server?.close() }
})

async function publishedCourses(page) {
  return page.evaluate(async () => {
    const { workspaceCourses } = await import('/src/data/workspaceCourses.ts')
    const { getLessonExpansion } = await import('/src/data/expansions/index.ts')
    return workspaceCourses.map((course) => ({
      ...course,
      lessons: course.lessons.map((lesson) => {
        const expansion = getLessonExpansion(course.id, lesson.id)
        return { ...lesson, expansion, questions: [...lesson.questions, ...(expansion?.questions ?? [])] }
      }),
    }))
  })
}

test('the intro can be skipped, is session-scoped, and can be replayed', async () => {
  const page = await browser.newPage()
  try {
    // Test the skip action independently of the automatic intro timer.
    await page.clock.install({ time: 0 })
    await page.clock.pauseAt(60_000)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '跳过开场' }).click()
    await page.getByRole('heading', { name: /编程与 AI\s*学习观测站/ }).waitFor()
    await page.reload()
    assert.equal(await page.getByRole('button', { name: '跳过开场' }).count(), 0)
    await page.getByRole('button', { name: '重播开场' }).first().click()
    await page.getByRole('button', { name: '跳过开场' }).waitFor()
  } finally {
    await page.close()
  }
})

test('the six main routes render and desktop navigation has no page errors', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto(url)
    assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN')
    const navigation = page.getByRole('navigation', { name: '主导航' })
    for (const [name, path] of [
      ['知识星图', '/explore'],
      ['学院', '/academy'],
      ['资源库', '/library'],
      ['实验室', '/lab'],
      ['我的宇宙', '/my-universe'],
      ['首页', '/'],
    ]) {
      await navigation.getByRole('link', { name, exact: true }).click()
      await page.locator('main h1').waitFor()
      if (path === '/lab' || path === '/my-universe') {
        await page.getByRole('dialog', { name: '知识补给包' }).getByRole('button', { name: '关闭', exact: true }).click()
      }
      assert.equal(new URL(page.url()).pathname, path)
    }
    assert.deepEqual(errors, [])
  } finally {
    await page.close()
  }
})

test('the mobile homepage fits the viewport and offers the full menu', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  try {
    await page.goto(url)
    await page.getByRole('heading', { name: /编程与 AI\s*学习观测站/ }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390)
    await page.getByRole('dialog', { name: 'Learnverse 开场动画' }).waitFor({ state: 'hidden' })
    const menu = page.getByRole('button', { name: '打开导航菜单' })
    const navigation = page.getByRole('navigation', { name: '主导航' })
    await menu.focus()
    await page.keyboard.press('Space')
    assert.equal(await navigation.getByRole('link', { name: '首页', exact: true }).evaluate((link) => link === document.activeElement), true)
    await page.keyboard.press('Escape')
    assert.equal(await menu.evaluate((button) => button === document.activeElement), true)
    await menu.click()
    await navigation.getByRole('link', { name: '资源库' }).click()
    assert.equal(new URL(page.url()).pathname, '/library')
  } finally {
    await page.close()
  }
})

test('the homepage entrance is finite and honors reduced motion', async () => {
  const page = await browser.newPage({ reducedMotion: 'no-preference' })
  try {
    await page.goto(url)
    await page.getByRole('button', { name: '跳过开场' }).click({ timeout: 4000 })
    const heading = page.getByRole('heading', { name: /编程与 AI\s*学习观测站/ })
    const animations = await heading.evaluate((element) => element.getAnimations({ subtree: true })
      .map((animation) => animation.effect.getTiming().iterations))
    assert.ok(animations.length > 0 && animations.every((iterations) => iterations === 1))
    await heading.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    assert.equal(await heading.evaluate((element) => element.getAnimations({ subtree: true }).length), 0)
  } finally {
    await page.close()
  }
})

test('global search filters the library and a bookmark survives reload', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  try {
    await page.goto(url)
    await page.getByRole('button', { name: '全站搜索' }).click()
    const dialog = page.getByRole('dialog', { name: '全站搜索' })
    await dialog.getByRole('searchbox').fill('exercism')
    await dialog.getByRole('link', { name: '在资源库搜索「exercism」' }).click()
    assert.equal(new URL(page.url()).searchParams.get('q'), 'exercism')
    const bookmark = page.getByRole('button', { name: '收藏 Exercism Python Track' })
    await bookmark.click()
    await page.getByRole('button', { name: '收藏 Exercism Python Track', pressed: true }).waitFor()
    await page.reload()
    await page.getByRole('button', { name: '收藏 Exercism Python Track', pressed: true }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'CS50’s Introduction to Computer Science' }).count(), 0)
  } finally {
    await page.close()
  }
})

test('the library supports searching in Chinese and filtering by content language', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  try {
    await page.goto(`${url}/library`)
    const filters = page.getByRole('region', { name: '资源目录' })
    await filters.getByRole('button', { name: '内容语言 全部语言' }).click({ timeout: 4000 })
    await page.getByRole('dialog', { name: '选择内容语言' }).getByRole('option', { name: '简体中文' }).click()
    await filters.getByRole('searchbox', { name: '搜索' }).fill('ｐｙｔｈｏｎ 中文教程')
    await filters.getByRole('heading', { name: 'Python 官方教程 · 简体中文' }).waitFor()
    assert.equal(new URL(page.url()).searchParams.get('language'), 'Chinese (Simplified)')
    await filters.getByRole('heading', { name: 'Exercism Python Track' }).waitFor({ state: 'hidden' })
  } finally {
    await page.close()
  }
})

test('mobile course filters open a themed picker and support touch and keyboard', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  try {
    await page.goto(`${url}/academy`)
    const category = page.getByRole('button', { name: '分类 全部分类', exact: true })
    await category.tap({ timeout: 4000 })
    const picker = page.getByRole('dialog', { name: '选择分类' })
    await picker.getByRole('option', { name: '全部分类', selected: true }).waitFor()
    await picker.getByRole('option', { name: 'C 语言', exact: true }).tap()
    await picker.waitFor({ state: 'hidden' })
    assert.equal(new URL(page.url()).searchParams.get('category'), 'C Language')
    await page.getByRole('heading', { name: 'C 语言编程起步' }).waitFor()
    const difficulty = page.getByRole('button', { name: '难度 全部难度', exact: true })
    await difficulty.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    assert.equal(new URL(page.url()).searchParams.get('difficulty'), 'Beginner')
    const activeDifficulty = page.getByRole('button', { name: '难度 入门', exact: true })
    await activeDifficulty.press('Enter')
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: '选择难度' }).waitFor({ state: 'hidden' })
    await activeDifficulty.waitFor()
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === '入门')
  } finally {
    await page.close()
  }
})

test('onsite lessons record correct answers and resume after reload', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  try {
    await page.goto(`${url}/academy/lv-python-foundations`)
    await page.getByRole('link', { name: '开始学习' }).click()
    await page.getByRole('heading', { name: '变量与数据' }).waitFor()
    const courses = await publishedCourses(page)
    const { questions } = courses.find((course) => course.id === 'lv-python-foundations').lessons[0]
    await page.getByText('本章目录', { exact: true }).click()
    await page.getByRole('navigation', { name: '本章目录' }).getByRole('link', { name: '动手练习', exact: true }).click()
    assert.equal(new URL(page.url()).hash, '#lesson-practice')
    const practice = page.getByRole('region', { name: '动手练习' })
    const reference = practice.getByText('查看参考解法', { exact: true })
    await reference.click()
    assert.equal(await reference.locator('..').evaluate((element) => element.open), true)
    await page.getByRole('button', { name: '提交答案' }).click()
    await page.getByRole('alert').getByText('请先回答全部题目。').waitFor()
    for (const [index, question] of questions.entries()) {
      const choice = index === 0 ? (question.answer + 1) % question.choices.length : question.answer
      await page.locator('fieldset').nth(index).getByRole('radio').nth(choice).check()
    }
    await page.getByRole('button', { name: '提交答案' }).click()
    await page.getByText('还有题目需要调整').waitFor()
    assert.equal(await page.getByText('本章测验已通过（还需完成编程样例验收）').count(), 0)
    await page.locator('fieldset').nth(0).getByRole('radio').nth(questions[0].answer).check()
    await page.getByRole('button', { name: '提交答案' }).click()
    await page.getByText('本章测验已通过（还需完成编程样例验收）').waitFor()
    await page.reload()
    await page.getByText('本章测验已通过（还需完成编程样例验收）').waitFor()
    await page.getByRole('link', { name: '下一章' }).click()
    await page.getByRole('heading', { name: '条件与选择' }).waitFor()
    await page.goto(`${url}/academy/lv-python-foundations/learn`)
    await page.getByRole('heading', { name: '条件与选择' }).waitFor()
  } finally {
    await page.close()
  }
})

test('mobile learners can solve the first Python exercise and jump to a real error', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  try {
    await page.goto(`${url}/academy/lv-python-foundations/lesson/values`)
    const primer = page.getByRole('region', { name: '先用大白话理解' })
    await primer.getByText('值、变量', { exact: true }).waitFor()
    assert.equal(await page.locator('.workspace-copy pre').evaluateAll(blocks => blocks.some(block => /\binput\s*\(/.test(block.textContent))), false)
    const practice = page.getByRole('region', { name: '动手练习' })
    const editor = practice.getByRole('textbox', { name: '源代码' })
    const initial = await editor.inputValue()
    assert.ok(initial.includes('item = "苹果"'))
    assert.equal(await practice.getByRole('textbox', { name: '标准输入' }).count(), 0)
    const reference = practice.getByText('查看参考解法', { exact: true })
    assert.equal(await reference.locator('..').evaluate(element => element.open), false)

    const solution = 'item = "苹果"\nprice = 4\nquantity = 3\ntotal = price * quantity\nprint(item, total, "元")'
    await editor.fill(solution)
    await practice.getByRole('button', { name: '运行代码' }).click()
    await practice.getByText('苹果 12 元', { exact: true }).waitFor({ timeout: 35000 })
    await practice.getByText('输出与预期一致。', { exact: true }).waitFor()
    await editor.fill('price = 4\nprint(pric)')
    await practice.getByRole('button', { name: '运行代码' }).click()
    await practice.getByText(/NameError/).waitFor()
    await practice.getByRole('button', { name: /第 2 行/ }).click()
    assert.equal(await editor.evaluate(element => element === document.activeElement), true)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390)
    await page.reload()
    assert.equal(await editor.inputValue(), 'price = 4\nprint(pric)')
    await reference.click()
    assert.equal(await reference.locator('..').evaluate(element => element.open), true)
  } finally {
    await page.close()
  }
})

test('every published course can be completed without leaving the learning workspace', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto(`${url}/academy`)
    const courses = await publishedCourses(page)
    assert.equal(courses.length, 33)
    assert.equal(courses.filter((course) => course.difficulty === 'Intermediate').length, 11)
    const advanced = courses.filter((course) => course.difficulty === 'Advanced')
    assert.equal(advanced.length, 12)
    assert.ok(advanced.every((course) => course.lessons.length >= 3))
    assert.equal(courses.reduce((count, course) => count + course.lessons.length, 0), 132)
    const { routes, domains } = await page.evaluate(async () => {
      const { routes, domains } = await import('/src/data/learning.ts')
      return { routes, domains }
    })
    const reachable = new Set(routes.flatMap(({ courseIds }) => courseIds))
    const catalogued = new Set(domains.flatMap(({ courseIds }) => courseIds))
    assert.ok(courses.every(({ id }) => reachable.has(id)), 'Every course should be linked from a learning route')
    assert.ok(courses.every(({ id }) => catalogued.has(id)), 'Every course should be linked from a knowledge domain')
    assert.equal(new Set(courses.map((course) => course.id)).size, courses.length)
    for (const course of courses) {
      assert.ok(course.lessons.length > 0, course.id)
      assert.equal(new Set(course.lessons.map((lesson) => lesson.id)).size, course.lessons.length)
      await page.goto(`${url}/academy/${course.id}`)
      await page.getByRole('link', { name: '开始学习', exact: true }).click()
      for (const [index, lesson] of course.lessons.entries()) {
        await page.getByRole('heading', { name: lesson.title, exact: true, level: 1 }).waitFor()
        assert.equal(new URL(page.url()).origin, url)
        assert.ok(lesson.expansion?.sections.length >= 3, `${course.id}/${lesson.id} lacks detailed lessons`)
        if (course.difficulty !== 'Beginner' && course.id !== 'lv-python-practice') {
          assert.ok(lesson.expansion.sections.filter(({ run }) => run).length >= 2, `${course.id}/${lesson.id} lacks runnable stepping stones`)
        }
        assert.ok(lesson.expansion.pitfalls.length >= 2 && lesson.expansion.practice.checkpoints.length >= 2, lesson.id)
        assert.ok(lesson.expansion.practice.solution.length > 0 && lesson.questions.length >= 4, lesson.id)
        assert.equal(new Set(lesson.questions.map((question) => question.id)).size, lesson.questions.length)
        await page.getByRole('heading', { name: '先用大白话理解', exact: true }).waitFor()
        await page.getByRole('textbox', { name: '源代码' }).waitFor()
        await page.getByRole('heading', { name: '常见易错点', exact: true }).waitFor()
        for (const [questionIndex, question] of lesson.questions.entries()) {
          assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length)
          await page.locator('fieldset').nth(questionIndex).getByRole('radio').nth(question.answer).check()
        }
        await page.getByRole('button', { name: '提交答案', exact: true }).click()
        await page.getByRole('dialog', { name: '知识补给包' }).getByRole('button', { name: '关闭', exact: true }).click()
        await page.getByText('本章测验已通过（还需完成编程样例验收）', { exact: true }).waitFor()
        if (index < course.lessons.length - 1) await page.getByRole('link', { name: '下一章', exact: true }).click()
      }
      await page.getByRole('link', { name: '开始结课项目', exact: true }).waitFor()
      await page.locator('.workspace-actions').getByRole('button', { name: '返回课程', exact: true }).click()
      // Quiz-only completion must NOT falsely mark the course completed!
      await page.getByRole('status').getByText('测验已全通 · 编程待验收', { exact: true }).waitFor()
      await page.reload()
      await page.getByRole('status').getByText('测验已全通 · 编程待验收', { exact: true }).waitFor()
    }

    // Complete every coding exercise of lv-iot-protocols to verify dual-bar completion lights up the course & star.
    const iot = courses.find((c) => c.id === 'lv-iot-protocols')
    const iotSolutions = await page.evaluate(async () => {
      const { getCurriculumLesson } = await import('/src/data/curriculum/index.ts')
      return ['iot-frames-and-qos', 'iot-heartbeat-and-dedup', 'iot-gateway-backpressure'].map((id) => ({
        id,
        solution: getCurriculumLesson('lv-iot-protocols', id).exercise.solution,
      }))
    })
    for (const { id, solution } of iotSolutions) {
      await page.goto(`${url}/academy/${iot.id}/lesson/${id}`)
      const editor = page.getByRole('region', { name: '在这里写代码' })
      await editor.getByRole('textbox', { name: '源代码' }).fill(solution)
      await editor.getByRole('button', { name: '运行代码', exact: true }).click()
      await page.getByText('本章编程练习已验证', { exact: true }).waitFor()
      await page.getByText('本章已完成（测验与编程双达标）', { exact: true }).waitFor()
    }
    await page.goto(`${url}/academy/${iot.id}`)
    await page.getByRole('status').getByText('已完成', { exact: true }).waitFor()
    await page.reload()
    await page.getByRole('status').getByText('已完成', { exact: true }).waitFor()
    await page.getByRole('link', { name: /查看点亮的星星/ }).click()
    await page.getByRole('button', { name: '定位航线终点' }).click()
    await page.locator('[data-course-id="lv-iot-protocols"][data-lit]').waitFor()
    assert.deepEqual(errors, [])
  } finally {
    await page.close()
  }
})

test('chapter progress merges across tabs and ignores invalid saved lesson IDs', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const first = await context.newPage()
  const second = await context.newPage()
  try {
    await first.goto(`${url}/academy`)
    await first.evaluate(() => localStorage.setItem('learnverse.workspace.v1.lv-python-foundations', JSON.stringify({
      completed: ['missing', null, 5], lastLesson: 'missing',
    })))
    const course = (await publishedCourses(first)).find((course) => course.id === 'lv-python-foundations')
    await Promise.all([first, second].map((page, index) => page.goto(`${url}/academy/${course.id}/lesson/${course.lessons[index].id}`)))
    await Promise.all([first, second].map(async (page, index) => {
      const lesson = course.lessons[index]
      for (const [questionIndex, question] of lesson.questions.entries()) {
        await page.locator('fieldset').nth(questionIndex).getByRole('radio').nth(question.answer).check()
      }
      await page.getByRole('button', { name: '提交答案', exact: true }).click()
      await page.getByText('本章测验已通过（还需完成编程样例验收）', { exact: true }).waitFor()
    }))
    await first.waitForFunction(() => JSON.parse(localStorage.getItem('learnverse.workspace.v1.lv-python-foundations')).completed.length === 2)
    await first.reload()
    assert.equal(await first.getByRole('progressbar', { name: '课程进度' }).getAttribute('aria-valuenow'), '2')
    const completed = await first.evaluate(() => JSON.parse(localStorage.getItem('learnverse.workspace.v1.lv-python-foundations')).completed)
    assert.deepEqual(completed.sort(), course.lessons.slice(0, 2).map((lesson) => lesson.id).sort())
  } finally {
    await context.close()
  }
})

test('the homepage starts entering during the intro fade without WebGL', async () => {
  const page = await browser.newPage({ reducedMotion: 'no-preference' })
  try {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (kind, ...options) {
        return kind === 'webgl2' ? null : getContext.call(this, kind, ...options)
      }
      document.addEventListener('animationstart', (event) => {
        if (event.animationName === 'home-title-in' && document.querySelector('.intro-dialog[open]')) {
          performance.mark('home-entered-during-intro')
        }
      })
    })
    await page.goto(url)
    const intro = page.getByRole('dialog', { name: 'Learnverse 开场动画' })
    await intro.waitFor()
    await intro.waitFor({ state: 'detached', timeout: 8000 })
    assert.ok(await page.evaluate(() => performance.getEntriesByName('home-entered-during-intro').length))
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content')
    await page.getByRole('link', { name: '探索知识星图', exact: true }).click()
    assert.equal(new URL(page.url()).pathname, '/explore')
  } finally {
    await page.close()
  }
})

test('five-card supply, notes, filters and daily rewards survive normal mobile navigation', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  try {
    await page.goto(url + '/lab')
    const pack = page.getByRole('dialog', { name: '知识补给包' })
    await pack.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('button', { name: '拆开补给包', exact: true }).click()
    await pack.getByRole('button', { name: '撕开卡包', exact: true }).click()
    await pack.getByRole('button', { name: /^放大第 1 张/ }).click()
    const first = await pack.locator('.holo-front h3').innerText()
    await pack.getByRole('button', { name: '查看背面' }).click()
    await pack.getByLabel('个人笔记', { exact: true }).fill('下次先自己预测输出。')
    await pack.getByRole('button', { name: '放回原位' }).click()
    await pack.getByRole('button', { name: /^放大第 4 张/ }).click()
    await pack.locator('.pack-seat[data-active] .holo-finish-gold').waitFor()
    await pack.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('link', { name: '查看图鉴' }).click()
    const vault = page.getByRole('region', { name: '星际知识图鉴馆' })
    await vault.getByRole('button', { name: '已获得', exact: true }).click()
    assert.equal(await vault.locator('.is-owned').count(), 5)
    await vault.getByRole('button', { name: '检视 ' + first, exact: true }).click()
    const inspect = page.getByRole('dialog', { name: '卡片检视台' })
    await inspect.getByRole('button', { name: '查看背面' }).click()
    assert.equal(await inspect.getByLabel('个人笔记', { exact: true }).inputValue(), '下次先自己预测输出。')
    await page.reload()
    await vault.locator('.is-owned').first().waitFor()
    assert.equal(await vault.getByRole('link', { name: /预览全部卡牌/ }).count(), 0)
    assert.equal(await vault.locator('.vault-tile').count(), 420)
    const firstLocked = vault.locator('a.vault-tile.is-locked').first()
    assert.match(await firstLocked.innerText(), /\?\?\? · 未知知识节点/)
    assert.equal(await firstLocked.locator('.vault-mystery-question').innerText(), '?')
    for (const [galaxy, count] of [
      ['Python', 42], ['C 语言', 57], ['算法与 AI', 78],
      ['JS 与 Web', 72], ['Java 与后端', 72], ['CS 与系统', 54], ['物联网与 ROS 2', 45],
    ]) {
      await vault.getByRole('button', { name: galaxy, exact: true }).click()
      assert.equal(await vault.locator('.vault-tile').count(), count)
    }
    await vault.getByRole('button', { name: '稀有度与材质 所有卡面' }).click()
    await page.getByRole('option', { name: '保底金卡', exact: true }).click()
    const locked = vault.locator('a.vault-tile').first()
    const path = await locked.getAttribute('href')
    await locked.click()
    await page.locator('.workspace-article').waitFor()
    assert.equal(new URL(page.url()).pathname, path)
    await page.goto(url + '/lab')
    const quiz = page.locator('#lab-quiz')
    for (const [i, answer] of [1, 2, 0].entries()) {
      await quiz.getByRole('radio').nth(answer).check()
      await quiz.getByRole('button', { name: '提交答案' }).click()
      await quiz.getByRole('button', { name: i < 2 ? '下一题' : '查看结果' }).click()
    }
    await pack.getByRole('button', { name: '撕开卡包', exact: true }).click()
    await pack.getByRole('button', { name: /^放大第 1 张/ }).waitFor()
    await page.reload()
    await quiz.getByText('今日挑战补给已发放。').waitFor()
    assert.equal(await page.getByRole('dialog', { name: '知识补给包' }).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390)
  } finally { await page.close() }
})

test('a short touch drag reseals the pack and a full drag reveals the five cards', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  try {
    await page.goto(url + '/lab')
    const seam = page.locator('.holo-tear')
    await seam.waitFor()
    const bounds = await seam.boundingBox()
    const touch = await page.context().newCDPSession(page)
    async function dragSeam(fraction) {
      for (let step = 0; step <= 10; step++) {
        const x = bounds.x + 8 + bounds.width * fraction * step / 10
        await touch.send('Input.dispatchTouchEvent', {
          type: step === 0 ? 'touchStart' : 'touchMove',
          touchPoints: [{ x, y: bounds.y + bounds.height / 2 }],
        })
      }
      await page.locator('.holo-sequence[data-lit] .pack-wave img').waitFor()
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    await dragSeam(.3)
    assert.equal(await page.locator('.holo-stage').getAttribute('data-phase'), 'sealed')
    await page.locator('.holo-sequence[data-lit]').waitFor({ state: 'detached' })
    await dragSeam(.82)
    const slots = page.locator('.pack-seat')
    await page.getByRole('button', { name: /^放大第 1 张/ }).waitFor()
    const boxes = await slots.evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect()
      return { x: x + width / 2, y: y + height / 2, width }
    }))
    assert.equal(boxes.length, 5)
    assert.ok(boxes[0].y < boxes[2].y && boxes[1].y < boxes[2].y)
    assert.ok(boxes[3].y > boxes[2].y && boxes[4].y > boxes[2].y)
    assert.ok(boxes[0].x < boxes[2].x && boxes[2].x < boxes[1].x)
    assert.ok(boxes[3].x < boxes[2].x && boxes[2].x < boxes[4].x)
    for (let number = 1; number <= 5; number++) {
      await page.getByRole('button', { name: new RegExp('^放大第 ' + number + ' 张') }).click()
      assert.equal(await slots.nth(number - 1).getAttribute('data-active'), 'true')
      if (number < 5) await page.getByRole('button', { name: '放回原位' }).click()
    }
    await page.getByRole('button', { name: '查看背面' }).click()
    await page.getByRole('button', { name: '翻回正面' }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390)
  } finally { await page.close() }
})

test('the JSON import example, chapter rewards and all 420 collection entries are reachable', async () => {
  const page = await browser.newPage()
  try {
    const guide = await readFile(new URL('../src/cards/sources/README.md', import.meta.url), 'utf8')
    const example = JSON.parse(guide.split('```json')[1].split('```')[0])
    await page.goto(url + '/academy')
    const report = await page.evaluate(async example => {
      const { cardCatalog } = await import('/src/cards/catalog.ts')
      const { importCardSources } = await import('/src/cards/importCards.ts')
      const { workspaceCourses } = await import('/src/data/workspaceCourses.ts')
      const rewards = await import('/src/cards/rewards.ts')
      const imported = importCardSources([], { builtIn: cardCatalog, example })
      const rejects = (card, existing = []) => {
        try { importCardSources(existing, { fixture: [card] }); return false }
        catch { return true }
      }
      const rejected = rejects(cardCatalog[0], cardCatalog)
      const ordinary = cardCatalog.find(({ finish }) => finish !== 'gold')
      const rejectsEnumArrays = rejects({ ...ordinary, galaxy: [ordinary.galaxy] })
        && rejects({ ...ordinary, finish: [ordinary.finish] })
      const activation = rewards.inventory().pending.length
      const chapterKeys = []
      for (const course of workspaceCourses) {
        for (const lesson of course.lessons) chapterKeys.push(rewards.earnLesson(course.id, lesson.id))
      }
      let valid = true
      const keys = rewards.inventory().pending
      for (const key of keys) {
        const cards = await rewards.packFor(key)
        const samePack = await rewards.packFor(key)
        valid &&= cards.map(card => card.slot).join('') === '12345'
          && samePack.map(card => card.id).join() === cards.map(card => card.id).join()
        await rewards.openPack(key, cards)
      }
      // Additional daily packs can complete even the most populated slot.
      for (let day = 1; rewards.inventory().owned.size < cardCatalog.length && day <= 90; day++) {
        const key = rewards.earnDaily(new Date(2026, 0, day))
        await rewards.openPack(key, await rewards.packFor(key))
      }
      return {
        imported: imported.length, rejected, rejectsEnumArrays, valid, activation,
        earnsEveryChapter: new Set(chapterKeys).size === chapterKeys.length && chapterKeys.every((key) => keys.includes(key)),
        chapterPacks: keys.length - activation, chapters: chapterKeys.length, total: rewards.inventory().owned.size,
      }
    }, example)
    const { chapterPacks, chapters, ...collection } = report
    assert.equal(chapterPacks, chapters)
    assert.deepEqual(collection, {
      imported: 421, rejected: true, rejectsEnumArrays: true, valid: true, activation: 1,
      earnsEveryChapter: true, total: 420,
    })
  } finally { await page.close() }
})

test('each course offers a capstone and verified completion survives a reload on mobile', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  try {
    await page.goto(`${url}/academy`)
    const courses = await publishedCourses(page)
    const projects = await page.evaluate(async () => {
      const { workspaceCourses } = await import('/src/data/workspaceCourses.ts')
      const { courseProjects } = await import('/src/data/curriculum/index.ts')
      return workspaceCourses.map(({ id }) => ({ id, project: courseProjects[id] }))
    })
    assert.deepEqual(projects.map(({ id }) => id), courses.map(({ id }) => id))
    for (const { id, project } of projects) {
      assert.ok(project?.title && project.examples.length >= 3, id)
      assert.ok(project.exercises.some((exercise) => exercise.expectedOutput !== undefined), id)
      assert.ok(project.exercises.every((exercise) => exercise.starter && exercise.solution), id)
    }
    const course = courses.find(({ id }) => id === 'lv-javascript-foundations')
    const { project } = projects.find(({ id }) => id === course.id)
    await page.goto(`${url}/academy/lv-javascript-data`)
    const advancedTitle = courses.find(({ id }) => id === 'lv-javascript-async-state').title
    await page.getByRole('link', { name: advancedTitle, exact: true }).click()
    await page.getByRole('heading', { name: advancedTitle, exact: true, level: 1 }).waitFor()
    await page.getByRole('link', { name: 'JavaScript 数据处理实战', exact: true }).waitFor()
    await page.goto(`${url}/academy/${course.id}`)
    await page.getByRole('link', { name: /结课项目/ }).click()
    await page.getByRole('heading', { name: project.title, exact: true }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    assert.equal(await page.getByText('查看参考解法', { exact: true }).locator('..').getAttribute('open'), null)
    const complete = page.getByRole('button', { name: '记录项目完成' })
    assert.equal(await complete.isDisabled(), true)
    await page.getByRole('textbox', { name: '源代码' }).fill('console.log("未通过")')
    await page.getByRole('button', { name: '运行代码' }).click()
    await page.getByText('输出与预期不同。', { exact: true }).waitFor()
    assert.equal(await complete.isDisabled(), true)
    await page.getByRole('textbox', { name: '源代码' }).fill('console.log("调试信息");\n' + project.exercises[0].solution)
    await page.getByRole('button', { name: '运行代码' }).click()
    const cases = page.getByRole('list', { name: '用例结果' })
    await cases.getByRole('listitem').first().getByText('通过', { exact: true }).waitFor()
    assert.equal(await cases.getByText('未通过', { exact: true }).count(), 0)
    assert.equal(await complete.isDisabled(), true)
    await page.getByRole('textbox', { name: '源代码' }).fill(project.exercises[0].solution)
    await page.getByRole('button', { name: '运行代码' }).click()
    await page.getByText('输出与预期一致。', { exact: true }).waitFor()
    await page.getByRole('textbox', { name: '源代码' }).fill(project.exercises[0].solution + '\n// 修改后需要重新验收')
    assert.equal(await complete.isDisabled(), true)
    await page.getByRole('button', { name: '运行代码' }).click()
    await page.getByText('输出与预期一致。', { exact: true }).waitFor()
    await complete.click()
    await page.getByText('结课项目已完成', { exact: true }).waitFor()
    await page.reload()
    await page.getByText('结课项目已完成', { exact: true }).waitFor()
  } finally { await page.close() }
})

test('adding advanced study preserves the previous route milestone', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  try {
    await page.goto(`${url}/academy`)
    await page.getByRole('heading', { name: '学习学院', exact: true }).waitFor()
    await page.evaluate(() => localStorage.setItem('learnverse.learning-progress.v1', JSON.stringify({
      activeRoute: 'technical-toolkit',
      completed: ['lv-javascript-foundations', 'lv-javascript-data'],
    })))
    await page.goto(`${url}/my-universe#study`)
    const milestone = page.getByRole('listitem').filter({ hasText: '完成路线的基础与进阶' })
    await milestone.getByText('已解锁', { exact: true }).waitFor()
    await page.getByRole('link', { name: /JavaScript 高级：异步任务与可预测状态/ }).waitFor()
  } finally { await page.close() }
})

test('computer science 080901 milestone requires lv-computer-architecture in addition to core foundations', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  try {
    await page.goto(`${url}/academy`)
    await page.getByRole('heading', { name: '学习学院', exact: true }).waitFor()
    const withoutArch = [
      'lv-javascript-foundations', 'lv-computer-science', 'lv-computer-science-cost',
      'lv-algorithms-foundations', 'lv-algorithms-efficiency', 'lv-c-foundations', 'lv-c-records',
    ]
    const withArch = [...withoutArch, 'lv-computer-architecture']
    for (const activeRoute of ['major-080901', 'computer-science']) {
      await page.evaluate(record => localStorage.setItem('learnverse.learning-progress.v1', JSON.stringify(record)), { activeRoute, completed: withoutArch })
      await page.goto(`${url}/my-universe#study`)
      await page.reload()
      const milestone = page.getByRole('listitem').filter({ hasText: '完成路线的基础与进阶' })
      await milestone.waitFor()
      assert.equal(await milestone.getByText('已解锁', { exact: true }).count(), 0)
      await page.evaluate(record => localStorage.setItem('learnverse.learning-progress.v1', JSON.stringify(record)), { activeRoute, completed: withArch })
      await page.reload()
      await milestone.getByText('已解锁', { exact: true }).waitFor({ timeout: 5000 })
    }
  } finally { await page.close() }
})

test('a worked example runs separately and chapter code verification survives a reload', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, reducedMotion: 'reduce' })
  try {
    await page.goto(`${url}/academy/lv-python-practice/lesson/exceptions`)
    const exercise = page.getByRole('region', { name: '在这里写代码' })
    const source = exercise.getByRole('textbox', { name: '源代码' })
    const marker = '# 我的章节草稿'
    await source.fill(marker)
    const sample = page.locator('details.workspace-sample-run').first()
    await sample.locator('summary').click()
    await sample.getByRole('button', { name: '运行代码' }).click()
    await sample.getByText('输出与预期一致。', { exact: true }).waitFor({ timeout: 45000 })
    assert.equal(await source.inputValue(), marker)
    await source.fill('print("已记录\\n误判\\n时长超出范围\\n[15, 25]")')
    await exercise.getByRole('button', { name: '运行代码' }).click()
    await exercise.getByText(/请先核对第 2 行/).waitFor()
    const caseResults = exercise.getByRole('list', { name: '用例结果' })
    assert.match(await caseResults.getByRole('listitem').filter({ hasText: '转换失败' }).innerText(), /未通过/)
    await source.fill('print("已记录\\n需要整数\\n时长超出范围\\n[15, 25]")')
    await exercise.getByRole('button', { name: '运行代码' }).click()
    await page.getByText('本章编程练习已验证', { exact: true }).waitFor()
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('learnverse.workspace.v1.lv-python-practice')).verified), ['exceptions'])
    await page.reload()
    await page.getByText('本章编程练习已验证', { exact: true }).waitFor()
  } finally { await page.close() }
})

test('interactive chapter visualizers respond to touch and stay overflow-free on a 390px phone', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, reducedMotion: 'reduce' })
  try {
    const demoCases = [
      ['/academy/lv-computer-science/lesson/binary', ['从头逐位算'], /推进一位/],
      ['/academy/lv-c-records/lesson/bitwise-and-frames', ['高温告警 0xF281'], /node=15/],
      ['/academy/lv-c-foundations/lesson/functions-and-arrays', ['值传递（改不动原值）'], /0x1040/],
      ['/academy/lv-algorithms-foundations/lesson/sorting', [/推进一步/], /比较 1 次/],
      ['/academy/lv-algorithms-foundations/lesson/stacks-and-queues', ['环形队列（FIFO · 容量 3）', '入队 Enqueue'], /槽位/],
      ['/academy/lv-computer-science-cache/lesson/cache-fifo-lru', ['经典序列 A B A C A'], /A → B → A → C → A/],
      ['/academy/lv-computer-architecture/lesson/instruction-cycle', [/推进一步/], /取指/],
      ['/academy/lv-iot-protocols/lesson/iot-gateway-backpressure', [/上报温度/], /常规遥测/],
    ]
    for (const [path, buttons, expected] of demoCases) {
      await page.goto(`${url}${path}`)
      const demo = page.locator('.workspace-demo')
      await demo.waitFor()
      for (const buttonName of buttons) {
        await demo.getByRole('button', { name: buttonName }).click()
      }
      const output = await demo.locator('.workspace-demo-output').innerText()
      assert.match(output, expected, `${path} output mismatch: ${output}`)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${path} overflowed horizontally on 390px`)
    }
  } finally { await page.close() }
})

test('homepage founder announcement renders, opens dialog from hero pill, and persists collapse state', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' })
  try {
    await page.goto(url)
    const section = page.locator('#founder-announcement')
    await section.waitFor()
    const text = await section.innerText()
    assert.match(text, /站长想说的话/)
    assert.match(text, /哇哇哇！恭喜进入这个网站的同学，这是一个完全公益的网站！/)
    assert.match(text, /OS：token烧的是我的真金白银！！！/)
    assert.match(text, /最后的最后跪求star！！！/)

    await page.locator('.fn-hero-pill').click()
    const dialog = page.getByRole('dialog', { name: '站长想说的话' })
    await dialog.waitFor()
    assert.match(await dialog.innerText(), /由于本人只是一个大一生/)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })

    await section.getByRole('button', { name: '收起' }).click()
    await section.getByRole('button', { name: '展开公告' }).waitFor()
    await page.reload()
    await section.getByRole('button', { name: '展开公告' }).waitFor()
    await section.getByRole('button', { name: '展开公告' }).click()
    await section.getByRole('button', { name: '收起' }).waitFor()

    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  } finally { await page.close() }
})
