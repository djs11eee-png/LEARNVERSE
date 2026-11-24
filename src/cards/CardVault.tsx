import { ArrowUpRight, BookOpen, Braces, Bug, Code2, Fingerprint, Flame, Layers3, LockKeyhole, Orbit, PackageOpen, Sparkles, Zap } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ThemeSelect } from '../components/ThemeSelect'
import { workspaceCourses } from '../data/workspaceCourses'
import { cardCatalog } from './catalog'
import { packName } from './rewards'
import { SEOUL_GUARDIAN_NODE_LABEL, formatGuardianSerial, useSeoulGuardian } from './seoulGuardianStore'
import { finishNames, galaxyNames } from './types'
import type { Galaxy, HoloCard } from './types'
import { usePackStation } from './usePackStation'
import './vault.css'

const SeoulGuardianRevealModal = lazy(() =>
  import('./SeoulGuardianRevealModal').then(m => ({ default: m.SeoulGuardianRevealModal })),
)

const icons = [Orbit, Layers3, Braces, Bug, Fingerprint]
const galaxies = Object.entries(galaxyNames) as [Galaxy, string][]
const options = [
  { value: '', label: '所有卡面' },
  ...['普通', '稀有', '史诗', '保底金卡'].map((label, i) => ({ value: 'rank' + i, label })),
  ...Object.entries(finishNames).map(([value, label]) => ({ value, label })),
]
const rank = ['rank0', 'rank0', 'rank1', 'rank2', 'rank3']
const chapters = new Map(workspaceCourses.flatMap(course => course.lessons.map(lesson =>
  [course.id + '/' + lesson.id, { lesson: lesson.title, course: course.title }] as const)))

function VaultTile({ card, owned, inspect }: { card: HoloCard; owned: boolean; inspect: (card: HoloCard, tile: HTMLElement) => void }) {
  const Icon = icons[card.slot - 1]
  const pendingFrame = useRef(0)
  const chapter = chapters.get(card.courseId + '/' + card.lessonId)!
  const tileClass = 'vault-tile' + (owned ? ' is-owned' : ' is-locked')
  const activate = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tile = event.currentTarget
    const { clientX, clientY } = event
    cancelAnimationFrame(pendingFrame.current)
    pendingFrame.current = requestAnimationFrame(() => {
      const rect = tile.getBoundingClientRect()
      const x = (clientX - rect.left) / rect.width - 0.5
      const y = (clientY - rect.top) / rect.height - 0.5
      tile.style.setProperty('--lean', 'rotateX(' + (-y * 8) + 'deg) rotateY(' + (x * 10) + 'deg)')
      tile.style.setProperty('--shine', (x * 100) + '%')
    })
  }
  const contents = <>
    <span className="vault-id"><span>{card.number}</span>{owned ? <Sparkles size={13} /> : <LockKeyhole size={13} />}</span>
    {owned
      ? <span className="vault-emblem" aria-hidden="true"><i /><i /><Icon size={35} strokeWidth={1.1} /></span>
      : <span className="vault-emblem is-mystery" aria-hidden="true"><span className="vault-nebula-glow" /><i /><i /><span className="vault-mystery-question">?</span></span>}
    <span className="vault-card-info">
      <small>{galaxyNames[card.galaxy]} · {owned ? finishNames[card.finish] : '待解锁'}</small>
      <strong>{owned ? card.title : '??? · 未知知识节点'}</strong>
      <span>{owned ? '翻阅卡片' : '完成「' + chapter.lesson + '」测验入池'} <ArrowUpRight size={12} /></span>
    </span>
  </>
  return owned ? <button type="button" className={tileClass} data-finish={card.finish}
    aria-label={'检视 ' + card.title} onPointerMove={activate}
    onPointerLeave={e => { cancelAnimationFrame(pendingFrame.current); e.currentTarget.style.removeProperty('--lean'); e.currentTarget.style.removeProperty('--shine') }}
    onClick={e => inspect(card, e.currentTarget)}>{contents}</button>
    : <Link className={tileClass} to={'/academy/' + card.courseId + '/lesson/' + card.lessonId}
      aria-label={card.number + ' 未知知识节点，学习「' + chapter.course + ' · ' + chapter.lesson + '」解锁卡池'}>{contents}</Link>
}

