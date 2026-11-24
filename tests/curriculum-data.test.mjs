import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { createServer } from 'vite'

let vite

before(async () => {
  vite = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  })
})

after(async () => {
  await vite?.close()
})

test('every chapter across all levels exposes at least two distinct practice hints and no raw input() in prose code', async () => {
  const { workspaceCourses } = await vite.ssrLoadModule('/src/data/workspaceCourses.ts')
  const { getLessonExpansion } = await vite.ssrLoadModule('/src/data/expansions/index.ts')
  const { transferExercises } = await vite.ssrLoadModule('/src/data/curriculum/transfer.ts')
  const beginnerCourses = workspaceCourses.filter((course) => course.difficulty === 'Beginner')
  const intermediateCourses = workspaceCourses.filter((course) => course.difficulty === 'Intermediate')
  const advancedCourses = workspaceCourses.filter((course) => course.difficulty === 'Advanced')
  assert.equal(beginnerCourses.length, 10)
  assert.equal(intermediateCourses.length, 11)
  assert.equal(advancedCourses.length, 12)
  assert.equal(workspaceCourses.reduce((total, course) => total + course.lessons.length, 0), 132)
  assert.ok(Object.keys(transferExercises).length >= 9)

  const missingHints = workspaceCourses.flatMap((course) => course.lessons.flatMap((lesson) => {
    const hints = getLessonExpansion(course.id, lesson.id)?.practice.hints ?? []
    return new Set(hints.map((hint) => hint.trim()).filter(Boolean)).size < 2 ? [`${course.id}/${lesson.id}`] : []
  }))
  assert.deepEqual(missingHints, [])

  const missingWrapUps = [...beginnerCourses, ...intermediateCourses].flatMap((course) => course.lessons.flatMap((lesson) => {
    const wrapUp = getLessonExpansion(course.id, lesson.id)?.wrapUp
    return !wrapUp?.paragraphs?.length ? [`${course.id}/${lesson.id}`] : []
  }))
  assert.deepEqual(missingWrapUps, [])

  const rawInputInProse = workspaceCourses.flatMap((course) => course.lessons.flatMap((lesson) => {
    if (course.id === 'lv-python-foundations' && lesson.id === 'decisions') return []
    const sections = [...lesson.sections, ...(getLessonExpansion(course.id, lesson.id)?.sections ?? [])]
    return sections.some((section) => section.code && /\binput\s*\(/.test(section.code)) ? [`${course.id}/${lesson.id}`] : []
  }))
  assert.deepEqual(rawInputInProse, [])
})

test('computer systems courses have sequenced prerequisites, runnable lessons, projects and planets', async () => {
  const { workspaceCourses } = await vite.ssrLoadModule('/src/data/workspaceCourses.ts')
  const { courseSummaries, getRelatedCourses } = await vite.ssrLoadModule('/src/data/courseCatalog.ts')
  const { courseProjects, getCurriculumLesson } = await vite.ssrLoadModule('/src/data/curriculum/index.ts')
  const { majorRoutes } = await vite.ssrLoadModule('/src/data/majorRoutes.ts')
  const { planetById, planetDiameter, planets } = await vite.ssrLoadModule('/src/components/professionalAtlas.ts')
  const route = majorRoutes.find(({ id }) => id === 'major-080901')
  for (const [id, level, prerequisites] of [
    ['lv-computer-architecture', 'Intermediate', ['lv-javascript-foundations', 'lv-computer-science']],
    ['lv-operating-systems', 'Advanced', ['lv-computer-architecture']],
  ]) {
    const course = workspaceCourses.find((entry) => entry.id === id)
    assert.ok(course, `${id} should be available in the workspace`)
    assert.equal(courseSummaries.find((entry) => entry.id === id)?.difficulty, level)
    assert.equal(course.difficulty, level)
    assert.ok(route.courseIds.includes(id))
    assert.deepEqual(getRelatedCourses(id).filter(({ label }) => label === '先修课程').map(({ course }) => course.id), prerequisites)
    for (const prerequisite of prerequisites) {
      const index = route.courseIds.indexOf(prerequisite)
      assert.ok(index >= 0 && index < route.courseIds.indexOf(id))
    }
    assert.equal(course.lessons.length, 3)
    for (const { id: lessonId } of course.lessons) {
      const { expansion, exercise } = getCurriculumLesson(id, lessonId)
      assert.equal(expansion.sections.filter(({ run }) => run?.language === 'javascript').length, 2)
      assert.equal(expansion.questions.length, 4)
      assert.ok(expansion.wrapUp?.paragraphs.length, `${lessonId} should close with a recap`)
      assert.ok(exercise.starter && exercise.solution && exercise.expectedOutput)
    }
    assert.ok(courseProjects[id]?.examples.length >= 3)
    assert.equal(planets.filter((planet) => planet.id === id).length, 1)
  }
  assert.deepEqual(route.topics, [])
  assert.ok(route.milestoneCourseIds?.includes('lv-computer-architecture'), '080901 milestone must include lv-computer-architecture')
  const terminal = planetById.get('lv-operating-systems')
  assert.equal(route.courseIds.at(-1), terminal.id)
  assert.ok(planets.every((planet) => planet === terminal || planetDiameter(planet, route) < planetDiameter(terminal, route)))

  // Verify refactored Chinese freshman routes: IoT 080905, ECE 080909, Intelligent Science 080907, Data Science 080910
  const iot = majorRoutes.find(({ id }) => id === 'major-080905')
  assert.deepEqual(iot.courseIds, ['lv-c-foundations', 'lv-c-records', 'lv-computer-architecture', 'lv-iot-protocols'])
  assert.deepEqual(getRelatedCourses('lv-iot-protocols').filter(({ label }) => label === '先修课程').map(({ course }) => course.id), ['lv-c-records', 'lv-computer-architecture'])
  const ece = majorRoutes.find(({ id }) => id === 'major-080909')
  assert.ok(ece.courseIds.includes('lv-computer-architecture'))
  assert.ok(!ece.courseIds.includes('lv-javascript-foundations'), 'ECE route should not invert back to JS intro after C memory')
  const aiRoute = majorRoutes.find(({ id }) => id === 'major-080907')
  assert.equal(aiRoute.courseIds[0], 'lv-python-foundations')
  assert.ok(!aiRoute.courseIds.includes('lv-javascript-foundations'))
  const dsRoute = majorRoutes.find(({ id }) => id === 'major-080910')
  assert.equal(dsRoute.courseIds[0], 'lv-python-foundations')
  assert.ok(dsRoute.courseIds.includes('lv-backend-consistency'))
  assert.ok(!dsRoute.courseIds.includes('lv-javascript-foundations'), 'SQL in Data Science should not depend on JS')
})

test('computer systems examples and solutions produce the promised output', async () => {
  const { workspaceCourses } = await vite.ssrLoadModule('/src/data/workspaceCourses.ts')
  const { courseProjects, getCurriculumLesson } = await vite.ssrLoadModule('/src/data/curriculum/index.ts')
  function outputOf(code) {
    const lines = []
    runInNewContext(code, { console: { log: (...values) => lines.push(values.join(' ')) } }, { timeout: 1000 })
    return lines.join('\n')
  }
  for (const id of ['lv-computer-architecture', 'lv-operating-systems', 'lv-iot-protocols']) {
    const course = workspaceCourses.find((course) => course.id === id)
    for (const { id: lessonId } of course.lessons) {
      const { expansion, exercise } = getCurriculumLesson(id, lessonId)
      for (const { heading, code, run } of expansion.sections) {
        if (run) assert.equal(outputOf(code), run.expectedOutput, `${lessonId} / ${heading}`)
      }
      assert.notEqual(outputOf(exercise.starter), exercise.expectedOutput, `${lessonId} starter`)
      assert.equal(outputOf(exercise.solution), exercise.expectedOutput, `${lessonId} answer`)
    }
    const [project] = courseProjects[id].exercises
    assert.notEqual(outputOf(project.starter), project.expectedOutput, `${id} project starter`)
    assert.equal(outputOf(project.solution), project.expectedOutput, `${id} project answer`)
  }
  const [cpu] = courseProjects['lv-computer-architecture'].exercises
  assert.match(cpu.expectedOutput, /^操作数故障 PC=0 /mu)
  assert.match(cpu.expectedOutput, /^未知指令 PC=0 /mu)
  assert.equal(outputOf(cpu.solution + '\nconsole.log(simulate([["ADD", -1], ["HALT"]], [0, 0, 0, 0, 0, 0, 0, 0]));').split('\n').at(-1),
    '操作数故障 PC=0 ACC=0 RAM[1]=0 DISPLAY=')
  const [desk] = courseProjects['lv-operating-systems'].exercises
  assert.equal(outputOf(desk.solution + '\nconsole.log(runDesk([a, b], 1));').split('\n').at(-1), 'A | - | -')
})

test('the C sample ledger handles full text lines and continues after an oversized record', async (t) => {
  const gcc = spawnSync('gcc', ['--version'], { encoding: 'utf8' })
  if (gcc.error?.code === 'ENOENT') {
    t.skip('GCC is required for the native C curriculum check')
    return
  }
  assert.equal(gcc.status, 0, gcc.stderr)

  const { courseProjects } = await vite.ssrLoadModule('/src/data/curriculum/index.ts')
  const { solution, expectedOutput } = courseProjects['lv-c-records'].exercises[0]
  const record = (length) => `1${' '.repeat(length - 2)}0`
  const accepted = [62, 63, 64, 255].flatMap((length) =>
    ['', '\n', '\r\n'].map((ending) => `run_case(${JSON.stringify(record(length) + ending)}, 3, (LoadResult){1, 0, 0})`))
  const oversized = `run_case(${JSON.stringify(record(256) + '\n2 9')}, 3, (LoadResult){1, 1, 0})`
  const cases = [...accepted, oversized].join(' &&\n       ')
  const harness = solution.replace(/\}\s*$/u, `  return (${cases}) ? 0 : 1;\n}`)
  const work = mkdtempSync(join(tmpdir(), 'learnverse-curriculum-'))
  const executable = join(work, 'ledger.exe')
  try {
    const compilation = spawnSync('gcc', ['-std=c17', '-x', 'c', '-', '-o', executable], {
      cwd: work, input: harness,
      encoding: 'utf8',
      timeout: 15000,
    })
    assert.equal(compilation.status, 0, compilation.stderr)
    const run = spawnSync(executable, [], { cwd: work, encoding: 'utf8', timeout: 5000 })
    assert.equal(run.status, 0, run.stderr)
    assert.ok(run.stdout.replace(/\r\n/gu, '\n').startsWith(expectedOutput + '\n'))
    assert.match(run.stdout, /2:9 \| count=1 bad=1 full=0 average=9\.0/u)
  } finally {
    rmSync(executable, { force: true })
    rmdirSync(work)
  }
})

