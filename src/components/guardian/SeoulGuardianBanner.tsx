import { ArrowUpRight, Flame, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  SEOUL_GUARDIAN_LIMIT,
  SEOUL_GUARDIAN_NODE_LABEL,
  formatGuardianShortNo,
  saveSeoulGuardian,
  useSeoulGuardian,
} from '../../cards/seoulGuardianStore'
import type { SeoulGuardianRecord } from '../../cards/seoulGuardianStore'
import './seoul-guardian-banner.css'

const loadSeoulGuardianRevealModal = () =>
  import('../../cards/SeoulGuardianRevealModal').then(m => ({ default: m.SeoulGuardianRevealModal }))
const SeoulGuardianRevealModal = lazy(loadSeoulGuardianRevealModal)

interface GuardianStatusResponse {
  stars: number
  remaining: number
  limit: number
  claimed?: number
  next_rank?: number
  oauth_configured?: boolean
  debug_mock_enabled?: boolean
  is_genesis_guardian?: boolean
  daily_ai_bonus?: number
}

const DEFAULT_STATUS: GuardianStatusResponse = {
  stars: 23,
  remaining: 77,
  limit: SEOUL_GUARDIAN_LIMIT,
  claimed: 23,
  next_rank: 24,
  oauth_configured: false,
  debug_mock_enabled: import.meta.env.DEV,
}

function getApiBase(): string {
  const configured = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  return ''
}

export interface SeoulGuardianBannerProps {
  /** Callback to trigger Cosmic Girl Mascot (Vesper) 3s celebrating animation + bubble */
  onStarSuccess?: (payload: { rank: number; githubUser: string }) => void
  /** External trigger to open 3D card modal (e.g. clicking Vesper when already claimed) */
  externalInspectNonce?: number
}

