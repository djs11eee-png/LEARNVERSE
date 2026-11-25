import type { RunLanguage } from '../../code/runner'
import type { CodeWorkbenchIssue } from '../CodeWorkbench'
import { clearSeoulGuardian, saveSeoulGuardian } from '../../cards/seoulGuardianStore'
import { courseSummaries } from '../../data/courseCatalog'
import { getStudentProfile, resetStudentProfile, updateStudentProfile } from '../../state/studentProfile'
import type { StudentProfile } from '../../state/studentProfile'
import type {
  AssistantEvent,
  AssistantRequest,
  AssistantTransport,
  AuthAdapter,
  AuthField,
  AuthMode,
  AuthRequest,
  AuthResult,
  CaptchaChallenge,
  CodeReference,
  Diagnosis,
  ErrorContext,
} from './contracts'

const PROGRESS_KEY = 'learnverse.learning-progress.v1'
const WORKSPACE_PREFIX = 'learnverse.workspace.v1.'
const VAULT_PREFIX = 'learnverse.vault.v1.'
const CLOUD_BASE_KEY = 'learnverse.cloud-base.v1'
const VALID_RUN_LANGUAGES = new Set<RunLanguage>(['python', 'javascript', 'sql', 'html', 'c', 'java'])
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,24}$/

export interface StationUser {
  id: number
  username: string
  email: string | null
  role: 'student' | 'admin'
  email_verified: boolean
  display_name: string
  profile: StudentProfile
  created_at: string
}

export interface StudyContextMeta {
  courseId?: string
  lessonId?: string
}

export interface AiQuotaTelemetry {
  isGenesisGuardian: boolean
  dailyLimit: number
  usedToday?: number
  remainingToday?: number
  dailyBonus?: number
}

export interface UnionSyncSummary {
  syncedAt: string
  ownedCards: number
  completedCourses: number
  minutes: number
  aiQuota?: AiQuotaTelemetry
}

export class StationAuthRequiredError extends Error {
  constructor(message = '需要先登录观测站账号。') {
    super(message)
    this.name = 'StationAuthRequiredError'
  }
}

interface RawUserProfileResponse {
  id: number
  username: string
  email: string | null
  role: 'student' | 'admin'
  email_verified: boolean
  profile?: Partial<StudentProfile>
  created_at: string
}

function normalizeUser(raw: RawUserProfileResponse): StationUser {
  const profile: StudentProfile = {
    nickname: typeof raw.profile?.nickname === 'string' ? raw.profile.nickname : '',
    avatar: typeof raw.profile?.avatar === 'string' ? raw.profile.avatar : '',
    welcome: raw.profile?.welcome === 'finished' || raw.profile?.welcome === 'skipped' ? raw.profile.welcome : 'new',
    path: raw.profile?.path === 'major' || raw.profile?.path === 'interest' || raw.profile?.path === 'undecided'
      ? raw.profile.path
      : null,
    choice: typeof raw.profile?.choice === 'string' ? raw.profile.choice : '',
  }
  return {
    id: raw.id,
    username: raw.username,
    email: raw.email ?? null,
    role: raw.role ?? 'student',
    email_verified: Boolean(raw.email_verified),
    display_name: profile.nickname || raw.username,
    profile,
    created_at: raw.created_at,
  }
}

export function makeErrorContext({ code, diagnostic, language }: CodeWorkbenchIssue): ErrorContext {
  const lines = code.split(/\r\n?|\n/)
  const anchor = Math.min(diagnostic.line ?? 1, lines.length) - 1
  const start = Math.max(0, anchor - 4)
  const end = Math.min(lines.length, anchor + 5)
  const excerpt = lines.slice(start, end).join('\n')
  const source = excerpt.slice(0, 2400).replace(/[\uD800-\uDBFF]$/, '')
  return {
    message: diagnostic.message.slice(0, 1000),
    line: diagnostic.line,
    column: diagnostic.column,
    ...(source && {
      reference: {
        id: crypto.randomUUID(),
        language,
        source,
        start_line: start + 1,
        truncated: start > 0 || end < lines.length || source.length < excerpt.length,
      },
    }),
  }
}

