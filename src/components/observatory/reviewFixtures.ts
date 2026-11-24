import type { AssistantEvent, AssistantTransport, AuthAdapter, Diagnosis } from './contracts'

export const demoStarter = [
  'const signals = [12, 18, 24];',
  '',
  'for (const signal of signals) {',
  '  console.log(`收到信号 ${signal}`);',
  ']',
].join('\n')

const challenges = ['K7WM', 'R93H', 'B6VX', 'F8NA']
let nextCaptcha = 0
let activeCaptcha: { id: string; answer: string } | undefined

export const demoAuth: AuthAdapter = {
  async getChallenge(signal) {
    signal.throwIfAborted()
    const answer = challenges[nextCaptcha++ % challenges.length]
    const captcha_id = crypto.randomUUID()
    activeCaptcha = { id: captcha_id, answer }
    const glyphs = Array.from(answer, (letter, i) => {
      const x = 11 + i * 24
      const y = i % 2 ? 32 : 30
      return `<text x="${x}" y="${y}" transform="rotate(${i % 2 ? 9 : -8} ${x} ${y})">${letter}</text>`
    }).join('')
    const image = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 44"><rect width="110" height="44" fill="#263333"/><path d="M0 35Q53 6 110 18M0 12Q61 45 110 23" fill="none" stroke="#879d94" stroke-opacity=".56"/><g fill="#e3f3d7" font-family="monospace" font-weight="bold" font-size="22">${glyphs}</g></svg>`
    return { captcha_id, image_url: `data:image/svg+xml,${encodeURIComponent(image)}`, expires_in: 300 }
  },
  async submit(_mode, body, signal) {
    signal.throwIfAborted()
    const expected = activeCaptcha
    activeCaptcha = undefined
    if (expected?.id !== body.captcha_id || expected.answer !== body.captcha_code.toUpperCase()) {
      return { ok: false, error: { code: 'INVALID_CAPTCHA', field: 'captcha_code', message: '验证码不正确，已换一张。请重新输入。' } }
    }
    return { ok: true, user: { id: 'review-visitor', display_name: body.identifier } }
  },
  ...('speechSynthesis' in window && {
    playChallenge(challenge) {
      if (activeCaptcha?.id !== challenge.captcha_id) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(activeCaptcha.answer.split('').join(', '))
      utterance.lang = 'en-US'
      utterance.rate = .7
      window.speechSynthesis.speak(utterance)
    },
    stopChallenge() { window.speechSynthesis.cancel() },
  }),
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, ms)
    function cancel() { clearTimeout(timer); reject(signal.reason) }
    signal.addEventListener('abort', cancel, { once: true })
  })
}

type EventPayload<T = AssistantEvent> = T extends AssistantEvent ? Omit<T, 'v' | 'seq' | 'request_id'> : never

export const demoAssistant: AssistantTransport = async function* (request, signal) {
  let seq = 0
  const event = (payload: EventPayload): AssistantEvent => ({ v: 1, request_id: request.request_id, seq: ++seq, ...payload })
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const context = request.context
  const isDemoError = context?.reference?.source === demoStarter
  yield event({ type: 'response.started', conversation_id: request.conversation_id ?? crypto.randomUUID() })
  await pause(reduced ? 20 : 620, signal)
  const reply = isDemoError
    ? '这是一个**语法错误**。程序在整理指令时就停下了。先看错误行，再往上一两行找成对出现的符号。'
    : request.question.includes('三步法')
      ? '定位语法错误可以按三步推进：**1. 读清报错最后一行**，**2. 向上检查 1～3 行的括号与引号配对**，**3. 缩成最小可复现片段单独运行**。'
      : '可以先读报错的最后一条，再回到它指向的位置。标出的行是解释器停下的位置，真正需要检查的地方也可能在前面。'
  if (reduced) yield event({ type: 'text.delta', delta: reply })
  else {
    const chars = Array.from(reply)
    for (let i = 0; i < chars.length; i += 3) {
      yield event({ type: 'text.delta', delta: chars.slice(i, i + 3).join('') })
      await pause(48, signal)
    }
  }
  if (context?.reference) yield event({ type: 'code.reference', reference: context.reference })
  if (context) {
    const diagnosis: Diagnosis = {
      id: `${request.request_id}-diagnosis`, reference_id: context.reference?.id, line: context.line, column: context.column,
      title: isDemoError ? '循环末尾的括号没有配对' : '从报错位置向前找',
      explanation: isDemoError ? '循环用左花括号开始，结尾却遇到了右方括号。解释器无法把它们配成一对。'
        : '这个样板显示了运行器报告的位置。可以先核对这一行的符号和名称，再检查上一条语句。',
      hints: isDemoError ? ['检查循环结束的位置，想想它需要和哪个开头符号配对。', '找到 for 这一行末尾的符号 `{`，再看最后一个符号。']
        : ['试着把报错附近的代码缩成最短片段，再运行一次。'],
    }
    yield event({ type: 'diagnostic.card', diagnosis })
  }
  const example = isDemoError ? '\n\n可以先把结构单独写一遍，再把自己的语句放回去。\n\n```javascript\nfor (const signal of signals) {\n  // 处理信号\n}\n```'
    : '\n\n例如，先打出变量的值，确认实际输入与你的预期一致。\n\n```javascript\nconsole.log({ value });\n```'
  await pause(reduced ? 20 : 200, signal)
  yield event({ type: 'text.delta', delta: example })
  yield event({ type: 'response.done' })
}
