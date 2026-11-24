import assert from 'node:assert/strict'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { chromium } from 'playwright'
import { startTestServer } from './helpers/vite.mjs'

test('two independent students can discuss a chapter and recover an unacknowledged submission', async () => {
  const root = await realpath(tmpdir())
  const directory = await mkdtemp(path.join(root, 'learnverse-discussions-'))
  const oldDirectory = process.env.LEARNVERSE_DISCUSSION_DIR
  process.env.LEARNVERSE_DISCUSSION_DIR = directory
  let server
  let browser
  try {
    server = await startTestServer()
    browser = await chromium.launch().catch(() => chromium.launch({ channel: 'msedge' }))
    const author = await browser.newPage({ reducedMotion: 'reduce' })
    const peer = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    const room = '/api/discussions/lv-python-foundations/values'
    const lesson = server.origin + '/academy/lv-python-foundations/lesson/values'
    await author.addInitScript(() => localStorage.setItem('learnverse.student-profile.v1', JSON.stringify({ nickname: '本机昵称' })))
    await Promise.all([author.goto(lesson), peer.goto(lesson)])
    const first = author.getByRole('region', { name: '本章讨论' })
    const second = peer.getByRole('region', { name: '本章讨论' })
    await first.getByLabel('发起讨论').fill('我把例子换成了自己的输入。')
    assert.equal(await first.getByLabel('公开署名').inputValue(), '')
    await first.getByRole('button', { name: '用学员昵称' }).click()
    assert.equal(await first.getByLabel('公开署名').inputValue(), '本机昵称')
    await first.getByLabel('公开署名').fill('小林')
    // Simulate a lost acknowledgement after the server has already committed.
    await author.route('**' + room, async route => {
      if (route.request().method() !== 'POST') return route.continue()
      const response = await route.fetch()
      assert.equal(response.status(), 200)
      await route.abort()
    })
    await first.getByRole('button', { name: '发布讨论' }).click()
    await first.getByRole('alert').waitFor()
    await author.unroute('**' + room)
    await author.reload()
    assert.equal(await first.getByLabel('发起讨论').inputValue(), '我把例子换成了自己的输入。')
    await first.getByRole('button', { name: '发布讨论' }).click()
    await first.getByText('讨论已发布。', { exact: true }).waitFor()

    await second.getByRole('button', { name: '刷新讨论' }).click()
    await second.getByText('我把例子换成了自己的输入。', { exact: true }).waitFor()
    assert.equal(await second.getByText('小林', { exact: true }).count(), 1)
    await second.getByRole('button', { name: '回复', exact: true }).click()
    await second.getByLabel('写回复').fill('我也试了不同的值。')
    await second.getByRole('button', { name: '发布回复' }).click()
    await second.getByText('回复已发布。', { exact: true }).waitFor()
    await first.getByRole('button', { name: '刷新讨论' }).click()
    await first.getByText('我也试了不同的值。', { exact: true }).waitFor()
    assert.equal(await first.getByText('访客', { exact: true }).count(), 1)
    assert.ok(await second.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
    const next = await author.getByRole('link', { name: '下一章' }).getAttribute('href')
    const other = next.replace('/academy/', '/api/discussions/').replace('/lesson/', '/')
    const isolated = await fetch(server.origin + other)
    assert.deepEqual((await isolated.json()).threads, [])
    await server.close()
    server = await startTestServer()
    const persisted = await fetch(server.origin + room)
    const { threads } = await persisted.json()
    assert.equal(threads.length, 1)
    assert.equal(threads[0].replies.length, 1)
    for (let index = 1; index <= 4; index++) {
      const response = await fetch(server.origin + room, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: crypto.randomUUID().replaceAll('-', ''), parent: threads[0].id, body: '附记 ' + index }),
      })
      assert.equal(response.status, 200)
    }
    await peer.goto(server.origin + '/academy/lv-python-foundations/lesson/values')
    await second.getByText('附记 4', { exact: true }).waitFor()
    await second.getByRole('button', { name: '更早回复' }).click()
    await second.getByText('我也试了不同的值。', { exact: true }).waitFor()
    await second.getByRole('button', { name: '较新回复' }).click()
    await second.getByText('附记 4', { exact: true }).waitFor()
  } finally {
    try { await browser?.close() }
    finally {
      try { await server?.close() }
      finally {
        if (oldDirectory === undefined) delete process.env.LEARNVERSE_DISCUSSION_DIR
        else process.env.LEARNVERSE_DISCUSSION_DIR = oldDirectory
        const resolved = await realpath(directory)
        if (resolved === directory && path.dirname(resolved) === root) {
          await rm(resolved, { recursive: true, force: true, maxRetries: 2 })
        }
      }
    }
  }
})
