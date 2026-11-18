import { ArrowDown, ArrowRight, ArrowUpRight, Atom, Binary, BookOpen, Braces, CircleHelp, Code2, Compass, Cpu, FlaskConical, GitBranch, Globe2, Orbit, Play, Satellite, Telescope } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { brand } from '../brand'
import { domains, routes } from '../data/learning'
import { difficultyLabels, languageLabels, resources } from '../data/resources'
import { courseSummaries as courses } from '../data/courseCatalog'
import { useProgress } from '../state/progress'
import { HomeGlobe } from '../components/HomeGlobe'
import { Constellation, useHeroMotion, useMissionMotion } from '../components/HomeMotion'
import './home.css'

const domainIcons = [Braces, Cpu, Binary, Atom, Satellite, Globe2, GitBranch, Code2]
const starterRouteId = 'programming-foundations'
const selectedSources = ['python-tutorial-cn', 'mdn-javascript-cn', 'cs50']

export function Home({ onReplay, introActive }: { onReplay: () => void; introActive: boolean }) {
  const hero = useRef<HTMLElement>(null)
  const missions = useRef<HTMLElement>(null)
  useHeroMotion(hero, introActive)
  useMissionMotion(missions)
  const { activeCourse, activeRoute, completed } = useProgress()
  const route = routes.find(({ id }) => id === (activeRoute ?? starterRouteId)) ?? routes[0]
  const routeDomain = domains.find(({ routeId }) => routeId === route?.id)
  const routePath = routeDomain ? `/explore/${routeDomain.id}` : '/explore'
  const routeCourses = (route?.courseIds ?? []).flatMap((id) => courses.filter((course) => course.id === id))
  const firstIncomplete = routeCourses.find((course) => !completed.includes(course.id))
  const currentCourse = courses.find(({ id }) => id === activeCourse)
  const startPath = currentCourse ? `/academy/${currentCourse.id}/learn` : '/academy'
  const completedCount = courses.filter(({ id }) => completed.includes(id)).length
  const progress = courses.length ? Math.round(100 * completedCount / courses.length) : 0

  return (
    <>
      <section ref={hero} className="home-hero" aria-label="Learnverse 首页介绍" data-enter={introActive ? undefined : ''}>
        <div className="hero-art">
          <div className="hero-stars" aria-hidden="true" />
          <div className="hero-planet">
            <HomeGlobe />
            <img className="hero-moon" src="/art/near-moon.webp" width="284" height="284" alt="" draggable={false} />
          </div>
          <div className="hero-orbits" aria-hidden="true">
            <i /><i /><i />
            <b /><b /><b />
          </div>
        </div>

        <div className="hero-rail">
          <span aria-hidden="true" />
          <button type="button" onClick={onReplay} aria-label="重播开场" title="重播开场"><Play size={13} fill="currentColor" /></button>
          <span aria-hidden="true" />
        </div>

        <div className="hero-content">
          <span className="hero-kicker"><span /> 编程 · 算法 · 人工智能</span>
          <h1 lang="en" aria-label="Learn. Explore. Evolve.">
            <span><span>LEARN.</span></span>
            <span><span>EXPLORE.</span></span>
            <span><span>EVOLVE.</span></span>
          </h1>
          <p>{brand.tagline}</p>
          <div className="hero-actions">
            <span className="magnet-zone"><Link className="button button-light" to="/explore">探索知识星图 <ArrowUpRight size={16} strokeWidth={2.5} /></Link></span>
            <span className="magnet-zone"><Link className="button" to={startPath}>{currentCourse ? '继续学习' : '开始学习'} <ArrowRight size={16} /></Link></span>
          </div>
        </div>

        <Link className="planet-target" to="/explore">
          <span lang="en">KNOWLEDGE MAP</span>
          <strong>查看知识星图</strong>
          <ArrowUpRight size={15} />
        </Link>

        <div className="hero-stats" aria-label="学习内容概览">
          <Link to="/explore"><Orbit size={17} /><strong>{String(domains.length).padStart(2, '0')}</strong><span>知识领域</span></Link>
          <Link to="/academy"><BookOpen size={17} /><strong>{String(courses.length).padStart(2, '0')}</strong><span>精选课程</span></Link>
          <Link to="/library"><GitBranch size={17} /><strong>{String(resources.length).padStart(2, '0')}</strong><span>学习资源</span></Link>
        </div>
      </section>

      <section ref={missions} className="mission-grid" aria-label="学习快捷入口">
        <Link className="mission-card progress-card" to="/my-universe#study">
          <span className="mission-spot" aria-hidden="true" />
          <div className="mission-top"><span>学习进度</span><ArrowUpRight size={15} /></div>
          <div className="progress-schematic" aria-hidden="true">
            <div className="schematic-orbit" />
            <div className="schematic-orbit" />
            <div className="schematic-orbit" />
            <Satellite size={83} strokeWidth={.75} />
          </div>
          <div className="mission-bottom">
            <strong>已完成 {completedCount} 门课程</strong>
            <span className="mission-detail">查看学习记录</span>
            <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          </div>
        </Link>

        <Link className="mission-card path-card" to={routePath}>
          <span className="mission-spot" aria-hidden="true" />
          <div className="path-landscape" aria-hidden="true" />
          <div className="mission-top"><span>学习路线</span><span>{activeRoute ? '进行中' : '推荐'}</span></div>
          <div className="mission-bottom card-bottom-link">
            <div><strong>{route?.title ?? '选择学习路线'}</strong><span className="mission-detail">{routeCourses.length} 个学习步骤</span></div>
            <span className="mission-arrow"><ArrowUpRight size={17} /></span>
          </div>
        </Link>

        <Link className="mission-card map-card" to="/explore">
          <span className="mission-spot" aria-hidden="true" />
          <div className="mission-top"><span>知识星图</span><Compass size={15} /></div>
          <div className="map-visual" aria-hidden="true">
            <div className="map-rings"><i /><i /><i /><i /><i /><Constellation /></div>
          </div>
          <div className="mission-bottom card-bottom-link">
            <div><strong>{domains.length} 个知识领域</strong><span className="mission-detail">查看领域之间的联系</span></div>
            <span className="mission-arrow"><ArrowUpRight size={17} /></span>
          </div>
        </Link>

        <div className="mission-card timeline-card">
          <span className="mission-spot" aria-hidden="true" />
          <div className="mission-top"><span>下一步学什么</span><Link to={routePath} aria-label="查看学习路线"><ArrowUpRight size={15} /></Link></div>
          <div className="home-timeline">
            {routeCourses.slice(0, 3).map((course) => (
              <Link key={course.id} className={course.id === firstIncomplete?.id ? 'next-step' : ''} to={`/academy/${course.id}`}>
                <span className={completed.includes(course.id) ? 'step-dot is-complete' : 'step-dot'} />
                <span className="step-content"><strong>{course.title}</strong><small>{completed.includes(course.id) ? '已完成' : course.id === firstIncomplete?.id ? '从这里开始' : difficultyLabels[course.difficulty]}</small></span>
                <ArrowUpRight size={13} />
              </Link>
            ))}
            <Link to="/lab">
              <span className="step-dot" />
              <span className="step-content"><strong>去实验室练一练</strong><small>动手实践</small></span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        <a className="scroll-tile" href="#featured-domains">
          <span>向下探索</span>
          <span className="scroll-tile-arrow"><ArrowDown size={15} /></span>
        </a>
      </section>

      <div className="home-more">
        <section className="home-section" id="featured-domains">
          <div className="section-head">
            <div><p className="section-eyebrow" lang="en"><Telescope size={14} /> EXPLORE</p><h2>选择学习方向</h2></div>
            <Link className="button" to="/explore">查看全部领域 <ArrowUpRight size={16} /></Link>
          </div>
          <div className="featured-domains">
            {domains.slice(0, 4).map((domain, index) => {
              const Icon = domainIcons[index] ?? Orbit
              return (
                <Link key={domain.id} to={`/explore/${domain.id}`}>
                  <span className="domain-icon"><Icon size={23} strokeWidth={1.4} /></span>
                  <h3>{domain.title}</h3>
                  <p>{domain.description}</p>
                  <ArrowUpRight className="domain-arrow" size={17} />
                </Link>
              )
            })}
          </div>
        </section>

        <section className="home-section">
          <div className="section-head">
            <div><p className="section-eyebrow" lang="en"><GitBranch size={14} /> LIBRARY</p><h2>精选学习资源</h2></div>
            <Link className="button" to="/library">浏览资源库 <ArrowUpRight size={16} /></Link>
          </div>
          <div className="source-strip">
            {selectedSources.flatMap((id) => resources.filter((resource) => resource.id === id)).map((resource) => (
              <a key={resource.id} href={resource.sourceUrl} target="_blank" rel="noreferrer">
                <div><strong>{resource.title}</strong><span>{languageLabels[resource.language] ?? resource.language} · {resource.source}</span></div><ArrowUpRight size={18} />
              </a>
            ))}
          </div>
        </section>

        <section className="home-section home-lab">
          <div>
            <p className="section-eyebrow" lang="en"><FlaskConical size={14} /> THE LAB</p>
            <h2>在实验室动手练习</h2>
            <p className="section-description">逐步观察算法，编辑示例代码，或者用小测验检验理解。</p>
          </div>
          <Link className="button button-light" to="/lab">进入实验室 <ArrowUpRight size={16} /></Link>
          <CircleHelp className="home-lab-detail" size={190} strokeWidth={.2} aria-hidden="true" />
        </section>
      </div>
    </>
  )
}
