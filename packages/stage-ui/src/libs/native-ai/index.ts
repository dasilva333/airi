import type {
  DeleteCachedModelOptions,
  DownloadModelOptions,
  DownloadProgressEvent,
  GenerateStreamOptions,
  HardwareTelemetry,
  ListCachedModelsResult,
  LoadModelOptions,
  LoadModelResult,
  NativeAIPluginInterface,
  PingResponse,
  TestStreamOptions,
  TokenStreamEvent,
  UnloadModelOptions,
} from './definitions'

import { Capacitor, registerPlugin } from '@capacitor/core'
import { isApplePlatform, isStageCapacitor } from '@proj-airi/stage-shared'

export * from './definitions'

const Plugin = registerPlugin<NativeAIPluginInterface>('NativeAI')

/**
 * Format raw bytes into human-readable memory strings (e.g. "6.0 GB" or "350.2 MB")
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || Number.isNaN(bytes) || bytes <= 0)
    return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

/**
 * Fallback telemetry for Web/Browser or when native detection fails to resolve fields.
 */
function createSafeFallbackTelemetry(partial?: Partial<HardwareTelemetry>, raw?: Record<string, unknown>): HardwareTelemetry {
  const isWeb = typeof navigator !== 'undefined'
  const navMemory = isWeb && 'deviceMemory' in navigator ? (navigator as any).deviceMemory * 1024 * 1024 * 1024 : 4 * 1024 * 1024 * 1024
  const cpuCores = isWeb ? navigator.hardwareConcurrency || 4 : 4
  const userAgent = isWeb ? navigator.userAgent : 'Unknown Environment'

  return {
    deviceModel: partial?.deviceModel || 'Generic Web / Desktop Client',
    rawMachineId: partial?.rawMachineId || 'web-environment',
    chipFamily: partial?.chipFamily || (isWeb && /Mac/i.test(userAgent) ? 'Apple Silicon (Web)' : 'Browser Runtime'),
    cpuCores: partial?.cpuCores || cpuCores,
    totalMemoryBytes: partial?.totalMemoryBytes || navMemory,
    totalMemoryFormatted: partial?.totalMemoryFormatted || formatBytes(partial?.totalMemoryBytes || navMemory),
    availableMemoryBytes: partial?.availableMemoryBytes || Math.floor(navMemory * 0.6),
    availableMemoryFormatted: partial?.availableMemoryFormatted || formatBytes(partial?.availableMemoryBytes || Math.floor(navMemory * 0.6)),
    gpuDeviceName: partial?.gpuDeviceName || 'Browser WebGPU / WebGL Engine',
    hasUnifiedMemory: partial?.hasUnifiedMemory ?? true,
    maxWorkingSetBytes: partial?.maxWorkingSetBytes || Math.floor(navMemory * 0.4),
    osVersion: partial?.osVersion || (isWeb ? `${navigator.platform || 'Web'} (${userAgent.slice(0, 40)}...)` : 'Web 1.0'),
    isCoreAIAvailable: partial?.isCoreAIAvailable ?? false,
    isNeuralEngineAvailable: partial?.isNeuralEngineAvailable ?? false,
    rawDiagnostics: raw || {
      userAgent,
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      timestamp: Date.now(),
      ...partial?.rawDiagnostics,
    },
  }
}

/**
 * Robust wrapper around NativeAI plugin with graceful error handling on every method.
 */
