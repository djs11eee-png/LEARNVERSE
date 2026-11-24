import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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

test('each professional map links real courses, shares their progress and resolves to its own address', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  try {
    await page.goto(server.origin + '/explore/major-080910')
    const catalog = await page.evaluate(async () => {
      const { majorRoutes } = await import('/src/data/majorRoutes.ts')
      const { courseSummaries } = await import('/src/data/courseCatalog.ts')
      const { getLearningRoute, routeMapPath } = await import('/src/data/learning.ts')
      return {
        published: courseSummaries.map(course => course.id),
        majors: majorRoutes.map(route => ({
          id: route.id, courses: route.courseIds, path: routeMapPath(getLearningRoute(route.id)),
        })),
      }
    })
    assert.equal(new Set(catalog.majors.map(route => route.id)).size, 19)
    assert.deepEqual(new Set(catalog.majors.flatMap(route => route.courses)), new Set(catalog.published))
    for (const route of catalog.majors) {
      assert.equal(route.path, '/explore/' + route.id)
      assert.equal(new Set(route.courses).size, route.courses.length)
      assert.ok(route.courses.length > 0)
    }
    await page.getByRole('button', { name: '设为我的学习路线', exact: true }).click()
    await page.getByText('我的学习路线', { exact: true }).waitFor()
    await page.goto(server.origin + '/my-universe#study')
    await page.getByRole('link', { name: '在星图中查看' }).waitFor()
    assert.equal(await page.getByRole('link', { name: '在星图中查看' }).getAttribute('href'), '/explore/major-080910')
    await page.goto(server.origin)
    await page.locator('.path-card').getByText('数据科学与大数据技术').waitFor()
    assert.equal(await page.locator('.path-card').getAttribute('href'), '/explore/major-080910')
    // Restore an existing learner's course record and visit two intersecting routes.
    await page.evaluate(() => {
      const key = 'learnverse.learning-progress.v1'
      const record = JSON.parse(localStorage.getItem(key))
      record.completed = ['lv-python-foundations']
      localStorage.setItem(key, JSON.stringify(record))
    })
    for (const route of ['major-080910', 'major-080913']) {
      await page.goto(server.origin + '/explore/' + route)
      await page.getByRole('link', { name: 'Python 编程起步，已完成，复习课程' }).waitFor()
    }
  } finally { await page.close() }
})

async function camera(viewport) {
  const values = await viewport.evaluate(async el => {
    // Pan and zoom publish the next camera on an animation frame.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return ['x', 'y', 'zoom'].map(key => {
      const value = el.getAttribute('data-camera-' + key)
      return value === null ? NaN : Number(value)
    })
  })
  assert.ok(values.every(Number.isFinite), 'the viewport exposes finite camera coordinates and scale')
  const [x, y, zoom] = values
  return { x, y, zoom }
}

async function screenPoint(viewport, planet) {
  await viewport.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const point = await viewport.evaluate((el, planet) => {
    const box = el.getBoundingClientRect()
    const left = Math.max(box.left + 8, 0), right = Math.min(box.right - 8, innerWidth)
    const top = Math.max(box.top + 8, 0), bottom = Math.min(box.bottom - 8, innerHeight)
    const candidates = []
    if (planet) {
      for (const link of el.querySelectorAll('a[data-course-id]')) {
        const bounds = link.getBoundingClientRect()
        const x = bounds.left + bounds.width / 2
        for (const fraction of [.45, .25, .7]) {
          candidates.push([x, bounds.top + bounds.height * fraction])
        }
      }
    } else {
      for (const fy of [.5, .4, .6, .3, .7]) {
        for (const fx of [.5, .4, .6, .3, .7]) candidates.push([left + (right - left) * fx, top + (bottom - top) * fy])
      }
    }
    for (const [x, y] of candidates) {
      if (x < left || x > right || y < top || y > bottom) continue
      const hit = document.elementFromPoint(x, y)
      if (!hit || !el.contains(hit)) continue
      const link = hit.closest('a[data-course-id]')
      if (planet ? !link : hit.closest('a,button,input,select,[data-route-id]')) continue
      return { x, y, href: link?.getAttribute('href') ?? null }
    }
    return null
  }, planet)
  assert.ok(point, planet ? 'a course planet is visible and receives pointer events' : 'empty sky is visible and receives pointer events')
  return point
}

async function physicalDrag(page, point, dx, dy) {
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 9 })
  await page.mouse.up()
}

