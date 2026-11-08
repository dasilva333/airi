/**
 * Types and schema contracts for the Motion Choreography engine.
 */

export type EnergyTier = 'low' | 'moderate' | 'high' | 'explosive'

export type TimbreBrightness = 'dark' | 'balanced' | 'bright'

export type RhythmStructure
  = | 'four_on_the_floor'
    | 'waltz_triple'
    | 'syncopated'
    | 'fast_breakbeat'
    | 'ambient_free'

/**
 * Low-level signal analysis extracted directly from raw audio PCM.
 */
export interface AcousticFeatures {
  /** Estimated Tempo in beats per minute (e.g. 60–200 BPM) */
  bpm: number
  /** Confidence score of the BPM estimation (0.0 to 1.0) */
  confidence: number
  /** Root Mean Square energy (signal loudness magnitude) */
  energyRms: number
  /** Normalized energy classification tier */
  energyTier: EnergyTier
  /** Spectral centroid in Hertz representing timbral brightness */
  spectralCentroid: number
  /** High-level timbre characterization based on centroid frequency */
  timbreBrightness: TimbreBrightness
  /** Detected metric and rhythmic cadence */
  rhythmStructure: RhythmStructure
  /** Total analyzed audio duration in seconds */
  durationSeconds: number
  /** Detected beat onset timestamps in seconds */
  beatTimestamps: number[]
}

/**
 * Optional contextual metadata accompanying a track (e.g. ID3 tags, Sound Studio DJ queue).
 */
export interface TrackMetadata {
  id?: string
  title?: string
  artist?: string
  genreHint?: string
  bpmHint?: number
}

/**
 * Companion persona modality that filters how music translates into body language.
 */
export type PersonaArchetype
  = | 'idol'
    | 'gothic_maid'
    | 'cool_android'
    | 'chill_gamer'
    | 'chaotic_gremlin'
    | 'custom'

export interface PersonaDanceModality {
  archetype: PersonaArchetype
  /** Extra prompt guidance, e.g. "prefers delicate hand sweeps, dislikes rapid head shaking" */
  customPromptModifier?: string
  /** Explicit movement preferences */
  preferredMovements?: string[]
}

/**
 * The final output produced by "The Identifier" stage, directly consumable
 * by the Choreographer (FlowMDM Text-to-Motion) and the Conductor.
 */
export interface DanceBrief {
  /** Effective dance BPM */
  bpm: number
  /** Energy category driving motion velocity and amplitude */
  energyTier: EnergyTier
  /** Stylistic genre detected from acoustics and metadata */
  detectedGenre: string
  /** Atmosphere and mood keywords */
  mood: string
  /** Rhythmic cadence description */
  rhythmDescriptor: string
  /** High-level prompt ready for FlowMDM text conditioning */
  choreographerPrompt: string
  /** Number of anchor key-poses recommended for the Dance Sheet (typically 4–8) */
  suggestedKeyPoseCount: number
  /** Signal confidence score (0.0 to 1.0) */
  confidence: number
}
