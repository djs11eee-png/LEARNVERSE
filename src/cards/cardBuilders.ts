import type { Finish, HoloCard } from './types'

export type CardText = Pick<HoloCard, 'title' | 'subtitle' | 'body' | 'back' | 'code' | 'quiz' | 'slot'> & {
  finish?: Finish
}
export type Chapter = [lessonId: string, cards: CardText[]]

export function card(
  slot: HoloCard['slot'],
  title: string,
  subtitle: string,
  body: string,
  back: string,
  code?: string,
  finish?: Finish,
): CardText {
  return {
    slot,
    title,
    subtitle,
    body,
    back,
    ...(code === undefined ? {} : { code }),
    ...(finish === undefined ? {} : { finish }),
  }
}

export function quiz(
  title: string,
  subtitle: string,
  question: string,
  options: string[],
  answer: number,
  explanation: string,
  code?: string,
  finish?: Finish,
): CardText {
  return {
    ...card(3, title, subtitle, question, explanation, code, finish),
    quiz: { question, options, answer, explanation },
  }
}

export function bug(
  title: string,
  subtitle: string,
  question: string,
  options: string[],
  answer: number,
  explanation: string,
  code: string,
  finish?: Finish,
): CardText {
  return {
    ...quiz(title, subtitle, question, options, answer, explanation, code, finish),
    slot: 4,
  }
}
