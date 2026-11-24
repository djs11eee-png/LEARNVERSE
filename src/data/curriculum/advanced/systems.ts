import type { AdvancedTrack } from '../types'
import { advancedAI } from './systemsAI'
import { advancedBackend } from './systemsBackend'
import { advancedRos } from './systemsRos'

export const advancedSystemTracks: AdvancedTrack[] = [advancedBackend, advancedAI, advancedRos]
