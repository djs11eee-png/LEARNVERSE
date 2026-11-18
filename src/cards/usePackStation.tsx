import { lazy, Suspense, useEffect, useState } from 'react'
import type { HoloCard } from './types'
import { inventory, openPack, packFor, packName, recoverLessons, saveCardNote, useInventory } from './rewards'

const HoloBoosterPack = lazy(() => import('./HoloBoosterPack').then(module => ({ default: module.HoloBoosterPack })))
type Selection = { mode: 'inspect' | 'pack'; key: string; cards: HoloCard[] }

export function usePackStation(autoOffer = false) {
  const vault = useInventory()
  const [selection, setSelection] = useState<Selection | null>(null)

  async function showPack(key: string) {
    if (!inventory().pending.includes(key)) return
    const cards = await packFor(key)
    if (cards.length === 5 && cards.every(Boolean)) setSelection({ mode: 'pack', key, cards })
  }
  useEffect(() => {
    if (!autoOffer) return
    recoverLessons()
    const pending = inventory().pending
    const first = pending.find(key => key !== 'welcome') ?? pending[0]
    if (first) showPack(first)
  }, [autoOffer])

  function inspect(card: HoloCard, tile: HTMLElement) {
    if (!vault.owned.has(card.id)) return
    const rect = tile.getBoundingClientRect()
    document.documentElement.style.setProperty('--vault-origin-x', (rect.left + rect.width / 2) + 'px')
    document.documentElement.style.setProperty('--vault-origin-y', (rect.top + rect.height / 2) + 'px')
    setSelection({ mode: 'inspect', key: card.id, cards: [card] })
  }
  const stage = selection && <Suspense fallback={<span role="status">正在展开补给舱…</span>}>
    <HoloBoosterPack key={selection.key} mode={selection.mode} cards={selection.cards}
      sourceLabel={selection.mode === 'pack' ? packName(selection.key) : undefined}
      notes={vault.notes} onNote={saveCardNote} onClose={() => setSelection(null)}
      onOpen={() => { if (selection.mode === 'pack') openPack(selection.key, selection.cards) }} />
  </Suspense>
  return { ...vault, showPack, inspect, stage }
}
