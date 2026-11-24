import { beginnerHints } from './beginnerHints'
import { conceptExpansions } from './concepts'
import { languageExpansions } from './languages'
import { pythonPracticeExpansions } from './pythonPractice'
import { webExpansions } from './web'
import { lessonWrapUps } from './wrapUps'
import type { LessonExpansion } from '../lessonExpansion'
import { getCurriculumLesson } from '../curriculum'

const expansions = { ...languageExpansions, ...webExpansions, ...conceptExpansions, ...pythonPracticeExpansions }

export function getLessonExpansion(courseId: string, lessonId: string): LessonExpansion | undefined {
  const base = expansions[courseId]?.[lessonId] ?? getCurriculumLesson(courseId, lessonId)?.expansion
  if (!base) return undefined

  const hints = base.practice.hints?.length ? undefined : beginnerHints[courseId]?.[lessonId]
  const wrapUp = base.wrapUp ?? lessonWrapUps[courseId]?.[lessonId]
  if (!hints && wrapUp === base.wrapUp) return base
  return {
    ...base,
    ...(hints ? { practice: { ...base.practice, hints } } : {}),
    ...(wrapUp ? { wrapUp } : {}),
  }
}
