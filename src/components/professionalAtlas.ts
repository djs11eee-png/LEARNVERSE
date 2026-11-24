import { computerSystemsCatalog, courseProgression, courseSummaries } from '../data/courseCatalog'
import type { CourseSummary, LearningDirection } from '../data/courseCatalog'
import { majorRoutes } from '../data/majorRoutes'
import type { MajorRoute } from '../data/majorRoutes'

export const skyBounds = { width: 4360, height: 2960 }
export const startingView = { x: 2110, y: 1480 }

type Placement = [x: number, y: number, surface: string, atmosphere: string, orbitTilt: number]
const sectors: Record<LearningDirection, [Placement, Placement, Placement]> = {
  python: [
    [2310, 1450, 'pelagic-rings', '#9ae4ff', -23],
    [2880, 1090, 'tidal-ice', '#abefff', 31],
    [3380, 640, 'hexagon-storm', '#f4ceaa', -12],
  ],
  javascript: [
    [1770, 1520, 'caldera', '#ffad79', 26],
    [1050, 1320, 'delta', '#a5eacb', -17],
    [550, 1040, 'aurora', '#ccafff', 55],
  ],
  computerScience: [
    [2020, 1720, 'mare', '#b7cce9', 14],
    [1400, 1980, 'rift', '#ffc391', -41],
    [780, 2220, 'shockwave', '#9cb9ff', 22],
  ],
  algorithms: [
    [1530, 1290, 'floes', '#b1f6e9', 38],
    [1120, 785, 'atoll', '#8be6da', -27],
    [420, 480, 'gold-seams', '#ffd587', 62],
  ],
  web: [
    [2610, 1600, 'hurricane', '#9ed4ff', -31],
    [3190, 1550, 'dunes', '#ffc0a4', 18],
    [3950, 1290, 'rose-rings', '#ffc5d9', -65],
  ],
  ai: [
    [2160, 1180, 'amethyst', '#deb8ff', 12],
    [1990, 730, 'serpentine', '#a4edb2', -36],
    [2220, 300, 'ice-giant', '#b5f8ff', 27],
  ],
  ros: [
    [2790, 2010, 'sulfur', '#ede19b', -15],
    [3090, 2470, 'alloy', '#abd0e8', 56],
    [3820, 2690, 'debris-belt', '#eac5a3', 21],
  ],
  c: [
    [1450, 2380, 'ejecta', '#d6d9dd', -33],
    [1920, 2540, 'garnet', '#ff9bad', 28],
    [2410, 2720, 'magma-plates', '#ffc176', -52],
  ],
  java: [
    [1560, 940, 'polar-mesa', '#f6bf91', 17],
    [1430, 520, 'glacier', '#cdc6ff', -43],
    [1010, 270, 'polar-vortex', '#efd59a', 37],
  ],
  backend: [
    [2330, 2110, 'terminator-sea', '#8de4dc', -28],
    [3340, 2020, 'strata', '#d6d8f4', 49],
    [3950, 1780, 'equinox', '#ffe4a8', -6],
  ],
}

const placements = new Map<string, Placement>((Object.keys(sectors) as LearningDirection[]).flatMap(direction =>
  courseProgression(direction).map(({ id }, stage) => [id, sectors[direction][stage]] as const)))
placements.set(computerSystemsCatalog.architecture.id, [330, 2700, 'silicon-terraces', '#b6ddf7', -21])
placements.set(computerSystemsCatalog.operatingSystems.id, [950, 2780, 'scheduler-bands', '#c4bcff', -21])
placements.set(computerSystemsCatalog.iotProtocols.id, [380, 1860, 'telemetry-rings', '#8de4d2', -24])

const stageByLevel: Record<CourseSummary['difficulty'], number> = { Beginner: 0, Intermediate: 1, Advanced: 2 }

export const planets = courseSummaries.map(course => {
  const placement = placements.get(course.id)
  if (!placement) throw new Error(`Missing atlas placement for ${course.id}`)
  const [x, y, surface, atmosphere, orbitTilt] = placement
  const stage = stageByLevel[course.difficulty]
  const sharedBy = majorRoutes.filter(route => route.courseIds.includes(course.id)).length
  // A widely shared foundation or an advanced synthesis course earns a larger globe.
  const importance = 68 + stage * 25 + 14 * Math.sqrt(sharedBy)
  return { ...course, x, y, surface, atmosphere, orbitTilt, importance, stage }
})
export type CoursePlanet = typeof planets[number]
export const planetById = new Map(planets.map(planet => [planet.id, planet]))

/** Dimensions are the solid globe's diameter, independent of rings and atmospheric shells. */
export function planetDiameter(planet: CoursePlanet, route?: MajorRoute) {
  if (!route) return planet.importance + (planet.surface === 'pelagic-rings' ? 52 : 0)
  const index = route.courseIds.indexOf(planet.id)
  if (index < 0) return planet.importance * .53
  if (index === route.courseIds.length - 1) return 236
  return Math.min(212, planet.importance + 12 + 32 * index / (route.courseIds.length - 1))
}
