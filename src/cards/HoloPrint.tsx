import { useEffect, useId, useRef } from 'react'
import { mountPlateRenderer, nativePlateTextures } from './plateRenderer'
import type { HoloCard } from './types'
import './holo-material.css'

type PrintProps = { galaxy: HoloCard['galaxy']; slot: number; pack?: boolean; cardNumber?: string; gold?: boolean; paperOnly?: boolean; prism?: boolean }
const tau = Math.PI * 2
const ink = (id: string, name: string) => 'url(#' + id + '-' + name + ')'
const fixed = (value: number) => Number(value.toFixed(2))

function Star({ x, y, size }: { x: number; y: number; size: number }) {
  return <path transform={`translate(${x} ${y}) scale(${size})`} d="M0-1 .17-.17 1 0 .17.17 0 1-.17.17-1 0-.17-.17Z" fill="var(--plate-pearl)" />
}

/** A ring world engraved in two passes. The lower arc crosses in front of the globe. */
function RingWorld({ id, variant }: { id: string; variant: number }) {
  const rings = [57, 60, 64, 67, 72, 75, 79]
  const tilt = -10 - variant % 16
  return <g>
    <g transform={`rotate(${tilt} 151 71)`} fill="none">{rings.map((rx, i) =>
      <ellipse key={rx} cx="151" cy="71" rx={rx} ry={rx * .28} stroke={ink(id, 'metal')} strokeOpacity={i % 2 ? .6 : .98} strokeWidth={i === 2 ? 4.5 : i % 2 ? .75 : 2.4} />)}</g>
    <circle cx="151" cy="71" r="42.8" fill={ink(id,'limb')} />
    <g clipPath={ink(id, 'disc')}>
      <g transform="rotate(13 151 71)" fill="none">{Array.from({ length: 30 }, (_, i) => {
        const y = 24 + i * 3.25
        const bend = fixed(5 * Math.sin(i * .42 + variant * .17))
        return <path key={i} d={`M90 ${y} Q117 ${y-10} 141 ${y+bend} T205 ${y+5}`} stroke={i % 4 === 0 ? 'var(--plate-pearl)' : 'var(--plate-dark)'} opacity={i % 4 === 0 ? .37 : .46} strokeWidth={i % 4 === 0 ? 1.3 : 1.9}/>
      })}</g>
      <circle cx="151" cy="71" r="43" fill={ink(id, 'shadow')} />
    </g>
    <path d="M109.3 72.2a42.1 42.1 0 0 1 40.6-43.1" fill="none" stroke="var(--plate-pearl)" strokeWidth="1.1"/>
    <g transform={`rotate(${tilt} 151 71)`} fill="none">{rings.map((r,i) =>
      <path key={r} d={`M${151-r} 71a${r} ${fixed(r*.28)} 0 0 0 ${r*2} 0`} stroke={ink(id, 'metal')} strokeWidth={i === 2 ? 4.5 : i % 2 ? .75 : 2.4} />)}</g>
    <g transform={`translate(${variant % 13} ${-variant % 5})`}>
      <circle cx="221" cy="46" r="5" fill={ink(id, 'limb')} /><circle cx="211" cy="38" r="1.4" fill="var(--plate-light)" />
    </g>
  </g>
}

