import type { CurriculumLesson, CourseProject } from '../types'
import type { LessonSection } from '../../workspaceCourses'

type Question = [prompt: string, choices: string[], answer: number, explanation: string]
type Pitfall = [mistake: string, why: string, fix: string]
type Program = CourseProject['exercises'][number]
type Result = [label: string, expected: string]

type LessonInput = Omit<CurriculumLesson, 'expansion' | 'exercise'> & {
  objectives: string[]
  sections: LessonSection[]
  pitfalls: Pitfall[]
  questions: Question[]
  practice: CurriculumLesson['expansion']['practice']
  exercise: Program
}

export function lesson({ id, title, summary, primer, objectives, sections, pitfalls, questions, practice, exercise }: LessonInput): CurriculumLesson {
  return {
    id,
    title,
    summary,
    primer,
    expansion: {
      objectives,
      sections,
      pitfalls: pitfalls.map(([mistake, why, fix]) => ({ mistake, why, fix })),
      practice,
      questions: questions.map(([prompt, choices, answer, explanation], index) => ({
        id: `${id}-${index + 1}`, prompt, choices, answer, explanation,
      })),
    },
    exercise,
  }
}

export function worked(heading: string, paragraphs: string[], code: string, expectedOutput: string, language: 'javascript' | 'sql' = 'javascript'): LessonSection {
  return {
    heading,
    paragraphs,
    code,
    codeLanguage: language === 'sql' ? 'SQLite · 独立运行' : 'JavaScript · 独立运行',
    run: { language, expectedOutput },
  }
}

export function jsProgram(title: string, signature: string, starter: string, solution: string, harness: string, cases: Result[]): Program {
  function frame(implementation: string) {
    return `function ${signature} {\n${implementation}\n}\n\n${harness}\n`
  }
  return {
    title,
    language: 'javascript',
    starter: frame(starter),
    solution: frame(solution),
    expectedOutput: cases.map(([, expected]) => expected).join('\n'),
    caseLabels: cases.map(([label]) => label),
  }
}

export function sqlProgram(title: string, fixture: string, starter: string, solution: string, expectedOutput: string): Program {
  return {
    title,
    language: 'sql',
    starter: fixture + '\n\n' + starter,
    solution: fixture + '\n\n' + solution,
    expectedOutput,
  }
}
