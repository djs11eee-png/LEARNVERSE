import type { RunLanguage } from './runner'

const browserLimits = { code: 256_000, input: 256_000 }
const nativeLimits = { code: 32_000, input: 8_000 }
export const maxEditorLines = 12_000

export function workbenchInputLimits(language: RunLanguage) {
  return language === 'c' || language === 'java' ? nativeLimits : browserLimits
}

export function fitsEditorLimits(value: string, maxLength: number) {
  if (value.length > maxLength) return false
  let lines = 1
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '\n' || (value[index] === '\r' && value[index + 1] !== '\n')) lines++
    if (lines > maxEditorLines) return false
  }
  return true
}
