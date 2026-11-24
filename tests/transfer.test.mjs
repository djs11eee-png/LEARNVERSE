import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'
import { startTestServer } from './helpers/vite.mjs'

let browser
let server
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

async function openTransfer(page, courseId) {
  await page.goto(`${origin}/academy/${courseId}/project`)
  const transfer = page.getByRole('region', { name: '迁移练习', exact: true })
  await transfer.getByText('打开迁移编辑器', { exact: true }).click()
  return transfer
}

test('alternate JavaScript fixtures require the learner function and save separately from the capstone', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  page.setDefaultTimeout(12000)
  try {
    const transfer = await openTransfer(page, 'lv-javascript-foundations')
    const editor = transfer.getByRole('textbox', { name: '源代码' })
    const run = transfer.getByRole('button', { name: '运行代码', exact: true })
    assert.match(await editor.inputValue(), /^function groupMinutes\(rows, minimum\)/)
    assert.equal(await transfer.getByText('迁移练习已记录', { exact: true }).count(), 0)
    const capstone = page.getByRole('button', { name: '记录项目完成', exact: true })
    assert.equal(await capstone.isDisabled(), true)

    await editor.fill('function groupMinutes() { return [["a", 25], ["b", 20]] }')
    await run.click()
    await transfer.getByText('输出与预期不同。', { exact: true }).waitFor()
    assert.equal(await transfer.getByText('迁移练习已记录', { exact: true }).count(), 0)
    await editor.fill(`function groupMinutes(rows, minimum) {
  const totals = new Map();
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 2) continue;
    const [id, minutes] = row;
    if (typeof id !== "string" || !/^[a-z]+$/.test(id) ||
        !Number.isInteger(minutes) || minutes < 1 || minutes > 120) continue;
    totals.set(id, (totals.get(id) ?? 0) + minutes);
  }
  return [...totals].filter(([, total]) => total >= minimum);
}`)
    await run.click()
    await transfer.getByText('输出与预期一致。', { exact: true }).waitFor()
    await transfer.getByText('迁移练习已记录', { exact: true }).waitFor()
    assert.equal(await capstone.isDisabled(), true)
    await page.reload()
    await transfer.getByText('迁移练习已记录', { exact: true }).waitFor()
    assert.equal(await capstone.isDisabled(), true)
  } finally {
    await page.close()
  }
})

test('the Python transfer runner reads changed inputs and reports their physical line numbers', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  page.setDefaultTimeout(20000)
  try {
    const transfer = await openTransfer(page, 'lv-python-pipeline')
    const editor = transfer.getByRole('textbox', { name: '源代码' })
    assert.match(await editor.inputValue(), /^def analyze\(lines\):/)
    await editor.fill(`def analyze(lines):
    result = {"minutes": [0, 0], "errors": []}
    for number, raw in enumerate(lines, 1):
        if not raw.strip():
            continue
        fields = [field.strip() for field in raw.split(",")]
        if (len(fields) != 2 or fields[0] not in ("focus", "review")
                or fields[1] not in {str(i) for i in range(1, 181)}):
            result["errors"].append(number)
            continue
        result["minutes"][fields[0] == "review"] += int(fields[1])
    return result`)
    await transfer.getByRole('button', { name: '运行代码', exact: true }).click()
    const results = transfer.getByRole('list', { name: '用例结果' })
    await results.getByText('坏行位置', { exact: true }).waitFor()
    assert.equal(await results.getByText('未通过', { exact: true }).count(), 0)
    await transfer.getByText('迁移练习已记录', { exact: true }).waitFor()
  } finally {
    await page.close()
  }
})

test('the Web transfer checklist requires checking every handoff step and exports the learner artifact', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  page.setDefaultTimeout(12000)
  try {
    const transfer = await openTransfer(page, 'lv-web-accessible-state')
    const editor = transfer.getByRole('textbox', { name: '源代码' })
    const complete = transfer.getByRole('button', { name: '记录迁移练习完成', exact: true })
    const checklist = transfer.getByRole('checkbox')
    assert.equal(await checklist.count(), 4)
    await editor.fill('<!doctype html><title>独立作品</title>')
    for (let i = 0; i < 3; i += 1) await checklist.nth(i).check()
    assert.equal(await complete.isDisabled(), true)

    const pendingDownload = page.waitForEvent('download')
    await transfer.getByRole('button', { name: '下载 HTML', exact: true }).click()
    assert.equal((await pendingDownload).suggestedFilename(), 'activity-signup.html')
    await checklist.last().check()
    await complete.click()
    await transfer.getByText('迁移练习已记录', { exact: true }).waitFor()
    await page.reload()
    await transfer.getByText('迁移练习已记录', { exact: true }).waitFor()
  } finally {
    await page.close()
  }
})

