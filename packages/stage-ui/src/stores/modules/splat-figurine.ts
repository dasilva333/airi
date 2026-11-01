import localforage from 'localforage'

import { useStorage } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { onMounted, ref, toRaw } from 'vue'

import { storage } from '../../database/storage'

export interface SplatFigurineMetadata {
  id: string
  name: string
  numGaussians: number
  createdAt: number
  sizeBytes: number
  previewUrl?: string
}

export interface IdolHealthData {
  status: string
  service: string
  cuda_available: boolean
  device: string
  vram_allocated_mb: number
  model_loaded: boolean
}

export const useSplatFigurineStore = defineStore('splat-figurine', () => {
  // Service configuration
  const serviceEndpoint = useStorage('airi:idol-3dgs:endpoint', 'http://10.0.0.91:8189')
  const defaultQualityTier = useStorage<number>('airi:idol-3dgs:quality-tier', 65536)
  const defaultGenerationMode = useStorage<'synthetic' | 'real'>('airi:idol-3dgs:mode', 'synthetic')
  const useIsNetPreClean = useStorage<boolean>('airi:idol-3dgs:use-isnet', true)
  const isNetSensitivity = useStorage<number>('airi:idol-3dgs:isnet-sensitivity', 65)

  // Live status
  const serviceStatus = ref<'idle' | 'checking' | 'online' | 'offline'>('idle')
  const gpuDeviceName = ref<string>('')
  const vramAllocatedMb = ref<number>(0)
  const isModelLoaded = ref<boolean>(false)
  const lastHealthCheck = ref<number>(0)

  // Persistent library
  const savedFigurines = ref<SplatFigurineMetadata[]>([])
  const isLibraryLoaded = ref<boolean>(false)

  async function checkServiceHealth(): Promise<boolean> {
    serviceStatus.value = 'checking'
    try {
      const cleanEndpoint = serviceEndpoint.value.replace(/\/+$/, '')
      const res = await fetch(`${cleanEndpoint}/health`, {
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok)
        throw new Error(`HTTP ${res.status}`)

      const data: IdolHealthData = await res.json()
      if (data.status === 'ok') {
        serviceStatus.value = 'online'
        gpuDeviceName.value = data.device || 'CUDA GPU'
        vramAllocatedMb.value = data.vram_allocated_mb || 0
        isModelLoaded.value = data.model_loaded
        lastHealthCheck.value = Date.now()
        return true
      }
      serviceStatus.value = 'offline'
      return false
    }
    catch (err) {
      console.warn('[SplatFigurineStore] Health check failed:', err)
      serviceStatus.value = 'offline'
      return false
    }
  }

  async function loadLibrary() {
    try {
      const data = await storage.getItemRaw<SplatFigurineMetadata[]>('local:splat-figurines')
      if (Array.isArray(data)) {
        savedFigurines.value = data
      }
      isLibraryLoaded.value = true
    }
    catch (err) {
      console.error('[SplatFigurineStore] Failed to load library index:', err)
    }
  }

  async function saveFigurine(params: {
    name: string
    plyBlob: Blob
    numGaussians: number
    previewUrl?: string
  }): Promise<SplatFigurineMetadata> {
    const id = nanoid(10)
    const metadata: SplatFigurineMetadata = {
      id,
      name: params.name || `Figurine ${new Date().toLocaleDateString()}`,
      numGaussians: params.numGaussians,
      createdAt: Date.now(),
      sizeBytes: params.plyBlob.size,
      previewUrl: params.previewUrl,
    }

    // 1. Save binary arrayBuffer into localforage adhering to airi-binary-safety
    const buffer = await params.plyBlob.arrayBuffer()
    await localforage.setItem(`splat-asset-${id}`, buffer)

    // 2. Add to library index in unstorage
    savedFigurines.value.unshift(metadata)
    await storage.setItemRaw('local:splat-figurines', toRaw(savedFigurines.value))

    return metadata
  }

  async function loadFigurineBlob(id: string): Promise<Blob | null> {
    try {
      const stored = await localforage.getItem<ArrayBuffer | Blob>(`splat-asset-${id}`)
      if (!stored)
        return null

      if (stored instanceof Blob)
        return stored

      return new Blob([stored], { type: 'application/octet-stream' })
    }
    catch (err) {
      console.error(`[SplatFigurineStore] Failed to load blob for ${id}:`, err)
      return null
    }
  }

  async function deleteFigurine(id: string) {
    try {
      await localforage.removeItem(`splat-asset-${id}`)
      savedFigurines.value = savedFigurines.value.filter(f => f.id !== id)
      await storage.setItemRaw('local:splat-figurines', toRaw(savedFigurines.value))
    }
    catch (err) {
      console.error(`[SplatFigurineStore] Failed to delete figurine ${id}:`, err)
    }
  }

  onMounted(() => {
    loadLibrary()
    checkServiceHealth()
  })

  return {
    serviceEndpoint,
    defaultQualityTier,
    defaultGenerationMode,
    useIsNetPreClean,
    isNetSensitivity,
    serviceStatus,
    gpuDeviceName,
    vramAllocatedMb,
    isModelLoaded,
    lastHealthCheck,
    savedFigurines,
    isLibraryLoaded,
    checkServiceHealth,
    loadLibrary,
    saveFigurine,
    loadFigurineBlob,
    deleteFigurine,
  }
})
