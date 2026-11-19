import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Clipboard, List } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { workspaceCourses } from '../data/workspaceCourses'
import type { WorkspaceCourse, WorkspaceLesson } from '../data/workspaceCourses'
import { getLessonExpansion } from '../data/expansions'
import { corePrimers } from '../data/primers/core'
import { nativePrimers } from '../data/primers/native'
import { getChapterExercise } from '../code/exercises'
import { CodeWorkbench } from '../components/CodeWorkbench'
import { useProgress } from '../state/progress'
import { earnLesson } from '../cards/rewards'
import { usePackStation } from '../cards/usePackStation'
import { WorkspaceDemo } from './WorkspaceDemo'
import './workspace.css'

type LessonRecord = { completed: string[]; lastLesson: string }
const storagePrefix = 'learnverse.workspace.v1.'
const initialRecord: LessonRecord = { completed: [], lastLesson: '' }

function readRecord(course: WorkspaceCourse): LessonRecord {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storagePrefix + course.id) ?? 'null')
    if (!value || typeof value !== 'object') return initialRecord
    const record = value as Partial<LessonRecord>
    const valid = new Set(course.lessons.map((lesson) => lesson.id))
    return {
      completed: Array.isArray(record.completed) ? [...new Set(record.completed.filter((id): id is string => typeof id === 'string' && valid.has(id)))] : [],
      lastLesson: typeof record.lastLesson === 'string' && valid.has(record.lastLesson) ? record.lastLesson : '',
    }
  } catch {
    return initialRecord
  }
}

function useLessonRecord(course: WorkspaceCourse) {
  const [record, setRecord] = useState(() => readRecord(course))
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    setRecord(readRecord(course))
    function sync(event: StorageEvent) {
      if (event.key === storagePrefix + course.id || event.key === null) setRecord(readRecord(course))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [course])

  const update = useCallback((change: (previous: LessonRecord) => LessonRecord) => {
    function commit() {
      const previous = readRecord(course)
      const next = change(previous)
      try {
        localStorage.setItem(storagePrefix + course.id, JSON.stringify(next))
        setRecord(next)
        setStorageError(false)
      } catch {
        setRecord((current) => change(current))
        setStorageError(true)
      }
    }
    if (navigator.locks) void navigator.locks.request(storagePrefix + course.id, commit).catch(commit)
    else commit()
  }, [course])

  return { record, update, storageError }
}

export function Workspace() {
  const { courseId, lessonId } = useParams()
  const course = workspaceCourses.find((item) => item.id === courseId)
  if (!course) {
    return <div className="workspace"><div className="workspace-empty"><h1>没有找到这门站内课程</h1><Link className="workspace-button" to="/academy">返回学习学院</Link></div></div>
  }
  return <CourseWorkspace key={course.id} course={course} lessonId={lessonId} />
}

