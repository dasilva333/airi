import type { DisplayModel } from '../display-models'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { refManualReset, useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { DisplayModelFormat, useDisplayModelsStore } from '../display-models'

export type StageModelRenderer = 'live2d' | 'vrm' | 'spine' | 'mmd' | 'disabled' | undefined
export type GunslingerStance = 'off' | 'cat' | 'blk' | 'gray'

export const useSettingsStageModel = defineStore('settings-stage-model', () => {
  const displayModelsStore = useDisplayModelsStore()
  let stageModelUpdateQueue: Promise<void> = Promise.resolve()
  const stageModelStorageKey = 'settings/stage/model'
  const gunslingerStanceStorageKey = 'settings/stage/gunslinger-stance'

  const stageModelSelectedState = useLocalStorageManualReset<string>(stageModelStorageKey, 'preset-live2d-1')
  const stageModelSelected = computed<string>({
    get: () => stageModelSelectedState.value,
    set: (value) => {
      stageModelSelectedState.value = value
    },
  })
  const stageModelSelectedDisplayModel = refManualReset<DisplayModel | undefined>(undefined)
  const stageModelSelectedUrl = refManualReset<string | undefined>(undefined)
  const stageModelSelectedFile = refManualReset<File | undefined>(undefined)
  const stageModelRenderer = refManualReset<StageModelRenderer>(undefined)

  const gunslingerStanceState = useLocalStorageManualReset<GunslingerStance>(gunslingerStanceStorageKey, 'off')
  const gunslingerStance = computed<GunslingerStance>({
    get: () => gunslingerStanceState.value,
    set: (val) => {
      gunslingerStanceState.value = val
    },
  })

  function cycleGunslingerStance(): GunslingerStance {
    const sequence: GunslingerStance[] = ['off', 'cat', 'blk', 'gray']
    const nextIdx = (sequence.indexOf(gunslingerStanceState.value) + 1) % sequence.length
    const next = sequence[nextIdx]
    gunslingerStanceState.value = next
    return next
  }

  const stageViewControlsEnabled = useLocalStorageManualReset<boolean>('settings/stage/view-controls-enabled', false)
  const stageViewControlsMode = ref<'x' | 'y' | 'z' | 'scale'>('scale')
  const lastReloadReason = ref<string | undefined>(undefined)
  const mmdTextureMap = ref<Map<string, string | ImageBitmap>>(new Map())

  function isSameFile(f1?: Blob | File, f2?: Blob | File) {
    if (f1 === f2)
      return true
    if (!f1 || !f2)
      return false
    if (f1.size !== f2.size)
      return false
    if (f1.type !== f2.type)
      return false

    const name1 = (f1 as File).name
    const name2 = (f2 as File).name
    if (name1 && name2 && name1 !== name2)
      return false

    const mod1 = (f1 as File).lastModified
    const mod2 = (f2 as File).lastModified
    if (mod1 && mod2 && mod1 !== mod2)
      return false

    return true
  }

  function revokeStageModelUrl(url?: string) {
    if (url?.startsWith('blob:')) {
      // Graceful delayed revocation: allow in-flight GLTFLoader/texture decoders to complete cleanly
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url)
        }
        catch {}
      }, 5000)
    }
  }

  function cleanupMmdTextures() {
    for (const value of mmdTextureMap.value.values()) {
      if (value instanceof ImageBitmap) {
        value.close()
      }
      else if (typeof value === 'string' && value.startsWith('blob:')) {
        URL.revokeObjectURL(value)
      }
    }
    mmdTextureMap.value.clear()
  }

  function replaceStageModelUrl(nextUrl?: string) {
    if (stageModelSelectedUrl.value === nextUrl)
      return

    revokeStageModelUrl(stageModelSelectedUrl.value)
    stageModelSelectedUrl.value = nextUrl
  }

  async function performUpdateStageModel() {
    const selectedModelId = stageModelSelectedState.value

    if (!selectedModelId) {
      replaceStageModelUrl(undefined)
      cleanupMmdTextures()
      stageModelSelectedDisplayModel.value = undefined
      stageModelSelectedFile.value = undefined
      stageModelRenderer.value = 'disabled'
      return
    }

    try {
      const model = await displayModelsStore.getDisplayModel(selectedModelId)

      const isControlStrip = typeof window !== 'undefined' && (window as any).electron && (
        window.location.hash === '#/'
        || window.location.hash === ''
      )

      if (isControlStrip) {
        if (model) {
          switch (model.format) {
            case DisplayModelFormat.Live2dZip:
              stageModelRenderer.value = 'live2d'
              break
            case DisplayModelFormat.VRM:
              stageModelRenderer.value = 'vrm'
              break
            case DisplayModelFormat.SpineZip:
              stageModelRenderer.value = 'spine'
              break
            case DisplayModelFormat.PMXZip:
            case DisplayModelFormat.PMXDirectory:
            case DisplayModelFormat.PMD:
              stageModelRenderer.value = 'mmd'
              break
            default:
              stageModelRenderer.value = 'disabled'
              break
          }
          stageModelSelectedDisplayModel.value = model
        }
        else {
          stageModelSelectedDisplayModel.value = undefined
          stageModelRenderer.value = 'disabled'
        }
        return
      }

      console.log('[StageModel:performUpdateStageModel] Fetched model from displayModelsStore:', {
        selectedModelId,
        modelFound: !!model,
        modelType: model?.type,
        modelFormat: model?.format,
        file: (model as any)?.file,
        fileType: typeof (model as any)?.file,
        fileIsFile: (model as any)?.file instanceof File,
        fileIsBlob: (model as any)?.file instanceof Blob,
        fileHasArrayBuffer: typeof (model as any)?.file?.arrayBuffer === 'function',
        fileKeys: (model as any)?.file && typeof (model as any)?.file === 'object' ? Object.keys((model as any)?.file) : [],
      })

      if (!model) {
        console.warn(`[StageModel] Model with ID "${selectedModelId}" not found — absent from IndexedDB or unreadable.`)
        toast.error(`Model not found (${selectedModelId}). Preserving current stage model.`)
        return
      }

      if (model.type === 'file') {
        if (!model.file || typeof model.file.arrayBuffer !== 'function') {
          console.warn(`[StageModel] Model file is missing or is not a valid Blob/File instance for model ${model.id}:`, model.file)
          toast.error(`Failed to load model "${model.name || model.id}": file is missing or corrupt.`)
          return
        }

        // If we already have a URL for this exact model and file, don't re-create it.
        // Re-creating the URL triggers replaceStageModelUrl which revokes the active one.
        const isSameModel = stageModelSelectedDisplayModel.value?.id === model.id
        const isSameFileData = isSameFile(stageModelSelectedFile.value, model.file)
        if ((isSameModel || isSameFileData) && stageModelSelectedUrl.value?.startsWith('blob:')) {
          stageModelSelectedDisplayModel.value = model
          stageModelSelectedFile.value = model.file
          // Update renderer just in case
          switch (model.format) {
            case DisplayModelFormat.Live2dZip: stageModelRenderer.value = 'live2d'; break
            case DisplayModelFormat.VRM: stageModelRenderer.value = 'vrm'; break
            case DisplayModelFormat.SpineZip: stageModelRenderer.value = 'spine'; break
            case DisplayModelFormat.PMXZip:
            case DisplayModelFormat.PMXDirectory:
            case DisplayModelFormat.PMD:
              stageModelRenderer.value = 'mmd'; break
            default: stageModelRenderer.value = 'disabled'; break
          }
          return
        }

        if (model.format === DisplayModelFormat.PMXZip || model.format === DisplayModelFormat.PMD) {
          try {
            const textureFiles = await displayModelsStore.getDisplayModelTextures(model.id)

            cleanupMmdTextures()

            const map = new Map<string, string | ImageBitmap>()
            await Promise.all(textureFiles.map(async (tex) => {
              const pathKey = tex.relativePath.toLowerCase()
              if (pathKey.endsWith('.tga')) {
                map.set(pathKey, URL.createObjectURL(tex.file))
                return
              }
              try {
                const bitmap = await createImageBitmap(tex.file)
                map.set(pathKey, bitmap)
              }
              catch (e) {
                console.warn(`[StageModel] Failed to pre-decode ${tex.relativePath}, falling back to Blob URL:`, e)
                map.set(pathKey, URL.createObjectURL(tex.file))
              }
            }))
            mmdTextureMap.value = map

            const nextUrl = `${URL.createObjectURL(model.file)}#${model.file.name}`
            replaceStageModelUrl(nextUrl)
            stageModelSelectedFile.value = model.file
          }
          catch (e) {
            console.error('[StageModel] Failed to load MMD textures:', e)
            const nextUrl = URL.createObjectURL(model.file)
            replaceStageModelUrl(nextUrl)
            stageModelSelectedFile.value = model.file
          }
        }
        else {
          const nextUrl = URL.createObjectURL(model.file)
          replaceStageModelUrl(nextUrl)
          stageModelSelectedFile.value = model.file
        }
      }
      else if (model.type === 'url') {
        // For URL types, we only update if it actually changed
        if (stageModelSelectedUrl.value !== model.url) {
          replaceStageModelUrl(model.url)
        }
        stageModelSelectedFile.value = undefined
      }

      switch (model.format) {
        case DisplayModelFormat.Live2dZip:
          stageModelRenderer.value = 'live2d'
          break
        case DisplayModelFormat.VRM:
          stageModelRenderer.value = 'vrm'
          break
        case DisplayModelFormat.SpineZip:
          stageModelRenderer.value = 'spine'
          break
        case DisplayModelFormat.PMXZip:
        case DisplayModelFormat.PMXDirectory:
        case DisplayModelFormat.PMD:
          stageModelRenderer.value = 'mmd'
          break
        default:
          stageModelRenderer.value = 'disabled'
          break
      }

      stageModelSelectedDisplayModel.value = model

      // Sync VRM model to Stage-Mate disk cache via Option A (Query-First Cache Gate)
      if (model.format === DisplayModelFormat.VRM && model.type === 'file' && model.file) {
        syncVrmToStageMate(model).catch((err) => {
          console.warn('[StageModel] Stage-Mate cache sync warning:', err)
        })
      }
    }
    catch (error) {
      console.error('[StageModel] Failed to update stage model:', error)
      toast.error(`Failed to load stage model. Preserving current model.`)
    }
  }

  async function updateStageModel(reason?: string): Promise<void> {
    if (reason)
      lastReloadReason.value = reason

    const task = stageModelUpdateQueue.then(async () => {
      await performUpdateStageModel()
    }).catch((err) => {
      console.error('[StageModel] Queue error:', err)
    })

    stageModelUpdateQueue = task
    return task
  }

  async function initializeStageModel(reason?: string) {
    await updateStageModel(reason || 'initialization')
  }

  let inFlightSyncModelId = ''
  async function syncVrmToStageMate(model: any): Promise<void> {
    if (typeof window === 'undefined' || !(window as any).electron || !model?.file)
      return

    if (inFlightSyncModelId === model.id)
      return

    inFlightSyncModelId = model.id

    try {
      const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
      const { electronStageMateEnsureModel, electronStageMateSaveModel } = await import('@proj-airi/stage-shared')
      const { usePositioningStore } = await import('./positioning')
      const positioningStore = usePositioningStore()
      const pos = positioningStore.getPosition(model.id)
      const rawPos = pos
        ? { x: Number(pos.x ?? 0), y: Number(pos.y ?? 0), scale: Number(pos.scale ?? 1) }
        : { x: 0, y: 0, scale: 1 }

      const ensureModel = useElectronEventaInvoke(electronStageMateEnsureModel)
      const saveModel = useElectronEventaInvoke(electronStageMateSaveModel)

      const checkRes = await ensureModel({
        modelId: String(model.id),
        modelName: String(model.name || 'model.vrm'),
        position: rawPos,
      })

      if (checkRes?.status === 'need_binary') {
        console.log(`[StageModel] Stage-Mate cache MISS for ${model.id}. Transferring binary to Main process...`)
        const arrayBuffer = await model.file.arrayBuffer()
        await saveModel({
          modelId: String(model.id),
          modelName: String(model.name || 'model.vrm'),
          data: new Uint8Array(arrayBuffer),
          position: rawPos,
        })
        console.log(`[StageModel] Stage-Mate cache saved for ${model.id}.`)
      }
      else {
        console.log(`[StageModel] Stage-Mate cache HIT for ${model.id}. Zero binary transferred across IPC.`)
      }
    }
    catch (err) {
      console.warn('[StageModel] Failed to sync model with Stage-Mate:', err)
    }
    finally {
      if (inFlightSyncModelId === model.id) {
        setTimeout(() => {
          if (inFlightSyncModelId === model.id)
            inFlightSyncModelId = ''
        }, 500)
      }
    }
  }

  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    ;(window as any).electron.ipcRenderer.on('stage-mate:model-position-changed', async (_event: any, data: any) => {
      if (data?.modelId) {
        try {
          const { usePositioningStore } = await import('./positioning')
          const positioningStore = usePositioningStore()
          positioningStore.setPosition(data.modelId, {
            x: data.x,
            y: data.y,
            scale: data.scale ?? 1,
          })
        }
        catch {}
      }
    })
  }

  useEventListener('unload', () => {
    revokeStageModelUrl(stageModelSelectedUrl.value)
    cleanupMmdTextures()
  })

  watch(stageModelSelectedState, (_newValue, _oldValue) => {
    void updateStageModel('manual selection')
  })

  async function resetState() {
    revokeStageModelUrl(stageModelSelectedUrl.value)

    stageModelSelectedState.reset()
    stageModelSelectedDisplayModel.reset()
    stageModelSelectedUrl.reset()
    stageModelSelectedFile.reset()
    stageModelRenderer.reset()
    stageViewControlsEnabled.reset()
    stageViewControlsMode.value = 'scale'
    cleanupMmdTextures()

    await updateStageModel('reset state')
  }

  return {
    stageModelRenderer,
    stageModelSelected,
    stageModelSelectedUrl,
    stageModelSelectedFile,
    stageModelSelectedDisplayModel,
    stageViewControlsEnabled,
    stageViewControlsMode,
    gunslingerStance,
    cycleGunslingerStance,
    lastReloadReason,
    mmdTextureMap,

    initializeStageModel,
    updateStageModel,
    resetState,
  }
})
