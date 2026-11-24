import type { Diagnostic, RunResult } from './runner'

export const maxBrowserOutput = 24_000
const maxNativeOutput = 26_000
const maxMessageLength = 4_000
export const maxRunnerDiagnostics = 32
export const maxRunnerOutputMessages = 300

type RunnerMessage =
  | { kind: 'ready' | 'done' }
  | { kind: 'output'; text: string }
  | { kind: 'diagnostic'; diagnostic: Diagnostic }
  | { kind: 'failure'; message: string }

export function isRunnerRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isBoundedText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length <= limit
}

function isPosition(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
}

function parseDiagnostic(value: unknown): Diagnostic | undefined {
  if (!isRunnerRecord(value)) return undefined
  const { severity, message, line, column } = value
  if ((severity !== 'warning' && severity !== 'error') || !isBoundedText(message, maxMessageLength)
    || !isPosition(line) || !isPosition(column)) return undefined
  return { severity, message, ...(line === undefined ? {} : { line }), ...(column === undefined ? {} : { column }) }
}

export function parseRunnerMessage(value: unknown): RunnerMessage | undefined {
  if (!isRunnerRecord(value)) return undefined
  const { kind } = value
  switch (kind) {
    case 'ready':
    case 'done':
      return { kind }
    case 'output':
      return isBoundedText(value.text, maxBrowserOutput) ? { kind, text: value.text } : undefined
    case 'diagnostic': {
      const diagnostic = parseDiagnostic(value.diagnostic)
      return diagnostic && { kind, diagnostic }
    }
    case 'failure':
      return isBoundedText(value.message, maxMessageLength) ? { kind, message: value.message } : undefined
  }
}

export function parseNativeResult(value: unknown): RunResult | undefined {
  if (!isRunnerRecord(value)) return undefined
  const { output, diagnostics } = value
  if (!isBoundedText(output, maxNativeOutput) || !Array.isArray(diagnostics) || diagnostics.length > maxRunnerDiagnostics) return undefined
  const validated: Diagnostic[] = []
  for (const item of diagnostics) {
    const diagnostic = parseDiagnostic(item)
    if (!diagnostic) return undefined
    validated.push(diagnostic)
  }
  return { output, diagnostics: validated }
}
