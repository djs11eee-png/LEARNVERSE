import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { createLocalProcessRunner } from '../scripts/local-process.mjs'

test('local tasks preserve arguments and stdio and release the runner after a deadline', async () => {
  const runner = await createLocalProcessRunner({ cwd: process.cwd(), env: process.env })
  try {
    const value = '课程目录\\folder with spaces\\'
    const result = await runner.run(process.execPath, ['-e', 'process.stdout.write(process.argv[1]); process.stdin.pipe(process.stdout)', value], {
      input: '\nLEARNVERSE 学习站',
    })
    assert.equal(result.code, 0, JSON.stringify(result))
    assert.equal(result.output, `${value}\nLEARNVERSE 学习站`)

    const controller = new AbortController()
    const cancel = setTimeout(() => controller.abort(), 500)
    try {
      const stopped = await runner.run(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { signal: controller.signal })
      assert.match(stopped.stopped, /停止/)
    } finally {
      clearTimeout(cancel)
    }
    const next = await runner.run(process.execPath, ['-e', 'console.log("ready")'])
    assert.equal(next.output.trim(), 'ready', JSON.stringify(next))
  } finally {
    await runner.close()
  }
})

test('the Windows job closes a child task that shares standard output with its parent', { skip: process.platform !== 'win32' }, async () => {
  const runner = await createLocalProcessRunner({ cwd: process.cwd(), env: process.env })
  try {
    const task = await runner.run(process.execPath, ['-e', `
      const { spawn } = require('node:child_process');
      const worker = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 4000)'], {
        stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true,
      });
      worker.once('spawn', () => { console.log(worker.pid); worker.unref(); });
    `])
    assert.equal(task.code, 0, JSON.stringify(task))
    assert.equal(task.stopped, '')
    const pid = Number(task.output.trim())
    assert.ok(Number.isSafeInteger(pid) && pid > 0)
    function gone() {
      try { process.kill(pid, 0); return false }
      catch (error) { if (error.code === 'ESRCH') return true; throw error }
    }
    for (let attempt = 0; attempt < 20 && !gone(); attempt++) await delay(25)
    assert.ok(gone(), 'The child should leave the job before its own timer finishes')
  } finally {
    await runner.close()
  }
})
