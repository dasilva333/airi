import whisperWorkerUrl from './whisper.worker?worker&url'

let worker: Worker | null = null

export async function getWhisperWorker() {
  if (!worker) {
    worker = new Worker(whisperWorkerUrl, { type: 'module' })
  }
  return worker
}

export const WHISPER_MODELS = [
  { id: 'onnx-community/whisper-tiny.en', name: 'Whisper Tiny (English)', size: '40MB' },
  { id: 'onnx-community/whisper-base.en', name: 'Whisper Base (English)', size: '80MB' },
  { id: 'onnx-community/whisper-small.en', name: 'Whisper Small (English)', size: '250MB' },
] as const

export function whisperModelsToModelInfo(models: typeof WHISPER_MODELS) {
  return models.map((m) => ({
    contextLength: 0,
    deprecated: false,
    description: `Local Whisper model (${m.size})`,
    id: m.id,
    name: m.name,
    provider: 'app-local-audio-transcription',
  }))
}
