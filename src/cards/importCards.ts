import { workspaceCourses } from '../data/workspaceCourses'
import { finishNames, galaxyNames } from './types'
import type { HoloCard } from './types'

const lessons = new Set(workspaceCourses.flatMap(course => course.lessons.map(lesson => course.id + '/' + lesson.id)))
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
function validQuiz(value: unknown) {
  return record(value) && nonempty(value.question) && nonempty(value.explanation)
    && Array.isArray(value.options) && value.options.length >= 2 && value.options.every(nonempty)
    && typeof value.answer === 'number' && Number.isInteger(value.answer)
    && value.answer >= 0 && value.answer < value.options.length
}

/** Local JSON modules use the same flat, serializable schema as the built-in collection. */
export function importCardSources(builtIn: HoloCard[], files: Record<string, unknown>): HoloCard[] {
  const result = [...builtIn]
  const ids = new Set(builtIn.map(card => card.id))
  const numbers = new Set(builtIn.map(card => card.number))
  for (const [file, content] of Object.entries(files)) {
    if (!Array.isArray(content)) throw new Error(file + ' 应包含知识卡片数组')
    for (const [index, card] of content.entries()) {
      if (!record(card) || !['title', 'subtitle', 'body', 'back', 'id', 'number', 'lessonId', 'courseId'].every(field => nonempty(card[field]))
        || !Object.hasOwn(galaxyNames, String(card.galaxy)) || !Object.hasOwn(finishNames, String(card.finish))
        || !lessons.has(card.courseId + '/' + card.lessonId)
        || ![1, 2, 3, 4, 5].includes(Number(card.slot)) || typeof card.slot !== 'number'
        || (card.slot === 5) !== (card.finish === 'gold')
        || (card.code !== undefined && !nonempty(card.code))
        || ((card.slot === 3 || card.slot === 4 || card.quiz !== undefined) && !validQuiz(card.quiz))) {
        throw new Error(file + ' 第 ' + (index + 1) + ' 张卡片的字段、章节或题目无效')
      }
      const parsed = card as unknown as HoloCard
      if (ids.has(parsed.id) || numbers.has(parsed.number)) throw new Error(file + ' 卡片编号重复：' + parsed.number)
      ids.add(parsed.id)
      numbers.add(parsed.number)
      result.push(parsed)
    }
  }
  return result
}
