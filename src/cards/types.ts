export type Galaxy = 'python' | 'c' | 'algorithms'
export type Finish = 'standard' | 'reverse' | 'cosmos' | 'crosshatch' | 'rainbow' | 'gold'
export interface HoloCard {
  id: string
  title: string
  subtitle: string
  body: string
  code?: string
  back: string
  quiz?: { question: string; options: string[]; answer: number; explanation: string }
  finish: Finish
  slot: 1 | 2 | 3 | 4 | 5
  courseId: string
  lessonId: string
  galaxy: Galaxy
  number: string
}

export const galaxyNames: Record<Galaxy, string> = { python: 'Python', c: 'C 语言', algorithms: '算法与 AI' }
export const finishNames: Record<Finish, string> = {
  standard: '哑光星尘', reverse: '逆向拉丝', cosmos: '宇宙星云',
  crosshatch: '十字激光', rainbow: '彩虹棱镜', gold: '黑金浮雕',
}
export const slotNames = ['概念', '概念', '代码阅读', 'Bug 猎人', '黄金速查']
