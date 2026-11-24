import type { CurriculumLesson, CourseProject } from '../types'
import type { LessonSection } from '../../workspaceCourses'

export type StudyCase = { label: string; input: unknown[]; expected: unknown }
type Quiz = [prompt: string, choices: string[], answer: number, explanation: string]
type Expansion = CurriculumLesson['expansion']

export function lesson(spec: {
  id: string
  title: string
  summary: string
  demo?: CurriculumLesson['demo']
  primer: CurriculumLesson['primer']
  objectives: string[]
  sections: LessonSection[]
  pitfalls: Expansion['pitfalls']
  practice: Expansion['practice']
  quiz: Quiz[]
  exercise: CurriculumLesson['exercise']
}): CurriculumLesson {
  const { id, title, summary, demo, primer, objectives, sections, pitfalls, practice, quiz, exercise } = spec
  const questions = quiz.map(([prompt, choices, answer, explanation], index) => ({
    id: id + '-' + (index + 1), prompt, choices, answer, explanation,
  }))
  return { id, title, summary, demo, primer, expansion: { objectives, sections, pitfalls, practice, questions }, exercise }
}

export function run(heading: string, paragraphs: string[], code: string, expectedOutput: string, starter?: string): LessonSection {
  return { heading, paragraphs, code, codeLanguage: 'JavaScript', run: { language: 'javascript', expectedOutput, starter } }
}

export function html(heading: string, paragraphs: string[], code: string, downloadName: string, starter?: string): LessonSection {
  return { heading, paragraphs, code, codeLanguage: 'HTML', run: { language: 'html', downloadName, starter } }
}

export function page(title: string, body: string, script: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font: 1rem/1.6 system-ui, sans-serif; margin: 0; }
    main { max-width: 40rem; margin: 0 auto; padding: 1.25rem; }
    button, select { font: inherit; max-width: 100%; margin: .25rem; }
    :focus-visible { outline: 3px solid #3159aa; outline-offset: 2px; }
    dialog { max-width: calc(100% - 3rem); }
    dialog::backdrop { background: rgb(0 0 0 / .4); }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
${body}
  </main>
  <script>
${script}
  </script>
</body>
</html>`
}

export function checked(starter: string, solution: string, cases: StudyCase[], asynchronous = false) {
  const inputs = cases.map(({ label, input }) => ({ label, input }))
  const statement = `    const actual = ${asynchronous ? 'await ' : ''}solve(...test.input);`
  const harness = '\n\nconst cases = ' + JSON.stringify(inputs, null, 2) + ';\n' + [
    ...(asynchronous ? ['(async () => {'] : []),
    '  for (const test of cases) {',
    statement,
    '    console.log(test.label + "：" + JSON.stringify(actual));',
    '  }',
    ...(asynchronous ? ['})()'] : []),
  ].join('\n')
  return {
    language: 'javascript' as const,
    starter: starter + harness,
    solution: solution + harness,
    expectedOutput: cases.map(({ label, expected }) => label + '：' + JSON.stringify(expected)).join('\n'),
    caseLabels: cases.map(({ label }) => label),
  }
}

export function examples(cases: StudyCase[]): CourseProject['examples'] {
  return cases.map(({ label, input, expected }) => ({
    label, input: input.map(value => JSON.stringify(value)).join('，'), expected: JSON.stringify(expected),
  }))
}