test('the professional atlas pans in two dimensions from the sky and a planet, then opens a course on click', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  try {
    await page.goto(server.origin + '/explore')
    const viewport = page.getByTestId('star-viewport')
    await viewport.waitFor()
    const start = page.getByRole('button', { name: '回到起点' })
    const enlarge = page.getByRole('button', { name: '放大星图' })
    await start.click()
    const initial = await camera(viewport)
    await enlarge.click()
    const enlarged = await camera(viewport)
    assert.ok(enlarged.zoom > initial.zoom)
    await page.getByRole('button', { name: '缩小星图' }).click()
    assert.ok((await camera(viewport)).zoom < enlarged.zoom)

    await page.getByRole('button', { name: '查看全图' }).click()
    const fitted = await camera(viewport)
    for (let step = 0; step < 4; step++) await enlarge.click()
    assert.ok((await camera(viewport)).zoom > fitted.zoom)
    const mapAddress = page.url()
    const before = await camera(viewport)
    const visiblePlanet = await screenPoint(viewport, true)
    const landmark = viewport.locator('a[data-course-id][href="' + visiblePlanet.href + '"]')
    const previousBox = await landmark.boundingBox()
    await physicalDrag(page, await screenPoint(viewport, false), -55, -42)
    assert.equal(page.url(), mapAddress)
    const afterSky = await camera(viewport)
    assert.ok(Math.abs(afterSky.x - before.x) > 1 && Math.abs(afterSky.y - before.y) > 1, 'sky drag moves both camera axes')
    const movedBox = await landmark.boundingBox()
    assert.ok(Math.abs(movedBox.x - previousBox.x) > 1 && Math.abs(movedBox.y - previousBox.y) > 1, 'course positions move with the camera')

    await physicalDrag(page, await screenPoint(viewport, true), 38, 30)
    assert.equal(page.url(), mapAddress, 'dragging a course planet must not open that course')
    const afterPlanet = await camera(viewport)
    assert.ok(Math.abs(afterPlanet.x - afterSky.x) > 1 && Math.abs(afterPlanet.y - afterSky.y) > 1, 'planet drag moves both camera axes')
    await viewport.focus()
    await page.keyboard.press('ArrowRight')
    const horizontal = await camera(viewport)
    assert.notEqual(horizontal.x, afterPlanet.x)
    await page.keyboard.press('ArrowDown')
    assert.notEqual((await camera(viewport)).y, horizontal.y)
    await start.click()
    assert.deepEqual(await camera(viewport), initial)

    const destination = await screenPoint(viewport, true)
    await page.mouse.click(destination.x, destination.y)
    await page.waitForURL(server.origin + destination.href)
    assert.match(destination.href, /^\/academy\//)
  } finally { await page.close() }
})

test('a phone can open a DOM atlas planet without horizontal page overflow', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  try {
    await page.addInitScript(() => { Reflect.deleteProperty(HTMLCanvasElement.prototype, 'requestPaint') })
    await page.goto(server.origin + '/explore')
    const viewport = page.getByTestId('star-viewport')
    await viewport.waitFor()
    await page.getByRole('button', { name: '查看全图' }).click()
    await page.getByRole('button', { name: '放大星图' }).click()
    const planet = await screenPoint(viewport, true)
    assert.ok(await viewport.locator('a[data-course-id]').count() > 1)
    assert.equal(await viewport.locator('canvas a[data-course-id]').count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1))
    await page.touchscreen.tap(planet.x, planet.y)
    await page.waitForURL(server.origin + planet.href)
  } finally { await page.close() }
})

test('every course has different artwork and every route renders its destination as the largest globe', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(server.origin + '/explore')
    const { surfaces, planetIds, courseIds, routes } = await page.evaluate(async () => {
      const { planets, planetDiameter } = await import('/src/components/professionalAtlas.ts')
      const { majorRoutes } = await import('/src/data/majorRoutes.ts')
      const { courseSummaries } = await import('/src/data/courseCatalog.ts')
      return {
        surfaces: planets.map(p => p.surface),
        planetIds: planets.map(p => p.id),
        courseIds: courseSummaries.map(c => c.id),
        routes: majorRoutes.map(r => ({ id: r.id, goal: r.courseIds.at(-1),
          largest: [...planets].sort((a, b) => planetDiameter(b, r) - planetDiameter(a, r))[0].id })),
      }
    })
    assert.equal(planetIds.length, courseIds.length)
    assert.deepEqual(new Set(planetIds), new Set(courseIds))
    assert.equal(new Set(surfaces).size, courseIds.length)
    const hashes = await Promise.all(surfaces.map(async surface => {
      const image = await page.request.get(server.origin + '/art/atlas/worlds/' + surface + '.webp')
      assert.equal(image.headers()['content-type'], 'image/webp')
      return createHash('sha256').update(await image.body()).digest('hex')
    }))
    assert.equal(new Set(hashes).size, courseIds.length)
    for (const route of routes) assert.equal(route.goal, route.largest, route.id)
    // This route ends with an introductory course. Its actual globe must still be biggest.
    await page.goto(server.origin + '/explore/major-080909')
    await page.getByRole('button', { name: '定位航线终点' }).click()
    const goal = page.locator('.course-planet[data-terminal]')
    await goal.getByText('航线终点', { exact: true }).waitFor()
    await page.getByRole('button', { name: '查看全图' }).click()
    await page.waitForFunction(count => document.querySelectorAll('.course-planet').length === count, courseIds.length)
    const widths = await page.locator('.course-planet').evaluateAll(nodes => nodes.map(n => ({
      goal: n.hasAttribute('data-terminal'), width: n.querySelector('.planet-body').getBoundingClientRect().width,
    })))
    assert.ok(widths.find(n => n.goal).width > Math.max(...widths.filter(n => !n.goal).map(n => n.width)))

    await page.goto(server.origin + '/explore/major-080901')
    await page.getByRole('button', { name: '定位航线终点' }).click()
    const globe = page.locator('[data-course-id="lv-operating-systems"] .planet-body')
    await page.waitForFunction(() => {
      const globe = document.querySelector('[data-course-id="lv-operating-systems"] .planet-body')
      return globe?.getBoundingClientRect().width >= 230
    })
    const box = await globe.boundingBox()
    await page.mouse.click(box.x + box.width * 1.1, box.y + box.height * .27)
    await page.waitForURL(server.origin + '/academy/lv-operating-systems')
  } finally { await page.close() }
})

