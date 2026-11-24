import type { CSSProperties, PointerEventHandler, ReactNode } from 'react'
import type { HoloCard } from './types'

type Props = {
  cards: HoloCard[]
  ready: boolean
  picked: number | null
  goldArrival: boolean
  onPick: (index: number) => void
  onReturn: () => void
  faces: (card: HoloCard, preview: boolean) => ReactNode
  onPointerMove: PointerEventHandler<HTMLDivElement>
  onPointerDown: PointerEventHandler<HTMLDivElement>
  onPointerUp: PointerEventHandler<HTMLDivElement>
}

export function PackSpread({ cards, ready, picked, goldArrival, faces, onPick, onReturn, ...gestures }: Props) {
  return <div className="pack-spread" role="group" aria-label="本包五张卡牌" aria-hidden={!ready} data-inspecting={picked !== null || undefined}>
    {picked !== null && <div className="pack-scrim" aria-hidden="true" onClick={onReturn}/>}
    {cards.map((card, i) => {
      const selected = i === picked
      return <div className="pack-seat" key={card.id} data-place={i} data-active={selected || undefined}
        inert={!ready || (picked !== null && !selected)} style={{ '--i': i } as CSSProperties}>
        {selected && goldArrival && <div className="capsule-gold-corona" aria-hidden="true">
          <i/><i/><i/>{Array.from({ length: 12 }, (_, n) =>
            <span key={n} style={{ '--ray': (n * 30 + 8) + 'deg', '--lag': (n % 3) * 38 + 'ms' } as CSSProperties}/>)}
        </div>}
        <div className="pack-deal"><div className="holo-card-holder" {...(selected ? gestures : {})}
          onPointerCancel={selected ? gestures.onPointerUp : undefined} onPointerLeave={selected ? gestures.onPointerUp : undefined}>
          {faces(card, !selected)}
          <i key={selected ? 'lift' : 'deal'} className="pack-glint" aria-hidden="true"/>
        </div></div>
        {!selected && <button className="pack-pick" type="button" data-pack-pick={i}
          aria-label={`放大第 ${i + 1} 张，${card.title}`} onClick={() => onPick(i)}/>}
      </div>
    })}
  </div>
}
