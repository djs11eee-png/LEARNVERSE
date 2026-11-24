import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { CodeWorkbenchIssue } from '../CodeWorkbench'
import { useSeoulGuardian } from '../../cards/seoulGuardianStore'
import { AssistantPet } from './AssistantPet'
import type { ErrorContext, GateReason } from './contracts'

const loadAssistantDrawer = () => import('./AssistantDrawer').then(m => ({ default: m.AssistantDrawer }))
const loadGuestGate = () => import('./GuestGate').then(m => ({ default: m.GuestGate }))
const AssistantDrawer = lazy(loadAssistantDrawer)
const GuestGate = lazy(loadGuestGate)
import {
  createProductionAssistantTransport,
  createProductionAuthAdapter,
  fetchCurrentUser,
  logoutStation,
  makeErrorContext,
  StationAuthRequiredError,
  syncStationUnion,
} from './stationClient'
import type { AiQuotaTelemetry, StationUser, StudyContextMeta } from './stationClient'
import { useVesperState } from './useVesperState'
import '../../styles/observatory-tokens.css'
import './observatory.css'

type StationAction = {
  reason: GateReason
  opener: HTMLElement | null
  context?: ErrorContext
  study?: StudyContextMeta
}

type ActivePanel = {
  kind: 'auth' | 'assistant'
  action: StationAction
  nonce: number
}

type DockZone = 'home' | 'workspace' | 'lab' | 'default'

export interface StationContextValue {
  user: StationUser | null
  authChecked: boolean
  syncing: boolean
  syncNote: string
  openAuth: (reason?: GateReason, opener?: HTMLElement | null) => void
  openAssistant: (opener?: HTMLElement | null, context?: ErrorContext, study?: StudyContextMeta) => void
  askAboutError: (issue: CodeWorkbenchIssue, opener: HTMLElement, study?: StudyContextMeta) => void
  triggerCloudSync: (reason?: 'sync_cards' | 'sync_progress', opener?: HTMLElement | null) => Promise<void>
  logout: () => Promise<void>
  celebrateStar: (payload: { rank: number; githubUser: string }) => void
  setStudyContext: (meta: StudyContextMeta) => void
}

const HOME_AMBIENT_LINES = [
  '点亮一颗 GitHub Star，就能为首尔节点续命 +72 小时~',
  '前 100 名 Star 守护者可领取限量 3D 全息限定卡哦！',
  '遇到代码疑问或报错，点我随时呼出 Vesper 答疑台。',
  '成为创世守护者，每日免费 AI 问答额度自动 +10 次✦',
]

const WORKSPACE_AMBIENT_LINES = [
  '章节练习报错了？点「一键带错问小助手」我帮你定位！',
  '看不懂这一章的概念？随时点我展开 Vesper 答疑台。',
  '写代码像观星，先定位第一颗偏轨的符号或缩进。',
  '测验和编程样例双达标，就能点亮星图并解锁知识卡包。',
]

const LAB_AMBIENT_LINES = [
  '在实验室试跑报错？点「一键带错问小助手」我带你排查。',
  '算法单步看不懂边界条件？随时点我拆解思路。',
  '先缩成最小复现片段，排查 Bug 会快一倍！',
]

const DEFAULT_AMBIENT_LINES = [
  '星图已校准，遇到编程问题随时点我。',
  '登录后可以把学习进度与知识卡册同步到云端。',
  '随时点我，展开观测站 Vesper 答疑台。',
]

const ISOLATED_ROUTES = new Set(['/ui-review', '/cards/pack-review'])

function detectZone(pathname: string): DockZone {
  if (pathname === '/') return 'home'
  if (
    pathname.startsWith('/academy/')
    && (pathname.includes('/lesson/') || pathname.endsWith('/project') || pathname.endsWith('/learn'))
  ) {
    return 'workspace'
  }
  if (pathname === '/lab') return 'lab'
  return 'default'
}

const StationContext = createContext<StationContextValue | null>(null)

