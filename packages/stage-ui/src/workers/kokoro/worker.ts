/**
 * Kokoro TTS Web Worker Entry Point
 * This file is imported as a Web Worker
 */

import { KokoroTTS } from 'kokoro-js'
import type { ErrorMessage, LoadedMessage, ProgressMessage, SuccessMessage, VoiceKey, WorkerRequest } from './types'

let ttsModel: KokoroTTS | null = null
let currentQuantization: string | null = null
let currentDevice: string | null = null

interface GenerateRequest {
  text: string
  voice: VoiceKey
}

async function loadModel(quantization: string, device: string) {
  // Check if we already have the correct model loaded
  if (ttsModel && currentQuantization === quantization && currentDevice === device) {
    const message: LoadedMessage = {
      type: 'loaded',
      voices: ttsModel.voices,
    }
    globalThis.postMessage(message)
    return
  }

  // Map fp32-webgpu to fp32 for the model
  const modelQuantization = quantization === 'fp32-webgpu' ? 'fp32' : quantization

  ttsModel = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    device: device as 'wasm' | 'webgpu' | 'cpu',
    dtype: modelQuantization as 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16',
    progress_callback: (progress) => {
      const message: ProgressMessage = {
        progress,
        type: 'progress',
      }
      globalThis.postMessage(message)
    },
  })

  // Store the current settings
  currentQuantization = quantization
  currentDevice = device

  const message: LoadedMessage = {
    type: 'loaded',
    voices: ttsModel.voices,
  }
  globalThis.postMessage(message)
}

async function generate(request: GenerateRequest) {
  const { text, voice } = request

  if (!ttsModel) {
    const errorMessage: ErrorMessage = {
      message: 'Kokoro TTS generation failed: No model loaded.',
      status: 'error',
      type: 'result',
    }
    globalThis.postMessage(errorMessage)
    return
  }

  // Generate audio from text
  const result = await ttsModel.generate(text, {
    voice,
  })

  const blob = await result.toBlob()
  const buffer: ArrayBuffer = await blob.arrayBuffer()

  // Send the audio buffer back to the main thread
  // Use transferable to avoid copying the buffer
  const successMessage: SuccessMessage = {
    buffer,
    status: 'success',
    type: 'result',
  }
  const transferList: ArrayBuffer[] = [buffer]
  ;(globalThis as any).postMessage(successMessage, transferList)
}

// Listen for messages from the main thread
globalThis.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data

  switch (message.type) {
    case 'load':
      await loadModel(message.data.quantization, message.data.device)
      break

    case 'generate':
      await generate(message.data)
      break

    default:
      console.warn('[Kokoro Worker] Unknown message type:', (message as any).type)
  }
})