async function readErrorPayload(response: Response): Promise<{ message: string; field?: AuthField }> {
  try {
    const data = await response.json() as {
      detail?: string | Array<{ loc?: Array<string | number>; msg?: string }>
    }
    if (typeof data.detail === 'string' && data.detail.trim()) {
      const msg = data.detail.trim()
      if (msg.includes('验证码')) return { message: msg, field: 'captcha_code' }
      if (msg.includes('邮箱')) return { message: msg, field: 'recovery_email' }
      if (msg.includes('密码')) return { message: msg, field: 'password' }
      if (msg.includes('账号') || msg.includes('用户名')) return { message: msg, field: 'identifier' }
      return { message: msg }
    }
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const first = data.detail[0]
      const loc = (first.loc ?? []).map(String)
      const rawMsg = (first.msg ?? '输入信息格式不正确，请检查后重试。').replace(/^Value error,\s*/i, '')
      let field: AuthField | undefined
      if (loc.includes('username') || loc.includes('account')) field = 'identifier'
      else if (loc.includes('password')) field = 'password'
      else if (loc.includes('captcha_code')) field = 'captcha_code'
      else if (loc.includes('email')) field = 'recovery_email'
      return { message: rawMsg, field }
    }
  } catch {
    // Non-JSON proxy or network error body
  }
  if (response.status === 404 || response.status === 502 || response.status === 503) {
    return { message: '观测站后端服务暂未连接，请确认 FastAPI 服务已启动。' }
  }
  return { message: `请求失败（HTTP ${response.status}），请稍后重试。` }
}

export async function fetchCurrentUser(signal?: AbortSignal): Promise<StationUser | null> {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!res.ok) return null
    const raw = await res.json() as RawUserProfileResponse
    if (!raw || typeof raw.id !== 'number') return null
    return normalizeUser(raw)
  } catch {
    return null
  }
}

export async function fetchAiQuota(signal?: AbortSignal): Promise<AiQuotaTelemetry | null> {
  try {
    const res = await fetch('/api/ai/quota', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    })
    if (!res.ok) return null
    const raw = await res.json() as {
      used_today?: number
      daily_limit?: number
      remaining_today?: number
      is_genesis_guardian?: boolean
      daily_bonus?: number
    }
    if (typeof raw?.daily_limit !== 'number' || raw.daily_limit <= 0) return null
    const usedToday = typeof raw.used_today === 'number' ? Math.max(0, raw.used_today) : 0
    const remainingToday = typeof raw.remaining_today === 'number'
      ? Math.max(0, raw.remaining_today)
      : Math.max(0, raw.daily_limit - usedToday)
    return {
      isGenesisGuardian: Boolean(raw.is_genesis_guardian),
      dailyLimit: raw.daily_limit,
      usedToday,
      remainingToday,
      dailyBonus: typeof raw.daily_bonus === 'number' ? raw.daily_bonus : 0,
    }
  } catch {
    return null
  }
}

export async function logoutStation(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Clearing local session state is still safe even when offline.
  }
}

export function createProductionAuthAdapter(onSuccess?: (user: StationUser) => void): AuthAdapter {
  return {
    async getChallenge(signal: AbortSignal): Promise<CaptchaChallenge> {
      const res = await fetch('/api/auth/captcha', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal,
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json() as {
        captcha_id?: string
        image_data_url?: string
        expires_in?: number
      }
      if (!data.captcha_id || !data.image_data_url) {
        throw new Error('验证码数据格式异常')
      }
      return {
        captcha_id: data.captcha_id,
        image_url: data.image_data_url,
        expires_in: data.expires_in ?? 300,
      }
    },

    async submit(mode: AuthMode, body: AuthRequest, signal: AbortSignal): Promise<AuthResult> {
      if (mode === 'register') {
        if (!USERNAME_PATTERN.test(body.identifier)) {
          return {
            ok: false,
            error: {
              code: 'INVALID_USERNAME',
              field: 'identifier',
              message: '注册账号需为 3–24 位英文字母、数字、下划线或连字符。',
            },
          }
        }
        if (body.password.length < 8) {
          return {
            ok: false,
            error: {
              code: 'PASSWORD_TOO_SHORT',
              field: 'password',
              message: '为了保护学习记录，注册密码至少需要 8 位字符。',
            },
          }
        }
      }

      const localProfile = getStudentProfile()
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload = mode === 'login'
        ? {
          account: body.identifier,
          password: body.password,
          captcha_id: body.captcha_id,
          captcha_code: body.captcha_code,
        }
        : {
          username: body.identifier,
          email: body.recovery_email?.trim() || null,
          password: body.password,
          captcha_id: body.captcha_id,
          captcha_code: body.captcha_code,
          nickname: localProfile.nickname || body.identifier,
        }

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
      })

      if (!res.ok) {
        const err = await readErrorPayload(res)
        return {
          ok: false,
          error: {
            code: `HTTP_${res.status}`,
            field: err.field,
            message: err.message,
          },
        }
      }

      const data = await res.json() as { user: RawUserProfileResponse }
      const user = normalizeUser(data.user)
      onSuccess?.(user)
      return {
        ok: true,
        user: {
          id: String(user.id),
          display_name: user.display_name,
        },
      }
    },
  }
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

