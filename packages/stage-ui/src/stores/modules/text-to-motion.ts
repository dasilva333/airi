import type { ChatProvider } from '@xsai-ext/providers/utils'

import type { VRMAMotionSpec } from '../../utils/vrmaSchema'

import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { buildVRMA, VRMA_SYSTEM_PROMPT, VRMAMotionSpecSchema } from '../../utils'
import { getClipEmbedding } from '../../utils/flowmdm/clipEncoder'
import { getDenoisingSession, runDdimLoop } from '../../utils/flowmdm/ddimSolver'
import { exportFlowMDMToVRMA } from '../../utils/flowmdm/vrmaExporter'
import { useLLM } from '../llm'
import { useProvidersStore } from '../providers'
import { useConsciousnessStore } from './consciousness'

export type TextToMotionMode = 'procedural' | 'flowmdm'

export interface MotionGenerationResult {
  buffer: Uint8Array
  fileName: string
  format: 'vrma' | 'vmd' | 'motion_json'
}

export interface ModelDownloadProgress {
  percentage: number
  file: string
  status: string
  isDownloading: boolean
}

export const useTextToMotionStore = defineStore('text-to-motion', () => {
  const mode = useStorage<TextToMotionMode>('airi:text-to-motion:mode', 'procedural')

  const downloadProgress = ref<ModelDownloadProgress>({
    percentage: 0,
    file: '',
    status: '',
    isDownloading: false,
  })

  function setMode(newMode: TextToMotionMode) {
    mode.value = newMode
  }

  function isWebGPUSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu
  }

  const enabled = computed(() => true)
  const configured = computed(() => true)

  /**
   * Centralized Motion Generation Entry Point
   * Handles routing between procedural (LLM) and flowmdm (WebGPU) modes.
   */
  async function generateMotion(
    prompt: string,
    options?: {
      format?: 'vrma' | 'vmd' | 'motion_json'
      outputLength?: number
      onLog?: (msg: string) => void
    },
  ): Promise<MotionGenerationResult> {
    const format = options?.format || 'vrma'
    const log = options?.onLog || (() => {})

    // Route: FlowMDM (Local WebGPU ONNX Pipeline)
    if (mode.value === 'flowmdm') {
      log('Initiating FlowMDM WebGPU pipeline...')

      if (!isWebGPUSupported()) {
        log('[WARN] WebGPU is not supported on this device/browser. Falling back to WASM...')
      }

      downloadProgress.value = {
        percentage: 10,
        file: 'Xenova/clip-vit-base-patch32',
        status: 'Loading CLIP Text Encoder...',
        isDownloading: true,
      }

      // Step 1: CLIP Text Encoding
      const clipEmbedding = await getClipEmbedding(prompt, log)

      downloadProgress.value = {
        percentage: 30,
        file: 'dasilva333/flowmdm-onnx',
        status: 'Loading ONNX Denoiser Session...',
        isDownloading: true,
      }

      // Step 2: Load ONNX Session
      const session = await getDenoisingSession(log)

      downloadProgress.value = {
        percentage: 50,
        file: 'dasilva333/flowmdm-onnx',
        status: 'Running 50-step DDIM Denoising Loop...',
        isDownloading: true,
      }

      // Step 3: Run 50-step DDIM Diffusion Denoising
      const seqLen = options?.outputLength || 60
      const denoisedFeatures = await runDdimLoop(session, clipEmbedding, seqLen, log)

      downloadProgress.value = {
        percentage: 90,
        file: '',
        status: 'Exporting HumanML3D to VRMA...',
        isDownloading: true,
      }

      // Step 4: Export HumanML3D features to binary VRMA container
      const buffer = exportFlowMDMToVRMA(denoisedFeatures, seqLen, log)

      downloadProgress.value = {
        percentage: 100,
        file: '',
        status: 'Complete',
        isDownloading: false,
      }

      const cleanName = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20) || 'flowmdm_motion'
      log(`FlowMDM Motion exported successfully. Format: ${format.toUpperCase()}`)

      return {
        buffer,
        fileName: `${cleanName}_${Date.now()}.${format === 'motion_json' ? 'json' : format}`,
        format,
      }
    }

    // Procedural LLM Route
    log('Using Procedural LLM Motion Generator...')
    const consciousnessStore = useConsciousnessStore()
    const providersStore = useProvidersStore()
    const llmStore = useLLM()

    const providerId = consciousnessStore.activeProvider
    const model = consciousnessStore.activeModel

    if (!providerId || !model) {
      throw new Error('No active LLM provider or model is configured for procedural motion generation.')
    }

    const provider = await providersStore.getProviderInstance<ChatProvider>(providerId)
    if (!provider) {
      throw new Error(`Failed to resolve provider instance for "${providerId}".`)
    }

    log('Querying LLM for motion specification schema...')
    const messages = [
      { role: 'system' as const, content: VRMA_SYSTEM_PROMPT },
      { role: 'user' as const, content: `Create a motion animation for: ${prompt}` },
    ]

    const spec = await llmStore.generateObject<VRMAMotionSpec>(model, provider, {
      messages,
      schema: VRMAMotionSpecSchema,
      maxAttempts: 3,
    })

    log('Compiling motion spec to VRMA binary buffer...')
    const buffer = new Uint8Array(buildVRMA(spec))

    const fileName = `${spec.name || 'motion'}_${Date.now()}.${format === 'motion_json' ? 'json' : format}`
    log(`Procedural motion generated: ${fileName}`)

    return {
      buffer,
      fileName,
      format,
    }
  }

  /**
   * Download a motion generation result to disk via browser download prompt.
   */
  function downloadResultToDisk(result: MotionGenerationResult) {
    const blob = new Blob([result.buffer.buffer as ArrayBuffer], { type: 'model/gltf-binary' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Save a motion generation result to the custom VRM animations library.
   * Accepts the addCustomAnimation function from useCustomVrmAnimationsStore
   * to avoid coupling stage-ui with stage-ui-three.
   */
  async function saveResultToLibrary(
    result: MotionGenerationResult,
    addCustomAnimation: (file: File) => Promise<string>,
  ): Promise<string> {
    const file = new File(
      [result.buffer.buffer as ArrayBuffer],
      result.fileName,
      { type: 'model/gltf-binary' },
    )
    return addCustomAnimation(file)
  }

  return {
    mode,
    enabled,
    configured,
    downloadProgress,
    setMode,
    isWebGPUSupported,
    generateMotion,
    downloadResultToDisk,
    saveResultToLibrary,
  }
})
