import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Binary, BookOpen, Bookmark,
  Braces, Check, CircleDot, Clock3, Code2, Compass, Flame, GitBranch,
  Layers3, Orbit, Radio, Search, Sparkles, Target, Terminal, Trophy,
} from 'lucide-react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { lazy, Suspense, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ThemeSelect } from '../components/ThemeSelect';
import { domains, routes } from '../data/learning';
import type { KnowledgeDomain, LearningRoute } from '../data/learning';
import { categoryLabels, courses as externalCourses, difficultyLabels, languageLabels, resources, resourceSearchText } from '../data/resources';
import type { Resource } from '../data/resources';
import { workspaceCourses } from '../data/workspaceCourses';
import { useProgress } from '../state/progress';
import type { Activity } from '../state/progress';
import './learning.css';

const CardVault = lazy(() => import('../cards/CardVault').then(module => ({ default: module.CardVault })));

const domainVisuals = [
  { icon: Braces, x: 20, y: 28 },
  { icon: Sparkles, x: 53, y: 13 },
  { icon: Binary, x: 79, y: 28 },
  { icon: Layers3, x: 85, y: 51 },
  { icon: Radio, x: 77, y: 75 },
  { icon: Code2, x: 48, y: 87 },
  { icon: GitBranch, x: 20, y: 74 },
  { icon: Terminal, x: 16, y: 51 },
];
const difficulties = ['Beginner', 'Intermediate', 'Advanced'] as const;
const sourceDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
});
const recentDateFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' });
const priorYearDateFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
const localCourses: Resource[] = workspaceCourses.map((course) => ({
  ...course,
  source: 'LEARNVERSE 站内课程',
  sourceUrl: '',
  license: course.attribution?.license ?? 'LEARNVERSE 原创内容',
  redistributionStatus: '站内学习内容',
  tags: course.lessons.flatMap((lesson) => [lesson.title, lesson.summary]),
  updatedAt: '2026-11-17',
  audience: '从基础开始学习的学习者',
  author: course.attribution?.author ?? 'LEARNVERSE',
}));

function findResource(id: string) {
  return resources.find((resource) => resource.id === id);
}

function findCourse(id: string) {
  return localCourses.find((course) => course.id === id) ?? externalCourses.find((course) => course.id === id);
}

function findRoute(id: string | null) {
  return routes.find((route) => route.id === id);
}

function resolveResources(ids: string[], lookup: (id: string) => Resource | undefined) {
  return ids.map(lookup).filter((resource): resource is Resource => Boolean(resource));
}

function Screen({ children }: { children: ReactNode }) {
  return <div className="learn-screen">{children}</div>;
}

function PageHeader({ title, copy, children }: { title: string; copy: string; children?: ReactNode }) {
  return (
    <header className="learn-header">
      {children}
      <h1>{title}</h1>
      <p>{copy}</p>
    </header>
  );
}

function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="learn-back" to={to}><ArrowLeft size={16} /> {children}</Link>;
}

function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="learn-empty"><CircleDot size={23} aria-hidden="true" /><h2>{title}</h2><div>{children}</div></div>;
}

function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="learn-section-heading"><h2>{title}</h2>{children}</div>;
}

function DifficultyBadge({ value }: { value: Resource['difficulty'] }) {
  return <span className={`learn-difficulty learn-difficulty--${value.toLowerCase()}`}><i />{difficultyLabels[value]}</span>;
}