interface CloudBaseSnapshot {
  userId: number
  profile: StudentProfile
  activeCourse: string | null
  activeRoute: string | null
  favorites: string[]
  lastLessons: Record<string, string>
  notes: Record<string, string>
}

function readCloudBase(): CloudBaseSnapshot | null {
  try {
    const parsed = safeParseJson<Partial<CloudBaseSnapshot>>(window.localStorage.getItem(CLOUD_BASE_KEY))
    if (!parsed || typeof parsed.userId !== 'number') return null
    return {
      userId: parsed.userId,
      profile: {
        nickname: typeof parsed.profile?.nickname === 'string' ? parsed.profile.nickname : '',
        avatar: typeof parsed.profile?.avatar === 'string' ? parsed.profile.avatar : '',
        welcome: parsed.profile?.welcome === 'finished' || parsed.profile?.welcome === 'skipped' ? parsed.profile.welcome : 'new',
        path: parsed.profile?.path === 'major' || parsed.profile?.path === 'interest' || parsed.profile?.path === 'undecided'
          ? parsed.profile.path
          : null,
        choice: typeof parsed.profile?.choice === 'string' ? parsed.profile.choice : '',
      },
      activeCourse: typeof parsed.activeCourse === 'string' ? parsed.activeCourse : null,
      activeRoute: typeof parsed.activeRoute === 'string' ? parsed.activeRoute : null,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((x): x is string => typeof x === 'string') : [],
      lastLessons: parsed.lastLessons && typeof parsed.lastLessons === 'object' ? parsed.lastLessons as Record<string, string> : {},
      notes: parsed.notes && typeof parsed.notes === 'object' ? parsed.notes as Record<string, string> : {},
    }
  } catch {
    return null
  }
}

function writeCloudBase(snapshot: CloudBaseSnapshot): void {
  try {
    window.localStorage.setItem(CLOUD_BASE_KEY, JSON.stringify(snapshot))
  } catch {
    // Ignore storage quota issues
  }
}

export async function clearAccountLocalState(): Promise<void> {
  try {
    window.localStorage.removeItem(CLOUD_BASE_KEY)
    window.localStorage.removeItem(PROGRESS_KEY)
    for (const course of courseSummaries) {
      window.localStorage.removeItem(WORKSPACE_PREFIX + course.id)
    }
  } catch {
    // Ignore storage removal errors
  }
  resetStudentProfile()
  clearSeoulGuardian()
  try {
    const { resetVaultToEmpty } = await import('../../cards/rewards')
    resetVaultToEmpty()
  } catch {
    // Ignore module reset issues
  }
  window.dispatchEvent(new Event('learnverse:progress-synced'))
  window.dispatchEvent(new Event('learnverse:workspace-synced'))
}

export async function prepareUserStorage(userId: number): Promise<void> {
  const base = readCloudBase()
  if (base && base.userId !== userId) {
    await clearAccountLocalState()
  }
}

