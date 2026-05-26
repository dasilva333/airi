import { env, pipeline } from '@huggingface/transformers'

// Initialize environment for browser usage (WebGPU/WASM)
env.allowLocalModels = false
env.useBrowserCache = true

// Cache for pipelines
const pipelines: Record<string, any> = {}
// Track active loading tasks to prevent redundant downloads
const loadingPromises: Record<string, Promise<any> | undefined> = {}

async function getPipeline(model: string, progress_callback?: (progress: number) => void) {
  if (pipelines[model]) return pipelines[model]

  if (loadingPromises[model]) {
    console.info(`[Whisper Worker] Already loading ${model}, waiting for existing task...`)
    return loadingPromises[model]
  }

  console.info(`[Whisper Worker] Loading model: ${model}`)
  loadingPromises[model] = (async () => {
    try {
      // Try WebGPU first if available
      const p = await pipeline('automatic-speech-recognition', model, {
        device: 'webgpu',
        dtype: 'fp16', // Better for WebGPU
        progress_callback: (info: any) => {
          if (info.status === 'progress' && progress_callback) {
            progress_callback(info.progress)
          }
        },
      })
      console.info(`[Whisper Worker] Model ${model} loaded with WebGPU`)
      pipelines[model] = p
      return p
    } catch (err) {
      console.warn(`[Whisper Worker] WebGPU failed, falling back to WASM:`, err)
      const p = await pipeline('automatic-speech-recognition', model, {
        device: 'wasm',
        dtype: 'fp32', // Safe default for WASM
        progress_callback: (info: any) => {
          if (info.status === 'progress' && progress_callback) {
            progress_callback(info.progress)
          }
        },
      })
      console.info(`[Whisper Worker] Model ${model} loaded with WASM`)
      pipelines[model] = p
      return p
    } finally {
      delete loadingPromises[model]
    }
  })()

  return loadingPromises[model]
}

let transcriber: any = null

/**
 * Basic linear interpolation resampler.
 */
function resample(audio: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return audio
  const ratio = fromRate / toRate
  const newLength = Math.round(audio.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio
    const index = Math.floor(pos)
    const frac = pos - index
    if (index + 1 < audio.length) {
      result[i] = audio[index] * (1 - frac) + audio[index + 1] * frac
    } else {
      result[i] = audio[index]
    }
  }
  return result
}

/**
 * Strips WAV header and extracts PCM data + sample rate.
 */
function parseWav(buffer: ArrayBuffer) {
  const view = new DataView(buffer)

  // Double check RIFF header
  if (view.byteLength < 44) return null
  if (view.getUint32(0) !== 0x52494646) return null // "RIFF"
  if (view.getUint32(8) !== 0x57415645) return null // "WAVE"

  let offset = 12
  let sampleRate = 0
  let bitsPerSample = 0
  let dataOffset = 0
  let dataSize = 0

  // Look for "fmt " and "data" chunks
  while (offset + 8 <= buffer.byteLength) {
    const chunkId = view.getUint32(offset)
    const chunkSize = view.getUint32(offset + 4, true)

    if (chunkId === 0x666d7420) {
      // "fmt "
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
    } else if (chunkId === 0x64617461) {
      // "data"
      dataOffset = offset + 8
      dataSize = chunkSize
      break
    }
    offset += 8 + chunkSize
  }

  if (!dataOffset || !sampleRate) return null
  return { bitsPerSample, dataOffset, dataSize, sampleRate }
}

/**
 * Ensures the input audio is a Float32Array and properly normalized for Whisper (16kHz).
 */
function ensureFloat32Array(audio: any): Float32Array {
  const TARGET_RATE = 16000

  // Handle Blob/File (should be converted to ArrayBuffer before worker call, but just in case)
  if (audio instanceof Blob) {
    throw new TypeError('Blobs cannot be processed directly in worker sync — convert to ArrayBuffer first.')
  }

  let float32: Float32Array
  let sourceRate = TARGET_RATE // Default assume it's already 16kHz

  if (audio instanceof ArrayBuffer) {
    const wav = parseWav(audio)
    if (wav) {
      console.info(
        `[Whisper Worker] WAV detected: ${wav.sampleRate}Hz, ${wav.bitsPerSample}-bit, ${wav.dataSize} bytes data`,
      )
      sourceRate = wav.sampleRate

      if (wav.bitsPerSample === 16) {
        const i16 = new Int16Array(audio, wav.dataOffset, Math.floor(wav.dataSize / 2))
        float32 = new Float32Array(i16.length)
        for (let i = 0; i < i16.length; ++i) {
          float32[i] = i16[i] / 32768.0
        }
      } else if (wav.bitsPerSample === 32) {
        float32 = new Float32Array(audio, wav.dataOffset, Math.floor(wav.dataSize / 4))
      } else {
        throw new Error(`Unsupported WAV bits per sample: ${wav.bitsPerSample}`)
      }
    } else {
      // Not a WAV, assume raw Float32 at native rate fallback (heuristic)
      console.warn('[Whisper Worker] Not a WAV file. Assuming raw Float32 PCM at 48kHz...')
      sourceRate = 48000
      float32 = new Float32Array(audio)
    }
  } else if (audio instanceof Float32Array) {
    float32 = audio
    // If it's pure Float32, we don't know the rate unless passed in.
    // Heuristic: if originating from this repo's recorder, it's 48kHz.
    sourceRate = 48000
  } else if (audio instanceof Int16Array) {
    sourceRate = 48000
    float32 = new Float32Array(audio.length)
    for (let i = 0; i < audio.length; ++i) {
      float32[i] = audio[i] / 32768.0
    }
  } else {
    throw new TypeError(`Unsupported data type: ${audio?.constructor?.name || typeof audio}`)
  }

  // Resample to 16kHz
  if (sourceRate !== TARGET_RATE) {
    console.info(`[Whisper Worker] Resampling from ${sourceRate}Hz to ${TARGET_RATE}Hz...`)
    return resample(float32, sourceRate, TARGET_RATE)
  }

  return float32
}

