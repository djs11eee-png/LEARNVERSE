import type { RunLanguage } from '../../code/runner'

export type GateReason = 'sync_cards' | 'sync_progress' | 'assistant'
export type AuthMode = 'login' | 'register'
export type AuthField = 'identifier' | 'password' | 'captcha_code' | 'recovery_email'

export interface CaptchaChallenge {
  captcha_id: string
  image_url: string
  expires_in: number
  audio_url?: string
}

export interface AuthRequest {
  identifier: string
  password: string
  captcha_id: string
  captcha_code: string
  recovery_email?: string
}

export type AuthResult = { ok: true; user: { id: string; display_name: string } } | {
  ok: false
  error: { code: string; message: string; field?: AuthField }
}

export interface AuthAdapter {
  getChallenge: (signal: AbortSignal) => Promise<CaptchaChallenge>
  submit: (mode: AuthMode, body: AuthRequest, signal: AbortSignal) => Promise<AuthResult>
  playChallenge?: (challenge: CaptchaChallenge) => void
  stopChallenge?: () => void
}

export interface CodeReference {
  id: string
  language: RunLanguage
  source: string
  start_line: number
  truncated: boolean
}

export interface ErrorContext {
  message: string
  line?: number
  column?: number
  reference?: CodeReference
}

export interface Diagnosis {
  id: string
  reference_id?: string
  line?: number
  column?: number
  title: string
  explanation: string
  hints: string[]
}

export interface AssistantRequest {
  v: 1
  request_id: string
  conversation_id?: string
  question: string
  context?: ErrorContext
}

interface EventBase { v: 1; request_id: string; seq: number }

export type AssistantEvent = EventBase & (
  | { type: 'response.started'; conversation_id: string }
  | { type: 'text.delta'; delta: string }
  | { type: 'code.reference'; reference: CodeReference }
  | { type: 'diagnostic.card'; diagnosis: Diagnosis }
  | { type: 'response.done' }
  | { type: 'response.error'; error: { code: string; message: string; retryable: boolean } }
)

export type AssistantTransport = (request: AssistantRequest, signal: AbortSignal) => AsyncIterable<AssistantEvent>
export type PetAnimationState = 'idle' | 'thinking' | 'success'
export type PetMood = 'idle' | 'thinking' | 'success' | 'alert' | 'celebrating'

export const ASSISTANT_NAME = 'Vesper'
