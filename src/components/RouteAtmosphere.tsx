import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { mountAtmosphere, scenePalettes, type SkyName } from './atmosphereScene'
import './route-atmosphere.css'

const textureWidth = 512
const textureHeight = 128

function sceneFor(path: string): SkyName {
  if (path === '/') return 'home'
  if (path.startsWith('/explore')) return 'map'
  if (path.startsWith('/library')) return 'library'
  if (path.startsWith('/lab')) return 'lab'
  if (path.startsWith('/my-universe')) return 'universe'
  if (/^\/academy\/[^/]+\/(lesson|learn|project)(\/|$)/.test(path)) return 'lesson'
  return 'academy'
}

function pickStage(path: string, root: HTMLElement) {
  const stages: Record<SkyName, string> = {
    home: '.hero-art', map: '.learn-header',
    library: '.learn-screen[data-view="resource"] .learn-header',
    lab: '.lab-intro', universe: '.learn-screen[data-view="universe"] .learn-header',
    lesson: '.workspace-header', academy: '.learn-header',
  }
  return root.querySelector<HTMLElement>(stages[sceneFor(path)]) ??
    root.querySelector<HTMLElement>('.missing-route, .workspace-empty, .learn-empty')
}

export function RouteAtmosphere({ path, paused }: { path: string; paused: boolean }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (path === '/explore' || path.startsWith('/explore/major-')) {
      setHost(null)
      return
    }
    const root = document.getElementById('main-content')
    if (!root) return
    let active: HTMLElement | null = null
    function locate() {
      if (active?.isConnected) return
      active = pickStage(path, root!)
      setHost(active)
    }
    locate()
    const observer = new MutationObserver(locate)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [path])
  return host && createPortal(<OpticalField key={path} sky={sceneFor(path)} paused={paused} />, host)
}

function OpticalField({ sky, paused }: { sky: SkyName; paused: boolean }) {
  const field = useRef<HTMLDivElement>(null)
  const palette = scenePalettes[sky]
  useEffect(() => {
    if (!field.current || paused) return
    return mountAtmosphere(field.current, sky)
  }, [sky, paused])
  return <div className="route-atmosphere" ref={field} data-sky={sky} aria-hidden="true" inert>
    <div className="atmosphere-fallback" style={{ background: `radial-gradient(ellipse at 70% 60%, ${palette.ice}35, transparent 43%), radial-gradient(ellipse at 85% 24%, ${palette.flare}30, transparent 40%)` }} />
    <canvas className="atmosphere-view" />
    <canvas className="atmosphere-plate" width={textureWidth} height={textureHeight} {...{ content: 'drawable', layoutsubtree: '' }}>
      <div {...{ drawable: '' }} style={{ position: 'relative', width: textureWidth, height: textureHeight, overflow: 'hidden',
        background: `linear-gradient(to bottom, transparent, ${palette.flare}09 14%, ${palette.flare}40 49%, ${palette.ice}a0 76%, ${palette.ice}e6 84%, #e3ffffd9 86%, ${palette.ice}80 89%, transparent 100%)` }}>
        {Array.from({ length: 54 }, (_, index) => {
          const height = 16 + 75 * (.5 + .5 * Math.sin(index * 1.73 + Math.cos(index * .65)))
          return <i key={index} style={{ position: 'absolute', bottom: '14%', left: `${index * 1.86}%`,
            height: `${height}%`, width: `${1.4 + .9 * Math.cos(index * 1.3)}%`, opacity: .38,
            background: `linear-gradient(0deg, ${palette.ice}cc, ${palette.flare}38 50%, transparent)` }} />
        })}
      </div>
    </canvas>
  </div>
}
