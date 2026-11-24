import { useSyncExternalStore } from 'react'
import { workspaceCourses } from '../data/workspaceCourses'
import { cardCatalog } from './catalog'
import type { HoloCard } from './types'

// Each entitlement, opened pack and note has its own key. Two tabs updating
// different chapters never overwrite one another's collections.
const prefix = 'learnverse.vault.v1.'
const welcome = 'welcome'
const lessonKey = (course: string, lesson: string) => 'lesson/' + course + '/' + lesson
const knownLessons = new Map(workspaceCourses.flatMap(course => course.lessons.map(lesson =>
  [lessonKey(course.id, lesson.id), { course, lesson }] as const)))
const byId = new Map(cardCatalog.map(card => [card.id, card]))
const memory = new Map<string,string>()
const subscribers = new Set<() => void>()
let revision = 0
let saved = true
let initialized = false

function refresh() {
  revision++
  subscribers.forEach(notify => notify())
}

function load() {
  if (initialized) return
  initialized = true
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (key?.startsWith(prefix)) memory.set(key.slice(prefix.length), localStorage.getItem(key)!)
    }
  } catch { saved = false }
}

window.addEventListener('storage', event => {
  if (event.storageArea !== localStorage) return
  if (event.key === null) { memory.clear(); initialized = false; load(); refresh(); return }
  if (!event.key.startsWith(prefix)) return
  const key = event.key.slice(prefix.length)
  if (event.newValue === null) memory.delete(key)
  else memory.set(key, event.newValue)
  refresh()
})

function write(key: string, value: string) {
  load()
  if (memory.get(key) === value) return
  try { localStorage.setItem(prefix + key, value) } catch { saved = false }
  memory.set(key, value)
  refresh()
}

export function earnLesson(course: string, lesson: string) {
  const key = lessonKey(course, lesson)
  if (knownLessons.has(key)) write('earned/' + key, '1')
  return key
}