test('crossing a globe moves its illuminated limb and orbital grains keep moving with the pointer still', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' })
  try {
    await page.goto(server.origin + '/explore')
    const anchor = page.locator('[data-surface="pelagic-rings"]')
    await anchor.waitFor()
    const field = page.locator('canvas.planet-encounter')
    const brighterOn = async side => page.waitForFunction(side => {
      const canvas = document.querySelector('canvas.planet-encounter')
      if (!canvas) return false
      const ctx = canvas.getContext('2d'), middle = canvas.width/2, radius = middle/1.84
      const alpha = s => ctx.getImageData(Math.round(middle+s*radius), Math.round(middle), 1, 1).data[3]
      return side * (alpha(1) - alpha(-1)) > 65
    }, side)
    const box = await anchor.boundingBox()
    await anchor.hover({ position: { x: box.width * .2, y: box.height/2 } })
    await brighterOn(-1)
    await anchor.hover({ position: { x: box.width * .8, y: box.height/2 } })
    await brighterOn(1)
    const snapshot = await field.evaluate(c => c.toDataURL())
    await page.waitForFunction(before => document.querySelector('canvas.planet-encounter').toDataURL() !== before, snapshot)
    await page.mouse.move(2, 2)
    await field.waitFor({ state: 'detached' })
  } finally { await page.close() }
})

test('the unexplored region captures a tapped fragment, deflects a charged one and stays fixed in the map', async () => {
  const page = await browser.newPage({ viewport: { width: 1140, height: 820 } })
  try {
    await page.goto(server.origin + '/explore')
    const hole = page.getByRole('button', { name: '未开放星域，向黑洞投放碎片' })
    const status = page.locator('.space-announcement')
    await hole.click()
    await status.filter({ hasText: '已越过视界' }).waitFor({ state: 'attached' })
    const box = await hole.boundingBox()
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2)
    await page.mouse.down()
    await page.waitForTimeout(1250)
    await page.mouse.up()
    await status.filter({ hasText: '碎片已掠过' }).waitFor({ state: 'attached' })
    const viewport = page.getByTestId('star-viewport')
    const before = await camera(viewport)
    await physicalDrag(page,{x: box.x+box.width/2, y: box.y+box.height/2},74,46)
    const after = await camera(viewport), moved = await hole.boundingBox()
    assert.ok(Math.abs(moved.x-box.x+(after.x-before.x)*after.zoom)<2)
    assert.ok(Math.abs(moved.y-box.y+(after.y-before.y)*after.zoom)<2)
    assert.equal(await status.textContent(),'碎片已掠过')
    assert.ok(page.url().endsWith('/explore'))
  } finally { await page.close() }
})

test('reduced-motion touch users can observe a trajectory with WebGL unavailable', async () => {
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'})
  try {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function(type,...args) {
        return type.startsWith('webgl') ? null : original.call(this,type,...args)
      }
    })
    await page.goto(server.origin + '/explore')
    const hole = page.getByRole('button',{name:'未开放星域，向黑洞投放碎片'})
    await hole.tap()
    await page.locator('.space-announcement').filter({hasText:'已越过视界'}).waitFor({state:'attached'})
    assert.ok(await page.locator('.deep-space-light').isHidden())
    const ctx = page.locator('.deep-space-matter')
    await page.waitForFunction(() => {
      const n = document.querySelector('.deep-space-matter')
      return n?.getContext('2d').getImageData(1,1,1,1).data[3] === 255
    })
    const frame = await ctx.evaluate(n=>n.toDataURL())
    await page.waitForTimeout(160)
    assert.equal(await ctx.evaluate(n=>n.toDataURL()),frame)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390)
  } finally { await page.close() }
})
