import type { ChapterExercise } from '../../../code/exercises'
import type { LessonQuestion, LessonSection } from '../../workspaceCourses'
import type { CurriculumLesson } from '../types'

type Language = 'c' | 'java' | 'javascript'
type AnsweredExercise = ChapterExercise & { solution: string; expectedOutput: string }
type LessonInput = Pick<CurriculumLesson, 'id' | 'title' | 'summary' | 'primer' | 'demo'> & {
  objectives: string[]
  sections: LessonSection[]
  pitfalls: CurriculumLesson['expansion']['pitfalls']
  practice: CurriculumLesson['expansion']['practice']
  questions: LessonQuestion[]
  wrapUp?: CurriculumLesson['expansion']['wrapUp']
  exercise: AnsweredExercise
}

const labels = { c: 'C', java: 'Java', javascript: 'JavaScript' } as const

export function step(heading: string, ...paragraphs: string[]): LessonSection {
  return { heading, paragraphs }
}

export function demo(language: Language, heading: string, paragraphs: string[], code: string, expectedOutput: string): LessonSection {
  return { heading, paragraphs, code, codeLanguage: labels[language], run: { language, expectedOutput } }
}

export function check(id: string, prompt: string, choices: string[], answer: number, explanation: string): LessonQuestion {
  return { id, prompt, choices, answer, explanation }
}

export function exercise(
  language: Language,
  starter: string,
  placeholder: string,
  completed: string,
  expectedOutput: string,
  caseLabels?: string[],
): AnsweredExercise {
  return { language, starter, solution: starter.replace(placeholder, () => completed), expectedOutput, caseLabels }
}

export function lesson({ objectives, sections, pitfalls, practice, questions, wrapUp, exercise, ...identity }: LessonInput): CurriculumLesson {
  return { ...identity, expansion: { objectives, sections, pitfalls, practice, questions, wrapUp }, exercise }
}