export const NativeAI = {
  isNative(): boolean {
    if (typeof window === 'undefined')
      return false
    if (Capacitor.isNativePlatform() && (Capacitor.getPlatform() === 'ios' || isApplePlatform()))
      return true
    if (isStageCapacitor() && isApplePlatform())
      return true
    return false
  },

  async getHardwareTelemetry(): Promise<HardwareTelemetry> {
    if (!this.isNative()) {
      return createSafeFallbackTelemetry()
    }

    try {
      const result = await Plugin.getHardwareTelemetry()
      if (!result || typeof result !== 'object') {
        return createSafeFallbackTelemetry(undefined, { rawReturned: result })
      }

      // Ensure every property is guaranteed non-empty/non-undefined
      return {
        deviceModel: result.deviceModel || 'Apple Device',
        rawMachineId: result.rawMachineId || 'Unknown Machine',
        chipFamily: result.chipFamily || 'Apple Silicon',
        cpuCores: result.cpuCores || 4,
        totalMemoryBytes: result.totalMemoryBytes || 0,
        totalMemoryFormatted: result.totalMemoryFormatted || formatBytes(result.totalMemoryBytes || 0),
        availableMemoryBytes: result.availableMemoryBytes || 0,
        availableMemoryFormatted: result.availableMemoryFormatted || formatBytes(result.availableMemoryBytes || 0),
        gpuDeviceName: result.gpuDeviceName || 'Apple GPU',
        hasUnifiedMemory: result.hasUnifiedMemory ?? true,
        maxWorkingSetBytes: result.maxWorkingSetBytes || 0,
        osVersion: result.osVersion || 'iOS Unknown',
        isCoreAIAvailable: result.isCoreAIAvailable ?? true,
        isNeuralEngineAvailable: result.isNeuralEngineAvailable ?? true,
        rawDiagnostics: result.rawDiagnostics && Object.keys(result.rawDiagnostics).length > 0
          ? result.rawDiagnostics
          : { ...result },
      }
    }
    catch (err: any) {
      console.warn('[NativeAI] getHardwareTelemetry failed, using safe fallback:', err)
      return createSafeFallbackTelemetry(undefined, {
        error: String(err?.message || err),
        stack: err?.stack,
        platform: Capacitor.getPlatform(),
      })
    }
  },

  async ping(): Promise<PingResponse> {
    const clientTimestamp = Date.now()

    if (!this.isNative()) {
      return {
        pong: true,
        clientTimestamp,
        serverTimestamp: clientTimestamp,
        roundtripLatencyMs: 0.1,
        platform: 'web-fallback',
        engine: 'Mock Bridge',
      }
    }

    try {
      const response = await Plugin.ping({ timestamp: clientTimestamp })
      const now = Date.now()
      return {
        pong: response?.pong ?? true,
        clientTimestamp,
        serverTimestamp: response?.serverTimestamp || now,
        roundtripLatencyMs: Math.max(0.1, Number((now - clientTimestamp).toFixed(2))),
        platform: response?.platform || 'iOS',
        engine: response?.engine || 'Capacitor Native Swift',
      }
    }
    catch (err: any) {
      const now = Date.now()
      console.warn('[NativeAI] Ping failed:', err)
      return {
        pong: false,
        clientTimestamp,
        serverTimestamp: now,
        roundtripLatencyMs: Number((now - clientTimestamp).toFixed(2)),
        platform: 'error',
        engine: `Failed: ${String(err?.message || err)}`,
      }
    }
  },

  // In-flight download promises and listeners
  _activeDownloads: new Map<string, Promise<{ modelId: string, status: string }>>(),
  _progressListeners: new Map<string, Set<(event: DownloadProgressEvent) => void>>(),

  async isModelCached(modelId: string): Promise<boolean> {
    if (!this.isNative()) {
      return true
    }
    try {
      const res = await this.listCachedModels()
      const sanitized = modelId.replace(/\//g, '_')
      return (
        res.models?.some(
          m => (m.modelId === sanitized || m.modelId === modelId) && m.isCompiled,
        ) ?? false
      )
    }
    catch {
      return false
    }
  },

  async downloadModel(
    options: DownloadModelOptions,
    onProgress?: (event: DownloadProgressEvent) => void,
  ): Promise<{ modelId: string, status: string }> {
    if (!this.isNative()) {
      // Browser mock download simulation
      let bytes = 0
      const totalBytes = 1.3 * 1024 * 1024 * 1024 // 1.3 GB
      const stepBytes = 150 * 1024 * 1024 // 150 MB steps
      const startTime = Date.now()

      return new Promise((resolve) => {
        const interval = setInterval(() => {
          bytes = Math.min(totalBytes, bytes + stepBytes)
          const percentage = Number(((bytes / totalBytes) * 100).toFixed(1))
          const elapsedSec = (Date.now() - startTime) / 1000
          const speedMBs = Number(((bytes / (1024 * 1024)) / Math.max(0.1, elapsedSec)).toFixed(1))
          const isCompleted = bytes >= totalBytes

          onProgress?.({
            modelId: options.modelId,
            bytesWritten: bytes,
            totalBytes,
            percentage,
            speedMBs,
            isCompleted,
          })

          if (isCompleted) {
            clearInterval(interval)
            resolve({ modelId: options.modelId, status: 'downloaded' })
          }
        }, 300)
      })
    }

    // Register progress callback if provided
    if (onProgress) {
      if (!this._progressListeners.has(options.modelId)) {
        this._progressListeners.set(options.modelId, new Set())
      }
      this._progressListeners.get(options.modelId)!.add(onProgress)
    }

    // If download is already in progress, return the existing in-flight Promise
    const existingPromise = this._activeDownloads.get(options.modelId)
    if (existingPromise) {
      return existingPromise
    }

    const downloadPromise = new Promise<{ modelId: string, status: string }>(async (resolve, reject) => {
      let listenerHandle: { remove: () => Promise<void> } | null = null

      try {
        listenerHandle = await Plugin.addListener('downloadProgress', (event: DownloadProgressEvent) => {
          if (event.modelId === options.modelId) {
            const listeners = this._progressListeners.get(options.modelId)
            listeners?.forEach((cb) => {
              try {
                cb(event)
              }
              catch (e) {
                console.error('[NativeAI] Progress callback error:', e)
              }
            })

            if (event.isCompleted) {
              listenerHandle?.remove().catch(() => {})
              this._activeDownloads.delete(options.modelId)
              this._progressListeners.delete(options.modelId)
              resolve({ modelId: options.modelId, status: 'downloaded' })
            }
            else if (event.error) {
              listenerHandle?.remove().catch(() => {})
              this._activeDownloads.delete(options.modelId)
              this._progressListeners.delete(options.modelId)
              reject(new Error(event.error))
            }
          }
        })

        await Plugin.downloadModel(options)
      }
      catch (err) {
        listenerHandle?.remove().catch(() => {})
        this._activeDownloads.delete(options.modelId)
        this._progressListeners.delete(options.modelId)
        reject(err)
      }
    })

    this._activeDownloads.set(options.modelId, downloadPromise)
    return downloadPromise
  },

  async ensureModelReady(
    options: LoadModelOptions,
    onProgress?: (event: DownloadProgressEvent) => void,
  ): Promise<LoadModelResult> {
    if (!this.isNative()) {
      return await this.loadModel(options)
    }

    const isCached = await this.isModelCached(options.modelId)
    if (!isCached) {
      console.log(`[NativeAI] Model ${options.modelId} not cached. Auto-downloading on-device weights...`)
      await this.downloadModel(
        {
          modelId: options.modelId,
          repo: options.modelId,
        },
        onProgress,
      )
    }

    return await this.loadModel(options)
  },

  async loadModel(options: LoadModelOptions): Promise<LoadModelResult> {
    if (!this.isNative()) {
      await new Promise(resolve => setTimeout(resolve, 600))
      return {
        modelId: options.modelId,
        isLoaded: true,
        loadTimeMs: 580,
        computeUnitsUsed: 'Simulated Web Neural Engine',
        residentMemoryBytes: 1.2 * 1024 * 1024 * 1024,
      }
    }

    return await Plugin.loadModel(options)
  },

  async unloadModel(options?: UnloadModelOptions): Promise<{ success: boolean }> {
    if (!this.isNative()) {
      return { success: true }
    }
    return await Plugin.unloadModel(options)
  },

  async listCachedModels(): Promise<ListCachedModelsResult> {
    if (!this.isNative()) {
      return {
        models: [
          {
            modelId: 'okayuji/Gemma-4-E2B-it-coreml-speculative',
            filePath: '/simulated/documents/CoreAI/models/gemma-4-e2b.mlmodelc',
            sizeBytes: 1.3 * 1024 * 1024 * 1024,
            isCompiled: true,
            createdAt: new Date().toISOString(),
          },
        ],
        totalSizeBytes: 1.3 * 1024 * 1024 * 1024,
      }
    }
    return await Plugin.listCachedModels()
  },

  async deleteCachedModel(options: DeleteCachedModelOptions): Promise<{ success: boolean }> {
    if (!this.isNative()) {
      return { success: true }
    }
    return await Plugin.deleteCachedModel(options)
  },

  async generateStream(
    options: GenerateStreamOptions,
    onToken: (event: TokenStreamEvent) => void,
  ): Promise<{ stop: () => Promise<void> }> {
    const requestId = options.requestId || `gen-${Date.now()}`

    if (!this.isNative()) {
      return this.testTokenStream({
        requestId,
        prompt: options.prompt || options.messages?.[options.messages.length - 1]?.content || 'Hello!',
        tokenCount: options.maxTokens || 40,
        speedTokSec: 45,
      }, onToken)
    }

    try {
      const listenerHandle = await Plugin.addListener('token', (event: TokenStreamEvent) => {
        if (event.requestId === requestId) {
          onToken(event)
          if (event.isFinished) {
            listenerHandle.remove().catch(() => {})
          }
        }
      })

      await Plugin.generateStream(options)

      return {
        stop: async () => {
          try {
            await Plugin.cancelGeneration({ requestId })
            await listenerHandle.remove()
          }
          catch (e) {
            console.warn('[NativeAI] Error cancelling generation:', e)
          }
        },
      }
    }
    catch (err) {
      console.error('[NativeAI] generateStream failed:', err)
      onToken({
        requestId,
        token: '',
        isFinished: true,
        finishReason: 'error',
        error: String(err),
      })
      return { stop: async () => {} }
    }
  },

  async testTokenStream(options: TestStreamOptions, onToken: (event: TokenStreamEvent) => void): Promise<{ stop: () => Promise<void> }> {
    const requestId = options.requestId || `test-${Date.now()}`

    if (!this.isNative()) {
      // In-browser mock stream simulation
      let isCancelled = false
      const inputPrompt = options.prompt?.trim() || 'Hello AIRI!'
      const totalTokens = options.tokenCount || 30
      const delayMs = Math.max(10, Math.floor(1000 / (options.speedTokSec || 30)))
      const startTime = Date.now()

      const mockWords = [
        `[Prompt: ${inputPrompt.slice(0, 15)}...]`,
        ' Greetings',
        ' from',
        ' the',
        ' Apple',
        ' Silicon',
        ' Neural',
        ' Bridge!',
        ' This',
        ' is',
        ' a',
        ' simulated',
        ' Core',
        ' AI',
        ' token',
        ' stream',
        ' running',
        ' inside',
        ' Project',
        ' AIRI.',
        ' Real-time',
        ' events',
        ' stream',
        ' over',
        ' the',
        ' Capacitor',
        ' eventa',
        ' bus',
        ' with',
        ' sub-millisecond',
        ' latency.',
      ]

      ;(async () => {
        for (let i = 0; i < totalTokens; i++) {
          if (isCancelled) {
            onToken({ requestId, token: '', isFinished: true, finishReason: 'cancelled' })
            return
          }

          await new Promise(resolve => setTimeout(resolve, delayMs))
          const word = mockWords[i % mockWords.length]
          const elapsedMs = Date.now() - startTime
          const tokensPerSecond = Number(((i + 1) / (elapsedMs / 1000)).toFixed(1))

          onToken({
            requestId,
            token: word,
            isFinished: false,
            completionTokens: i + 1,
            elapsedMs,
            tokensPerSecond,
          })
        }

        const elapsedMs = Date.now() - startTime
        onToken({
          requestId,
          token: '',
          isFinished: true,
          finishReason: 'stop',
          completionTokens: totalTokens,
          elapsedMs,
          tokensPerSecond: Number((totalTokens / (elapsedMs / 1000)).toFixed(1)),
        })
      })()

      return {
        stop: async () => {
          isCancelled = true
        },
      }
    }

    try {
      const listenerHandle = await Plugin.addListener('token', (event: TokenStreamEvent) => {
        if (event.requestId === requestId) {
          onToken(event)
          if (event.isFinished) {
            listenerHandle.remove().catch(() => {})
          }
        }
      })

      await Plugin.testTokenStream({
        requestId,
        prompt: options.prompt,
        tokenCount: options.tokenCount || 40,
        speedTokSec: options.speedTokSec || 35,
      })

      return {
        stop: async () => {
          try {
            await Plugin.cancelTestStream({ requestId })
            await listenerHandle.remove()
          }
          catch (e) {
            console.warn('[NativeAI] Error cancelling test stream:', e)
          }
        },
      }
    }
    catch (err) {
      console.error('[NativeAI] testTokenStream failed:', err)
      onToken({
        requestId,
        token: '',
        isFinished: true,
        finishReason: 'error',
        error: String(err),
      })
      return { stop: async () => {} }
    }
  },
}
