import { ArrowUpRight, AudioLines, BookOpen, ChevronDown, Cloud, Compass, FlaskConical, Library as LibraryIcon, LogIn, LogOut, Menu, MessageCircle, Orbit, Play, Search, Telescope, UserRound, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { brand } from './brand'
import { Intro } from './components/Intro'
import { RouteAtmosphere } from './components/RouteAtmosphere'
import { NavPill, clickNav } from './components/NavPill'
import { StationProvider, useStation } from './components/observatory/StationProvider'
import { courseSummaries } from './data/courseCatalog'
import { majorRoutes } from './data/majorRoutes'
import { categoryLabels } from './data/resources'
import { Home } from './pages/Home'
import { useProgress } from './state/progress'
import { updateStudentProfile, useStudentProfile } from './state/studentProfile'
import './components/student-welcome.css'

const PackReview = lazy(() => import('./cards/PackReview'))
const ObservatoryReview = lazy(() => import('./pages/ObservatoryReview'))
const Explore = lazy(() => import('./pages/Explore'))
const Academy = lazy(() => import('./pages/Learning').then((page) => ({ default: page.Academy })))
const Library = lazy(() => import('./pages/Learning').then((page) => ({ default: page.Library })))
const Dashboard = lazy(() => import('./pages/Learning').then((page) => ({ default: page.Dashboard })))
const Lab = lazy(() => import('./pages/Lab').then((page) => ({ default: page.Lab })))
const Workspace = lazy(() => import('./pages/Workspace').then((page) => ({ default: page.Workspace })))
const StudentWelcome = lazy(() => import('./components/StudentWelcome').then(module => ({ default: module.StudentWelcome })))

const destinations = [
  { path: '/', name: '首页', keywords: '宇宙 开场 home universe introduction' },
  { path: '/explore', name: '知识星图', keywords: '探索 学习领域 路线 explore knowledge map domains routes' },
  { path: '/academy', name: '学院', keywords: '课程 编程 学习 academy courses start learn programming' },
  { path: '/library', name: '资源库', keywords: '开源 文档 教程 library open source github references resources' },
  { path: '/lab', name: '实验室', keywords: '算法 编辑器 练习 项目 lab algorithm editor practice projects' },
  { path: '/my-universe', name: '我的宇宙', keywords: '个人中心 进度 收藏 universe dashboard progress favorites' },
]
const sectionIcons = [Telescope, Compass, BookOpen, LibraryIcon, FlaskConical, Orbit]

function shouldPlayIntro() {
  try {
    return sessionStorage.getItem(brand.introKey) !== '1'
  } catch {
    return true
  }
}

export function App() {
  const { pathname } = useLocation()
  const [intro, setIntro] = useState<'playing' | 'fading' | 'skipping' | null>(() => pathname === '/' && shouldPlayIntro() ? 'playing' : null)

  return (
    <StationProvider introActive={intro !== null}>
      <AppShell intro={intro} setIntro={setIntro} />
    </StationProvider>
  )
}

function AppShell({
  intro,
  setIntro,
}: {
  intro: 'playing' | 'fading' | 'skipping' | null
  setIntro: Dispatch<SetStateAction<'playing' | 'fading' | 'skipping' | null>>
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const station = useStation()
  const [menu, setMenu] = useState(false)
  const profile = useStudentProfile()
  const progress = useProgress()
  const [studentMode, setStudentMode] = useState<'profile' | 'route' | null>(null)
  const studentTrigger = useRef<HTMLElement | null>(null)
  const [newLearner] = useState(() => !progress.activeRoute && !progress.activeCourse
    && progress.started.length === 0 && progress.completed.length === 0 && progress.favorites.length === 0 && progress.minutes === 0)
  const showInvite = intro === null && newLearner && profile.welcome === 'new' && !progress.activeRoute
  const menuToggle = useRef<HTMLButtonElement>(null)
  const navigation = useRef<HTMLElement>(null)
  const account = useRef<HTMLDetailsElement>(null)
  const search = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const location = useLocation()
  const previousPath = useRef(pathname)

  function openStudent(mode: 'profile' | 'route', trigger: HTMLElement | null) {
    studentTrigger.current = trigger
    setMenu(false)
    if (account.current) account.current.open = false
    setStudentMode(mode)
  }

  function closeStudent() {
    setStudentMode(null)
    requestAnimationFrame(() => {
      if (document.activeElement !== document.body) return
      const trigger = studentTrigger.current
      const target = trigger?.isConnected ? trigger : document.getElementById('main-content')
      target?.focus({ preventScroll: true })
    })
  }

  const openSearch = useCallback(() => {
    if (document.querySelector('dialog[open]')) return
    setMenu(false)
    if (account.current) account.current.open = false
    setQuery('')
    search.current?.showModal()
  }, [])

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return
      if (document.querySelector('dialog[open]')) return
      event.preventDefault()
      openSearch()
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [openSearch])

  useEffect(() => {
    if (!menu) return
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !navigation.current?.contains(event.target) && !menuToggle.current?.contains(event.target)) setMenu(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [menu])

  useEffect(() => {
    if (menu) navigation.current?.querySelector('a')?.focus({ preventScroll: true })
  }, [menu])

  useEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    window.scrollTo(0, 0)
    if (account.current) account.current.open = false
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [pathname])

  const revealHome = useCallback((skipped: boolean) => {
    try {
      sessionStorage.setItem(brand.introKey, '1')
    } catch {
      // The current visit can continue even when storage is unavailable.
    }
    setIntro((phase) => phase === 'playing' ? (skipped ? 'skipping' : 'fading') : phase)
  }, [])

  const finishIntro = useCallback(() => setIntro(null), [])

  function replayIntro() {
    if (account.current) account.current.open = false
    if (pathname !== '/') navigate('/')
    window.scrollTo(0, 0)
    setIntro('playing')
  }

  const normalizedQuery = query.trim().normalize('NFKC').toLowerCase()
  const results = destinations.filter(({ name, keywords }) => `${name} ${keywords}`.toLowerCase().includes(normalizedQuery))
  const courseResults = normalizedQuery ? courseSummaries.filter((course) =>
    `${course.title} ${course.category} ${categoryLabels[course.category] ?? ''}`.toLowerCase().includes(normalizedQuery),
  ).slice(0, 5) : []
  const librarySearch = normalizedQuery ? `/library?q=${encodeURIComponent(query.trim())}` : '/library'
  const matchingMajors = normalizedQuery ? majorRoutes.filter(route =>
    `${route.title} ${route.english} ${route.id.slice(6)}`.toLowerCase().includes(normalizedQuery),
  ).slice(0, 5) : []

  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <div className="app-frame" data-home={pathname === '/'}>
        <header className="site-header" onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          if (account.current?.open) {
            account.current.open = false
            account.current.querySelector('summary')?.focus()
          } else if (menu) {
            setMenu(false)
            menuToggle.current?.focus()
          }
        }}>
          <Link className="brand" to="/" onClick={() => setMenu(false)} aria-label="Learnverse 首页">
            <Orbit size={27} strokeWidth={1.45} aria-hidden />
            <span lang="en">{brand.wordmark}</span>
          </Link>
          <nav className={menu ? 'site-nav is-open' : 'site-nav'} id="site-navigation" aria-label="主导航" ref={navigation}>
            <NavPill path={pathname} open={menu} />
            {destinations.map(({ path, name }, index) => {
              const Icon = sectionIcons[index]
              return <NavLink key={path} to={path} end={path === '/'} onClick={() => { clickNav(); setMenu(false) }}><Icon size={16} aria-hidden />{name}</NavLink>
            })}
          </nav>
          <div className="header-actions">
            <button className="icon-button" type="button" aria-label="全站搜索" aria-keyshortcuts="Control+k Meta+k" title="全站搜索（Ctrl / ⌘ + K）" onClick={openSearch}><Search size={18} /></button>
            <details className="account" ref={account}>
              <summary aria-label="个人菜单">
                <span className="account-avatar">{profile.avatar ? <img src={profile.avatar} alt="" /> : <UserRound size={16} strokeWidth={1.6} />}</span>
                <ChevronDown size={13} className="account-chevron" />
              </summary>
              <div className="account-menu">
                {(station.user?.display_name || profile.nickname) && (
                  <span className="student-account-name">
                    {station.user
                      ? (station.user.display_name && station.user.display_name !== station.user.username
                        ? `${station.user.display_name} · @${station.user.username}`
                        : `@${station.user.username}`)
                      : profile.nickname}
                  </span>
                )}
                <Link to="/my-universe" onClick={() => { if (account.current) account.current.open = false }}>
                  <UserRound size={15} /> 我的宇宙
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const opener = account.current?.querySelector('summary') ?? null
                    if (account.current) account.current.open = false
                    station.openAssistant(opener)
                  }}
                >
                  <MessageCircle size={15} /> 和 Vesper 对话
                </button>
                <button
                  type="button"
                  disabled={station.syncing}
                  onClick={() => {
                    const opener = account.current?.querySelector('summary') ?? null
                    if (account.current) account.current.open = false
                    void station.triggerCloudSync('sync_progress', opener)
                  }}
                >
                  <Cloud size={15} /> {station.syncing ? '正在云端同步…' : '云端同步进度与卡册'}
                </button>
                <button type="button" onClick={() => openStudent('profile', account.current?.querySelector('summary') ?? null)}><UserRound size={15} /> 个人资料</button>
                <button type="button" onClick={() => openStudent('route', account.current?.querySelector('summary') ?? null)}><Compass size={15} /> 选择学习路线</button>
                <button type="button" onClick={replayIntro}><Play size={15} /> 重播开场</button>
                {station.user ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (account.current) account.current.open = false
                      void station.logout()
                    }}
                  >
                    <LogOut size={15} /> 退出登录
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const opener = account.current?.querySelector('summary') ?? null
                      if (account.current) account.current.open = false
                      station.openAuth('sync_progress', opener)
                    }}
                  >
                    <LogIn size={15} /> 登录 / 注册观测站
                  </button>
                )}
              </div>
            </details>
            <button
              className="icon-button menu-toggle"
              ref={menuToggle}
              type="button"
              aria-label={menu ? '关闭导航菜单' : '打开导航菜单'}
              aria-expanded={menu}
              aria-controls="site-navigation"
              onClick={() => setMenu(!menu)}
            >{menu ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </header>
        {showInvite && <aside className="student-invite" aria-label="新生学习引导">
          <span><Compass size={15} aria-hidden /> 初次来访？找到你的学习起点。</span>
          <button type="button" onClick={event => openStudent('route', event.currentTarget)}>选择路线 <ArrowUpRight size={14} /></button>
          <button type="button" className="student-skip" onClick={() => { updateStudentProfile({ welcome: 'skipped' }); document.getElementById('main-content')?.focus({ preventScroll: true }) }}>跳过</button>
        </aside>}

        <main id="main-content" tabIndex={-1} className="site-main">
          <RouteAtmosphere path={pathname} paused={intro !== null} />
          <Suspense fallback={<div className="route-loading" role="status"><Orbit size={20} /> 正在加载页面…</div>}>
            <Routes location={location}>
              <Route index element={<Home onReplay={replayIntro} introActive={intro === 'playing'} />} />
              <Route path="explore" element={<Explore />} />
              <Route path="explore/:domainId" element={<Explore />} />
              <Route path="academy" element={<Academy />} />
              <Route path="academy/:courseId" element={<Academy />} />
              <Route path="academy/:courseId/learn" element={<Workspace />} />
              <Route path="academy/:courseId/lesson/:lessonId" element={<Workspace />} />
              <Route path="academy/:courseId/project" element={<Workspace showProject />} />
              <Route path="library" element={<Library />} />
              <Route path="cards" element={<Navigate replace to={`/my-universe${location.search}`} />} />
              <Route path="cards/pack-review" element={<PackReview />} />
              <Route path="ui-review" element={<ObservatoryReview />} />
              <Route path="lab" element={<Lab />} />
              <Route path="my-universe" element={<Dashboard />} />
              <Route path="*" element={<div className="route-loading missing-route"><h1>找不到这个页面</h1><Link className="button button-light" to="/">返回首页 <ArrowUpRight size={16} /></Link></div>} />
            </Routes>
          </Suspense>
        </main>
        <footer className="site-footer">
          <Link className="brand" to="/" lang="en"><Orbit size={21} strokeWidth={1.5} />{brand.wordmark}</Link>
          <nav aria-label="学习快捷方式"><Link to="/academy">课程目录</Link><Link to="/lab">实验室</Link><Link to="/my-universe#study">学习记录</Link></nav>
          <button className="text-button" type="button" onClick={replayIntro}><AudioLines size={16} /> 重播开场</button>
        </footer>
      </div>

      <dialog className="search-dialog" ref={search} aria-label="全站搜索" onClick={(event) => {
        if (event.target === event.currentTarget) search.current?.close()
      }}>
        <div className="search-inner">
          <div className="search-head">
            <Search size={19} aria-hidden />
            <input aria-label="搜索专业、页面、课程或资源" type="search" placeholder="搜索专业、页面、课程或资源" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="icon-button" aria-label="关闭搜索" onClick={() => search.current?.close()}><X size={18} /></button>
          </div>
          <div className="search-results">
            {results.length > 0 && <small>站内导航</small>}
            {results.map(({ path, name }) => <Link to={path} key={path} onClick={() => { search.current?.close(); setMenu(false) }}>{name}<ArrowUpRight size={15} /></Link>)}
            {matchingMajors.length > 0 && <small>专业路线</small>}
            {matchingMajors.map(route => <Link to={`/explore/${route.id}`} key={route.id} onClick={() => { search.current?.close(); setMenu(false) }}>{route.title}<ArrowUpRight size={15} /></Link>)}
            {courseResults.length > 0 && <small>课程</small>}
            {courseResults.map((course) => <Link to={`/academy/${course.id}`} key={course.id} onClick={() => { search.current?.close(); setMenu(false) }}>{course.title}<ArrowUpRight size={15} /></Link>)}
            {normalizedQuery && <Link to={librarySearch} onClick={() => { search.current?.close(); setMenu(false) }}>在资源库搜索「{query.trim()}」<ArrowUpRight size={15} /></Link>}
          </div>
        </div>
      </dialog>
      {intro && <Intro exit={intro === 'playing' ? null : intro} onReveal={revealHome} onFinish={finishIntro} />}
      {studentMode && <Suspense fallback={null}><StudentWelcome mode={studentMode} onClose={closeStudent} /></Suspense>}
    </>
  )
}
