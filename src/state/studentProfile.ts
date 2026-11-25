import { useSyncExternalStore } from 'react'

export type StudentPath = 'major' | 'interest' | 'undecided'
export interface StudentProfile {
  nickname: string
  avatar: string
  welcome: 'new' | 'skipped' | 'finished'
  path: StudentPath | null
  choice: string
}

const key = 'learnverse.student-profile.v1'
const empty: StudentProfile = { nickname: '', avatar: '', welcome: 'new', path: null, choice: '' }
const changed = 'learnverse:student-profile-changed'
let snapshot = empty
let lastRaw: string | null = null
let temporary = false

function parse(raw: string | null): StudentProfile {
  try {
    const value = JSON.parse(raw ?? 'null') as Partial<StudentProfile> | null
    if (!value || typeof value !== 'object') return empty
    return {
      nickname: typeof value.nickname === 'string' ? value.nickname.trim().slice(0, 24) : '',
      avatar: typeof value.avatar === 'string' && value.avatar.length <= 180000 && /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(value.avatar) ? value.avatar : '',
      welcome: value.welcome === 'finished' || value.welcome === 'skipped' ? value.welcome : 'new',
      path: value.path === 'major' || value.path === 'interest' || value.path === 'undecided' ? value.path : null,
      choice: typeof value.choice === 'string' ? value.choice.slice(0, 64) : '',
    }
  } catch {
    return empty
  }
}

export function getStudentProfile(): StudentProfile {
  if (!temporary) {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== lastRaw) {
        snapshot = parse(raw)
        lastRaw = raw
      }
    } catch {
      // Retain the current session's profile if the browser disables storage.
    }
  }
  return snapshot
}

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== key && event.key !== null) return
    if (temporary) {
      lastRaw = null
      snapshot = empty
    }
    temporary = false
    onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(changed, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(changed, onChange)
  }
}

export function useStudentProfile() {
  return useSyncExternalStore(subscribe, getStudentProfile, () => empty)
}

export function updateStudentProfile(patch: Partial<StudentProfile>, options?: { fromCloud?: boolean }): boolean {
  snapshot = { ...getStudentProfile(), ...patch }
  const raw = JSON.stringify(snapshot)
  try {
    localStorage.setItem(key, raw)
    lastRaw = raw
    temporary = false
  } catch {
    temporary = true
  }
  window.dispatchEvent(new Event(changed))
  if (!options?.fromCloud) {
    window.dispatchEvent(new CustomEvent('learnverse:local-mutated', { detail: { scope: 'profile' } }))
  }
  return !temporary
}

export function resetStudentProfile(): void {
  snapshot = empty
  lastRaw = null
  temporary = false
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore storage removal errors
  }
  window.dispatchEvent(new Event(changed))
}

export async function prepareStudentAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片。')
  if (file.size > 2 * 1024 * 1024) throw new Error('图片超过 2 MB，请选择小一些的图片。')
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const matchesType = file.type === 'image/jpeg' ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    : file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)
    : String.fromCharCode(...header.slice(0, 4)) === 'RIFF' && String.fromCharCode(...header.slice(8, 12)) === 'WEBP'
  if (!matchesType) throw new Error('图片内容和文件格式不符，请重新导出图片再试。')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const crop = Math.min(image.naturalWidth, image.naturalHeight)
    if (crop < 1) throw new Error()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 160
    const context = canvas.getContext('2d')
    if (!context) throw new Error()
    context.fillStyle = '#202c36'
    context.fillRect(0, 0, 160, 160)
    context.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, 0, 0, 160, 160)
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    throw new Error('无法读取这张图片，请换一张再试。')
  } finally {
    URL.revokeObjectURL(url)
  }
}