function collectLocalUnionPayload(userId?: number) {
  const base = userId !== undefined ? readCloudBase() : null
  const hasSameBase = Boolean(base && base.userId === userId)

  const localProfile = getStudentProfile()
  const profileChanged = !hasSameBase
    || localProfile.nickname !== base!.profile.nickname
    || localProfile.avatar !== base!.profile.avatar
    || localProfile.welcome !== base!.profile.welcome
    || localProfile.path !== base!.profile.path
    || localProfile.choice !== base!.profile.choice

  const rawProgress = safeParseJson<Record<string, unknown>>(
    (() => {
      try { return window.localStorage.getItem(PROGRESS_KEY) } catch { return null }
    })(),
  )
  const localFavorites = Array.isArray(rawProgress?.favorites)
    ? rawProgress.favorites.filter((x): x is string => typeof x === 'string')
    : []
  const localActiveCourse = typeof rawProgress?.activeCourse === 'string' ? rawProgress.activeCourse : null
  const localActiveRoute = typeof rawProgress?.activeRoute === 'string' ? rawProgress.activeRoute : null
  const unfavorited = hasSameBase
    ? base!.favorites.filter(fav => !localFavorites.includes(fav))
    : []

  const progress = {
    completed: Array.isArray(rawProgress?.completed) ? rawProgress.completed.filter((x): x is string => typeof x === 'string') : [],
    started: Array.isArray(rawProgress?.started) ? rawProgress.started.filter((x): x is string => typeof x === 'string') : [],
    favorites: localFavorites,
    minutes: typeof rawProgress?.minutes === 'number' && Number.isFinite(rawProgress.minutes) ? Math.max(0, Math.floor(rawProgress.minutes)) : 0,
    activity: Array.isArray(rawProgress?.activity) ? rawProgress.activity.slice(0, 60) : [],
    activeCourse: !hasSameBase || localActiveCourse !== base!.activeCourse ? localActiveCourse : null,
    activeRoute: !hasSameBase || localActiveRoute !== base!.activeRoute ? localActiveRoute : null,
    studyDays: Array.isArray(rawProgress?.studyDays) ? rawProgress.studyDays.filter((x): x is string => typeof x === 'string') : [],
  }

  const courses: Record<string, {
    completed: string[]
    verified: string[]
    lastLesson: string
    projectCompleted: boolean
    transferCompleted: boolean
  }> = {}

  for (const course of courseSummaries) {
    try {
      const rec = safeParseJson<Record<string, unknown>>(window.localStorage.getItem(WORKSPACE_PREFIX + course.id))
      if (!rec) continue
      const rawLast = typeof rec.lastLesson === 'string' ? rec.lastLesson : ''
      const lastLessonChanged = !hasSameBase || rawLast !== (base!.lastLessons[course.id] ?? '')
      courses[course.id] = {
        completed: Array.isArray(rec.completed) ? rec.completed.filter((x): x is string => typeof x === 'string') : [],
        verified: Array.isArray(rec.verified) ? rec.verified.filter((x): x is string => typeof x === 'string') : [],
        lastLesson: lastLessonChanged ? rawLast : '',
        projectCompleted: rec.projectCompleted === true,
        transferCompleted: rec.transferCompleted === true,
      }
    } catch {
      // Skip unreadable course entry
    }
  }

  const earned: string[] = []
  const opened: Record<string, string[]> = {}
  const offers: Record<string, string[]> = {}
  const notes: Record<string, string> = {}

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const fullKey = window.localStorage.key(i)
      if (!fullKey?.startsWith(VAULT_PREFIX)) continue
      const rel = fullKey.slice(VAULT_PREFIX.length)
      const val = window.localStorage.getItem(fullKey)
      if (val === null) continue
      if (rel.startsWith('earned/')) {
        earned.push(rel.slice(7))
      } else if (rel.startsWith('opened/')) {
        const parsed = safeParseJson<unknown>(val)
        if (Array.isArray(parsed)) opened[rel.slice(7)] = parsed.filter((x): x is string => typeof x === 'string')
      } else if (rel.startsWith('offer/')) {
        const parsed = safeParseJson<unknown>(val)
        if (Array.isArray(parsed)) offers[rel.slice(6)] = parsed.filter((x): x is string => typeof x === 'string')
      } else if (rel.startsWith('note/')) {
        const cardId = rel.slice(5)
        const trimmed = val.slice(0, 600)
        if (!hasSameBase || trimmed !== (base!.notes[cardId] ?? '')) {
          notes[cardId] = trimmed
        }
      }
    }
  } catch {
    // Storage unavailable
  }

  return {
    profile: profileChanged ? localProfile : null,
    progress,
    unfavorited,
    courses,
    vault: { earned, opened, offers, notes },
  }
}

