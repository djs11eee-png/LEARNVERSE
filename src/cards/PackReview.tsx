import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cardCatalog } from './catalog'
import HoloBoosterPack from './HoloBoosterPack'

// Reading order follows the two shoulders, the central card, then the bottom pair.
const sample = ['c-001', 'python-002', 'algorithms-008', 'c-005', 'python-003']
  .map(id => cardCatalog.find(card => card.id === id)!)

export default function PackReview() {
  const navigate = useNavigate()
  const [take, setTake] = useState(0)
  const [notes, setNotes] = useState<Record<string, string>>({})
  return <HoloBoosterPack key={take} mode="pack" cards={sample} sourceLabel="五张卡牌 · 动效审查"
    onReplay={() => setTake(n => n + 1)} onClose={() => navigate('/my-universe')}
    notes={notes} onNote={(id, text) => setNotes(previous => ({ ...previous, [id]: text }))}
    onOpen={() => {}} />
}
