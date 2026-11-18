import { ArrowUpRight, AudioLines, ChevronDown, Menu, Orbit, Play, Search, UserRound, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { brand } from './brand'
import { Intro } from './components/Intro'
import { NavPill, clickNav } from './components/NavPill'
import { courseSummaries } from './data/courseCatalog'
import { categoryLabels } from './data/resources'
import { Home } from './pages/Home'

const Explore = lazy(() => import('./pages/Learning').then((page) => ({ default: page.Explore })))
const Academy = lazy(() => import('./pages/Learning').then((page) => ({ default: page.Academy })))
const Library = lazy(() => import('./pages/Learning').then((page) => ({ default: page.Library })))
const Dashboard = lazy(() => import('./pages/Learning').then((page) => ({ default: page.Dashboard })))
const Lab = lazy(() => import('./pages/Lab').then((page) => ({ default: page.Lab })))
const Workspace = lazy(() => import('./pages/Workspace').then((page) => ({ default: page.Workspace })))

const destinations = [
  { path: '/', name: '首页', keywords: '宇宙 开场 home universe introduction' },
  { path: '/explore', name: '知识星图', keywords: '探索 学习领域 路线 explore knowledge map domains routes' },
  { path: '/academy', name: '学院', keywords: '课程 编程 学习 academy courses start learn programming' },
  { path: '/library', name: '资源库', keywords: '开源 文档 教程 library open source github references resources' },
  { path: '/lab', name: '实验室', keywords: '算法 编辑器 练习 项目 lab algorithm editor practice projects' },
  { path: '/my-universe', name: '我的宇宙', keywords: '个人中心 进度 收藏 universe dashboard progress favorites' },
]

function shouldPlayIntro() {
  try {
    return sessionStorage.getItem(brand.introKey) !== '1'
  } catch {
    return true
  }
}

export function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [intro, setIntro] = useState(() => pathname === '/' && shouldPlayIntro())
  const [menu, setMenu] = useState(false)
  const menuToggle = useRef<HTMLButtonElement>(null)
  const navigation = useRef<HTMLElement>(null)
  const account = useRef<HTMLDetailsElement>(null)
  const search = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const location = useLocation()
  const previousPath = useRef(pathname)

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

  const finishIntro = useCallback(() => {
    try {
      sessionStorage.setItem(brand.introKey, '1')
    } catch {
      // The current visit can continue even when storage is unavailable.
    }
    setIntro(false)
  }, [])

  function replayIntro() {
    if (account.current) account.current.open = false
    if (pathname !== '/') navigate('/')
    window.scrollTo(0, 0)
    setIntro(true)
  }

  function openSearch() {
    setQuery('')
    search.current?.showModal()
  }

  const normalizedQuery = query.trim().normalize('NFKC').toLowerCase()
  const results = destinations.filter(({ name, keywords }) => `${name} ${keywords}`.toLowerCase().includes(normalizedQuery))
  const courseResults = normalizedQuery ? courseSummaries.filter((course) =>
    `${course.title} ${course.category} ${categoryLabels[course.category] ?? ''}`.toLowerCase().includes(normalizedQuery),
  ).slice(0, 5) : []
  const librarySearch = normalizedQuery ? `/library?q=${encodeURIComponent(query.trim())}` : '/library'

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
            {destinations.map(({ path, name }) => (
              <NavLink key={path} to={path} end={path === '/'} onClick={() => { clickNav(); setMenu(false) }}>{name}</NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button className="icon-button" type="button" aria-label="全站搜索" onClick={openSearch}><Search size={18} /></button>
            <details className="account" ref={account}>
              <summary aria-label="个人菜单">
                <span className="account-avatar"><UserRound size={16} strokeWidth={1.6} /></span>
                <ChevronDown size={13} className="account-chevron" />
              </summary>
              <div className="account-menu">
                <Link to="/my-universe" onClick={() => { if (account.current) account.current.open = false }}>
                  <UserRound size={15} /> 我的宇宙
                </Link>
                <button type="button" onClick={replayIntro}><Play size={15} /> 重播开场</button>
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

        <main id="main-content" tabIndex={-1} className="site-main">
          <Suspense fallback={<div className="route-loading" role="status"><Orbit size={20} /> 正在加载页面…</div>}>
            <Routes location={location}>
              <Route index element={<Home onReplay={replayIntro} introActive={intro} />} />
              <Route path="explore" element={<Explore />} />
              <Route path="explore/:domainId" element={<Explore />} />
              <Route path="academy" element={<Academy />} />
              <Route path="academy/:courseId" element={<Academy />} />
              <Route path="academy/:courseId/learn" element={<Workspace />} />
              <Route path="academy/:courseId/lesson/:lessonId" element={<Workspace />} />
              <Route path="library" element={<Library />} />
              <Route path="lab" element={<Lab />} />
              <Route path="my-universe" element={<Dashboard />} />
              <Route path="*" element={<div className="route-loading missing-route"><h1>找不到这个页面</h1><Link className="button button-light" to="/">返回首页 <ArrowUpRight size={16} /></Link></div>} />
            </Routes>
          </Suspense>
        </main>
        <footer className="site-footer">
          <Link className="brand" to="/" lang="en"><Orbit size={21} strokeWidth={1.5} />{brand.wordmark}</Link>
          <button className="text-button" type="button" onClick={replayIntro}><AudioLines size={16} /> 重播开场</button>
        </footer>
      </div>

      <dialog className="search-dialog" ref={search} aria-label="全站搜索" onClick={(event) => {
        if (event.target === event.currentTarget) search.current?.close()
      }}>
        <div className="search-inner">
          <div className="search-head">
            <Search size={19} aria-hidden />
            <input aria-label="搜索页面、课程或资源" type="search" placeholder="搜索页面、课程或资源" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="icon-button" aria-label="关闭搜索" onClick={() => search.current?.close()}><X size={18} /></button>
          </div>
          <div className="search-results">
            {results.map(({ path, name }) => <Link to={path} key={path} onClick={() => { search.current?.close(); setMenu(false) }}>{name}<ArrowUpRight size={15} /></Link>)}
            {courseResults.map((course) => <Link to={`/academy/${course.id}`} key={course.id} onClick={() => { search.current?.close(); setMenu(false) }}>{course.title}<ArrowUpRight size={15} /></Link>)}
            {normalizedQuery && <Link to={librarySearch} onClick={() => { search.current?.close(); setMenu(false) }}>在资源库搜索「{query.trim()}」<ArrowUpRight size={15} /></Link>}
          </div>
        </div>
      </dialog>
      {intro && <Intro onFinish={finishIntro} />}
    </>
  )
}