test('retrying a failed transfer record preserves a capstone saved by another tab', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  context.setDefaultTimeout(12000)
  try {
    const first = await context.newPage()
    const second = await context.newPage()
    const key = 'learnverse.workspace.v1.lv-web-accessible-state'
    await first.addInitScript((storageKey) => {
      const setItem = Storage.prototype.setItem
      let failOnce = true
      Storage.prototype.setItem = function (k, value) {
        if (k === storageKey && failOnce) {
          failOnce = false
          throw new DOMException('Transfer storage fixture', 'QuotaExceededError')
        }
        setItem.call(this, k, value)
      }
    }, key)
    const transfer = await openTransfer(first, 'lv-web-accessible-state')
    await transfer.getByRole('textbox', { name: '源代码' }).fill('<!doctype html><title>示例</title>')
    for (const checkbox of await transfer.getByRole('checkbox').all()) await checkbox.check()
    await transfer.getByRole('button', { name: '记录迁移练习完成' }).click()
    await transfer.getByText('迁移练习待保存', { exact: true }).waitFor()
    assert.equal(await transfer.getByText('迁移练习已记录', { exact: true }).count(), 0)

    await second.goto(origin + '/academy')
    await second.evaluate((storageKey) => {
      localStorage.setItem(storageKey, JSON.stringify({ completed: [], verified: [], lastLesson: '', projectCompleted: true }))
    }, key)
    await first.getByText('结课项目已完成', { exact: true }).waitFor()
    await first.getByRole('button', { name: '重试保存进度' }).click()
    await transfer.getByText('迁移练习已记录', { exact: true }).waitFor()
    await first.reload()
    await transfer.getByText('迁移练习已记录', { exact: true }).waitFor()
    await first.getByText('结课项目已完成', { exact: true }).waitFor()
  } finally {
    await context.close()
  }
})

test('new IoT cold-chain and Python mistake-book transfer exercises verify dynamically', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  page.setDefaultTimeout(25000)
  try {
    const iot = await openTransfer(page, 'lv-iot-protocols')
    await iot.getByRole('textbox', { name: '源代码' }).fill(`function replayColdChain(events, capacity, timeout) {
  let lastBeat = null, lastSeq = 0, offline = 0, alarms = 0, dropped = 0;
  const seen = new Set(), queue = [];
  for (const ev of events) {
    if (ev.kind === 'beat') {
      if (ev.seq > lastSeq) { lastSeq = ev.seq; lastBeat = ev.at; }
    } else if (ev.kind === 'tick') {
      if (lastBeat === null || ev.at - lastBeat >= timeout) offline++;
    } else if (ev.kind === 'frame') {
      const temp = (ev.raw >>> 4) & 0xFF;
      if ((ev.raw & 1) === 1) {
        if (!seen.has(ev.msgId)) { seen.add(ev.msgId); alarms++; }
      } else if (capacity <= 0) {
        dropped++;
      } else {
        if (queue.length >= capacity) { queue.shift(); dropped++; }
        queue.push(temp);
      }
    }
  }
  return { offline, alarms, dropped, queue };
}`)
    await iot.getByRole('button', { name: '运行代码', exact: true }).click()
    await iot.getByText('输出与预期一致。', { exact: true }).waitFor()
    await iot.getByText('迁移练习已记录', { exact: true }).waitFor()

    const py = await openTransfer(page, 'lv-python-practice')
    await py.getByRole('textbox', { name: '源代码' }).fill(`import json

def summarize_mistakes(raw_text):
    try:
        items = json.loads(raw_text)
    except Exception:
        return {"totals": {}, "bad": -1}
    if not isinstance(items, list):
        return {"totals": {}, "bad": -1}
    totals = {}
    bad = 0
    for item in items:
        if (not isinstance(item, dict) or not isinstance(item.get("topic"), str)
                or not item["topic"].strip() or type(item.get("count")) is not int
                or item["count"] <= 0):
            bad += 1
            continue
        topic = item["topic"].strip()
        totals[topic] = totals.get(topic, 0) + item["count"]
    return {"totals": totals, "bad": bad}`)
    await py.getByRole('button', { name: '运行代码', exact: true }).click()
    await py.getByText('输出与预期一致。', { exact: true }).waitFor()
    await py.getByText('迁移练习已记录', { exact: true }).waitFor()
  } finally {
    await page.close()
  }
})
