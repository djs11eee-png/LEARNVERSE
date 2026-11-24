import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Clipboard, Code2, List, Play, Target } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { workspaceCourses } from '../data/workspaceCourses'
import type { LessonSection, WorkspaceCourse, WorkspaceLesson } from '../data/workspaceCourses'
import { getLessonExpansion } from '../data/expansions'
import { courseProjects, getCurriculumLesson } from '../data/curriculum'
import { transferExercises } from '../data/curriculum/transfer'
import type { TransferExercise } from '../data/curriculum/transfer'
import type { CourseProject } from '../data/curriculum/types'
import { corePrimers } from '../data/primers/core'
import { nativePrimers } from '../data/primers/native'
import { getChapterExercise } from '../code/exercises'
import { isNativeLanguage } from '../code/localRunner'
import { ChapterDiscussion } from '../components/ChapterDiscussion'
import { CodeWorkbench, languageLabels } from '../components/CodeWorkbench'
import type { CodeWorkbenchIssue } from '../components/CodeWorkbench'
import { useStation } from '../components/observatory/StationProvider'
import { useProgress } from '../state/progress'
import { withStorageLock } from '../state/storageLock'
import { earnLesson } from '../cards/rewards'
import { usePackStation } from '../cards/usePackStation'
import { WorkspaceDemo } from './WorkspaceDemo'
import './workspace.css'

type LessonRecord = { completed: string[]; verified: string[]; lastLesson: string; projectCompleted: boolean; transferCompleted: boolean }
const storagePrefix = 'learnverse.workspace.v1.'
const initialRecord: LessonRecord = { completed: [], verified: [], lastLesson: '', projectCompleted: false, transferCompleted: false }

function readRecord(course: WorkspaceCourse): LessonRecord | undefined {
  let stored: string | null
  try {
    stored = localStorage.getItem(storagePrefix + course.id)
  } catch {
    return undefined
  }
  try {
    const value: unknown = JSON.parse(stored ?? 'null')
    if (!value || typeof value !== 'object') return initialRecord
    const record = value as Partial<LessonRecord>
    const valid = new Set(course.lessons.map((lesson) => lesson.id))
    const validIds = (values: unknown) => Array.isArray(values) ? [...new Set(values.filter((id): id is string => typeof id === 'string' && valid.has(id)))] : []
    return {
      completed: validIds(record.completed),
      verified: validIds(record.verified),
      lastLesson: typeof record.lastLesson === 'string' && valid.has(record.lastLesson) ? record.lastLesson : '',
      projectCompleted: record.projectCompleted === true,
      transferCompleted: record.transferCompleted === true,
    }
  } catch {
    return initialRecord
  }
}

function mergeRecord(saved: LessonRecord, change: Partial<LessonRecord>): LessonRecord {
  return {
    completed: [...new Set([...saved.completed, ...(change.completed ?? [])])],
    verified: [...new Set([...saved.verified, ...(change.verified ?? [])])],
    lastLesson: change.lastLesson || saved.lastLesson,
    projectCompleted: saved.projectCompleted || change.projectCompleted === true,
    transferCompleted: saved.transferCompleted || change.transferCompleted === true,
  }
}

function useLessonRecord(course: WorkspaceCourse) {
  const [state, setState] = useState(() => {
    const saved = readRecord(course) ?? initialRecord
    return { record: saved, saved, storageError: false }
  })
  const lastStored = useRef(state.saved)
  const pending = useRef<LessonRecord | null>(null)

  useEffect(() => {
    function refresh() {
      const saved = readRecord(course)
      if (!saved) return
      lastStored.current = saved
      const change = pending.current
      setState({ record: change ? mergeRecord(saved, change) : saved, saved, storageError: change !== null })
    }
    function sync(event: StorageEvent) {
      if (event.key === storagePrefix + course.id || event.key === null) refresh()
    }
    refresh()
    window.addEventListener('storage', sync)
    window.addEventListener('learnverse:workspace-synced', refresh)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('learnverse:workspace-synced', refresh)
    }
  }, [course])

  const update = useCallback((change?: Partial<LessonRecord>) => {
    function commit() {
      if (change) pending.current = mergeRecord(pending.current ?? initialRecord, change)
      if (!pending.current) return
      const stored = readRecord(course)
      if (stored) lastStored.current = stored
      const record = mergeRecord(lastStored.current, pending.current)
      if (stored) {
        try {
          localStorage.setItem(storagePrefix + course.id, JSON.stringify(record))
          lastStored.current = record
          pending.current = null
        } catch {
          // Retry applies the unsaved changes to the latest stored copy.
        }
      }
      setState({ record, saved: lastStored.current, storageError: pending.current !== null })
    }
    void withStorageLock(storagePrefix + course.id, commit)
  }, [course])

  return { ...state, update }
}