self.onmessage = async (event: MessageEvent) => {
  const { type, id, model, modelId, audio, audioData, options, payload } = event.data

  // Support both direct props and payload for flexibility during transition
  const effectiveModelId = modelId || model || payload?.modelId || payload?.model
  const effectiveId = id || payload?.id
  const effectiveType = type?.toUpperCase()

  console.info(`[Whisper Worker] Received message: ${effectiveType}`, { id: effectiveId, modelId: effectiveModelId })

  switch (effectiveType) {
    case 'CHECK-CACHE': {
      try {
        console.group(`[Whisper Worker] Checking cache for ${effectiveModelId}`)
        const cache = await caches.open('transformers-cache')
        const keys = await cache.keys()
        const isCached = keys.some((k) => k.url.includes(effectiveModelId))
        console.info(`[Whisper Worker] Cache status: ${isCached ? 'FOUND' : 'NOT FOUND'}`)
        self.postMessage({ id: effectiveId, isCached, modelId: effectiveModelId, type: 'CACHE-STATUS' })
        console.groupEnd()
      } catch (err) {
        console.error('[Whisper Worker] Cache check failed:', err)
        if (err instanceof Error) {
          console.error(err.stack)
        }
        self.postMessage({ id: effectiveId, isCached: false, modelId: effectiveModelId, type: 'CACHE-STATUS' })
      }
      break
    }

    case 'LOAD': {
      try {
        console.group(`[Whisper Worker] Loading model: ${effectiveModelId}`)
        self.postMessage({ id: effectiveId, progress: 0, type: 'PROGRESS' })

        transcriber = await getPipeline(effectiveModelId, (progress) => {
          console.info(`[Whisper Worker] Loading progress: ${(progress * 100).toFixed(2)}%`)
          self.postMessage({ id: effectiveId, progress, type: 'PROGRESS' })
        })

        console.info(`[Whisper Worker] Model ${effectiveModelId} loaded successfully.`)
        self.postMessage({ id: effectiveId, type: 'LOADED' })
        console.groupEnd()
      } catch (error) {
        console.error('[Whisper Worker] Model load failed:', error)
        if (error instanceof Error) {
          console.error(error.stack)
        }
        self.postMessage({
          error: (error as Error).message,
          id: effectiveId,
          stack: (error as Error).stack,
          type: 'ERROR',
        })
        console.groupEnd()
      }
      break
    }

    case 'TRANSCRIBE': {
      const effectiveAudio = audio || audioData || payload?.audioData || payload?.audio
      const effectiveOptions = options || payload?.options || {}

      console.group(`[Whisper Worker] Transcription request ${effectiveId}`)

      if (!transcriber) {
        const errorMsg =
          'Transcriber not initialized. Please ensure LOAD message is sent and completed before TRANSCRIBE.'
        console.error(`[Whisper Worker] ${errorMsg}`)
        self.postMessage({ error: errorMsg, id: effectiveId, type: 'ERROR' })
        console.groupEnd()
        return
      }

      try {
        if (!effectiveAudio) {
          throw new Error('No audio data provided for transcription')
        }

        const byteLength = effectiveAudio.byteLength ?? effectiveAudio.size ?? 0
        console.info(`[Whisper Worker] Processing ${byteLength} bytes of audio data...`)

        // Prepare audio data: convert any input format to normalized Float32Array
        const audioBuffer = ensureFloat32Array(effectiveAudio)

        console.info(`[Whisper Worker] Starting inference with ${audioBuffer.length} samples...`)

        const result = await transcriber(audioBuffer, {
          ...effectiveOptions,
          chunk_length_s: 30,
          stride_length_s: 5,
        })

        console.info(
          `[Whisper Worker] Transcription completed: "${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}"`,
        )
        self.postMessage({ chunks: result.chunks, id: effectiveId, text: result.text, type: 'RESULT' })
        console.groupEnd()
      } catch (err) {
        console.error('[Whisper Worker] Transcription failed:', err)
        if (err instanceof Error) {
          console.error(err.stack)
        }
        self.postMessage({
          error: `Transcription failed: ${err instanceof Error ? err.message : String(err)}`,
          id: effectiveId,
          stack: err instanceof Error ? err.stack : undefined,
          type: 'ERROR',
        })
        console.groupEnd()
      }
      break
    }

    default: {
      console.warn(`[Whisper Worker] Unknown message type: ${effectiveType}`)
    }
  }
}