/** A silicon die in exploded isometric projection with vias, bond wires and an etched top face. */
function SiliconDie({ id, variant }: { id: string; variant: number }) {
  const yGap = 7 + (variant % 4)
  const surface = (x: number,y: number) => [fixed(150 + .89 * x - .89 * y), fixed(51 + .43 * x + .43 * y)]
  return <g>
    <g fill="none" stroke="var(--plate-light)" strokeWidth=".85" opacity=".72">
      {Array.from({length:7},(_,i) => {
        const [x,y] = surface(40,-30 + i * 10)
        const [left,top] = surface(-35+i*10,41)
        return <g key={i}><path d={`M${x} ${y+21}l9 5v7l19 9h10`} /><path d={`M${left} ${top+21}l-11 6v6l-17 8h-12`} /></g>
      })}
    </g>
    {[3,2,1,0].map(depth => <g key={depth} transform={`translate(0 ${depth*yGap})`}>
      <path d="M150 16 220 50 150 85 80 50Z" fill={depth ? 'var(--plate-dark)' : ink(id,'metal')} stroke="var(--plate-light)" strokeWidth={depth ? .7 : 1.2}/>
      <path d="M80 50 150 85V90L80 55Z" fill="var(--plate-shade)" stroke="var(--plate-mid)" strokeWidth=".6"/>
      <path d="M220 50 150 85V90L220 55Z" fill="var(--plate-dark)" stroke="var(--plate-mid)" strokeWidth=".6"/>
    </g>)}
    <g transform="matrix(.89 .43 -.89 .43 150 51)">
      <rect x="-32" y="-32" width="64" height="64" fill="var(--plate-dark)" stroke="var(--plate-pearl)" strokeWidth="1.8"/>
      {Array.from({length:16},(_,i) => {
        const x = -26 + (i%4)*14, y = -26 + Math.floor(i/4)*14
        return <g key={i}><rect x={x} y={y} width="10" height="10" fill={i === variant % 16 ? 'var(--plate-pearl)' : 'var(--plate-mid)'}/><path d={`M${x+2} ${y+2}h6m-6 3h6m-6 3h4`} stroke="var(--plate-dark)" strokeWidth="1.1"/></g>
      })}
      {Array.from({length:12},(_,i)=><path key={i} d={`M-39 ${-28+i*5}h5m68 0h5M${-28+i*5} -39v5m0 68v5`} stroke="var(--plate-pearl)" strokeWidth="2"/>)}
    </g>
  </g>
}

/** Depth-sorted faces of an icosahedron. Highlight one route across its vertices. */
const facetColors = [
  ['#181c65', '#6454fa', '#78ecff'], ['#085879', '#27dfcf', '#e5ffb7'],
  ['#55358b', '#fa55ad', '#ffcec0'], ['#283787', '#5487ee', '#e3a9ff'],
  ['#a63f6c', '#ffaf62', '#fff6bd'], ['#265694', '#4bc6fb', '#e7fcff'],
]