export function CardVault() {
  const [searchParams] = useSearchParams()
  const focusGuardian = searchParams.get('focus') === 'seoul-guardian'
  const station = usePackStation(!focusGuardian)
  const seoulGuardian = useSeoulGuardian()
  const [inspectGuardian, setInspectGuardian] = useState(false)
  const [galaxy, setGalaxy] = useState<Galaxy | ''>('')
  const [filter, setFilter] = useState('')
  const [onlyOwned, setOnlyOwned] = useState(false)
  const pool = cardCatalog.filter(card => !galaxy || card.galaxy === galaxy)
  const lit = pool.filter(card => station.owned.has(card.id)).length
  const cards = pool.filter(card => (!filter || card.finish === filter || rank[card.slot - 1] === filter)
    && (!onlyOwned || station.owned.has(card.id)))
  const percent = Math.round(lit / pool.length * 100)
  return <section className="card-vault" aria-labelledby="vault-title">
    <div className="vault-mast">
      <div><p className="vault-overline" lang="en"><Orbit size={15} /> CARD VAULT</p>
        <h2 id="vault-title">星际知识图鉴馆</h2>
        <p>翻到卡背，重读代码，记下你踩过的坑。</p>
      </div>
      <div className="vault-counter">
        <span>已点亮 <strong>{lit + (seoulGuardian ? 1 : 0)}</strong> / {pool.length} 张</span>
        <progress value={lit} max={pool.length} aria-label="当前星系收集进度" />
        <small>{galaxy ? galaxyNames[galaxy] + ' · ' : ''}探索度 {percent}%{seoulGuardian ? ' · 含创世限定卡 1 张' : ''}{galaxy && ' · 全馆 ' + station.owned.size + '/' + cardCatalog.length}</small>
      </div>
    </div>
    {seoulGuardian && (
      <div className="vault-genesis-pin">
        <button
          type="button"
          className="vault-genesis-card"
          onClick={() => setInspectGuardian(true)}
          aria-label={`全屏检视首尔服务器守护者 3D 限定卡 ${formatGuardianSerial(seoulGuardian.rank)}`}
        >
          <span className="vault-genesis-foil" aria-hidden="true" />
          <div className="vault-genesis-badge">
            <span className="vault-genesis-rarity"><Sparkles size={13} aria-hidden /> MYTHIC · GENESIS 置顶典藏</span>
            <span className="vault-genesis-serial">{formatGuardianSerial(seoulGuardian.rank)}</span>
          </div>
          <div className="vault-genesis-content">
            <span className="vault-genesis-orb" aria-hidden="true"><Zap size={28} strokeWidth={1.5} /></span>
            <div className="vault-genesis-text">
              <strong>首尔服务器守护者 · SEOUL NODE</strong>
              <small lang="en">GENESIS COMPUTE GUARDIAN // {SEOUL_GUARDIAN_NODE_LABEL} · @{seoulGuardian.githubUser}</small>
              <p>
                <Flame size={13} aria-hidden />
                已解锁创世守护者光环 · 每日免费 AI 问答 +{seoulGuardian.aiDailyBonus} 次
              </p>
            </div>
            <span className="vault-genesis-cta">全屏 3D 检视 <ArrowUpRight size={15} aria-hidden /></span>
          </div>
        </button>
      </div>
    )}
    {station.pending.length > 0 && <div className="vault-pending">
      <PackageOpen size={22} /><div><strong>{packName(station.pending[0])}</strong><small>{station.pending.length} 个补给包待拆</small></div>
      <button className="button button-light" onClick={() => station.showPack(station.pending[0])}>拆开补给包 <ArrowUpRight size={15} /></button>
    </div>}
    {!station.saved && <p role="status">浏览器暂时无法保存收藏，卡片和笔记仅在本次打开期间可用。</p>}
    <div className="vault-controls">
      <div className="vault-galaxies" aria-label="筛选星系" role="group">
        {([['', '全部'], ...galaxies] as [Galaxy | '', string][]).map(([value, label]) =>
          <button type="button" key={value} aria-pressed={value === galaxy} onClick={() => setGalaxy(value)}>{label}</button>)}
      </div>
      <div className="vault-filter"><ThemeSelect compact value={filter} label="稀有度与材质" options={options} onChange={setFilter} />
        <button className="vault-owned" aria-pressed={onlyOwned} onClick={() => setOnlyOwned(!onlyOwned)}><BookOpen size={15} /> 已获得</button></div>
    </div>
    <div className="vault-grid">
      {cards.map(card => <VaultTile key={card.id} card={card} owned={station.owned.has(card.id)} inspect={station.inspect} />)}
    </div>
    {!cards.length && <p className="vault-empty"><Code2 size={21} /> 当前筛选下还没有卡片。</p>}
    {station.stage}
    {inspectGuardian && seoulGuardian && (
      <Suspense fallback={null}>
        <SeoulGuardianRevealModal
          record={seoulGuardian}
          mode="inspect"
          showVaultLink={false}
          onClose={() => setInspectGuardian(false)}
        />
      </Suspense>
    )}
  </section>
}