function CourseWorkspace({ course, lessonId }: { course: WorkspaceCourse; lessonId?: string }) {
  const station = usePackStation()
  const { record, update, storageError } = useLessonRecord(course)
  const [chaptersOpen, setChaptersOpen] = useState(false)
  const { startCourse, completeCourse } = useProgress()
  const lesson = course.lessons.find((item) => item.id === lessonId)

  useEffect(() => {
    startCourse(course.id)
    // Course entry is tracked once per mount, not on every chapter navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id])

  useEffect(() => {
    if (!lesson) return
    update((previous) => ({ ...previous, lastLesson: lesson.id }))
  }, [lesson, update])

  useEffect(() => {
    if (course.lessons.every((item) => record.completed.includes(item.id))) completeCourse(course.id)
    // Completion is idempotent and only depends on recorded chapter completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, record.completed])

  if (!lessonId) {
    const nextLesson = record.lastLesson || course.lessons.find((item) => !record.completed.includes(item.id))?.id || course.lessons[0].id
    return <Navigate replace to={`/academy/${course.id}/lesson/${nextLesson}`} />
  }
  if (!lesson) {
    return <div className="workspace"><div className="workspace-empty"><h1>没有找到这个章节</h1><Link className="workspace-button" to={`/academy/${course.id}/learn`}>继续学习</Link></div></div>
  }

  const index = course.lessons.indexOf(lesson)
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
          <p>已完成 {record.completed.length} / {course.lessons.length} 章</p>
          <div className="workspace-progress" role="progressbar" aria-label="课程进度" aria-valuemin={0} aria-valuemax={course.lessons.length} aria-valuenow={record.completed.length}><span style={{ width: `${record.completed.length / course.lessons.length * 100}%` }} /></div>
          <ol id="course-chapters" data-open={chaptersOpen}>{course.lessons.map((item, lessonIndex) => (
            <li key={item.id}><Link className={`workspace-chapter${item.id === lesson.id ? ' workspace-chapter-active' : ''}${record.completed.includes(item.id) ? ' workspace-chapter-done' : ''}`} aria-current={item.id === lesson.id ? 'step' : undefined} onClick={() => setChaptersOpen(false)} to={`/academy/${course.id}/lesson/${item.id}`}>
              <span className="workspace-chapter-index">{String(lessonIndex + 1).padStart(2, '0')}</span><span>{item.title}</span>{record.completed.includes(item.id) && <Check size={14} aria-label="已完成" />}
            </Link></li>
          ))}</ol>
        </aside>
        <div className="workspace-main">
          {storageError && <p className="workspace-status" role="alert">本次学习进度无法保存到浏览器，请检查浏览器存储设置。</p>}
          <Lesson key={lesson.id} course={course} lesson={lesson} index={index} done={record.completed.includes(lesson.id)} onComplete={() => {
            update((previous) => ({ ...previous, completed: [...new Set([...previous.completed, lesson.id])], lastLesson: lesson.id }))
            const key = earnLesson(course.id, lesson.id)
            if (!record.completed.includes(lesson.id)) station.showPack(key)
          }} />
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

function Lesson({ course, lesson, index, done, onComplete }: { course: WorkspaceCourse; lesson: WorkspaceLesson; index: number; done: boolean; onComplete: () => void }) {
  const navigate = useNavigate()
  const expansion = getLessonExpansion(course.id, lesson.id)
  const primer = (corePrimers[course.id] ?? nativePrimers[course.id])?.[lesson.id]
  const exercise = getChapterExercise(course.id, lesson.id, expansion?.practice)
  const sections = [...lesson.sections, ...(expansion?.sections ?? [])]
  const questions = [...lesson.questions, ...(expansion?.questions ?? [])]
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)
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
      </header>
      {expansion && <details className="workspace-outline">
        <summary>本章目录</summary>
        <nav aria-label="本章目录">
          <ol>
            {primer && <li><a href="#lesson-primer">先认识本章用到的词和写法</a></li>}
            {sections.map((section, sectionIndex) => <li key={sectionIndex}><a href={`#lesson-section-${sectionIndex + 1}`}>{section.heading}</a></li>)}
            <li><a href="#lesson-pitfalls">常见易错点</a></li>
            <li><a href="#lesson-practice">动手练习</a></li>
            <li><a href="#quiz-heading">章节练习</a></li>
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
            <p>下方的 <code>solve</code> 是待你完成的小函数。括号列出输入，<code>return</code> 把结果交回去，<code>console.log</code> 把它显示出来。</p>
            {exercise.checkpoints && <ul>{exercise.checkpoints.map((item) => <li key={item}>{item}</li>)}</ul>}
          </div>}
          {exercise && <div className="workspace-practice-editor">
            <CodeWorkbench title="在这里写代码" language={exercise.language} starter={exercise.starter} stdin={exercise.stdin}
              draftKey={`${course.id}/${lesson.id}`} expectedOutput={exercise.expectedOutput} />
          </div>}
          <details>
            <summary>查看参考解法</summary>
            <p>{expansion.practice.solution}</p>
            {expansion.practice.code && <CodeSample code={expansion.practice.code} language={expansion.practice.codeLanguage} />}
            {exercise?.solution && <>
              <p>编程练习参考代码</p>
              <CodeSample code={exercise.solution} language="JavaScript" />
            </>}
          </details>
        </section>
      </>}
      <section className="workspace-quiz" aria-labelledby="quiz-heading">
        <h2 id="quiz-heading">章节练习</h2>
        <p>完成本章的全部题目，答对后即可记录进度。</p>
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
        {done && <p className={`workspace-status workspace-complete${submitted && correct ? ' workspace-complete-enter' : ''}`} role="status"><Check size={16} aria-hidden="true" /> 本章已完成</p>}
        <button className="workspace-button workspace-primary" type="button" onClick={submit}>提交答案 <ArrowRight size={16} /></button>
      </section>
      <div className="workspace-actions">
        {previous ? <Link className="workspace-button" to={`/academy/${course.id}/lesson/${previous.id}`}><ArrowLeft size={16} /> 上一章</Link> : <Link className="workspace-button" to={`/academy/${course.id}`}><ArrowLeft size={16} /> 课程介绍</Link>}
        {next ? <Link className="workspace-button" to={`/academy/${course.id}/lesson/${next.id}`}>下一章 <ArrowRight size={16} /></Link> : <button className="workspace-button" type="button" onClick={() => navigate(`/academy/${course.id}`)}>返回课程 <ArrowRight size={16} /></button>}
      </div>
    </article>
  )
}
