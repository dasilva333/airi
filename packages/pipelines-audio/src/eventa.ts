import { defineEventa } from '@moeru/eventa'
import type {
  PlaybackEndEvent,
  PlaybackInterruptEvent,
  PlaybackRejectEvent,
  PlaybackStartEvent,
  TextSegment,
  TtsRequest,
  TtsResult,
} from './types'

export const speechSegmentEvent = defineEventa<TextSegment>('proj-airi:pipelines:output:speech:segment')
export const speechSpecialEvent = defineEventa<TextSegment>('proj-airi:pipelines:output:speech:special')
export const speechTtsRequestEvent = defineEventa<TtsRequest>('proj-airi:pipelines:output:speech:tts-request')
export const speechTtsResultEvent = defineEventa<TtsResult<any>>('proj-airi:pipelines:output:speech:tts-result')
export const speechPlaybackStartEvent = defineEventa<PlaybackStartEvent<any>>(
  'proj-airi:pipelines:output:speech:playback-start',
)
export const speechPlaybackEndEvent = defineEventa<PlaybackEndEvent<any>>(
  'proj-airi:pipelines:output:speech:playback-end',
)
export const speechPlaybackInterruptEvent = defineEventa<PlaybackInterruptEvent<any>>(
  'proj-airi:pipelines:output:speech:playback-interrupt',
)
export const speechPlaybackRejectEvent = defineEventa<PlaybackRejectEvent<any>>(
  'proj-airi:pipelines:output:speech:playback-reject',
)
export const speechIntentStartEvent = defineEventa<string>('proj-airi:pipelines:output:speech:intent-start')
export const speechIntentEndEvent = defineEventa<string>('proj-airi:pipelines:output:speech:intent-end')
export const speechIntentCancelEvent = defineEventa<{ intentId: string; reason?: string }>(
  'proj-airi:pipelines:output:speech:intent-cancel',
)

export const speechPipelineEventMap = {
  onIntentCancel: speechIntentCancelEvent,
  onIntentEnd: speechIntentEndEvent,
  onIntentStart: speechIntentStartEvent,
  onPlaybackEnd: speechPlaybackEndEvent,
  onPlaybackInterrupt: speechPlaybackInterruptEvent,
  onPlaybackReject: speechPlaybackRejectEvent,
  onPlaybackStart: speechPlaybackStartEvent,
  onSegment: speechSegmentEvent,
  onSpecial: speechSpecialEvent,
  onTtsRequest: speechTtsRequestEvent,
  onTtsResult: speechTtsResultEvent,
} as const

export type SpeechPipelineEventName = keyof typeof speechPipelineEventMap
