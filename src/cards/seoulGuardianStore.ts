import { useSyncExternalStore } from 'react'

export const SEOUL_GUARDIAN_STORAGE_KEY = 'learnverse.vault.v1.genesis/seoul-node'
export const SEOUL_GUARDIAN_LIMIT = 100
export const SEOUL_GUARDIAN_NODE_LABEL =
  (import.meta.env.VITE_GUARDIAN_NODE_LABEL as string | undefined)?.trim() || 'SEOUL-NODE-01'

export interface SeoulGuardianRecord {
  cardId: 'seoul-genesis-node'
  rank: number
  githubUser: string
  claimedAt: string
  isGenesisGuardian: boolean
  aiDailyBonus: number
}

const listeners = new Set<() => void>()
let cachedRaw: string | null = null
let cachedRecord: SeoulGuardianRecord | null = null
let initialized = false

function parseRecord(raw: string | null): SeoulGuardianRecord | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SeoulGuardianRecord>
    if (typeof parsed?.rank !== 'number' || !Number.isFinite(parsed.rank) || parsed.rank < 1) {
      return null
    }
    return {
      cardId: 'seoul-genesis-node',
      rank: Math.floor(parsed.rank),
      githubUser: String(parsed.githubUser || 'genesis-pilot').slice(0, 64),
      claimedAt: String(parsed.claimedAt || new Date().toISOString()),
      isGenesisGuardian: parsed.isGenesisGuardian !== false,
      aiDailyBonus: typeof parsed.aiDailyBonus === 'number' ? parsed.aiDailyBonus : 10,
    }
  } catch {
    return null
  }
}

function loadOnce() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  try {
    cachedRaw = localStorage.getItem(SEOUL_GUARDIAN_STORAGE_KEY)
    cachedRecord = parseRecord(cachedRaw)
  } catch {
    cachedRaw = null
    cachedRecord = null
  }
  window.addEventListener('storage', event => {
    if (event.storageArea !== localStorage) return
    if (event.key !== null && event.key !== SEOUL_GUARDIAN_STORAGE_KEY) return
    cachedRaw = event.key === null ? null : event.newValue
    cachedRecord = parseRecord(cachedRaw)
    listeners.forEach(fn => fn())
  })
}

export function getSeoulGuardian(): SeoulGuardianRecord | null {
  loadOnce()
  return cachedRecord
}

export function saveSeoulGuardian(input: {
  rank: number
  githubUser?: string
  claimedAt?: string
  aiDailyBonus?: number
}): SeoulGuardianRecord {
  loadOnce()
  const next: SeoulGuardianRecord = {
    cardId: 'seoul-genesis-node',
    rank: Math.max(1, Math.floor(input.rank)),
    githubUser: (input.githubUser || 'genesis-pilot').trim().slice(0, 64) || 'genesis-pilot',
    claimedAt: input.claimedAt || cachedRecord?.claimedAt || new Date().toISOString(),
    isGenesisGuardian: true,
    aiDailyBonus: typeof input.aiDailyBonus === 'number' ? input.aiDailyBonus : 10,
  }
  const serialized = JSON.stringify(next)
  cachedRaw = serialized
  cachedRecord = next
  try {
    localStorage.setItem(SEOUL_GUARDIAN_STORAGE_KEY, serialized)
  } catch {
    // Keep in-memory copy when storage is restricted
  }
  listeners.forEach(fn => fn())
  return next
}

export function clearSeoulGuardian() {
  loadOnce()
  cachedRaw = null
  cachedRecord = null
  try {
    localStorage.removeItem(SEOUL_GUARDIAN_STORAGE_KEY)
  } catch {
    // Ignore storage removal errors
  }
  listeners.forEach(fn => fn())
}

function subscribe(listener: () => void) {
  loadOnce()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSeoulGuardian(): SeoulGuardianRecord | null {
  return useSyncExternalStore(subscribe, getSeoulGuardian, () => null)
}

export function formatGuardianSerial(rank: number, limit = SEOUL_GUARDIAN_LIMIT): string {
  if (rank >= 1 && rank <= limit) {
    return `NO.${String(rank).padStart(4, '0')} / ${String(limit).padStart(4, '0')}`
  }
  return 'SUPPORTER'
}

export function formatGuardianShortNo(rank: number, limit = SEOUL_GUARDIAN_LIMIT): string {
  if (rank >= 1 && rank <= limit) {
    return `NO.${String(rank).padStart(4, '0')}`
  }
  return 'SUPPORTER'
}