function CourseCard({ course }: { course: Resource }) {
  const { started, completed } = useProgress();
  const isComplete = completed.includes(course.id);
  return (
    <article className="learn-card learn-course-card">
      <div className="learn-card-top">
        <div className="learn-icon"><BookOpen size={19} aria-hidden="true" /></div>
        <DifficultyBadge value={course.difficulty} />
      </div>
      <p className="learn-meta">{categoryLabels[course.category]} <span aria-hidden="true">·</span> {languageLabels[course.language]} <span aria-hidden="true">·</span> {course.source}</p>
      <h3>{course.title}</h3>
      <p>{course.description}</p>
      <Link className="learn-card-action" to={`/academy/${course.id}`}>
        {isComplete ? '复习课程' : started.includes(course.id) ? '继续学习' : '查看课程'}
        {isComplete ? <Check size={15} aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}
      </Link>
    </article>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  const { favorites, toggleFavorite } = useProgress();
  const saved = favorites.includes(resource.id);
  return (
    <article className="learn-card learn-resource-card">
      <div className="learn-card-top">
        <div className="learn-icon"><Layers3 size={19} aria-hidden="true" /></div>
        <div className="learn-card-tools">
          <DifficultyBadge value={resource.difficulty} />
          <button className="learn-icon learn-bookmark" type="button" aria-label={`收藏 ${resource.title}`} aria-pressed={saved} onClick={() => toggleFavorite(resource.id)}>
            <Bookmark size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="learn-meta">{categoryLabels[resource.category]} <span aria-hidden="true">·</span> {languageLabels[resource.language]} <span aria-hidden="true">·</span> {resource.source}</p>
      <h3>{resource.title}</h3>
      <p>{resource.description}</p>
      <details className="learn-source-details">
        <summary>来源与许可</summary>
        <dl>
          <div><dt>作者</dt><dd>{resource.author}</dd></div>
          <div><dt>适合人群</dt><dd>{resource.audience}</dd></div>
          <div><dt>资源语言</dt><dd>{languageLabels[resource.language]}</dd></div>
          <div><dt>许可证</dt><dd>{resource.license}</dd></div>
          <div><dt>再分发</dt><dd>{resource.redistributionStatus}</dd></div>
          <div><dt>核验日期</dt><dd><time dateTime={resource.updatedAt}>{sourceDateFormatter.format(new Date(resource.updatedAt))}</time></dd></div>
        </dl>
      </details>
      <div className="learn-resource-actions">
        <a className="learn-card-action" href={resource.sourceUrl} target="_blank" rel="noreferrer">访问官方资源 <ArrowUpRight size={15} aria-hidden="true" /></a>
        {resource.githubUrl && <a className="learn-card-action learn-card-action--neutral" href={resource.githubUrl} target="_blank" rel="noreferrer"><GitBranch size={15} aria-hidden="true" /> GitHub</a>}
      </div>
    </article>
  );
}

function RouteCourses({ route }: { route: LearningRoute }) {
  const { completed } = useProgress();
  return (
    <ol className="learn-route-steps">
      {resolveResources(route.courseIds, findCourse).map((course, index) => (
        <li key={course.id}>
          <span className="learn-route-index">{completed.includes(course.id) ? <Check size={16} aria-label="已完成" /> : index + 1}</span>
          <Link to={`/academy/${course.id}`}><span>{course.title}<small>{course.source}</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>
        </li>
      ))}
    </ol>
  );
}

function DomainDetail({ domain }: { domain: KnowledgeDomain }) {
  const { activeRoute, chooseRoute } = useProgress();
  const route = findRoute(domain.routeId);
  const relatedCourses = resolveResources(domain.courseIds, findCourse);
  const relatedResources = resolveResources(domain.resourceIds, findResource);
  return (
    <Screen>
      <PageHeader title={domain.title} copy={domain.description}><BackLink to="/explore">返回知识星图</BackLink></PageHeader>
      <div className="learn-split">
        {route && <section className="learn-card learn-route">
          <div className="learn-icon"><Compass size={20} aria-hidden="true" /></div>
          <p className="learn-meta">推荐学习路线</p>
          <h2>{route.title}</h2>
          <p>{route.description}</p>
          <RouteCourses route={route} />
          {activeRoute === route.id
            ? <Link to="/my-universe" className="learn-button"><Check size={17} aria-hidden="true" /> 查看我的路线</Link>
            : <button className="learn-button" type="button" onClick={() => chooseRoute(route.id)}>设为我的学习路线 <ArrowRight size={17} aria-hidden="true" /></button>}
        </section>}
        <aside className="learn-card learn-prereq">
          <div className="learn-icon"><Target size={19} aria-hidden="true" /></div>
          <h2>学习准备</h2>
          <p>{domain.prerequisites}</p>
        </aside>
      </div>
      <section className="learn-section">
        <SectionHeading title="推荐课程" />
        <div className="learn-grid">{relatedCourses.map((course) => <CourseCard key={course.id} course={course} />)}</div>
      </section>
      <section className="learn-section">
        <SectionHeading title="相关资源" />
        <div className="learn-grid learn-grid--resources">{relatedResources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
      </section>
    </Screen>
  );
}

export function Explore() {
  const { domainId } = useParams();
  if (domainId) {
    const domain = domains.find((item) => item.id === domainId);
    return domain
      ? <DomainDetail domain={domain} />
      : <Screen><BackLink to="/explore">返回知识星图</BackLink><EmptyState title="未找到这个领域"><p>请从知识星图选择其他主题。</p></EmptyState></Screen>;
  }

  return (
    <Screen>
      <PageHeader title="知识星图" copy="选择一个领域，查看入门要求、学习路线和推荐资源。" />
      <section aria-label="知识领域" className="learn-map">
        <div className="learn-map-art" aria-hidden="true">
          <div className="learn-map-ring" />
          <div className="learn-map-ring" />
          <div className="learn-map-ring" />
          <svg className="learn-map-spokes" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            {domainVisuals.map(({ x, y }, index) => {
              const path = `M 50 50 L ${x} ${y}`;
              return (
                <g key={domains[index].id}>
                  <path d={path} vectorEffect="non-scaling-stroke" />
                  <path
                    className="learn-map-signal"
                    d={path}
                    pathLength="1"
                    vectorEffect="non-scaling-stroke"
                    style={{ '--signal-delay': `${index * 37}ms` } as CSSProperties}
                  />
                </g>
              );
            })}
          </svg>
          <div className="learn-map-core"><Orbit size={46} strokeWidth={0.8} /></div>
        </div>
        <ul className="learn-map-nodes">
          {domains.map((domain, index) => {
            const { icon: Icon, x, y } = domainVisuals[index];
            return (
              <li key={domain.id} style={{ '--node-x': `${x}%`, '--node-y': `${y}%` } as CSSProperties}>
                <Link to={`/explore/${domain.id}`}><Icon size={17} aria-hidden="true" /><span>{domain.title}</span><ArrowUpRight size={13} aria-hidden="true" /></Link>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="learn-section">
        <SectionHeading title="精选路线" />
        <div className="learn-grid">
          {domains.filter((domain) => ['programming', 'ai', 'web-development'].includes(domain.id)).map((domain) => {
            const route = findRoute(domain.routeId);
            if (!route) return null;
            return <article className="learn-card learn-featured-route" key={route.id}><h3>{route.title}</h3><p>{route.description}</p><Link className="learn-card-action" to={`/explore/${domain.id}`}>查看学习路线 <ArrowUpRight size={15} aria-hidden="true" /></Link></article>;
          })}
        </div>
      </section>
    </Screen>
  );
}

function Catalog({ mode }: { mode: 'course' | 'resource' }) {
  const catalog = mode === 'course' ? localCourses : resources;
  const isLibrary = mode === 'resource';
  const [params, setParams] = useSearchParams();
  const { key: locationKey } = useLocation();
  const { favorites } = useProgress();
  const [draft, setDraft] = useState<{ key: string; value: string }>();
  const composing = useRef(false);
  const categories = [...new Set(catalog.map((item) => item.category))]
    .sort((a, b) => categoryLabels[a].localeCompare(categoryLabels[b], 'zh-CN'));
  const languages = [...new Set(catalog.map((item) => item.language))]
    .sort((a, b) => languageLabels[a].localeCompare(languageLabels[b], 'zh-CN'));
  const search = params.get('q') ?? '';
  const category = categories.find((option) => option === params.get('category')) ?? '';
  const difficulty = difficulties.find((option) => option === params.get('difficulty')) ?? '';
  const language = languages.find((option) => option === params.get('language')) ?? '';
  const onlySaved = params.get('saved') === '1';
  const terms = search.normalize('NFKC').toLowerCase().split(/[\s,、]+/).filter(Boolean);
  const visible = catalog.filter((item) => {
    const matchesFilters = (!category || category === item.category) &&
      (!difficulty || difficulty === item.difficulty) &&
      (!language || language === item.language) &&
      (!onlySaved || favorites.includes(item.id));
    if (!matchesFilters || !terms.length) return matchesFilters;
    const text = resourceSearchText(item);
    return terms.every((term) => text.includes(term));
  });

  function setFilter(name: string, value: string) {
    // The browser URL updates immediately, even while a previous filter is still rendering.
    const next = new URLSearchParams(window.location.search);
    if ((next.get(name) ?? '') === value) return;
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true, preventScrollReset: true });
  }

  function updateSearch(value: string) {
    setDraft({ key: locationKey, value });
    if (!composing.current) setFilter('q', value);
  }

  return (
    <Screen>
      <PageHeader title={isLibrary ? '资源库' : '学习学院'} copy={isLibrary
        ? '查找公开课程、练习和技术指南。每项资源都链接到原始发布方。'
        : '选择课程，在站内阅读章节、完成练习并记录进度。'} />
      <section aria-label={isLibrary ? '资源目录' : '课程目录'}>
        <div className="learn-filters">
          <label className="learn-search">
            <span>搜索</span>
            <span className="learn-input-wrap">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                value={draft?.key === locationKey ? draft.value : search}
                placeholder={isLibrary ? '搜索资源' : '搜索课程'}
                onChange={(event) => updateSearch(event.currentTarget.value)}
                onCompositionStart={() => { composing.current = true; }}
                onCompositionEnd={(event) => {
                  composing.current = false;
                  updateSearch(event.currentTarget.value);
                }}
              />
            </span>
          </label>
          <ThemeSelect label="分类" value={category} onChange={(value) => setFilter('category', value)} options={[
            { value: '', label: '全部分类' }, ...categories.map((value) => ({ value, label: categoryLabels[value] })),
          ]} />
          <ThemeSelect label="难度" value={difficulty} onChange={(value) => setFilter('difficulty', value)} options={[
            { value: '', label: '全部难度' }, ...difficulties.map((value) => ({ value, label: difficultyLabels[value] })),
          ]} />
          <ThemeSelect label="内容语言" value={language} onChange={(value) => setFilter('language', value)} options={[
            { value: '', label: '全部语言' }, ...languages.map((value) => ({ value, label: languageLabels[value] })),
          ]} />
          <button className="learn-button learn-button--secondary learn-filter-saved" type="button" aria-pressed={onlySaved} onClick={() => setFilter('saved', onlySaved ? '' : '1')}><Bookmark size={17} aria-hidden="true" /> 只看收藏</button>
        </div>
        <h2 className="learn-results" aria-live="polite">{visible.length} {isLibrary ? '项资源' : '门课程'}</h2>
        {visible.length
          ? <div className={`learn-grid${isLibrary ? ' learn-grid--resources' : ''}`}>{visible.map((item) => isLibrary
            ? <ResourceCard key={item.id} resource={item} />
            : <CourseCard key={item.id} course={item} />)}</div>
          : <EmptyState title={onlySaved ? (isLibrary ? '没有匹配的收藏资源' : '没有匹配的收藏课程') : '没有匹配的结果'}><button type="button" className="learn-button learn-button--secondary" onClick={() => setParams({}, { replace: true, preventScrollReset: true })}>清除筛选</button></EmptyState>}
      </section>
    </Screen>
  );
}

function CourseDetail({ course }: { course: Resource }) {
  const { started, completed, favorites, uncompleteCourse, toggleFavorite } = useProgress();
  const isComplete = completed.includes(course.id);
  const isActive = started.includes(course.id);
  const saved = favorites.includes(course.id);
  const local = workspaceCourses.find((item) => item.id === course.id);
  const firstLesson = local?.lessons[0];
  const attribution = local?.attribution;
  return (
    <Screen>
      <PageHeader title={course.title} copy={course.description}><BackLink to="/academy">返回学习学院</BackLink></PageHeader>
      <div className="learn-split">
        <section className="learn-card learn-course-intro">
          <div className="learn-card-top"><div className="learn-icon"><BookOpen size={20} aria-hidden="true" /></div><DifficultyBadge value={course.difficulty} /></div>
          <h2>课程简介</h2>
          <dl className="learn-course-facts">
            <div><dt>提供方</dt><dd>{course.source}</dd></div>
            <div><dt>主题</dt><dd>{categoryLabels[course.category]}</dd></div>
            <div><dt>适合人群</dt><dd>{course.audience}</dd></div>
            <div><dt>课程语言</dt><dd>{languageLabels[course.language]}</dd></div>
          </dl>
          <div className="learn-course-actions">
            {local && firstLesson
              ? <Link className="learn-button" to={`/academy/${local.id}/learn`}>
                  {isComplete ? '复习课程' : isActive ? '继续学习' : '开始学习'} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              : <Link className="learn-button" to="/academy">浏览站内课程 <ArrowRight size={15} aria-hidden="true" /></Link>}
            <button className="learn-button learn-button--secondary" type="button" aria-pressed={saved} onClick={() => toggleFavorite(course.id)}><Bookmark size={16} aria-hidden="true" /> {saved ? '已收藏' : '收藏课程'}</button>
          </div>
          {attribution && <details className="learn-source-details">
            <summary>课程来源与许可</summary>
            <dl>
              <div><dt>来源</dt><dd>{attribution.title}</dd></div>
              <div><dt>作者</dt><dd>{attribution.author}</dd></div>
              <div><dt>版本</dt><dd>{attribution.version}</dd></div>
              <div><dt>许可</dt><dd><a className="learn-inline-link" href={attribution.licensePath} target="_blank" rel="noreferrer">{attribution.license}</a></dd></div>
              <div><dt>版权</dt><dd>{attribution.copyright}</dd></div>
              <div><dt>改编说明</dt><dd>{attribution.changes}</dd></div>
              <div><dt>原文参考</dt><dd>{attribution.sources.map((source) => <a className="learn-reference-link" key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} <ArrowUpRight size={12} aria-hidden="true" /></a>)}</dd></div>
            </dl>
          </details>}
        </section>
        <aside className="learn-card learn-course-progress">
          <div className="learn-icon"><Target size={20} aria-hidden="true" /></div>
          <h2>{local ? '课程章节' : '历史学习记录'}</h2>
          <p role="status">{isComplete ? '已完成' : isActive ? '学习中' : '尚未开始'}</p>
          {local
            ? <ol className="learn-route-steps">
                {local.lessons.map((lesson, index) => <li key={lesson.id}>
                  <span className="learn-route-index">{index + 1}</span>
                  <Link to={`/academy/${local.id}/lesson/${lesson.id}`}><span>{lesson.title}<small>{lesson.summary}</small></span><ArrowRight size={16} aria-hidden="true" /></Link>
                </li>)}
              </ol>
            : <><p>这项外部课程的站内版本正在建设中。你的历史记录仍可查看。</p>
                {isComplete && <button type="button" className="learn-button learn-button--secondary" onClick={() => uncompleteCourse(course.id)}>撤销历史完成标记 <ArrowLeft size={15} aria-hidden="true" /></button>}
              </>}
        </aside>
      </div>
    </Screen>
  );
}

export function Academy() {
  const { courseId } = useParams();
  if (!courseId) return <Catalog mode="course" />;

  const course = findCourse(courseId);
  return course
    ? <CourseDetail course={course} />
    : <Screen><BackLink to="/academy">返回学习学院</BackLink><EmptyState title="未找到这门课程"><p>请到学习学院选择其他课程。</p></EmptyState></Screen>;
}

export function Library() {
  return <Catalog mode="resource" />;
}

function describeActivity(activity: Activity): string {
  if (activity.type === 'time-logged') return `记录学习时长 ${formatDuration(activity.minutes)}`;
  if (activity.type === 'route-selected') {
    const route = findRoute(activity.id);
    return route ? `选择了「${route.title}」路线` : '选择了一条学习路线';
  }
  const courseTitle = findCourse(activity.id)?.title;
  const course = courseTitle ? `「${courseTitle}」` : '一门课程';
  if (activity.type === 'course-reopened') return `撤销了${course}的完成标记`;
  return `${activity.type === 'course-started' ? '打开了' : '完成了'}${course}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining} 分钟`;
  return remaining ? `${hours} 小时 ${remaining} 分钟` : `${hours} 小时`;
}

function formatActivityDate(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return '今天';

  const sameYear = date.getFullYear() === today.getFullYear();
  today.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return '昨天';

  return (sameYear ? recentDateFormatter : priorYearDateFormatter).format(date);
}

function TimeForm() {
  const { logMinutes } = useProgress();
  const [values, setValues] = useState({ minutes: '', lastLogged: 0 });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minutes = Number(values.minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return;
    logMinutes(minutes);
    setValues({ minutes: '', lastLogged: minutes });
  }

  return (
    <form className="learn-time-form" onSubmit={submit}>
      <label htmlFor="study-minutes">记录学习时长</label>
      <div><input id="study-minutes" type="number" min="1" max="1440" placeholder="分钟" value={values.minutes} required onChange={(event) => setValues({ minutes: event.target.value, lastLogged: 0 })} /><button type="submit" className="learn-button learn-button--secondary">记录</button></div>
      {values.lastLogged > 0 && <p role="status">已记录 {formatDuration(values.lastLogged)}。</p>}
    </form>
  );
}

export function Dashboard() {
  const { hash } = useLocation();
  const section = hash === '#study' ? 'study' : 'vault';
  const { completed, favorites, minutes, streak, activity, activeCourse, activeRoute } = useProgress();
  const currentCourse = activeCourse ? findCourse(activeCourse) : undefined;
  const currentRoute = findRoute(activeRoute);
  const completedCourses = resolveResources(completed, findCourse);
  const savedCount = favorites.filter((id) => findResource(id) || findCourse(id)).length;
  const routeComplete = currentRoute?.courseIds.every((id) => completed.includes(id)) ?? false;
  const metrics = [
    { icon: BookOpen, value: `${completedCourses.length} 门`, label: '已完成课程' },
    { icon: Clock3, value: formatDuration(minutes), label: '累计学习时长' },
    { icon: Flame, value: `${streak} 天`, label: '连续学习' },
    { icon: Bookmark, value: `${savedCount} 项`, label: '已收藏资源' },
  ];
  const achievements = [
    { title: '完成第一门课程', earned: completedCourses.length > 0 },
    { title: '累计学习一小时', earned: minutes >= 60 },
    { title: '连续学习三天', earned: streak >= 3 },
    { title: '走完一条学习路线', earned: routeComplete },
  ];

  return (
    <Screen>
      <PageHeader title="我的宇宙" copy="在这台设备上收藏知识卡片，回顾自己的学习记录。" />
      <nav className="universe-switch" aria-label="我的宇宙视图">
        <Link to="/my-universe" aria-current={section === 'vault' ? 'page' : undefined}><Layers3 size={16} /> 知识图鉴</Link>
        <Link to="/my-universe#study" aria-current={section === 'study' ? 'page' : undefined}><BookOpen size={16} /> 学习记录</Link>
      </nav>
      {section === 'vault' ? <Suspense fallback={<p role="status">正在加载图鉴…</p>}><CardVault /></Suspense> : <>
      <dl className="learn-metrics">
        {metrics.map(({ icon: Icon, label, value }) => <div className="learn-card" key={label}><Icon size={20} aria-hidden="true" /><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="learn-split learn-section">
        <section className="learn-card learn-dashboard-card">
          <h2>当前学习路线</h2>
          {currentRoute
            ? <><p>{currentRoute.title}</p><RouteCourses route={currentRoute} /></>
            : <><p>还没有选择学习路线。</p><Link className="learn-card-action" to="/explore">探索学习路线 <ArrowUpRight size={16} aria-hidden="true" /></Link></>}
          {currentCourse && <Link className="learn-button" to={workspaceCourses.some((course) => course.id === currentCourse.id) ? `/academy/${currentCourse.id}/learn` : `/academy/${currentCourse.id}`}>继续学习「{currentCourse.title}」 <ArrowRight size={17} aria-hidden="true" /></Link>}
        </section>
        <section className="learn-card learn-dashboard-card">
          <h2>最近动态</h2>
          {activity.length ? <ol className="learn-activity">
            {activity.slice(0, 6).map((entry, index) => <li key={`${entry.timestamp}-${index}`}><span>{describeActivity(entry)}</span><time dateTime={entry.timestamp}>{formatActivityDate(entry.timestamp)}</time></li>)}
          </ol> : <p>开始学习或记录时长后，这里会显示相应动态。</p>}
          <TimeForm />
        </section>
      </div>
      <div className="learn-split learn-section">
        <section className="learn-card learn-dashboard-card">
          <h2>技能树</h2>
          <ul className="learn-skills">
            {domains.map((domain) => {
              const domainCourses = resolveResources(domain.courseIds, findCourse);
              const done = domainCourses.filter((course) => completed.includes(course.id)).length;
              return <li key={domain.id}><Link to={`/explore/${domain.id}`}>{domain.shortTitle}</Link><progress value={done} max={domainCourses.length || 1} aria-label={`${domain.shortTitle}课程进度`} /><span>{done}/{domainCourses.length}</span></li>;
            })}
          </ul>
        </section>
        <section className="learn-card learn-dashboard-card">
          <h2>学习成就</h2>
          <ul className="learn-achievements">
            {achievements.map(({ title, earned }) => <li key={title}><Trophy size={18} aria-hidden="true" /><span>{title}</span><small>{earned ? '已解锁' : '未解锁'}</small></li>)}
          </ul>
        </section>
      </div>
      <section className="learn-section">
        <SectionHeading title="已完成课程">
          <Link className="learn-card-action" to="/academy?saved=1">查看收藏课程 <ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link className="learn-card-action" to="/library?saved=1">查看收藏 <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </SectionHeading>
        {completedCourses.length
          ? <div className="learn-grid">{completedCourses.map((course) => <CourseCard key={course.id} course={course} />)}</div>
          : <EmptyState title="还没有完成课程"><Link className="learn-card-action" to="/academy">浏览学习学院 <ArrowDownRight size={16} aria-hidden="true" /></Link></EmptyState>}
      </section>
      </>}
    </Screen>
  );
}
