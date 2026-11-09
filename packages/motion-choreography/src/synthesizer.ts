/**
 * Generative Dance Brief synthesizer ("The Identifier").
 * Combines low-level acoustic signal features, track metadata,
 * and companion persona modalities into an actionable DanceBrief
 * optimized for FlowMDM text-to-motion diffusion and Motion Bricks alignment.
 */

import type {
  AcousticFeatures,
  DanceBrief,
  EnergyTier,
  PersonaArchetype,
  PersonaDanceModality,
  RhythmStructure,
  TimbreBrightness,
  TrackMetadata,
} from './types.js'

/**
 * Base kinematic descriptions for each persona archetype,
 * tuned for the HumanML3D / FlowMDM text diffusion semantic space.
 */
const PERSONA_BASE_KINEMATICS: Record<PersonaArchetype, string> = {
  none: '',
  idol: 'cheerful idol stage dance, bouncy rhythmic footwork, lively arm sweeps, radiant expressive presence',
  gothic_maid: 'composed aristocratic gothic dance, graceful slow turns, poised hand gestures, noble posture',
  cool_android: 'sharp mechanical popping and locking, precise body isolation, crisp robotic transitions, fluid geometry',
  chill_gamer: 'relaxed rhythmic swaying, effortless head bopping, casual groove, low-key step touches',
  chaotic_gremlin: 'hyperactive erratic hopping, comical rapid arm gestures, unpredictable bouncy footwork, playful energy',
  custom: 'expressive dynamic dancing, coordinated rhythmic footwork, fluid upper body motion',
}

/**
 * Energy-tier motion modifiers.
 */
const ENERGY_KINEMATICS: Record<EnergyTier, string> = {
  explosive: 'vigorous high-energy steps, expansive aerial leaps, powerful momentum and full body extensions',
  high: 'spirited bouncing, crisp arm accents, brisk continuous groove, lively step changes',
  moderate: 'controlled rhythmic steps, steady hip sway, smooth motion flow, measured arm cadence',
  low: 'subtle weight shifts, gentle undulating body sway, relaxed minimal motion',
}

/**
 * Rhythmic structure kinematic modifiers.
 */
const RHYTHMIC_KINEMATICS: Record<RhythmStructure, string> = {
  four_on_the_floor: 'pumping march steps on the beat, synchronized rhythmic pulse',
  waltz_triple: 'sweeping gliding turns in 3/4 triple meter, buoyant rise and fall',
  fast_breakbeat: 'rapid agile footwork, snappy directional cuts, high-cadence kinetic agility',
  syncopated: 'rhythmic body rolls, syncopated step touches, off-beat funky groove',
  ambient_free: 'freeform drifting posture, floating arms, ambient undulation',
}

/**
 * Derives musical genre purely from acoustic parameters (zero cheating / no metadata hints).
 */
function resolveGenre(
  rhythm: RhythmStructure,
  bpm: number,
  timbre: TimbreBrightness,
): string {
  switch (rhythm) {
    case 'waltz_triple':
      return 'Classical Waltz / Triple Meter Ballad'
    case 'fast_breakbeat':
      return bpm >= 165 ? 'Drum & Bass / Neurofunk' : 'Jungle / Fast Breakbeat'
    case 'ambient_free':
      return 'Ambient Soundscape / Downtempo'
    case 'syncopated':
      return bpm <= 110 ? 'Funk / Hip-Hop / Ragtime' : 'Syncopated Future Bass / Pop'
    case 'four_on_the_floor':
    default:
      if (bpm >= 120 && timbre === 'bright') {
        return 'Electro House / EDM'
      }
      if (bpm >= 118) {
        return 'House / Dance Pop'
      }
      return 'Nu-Disco / Mid-Tempo Groove'
  }
}

/**
 * Derives mood descriptor from acoustic attributes.
 */