test('the C bitwise sensor-frame lesson and its examples compile cleanly and match expected output', async (t) => {
  const gcc = spawnSync('gcc', ['--version'], { encoding: 'utf8' })
  if (gcc.error?.code === 'ENOENT') {
    t.skip('GCC is required for the native C curriculum check')
    return
  }
  const { getCurriculumLesson } = await vite.ssrLoadModule('/src/data/curriculum/index.ts')
  const { expansion, exercise } = getCurriculumLesson('lv-c-records', 'bitwise-and-frames')
  const work = mkdtempSync(join(tmpdir(), 'learnverse-bitwise-'))
  try {
    const snippets = [
      ...expansion.sections.filter((s) => s.run).map((s, i) => ({
        name: `section-${i}`,
        code: s.code,
        stdin: s.run.stdin ?? '',
        expected: s.run.expectedOutput,
      })),
      {
        name: 'exercise-solution',
        code: exercise.solution,
        stdin: exercise.stdin ?? '',
        expected: exercise.expectedOutput,
      },
    ]
    for (const item of snippets) {
      const exe = join(work, `${item.name}.exe`)
      const comp = spawnSync('gcc', ['-std=c17', '-Wall', '-Wextra', '-x', 'c', '-', '-o', exe], {
        cwd: work, input: item.code, encoding: 'utf8', timeout: 15000,
      })
      assert.equal(comp.status, 0, `${item.name} compile failed: ${comp.stderr}`)
      const run = spawnSync(exe, [], { cwd: work, input: item.stdin, encoding: 'utf8', timeout: 5000 })
      assert.equal(run.status, 0, `${item.name} runtime failed: ${run.stderr}`)
      const actual = run.stdout.replace(/\r\n/gu, '\n').trim()
      if (item.expected !== undefined) {
        assert.equal(actual, item.expected.trim(), `${item.name} stdout mismatch`)
      } else {
        assert.ok(actual.length > 0, `${item.name} should print output`)
      }
      rmSync(exe, { force: true })
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})

test('Chinese diagnostic hints cover common C, Java, SQL, JavaScript and Python beginner errors', async () => {
  const { diagnosticHint } = await vite.ssrLoadModule('/src/code/diagnostics.ts')
  const samples = [
    ['运行超过 5 秒，已停止。请检查循环或减少计算量。', /死循环/],
    ['RangeError: Maximum call stack size exceeded', /递归/],
    ["TypeError: Cannot read properties of undefined (reading 'name')", /null 或 undefined/],
    ['java.lang.NullPointerException: Cannot invoke "String.length()"', /空指针/],
    ['java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 5', /越界/],
    ['IndexError: list index out of range', /越界/],
    ['SQLITE_ERROR: no such table: students', /找不到这张表/],
    ['SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email', /唯一约束/],
    ['SQLITE_ERROR: ambiguous column name: id', /同名列/],
    ["warning: format '%d' expects argument of type 'int *', but argument 2 has type 'int'", /scanf|格式占位符/],
    ['Segmentation fault (core dumped)', /内存访问异常/],
    ['TypeError: Assignment to constant variable.', /const/],
    ['KeyError: "score"', /字典/],
  ]
  for (const [message, expected] of samples) {
    assert.match(diagnosticHint(message), expected, message)
  }
})