export function StationProvider({
  children,
  introActive = false,
}: {
  children: ReactNode
  introActive?: boolean
}) {
  const { pathname } = useLocation()
  const zone = detectZone(pathname)
  const isolated = ISOLATED_ROUTES.has(pathname)
  const seoulGuardian = useSeoulGuardian()

  const [user, setUser] = useState<StationUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState('')
  const [quotaTelemetry, setQuotaTelemetry] = useState<AiQuotaTelemetry | null>(null)
  const [celebrateMessage, setCelebrateMessage] = useState('')
  const [statusHint, setStatusHint] = useState<string | undefined>(undefined)
  const [panel, setPanel] = useState<ActivePanel>()

  const vesper = useVesperState('idle')
  const studyContextRef = useRef<StudyContextMeta>({})
  const mainContentRef = useRef<HTMLElement | null>(null)
  const panelNonce = useRef(0)

  // Keep ref pointed at #main-content for mobile editor collision avoidance across SPA routes
  useEffect(() => {
    mainContentRef.current = document.getElementById('main-content')
  }, [pathname])

  // Check existing HttpOnly session once on boot without blocking guest browsing
  useEffect(() => {
    const controller = new AbortController()
    void fetchCurrentUser(controller.signal).then(current => {
      if (controller.signal.aborted) return
      setUser(current)
      setAuthChecked(true)
    })
    return () => controller.abort()
  }, [])

  const setStudyContext = useCallback((meta: StudyContextMeta) => {
    studyContextRef.current = meta
  }, [])

  const runUnionSync = useCallback(async (reason: 'sync_cards' | 'sync_progress', silent = false) => {
    if (!silent) {
      setSyncing(true)
      setSyncNote('正在与观测站云端合并进度与卡册…')
    }
    try {
      const summary = await syncStationUnion()
      const label = reason === 'sync_cards'
        ? `卡册已云端同步（共 ${summary.ownedCards} 张卡片）`
        : `进度与卡册已云端同步（${summary.completedCourses} 门完成 · ${summary.ownedCards} 张卡片）`
      setSyncNote(label)
      if (!silent) {
        setStatusHint(label)
        vesper.triggerSuccess()
      }
    } catch (error) {
      if (error instanceof StationAuthRequiredError) {
        setUser(null)
        if (!silent) {
          setSyncNote('登录已失效，请重新登录后同步。')
        }
      } else if (!silent) {
        setSyncNote(error instanceof Error ? error.message : '云端同步失败，请确认后端服务可用。')
      }
    } finally {
      if (!silent) setSyncing(false)
    }
  }, [vesper])

  const executeAction = useCallback((action: StationAction) => {
    if (action.study) {
      studyContextRef.current = action.study
    }
    if (action.reason === 'assistant') {
      panelNonce.current += 1
      setPanel({ kind: 'assistant', action, nonce: panelNonce.current })
      return
    }
    setPanel(undefined)
    void runUnionSync(action.reason)
  }, [runUnionSync])

  const requestAction = useCallback((action: StationAction) => {
    if (action.context) vesper.triggerAlert()
    if (user) {
      executeAction(action)
    } else {
      panelNonce.current += 1
      setPanel({ kind: 'auth', action, nonce: panelNonce.current })
    }
  }, [user, executeAction, vesper])

  const openAuth = useCallback((reason: GateReason = 'sync_progress', opener: HTMLElement | null = null) => {
    panelNonce.current += 1
    setPanel({
      kind: 'auth',
      action: { reason, opener },
      nonce: panelNonce.current,
    })
  }, [])

  const openAssistant = useCallback((
    opener: HTMLElement | null = null,
    context?: ErrorContext,
    study?: StudyContextMeta,
  ) => {
    requestAction({ reason: 'assistant', opener, context, study })
  }, [requestAction])

  const askAboutError = useCallback((
    issue: CodeWorkbenchIssue,
    opener: HTMLElement,
    study?: StudyContextMeta,
  ) => {
    requestAction({
      reason: 'assistant',
      opener,
      context: makeErrorContext(issue),
      study,
    })
  }, [requestAction])

  const triggerCloudSync = useCallback(async (
    reason: 'sync_cards' | 'sync_progress' = 'sync_progress',
    opener: HTMLElement | null = null,
  ) => {
    if (!user) {
      openAuth(reason, opener)
      return
    }
    await runUnionSync(reason)
  }, [user, openAuth, runUnionSync])

  const logout = useCallback(async () => {
    await logoutStation()
    setUser(null)
    setQuotaTelemetry(null)
    setSyncNote('已退出登录，当前恢复为本地游客模式。')
    if (panel?.kind === 'assistant') {
      setPanel(undefined)
      vesper.returnToIdle()
    }
  }, [panel, vesper])

  const celebrateStar = useCallback(({ rank }: { rank: number; githubUser: string }) => {
    setCelebrateMessage(
      `检测到第 ${rank} 号创世守护者接入！首尔服务器散热风扇已全速运转，专属全息卡已存入收藏馆啦~`,
    )
    vesper.triggerCelebrating(3000)
  }, [vesper])

  const authAdapter = useMemo(
    () => createProductionAuthAdapter(loggedInUser => {
      setUser(loggedInUser)
      setAuthChecked(true)
    }),
    [],
  )

  const assistantTransport = useMemo(
    () => createProductionAssistantTransport({
      getStudyContext: () => studyContextRef.current,
      onUnauthorized: () => setUser(null),
      onQuotaTelemetry: telemetry => setQuotaTelemetry(telemetry),
    }),
    [],
  )

  const ambientLines = useMemo(() => {
    if (zone === 'home') return HOME_AMBIENT_LINES
    if (zone === 'workspace') return WORKSPACE_AMBIENT_LINES
    if (zone === 'lab') return LAB_AMBIENT_LINES
    return DEFAULT_AMBIENT_LINES
  }, [zone])

  const drawerFooterNote = useMemo(() => {
    if (quotaTelemetry) {
      return quotaTelemetry.isGenesisGuardian
        ? `Enter 发送，Shift + Enter 换行 · 创世守护者已激活（每日额度 ${quotaTelemetry.dailyLimit} 次）`
        : `Enter 发送，Shift + Enter 换行 · 实时流式答疑（每日额度 ${quotaTelemetry.dailyLimit} 次）`
    }
    if (seoulGuardian) {
      return `Enter 发送，Shift + Enter 换行 · 创世守护者每日 AI 额度 +${seoulGuardian.aiDailyBonus} 次`
    }
    return 'Enter 发送，Shift + Enter 换行 · 观测站实时启发式答疑'
  }, [quotaTelemetry, seoulGuardian])

  const contextValue = useMemo<StationContextValue>(() => ({
    user,
    authChecked,
    syncing,
    syncNote,
    openAuth,
    openAssistant,
    askAboutError,
    triggerCloudSync,
    logout,
    celebrateStar,
    setStudyContext,
  }), [
    user,
    authChecked,
    syncing,
    syncNote,
    openAuth,
    openAssistant,
    askAboutError,
    triggerCloudSync,
    logout,
    celebrateStar,
    setStudyContext,
  ])

  const drawerOpen = panel?.kind === 'assistant'

  return (
    <StationContext.Provider value={contextValue}>
      {children}

      {!isolated && (
        <div className="lv-observatory lvo-station-host" data-zone={zone}>
          <AssistantPet
            mood={vesper.mood}
            editorRegion={mainContentRef}
            observeKey={pathname}
            drawerOpen={drawerOpen || introActive}
            statusHint={vesper.mood === 'success' ? statusHint : undefined}
            celebrateMessage={celebrateMessage}
            ambientLines={ambientLines}
            onOpen={opener => openAssistant(opener)}
          />

          {panel?.kind === 'auth' && (
            <Suspense fallback={null}>
              <GuestGate
                key={panel.nonce}
                reason={panel.action.reason}
                adapter={authAdapter}
                opener={panel.action.opener}
                onDismiss={() => setPanel(undefined)}
                onAuthenticated={() => {
                  const action = panel.action
                  if (action.reason === 'assistant') {
                    // Silently union-sync guest progress/cards on login while opening Vesper drawer immediately
                    void runUnionSync('sync_progress', true)
                    executeAction(action)
                  } else {
                    executeAction(action)
                  }
                }}
              />
            </Suspense>
          )}

          {panel?.kind === 'assistant' && (
            <Suspense fallback={null}>
              <AssistantDrawer
                key={panel.nonce}
                context={panel.action.context}
                opener={panel.action.opener}
                transport={assistantTransport}
                mood={vesper.mood}
                footerNote={drawerFooterNote}
                onDismiss={() => {
                  setPanel(undefined)
                  if (vesper.mood === 'thinking') vesper.returnToIdle()
                }}
                onMoodChange={nextMood => {
                  setStatusHint(undefined)
                  vesper.setMood(nextMood)
                }}
              />
            </Suspense>
          )}
        </div>
      )}
    </StationContext.Provider>
  )
}

export function useStation(): StationContextValue {
  const ctx = useContext(StationContext)
  if (!ctx) {
    throw new Error('useStation must be used inside StationProvider')
  }
  return ctx
}