export function Workspace({ showProject = false }: { showProject?: boolean }) {
  const { courseId, lessonId } = useParams()
  const course = workspaceCourses.find((item) => item.id === courseId)
  if (!course) {
    return <div className="workspace"><div className="workspace-empty"><h1>没有找到这门站内课程</h1><Link className="workspace-button" to="/academy">返回学习学院</Link></div></div>
  }
  return <CourseWorkspace key={course.id} course={course} lessonId={lessonId} showProject={showProject} />
}

function CourseWorkspace({ course, lessonId, showProject }: { course: WorkspaceCourse; lessonId?: string; showProject: boolean }) {
  const station = usePackStation()
  const observatory = useStation()
  const { record, saved, update, storageError } = useLessonRecord(course)
  const [chaptersOpen, setChaptersOpen] = useState(false)
  const { startCourse, completeCourse } = useProgress()
  const lesson = course.lessons.find((item) => item.id === lessonId)
  const project = courseProjects[course.id]
  const transfer = transferExercises[course.id]
  const projectPath = `/academy/${course.id}/project`

  useEffect(() => {
    observatory.setStudyContext({
      courseId: course.id,
      lessonId: showProject ? 'project' : lesson?.id,
    })
    return () => observatory.setStudyContext({})
  }, [observatory, course.id, showProject, lesson?.id])

  const handleAskAboutError = useCallback((issue: CodeWorkbenchIssue, opener: HTMLElement) => {
    observatory.askAboutError(issue, opener, {
      courseId: course.id,
      lessonId: showProject ? 'project' : lesson?.id,
    })
  }, [observatory, course.id, showProject, lesson?.id])

  useEffect(() => {
    startCourse(course.id)
    // Course entry is tracked once per mount, not on every chapter navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id])

  useEffect(() => {
    if (!lesson) return
    update({ lastLesson: lesson.id })
  }, [lesson, update])

  useEffect(() => {
    const allQuizzesPassed = course.lessons.every((item) => saved.completed.includes(item.id))
    const allCodeVerified = course.lessons.every((item) => saved.verified.includes(item.id))
    if (allQuizzesPassed && allCodeVerified) completeCourse(course.id)
    // A course counts as completed only after every chapter passes both quiz and coding verification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, saved.completed, saved.verified])

  if (!lessonId && !showProject) {
    const nextLesson = record.lastLesson
      || course.lessons.find((item) => !record.completed.includes(item.id) || !record.verified.includes(item.id))?.id
      || course.lessons[0].id
    return <Navigate replace to={`/academy/${course.id}/lesson/${nextLesson}`} />
  }
  const dualDone = course.lessons.filter((item) => record.completed.includes(item.id) && record.verified.includes(item.id)).length
  if (showProject && !project) {
    return <div className="workspace"><div className="workspace-empty"><h1>没有找到这门课的结课项目</h1><Link className="workspace-button" to={`/academy/${course.id}`}>返回课程</Link></div></div>
  }
  if (!showProject && !lesson) {
    return <div className="workspace"><div className="workspace-empty"><h1>没有找到这个章节</h1><Link className="workspace-button" to={`/academy/${course.id}/learn`}>继续学习</Link></div></div>
  }

  return (
    <div className="workspace">
      <header className="workspace-header">
        <Link className="workspace-back" to={`/academy/${course.id}`}><ArrowLeft size={16} aria-hidden="true" /> 返回课程</Link>
        <div className="workspace-meta">{course.title}</div>
      </header>
      <div className="workspace-layout">
        <aside className="workspace-sidebar" aria-label="课程章节">
          <h2><BookOpen size={17} aria-hidden="true" />课程章节</h2>
          <button className="workspace-chapter-toggle" type="button" aria-expanded={chaptersOpen} aria-controls="course-chapters" onClick={() => setChaptersOpen(!chaptersOpen)}>
            <List size={17} aria-hidden="true" />课程章节<ChevronDown size={16} aria-hidden="true" />
          </button>
          <p>章节测验 {record.completed.length} / {course.lessons.length}</p>
          <div className="workspace-progress" role="progressbar" aria-label="课程进度" aria-valuemin={0} aria-valuemax={course.lessons.length} aria-valuenow={record.completed.length} aria-valuetext={`${record.completed.length} / ${course.lessons.length} 章测验通过，${record.verified.length} / ${course.lessons.length} 章编程验证`}><span style={{ width: `${record.completed.length / course.lessons.length * 100}%` }} /></div>
          <div className="workspace-progress-stats">
            <span>编程样例已通过 {record.verified.length} / {course.lessons.length} 章</span>
            <span>双达标结课 {dualDone} / {course.lessons.length} 章</span>
            {project && <span>结课项目{saved.projectCompleted ? '已记录' : record.projectCompleted ? '待保存' : '待验收'}</span>}
            {transfer && <span>迁移练习{saved.transferCompleted ? '已记录' : record.transferCompleted ? '待保存' : '待完成'}</span>}
          </div>
          <ol id="course-chapters" data-open={chaptersOpen}>{course.lessons.map((item, lessonIndex) => {
            const quizDone = record.completed.includes(item.id)
            const codeDone = record.verified.includes(item.id)
            const fullDone = quizDone && codeDone
            const partialDone = !fullDone && (quizDone || codeDone)
            return (
              <li key={item.id}><Link className={`workspace-chapter${item.id === lesson?.id ? ' workspace-chapter-active' : ''}${fullDone ? ' workspace-chapter-done' : partialDone ? ' workspace-chapter-partial' : ''}`} aria-current={item.id === lesson?.id ? 'step' : undefined} onClick={() => setChaptersOpen(false)} to={`/academy/${course.id}/lesson/${item.id}`}>
                <span className="workspace-chapter-index">{String(lessonIndex + 1).padStart(2, '0')}</span><span>{item.title}</span>
                <span className="workspace-chapter-marks">
                  {codeDone && <Code2 size={14} aria-label="编程练习已验证" />}
                  {quizDone && <Check size={14} aria-label="章节测验已通过" />}
                </span>
              </Link></li>
            )
          })}
            {project && <li><Link className={`workspace-chapter${showProject ? ' workspace-chapter-active' : ''}${record.projectCompleted ? ' workspace-chapter-done' : ''}`} aria-current={showProject ? 'step' : undefined} onClick={() => setChaptersOpen(false)} to={projectPath}>
              <span className="workspace-chapter-index"><Target size={15} aria-hidden="true" /></span><span>结课项目</span>{record.projectCompleted && <Check size={14} aria-label="已完成" />}
            </Link></li>}
          </ol>
        </aside>
        <div className="workspace-main">
          {storageError && <div className="workspace-storage-note">
            <p className="workspace-status" role="alert">本次学习进度保留在当前页，暂时无法写入浏览器。</p>
            <button className="workspace-button" type="button" onClick={() => update()}>重试保存进度</button>
          </div>}
          {showProject && project && <Project courseId={course.id} project={project} done={record.projectCompleted} saved={saved.projectCompleted}
            transfer={transfer} transferDone={record.transferCompleted} transferSaved={saved.transferCompleted}
            onAskAboutError={handleAskAboutError}
            onComplete={() => update({ projectCompleted: true })}
            onTransferComplete={() => {
              if (!record.transferCompleted) update({ transferCompleted: true })
            }} />}
          {lesson && <Lesson key={lesson.id} course={course} lesson={lesson} index={course.lessons.indexOf(lesson)} done={record.completed.includes(lesson.id)} verified={record.verified.includes(lesson.id)} projectPath={project ? projectPath : undefined} onAskAboutError={handleAskAboutError} onVerified={() => {
            if (!record.verified.includes(lesson.id)) update({ verified: [lesson.id] })
          }} onComplete={() => {
            update({ completed: [lesson.id], lastLesson: lesson.id })
            const key = earnLesson(course.id, lesson.id)
            if (!record.completed.includes(lesson.id)) station.showPack(key)
          }} />}
        </div>
      </div>
      {station.stage}
    </div>
  )
}

function CodeSample({ code, language }: { code: string; language?: string }) {
  const [feedback, setFeedback] = useState<'copied' | 'selected' | ''>('')
  const snippet = useRef<HTMLElement>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setFeedback('copied')
    } catch {
      if (!snippet.current) return
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(snippet.current)
      selection?.removeAllRanges()
      selection?.addRange(range)
      setFeedback('selected')
    }
  }

  return (
    <div className="workspace-code">
      <div className="workspace-code-head"><span>{language ?? '示例'}</span><button type="button" onClick={() => void copy()}><Clipboard size={14} aria-hidden="true" /> {feedback === 'copied' ? '已复制' : '复制代码'}</button></div>
      <pre tabIndex={0} aria-label={language ? `${language}示例` : '代码示例'}><code ref={snippet}>{code}</code></pre>
      {feedback && <p className="workspace-code-feedback" role="status">{feedback === 'copied' ? '代码已复制。' : '请使用浏览器的复制功能，或长按代码选择复制。'}</p>}
    </div>
  )
}

function SampleRunner({ run, code, onAskAboutError }: { run: NonNullable<LessonSection['run']>; code?: string; onAskAboutError?: (issue: CodeWorkbenchIssue, opener: HTMLElement) => void }) {
  const [opened, setOpened] = useState(false)
  const starter = run.starter ?? code
  if (starter === undefined) return null
  return <details className="workspace-sample-run" onToggle={(event) => { if (event.currentTarget.open) setOpened(true) }}>
    <summary><Play size={15} aria-hidden="true" />{run.starter !== undefined ? '打开小练习' : '在工作台试运行'}</summary>
    {opened && run.starter === undefined && run.expectedOutput !== undefined && <p className="workspace-status">预期输出对应原始输入。改动输入后，可用正文提示核对新结果。</p>}
    {opened && <CodeWorkbench title={run.starter !== undefined ? '小练习编辑器' : '示例编辑器'} language={run.language}
      starter={starter} stdin={run.stdin} expectedOutput={run.expectedOutput} downloadName={run.downloadName}
      onAskAboutError={onAskAboutError} />}
  </details>
}

function Lesson({ course, lesson, index, done, verified, projectPath, onComplete, onVerified, onAskAboutError }: { course: WorkspaceCourse; lesson: WorkspaceLesson; index: number; done: boolean; verified: boolean; projectPath?: string; onComplete: () => void; onVerified: () => void; onAskAboutError?: (issue: CodeWorkbenchIssue, opener: HTMLElement) => void }) {
  const navigate = useNavigate()
  const expansion = getLessonExpansion(course.id, lesson.id)
  const primer = (corePrimers[course.id] ?? nativePrimers[course.id])?.[lesson.id] ?? getCurriculumLesson(course.id, lesson.id)?.primer
  const exercise = getChapterExercise(course.id, lesson.id, expansion?.practice)
  const sections = [...lesson.sections, ...(expansion?.sections ?? [])]
  const questions = [...lesson.questions, ...(expansion?.questions ?? [])]
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [previewed, setPreviewed] = useState(false)
  const [nativeAvailable, setNativeAvailable] = useState(false)
  const correct = questions.every((question) => answers[question.id] === question.answer)
  const answered = questions.every((question) => answers[question.id] !== undefined)
  const next = course.lessons[index + 1]
  const previous = course.lessons[index - 1]

  function submit() {
    setSubmitted(true)
    if (answered && correct) onComplete()
  }

  return (
    <article className="workspace-article">
      <header className="workspace-lesson-head">
        <p className="workspace-eyebrow">第 {index + 1} 章 <span>/</span> 共 {course.lessons.length} 章</p>
        <h1 className="workspace-title">{lesson.title}</h1>
        <p className="workspace-lead">{lesson.summary}</p>
        <a className="workspace-transfer-link" href="#chapter-discussion">参与本章讨论 <ArrowRight size={15} aria-hidden="true" /></a>
      </header>
      {expansion && <details className="workspace-outline">
        <summary>本章目录</summary>
        <nav aria-label="本章目录">
          <ol>
            {primer && <li><a href="#lesson-primer">先认识本章用到的词和写法</a></li>}
            {sections.map((section, sectionIndex) => <li key={sectionIndex}><a href={`#lesson-section-${sectionIndex + 1}`}>{section.heading}</a></li>)}
            {lesson.demo && <li><a href="#workspace-demo-title">交互可视化演示</a></li>}
            <li><a href="#lesson-pitfalls">常见易错点</a></li>
            <li><a href="#lesson-practice">动手练习</a></li>
            <li><a href="#quiz-heading">章节练习</a></li>
            {expansion.wrapUp && <li><a href="#lesson-wrap-up">小结与下一步</a></li>}
          </ol>
        </nav>
      </details>}
      {primer && <section className="workspace-primer" aria-labelledby="lesson-primer">
        <h2 id="lesson-primer">先用大白话理解</h2>
        <p>{primer.lead}</p>
        <dl>
          {primer.terms.map(([term, description]) => <div key={term}><dt>{term}</dt><dd>{description}</dd></div>)}
        </dl>
      </section>}
      {expansion && <div className="workspace-study-guide">
        <section aria-labelledby="lesson-objectives">
          <h2 id="lesson-objectives">学完这一章，你能</h2>
          <ul>{expansion.objectives.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>}
      <div className="workspace-copy">
        {sections.map((section, sectionIndex) => (
          <section key={sectionIndex}>
            <h2 id={`lesson-section-${sectionIndex + 1}`}>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.code && <CodeSample code={section.code} language={section.codeLanguage} />}
            {section.run && <SampleRunner code={section.code} run={section.run} onAskAboutError={onAskAboutError} />}
          </section>
        ))}
      </div>
      {lesson.demo && <WorkspaceDemo demo={lesson.demo} />}
      {expansion && <>
        <section className="workspace-study-section" aria-labelledby="lesson-pitfalls">
          <h2 id="lesson-pitfalls">常见易错点</h2>
          <dl className="workspace-pitfalls">
            {expansion.pitfalls.map((pitfall) => <div key={pitfall.mistake}>
              <dt>{pitfall.mistake}</dt>
              <dd>{pitfall.why}<p><strong>怎么改</strong> {pitfall.fix}</p></dd>
            </div>)}
          </dl>
        </section>
        <section className="workspace-study-section workspace-practice" aria-labelledby="lesson-practice">
          <h2 id="lesson-practice">动手练习</h2>
          <p>{expansion.practice.prompt}</p>
          <ul>{expansion.practice.checkpoints.map((item) => <li key={item}>{item}</li>)}</ul>
          {exercise?.prompt && <div className="workspace-code-task">
            <h3>编程练习</h3>
            <p>{exercise.prompt}</p>
            {exercise.language === 'javascript' && exercise.starter.startsWith('function solve(') && <p>下方的 <code>solve</code> 是待你完成的小函数。括号列出输入，<code>return</code> 把结果交回去，<code>console.log</code> 把它显示出来。</p>}
            {exercise.checkpoints && <ul>{exercise.checkpoints.map((item) => <li key={item}>{item}</li>)}</ul>}
          </div>}
          {exercise && <div className="workspace-practice-editor">
            {exercise.expectedOutput !== undefined && <p className="workspace-check-note">样例检查会对照给定输入的输出。通过后，可以自己换一组数据验证边界。</p>}
            <CodeWorkbench title="在这里写代码" language={exercise.language} starter={exercise.starter} stdin={exercise.stdin}
              draftKey={`${course.id}/${lesson.id}`} expectedOutput={exercise.expectedOutput} caseLabels={exercise.caseLabels}
              onVerificationChange={(passed) => { if (passed) onVerified() }}
              onPreviewRun={() => setPreviewed(true)}
              onNativeAvailabilityChange={setNativeAvailable}
              onAskAboutError={onAskAboutError} />
            {exercise.language === 'html' && exercise.expectedOutput === undefined && !verified && (
              <label className="workspace-option workspace-self-check">
                <input
                  type="checkbox"
                  disabled={!previewed}
                  checked={false}
                  onChange={(event) => { if (event.currentTarget.checked) onVerified() }}
                />
                <span>{previewed ? '我已在网页预览中核对本章全部验收点，记录本章编程练习已验证' : '请先点击上方「预览网页」检查页面效果，随后可勾选确认验收'}</span>
              </label>
            )}
            {isNativeLanguage(exercise.language) && !nativeAvailable && !verified && (
              <label className="workspace-option workspace-self-check">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={(event) => { if (event.currentTarget.checked) onVerified() }}
                />
                <span>未连接本地实验室服务：我已在本机编译器（GCC / JDK）按验收点跑通本章代码，记录编程练习已验证</span>
              </label>
            )}
            {verified && <p className="workspace-status" role="status">本章编程练习已验证</p>}
          </div>}
          {expansion.practice.hints?.map((hint, hintIndex) => <details key={hint}><summary>提示 {hintIndex + 1}</summary><p>{hint}</p></details>)}
          <details>
            <summary>查看参考解法</summary>
            <p>{expansion.practice.solution}</p>
            {expansion.practice.code && <CodeSample code={expansion.practice.code} language={expansion.practice.codeLanguage} />}
            {exercise?.solution && <>
              <p>编程练习参考代码</p>
              <CodeSample code={exercise.solution} language={languageLabels[exercise.language]} />
            </>}
          </details>
        </section>
      </>}
      <section className="workspace-quiz" aria-labelledby="quiz-heading">
        <h2 id="quiz-heading">章节练习</h2>
        <p>完成整门课程需要每章「章节测验全部答对」与「编程样例验收通过」双达标；结课项目与迁移练习单独记录。</p>
        {questions.map((question, questionIndex) => (
          <fieldset key={question.id}>
            <legend>{questionIndex + 1}. {question.prompt}</legend>
            <div>{question.choices.map((choice, choiceIndex) => {
              const selected = answers[question.id] === choiceIndex
              const feedback = submitted && selected ? (choiceIndex === question.answer ? ' workspace-option-correct' : ' workspace-option-wrong') : ''
              return <label key={choice} className={`workspace-option${selected ? ' workspace-option-selected' : ''}${feedback}`}>
                <input type="radio" name={question.id} checked={selected} onChange={() => { setAnswers({ ...answers, [question.id]: choiceIndex }); setSubmitted(false) }} />
                <span>{choice}</span>
              </label>
            })}</div>
            {submitted && answers[question.id] !== undefined && <p className="workspace-status">{answers[question.id] === question.answer ? '回答正确。' : '再想一想。'} {question.explanation}</p>}
          </fieldset>
        ))}
        {submitted && !answered && <p className="workspace-status" role="alert">请先回答全部题目。</p>}
        {submitted && answered && !correct && <p className="workspace-status" role="status">还有题目需要调整，修改答案后可以再次提交。</p>}
        {done && verified && <p className={`workspace-status workspace-complete${submitted && correct ? ' workspace-complete-enter' : ''}`} role="status"><Check size={16} aria-hidden="true" /> 本章已完成（测验与编程双达标）</p>}
        {done && !verified && <p className={`workspace-status workspace-partial${submitted && correct ? ' workspace-complete-enter' : ''}`} role="status"><Check size={16} aria-hidden="true" /> 本章测验已通过（还需完成编程样例验收）</p>}
        <button className="workspace-button workspace-primary" type="button" onClick={submit}>提交答案 <ArrowRight size={16} /></button>
      </section>
      {expansion?.wrapUp && <div className="workspace-copy">
        <section aria-labelledby="lesson-wrap-up">
          <h2 id="lesson-wrap-up">{expansion.wrapUp.heading}</h2>
          {expansion.wrapUp.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </section>
      </div>}
      <ChapterDiscussion courseId={course.id} lessonId={lesson.id} />
      <div className="workspace-actions">
        {previous ? <Link className="workspace-button" to={`/academy/${course.id}/lesson/${previous.id}`}><ArrowLeft size={16} /> 上一章</Link> : <Link className="workspace-button" to={`/academy/${course.id}`}><ArrowLeft size={16} /> 课程介绍</Link>}
        {next ? <Link className="workspace-button" to={`/academy/${course.id}/lesson/${next.id}`}>下一章 <ArrowRight size={16} /></Link> : <button className="workspace-button" type="button" onClick={() => navigate(`/academy/${course.id}`)}>返回课程 <ArrowRight size={16} /></button>}
        {!next && projectPath && <Link className="workspace-button workspace-primary" to={projectPath}>开始结课项目 <ArrowRight size={16} aria-hidden="true" /></Link>}
      </div>
    </article>
  )
}

type ProjectProps = {
  courseId: string
  project: CourseProject
  done: boolean
  saved: boolean
  onComplete: () => void
  transfer?: TransferExercise
  transferDone: boolean
  transferSaved: boolean
  onTransferComplete: () => void
  onAskAboutError?: (issue: CodeWorkbenchIssue, opener: HTMLElement) => void
}

function Project({ courseId, project, done, saved, onComplete, transfer, transferDone, transferSaved, onTransferComplete, onAskAboutError }: ProjectProps) {
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const ready = project.exercises.every((_, index) => checked[index])

  function verify(index: number, passed: boolean) {
    setChecked((current) => current[index] === passed ? current : { ...current, [index]: passed })
  }

  return (
    <article className="workspace-article workspace-project">
      <header className="workspace-lesson-head">
        <p className="workspace-eyebrow">结课项目</p>
        <h1 className="workspace-title">{project.title}</h1>
        <p className="workspace-lead">{project.summary}</p>
        {transfer && <a className="workspace-transfer-link" href="#project-transfer">做迁移练习 <ArrowRight size={15} aria-hidden="true" /></a>}
      </header>
      <div className="workspace-study-guide">
        <section aria-labelledby="project-requirements">
          <h2 id="project-requirements">项目要求</h2>
          <ul>{project.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>
      <section className="workspace-study-section" aria-labelledby="project-cases">
        <h2 id="project-cases">验收用例</h2>
        <div className="workspace-project-cases">
          {project.examples.map(({ label, input, expected }) => <section key={label}>
            <h3>{label}</h3>
            <dl><div><dt>输入</dt><dd>{input}</dd></div><div><dt>预期结果</dt><dd>{expected}</dd></div></dl>
          </section>)}
        </div>
      </section>
      <section className="workspace-study-section workspace-practice" aria-labelledby="project-practice">
        <h2 id="project-practice">动手完成项目</h2>
        <p>自动验收对照上面给定用例的输出。{!done && '核对所有部分后，可以记录项目完成。'}</p>
        {project.exercises.map(({ language, starter, stdin, expectedOutput, caseLabels, downloadName, title, prompt, checkpoints }, index) => (
          <div className="workspace-project-exercise" key={index}>
            {prompt && <p>{prompt}</p>}
            {checkpoints && <ul>{checkpoints.map((item) => <li key={item}>{item}</li>)}</ul>}
            <CodeWorkbench title={title ?? '在这里写代码'} language={language} starter={starter} stdin={stdin}
              draftKey={`${courseId}/project/${index + 1}`} expectedOutput={expectedOutput} caseLabels={caseLabels} downloadName={downloadName}
              onVerificationChange={(passed) => verify(index, passed)}
              onAskAboutError={onAskAboutError} />
            {expectedOutput === undefined && !done && <label className="workspace-option">
              <input type="checkbox" checked={Boolean(checked[index])} onChange={(event) => verify(index, event.currentTarget.checked)} />
              <span>我已按用例手动核对{title ? `「${title}」` : '这一部分'}。</span>
            </label>}
          </div>
        ))}
        <details>
          <summary>查看参考解法</summary>
          <p>{project.explanation}</p>
          {project.exercises.map(({ title, solution, language }, index) => <CodeSample key={index} code={solution} language={title ?? languageLabels[language]} />)}
        </details>
      </section>
      <div className="workspace-actions">
        <Link className="workspace-button" to={`/academy/${courseId}`}><ArrowLeft size={16} aria-hidden="true" /> 返回课程</Link>
        {done
          ? <p className="workspace-project-complete workspace-status" role="status"><Check size={16} aria-hidden="true" /> {saved ? '结课项目已完成' : '结课项目待保存'}</p>
          : <button className="workspace-button workspace-primary" type="button" disabled={!ready} onClick={onComplete}>记录项目完成 <Check size={16} aria-hidden="true" /></button>}
      </div>
      {transfer && <TransferPractice courseId={courseId} exercise={transfer} done={transferDone} saved={transferSaved} onComplete={onTransferComplete} onAskAboutError={onAskAboutError} />}
    </article>
  )
}

function TransferPractice({ courseId, exercise, done, saved, onComplete, onAskAboutError }: { courseId: string; exercise: TransferExercise; done: boolean; saved: boolean; onComplete: () => void; onAskAboutError?: (issue: CodeWorkbenchIssue, opener: HTMLElement) => void }) {
  const [opened, setOpened] = useState(false)

  return (
    <section className="workspace-study-section workspace-practice workspace-transfer" id="project-transfer" aria-labelledby="project-transfer-title">
      <h2 id="project-transfer-title">迁移练习</h2>
      <h3>{exercise.title}</h3>
      <p>{exercise.prompt}</p>
      <ul>{exercise.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
      {exercise.language !== 'html' && <p>{exercise.example}</p>}
      {done && <p className="workspace-status" role="status">{saved ? '迁移练习已记录' : '迁移练习待保存'}</p>}
      <details onToggle={(event) => { if (event.currentTarget.open) setOpened(true) }}>
        <summary>打开迁移编辑器</summary>
        {opened && (exercise.language === 'html'
          ? <ArtifactTransferEditor courseId={courseId} exercise={exercise} done={done} onComplete={onComplete} onAskAboutError={onAskAboutError} />
          : <ProgramTransferEditor courseId={courseId} exercise={exercise} onComplete={onComplete} onAskAboutError={onAskAboutError} />)}
      </details>
      {exercise.language !== 'html' && exercise.handoff && <details>
        <summary>继续练习：交付命令行工具</summary>
        <ol>{exercise.handoff.map((step) => <li key={step}>{step}</li>)}</ol>
      </details>}
    </section>
  )
}

function ProgramTransferEditor({ courseId, exercise, onComplete, onAskAboutError }: { courseId: string; exercise: Exclude<TransferExercise, { language: 'html' }>; onComplete: () => void; onAskAboutError?: (issue: CodeWorkbenchIssue, opener: HTMLElement) => void }) {
  const [check] = useState(() => exercise.createCheck())

  return (
    <>
      <p className="workspace-check-note">运行时，工作台会用多组输入调用你的函数。根据题目直接返回结果即可。用例包含变化数据，结果用于自我检查。</p>
      <CodeWorkbench title="迁移练习代码" language={exercise.language} starter={exercise.starter}
        draftKey={`${courseId}/transfer`} downloadName={exercise.downloadName} {...check}
        onVerificationChange={(passed) => { if (passed) onComplete() }}
        onAskAboutError={onAskAboutError} />
    </>
  )
}

function ArtifactTransferEditor({ courseId, exercise, done, onComplete, onAskAboutError }: { courseId: string; exercise: Extract<TransferExercise, { language: 'html' }>; done: boolean; onComplete: () => void; onAskAboutError?: (issue: CodeWorkbenchIssue, opener: HTMLElement) => void }) {
  const [confirmed, setConfirmed] = useState<number[]>([])

  return (
    <>
      <CodeWorkbench title="迁移练习代码" language="html" starter={exercise.starter}
        draftKey={`${courseId}/transfer`} downloadName={exercise.downloadName}
        onVerificationChange={() => setConfirmed((current) => current.length ? [] : current)}
        onAskAboutError={onAskAboutError} />
      {!done && <fieldset className="workspace-transfer-checklist">
        <legend>交付前自检</legend>
        {exercise.checklist.map((item, index) => <label key={item} className="workspace-option">
          <input type="checkbox" checked={confirmed.includes(index)} onChange={(event) => {
            const checked = event.currentTarget.checked
            setConfirmed((current) => checked ? [...current, index] : current.filter((value) => value !== index))
          }} />
          <span>{item}</span>
        </label>)}
        <button className="workspace-button workspace-primary" type="button" disabled={confirmed.length !== exercise.checklist.length}
          onClick={onComplete}>记录迁移练习完成</button>
      </fieldset>}
    </>
  )
}
