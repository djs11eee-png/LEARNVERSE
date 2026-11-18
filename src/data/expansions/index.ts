import { conceptExpansions } from './concepts'
import { languageExpansions } from './languages'
import { pythonPracticeExpansions } from './pythonPractice'
import { webExpansions } from './web'
import type { LessonExpansion } from '../lessonExpansion'

const expansions = { ...languageExpansions, ...webExpansions, ...conceptExpansions, ...pythonPracticeExpansions }

export function getLessonExpansion(courseId: string, lessonId: string): LessonExpansion | undefined {
  return expansions[courseId]?.[lessonId]
}
