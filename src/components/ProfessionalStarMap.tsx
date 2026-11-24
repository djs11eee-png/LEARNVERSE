import { ArrowRight, ArrowUpRight, Check, Crosshair, Maximize, Minus, Move, Navigation, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { majorRoutes } from '../data/majorRoutes'
import type { MajorRoute } from '../data/majorRoutes'
import { useProgress } from '../state/progress'
import { ThemeSelect } from './ThemeSelect'
import StarMapSurface from './StarMapSurface'
import { planets, planetById, planetDiameter, skyBounds, startingView } from './professionalAtlas'
import PlanetEncounter from './PlanetEncounter'
import DeepSpace from './DeepSpace'
import type { SpaceControls } from './DeepSpace'
import { singularity } from './deepSpacePhysics'
import type { Observation } from './deepSpaceParticles'
import type { CoursePlanet } from './professionalAtlas'
import { useStarCamera } from './useStarCamera'
import './professional-star-map.css'

const choices = [
  { value: '', label: '自由探索' },
  ...majorRoutes.map(route => ({ value: route.id, label: route.title })),
]
const levels = { Beginner: '入门', Intermediate: '进阶', Advanced: '高级' }
const observations = { ready: '轻点投放 · 长按加速', released: '碎片正在靠近', captured: '已越过视界', passed: '碎片已掠过' }

function SectorMap({ camera, size, route, onLocate }: {
  route?: MajorRoute
  camera: { x: number; y: number; zoom: number }
  size: { width: number; height: number }
  onLocate: (point: { x: number; y: number }) => void
}) {
  const w = size.width / camera.zoom, h = size.height / camera.zoom
  return <button type="button" className="planet-mini" aria-label="在星空缩略图中定位" title="点击缩略图移动视野"
    onClick={event => {
      if (event.detail === 0) { onLocate(startingView); return }
      const rect = event.currentTarget.getBoundingClientRect()
      onLocate({ x: (event.clientX - rect.left) / rect.width * skyBounds.width,
        y: (event.clientY - rect.top) / rect.height * skyBounds.height })
    }}>
    <svg viewBox={`0 0 ${skyBounds.width} ${skyBounds.height}`} preserveAspectRatio="none" aria-hidden="true">
      {planets.map(p => <circle key={p.id} cx={p.x} cy={p.y} r={planetDiameter(p, route) * .43}
        className={route?.courseIds.at(-1) === p.id ? 'planet-mini-goal' : undefined} />)}
      <circle className="mini-singularity" cx={singularity.x} cy={singularity.y} r="93" />
      <rect x={camera.x-w/2} y={camera.y-h/2} width={w} height={h} />
    </svg>
  </button>
}

function PlanetField({ route, completed, onSelect }: {
  route?: MajorRoute; completed: string[]; onSelect: (id: string) => void
}) {
  const [narrow] = useState(() => window.matchMedia('(max-width: 650px)').matches)
  const firstCourse = route && planetById.get(route.courseIds.find(id => !completed.includes(id)) ?? route.courseIds[0])
  const home = firstCourse ?? startingView
  const { viewportRef, camera, size, zoomBy, reset, fitAll, panTo, dragging } =
    useStarCamera({ ...skyBounds, home, homeZoom: narrow ? .58 : 1 })
  const zoom = camera.zoom
  const [hovered, setHovered] = useState<string>()
  const [focused, setFocused] = useState<string>()
  const pointer = useRef({ x: -.64, y: -.67 })
  const space = useRef<SpaceControls>(null)
  const pressedAt = useRef<number | null>(null)
  const [observation, setObservation] = useState<Observation>('ready')
  const skyView = useMemo(() => ({...camera, ...size}), [camera, size])
  const ranked = useMemo(() => planets.map(planet => ({ planet, diameter: planetDiameter(planet, route) }))
    .sort((a, b) => a.diameter - b.diameter), [route])
  const sx = (x: number) => (x - camera.x) * zoom + size.width/2
  const sy = (y: number) => (y - camera.y) * zoom + size.height/2
  const routePlanets = route?.courseIds.map(id => planetById.get(id)!) ?? []
  const destination = routePlanets.at(-1)
  const routeSegments = routePlanets.slice(1).map((planet, index) => {
    const prior = routePlanets[index]
    const dx = planet.x - prior.x, dy = planet.y - prior.y
    const arc = Math.min(.09, 85 / Math.hypot(dx, dy))
    const d = `M ${sx(prior.x)} ${sy(prior.y)} Q ${sx((planet.x + prior.x) / 2 - dy * arc)} ${sy((planet.y + prior.y) / 2 + dx * arc)} ${sx(planet.x)} ${sy(planet.y)}`
    const lit = completed.includes(prior.id) && completed.includes(planet.id)
    const active = completed.includes(prior.id) && !completed.includes(planet.id)
    return { key: `${prior.id}-${planet.id}`, d, state: lit ? 'lit' : active ? 'active' : 'upcoming' }
  })
  const visible = ranked.filter(({ planet: p, diameter }) => {
    const margin = Math.max(diameter * zoom * 1.1, 90)
    return sx(p.x) > -margin && sx(p.x) < size.width + margin &&
      sy(p.y) > -margin && sy(p.y) < size.height + margin
  })
  const encounter = !dragging && visible.find(({ planet }) => planet.id === (hovered ?? focused))
  function illuminate(event: PointerEvent<HTMLAnchorElement>, planet: CoursePlanet, diameter: number) {
    if (dragging || (event.buttons && event.type === 'pointermove')) return
    const box = event.currentTarget.getBoundingClientRect()
    pointer.current = { x: (event.clientX - box.left - box.width/2) * 2 / diameter,
      y: (event.clientY - box.top - box.height/2) * 2 / diameter }
    setHovered(planet.id)
  }
  const blackX = sx(singularity.x), blackY = sy(singularity.y)
  const holeVisible = blackX > -80*zoom && blackX < size.width+80*zoom && blackY > -80*zoom && blackY < size.height+80*zoom
  return <div className="planet-theater">
    <header className="planet-mast">
      <div>
        <div className="planet-eyebrow">{planets.length} 颗课程行星 <i /> {majorRoutes.length} 条专业航线</div>
        <h1>知识<span>星图</span></h1>
      </div>
      <div className="planet-route-picker">
        <ThemeSelect label="专业航线" value={route?.id ?? ''} options={choices} onChange={onSelect} />
        {destination && <button type="button" onClick={() => panTo(destination, narrow ? .72 : 1)}>
          <Crosshair size={13} aria-hidden="true" /> 定位航线终点</button>}
      </div>
    </header>
    <div className="planet-viewport" ref={viewportRef} tabIndex={0} role="region" aria-label="可拖动的课程星空"
      aria-describedby="star-help" data-testid="star-viewport" data-camera-x={camera.x} data-camera-y={camera.y}
      data-camera-zoom={zoom} data-dragging={dragging || undefined}
      onClick={e => {
        if (!e.detail || !(e.target instanceof Element) || e.target.closest('a,button')) return
        const bounds = e.currentTarget.getBoundingClientRect()
        space.current?.release({ x: camera.x+(e.clientX-bounds.left-size.width/2)/zoom,
          y: camera.y+(e.clientY-bounds.top-size.height/2)/zoom })
      }}>
      <DeepSpace view={skyView} controls={space} onObservation={setObservation} />
      {size.width > 0 && <StarMapSurface width={size.width} height={size.height}>
        {route && <svg className="planet-flightpath" width={size.width} height={size.height} aria-hidden="true">
          {routeSegments.map((segment) => (
            <path key={segment.key} d={segment.d} data-state={segment.state} />
          ))}
        </svg>}
        {visible.map(({ planet, diameter: worldDiameter }) => {
          const done = completed.includes(planet.id)
          const index = routePlanets.indexOf(planet)
          const diameter = worldDiameter * zoom
          const lod = zoom < .46
          const featured = !lod && (route ? firstCourse === planet : planet.id === 'lv-python-foundations')
          const terminal = destination === planet
          const dx = singularity.x-planet.x, dy = singularity.y-planet.y, distance = Math.hypot(dx,dy)
          const style = {
            left: sx(planet.x), top: sy(planet.y), '--diameter': diameter + 'px', '--air': planet.atmosphere,
            '--rim-x': (50+49*dx/distance)+'%', '--rim-y': (50+49*dy/distance)+'%', '--rim-light': Math.min(.38, 82/distance),
          } as CSSProperties
          return <Link className="course-planet" key={planet.id} to={`/academy/${planet.id}`} style={style}
            data-course-id={planet.id} data-surface={planet.surface} data-lit={done || undefined}
            data-terminal={terminal || undefined}
            data-distant={lod || undefined} data-featured={featured || undefined} data-muted={Boolean(route && index < 0) || undefined}
            onPointerEnter={e => illuminate(e, planet, diameter)} onPointerMove={e => illuminate(e, planet, diameter)}
            onPointerDown={e => illuminate(e, planet, diameter)} onPointerLeave={() => setHovered(undefined)}
            onPointerCancel={() => setHovered(undefined)} onPointerUp={e => { if (e.pointerType === 'touch') setHovered(undefined) }}
            onFocus={e => { if (e.currentTarget.matches(':focus-visible')) {
              pointer.current = { x: -.64, y: -.67 }; setFocused(planet.id)
            } }} onBlur={() => setFocused(undefined)}
            aria-label={`进入课程：${planet.title}${terminal ? '（航线终点）' : ''}${done ? '（已完成）' : ''}`} draggable={false}>
            <span className="planet-body"><img src={`/art/atlas/worlds/${planet.surface}.webp`} alt="" draggable={false} /><i className="planet-reflected-light" /></span>
            {(terminal || featured) && <span className="planet-level">{terminal ? '航线终点' : levels[planet.difficulty]+'课程'}</span>}
            <span className="planet-name">{index >= 0 && <small>{String(index+1).padStart(2,'0')}</small>}
              {done && <Check size={13} aria-hidden="true" />}<span>{planet.title}</span></span>
          </Link>
        })}
      </StarMapSurface>}
      {holeVisible && size.width > 0 && <button type="button" className="singularity-control"
        style={{left: blackX, top: blackY, '--shadow-size': (singularity.radius*2*zoom)+'px'} as CSSProperties}
        data-distant={zoom < .39 || undefined} aria-label="未开放星域，向黑洞投放碎片"
        title="轻点投放碎片，长按增加横向速度，松手后观察轨迹"
        onPointerDown={e => { if (e.button === 0) pressedAt.current = performance.now() }}
        onKeyDown={e => { if (!e.repeat && e.key === ' ') pressedAt.current = performance.now() }}
        onPointerCancel={() => { pressedAt.current = null }} onBlur={() => { pressedAt.current = null }}
        onContextMenu={e => e.preventDefault()}
        onClick={() => {
          const held = pressedAt.current === null ? 0 : performance.now()-pressedAt.current
          pressedAt.current = null
          space.current?.release(undefined, Math.max(0, held-140)/1000)
        }}>
        <span className="singularity-caption"><span>未开放星域</span><small>{observations[observation]}</small></span>
      </button>}
      {encounter && <PlanetEncounter key={encounter.planet.id} planet={encounter.planet} x={sx(encounter.planet.x)}
        y={sy(encounter.planet.y)} diameter={encounter.diameter * zoom} pointer={pointer} />}
    </div>
    <div className="planet-instruments">
      <span id="star-help" className="planet-instruction"><Move size={16} aria-hidden="true" /><span>拖动星空<span className="planet-help-extra">，点击行星学习或点击空处投放碎片</span></span></span>
      <div className="planet-camera-tools">
        <SectorMap camera={camera} size={size} route={route} onLocate={point => panTo(point)} />
        <div className="planet-zoom">
          <button type="button" aria-label="缩小星图" title="缩小星图" onClick={() => zoomBy(1/1.3)}><Minus size={16} /></button>
          <output aria-label="当前缩放">{Math.round(zoom*100)}%</output>
          <button type="button" aria-label="放大星图" title="放大星图" onClick={() => zoomBy(1.3)}><Plus size={16} /></button>
        </div>
        <button type="button" aria-label="查看全图" title="查看全图" onClick={fitAll}><Maximize size={17} /></button>
        <button type="button" aria-label="回到起点" title="回到起点" onClick={reset}><Crosshair size={17} /></button>
      </div>
    </div>
    <span className="space-announcement" role="status">{observation === 'ready' ? '' : observations[observation]}</span>
  </div>
}

function CourseIndex({ courses, completed }: { courses: CoursePlanet[]; completed: string[] }) {
  return <ol className="planet-index">{courses.map((planet, i) => {
    const done = completed.includes(planet.id)
    return <li key={planet.id}><Link to={`/academy/${planet.id}`} aria-label={`${planet.title}，${done ? '已完成，复习课程' : '进入课程'}`}>
      <span className="planet-index-position">{done ? <Check size={15} /> : String(i+1).padStart(2,'0')}</span>
      <span>{planet.title}</span><small>{levels[planet.difficulty]}</small><ArrowUpRight size={15} />
    </Link></li>
  })}</ol>
}

export default function ProfessionalStarMap({ routeId }: { routeId?: string }) {
  const navigate = useNavigate()
  const { activeRoute, chooseRoute, completed } = useProgress()
  const route = majorRoutes.find(item => item.id === routeId)
  const courses = route ? route.courseIds.map(id => planetById.get(id)!) : planets
  const lit = courses.filter(planet => completed.includes(planet.id)).length
  const next = courses.find(planet => !completed.includes(planet.id))
  const selected = majorRoutes.find(item => item.id === activeRoute)
  return <section className="planet-atlas">
    <PlanetField key={route?.id ?? 'all'} route={route} completed={completed}
      onSelect={id => navigate(id ? `/explore/${id}` : '/explore')} />
    <div className="planet-log">
      <div className="planet-log-row">
        <div className="planet-log-lead"><Navigation size={23} strokeWidth={1.4} /><div>
          <h2>{route?.title ?? '探索进度'}</h2>
          <p>{route?.description ?? '完成课程后，对应的行星会在每一条经过它的航线上点亮。'}</p>
        </div></div>
        <div className="planet-counter"><strong>{String(lit).padStart(2,'0')}</strong><span>/ {courses.length} 已点亮</span></div>
        {route ? <div className="planet-route-actions">
          {activeRoute === route.id ? <span><Check size={15} /> 我的学习路线</span> :
            <button type="button" onClick={() => chooseRoute(route.id)}>设为我的学习路线</button>}
          {next && <Link to={`/academy/${next.id}`}>继续探索 <ArrowRight size={15} /></Link>}
        </div> : selected && <Link className="planet-my-route" to={`/explore/${selected.id}`}>{selected.title}<ArrowRight size={16} /></Link>}
      </div>
      {route ? <>
        <CourseIndex courses={courses} completed={completed} />
        {route.topics.length > 0 && <p className="planet-plans">后续建设专题（当前未计入课程进度）<span>{route.topics.join(' · ')}</span></p>}
      </> : <details className="planet-directory"><summary>全部课程行星 <span>{planets.length} 门课程</span></summary>
        <CourseIndex courses={courses} completed={completed} /></details>}
    </div>
  </section>
}