interface UnionSyncResponseDto {
  synced_at: string
  profile: StudentProfile
  progress: {
    completed: string[]
    started: string[]
    favorites: string[]
    minutes: number
    activity: unknown[]
    activeCourse: string | null
    activeRoute: string | null
    studyDays: string[]
  }
  courses: Record<string, {
    completed: string[]
    verified: string[]
    lastLesson: string
    projectCompleted: boolean
    transferCompleted: boolean
  }>
  vault: {
    earned: string[]
    opened: Record<string, string[]>
    offers: Record<string, string[]>
    owned: string[]
    pending: string[]
    notes: Record<string, string>
  }
  guardian?: {
    rank: number
    githubUser: string
    claimedAt: string
    aiDailyBonus: number
  } | null
  ai_quota?: {
    usedToday: number
    dailyLimit: number
    remainingToday: number
    isGenesisGuardian: boolean
    dailyBonus: number
  } | null
}

export async function syncStationUnion(
  options?: AbortSignal | { signal?: AbortSignal; userId?: number },
): Promise<UnionSyncSummary> {
  const signal = options instanceof AbortSignal ? options : options?.signal
  const userId = options instanceof AbortSignal ? undefined : options?.userId
  if (userId !== undefined) {
    await prepareUserStorage(userId)
  }

  const payload = collectLocalUnionPayload(userId)
  const res = await fetch('/api/sync/union', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  })
  if (res.status === 401) {
    throw new StationAuthRequiredError('登录已失效，请重新登录后同步云端数据。')
  }
  if (!res.ok) {
    const err = await readErrorPayload(res)
    throw new Error(err.message)
  }

  const merged = await res.json() as UnionSyncResponseDto

  // 1. Hydrate StudentProfile without triggering feedback sync loop
  if (merged.profile) {
    updateStudentProfile(merged.profile, { fromCloud: true })
  }

  // 2. Hydrate global Progress
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(merged.progress))
    window.dispatchEvent(new Event('learnverse:progress-synced'))
  } catch {
    // Ignore storage quota issues
  }

  // 3. Hydrate per-course Workspace records
  const mergedLastLessons: Record<string, string> = {}
  for (const [courseId, record] of Object.entries(merged.courses ?? {})) {
    mergedLastLessons[courseId] = record.lastLesson || ''
    try {
      window.localStorage.setItem(WORKSPACE_PREFIX + courseId, JSON.stringify(record))
    } catch {
      // Ignore individual write issues
    }
  }
  window.dispatchEvent(new Event('learnverse:workspace-synced'))

  // 4. Hydrate Card Vault
  if (merged.vault) {
    const { applySyncedVault } = await import('../../cards/rewards')
    applySyncedVault(merged.vault)
  }

  // 5. Hydrate Seoul Genesis Node Guardian limited card across devices
  if (merged.guardian && typeof merged.guardian.rank === 'number' && merged.guardian.rank >= 1) {
    saveSeoulGuardian({
      rank: merged.guardian.rank,
      githubUser: merged.guardian.githubUser,
      claimedAt: merged.guardian.claimedAt,
      aiDailyBonus: merged.guardian.aiDailyBonus,
    })
  } else if (merged.guardian === null) {
    clearSeoulGuardian()
  }

  // 6. Save baseline snapshot so subsequent device syncs only push true local deltas
  if (userId !== undefined && merged.profile && merged.progress) {
    writeCloudBase({
      userId,
      profile: merged.profile,
      activeCourse: merged.progress.activeCourse ?? null,
      activeRoute: merged.progress.activeRoute ?? null,
      favorites: merged.progress.favorites ?? [],
      lastLessons: mergedLastLessons,
      notes: merged.vault?.notes ?? {},
    })
  }

  const aiQuota: AiQuotaTelemetry | undefined = merged.ai_quota
    && typeof merged.ai_quota.dailyLimit === 'number'
    && merged.ai_quota.dailyLimit > 0
    ? {
      isGenesisGuardian: Boolean(merged.ai_quota.isGenesisGuardian),
      dailyLimit: merged.ai_quota.dailyLimit,
      usedToday: Math.max(0, merged.ai_quota.usedToday ?? 0),
      remainingToday: Math.max(0, merged.ai_quota.remainingToday ?? 0),
      dailyBonus: Math.max(0, merged.ai_quota.dailyBonus ?? 0),
    }
    : undefined

  return {
    syncedAt: merged.synced_at,
    ownedCards: merged.vault?.owned?.length ?? 0,
    completedCourses: merged.progress?.completed?.length ?? 0,
    minutes: merged.progress?.minutes ?? 0,
    aiQuota,
  }
}