function NodeAtlas({ id, variant, prism }: { id: string; variant: number; prism?: boolean }) {
  const angle = .15 + variant * .22
  const points = [[0,1,0], ...Array.from({length:10},(_,i)=>{
    const a = i % 5 * tau / 5 + (i >= 5 ? tau / 10 : 0)
    return [.8944 * Math.cos(a), i < 5 ? .4472 : -.4472, .8944 * Math.sin(a)]
  }),[0,-1,0]].map(([x,y,z])=>{
    const tx = x * Math.cos(angle) + z * Math.sin(angle), tz = z * Math.cos(angle) - x * Math.sin(angle)
    const ty = y * .955 - tz * .296
    return { x: fixed(150 + tx*55 + ty*10), y: fixed(71 - ty*49), depth: tz*.955 + y*.296 }
  })
  const faces: number[][] = []
  for(let i=0;i<5;i++) {
    const next=(i+1)%5
    faces.push([0,1+i,1+next],[1+i,6+i,1+next],[1+next,6+i,6+next],[6+i,11,6+next])
  }
  const depth = (face:number[]) => face.reduce((sum,i)=>sum+points[i].depth,0)/3
  faces.sort((one,two)=>depth(one)-depth(two))
  const route = [0,1 + variant % 5,6 + variant % 5,11]
  const line = (indices:number[]) => indices.map(i=>points[i].x + ',' + points[i].y).join(' ')
  return <g>
    {prism && <>
      <defs>{facetColors.map(([deep, color, flash], i) =>
        <linearGradient key={deep} id={id + '-facet' + i} x1="0" y1={i % 2} x2="1" y2={1 - i % 2}>
          <stop stopColor={deep}/><stop offset=".53" stopColor={color}/><stop offset=".86" stopColor={flash}/><stop offset="1" stopColor={color}/>
        </linearGradient>)}
        <linearGradient id={id + '-beam'} x1="0" y1="1" x2="1" y2="0">
          <stop stopColor="#f4fbff" stopOpacity=".85"/><stop offset=".48" stopColor="#d9d7ff" stopOpacity=".4"/>
          <stop offset="1" stopColor="#dad4ff" stopOpacity="0"/>
        </linearGradient>
        <mask id={id + '-beam-fade'}><rect x="155" width="145" height="144" fill={ink(id, 'beam')}/></mask>
      </defs>
      <path d="M0 129 135 77 0 118Z" fill="#b6d8ff" opacity=".22"/>
      <path d="M0 124 137 75" stroke="#f5f9ff" opacity=".82" strokeWidth=".9"/>
      <g mask={ink(id, 'beam-fade')}>{facetColors.map(([,color], i) =>
        <path key={color} d={`M160 68 300 ${-15 + i * 12} V${-6 + i * 12}Z`} fill={color}/>)}</g>
    </>}
    <ellipse cx="150" cy="73" rx="93" ry="29" fill="none" stroke={ink(id,'metal')} strokeWidth=".75" transform="rotate(-18 150 73)" />
    {faces.map((face, i) => <polygon key={face.join('-')} points={line(face)}
      fill={prism ? ink(id, 'facet' + i % facetColors.length) : depth(face) > .38 ? ink(id,'metal') : 'var(--plate-shade)'}
      fillOpacity={prism ? .96 : depth(face) > .38 ? .48 : .68}
      stroke="var(--plate-light)" strokeOpacity={depth(face) > 0 ? .8 : .3} strokeWidth=".9"/>)}
    {prism && faces.filter(face => depth(face) > .14).map(([a,b,c], i) => {
      const one = points[a], two = points[b], three = points[c]
      const x = fixed(one.x * .18 + two.x * .52 + three.x * .3)
      const y = fixed(one.y * .18 + two.y * .52 + three.y * .3)
      return <g key={i}>
        <path d={`M${one.x} ${one.y}L${two.x} ${two.y} ${x} ${y}Z`} fill={ink(id, 'facet' + (i + 3) % facetColors.length)} opacity=".78"/>
        <path d={`M${two.x} ${two.y}L${x} ${y} ${three.x} ${three.y}`} fill="none" stroke="#e9ffff" strokeWidth=".45" opacity=".84"/>
      </g>
    })}
    <polyline points={line(route)} stroke="var(--plate-pearl)" strokeWidth="1.9" fill="none"/>
    {points.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r={2.5 + Math.max(0,p.depth)*1.6} fill="var(--plate-dark)" stroke="var(--plate-light)" strokeWidth=".9"/><circle cx={p.x} cy={p.y} r="1.15" fill="var(--plate-pearl)"/></g>)}
  </g>
}

