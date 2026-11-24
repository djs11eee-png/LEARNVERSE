import type { ChapterExercise } from '../../code/exercises'
import type { LearningDirection } from '../courseCatalog'
import type { LessonExpansion } from '../lessonExpansion'
import type { WorkspaceLesson } from '../workspaceCourses'

export interface CurriculumLesson extends Pick<WorkspaceLesson, 'id' | 'title' | 'summary' | 'demo'> {
  primer: { lead: string; terms: [string, string][] }
  expansion: LessonExpansion
  exercise: ChapterExercise
}

export interface CourseProject {
  title: string
  summary: string
  requirements: string[]
  examples: { label: string; input: string; expected: string }[]
  exercises: (ChapterExercise & { title?: string; solution: string; downloadName?: string })[]
  explanation: string
}

export interface CurriculumTrack {
  direction: Exclude<LearningDirection, 'python'>
  foundationProject: CourseProject
  advanced: { lessons: CurriculumLesson[]; project: CourseProject }
}

export interface AdvancedTrack {
  direction: LearningDirection
  lessons: CurriculumLesson[]
  project: CourseProject
}
