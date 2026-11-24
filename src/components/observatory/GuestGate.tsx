import { ArrowRight, AudioLines, CircleAlert, Cloud, Eye, EyeOff, LockKeyhole, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ASSISTANT_NAME } from './contracts'
import type { AuthAdapter, AuthField, AuthMode, CaptchaChallenge, GateReason } from './contracts'
import { containTab, useStationDialog, useVisibleViewport } from './dialog'

const reasonCopy: Record<GateReason, string> = {
  sync_cards: '登录后可将卡册同步到其他设备。',
  sync_progress: '登录后可在其他设备上接着学。',
  assistant: `登录后即可和 ${ASSISTANT_NAME} 对话。`,
}

interface GuestGateProps {
  reason: GateReason
  adapter: AuthAdapter
  opener: HTMLElement | null
  onDismiss: () => void
  onAuthenticated: () => void
}

export function GuestGate({ reason, adapter, opener, onDismiss, onAuthenticated }: GuestGateProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const captchaInput = useRef<HTMLInputElement>(null)
  const fetchJob = useRef<AbortController>(null)
  const submitJob = useRef<AbortController>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const id = useId()
  const [mode, setMode] = useState<AuthMode>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [challenge, setChallenge] = useState<CaptchaChallenge>()
  const [challengeError, setChallengeError] = useState('')
  const [failure, setFailure] = useState<{ message: string; field?: AuthField }>()
  const viewport = useVisibleViewport()
  useStationDialog(dialog, heading, opener)

  const refresh = useCallback(async () => {
    fetchJob.current?.abort()
    audio.current?.pause()
    adapter.stopChallenge?.()
    const controller = new AbortController()
    fetchJob.current = controller
    setChallenge(undefined)
    setChallengeError('')
    if (captchaInput.current) captchaInput.current.value = ''
    try {
      const next = await adapter.getChallenge(controller.signal)
      if (!controller.signal.aborted) setChallenge(next)
    } catch {
      if (!controller.signal.aborted) setChallengeError('验证码暂时无法加载，请点击刷新重试。')
    }
  }, [adapter])

  useEffect(() => {
    void refresh()
    return () => {
      fetchJob.current?.abort()
      submitJob.current?.abort()
      audio.current?.pause()
      adapter.stopChallenge?.()
    }
  }, [adapter, refresh])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!challenge || submitJob.current) return
    const data = new FormData(event.currentTarget)
    const identifier = String(data.get('identifier') ?? '').trim()
    const captchaCode = String(data.get('captcha_code') ?? '').trim()
    if (!identifier || !captchaCode) {
      setFailure(!identifier ? { field: 'identifier', message: '请输入用户名或邮箱。' }
        : { field: 'captcha_code', message: '请输入验证码。' })
      return
    }
    const recoveryEmail = String(data.get('recovery_email') ?? '').trim()
    const controller = new AbortController()
    submitJob.current = controller
    setPending(true)
    setFailure(undefined)
    try {
      const result = await adapter.submit(mode, {
        identifier, password: String(data.get('password') ?? ''), captcha_id: challenge.captcha_id,
        captcha_code: captchaCode, ...(recoveryEmail && { recovery_email: recoveryEmail }),
      }, controller.signal)
      if (controller.signal.aborted) return
      if (result.ok) { onAuthenticated(); return }
      setFailure(result.error)
      void refresh()
      if (result.error.field === 'captcha_code') captchaInput.current?.focus({ preventScroll: true })
    } catch {
      if (controller.signal.aborted) return
      setFailure({ message: '暂时无法登录，请检查网络后再试。' })
      void refresh()
    } finally {
      if (!controller.signal.aborted) {
        submitJob.current = null
        setPending(false)
      }
    }
  }

  function fieldState(field: AuthField) {
    return failure?.field === field ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } as const : {}
  }

  return <dialog ref={dialog} style={viewport} className="lvo-dialog lvo-auth" aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-reason`} onKeyDown={containTab} onCancel={event => { event.preventDefault(); onDismiss() }}>
    <header className="lvo-auth-header">
      <span className="lvo-emblem"><LockKeyhole size={23} strokeWidth={1.65} aria-hidden /></span>
      <button type="button" className="lvo-icon" aria-label="关闭登录弹窗" onClick={onDismiss}><X size={19} aria-hidden /></button>
    </header>
    <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{mode === 'login' ? '登录观测站' : '注册观测站账号'}</h2>
    <p id={`${id}-reason`} className="lvo-gate-reason">{reasonCopy[reason]}</p>
    <div className="lvo-mode" role="group" aria-label="账号操作">
      <button type="button" aria-pressed={mode === 'login'} disabled={pending} onClick={() => { setMode('login'); setFailure(undefined); setShowPassword(false) }}>登录</button>
      <button type="button" aria-pressed={mode === 'register'} disabled={pending} onClick={() => { setMode('register'); setFailure(undefined); setShowPassword(false) }}>注册</button>
    </div>
    <form key={mode} className="lvo-auth-form" onSubmit={submit}>
      <label className="lvo-field">用户名或邮箱
        <input
          required
          name="identifier"
          maxLength={254}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={mode === 'register' ? '3–24 位字母、数字、下划线或连字符' : '输入账号名或绑定邮箱'}
          {...fieldState('identifier')}
        />
      </label>
      <label className="lvo-field" htmlFor={`${id}-password`}>密码</label>
      <div className="lvo-password">
        <input
          id={`${id}-password`}
          required
          name="password"
          type={showPassword ? 'text' : 'password'}
          maxLength={128}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          placeholder={mode === 'register' ? '至少 8 位字符' : '输入账号密码'}
          {...fieldState('password')}
        />
        <button className="lvo-icon" type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword(value => !value)}>
          {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      <label className="lvo-field" htmlFor={`${id}-captcha`}>验证码</label>
      <div className="lvo-captcha">
        <input id={`${id}-captcha`} ref={captchaInput} required name="captcha_code" maxLength={16} autoComplete="off"
          autoCapitalize="none" spellCheck={false} placeholder="输入图中字符" {...fieldState('captcha_code')} />
        {challenge ? <img className="lvo-challenge" src={challenge.image_url} alt="图形验证码" />
          : <span className="lvo-challenge" role="status">{challengeError ? '加载失败' : '加载中…'}</span>}
        <button className="lvo-icon" type="button" title="刷新验证码" aria-label="刷新验证码" disabled={pending} onClick={() => void refresh()}>
          <RefreshCw size={17} aria-hidden />
        </button>
      </div>
      {challenge && (challenge.audio_url || adapter.playChallenge) && <button type="button" className="lvo-text lvo-listen"
        onClick={() => {
          setChallengeError('')
          if (!challenge.audio_url) { adapter.playChallenge?.(challenge); return }
          audio.current?.pause()
          const player = new Audio(challenge.audio_url)
          audio.current = player
          void player.play().catch(() => setChallengeError('语音暂时无法播放，请刷新验证码。'))
        }}><AudioLines size={15} aria-hidden /> 听验证码</button>}
      {challengeError && <p className="lvo-error" role="alert">{challengeError}</p>}
      <details className="lvo-recovery">
        <summary>{mode === 'register' ? '绑定找回邮箱（可选）' : '忘记密码？'}</summary>
        {mode === 'register' ? <label className="lvo-field">找回邮箱
          <input name="recovery_email" type="email" autoComplete="email" maxLength={254} {...fieldState('recovery_email')} />
        </label> : <p>邮箱找回入口预留，接入后可用已绑定的邮箱重置密码。</p>}
      </details>
      {failure && <p id={`${id}-error`} className="lvo-error" role="alert"><CircleAlert size={16} aria-hidden />{failure.message}</p>}
      <button type="submit" className="lvo-primary" disabled={pending || !challenge}>
        {pending ? '正在验证…' : mode === 'login' ? '登录并继续' : '注册并继续'}<ArrowRight size={17} aria-hidden />
      </button>
      <button type="button" className="lvo-text lvo-guest" onClick={onDismiss}><Cloud size={16} aria-hidden /> 继续游客探索</button>
    </form>
  </dialog>
}