function Engraving({ galaxy, slot, cardNumber, prism }: PrintProps) {
  const id=useId().replace(/:/g,'')
  let variant = slot
  for(const char of cardNumber ?? '') variant = (variant*31 + char.charCodeAt(0)) % 991
  const stars = Array.from({length:44},(_,i)=>({
    x:(i*163 + 19*variant + i*i)%300, y:(i*79 + 11*variant + i*i*3)%144,
  }))
  return <svg viewBox="0 0 300 144" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <radialGradient id={id+'-field'} cx=".47" cy=".48" r=".74"><stop stopColor="var(--plate-shade)"/><stop offset=".7" stopColor="var(--plate-dark)"/><stop offset="1" stopColor="#06090f"/></radialGradient>
      <linearGradient id={id+'-metal'} x1="0" y1=".85" x2="1" y2=".2">
        <stop stopColor="var(--plate-mid)"/><stop offset=".26" stopColor={prism ? '#62eff3' : 'var(--plate-light)'}/>
        <stop offset=".45" stopColor="var(--plate-pearl)"/><stop offset=".54" stopColor={prism ? '#ed80ed' : 'var(--plate-mid)'}/>
        <stop offset=".77" stopColor={prism ? '#ffcf86' : 'var(--plate-light)'}/><stop offset="1" stopColor="var(--plate-shade)"/>
      </linearGradient>
      <radialGradient id={id+'-limb'} cx=".27" cy=".22" r=".85">
        <stop stopColor="var(--plate-pearl)"/><stop offset=".34" stopColor={prism ? '#70eedf' : 'var(--plate-light)'}/>
        <stop offset=".73" stopColor={prism ? '#8265f2' : 'var(--plate-mid)'}/><stop offset="1" stopColor="var(--plate-dark)"/>
      </radialGradient>
      <linearGradient id={id+'-shadow'} x1="0" x2="1" y1=".1" y2=".9"><stop offset=".24" stopColor="var(--plate-dark)" stopOpacity="0"/><stop offset=".68" stopColor="var(--plate-dark)" stopOpacity=".32"/><stop offset="1" stopColor="var(--plate-dark)" stopOpacity=".96"/></linearGradient>
      <clipPath id={id+'-disc'}><circle cx="151" cy="71" r="42"/></clipPath>
    </defs>
    <rect width="300" height="144" fill={ink(id,'field')}/>
    <g fill="var(--plate-light)">{stars.map(({x,y},i)=><circle key={i} cx={x} cy={y} r={i % 8 ? .55 : 1.1} opacity={.24+(i%7)*.1}/>)}</g>
    <g fill="none" stroke="var(--plate-mid)" strokeWidth=".55">
      {[58,65,88].map(r=><circle key={r} cx="150" cy="72" r={r} strokeDasharray={r===65 ? '1 4' : undefined} opacity={r===58 ? .9 : .6}/>)}
      <path d="M8 11h10m-10 0v10m284-10h-10m10 0v10M8 133h10m-10 0v-10m284 10h-10m10 0v-10M23 99h15l22-17h18m144-42h14l16-12h24" />
    </g>
    <g className="lv-plate-subject">{galaxy === 'python' || galaxy === 'web'
      ? <RingWorld id={id} variant={variant}/>
      : galaxy === 'c' || galaxy === 'systems'
        ? <SiliconDie id={id} variant={variant}/>
        : <NodeAtlas id={id} variant={variant} prism={prism}/>}</g>
    <g className="lv-plate-stars"><Star x={36+variant%21} y={34+variant%15} size={2.8}/><Star x={239+variant%18} y={90+variant%19} size={3.8}/></g>
    <g stroke="var(--plate-light)" opacity=".67"><path d="M18 118h20m-20 3h12m222-98h15m-8 3h8" strokeWidth=".7"/><circle cx="60" cy="82" r="1" fill="var(--plate-pearl)" /></g>
  </svg>
}

const printTitles: Record<HoloCard['galaxy'], string> = {
  python: 'RING SYSTEM',
  c: 'SILICON DIE',
  algorithms: 'NODE ATLAS',
  web: 'DOM MATRIX',
  backend: 'SERVICE MESH',
  systems: 'SYSTEM CORE',
  robotics: 'TELEMETRY LINK',
}

function PlatePaper(props: PrintProps) {
  return <div className="lv-plate-paper" data-series={props.galaxy} data-gold={props.gold || undefined} {...{ drawable: '' }}>
    <Engraving {...props}/>
    <div className="lv-plate-caption"><span>{printTitles[props.galaxy]}</span><span>{props.cardNumber}</span></div>
  </div>
}

export function HoloPrint(props: PrintProps) {
  const surface = useRef<HTMLDivElement>(null)
  const native = nativePlateTextures()
  useEffect(() => {
    if (props.paperOnly || !surface.current) return
    return mountPlateRenderer(surface.current, native)
  }, [native, props.cardNumber, props.galaxy, props.gold, props.pack, props.slot, props.paperOnly])

  return <div ref={surface} className={'holo-print lv-plate' + (props.pack ? ' holo-print--pack' : '')} aria-hidden="true">
    <PlatePaper {...props}/>
    {!props.paperOnly && <canvas className="lv-plate-canvas" {...(native === 'modern' ? { content: 'drawable' } : native === 'legacy' ? { layoutsubtree: '' } : {})}>
      {native && <PlatePaper {...props}/>}
    </canvas>}
  </div>
}