function normalizeCodeLanguage(lang?: string): RunLanguage {
  const clean = (lang ?? '').toLowerCase() as RunLanguage
  return VALID_RUN_LANGUAGES.has(clean) ? clean : 'python'
}

export function createProductionAssistantTransport(options: {
  getStudyContext: () => StudyContextMeta
  onUnauthorized?: () => void
  onQuotaTelemetry?: (telemetry: AiQuotaTelemetry) => void
}): AssistantTransport {
  const histories = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>()

  return async function* productionAssistant(request: AssistantRequest, signal: AbortSignal): AsyncIterable<AssistantEvent> {
    const conversationId = request.conversation_id ?? crypto.randomUUID()
    const history = histories.get(conversationId) ?? []
    const studyCtx = options.getStudyContext()
    let seq = 0
    const next = <T extends Omit<AssistantEvent, 'v' | 'request_id' | 'seq'>>(payload: T): AssistantEvent => ({
      v: 1,
      request_id: request.request_id,
      seq: ++seq,
      ...payload,
    } as AssistantEvent)

    yield next({ type: 'response.started', conversation_id: conversationId })

    const reqBody = {
      question: request.question,
      code: request.context?.reference?.source ?? '',
      error_output: request.context?.message ?? '',
      language: request.context?.reference?.language ?? 'python',
      course_id: studyCtx.courseId ?? null,
      lesson_id: studyCtx.lessonId ?? null,
      history: history.slice(-10),
    }

    let response: Response
    try {
      response = await fetch('/api/ai/chat', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(reqBody),
        signal,
      })
    } catch {
      if (signal.aborted) return
      yield next({
        type: 'response.error',
        error: {
          code: 'NETWORK_ERROR',
          message: '暂时无法连接到观测站 AI 助教服务，请检查网络或确认后端服务已启动。',
          retryable: true,
        },
      })
      return
    }

    if (response.status === 401) {
      options.onUnauthorized?.()
      yield next({
        type: 'response.error',
        error: {
          code: 'UNAUTHORIZED',
          message: '登录状态已过期，请重新登录后再向 Vesper 提问。',
          retryable: false,
        },
      })
      return
    }

    const reportQuotaHeaders = (res: Response) => {
      const dailyLimitHeader = Number(res.headers.get('X-AI-Daily-Limit') ?? '0')
      if (dailyLimitHeader > 0) {
        const usedRaw = res.headers.get('X-AI-Daily-Used')
        const remRaw = res.headers.get('X-AI-Daily-Remaining')
        const usedToday = usedRaw !== null && Number.isFinite(Number(usedRaw)) ? Math.max(0, Number(usedRaw)) : undefined
        const remainingToday = remRaw !== null && Number.isFinite(Number(remRaw))
          ? Math.max(0, Number(remRaw))
          : (usedToday !== undefined ? Math.max(0, dailyLimitHeader - usedToday) : undefined)
        options.onQuotaTelemetry?.({
          isGenesisGuardian: res.headers.get('X-Genesis-Guardian') === '1',
          dailyLimit: dailyLimitHeader,
          usedToday,
          remainingToday,
        })
      }
    }

    if (!response.ok) {
      reportQuotaHeaders(response)
      const err = await readErrorPayload(response)
      yield next({
        type: 'response.error',
        error: {
          code: `HTTP_${response.status}`,
          message: err.message,
          retryable: response.status >= 500 || response.status === 429,
        },
      })
      return
    }

    reportQuotaHeaders(response)

    if (!response.body) {
      yield next({
        type: 'response.error',
        error: {
          code: 'EMPTY_STREAM',
          message: '服务端未返回流式响应，请稍后重试。',
          retryable: true,
        },
      })
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullAnswer = ''
    let terminalSent = false

    const processBlock = (rawBlock: string): AssistantEvent[] => {
      const out: AssistantEvent[] = []
      const lines = rawBlock.split(/\r?\n/)
      let eventName = 'message'
      const dataLines: string[] = []
      for (const line of lines) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      }
      if (!dataLines.length) return out
      const rawJson = dataLines.join('\n')
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(rawJson) as Record<string, unknown>
      } catch {
        return out
      }

      if (eventName === 'text_delta' && typeof parsed.delta === 'string' && parsed.delta) {
        fullAnswer += parsed.delta
        out.push(next({ type: 'text.delta', delta: parsed.delta }))
      } else if (eventName === 'diagnostic_card') {
        const diagnosis: Diagnosis = {
          id: crypto.randomUUID(),
          line: typeof parsed.line === 'number' ? parsed.line : undefined,
          column: typeof parsed.column === 'number' ? parsed.column : undefined,
          title: typeof parsed.title === 'string' ? parsed.title : '代码诊断',
          explanation: typeof parsed.message === 'string' ? parsed.message : '',
          hints: typeof parsed.suggestion === 'string' && parsed.suggestion.trim()
            ? [parsed.suggestion.trim()]
            : [],
        }
        out.push(next({ type: 'diagnostic.card', diagnosis }))
      } else if (eventName === 'code_reference') {
        const lang = normalizeCodeLanguage(typeof parsed.language === 'string' ? parsed.language : request.context?.reference?.language)
        const snippet = typeof parsed.snippet === 'string' ? parsed.snippet : ''
        const fix = typeof parsed.fix === 'string' ? parsed.fix.trim() : ''
        const commentPrefix = lang === 'python' ? '#' : lang === 'sql' ? '--' : '//'
        const combined = fix && fix !== snippet.trim()
          ? `${snippet}\n${commentPrefix} 建议修改：${fix}`
          : snippet
        if (combined.trim()) {
          const reference: CodeReference = {
            id: crypto.randomUUID(),
            language: lang,
            source: combined,
            start_line: typeof parsed.line_start === 'number' && parsed.line_start > 0 ? parsed.line_start : 1,
            truncated: false,
          }
          out.push(next({ type: 'code.reference', reference }))
        }
      } else if (eventName === 'error') {
        if (!terminalSent) {
          terminalSent = true
          out.push(next({
            type: 'response.error',
            error: {
              code: typeof parsed.code === 'string' ? parsed.code : 'STREAM_ERROR',
              message: typeof parsed.message === 'string' ? parsed.message : '助教回复中断，请稍后重试。',
              retryable: true,
            },
          }))
        }
      } else if (eventName === 'done') {
        if (!terminalSent) {
          terminalSent = true
          out.push(next({ type: 'response.done' }))
        }
      }
      return out
    }

    try {
      while (true) {
        if (signal.aborted) {
          await reader.cancel().catch(() => {})
          return
        }
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        let splitAt = buffer.indexOf('\n\n')
        while (splitAt !== -1) {
          const block = buffer.slice(0, splitAt)
          buffer = buffer.slice(splitAt + 2)
          for (const ev of processBlock(block)) {
            yield ev
            if (ev.type === 'response.done' || ev.type === 'response.error') {
              if (ev.type === 'response.done') {
                const updated = [
                  ...history,
                  { role: 'user' as const, content: request.question.slice(0, 1800) },
                  ...(fullAnswer.trim() ? [{ role: 'assistant' as const, content: fullAnswer.slice(0, 1800) }] : []),
                ].slice(-12)
                histories.set(conversationId, updated)
              }
              return
            }
          }
          splitAt = buffer.indexOf('\n\n')
        }
      }

      const tail = buffer + decoder.decode()
      if (tail.trim()) {
        for (const ev of processBlock(tail)) {
          yield ev
          if (ev.type === 'response.done' || ev.type === 'response.error') return
        }
      }

      if (!terminalSent && !signal.aborted) {
        if (fullAnswer.trim()) {
          const updated = [
            ...history,
            { role: 'user' as const, content: request.question.slice(0, 1800) },
            { role: 'assistant' as const, content: fullAnswer.slice(0, 1800) },
          ].slice(-12)
          histories.set(conversationId, updated)
        }
        yield next({ type: 'response.done' })
      }
    } finally {
      reader.releaseLock()
    }
  }
}