function resolveMood(energy: EnergyTier, timbre: TimbreBrightness): string {
  const energyKeywords: Record<EnergyTier, string> = {
    explosive: 'electrifying, euphoric, high-impact',
    high: 'upbeat, vibrant, dynamic',
    moderate: 'steady, warm, rhythmic',
    low: 'introspective, serene, gentle',
  }

  const timbreKeywords: Record<TimbreBrightness, string> = {
    bright: 'sparkling and radiant',
    balanced: 'harmonized and organic',
    warm: 'rich, acoustic warmth',
    dark: 'deep and grounded',
  }

  return `${energyKeywords[energy]}, ${timbreKeywords[timbre]}`
}

/**
 * Synthesizes a human-readable rhythm descriptor.
 */
function resolveRhythmDescriptor(rhythm: RhythmStructure, bpm: number): string {
  switch (rhythm) {
    case 'four_on_the_floor':
      return `Driving 4/4 pulse at ${bpm} BPM with strong regular downbeats`
    case 'waltz_triple':
      return `Swaying 3/4 triple meter at ${bpm} BPM with graceful waltz lilt`
    case 'fast_breakbeat':
      return `High-velocity broken beat at ${bpm} BPM with rapid syncopated transients`
    case 'syncopated':
      return `Off-beat groove at ${bpm} BPM with playful rhythmic displacement`
    case 'ambient_free':
    default:
      return `Freeform atmospheric cadence at ~${bpm} BPM with relaxed pulse`
  }
}

/**
 * Synthesizes the structured DanceBrief from acoustic features,
 * track metadata, and persona characteristics.
 */
export function synthesizeDanceBrief(
  features: AcousticFeatures,
  metadata?: TrackMetadata,
  persona?: PersonaDanceModality,
): DanceBrief {
  const archetype = persona?.archetype ?? 'idol'
  const effectiveBpm = metadata?.bpmHint && metadata.bpmHint > 0
    ? metadata.bpmHint
    : features.bpm

  const detectedGenre = resolveGenre(
    features.rhythmStructure,
    effectiveBpm,
    features.timbreBrightness,
  )

  const mood = resolveMood(features.energyTier, features.timbreBrightness)
  const rhythmDescriptor = resolveRhythmDescriptor(features.rhythmStructure, effectiveBpm)

  // Construct FlowMDM text conditioning prompt
  const personaBase = PERSONA_BASE_KINEMATICS[archetype] ?? PERSONA_BASE_KINEMATICS.custom
  const energyPart = ENERGY_KINEMATICS[features.energyTier]
  const rhythmPart = RHYTHMIC_KINEMATICS[features.rhythmStructure]

  const promptParts: string[] = [
    `a person dancing to a ${effectiveBpm} BPM track`,
  ]

  if (personaBase && personaBase.trim().length > 0) {
    promptParts.push(personaBase.trim())
  }
  if (energyPart && energyPart.trim().length > 0) {
    promptParts.push(energyPart.trim())
  }
  if (rhythmPart && rhythmPart.trim().length > 0) {
    promptParts.push(rhythmPart.trim())
  }

  if (persona?.preferredMovements && persona.preferredMovements.length > 0) {
    promptParts.push(`featuring ${persona.preferredMovements.join(', ')}`)
  }

  if (persona?.customPromptModifier && persona.customPromptModifier.trim().length > 0) {
    promptParts.push(persona.customPromptModifier.trim())
  }

  const choreographerPrompt = promptParts.join(', ')

  // Suggest key-pose count for Dance Sheet quantization
  let suggestedKeyPoseCount = 4
  if (features.rhythmStructure === 'waltz_triple') {
    suggestedKeyPoseCount = 6
  }
  else if (features.rhythmStructure === 'fast_breakbeat') {
    suggestedKeyPoseCount = 8
  }
  else if (features.rhythmStructure === 'syncopated') {
    suggestedKeyPoseCount = 6
  }

  return {
    bpm: effectiveBpm,
    energyTier: features.energyTier,
    detectedGenre,
    mood,
    rhythmDescriptor,
    choreographerPrompt,
    suggestedKeyPoseCount,
    confidence: features.confidence,
  }
}
