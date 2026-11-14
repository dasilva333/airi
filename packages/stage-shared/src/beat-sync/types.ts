import type { AnalyserBeatEvent } from '@nekopaw/tempora'

export interface BeatSyncDetectorState {
  isActive: boolean
}

/** Slow intensity and transient strength derived from the captured audio. */
export interface BeatSyncVibe {
  /** Smoothed 0..1 loudness normalized against per-song dynamic range. */
  energy: number
  /** Positive spectral flux, 0..1. A drum hit or strong musical change. */
  hit: number
  /** Autocorrelated tempo in BPM (octave-folded to 90..200); 0 until enough history exists. */
  bpm: number
  /** 0..1 confidence of the tempo estimate. */
  bpmConfidence: number
  /** Milliseconds between the two most recent accepted HITs; 0 until two exist. */
  lastHitDeltaMs: number
  /** Accepted HITs currently retained by the tempo estimator. */
  hitCount: number
  /** Time span covered by the onset buffer, in milliseconds. */
  tempoBufferMs: number
}

export interface BeatSyncDetectorEventMap {
  stateChange: (state: BeatSyncDetectorState) => void
  beat: (e: AnalyserBeatEvent) => void
  vibe: (vibe: BeatSyncVibe) => void
}
