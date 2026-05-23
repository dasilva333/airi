import type { DisplayModel } from '../display-models'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { refManualReset, useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { DisplayModelFormat, useDisplayModelsStore } from '../display-models'

export type StageModelRenderer = 'live2d' | 'vrm' | 'spine' | 'mmd' | 'disabled' | undefined

export const useSettingsStageModel = defineStore('settings-stage-model', () => {
  const displayModelsStore = useDisplayModelsStore()
  let stageModelUpdateSequence = 0
  const stageModelStorageKey = 'settings/stage/model'

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

  const stageViewControlsEnabled = useLocalStorageManualReset<boolean>('settings/stage/view-controls-enabled', false)
  const stageViewControlsMode = ref<'x' | 'y' | 'z' | 'scale'>('scale')
  const lastReloadReason = ref<string | undefined>(undefined)
  const mmdTextureMap = ref<Map<string, string>>(new Map())

  function isSameFile(f1?: File, f2?: File) {
    if (f1 === f2)
      return true
    if (!f1 || !f2)
      return false
    return f1.name === f2.name && f1.size === f2.size && f1.lastModified === f2.lastModified
  }

  function revokeStageModelUrl(url?: string) {
    if (url?.startsWith('blob:'))
      URL.revokeObjectURL(url)
  }

  function replaceStageModelUrl(nextUrl?: string) {
    if (stageModelSelectedUrl.value === nextUrl)
      return

    revokeStageModelUrl(stageModelSelectedUrl.value)
    stageModelSelectedUrl.value = nextUrl
  }

  async function updateStageModel(reason?: string) {
    if (reason)
      lastReloadReason.value = reason
    const requestId = ++stageModelUpdateSequence
    const selectedModelId = stageModelSelectedState.value

    if (!selectedModelId) {
      replaceStageModelUrl(undefined)
      stageModelSelectedDisplayModel.value = undefined
      stageModelSelectedFile.value = undefined
      stageModelRenderer.value = 'disabled'
      return
    }

    const model = await displayModelsStore.getDisplayModel(selectedModelId)

    if (requestId !== stageModelUpdateSequence)
      return

    if (!model) {
      replaceStageModelUrl(undefined)
      stageModelSelectedDisplayModel.value = undefined
      stageModelSelectedFile.value = undefined
      stageModelRenderer.value = 'disabled'
      return
    }

    if (model.type === 'file') {
      // If we already have a URL for this exact file, don't re-create it.
      // Re-creating the URL triggers replaceStageModelUrl which revokes the active one.
      // NOTICE: IndexedDB returns clones of File objects, so we must compare properties.
      if (isSameFile(stageModelSelectedFile.value, model.file) && stageModelSelectedUrl.value?.startsWith('blob:')) {
        stageModelSelectedDisplayModel.value = model
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
        const toastId = toast.loading('Loading MMD model textures...')
        try {
          const textureFiles = await displayModelsStore.getDisplayModelTextures(model.id)
          if (requestId !== stageModelUpdateSequence)
            return

          const map = new Map<string, string>()
          for (const tex of textureFiles) {
            map.set(tex.relativePath.toLowerCase(), URL.createObjectURL(tex.file))
          }
          mmdTextureMap.value = map

          const nextUrl = `${URL.createObjectURL(model.file)}#${model.file.name}`
          replaceStageModelUrl(nextUrl)
          stageModelSelectedFile.value = model.file
          toast.success('MMD model ready!', { id: toastId })
        }
        catch (e) {
          console.error('[StageModel] Failed to load MMD textures:', e)
          toast.error('Failed to load MMD model textures!', { id: toastId })
          const nextUrl = URL.createObjectURL(model.file)
          replaceStageModelUrl(nextUrl)
          stageModelSelectedFile.value = model.file
        }
      }
      else {
        const nextUrl = URL.createObjectURL(model.file)
        if (requestId !== stageModelUpdateSequence) {
          URL.revokeObjectURL(nextUrl)
          return
        }

        replaceStageModelUrl(nextUrl)
        stageModelSelectedFile.value = model.file
      }
    }
    else {
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
  }

  async function initializeStageModel(reason?: string) {
    await updateStageModel(reason || 'initialization')
  }

  useEventListener('unload', () => {
    revokeStageModelUrl(stageModelSelectedUrl.value)
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
    mmdTextureMap.value = new Map()

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
    lastReloadReason,
    mmdTextureMap,

    initializeStageModel,
    updateStageModel,
    resetState,
  }
})
