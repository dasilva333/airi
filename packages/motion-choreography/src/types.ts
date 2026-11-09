/**
 * Types and schema contracts for the Motion Choreography engine.
 */

export type EnergyTier = 'low' | 'moderate' | 'high' | 'explosive'

export type TimbreBrightness = 'dark' | 'warm' | 'balanced' | 'bright'

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
  = | 'none'
    | 'idol'
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

/**
 * Anchor pose classification category.
 */
export type PoseType
  = | 'velocity_minimum'
    | 'extension_maximum'
    | 'foot_strike'
    | 'boundary'

/**
 * A single anchor keyframe in a DanceSheet.
 */
export interface DanceSheetKeyframe {
  /** Index of the frame in the original motion sequence (0 to seqLen - 1) */
  frameIndex: number
  /** Time of the frame in seconds */
  timeSeconds: number
  /** Salience / importance score of this pose (0.0 to 1.0) */
  salienceScore: number
  /** Reason why this keyframe was selected */
  poseType: PoseType
  /** Root translation [x, y, z] in meters */
  rootTranslation: [number, number, number]
  /** Root rotation quaternion [x, y, z, w] */
  rootRotation: [number, number, number, number]
  /** Joint rotations by joint index or standard humanoid name */
  jointRotations?: Record<string, [number, number, number, number]>
}

/**
 * A curated sequence of anchor key-poses extracted from a motion sequence.
 */
export interface DanceSheet {
  /** Total frames in source motion */
  totalFrames: number
  /** Source motion frame rate (typically 20 fps for FlowMDM) */
  fps: number
  /** Total duration in seconds */
  durationSeconds: number
  /** Target count of keyframes requested */
  targetKeyPoseCount: number
  /** Extracted keyframes ordered chronologically */
  keyframes: DanceSheetKeyframe[]
}

/**
 * Options configuring key-pose extraction.
 */
export interface KeyPoseExtractionOptions {
  /** Target number of anchor poses to extract (default: 4 to 8) */
  targetKeyPoseCount?: number
  /** Frame rate of the motion sequence (default: 20) */
  fps?: number
  /** Minimum frames between consecutive key-poses (NMS window, default: 6) */
  minFrameInterval?: number
  /** Whether to decode 6D rotations to quaternions for joints (default: true) */
  decodeJointRotations?: boolean
}

/**
 * Options configuring beat-to-keypoint alignment ("The Conductor").
 */
export interface BeatAlignmentOptions {
  /** Musical metric structure hint (e.g. 'waltz_triple', 'four_on_the_floor') */
  rhythmStructure?: RhythmStructure
  /** Cadence targeting: align to every beat, downbeats only, or adaptively based on rhythm */
  cadence?: 'all_beats' | 'downbeats_only' | 'adaptive'
  /** Maximum allowed elastic time-warp stretch factor (default: 2.5) */
  maxWarpRatio?: number
  /** Minimum allowed elastic time-warp compress factor (default: 0.4) */
  minWarpRatio?: number
}

/**
 * Mapping connecting an extracted anchor keyframe to a specific audio beat timestamp.
 */
export interface AlignedKeyframeMapping {
  /** Index into danceSheet.keyframes */
  keyframeIndex: number
  /** Frame index in original sequence */
  frameIndex: number
  /** Original timestamp in seconds */
  originalTimeSeconds: number
  /** Target beat timestamp in seconds where this pose will land */
  targetBeatSeconds: number
  /** Associated pose type */
  poseType: PoseType
  /** Saliency score */
  salienceScore: number
  /** Time warp scale for this segment (targetInterval / sourceInterval) */
  warpRatio: number
}

/**
 * Overall result of the Conductor's beat alignment pass.
 */
export interface ConductorAlignmentResult {
  /** Ordered list of aligned keyframe mappings */
  mappings: AlignedKeyframeMapping[]
  /** Total aligned duration in seconds */
  totalDurationSeconds: number
  /** Average time warp ratio across all segments */
  averageWarpRatio: number
  /** Metric ratio range [minWarp, maxWarp] */
  warpRange: [number, number]
}

/**
 * Interpolated 3D pose frame evaluated at a specific playback second.
 */
export interface WarpedPoseFrame {
  /** Current playback time in seconds */
  timeSeconds: number
  /** Interpolated root translation [x, y, z] */
  rootTranslation: [number, number, number]
  /** Interpolated root rotation quaternion [x, y, z, w] */
  rootRotation: [number, number, number, number]
  /** Interpolated joint rotations by joint name */
  jointRotations: Record<string, [number, number, number, number]>
  /** Active / nearest keyframe index */
  activeKeyframeIndex: number
  /** Index of preceding keyframe mapping */
  precedingKeyframeIndex: number
  /** Index of succeeding keyframe mapping */
  succeedingKeyframeIndex: number
  /** Phase progress between preceding and succeeding keyframes (0.0 to 1.0) */
  phaseProgress: number
}
