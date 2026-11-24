import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, ChartNoAxesCombined, Compass, Cpu, FlaskConical, Layers3, MoveHorizontal, Orbit, Play, Satellite, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { SeoulGuardianBanner } from '../components/guardian/SeoulGuardianBanner'
import { useStation } from '../components/observatory/StationProvider'
import { getLearningRoute, routeMapPath, routes } from '../data/learning'
import { majorRoutes } from '../data/majorRoutes'
import { difficultyLabels, languageLabels, resources } from '../data/resources'
import { courseSummaries as courses } from '../data/courseCatalog'
import { useProgress } from '../state/progress'
import { HomeGlobe } from '../components/HomeGlobe'
import { Constellation, useHeroMotion, useMissionMotion } from '../components/HomeMotion'
import './home.css'

const featuredMajors = [
  { route: 'major-080902', icon: Layers3 }, { route: 'major-080910', icon: ChartNoAxesCombined },
  { route: 'major-080911', icon: Shield }, { route: 'major-080907', icon: Cpu },
]
const starterRouteId = 'programming-foundations'
const selectedSources = ['python-tutorial-cn', 'mdn-javascript-cn', 'cs50']

export function Home({ onReplay, introActive }: { onReplay: () => void; introActive: boolean }) {
  const hero = useRef<HTMLElement>(null)
  const missions = useRef<HTMLDivElement>(null)
  useHeroMotion(hero, introActive)
  useMissionMotion(missions)
  const station = useStation()
  const { activeCourse, activeRoute, completed } = useProgress()
  const route = getLearningRoute(activeRoute ?? starterRouteId) ?? routes[0]
  const routePath = routeMapPath(route)
  const routeCourses = route.courseIds.flatMap((id) => courses.filter((course) => course.id === id))
  const firstIncomplete = routeCourses.find((course) => !completed.includes(course.id))
  const timelineStart = firstIncomplete ? Math.max(0, routeCourses.indexOf(firstIncomplete) - 1) : Math.max(0, routeCourses.length - 3)
  const currentCourse = courses.find(({ id }) => id === activeCourse && !completed.includes(id))
  const nextCourse = currentCourse && (!activeRoute || route.courseIds.includes(currentCourse.id)) ? currentCourse : firstIncomplete
  const startPath = nextCourse ? `/academy/${nextCourse.id}/learn` : '/academy'
  const completedCount = courses.filter(({ id }) => completed.includes(id)).length
  const stats = [
    { count: majorRoutes.length, label: '专业路线', path: '/explore' },
    { count: courses.length, label: '站内课程', path: '/academy' },
    { count: resources.length, label: '学习资源', path: '/library' },
  ]

  return (
    <div className="observatory-home">
      <section ref={hero} className="home-hero" aria-label="Learnverse 首页介绍" data-enter={introActive ? undefined : ''}>
        <div className="hero-art">
          <div className="hero-stars" aria-hidden="true" />
          <div className="hero-planet">
            <div className="hero-orbits" aria-hidden="true"><i /><i /><b /></div>
            <HomeGlobe />
            <img className="hero-moon" src="/art/near-moon.webp" width="284" height="284" alt="" draggable={false} />
          </div>
        </div>
        <div className="hero-content">
          <p className="hero-kicker">{activeRoute ? route.title : '大学生计算机学习站'}</p>
          <h1><span><span>编程与 AI</span></span><span><span>学习观测站</span></span></h1>
          <p className="hero-intro">{activeRoute ? route.description : '从你的专业或兴趣出发，写下第一行代码。每完成一门课，就在知识星图上点亮一颗星。'}</p>
          <div className="hero-actions">
            <span className="magnet-zone"><Link className="button button-light" to={startPath}>{nextCourse && nextCourse === currentCourse ? '继续学习' : nextCourse ? '开始学习' : '浏览课程'} <ArrowRight size={17} /></Link></span>
            <span className="magnet-zone"><Link className="button hero-secondary" to="/explore">探索知识星图 <ArrowUpRight size={16} /></Link></span>
          </div>
        </div>
        <div className="hero-instruments">
          <span className="globe-hint"><MoveHorizontal size={16} /> 拖动地球旋转</span>
          <button className="hero-replay" onClick={onReplay} type="button"><Play size={12} fill="currentColor" /> 重播开场</button>
        </div>
      </section>
      <div className="observatory-bar">
        <div className="hero-stats" aria-label="学习内容概览">
          {stats.map(({ count, label, path }) => <Link to={path} key={path}><strong>{String(count).padStart(2, '0')}</strong><span>{label}</span></Link>)}
        </div>
        <a className="home-scroll" href="#study-route">查看学习路线 <ArrowDown size={15} /></a>
      </div>
      <div className="home-more">
        <SeoulGuardianBanner onStarSuccess={station.celebrateStar} />
        <section className="home-section" id="study-route">
          <div className="section-head">
            <h2>学习路线</h2>
            <Link className="home-text-link" to="/my-universe#study"><span>我的学习记录</span><span className="progress-count">{completedCount} 门已完成</span><ArrowUpRight size={16} /></Link>
          </div>
          <div className="mission-grid" ref={missions}>
            <Link className="mission-card path-card" to={routePath}>
              <span className="mission-spot" aria-hidden="true" />
              <span className="path-landscape" aria-hidden="true" />
              <span className="mission-top"><Compass size={17} />{activeRoute ? '当前路线' : '推荐路线'}</span>
              <div className="mission-bottom">
                <span>{routeCourses.length} 个学习步骤</span>
                <h3>{route.title}</h3>
                <p>{route.description}</p>
              </div>
              <ArrowUpRight className="path-arrow" size={24} />
            </Link>
            <div className="timeline-card">
              <div className="timeline-head"><h3>下一步学什么</h3><BookOpen size={18} /></div>
              <ol className="home-timeline">
                {routeCourses.slice(timelineStart, timelineStart + 3).map((course, index) => <li key={course.id}>
                  <Link className={course.id === firstIncomplete?.id ? 'next-step' : ''} to={`/academy/${course.id}`}>
                    <span className="step-index">{String(timelineStart + index + 1).padStart(2, '0')}</span>
                    <span className="step-content"><strong>{course.title}</strong><small>{completed.includes(course.id) ? '已完成' : course.id === firstIncomplete?.id ? '从这里开始' : difficultyLabels[course.difficulty]}</small></span>
                    <ArrowUpRight size={15} />
                  </Link>
                </li>)}
              </ol>
              {routeCourses.length > 3 && <Link className="home-text-link" to={routePath}>查看完整路线 <ArrowRight size={15} /></Link>}
            </div>
            <Link className="mission-card progress-card" to="/my-universe#study">
              <span className="mission-spot" aria-hidden="true" />
              <span className="mission-top"><Satellite size={17} /> 学习进度</span>
              <div className="progress-readout"><strong>{completedCount}</strong><span>/ {courses.length} 门课程已完成</span><ArrowUpRight size={18} /></div>
              <progress value={completedCount} max={courses.length} aria-label="已完成课程占比" />
            </Link>
            <Link className="mission-card map-card" to="/explore">
              <span className="mission-spot" aria-hidden="true" />
              <img className="map-preview-planet" src="/art/atlas/worlds/pelagic-rings.webp" width="768" height="768" loading="lazy" alt="" />
              <span className="mission-top"><Orbit size={17} /> 知识星图</span>
              <strong>探索 {majorRoutes.length} 条专业路线</strong><ArrowUpRight className="map-jump" size={18} />
            </Link>
          </div>
        </section>

        <section className="home-section" id="featured-domains">
          <div className="section-head"><h2>从专业出发</h2><Link className="home-text-link" to="/explore">查看全部路线 <ArrowUpRight size={16} /></Link></div>
          <div className="featured-domains">
            {featuredMajors.map(({ route: id, icon: Icon }) => {
              const major = majorRoutes.find(item => item.id === id)!
              return (
                <Link key={id} to={`/explore/${id}`}>
                  <span className="domain-icon" style={{ color: major.color }}><Icon size={25} strokeWidth={1.4} /></span>
                  <h3>{major.title}</h3><p>{major.description}</p>
                  <ArrowUpRight className="domain-arrow" size={17} />
                </Link>
              )
            })}
          </div>
        </section>

        <section className="home-section">
          <div className="section-head"><h2>精选学习资源</h2><Link className="home-text-link" to="/library">浏览资源库 <ArrowUpRight size={16} /></Link></div>
          <div className="source-strip">
            {selectedSources.flatMap((id) => resources.filter((resource) => resource.id === id)).map((resource) => (
              <a key={resource.id} href={resource.sourceUrl} target="_blank" rel="noreferrer">
                <div><strong>{resource.title}</strong><span>{languageLabels[resource.language] ?? resource.language} · {resource.source}</span></div><span className="source-original">阅读原文</span><ArrowUpRight size={18} />
              </a>
            ))}
          </div>
        </section>
        <section className="home-section home-lab">
          <div className="lab-constellation" aria-hidden="true"><Constellation /></div>
          <div><FlaskConical size={22} /><h2>在实验室动手练习</h2><p>逐步观察算法，编辑示例代码，或者用小测验检验理解。</p></div>
          <Link className="button button-light" to="/lab">进入实验室 <ArrowUpRight size={16} /></Link>
        </section>
      </div>
    </div>
  )
}
