import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'
import { createServer } from 'vite'

async function startBackendProcess(tempDir) {
  const backendCwd = path.resolve('backend')
  const pyCode = `
import json, socket, sys
import uvicorn
from app.config import Settings
from app.core.security import create_jwt_token
from app.main import create_app
from tests.conftest import FakeDockerSandboxExecutor

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.bind(("127.0.0.1", 0))
port = sock.getsockname()[1]
sock.close()

settings = Settings(
    env="test",
    sqlite_path=${JSON.stringify(path.join(tempDir, 'e2e.sqlite'))},
    legacy_discussion_db=${JSON.stringify(path.join(tempDir, 'none.sqlite'))},
    redis_url="memory://",
    jwt_secret_key="e2e_test_secret_key_for_cross_device_sync_32b!",
    debug=True,
    llm_base_url="",
    llm_api_key="",
    sandbox_temp_root=${JSON.stringify(path.join(tempDir, 'sandbox'))},
    trusted_proxies=["127.0.0.1/32", "::1/128"],
    jwt_cookie_secure=False,
    allowed_origins=[],
    email_verification_enabled=False,
    ai_rate_limit_user_per_day=20,
    ai_guardian_daily_bonus=10,
)
app = create_app(settings=settings, sandbox_executor=FakeDockerSandboxExecutor())
with app.state.container.db.write_transaction() as conn:
    uid = conn.execute(
        "INSERT INTO users(username,role,password_hash,nickname,created_at,updated_at) VALUES ('sync_pilot','student','unused','星航员','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')"
    ).lastrowid
token, _, _ = create_jwt_token(user_id=uid, username="sync_pilot", role="student", secret_key=settings.jwt_secret_key)
print("READY:" + json.dumps({"port": port, "token": token}), flush=True)
uvicorn.run(app, host="127.0.0.1", port=port, log_level="error")
`
  const proc = spawn('python', ['-c', pyCode], {
    cwd: backendCwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const info = await new Promise((resolve, reject) => {
    let buf = ''
    let errBuf = ''
    const timer = setTimeout(() => reject(new Error(`Backend startup timeout. stderr=${errBuf}`)), 15_000)
    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', chunk => { errBuf += chunk })
    proc.stdout.on('data', chunk => {
      buf += chunk
      const line = buf.split(/\r?\n/).find(l => l.startsWith('READY:'))
      if (line) {
        clearTimeout(timer)
        resolve(JSON.parse(line.slice(6)))
      }
    })
    proc.once('exit', code => {
      clearTimeout(timer)
      reject(new Error(`Backend exited early (${code}): ${errBuf}`))
    })
  })

  return {
    origin: `http://127.0.0.1:${info.port}`,
    token: info.token,
    async close() {
      if (proc.exitCode === null) {
        proc.kill()
        await new Promise(resolve => {
          const t = setTimeout(resolve, 3000)
          proc.once('exit', () => { clearTimeout(t); resolve() })
        })
      }
    },
  }
}

test('PC and Mobile devices automatically sync 420-catalog cards, Seoul Guardian card, AI quota, IoT discussions and cloud sandbox', async () => {
  const rootTmp = await realpath(tmpdir())
  const tempDir = await mkdtemp(path.join(rootTmp, 'learnverse-cross-device-'))
  let backend
  let vite
  let browser

  try {
    backend = await startBackendProcess(tempDir)
    vite = await createServer({
      configFile: false,
      cacheDir: path.join(tempDir, 'vite-cache'),
      logLevel: 'error',
      plugins: [react()],
      server: {
        host: '127.0.0.1',
        port: 0,
        strictPort: false,
        hmr: false,
        proxy: {
          '/api': {
            target: backend.origin,
            changeOrigin: false,
          },
        },
      },
    })
    await vite.listen()
    const viteOrigin = `http://127.0.0.1:${vite.httpServer.address().port}`

    // Discover first lesson ID of the 33rd course (`lv-iot-protocols`)
    const { workspaceCourses } = await vite.ssrLoadModule('/src/data/workspaceCourses.ts')
    const iotCourse = workspaceCourses.find(c => c.id === 'lv-iot-protocols')
    assert.ok(iotCourse, 'lv-iot-protocols should exist')
    const iotLessonPath = `/academy/lv-iot-protocols/lesson/${iotCourse.lessons[0].id}`

    browser = await chromium.launch().catch(() => chromium.launch({ channel: 'msedge' }))

    // 1. Guest Mobile context: verify IoT chapter discussion loads (200) & prompts login on POST, and C Cloud Sandbox prompts login
    const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    const guestPage = await guestCtx.newPage()
    await guestPage.addInitScript(() => {
      window.__LEARNVERSE_CLOUD_SANDBOX__ = true
      sessionStorage.setItem('learnverse.intro.v1', '1')
    })
    await guestPage.goto(viteOrigin + iotLessonPath)
    const guestDisc = guestPage.getByRole('region', { name: '本章讨论' })
    await guestDisc.getByText('本章还没有讨论。').waitFor({ timeout: 10_000 })
    await guestDisc.getByLabel('发起讨论').fill('未登录草稿保留测试')
    await guestDisc.getByRole('button', { name: '发布讨论' }).click()
    await guestDisc.getByRole('alert').filter({ hasText: /先登录观测站账号/ }).waitFor({ timeout: 8000 })
    await guestDisc.getByRole('button', { name: '立即登录 / 注册' }).waitFor()
    assert.equal(await guestDisc.getByLabel('发起讨论').inputValue(), '未登录草稿保留测试')

    await guestPage.goto(viteOrigin + '/lab')
    const guestPack = guestPage.getByRole('dialog', { name: '知识补给包' })
    await guestPack.getByRole('button', { name: '关闭', exact: true }).click()
    await guestPack.waitFor({ state: 'hidden' })
    await guestPage.getByRole('button', { name: /编程语言/ }).click()
    await guestPage.getByRole('option', { name: 'C · Windows 本机' }).click()
    await guestPage.locator('.lab-free-practice').getByRole('button', { name: '登录启用云端编译沙盒' }).waitFor({ timeout: 8000 })
    await guestCtx.close()

    // 2. Authenticated PC context (`1440x900`): open welcome booster pack, claim Seoul Guardian #0001, use 1 AI quota, post discussion, run C sandbox
    const pcCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    await pcCtx.addCookies([{ name: 'lv_access_token', value: backend.token, url: viteOrigin + '/api' }])
    const pcPage = await pcCtx.newPage()
    await pcPage.addInitScript(() => {
      window.__LEARNVERSE_CLOUD_SANDBOX__ = true
      sessionStorage.setItem('learnverse.intro.v1', '1')
    })

    // Open welcome pack on PC -> triggers automatic debounced union sync to cloud
    await pcPage.goto(viteOrigin + '/my-universe')
    const packDialog = pcPage.getByRole('dialog', { name: '知识补给包' })
    await packDialog.getByRole('button', { name: '撕开卡包', exact: true }).click()
    await packDialog.getByText('点一张卡，单独放大查看').waitFor({ timeout: 8000 })
    await packDialog.getByRole('button', { name: '关闭', exact: true }).click()
    await pcPage.locator('.vault-counter').filter({ hasText: /已点亮\s*5\s*\/\s*420\s*张/ }).waitFor({ timeout: 8000 })

    // Claim Seoul Node Guardian card (#0001) on PC Home banner
    await pcPage.goto(viteOrigin + '/')
    await pcPage.getByRole('button', { name: /模拟领卡 #0001/ }).click()
    await pcPage.getByRole('button', { name: /已点亮 NO\.0001/ }).waitFor({ timeout: 8000 })
    const revealClose = pcPage.getByRole('button', { name: /收入收藏馆|关闭/ }).first()
    if (await revealClose.isVisible().catch(() => false)) {
      await revealClose.click().catch(() => {})
    }
    await pcPage.keyboard.press('Escape').catch(() => {})

    // Open Vesper on PC -> verify Guardian 30/30 quota -> send 1 question -> verify live decrement to 29/30!
    await pcPage.goto(viteOrigin + '/lab')
    await pcPage.getByRole('button', { name: '打开 Vesper 桌宠对话' }).click()
    const pcDrawer = pcPage.getByRole('dialog', { name: '和 Vesper 对话' })
    await pcDrawer.getByTestId('ai-quota-pill').filter({ hasText: '守护者 · 今日剩余 30 / 30 次' }).waitFor({ timeout: 8000 })
    await pcDrawer.getByLabel('给 Vesper 的问题').fill('帮我看看 Python 缩进报错怎么查')
    await pcDrawer.getByRole('button', { name: '发送给 Vesper' }).click()
    await pcDrawer.getByTestId('ai-quota-pill').filter({ hasText: '守护者 · 今日剩余 29 / 30 次' }).waitFor({ timeout: 8000 })
    await pcDrawer.getByRole('button', { name: '关闭助手抽屉' }).click()

    // Run C code in Cloud Sandbox on PC
    await pcPage.getByRole('button', { name: /编程语言/ }).click()
    await pcPage.getByRole('option', { name: 'C · Windows 本机' }).click()
    const cRunBtn = pcPage.locator('.lab-free-practice').getByRole('button', { name: '运行代码', exact: true })
    await cRunBtn.waitFor({ timeout: 8000 })
    await cRunBtn.click()
    await pcPage.locator('.lab-free-practice').getByText('Hello, LEARNVERSE!').waitFor({ timeout: 8000 })

    // Post discussion on IoT chapter from PC
    await pcPage.goto(viteOrigin + iotLessonPath)
    const pcDisc = pcPage.getByRole('region', { name: '本章讨论' })
    await pcDisc.getByLabel('发起讨论').fill('PC 端物联网位掩码笔记已同步！')
    await pcDisc.getByRole('button', { name: '发布讨论' }).click()
    await pcDisc.getByText('讨论已发布。', { exact: true }).waitFor({ timeout: 8000 })

    // Wait briefly so PC's debounced auto-sync (`650ms`) finishes persisting to SQLite
    await pcPage.waitForTimeout(900)

    // 3. Authenticated Phone context (`390x844`, fresh isolated browser storage) logged into the SAME account!
    const phoneCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    })
    await phoneCtx.addCookies([{ name: 'lv_access_token', value: backend.token, url: viteOrigin + '/api' }])
    const phonePage = await phoneCtx.newPage()
    await phonePage.addInitScript(() => {
      sessionStorage.setItem('learnverse.intro.v1', '1')
    })

    // Navigate directly to `/my-universe?focus=seoul-guardian` on Phone WITHOUT clicking any manual sync button!
    await phonePage.goto(viteOrigin + '/my-universe?focus=seoul-guardian')

    // Verify 1: All 5 cards + 1 Seoul Guardian card (total 6 lit!) automatically synced to Phone!
    await phonePage.locator('.vault-counter').filter({ hasText: /已点亮\s*6\s*\/\s*420\s*张/ }).waitFor({ timeout: 10_000 })
    await phonePage.locator('.vault-genesis-serial').filter({ hasText: 'NO.0001 / 0100' }).waitFor({ timeout: 8000 })

    // Verify 2: Phone automatically shows the exact synced AI quota (`AI 问答剩余 29/30 次`)!
    await phonePage.getByTestId('dashboard-ai-quota').filter({ hasText: 'AI 问答剩余 29/30 次' }).waitFor({ timeout: 8000 })

    // Verify 3: Phone reads PC's IoT chapter discussion and posts a reply!
    await phonePage.goto(viteOrigin + iotLessonPath)
    const phoneDisc = phonePage.getByRole('region', { name: '本章讨论' })
    await phoneDisc.getByText('PC 端物联网位掩码笔记已同步！', { exact: true }).waitFor({ timeout: 8000 })
    await phoneDisc.getByRole('button', { name: '回复', exact: true }).click()
    await phoneDisc.getByLabel('写回复').fill('手机端收到，跨端完全打通！')
    await phoneDisc.getByRole('button', { name: '发布回复' }).click()
    await phoneDisc.getByText('回复已发布。', { exact: true }).waitFor({ timeout: 8000 })

    // Verify 4: Logging out on Phone clears previous account's local vault & guardian storage (no cross-account bleed)
    await phonePage.locator('details.account > summary').click()
    await phonePage.getByRole('button', { name: '退出登录' }).click()
    await phonePage.waitForFunction(() => {
      return localStorage.getItem('learnverse.cloud-base.v1') === null
        && localStorage.getItem('learnverse.vault.v1.genesis/seoul-node') === null
    }, null, { timeout: 6000 })

    await phoneCtx.close()
    await pcCtx.close()
  } finally {
    try { await browser?.close() }
    finally {
      try { await vite?.close() }
      finally {
        try { await backend?.close() }
        finally {
          await rm(tempDir, { recursive: true, force: true, maxRetries: 2 }).catch(() => {})
        }
      }
    }
  }
})
