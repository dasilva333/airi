import type { BeatSyncEnergyTier } from './types'

import {
  BEAT_SYNC_DANCE_BASE_BPM,
  MAX_BEAT_SYNC_DANCE_SPEED,
  MIN_BEAT_SYNC_DANCE_SPEED,
} from './settings'

export const BEAT_SYNC_ENERGY_TIERS: readonly BeatSyncEnergyTier[] = ['calm', 'medium', 'intense']

export type BeatSyncVrmClipTiers = Record<BeatSyncEnergyTier, string[]>

export const DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS: BeatSyncVrmClipTiers = {
  calm: ['armsSwing', 'ladylake', 'magicEyeWink', 'showcase'],
  medium: ['aiCatDance', 'armsUpDownDance', 'kawaiiKaiwai', 'tetris'],
  intense: ['blingBang', 'crabDance', 'hitoMania', 'humansAreJustCylinders'],
}

export const BUILTIN_BEAT_SYNC_DANCE_KEYS: readonly string[] = [
  ...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.calm,
  ...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.medium,
  ...DEFAULT_BEAT_SYNC_VRM_CLIP_TIERS.intense,
]

export function formatBeatSyncClipLabel(key: string): string {
  const raw = key.replace(/^custom-vrma:/, '')
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function beatSyncEnergyTierFromNormalized(energy: number): BeatSyncEnergyTier {
  if (energy < 0.33)
    return 'calm'
  if (energy < 0.67)
    return 'medium'
  return 'intense'
}

export function computeBeatSyncVrmDanceSpeed(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0)
    return 1
  return Math.min(MAX_BEAT_SYNC_DANCE_SPEED, Math.max(MIN_BEAT_SYNC_DANCE_SPEED, bpm / BEAT_SYNC_DANCE_BASE_BPM))
}

const FALLBACK_TIER_ORDER: Record<BeatSyncEnergyTier, readonly BeatSyncEnergyTier[]> = {
  calm: ['calm', 'medium', 'intense'],
  medium: ['medium', 'calm', 'intense'],
  intense: ['intense', 'medium', 'calm'],
}

export interface SelectBeatSyncVrmClipParams {
  tier: BeatSyncEnergyTier
  clipsByTier: BeatSyncVrmClipTiers
  currentClipKey?: string | null
  random?: () => number
}

export interface SelectBeatSyncVrmClipResult {
  clipKey: string | null
  resolvedTier: BeatSyncEnergyTier | null
}

export function selectBeatSyncVrmClipForEnergy(params: SelectBeatSyncVrmClipParams): SelectBeatSyncVrmClipResult {
  const { tier, clipsByTier, currentClipKey, random = Math.random } = params

  for (const candidateTier of FALLBACK_TIER_ORDER[tier]) {
    const pool = clipsByTier[candidateTier] ?? []
    if (pool.length === 0)
      continue

    const filtered = pool.length > 1 && currentClipKey
      ? pool.filter(key => key !== currentClipKey)
      : pool
    const choices = filtered.length > 0 ? filtered : pool
    const index = Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))
    return {
      clipKey: choices[index] ?? null,
      resolvedTier: candidateTier,
    }
  }

  return {
    clipKey: null,
    resolvedTier: null,
  }
}