export function SeoulGuardianBanner({ onStarSuccess, externalInspectNonce = 0 }: SeoulGuardianBannerProps) {
  const claimedCard = useSeoulGuardian()
  const [status, setStatus] = useState<GuardianStatusResponse>(DEFAULT_STATUS)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<{ mode: 'reveal' | 'inspect'; record: SeoulGuardianRecord } | null>(null)

  const apiBase = getApiBase()

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch(`${apiBase}/api/github/status`, { credentials: 'include' })
      if (!resp.ok) return
      const data = (await resp.json()) as GuardianStatusResponse
      if (typeof data.stars === 'number' && typeof data.limit === 'number') {
        setStatus(data)
      }
    } catch {
      // Pure frontend local preview without FastAPI running stays gracefully functional
    }
  }, [apiBase])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  // Open 3D card inspect modal if parent (e.g. Vesper click) requests it
  useEffect(() => {
    if (externalInspectNonce > 0 && claimedCard) {
      setModal({ mode: 'inspect', record: claimedCard })
    }
  }, [externalInspectNonce, claimedCard])

  const completeStarClaim = useCallback((rank: number, githubUser: string, aiDailyBonus = 10) => {
    void loadSeoulGuardianRevealModal()
    const saved = saveSeoulGuardian({ rank, githubUser, aiDailyBonus })
    setNotice('')
    setLoading(false)
    setStatus(prev => {
      const nextStars = Math.max(prev.stars + (claimedCard ? 0 : 1), rank <= prev.limit ? rank : prev.stars)
      return {
        ...prev,
        stars: nextStars,
        remaining: Math.max(0, prev.limit - nextStars),
        is_genesis_guardian: true,
        daily_ai_bonus: aiDailyBonus,
      }
    })
    onStarSuccess?.({ rank: saved.rank, githubUser: saved.githubUser })
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setModal({ mode: 'reveal', record: saved })
    } else {
      // Brief 550ms spotlight so the user sees Vesper jump & burst with cyan-gold particles before the golden pack opens
      window.setTimeout(() => {
        setModal({ mode: 'reveal', record: saved })
      }, 550)
    }
    void fetchStatus()
  }, [claimedCard, fetchStatus, onStarSuccess])

  // Listen for OAuth callback postMessage({ type: 'STAR_SUCCESS', rank, githubUser })
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'STAR_SUCCESS') {
        const rank = typeof data.rank === 'number' && Number.isFinite(data.rank) ? data.rank : 1
        const githubUser = typeof data.githubUser === 'string' && data.githubUser ? data.githubUser : 'genesis-pilot'
        const bonus = typeof data.aiDailyBonus === 'number' ? data.aiDailyBonus : 10
        completeStarClaim(rank, githubUser, bonus)
      } else if (data.type === 'STAR_ERROR') {
        setLoading(false)
        setNotice(typeof data.error === 'string' && data.error ? data.error : 'GitHub 授权未完成，请重试。')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [completeStarClaim])

  function startOAuthStar() {
    setNotice('')
    setLoading(true)
    const width = 540
    const height = 680
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))
    const loginUrl = `${apiBase}/api/github/login`
    const popup = window.open(
      loginUrl,
      'learnverse_github_star_oauth',
      `width=${width},height=${height},left=${left},top=${top},noopener=no,resizable=yes,scrollbars=yes`,
    )
    if (!popup) {
      setLoading(false)
      setNotice('浏览器拦截了授权弹窗，请允许本站弹窗后重试。')
      return
    }
    const poll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(poll)
        setLoading(false)
      }
    }, 500)
  }

  async function triggerDebugMockStar() {
    setNotice('')
    setLoading(true)
    try {
      const resp = await fetch(`${apiBase}/api/github/mock-star`, { credentials: 'include' })
      if (resp.ok) {
        const data = await resp.json()
        completeStarClaim(
          typeof data.rank === 'number' ? data.rank : 1,
          typeof data.githubUser === 'string' ? data.githubUser : 'seoul-debug-pilot',
          typeof data.aiDailyBonus === 'number' ? data.aiDailyBonus : 10,
        )
        return
      }
    } catch {
      // Fallback for pure Vite dev mode without FastAPI running on :8000
    }
    if (import.meta.env.DEV) {
      completeStarClaim(1, 'seoul-debug-pilot', 10)
    } else {
      setLoading(false)
      setNotice('当前环境未开启 DEBUG=true 本地调试接口。')
    }
  }

  const limit = Math.max(1, status.limit || SEOUL_GUARDIAN_LIMIT)
  const stars = Math.max(0, status.stars)
  const pct = Math.min(100, Math.round((stars / limit) * 100))
  const nextRank = status.next_rank ?? Math.min(limit, stars + 1)
  const nextLabel = formatGuardianShortNo(nextRank, limit)
  const claimedLabel = claimedCard ? formatGuardianShortNo(claimedCard.rank, limit) : ''
  const showDebugMock = Boolean(status.debug_mock_enabled || import.meta.env.DEV)

  return (
    <section className="sg-home-banner" id="seoul-guardian" aria-labelledby="sg-banner-title">
      <div className="sg-banner-grid-bg" aria-hidden="true" />

      <div className="sg-banner-main">
        <div className="sg-banner-eyebrow">
          <span className="sg-node-dot" aria-hidden="true" />
          <span lang="en">GENESIS COMPUTE GUARDIAN // {SEOUL_GUARDIAN_NODE_LABEL}</span>
          <span className="sg-mythic-chip">LIMITED 100</span>
        </div>

        <h2 id="sg-banner-title">
          首尔服务器守护者 · <span>创世算力节点计划</span>
        </h2>

        {/* Energy Progress Bar */}
        <div className="sg-energy-block">
          <div className="sg-energy-label">
            <span>
              <Zap size={15} aria-hidden />
              首尔服务器续费能量：
            </span>
            <strong>
              {stars} / {limit} Stars
              <small>（创世守护者席位 · 剩余 {Math.max(0, limit - stars)} 席）</small>
            </strong>
          </div>
          <div
            className="sg-energy-track"
            role="progressbar"
            aria-label="首尔服务器续费能量进度"
            aria-valuenow={Math.min(stars, limit)}
            aria-valuemin={0}
            aria-valuemax={limit}
          >
            <div className="sg-energy-fill" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
        </div>

        {/* Action Row */}
        <div className="sg-banner-actions">
          {claimedCard ? (
            <>
              <button
                type="button"
                className="sg-star-cta is-claimed"
                onClick={() => setModal({ mode: 'inspect', record: claimedCard })}
              >
                <Sparkles size={17} aria-hidden />
                <span>已点亮 {claimedLabel} · 全屏把玩 3D 守护者限定卡</span>
              </button>
              <Link className="sg-vault-jump" to="/my-universe?focus=seoul-guardian">
                前往收藏馆查看置顶藏品 <ArrowUpRight size={15} aria-hidden />
              </Link>
            </>
          ) : (
            <button
              type="button"
              className="sg-star-cta"
              disabled={loading}
              onClick={startOAuthStar}
            >
              <Star size={17} aria-hidden />
              <span>
                {loading
                  ? '正在等待 GitHub 授权完成…'
                  : `⚡ 一键点亮 Star · 领取 ${nextLabel} 守护者限定卡`}
              </span>
            </button>
          )}

          {showDebugMock && (
            <button
              type="button"
              className="sg-debug-mock-btn"
              disabled={loading}
              onClick={() => void triggerDebugMockStar()}
              title="本地 DEBUG 模式快速触发 STAR_SUCCESS 揭晓动画与收藏馆入库"
            >
              <Sparkles size={14} aria-hidden />
              {claimedCard ? '重播揭晓演出 (#0001)' : '本地调试 · 模拟领卡 #0001'}
            </button>
          )}
        </div>

        {/* Security Assurance + Guardian Bonus Status */}
        <div className="sg-banner-meta">
          <p className="sg-security-note">
            <ShieldCheck size={14} aria-hidden />
            仅申请单次 public_repo 权限自动点亮 Star，后端内存阅后即焚，绝不留存 Token
          </p>
          <p className="sg-bonus-note">
            <Flame size={14} aria-hidden />
            {claimedCard || status.is_genesis_guardian
              ? `创世守护者身份已激活：每日免费 AI 问答额度 +${claimedCard?.aiDailyBonus ?? status.daily_ai_bonus ?? 10} 次`
              : '成为创世守护者后，每日免费 AI 问答额度自动额外 +10 次'}
          </p>
        </div>

        {notice && <p className="sg-banner-notice" role="status">{notice}</p>}
      </div>

      {/* Right-side Miniature Mythic Preview Emblem */}
      <button
        type="button"
        className="sg-banner-preview"
        aria-label={claimedCard ? '检视我的首尔服务器守护者 3D 限定卡' : '预览首尔服务器守护者限定卡信息'}
        onPointerEnter={() => { void loadSeoulGuardianRevealModal() }}
        onClick={() => {
          if (claimedCard) setModal({ mode: 'inspect', record: claimedCard })
          else if (showDebugMock) void triggerDebugMockStar()
          else startOAuthStar()
        }}
      >
        <span className="sg-preview-glow" aria-hidden="true" />
        <span className="sg-preview-top">
          <em>MYTHIC · GENESIS</em>
          <strong>{claimedCard ? claimedLabel : nextLabel}</strong>
        </span>
        <span className="sg-preview-core" aria-hidden="true">
          <i />
          <Zap size={28} strokeWidth={1.5} />
        </span>
        <span className="sg-preview-foot">
          <strong>SEOUL NODE</strong>
          <small>{claimedCard ? `@${claimedCard.githubUser}` : '点击点亮原初星火'}</small>
        </span>
      </button>

      {modal && (
        <Suspense fallback={null}>
          <SeoulGuardianRevealModal
            record={modal.record}
            mode={modal.mode}
            onClose={() => setModal(null)}
          />
        </Suspense>
      )}
    </section>
  )
}