export function dailyKey(date = new Date()) {
  return 'day/' + [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

export function earnDaily(date = new Date()) {
  const key = dailyKey(date)
  write('earned/' + key, '1')
  return key
}

// Credit chapters already completed before the vault was added.
export function recoverLessons() {
  for (const course of workspaceCourses) {
    try {
      const record = JSON.parse(localStorage.getItem('learnverse.workspace.v1.' + course.id) ?? 'null')
      if (Array.isArray(record?.completed)) {
        for (const lesson of record.completed) earnLesson(course.id, lesson)
      }
    } catch { /* Other courses can still be recovered. */ }
  }
}

function readIds(raw?: string): string[] {
  try {
    const ids: unknown = JSON.parse(raw ?? 'null')
    return Array.isArray(ids) && ids.length === 5 && ids.every((id, i) => byId.get(id)?.slot === i + 1) ? ids : []
  } catch { return [] }
}

export function inventory() {
  load()
  const earned = [welcome]
  const opened = new Set<string>()
  const owned = new Set<string>()
  const notes: Record<string,string> = {}
  for (const [key, value] of memory) {
    if (key.startsWith('earned/')) earned.push(key.slice(7))
    else if (key.startsWith('opened/')) {
      const ids = readIds(value)
      if (ids.length) {
        opened.add(key.slice(7))
        ids.forEach(id => owned.add(id))
      }
    } else if (key.startsWith('note/')) notes[key.slice(5)] = value
  }
  return { earned, owned, notes, opened, pending: earned.filter(id => !opened.has(id)), saved }
}

export function packName(key: string) {
  return knownLessons.get(key)?.lesson.title ?? (key === welcome ? '首次到站补给' : '每日挑战补给')
}

function chooseCards(key: string): HoloCard[] {
  const { earned, owned } = inventory()
  if (!earned.includes(key)) return []
  const source = knownLessons.get(key)
  const relevant = source && cardCatalog.some(card => card.courseId === source.course.id)
  const studied = new Set(earned)
  const firstLessons = new Set(workspaceCourses.filter(course => course.difficulty === 'Beginner' || course.id === source?.course.id)
    .map(course => lessonKey(course.id, course.lessons[0].id)))
  const eligible = cardCatalog.filter(card => {
    const chapter = lessonKey(card.courseId, card.lessonId)
    return studied.has(chapter) || firstLessons.has(chapter)
  })
  // A new card from this lesson has priority. The remaining slots review
  // previously studied material or introduce a course's first example.
  function rank(card: HoloCard) {
    const chapter = lessonKey(card.courseId, card.lessonId)
    return (owned.has(card.id) ? 0 : 8) + (chapter === key ? 4 : studied.has(chapter) ? 2 : 0)
  }
  return ([1, 2, 3, 4, 5] as const).map(slot => {
    const slotPool = eligible.filter(card => card.slot === slot)
    const coursePool = relevant ? slotPool.filter(card => card.courseId === source.course.id) : []
    const options = coursePool.length ? coursePool : slotPool
    const best = Math.max(...options.map(rank))
    const choices = options.filter(card => rank(card) === best)
    return choices[Math.floor(Math.random() * choices.length)]
  })
}

// Reserve the five cards before showing the sealed packet. Closing, refreshing
// or opening another tab resumes the same packet.
export async function packFor(key: string): Promise<HoloCard[]> {
  const reserve = () => {
    load()
    for (const storageKey of ['opened/' + key, 'offer/' + key]) {
      let raw = memory.get(storageKey)
      try { raw = localStorage.getItem(prefix + storageKey) ?? raw } catch { /* Use memory. */ }
      const ids = readIds(raw)
      if (ids.length) return ids.map(id => byId.get(id)!)
    }
    const cards = chooseCards(key)
    if (cards.length === 5 && cards.every(Boolean)) write('offer/' + key, JSON.stringify(cards.map(card => card.id)))
    return cards
  }
  if (navigator.locks) return navigator.locks.request(prefix + 'offer/' + key, reserve).catch(reserve)
  return reserve()
}

export async function openPack(key: string, cards: HoloCard[]) {
  const { earned } = inventory()
  if (!earned.includes(key)) return
  const storageKey = 'opened/' + key
  function commit() {
    try {
      const previous = localStorage.getItem(prefix + storageKey)
      if (previous && readIds(previous).length) { write(storageKey, previous); return }
    } catch { /* Continue with session memory. */ }
    if (readIds(memory.get(storageKey)).length) return
    write(storageKey, JSON.stringify(cards.map(card => card.id)))
  }
  if (navigator.locks) await navigator.locks.request(prefix + storageKey, commit).catch(commit)
  else commit()
}

export function saveCardNote(id: string, value: string) {
  if (byId.has(id)) write('note/' + id, value.slice(0, 600))
}

export function applySyncedVault(vault: {
  earned?: string[]
  opened?: Record<string, string[]>
  offers?: Record<string, string[]>
  notes?: Record<string, string>
}) {
  load()
  let changed = false
  const put = (key: string, value: string) => {
    if (memory.get(key) === value) return
    try { localStorage.setItem(prefix + key, value) } catch { saved = false }
    memory.set(key, value)
    changed = true
  }
  for (const packKey of vault.earned ?? []) {
    if (packKey && packKey !== welcome) put('earned/' + packKey, '1')
  }
  for (const [packKey, ids] of Object.entries(vault.opened ?? {})) {
    const raw = JSON.stringify(ids)
    if (readIds(raw).length) put('opened/' + packKey, raw)
  }
  for (const [packKey, ids] of Object.entries(vault.offers ?? {})) {
    const raw = JSON.stringify(ids)
    if (readIds(raw).length && !memory.has('opened/' + packKey)) put('offer/' + packKey, raw)
  }
  for (const [cardId, note] of Object.entries(vault.notes ?? {})) {
    if (byId.has(cardId) && typeof note === 'string') put('note/' + cardId, note.slice(0, 600))
  }
  if (changed) refresh()
}
function subscribe(listener: () => void) {
  subscribers.add(listener)
  return () => { subscribers.delete(listener) }
}
export function useInventory() {
  useSyncExternalStore(subscribe, () => revision)
  return inventory()
}
