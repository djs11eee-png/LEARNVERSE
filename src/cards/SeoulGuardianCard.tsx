import { Compass, Cpu, Flame, RotateCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import { clamp, useHoloMotion } from './useHoloMotion'
import { SEOUL_GUARDIAN_NODE_LABEL, formatGuardianSerial } from './seoulGuardianStore'
import './seoul-guardian.css'

const MATRIX_COLUMNS = [
  '01\nA9\nFF\n72\n::\n10\nC4\n8E\n01\nD0\n3F\n9A',
  'KR\nSE\nOU\nL-\n01\n//\n01\nE7\n9C\nA0\n7F\n11',
  'FX\n00\nF5\nD4\n>>\n1A\nB8\n42\n01\n77\nE2\n88',
  'SY\nNC\n+72\nHR\n01\n9F\n2B\nCC\n4D\n00\nA1\n55',
  'NO\nDE\n01\n8C\n3A\n::\nFF\nD1\n66\n10\nE9\n04',
  'ST\nAR\n++\n01\n7B\n4E\n90\n22\nF1\n0A\n6C\n33',
]

export interface SeoulGuardianCardProps {
  rank: number
  githubUser?: string
  aiDailyBonus?: number
  claimedAt?: string
  /** Show interactive flip/gyro toolbar beneath card (for modal inspection) */
  interactiveControls?: boolean
  compact?: boolean
}

export function SeoulGuardianCard({
  rank,
  githubUser = 'genesis-pilot',
  aiDailyBonus = 10,
  claimedAt,
  interactiveControls = true,
  compact = false,
}: SeoulGuardianCardProps) {
  const motion = useHoloMotion()
  const drag = useRef<{
    id: number
    startX: number
    startTurn: number
    moved: boolean
    rect: DOMRect
  } | null>(null)
  const turnRef = useRef(0)

  // Gentle ambient shimmer idle pose on mount so the foil looks alive immediately
  useEffect(() => {
    motion.light(0.64, 0.28, 0.82)
    const timer = window.setTimeout(() => {
      motion.light(0.42, 0.34, 0.45)
    }, 950)
    return () => window.clearTimeout(timer)
  }, [motion])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startTurn: turnRef.current,
      moved: false,
      rect,
    }
    motion.grab(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = drag.current?.rect ?? event.currentTarget.getBoundingClientRect()
    const nx = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1)
    const ny = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1)
    motion.light(nx, ny, 1)

    if (drag.current && drag.current.id === event.pointerId) {
      const dx = event.clientX - drag.current.startX
      if (Math.abs(dx) > 5) drag.current.moved = true
      if (drag.current.moved) {
        const nextTurn = drag.current.startTurn + (dx / Math.max(180, rect.width)) * 220
        turnRef.current = nextTurn
        motion.turn(nextTurn, false)
      }
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.id !== event.pointerId) return
    const active = drag.current
    drag.current = null
    motion.grab(false)
    if (active.moved) {
      // Snap cleanly to nearest 180-degree face (front or back) using flick momentum!
      const projected = turnRef.current + motion.spin() * 0.14
      const snapped = Math.round(projected / 180) * 180
      turnRef.current = snapped
      motion.turn(snapped, false)
    }
  }

  function onPointerLeave() {
    if (!drag.current) {
      motion.light(0.46, 0.36, 0.35)
    }
  }

  function flipCard() {
    const snapped = Math.round(turnRef.current / 180) * 180 + 180
    turnRef.current = snapped
    motion.turn(snapped, false)
  }

  const serialLabel = formatGuardianSerial(rank)
  const isTop100 = rank >= 1 && rank <= 100
  const dateTag = claimedAt ? claimedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)

  return (
    <div className={compact ? 'sg-card-root is-compact' : 'sg-card-root'}>
      <div
        ref={motion.stage}
        className="sg-stage"
        data-back={motion.back}
        role="region"
        aria-label={`首尔服务器守护者 3D 全息卡 ${serialLabel}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        <div className="sg-card-rotator">
          {/* ==================== CARD FRONT ==================== */}
          <div className="sg-face sg-front">
            {/* Animated Gilded-Cyan Mythic Perimeter Frame */}
            <span className="sg-border-pulse" aria-hidden="true" />

            {/* LAYER 0 (Z: 0px) — Matrix Code Rain + N Seoul Tower Wireframe Silhouette */}
            <div className="sg-layer sg-layer-base" aria-hidden="true">
              <div className="sg-matrix-rain">
                {MATRIX_COLUMNS.map((col, idx) => (
                  <pre key={idx} className="sg-matrix-col" style={{ '--col-idx': idx } as React.CSSProperties}>
                    {col}
                  </pre>
                ))}
              </div>
              <svg className="sg-seoul-tower" viewBox="0 0 320 440" fill="none">
                <defs>
                  <linearGradient id="sg-tower-glow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00F5D4" stopOpacity=".95" />
                    <stop offset="55%" stopColor="#00C4FF" stopOpacity=".45" />
                    <stop offset="100%" stopColor="#FFD166" stopOpacity=".12" />
                  </linearGradient>
                  <linearGradient id="sg-horizon" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00F5D4" stopOpacity="0" />
                    <stop offset="50%" stopColor="#00F5D4" stopOpacity=".65" />
                    <stop offset="100%" stopColor="#FFD166" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Perspective cyber grid floor */}
                <path d="M10 342 H310 M28 362 H292 M0 388 H320 M160 328 L20 436 M160 328 L92 436 M160 328 L160 436 M160 328 L228 436 M160 328 L300 436"
                  stroke="#00F5D4" strokeOpacity=".16" strokeWidth=".9" />
                {/* Namsan Mountain wireframe contour */}
                <path d="M0 338 Q78 294 160 284 Q242 294 320 338" stroke="url(#sg-horizon)" strokeWidth="1.2" />
                <path d="M18 338 Q95 304 160 296 Q225 304 302 338" stroke="#00F5D4" strokeOpacity=".22" strokeDasharray="3 4" />
                {/* N Seoul Tower Spire & Broadcast Antenna */}
                <line x1="160" y1="22" x2="160" y2="112" stroke="url(#sg-tower-glow)" strokeWidth="2.1" />
                <circle cx="160" cy="22" r="4" fill="#FFD166" className="sg-beacon" />
                <circle cx="160" cy="22" r="11" stroke="#00F5D4" strokeOpacity=".55" strokeWidth="1" className="sg-beacon-ring" />
                <path d="M150 64 H170 M146 80 H174 M142 98 H178" stroke="#00F5D4" strokeOpacity=".55" strokeWidth="1.1" />
                {/* Iconic Octagonal Observation Deck */}
                <polygon points="122,114 198,114 210,128 204,148 116,148 110,128"
                  stroke="#00F5D4" strokeWidth="1.6" fill="#00F5D4" fillOpacity=".07" />
                <line x1="112" y1="131" x2="208" y2="131" stroke="#FFD166" strokeOpacity=".8" strokeWidth="1.3" />
                <polygon points="128,148 192,148 184,162 136,162" stroke="#00F5D4" strokeOpacity=".75" strokeWidth="1.2" />
                {/* Tower Shaft */}
                <path d="M148 162 L144 286 M172 162 L176 286 M160 162 L160 286" stroke="url(#sg-tower-glow)" strokeWidth="1.4" />
                <path d="M146 194 H174 M145 224 H175 M144 254 H176" stroke="#00F5D4" strokeOpacity=".35" strokeWidth="1" />
              </svg>
            </div>

            {/* LAYER 1 (Z: 20px) — Quantum Server Rack Core & Luminous Fiber Data Streams */}
            <div className="sg-layer sg-layer-mid" aria-hidden="true">
              <div className="sg-quantum-core">
                <div className="sg-core-halo" />
                <svg className="sg-rack-svg" viewBox="0 0 260 210" fill="none">
                  <defs>
                    <linearGradient id="sg-rack-body" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#142333" stopOpacity=".92" />
                      <stop offset="100%" stopColor="#070C14" stopOpacity=".96" />
                    </linearGradient>
                    <linearGradient id="sg-fiber" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#00F5D4" stopOpacity="0" />
                      <stop offset="50%" stopColor="#00F5D4" stopOpacity=".95" />
                      <stop offset="100%" stopColor="#FFD166" stopOpacity=".95" />
                    </linearGradient>
                  </defs>
                  {/* Flowing optical fibers around chassis */}
                  <path d="M46 198 C46 140 84 148 84 102 C84 58 62 46 62 12" stroke="url(#sg-fiber)" strokeWidth="1.7" className="sg-fiber-flow" />
                  <path d="M214 198 C214 142 176 146 176 102 C176 58 198 44 198 12" stroke="url(#sg-fiber)" strokeWidth="1.7" className="sg-fiber-flow is-alt" />
                  <path d="M24 166 C56 154 74 132 90 124" stroke="#FFD166" strokeOpacity=".55" strokeWidth="1.1" strokeDasharray="4 4" />
                  <path d="M236 166 C204 154 186 132 170 124" stroke="#00F5D4" strokeOpacity=".55" strokeWidth="1.1" strokeDasharray="4 4" />
                  {/* Quantum Blade Chassis */}
                  <rect x="82" y="28" width="96" height="148" rx="10" fill="url(#sg-rack-body)" stroke="#00F5D4" strokeOpacity=".65" strokeWidth="1.5" />
                  <rect x="88" y="34" width="84" height="136" rx="7" stroke="#FFD166" strokeOpacity=".26" strokeWidth="1" />
                  {/* Server Blades + Pulsing LEDs */}
                  {[44, 66, 128, 150].map((y, idx) => (
                    <g key={y}>
                      <rect x="94" y={y} width="72" height="14" rx="3" fill="#0B1622" stroke="#00F5D4" strokeOpacity=".35" />
                      <rect x="100" y={y + 5} width="26" height="4" rx="2" fill="#00F5D4" fillOpacity={idx % 2 === 0 ? '.88' : '.52'} />
                      <circle cx="152" cy={y + 7} r="2.2" fill="#FFD166" className="sg-led" />
                      <circle cx="160" cy={y + 7} r="2.2" fill="#00F5D4" className="sg-led is-fast" />
                    </g>
                  ))}
                  {/* Central Glowing Quantum Fan / Core Reactor */}
                  <circle cx="130" cy="103" r="24" fill="#07121E" stroke="#FFD166" strokeWidth="1.6" />
                  <circle cx="130" cy="103" r="18" stroke="#00F5D4" strokeWidth="1.4" strokeDasharray="6 4" className="sg-fan-spin" />
                  <circle cx="130" cy="103" r="9" fill="#00F5D4" fillOpacity=".28" stroke="#FFD166" strokeWidth="1.2" />
                  <circle cx="130" cy="103" r="3.6" fill="#FFFFFF" />
                </svg>
              </div>
            </div>

            {/* LAYER 2 (Z: 40px) — Embossed Nameplate, Mythic Typography & Geek Traits */}
            <div className="sg-layer sg-layer-top">
              <header className="sg-card-head">
                <span className="sg-rarity-pill">
                  <Sparkles size={11} aria-hidden />
                  <span>MYTHIC · GENESIS</span>
                </span>
                <span className="sg-serial-plate" data-top100={isTop100}>
                  {serialLabel}
                </span>
              </header>

              <div className="sg-card-spacer">
                <span className="sg-limited-tag">LIMITED 100 · 创世算力节点</span>
              </div>

              <div className="sg-card-body">
                <h3 className="sg-title">首尔服务器守护者 · SEOUL NODE</h3>
                <p className="sg-subtitle" lang="en">GENESIS COMPUTE GUARDIAN // {SEOUL_GUARDIAN_NODE_LABEL}</p>

                <ul className="sg-traits">
                  <li>
                    <strong className="sg-trait-key">[被动 · 算力续命]</strong>
                    <span>为首尔节点注入 +1 颗原初星火，延缓宕机倒计时 72 小时。</span>
                  </li>
                  <li>
                    <strong className="sg-trait-key">[光环 · 赛博共振]</strong>
                    <span>解锁站内最高等级创世守护者边框与全息折射特效。</span>
                  </li>
                </ul>

                <blockquote className="sg-flavor">
                  <span>[铭文]</span> “在赛博荒原的深夜，每一颗 Star 都是不灭的散热风扇。”
                </blockquote>
              </div>
            </div>

            {/* Violent Angle-Reactive Rainbow Holographic Laser Foil + Specular Flare */}
            <span className="sg-holo-foil" aria-hidden="true" />
            <span className="sg-holo-glare" aria-hidden="true" />
            <span className="sg-holo-etch" aria-hidden="true" />
          </div>

          {/* ==================== CARD BACK (360° Flip Inspection) ==================== */}
          <div className="sg-face sg-back">
            <span className="sg-border-pulse" aria-hidden="true" />
            <div className="sg-back-inner">
              <div className="sg-back-head">
                <span className="sg-rarity-pill"><ShieldCheck size={12} aria-hidden /> GENESIS CERTIFICATE</span>
                <span className="sg-serial-plate" data-top100={isTop100}>{serialLabel}</span>
              </div>

              <div className="sg-back-emblem" aria-hidden="true">
                <span className="sg-back-ring" />
                <Cpu size={38} strokeWidth={1.35} />
              </div>

              <div className="sg-back-meta">
                <h4>SEOUL GENESIS NODE // 创世节点铭牌</h4>
                <dl>
                  <div><dt>守护者</dt><dd>@{githubUser}</dd></div>
                  <div><dt>节点坐标</dt><dd>{SEOUL_GUARDIAN_NODE_LABEL} · ap-northeast-2</dd></div>
                  <div><dt>点亮日期</dt><dd>{dateTag}</dd></div>
                  <div><dt>专属权益</dt><dd className="sg-perk-accent"><Flame size={13} aria-hidden /> 每日免费 AI 问答 +{aiDailyBonus} 次</dd></div>
                </dl>
              </div>

              <p className="sg-back-sign">LEARNVERSE · GENESIS COMPUTE GUARDIAN EDITION</p>
            </div>
            <span className="sg-holo-foil" aria-hidden="true" />
            <span className="sg-holo-glare" aria-hidden="true" />
          </div>
        </div>
      </div>

      {interactiveControls && (
        <div className="sg-controls">
          <button type="button" className="sg-ctrl-btn" onClick={flipCard}>
            <RotateCw size={15} aria-hidden />
            {motion.back ? '翻回正面' : '翻转查看铭牌背面'}
          </button>
          <button
            type="button"
            className="sg-ctrl-btn"
            aria-pressed={motion.sensor}
            onClick={() => void motion.toggleSensor()}
          >
            <Compass size={15} aria-hidden />
            {motion.sensor ? '关闭陀螺仪体感' : '开启陀螺仪倾角'}
          </button>
          <span className="sg-ctrl-hint">左右拖动可 360° 旋转把玩</span>
          {motion.sensorMessage && <span className="sg-ctrl-note" role="status">{motion.sensorMessage}</span>}
        </div>
      )}
    </div>
  )
}
