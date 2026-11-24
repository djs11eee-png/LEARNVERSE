import type { LessonQuestion, LessonSection } from './workspaceCourses'

export interface LessonExpansion {
  objectives: string[]
  sections: LessonSection[]
  pitfalls: { mistake: string; why: string; fix: string }[]
  practice: {
    prompt: string
    checkpoints: string[]
    hints?: string[]
    solution: string
    code?: string
    codeLanguage?: string
  }
  questions: LessonQuestion[]
  wrapUp?: Pick<LessonSection, 'heading' | 'paragraphs'>
}

export type CourseExpansions = Record<string, Record<string, LessonExpansion>>
