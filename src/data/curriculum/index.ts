import { advancedCourseCatalog, computerSystemsCatalog, courseCatalog, intermediateCourseCatalog } from '../courseCatalog'
import type { CourseSummary, LearningDirection } from '../courseCatalog'
import type { WorkspaceCourse } from '../workspaceCourses'
import { advancedLanguageTracks } from './advanced/languages'
import { advancedPythonTrack } from './advanced/python'
import { advancedSystemTracks } from './advanced/systems'
import { advancedWebTracks } from './advanced/web'
import { languageTracks } from './languages'
import { pythonPracticeProject, pythonProject } from './python'
import { architecture } from './computerArchitecture'
import { iotProtocols } from './iotProtocols'
import { operatingSystems } from './operatingSystems'
import { systemsTracks } from './systems'
import { webTracks } from './web'
import type { CourseProject, CurriculumLesson, CurriculumTrack } from './types'

export const courseProjects: Partial<Record<string, CourseProject>> = {
  [courseCatalog.python.id]: pythonProject,
  [courseCatalog.pythonPractice.id]: pythonPracticeProject,
}

const curriculumLessons = new Map<string, Map<string, CurriculumLesson>>()

function register(summary: CourseSummary, content: { lessons: CurriculumLesson[]; project: CourseProject }): WorkspaceCourse {
  courseProjects[summary.id] = content.project
  curriculumLessons.set(summary.id, new Map(content.lessons.map((lesson) => [lesson.id, lesson])))
  return {
    ...summary,
    lessons: content.lessons.map(({ id, title, summary, demo }) => ({ id, title, summary, demo, sections: [], questions: [] })),
  }
}

const intermediate = new Map([...languageTracks, ...systemsTracks, ...webTracks].map((track) => [track.direction, track]))
const advanced = new Map([advancedPythonTrack, ...advancedLanguageTracks, ...advancedSystemTracks, ...advancedWebTracks].map((track) => [track.direction, track]))

export const curriculumCourses: WorkspaceCourse[] = [
  ...Object.entries(intermediateCourseCatalog).map(([direction, summary]) => {
    const track = intermediate.get(direction as CurriculumTrack['direction'])
    if (!track) throw new Error(`Missing intermediate course content for ${summary.id}`)
    courseProjects[courseCatalog[track.direction].id] = track.foundationProject
    return register(summary, track.advanced)
  }),
  ...Object.entries(advancedCourseCatalog).map(([direction, summary]) => {
    const track = advanced.get(direction as LearningDirection)
    if (!track) throw new Error(`Missing advanced course content for ${summary.id}`)
    return register(summary, track)
  }),
  register(computerSystemsCatalog.architecture, architecture),
  register(computerSystemsCatalog.operatingSystems, operatingSystems),
  register(computerSystemsCatalog.iotProtocols, iotProtocols),
]

export function getCurriculumLesson(courseId: string, lessonId: string) {
  return curriculumLessons.get(courseId)?.get(lessonId)
}
