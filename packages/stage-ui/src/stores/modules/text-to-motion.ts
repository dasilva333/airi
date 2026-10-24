import type { ChatProvider } from '@xsai-ext/providers/utils'

import type { VRMAMotionSpec } from '../../utils/vrmaSchema'

import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { buildVRMA, VRMA_SYSTEM_PROMPT, VRMAMotionSpecSchema } from '../../utils'
import { getClipEmbedding, isClipEncoderCached, prewarmClipEncoder } from '../../utils/flowmdm/clipEncoder'
import { getDenoisingSession, isDenoisingModelCached, runDdimLoop } from '../../utils/flowmdm/ddimSolver'
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

  // --- Motion engine pre-warm (FlowMDM CLIP + ONNX denoiser) ---
  // Lives on the store, not the onboarding step, so navigating away does not
  // fake a reset to "Pre-warm". `ready` means the weights are loaded and cached.
  const prewarmStatus = ref<'idle' | 'prewarming' | 'ready' | 'error'>('idle')
  const prewarmError = ref<string | null>(null)
  let prewarmPromise: Promise<void> | null = null

  const isPrewarming = computed(() => prewarmStatus.value === 'prewarming')
  const engineReady = computed(() => prewarmStatus.value === 'ready')

  /**
   * Reads the real Cache Storage state so a previously pre-warmed engine shows
   * as ready after a remount or app restart instead of asking again.
   */
  async function refreshPrewarmState(): Promise<void> {
    if (prewarmStatus.value === 'ready' || prewarmStatus.value === 'prewarming')
      return

    try {
      const [clipCached, denoiserCached] = await Promise.all([
        isClipEncoderCached(),
        isDenoisingModelCached(),
      ])
      if (clipCached && denoiserCached) {
        prewarmStatus.value = 'ready'
        prewarmError.value = null
      }
    }
    catch (err) {
      console.warn('[TextToMotion] Failed to inspect motion engine cache:', err)
    }
  }

  /**
   * Downloads and initializes the local FlowMDM engine (CLIP text encoder +
   * ONNX denoiser). Deliberately does NOT run generation: pre-warming must not
   * depend on an LLM provider or burn a diffusion pass.
   *
   * Downloading FlowMDM is only meaningful if generation uses it, so a
   * successful pre-warm also commits the persisted engine selection to
   * `flowmdm`. The switch happens on success only: a failed download must not
   * strand the user on an engine that is not there.
   */
  async function prewarmEngine(options?: { onLog?: (msg: string) => void }): Promise<void> {
    if (prewarmStatus.value === 'ready') {
      // Already downloaded (e.g. cache from a previous session) but the engine
      // selection may have been switched back to procedural since.
      setMode('flowmdm')
      return
    }
    if (prewarmPromise)
      return prewarmPromise

    const log = options?.onLog ?? (() => {})

    prewarmPromise = (async () => {
      prewarmStatus.value = 'prewarming'
      prewarmError.value = null
      downloadProgress.value = {
        percentage: 5,
        file: 'Xenova/clip-vit-base-patch32',
        status: 'Loading CLIP text encoder...',
        isDownloading: true,
      }

      try {
        if (!isWebGPUSupported())
          log('[WARN] WebGPU is not supported on this device/browser. The engine will run on WASM.')

        log('Pre-warming CLIP text encoder...')
        // Transformers.js reports progress per file; keep the bar monotonic so
        // the tokenizer finishing does not snap the percentage back down.
        let clipProgressFloor = 5
        await prewarmClipEncoder(log, (percentage, status) => {
          const mapped = Math.max(clipProgressFloor, Math.round(5 + percentage * 0.35))
          clipProgressFloor = mapped
          downloadProgress.value = {
            percentage: mapped,
            file: 'Xenova/clip-vit-base-patch32',
            status,
            isDownloading: true,
          }
        })

        downloadProgress.value = {
          percentage: 40,
          file: 'dasilva333/flowmdm-onnx',
          status: 'Preparing FlowMDM denoiser...',
          isDownloading: true,
        }

        const session = await getDenoisingSession(log, (percentage, status) => {
          downloadProgress.value = {
            percentage: Math.round(40 + percentage * 0.6),
            file: 'dasilva333/flowmdm-onnx',
            status,
            isDownloading: percentage < 100,
          }
        })

        if (!session)
          throw new Error('FlowMDM denoiser session could not be initialized.')

        downloadProgress.value = {
          percentage: 100,
          file: '',
          status: 'Motion engine ready',
          isDownloading: false,
        }
        prewarmStatus.value = 'ready'
        // Engine is on disk and loaded: make generation use it.
        setMode('flowmdm')
        log('Motion engine pre-warmed and cached. Engine set to FlowMDM.')
      }
      catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        prewarmStatus.value = 'error'
        prewarmError.value = message
        downloadProgress.value = {
          percentage: 0,
          file: '',
          status: `Pre-warm failed: ${message}`,
          isDownloading: false,
        }
        log(`[WARN] Motion engine pre-warm failed: ${message}`)
        throw err
      }
      finally {
        prewarmPromise = null
      }
    })()

    return prewarmPromise
  }

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
      /**
       * Overrides the persisted engine selection for this call only. Callers
       * that already guarantee the local engine is warm (e.g. the onboarding
       * finale demo, which runs before the draft provider is committed) use
       * this instead of depending on the active consciousness provider.
       */
      engine?: TextToMotionMode
    },
  ): Promise<MotionGenerationResult> {
    const format = options?.format || 'vrma'
    const log = options?.onLog || (() => {})
    const engine = options?.engine ?? mode.value

    // Route: FlowMDM (Local WebGPU ONNX Pipeline)
    if (engine === 'flowmdm') {
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
      const session = await getDenoisingSession(log, (percentage, status) => {
        downloadProgress.value = {
          percentage: Math.round(30 + percentage * 0.2),
          file: 'dasilva333/flowmdm-onnx',
          status,
          isDownloading: percentage < 100,
        }
      })

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

      // A successful FlowMDM pass means the engine is loaded and warm.
      if (session) {
        prewarmStatus.value = 'ready'
        prewarmError.value = null
      }

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
    prewarmStatus,
    prewarmError,
    isPrewarming,
    engineReady,
    refreshPrewarmState,
    prewarmEngine,
    setMode,
    isWebGPUSupported,
    generateMotion,
    downloadResultToDisk,
    saveResultToLibrary,
  }
})
