import type { ProgressPayload } from '../../../../../libs/inference/protocol'

import { getWhisperAdapter } from '../../../../../libs/inference/adapters/whisper'

/**
 * V2 onboarding bridge: explicitly (re)load the in-browser Whisper model with a
 * live progress stream, decoupled from an actual transcription request.
 *
 * NOTICE: The registered transcription card (`browser-local-audio-transcription`)
 * is a no-op shim that downloads nothing; the real engine is the singleton
 * `getWhisperAdapter()`. This helper lets the onboarding step trigger and verify
 * the weight-shard download + WASM/WebGPU compilation *in context* so Step 7's
 * "cached & verified" claim is actually true. `load()` is serialized by the
 * worker host, so repeat calls for the same model won't duplicate work.
 */
export async function ensureWhisperLoaded(
  options: {
    model: string
    signal?: AbortSignal
    onProgress?: (p: ProgressPayload) => void
  },
): Promise<void> {
  const adapter = await getWhisperAdapter()
  // Skip the download entirely if this exact model is already resident.
  if (adapter.state === 'ready' && adapter.manifest?.model === options.model)
    return
  await adapter.load(options.onProgress, { signal: options.signal, model: options.model })
}

export type { ProgressPayload }
