/** HIT strength that counts as a beat/dance transient. */
export const BEAT_SYNC_HIT_THRESHOLD = 0.4
/** Minimum time between accepted HIT events. */
export const BEAT_SYNC_HIT_COOLDOWN_MS = 180
/** Accepted HITs retained for the HIT debug readout. */
export const BEAT_SYNC_TEMPO_BUFFER_HITS = 16
/** Analysis frame interval used by the tempo estimator. */
export const BEAT_SYNC_ANALYSIS_INTERVAL_MS = 33
/** Onset-history window used for tempo autocorrelation. */
export const BEAT_SYNC_TEMPO_WINDOW_SECONDS = 6
export const BEAT_SYNC_TEMPO_MIN_BPM = 60
export const BEAT_SYNC_TEMPO_MAX_BPM = 240
export const BEAT_SYNC_TEMPO_PRIOR_BPM = 120
/** BPM that plays the authored dance clip at 1x speed. */
export const BEAT_SYNC_DANCE_BASE_BPM = 120
export const MIN_BEAT_SYNC_DANCE_SPEED = 0.5
export const MAX_BEAT_SYNC_DANCE_SPEED = 2

/** Multiplier applied to Vibe energy before smoothing. */
export const DEFAULT_BEAT_SYNC_VIBE_ENERGY_GAIN = 1
export const MIN_BEAT_SYNC_VIBE_ENERGY_GAIN = 0.5
export const MAX_BEAT_SYNC_VIBE_ENERGY_GAIN = 2.5

/** Keeps a persisted energy gain inside the range the UI exposes. */
export function clampBeatSyncVibeEnergyGain(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return DEFAULT_BEAT_SYNC_VIBE_ENERGY_GAIN
  return Math.min(MAX_BEAT_SYNC_VIBE_ENERGY_GAIN, Math.max(MIN_BEAT_SYNC_VIBE_ENERGY_GAIN, value))
}
