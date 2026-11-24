import { ArrowUpRight, Flame, Sparkles, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SeoulGuardianCard } from './SeoulGuardianCard'
import { formatGuardianSerial } from './seoulGuardianStore'
import type { SeoulGuardianRecord } from './seoulGuardianStore'
import './seoul-guardian.css'

const BURST_SHARDS = Array.from({ length: 24 }, (_, idx) => {
  const angle = (idx / 24) * 360 + (idx % 3) * 5
  const dist = 140 + (idx % 5) * 42
  const size = 5 + (idx % 4) * 3
  const delay = (idx % 6) * 28
  const gold = idx % 2 === 0
  return { idx, angle, dist, size, delay, gold }
})

export interface SeoulGuardianRevealModalProps {
  record: SeoulGuardianRecord
  /** 'reveal' triggers golden booster tear & shockwave; 'inspect' opens directly to 3D card */
  mode: 'reveal' | 'inspect'
  onClose: () => void
  showVaultLink?: boolean
}

export function SeoulGuardianRevealModal({
  record,
  mode,
  onClose,
  showVaultLink = true,
}: SeoulGuardianRevealModalProps) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<'sealed' | 'burst' | 'showcase'>(() => {
    if (mode === 'inspect') return 'showcase'
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'showcase'
    }
    return 'sealed'
  })

  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    if (!node.open) node.showModal()
    return () => {
      if (node.open) node.close()
    }
  }, [])

  // Auto-orchestrate golden tear -> shockwave burst -> 3D card showcase
  useEffect(() => {
    if (phase === 'sealed') {
      const t1 = window.setTimeout(() => setPhase('burst'), 620)
      return () => window.clearTimeout(t1)
    }
    if (phase === 'burst') {
      const t2 = window.setTimeout(() => setPhase('showcase'), 540)
      return () => window.clearTimeout(t2)
    }
  }, [phase])

  const serial = formatGuardianSerial(record.rank)

  return (
    <dialog
      ref={dialogRef}
      className="sg-reveal-dialog"
      data-phase={phase}
      aria-labelledby={`${id}-title`}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="sg-reveal-shell">
        <button
          type="button"
          className="sg-modal-close"
          aria-label="关闭全息卡检视"
          onClick={onClose}
        >
          <X size={20} aria-hidden />
        </button>

        {phase !== 'showcase' ? (
          <button
            type="button"
            className="sg-booster-ceremony"
            data-phase={phase}
            aria-label="撕开创世算力补给包"
            onClick={() => setPhase('showcase')}
          >
            <span className="sg-booster-aura" aria-hidden="true" />
            <span className="sg-booster-pack" aria-hidden="true">
              <span className="sg-booster-top">
                <em>GENESIS NODE // SEOUL</em>
                <strong>MYTHIC EDITION</strong>
              </span>
              <span className="sg-booster-seam" />
              <span className="sg-booster-bottom">
                <Sparkles size={30} />
                <strong>{serial}</strong>
                <small>正在注入原初星火…</small>
              </span>
            </span>
            <span className="sg-shockwave" aria-hidden="true" />
            <span className="sg-shards" aria-hidden="true">
              {BURST_SHARDS.map(s => (
                <i
                  key={s.idx}
                  data-gold={s.gold}
                  style={{
                    '--a': `${s.angle}deg`,
                    '--d': `${s.dist}px`,
                    '--s': `${s.size}px`,
                    '--delay': `${s.delay}ms`,
                  } as React.CSSProperties}
                />
              ))}
            </span>
          </button>
        ) : (
          <div className="sg-showcase">
            <header className="sg-showcase-head">
              <span className="sg-showcase-kicker">
                <Sparkles size={14} aria-hidden />
                {mode === 'reveal' ? '创世星火解锁 · 已永久入库收藏馆' : '限量限定 3D 全息典藏'}
              </span>
              <h2 id={`${id}-title`}>首尔服务器守护者 · {serial}</h2>
              <p>
                <Flame size={14} aria-hidden />
                <span>创世守护者身份已激活：每日免费 AI 问答额度自动 +{record.aiDailyBonus} 次</span>
              </p>
            </header>

            <SeoulGuardianCard
              rank={record.rank}
              githubUser={record.githubUser}
              aiDailyBonus={record.aiDailyBonus}
              claimedAt={record.claimedAt}
            />

            <footer className="sg-showcase-foot">
              {showVaultLink && (
                <Link className="sg-foot-primary" to="/my-universe?focus=seoul-guardian" onClick={onClose}>
                  前往收藏馆查看置顶藏品 <ArrowUpRight size={16} aria-hidden />
                </Link>
              )}
              <button type="button" className="sg-foot-secondary" onClick={onClose}>
                收起返回页面
              </button>
            </footer>
          </div>
        )}
      </div>
    </dialog>
  )
}
