import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useLHackStore = defineStore('lhack', () => {
  const isHackerModeActive = ref(false)
  const selectedDrawableId = ref<string | null>(null)
  const hiddenDrawableIds = ref<Set<string>>(new Set())

  // AI Settings (Persistent)
  const geminiApiKey = ref(localStorage.getItem('lhack_gemini_api_key') || '')
  const geminiModel = ref(localStorage.getItem('lhack_gemini_model') || 'gemini-3.1-flash-image-preview')
  const geminiResolution = ref(localStorage.getItem('lhack_gemini_res') || '1K')
  const showAiSettings = ref(false)

  // Surgical persistence state
  const originalZipBuffer = ref<ArrayBuffer | null>(null)
  const mutatedTextures = ref<Map<number, { data: string; mimeType: string }>>(new Map())

  // Unified AI Generation State
  const isGeneratingTexture = ref(false)
  const generationProgress = ref(0)
  const generationActionLabel = ref<string | null>(null)
  const lastGenerationError = ref<string | null>(null)
  const selectedTextureIndex = ref<number | null>(null)

  // Persist AI Settings
  watch(geminiApiKey, (v) => localStorage.setItem('lhack_gemini_api_key', v))
  watch(geminiModel, (v) => localStorage.setItem('lhack_gemini_model', v))
  watch(geminiResolution, (v) => localStorage.setItem('lhack_gemini_res', v))

  function toggleHackerMode() {
    isHackerModeActive.value = !isHackerModeActive.value
  }

  function closeHackerMode() {
    isHackerModeActive.value = false
  }

  function toggleDrawableVisibility(id: string, model: any) {
    if (hiddenDrawableIds.value.has(id)) {
      hiddenDrawableIds.value.delete(id)
      setDrawableOpacity(id, model, 1)
    } else {
      hiddenDrawableIds.value.add(id)
      setDrawableOpacity(id, model, 0)
    }
    hiddenDrawableIds.value = new Set(hiddenDrawableIds.value)
  }

  function setDrawableOpacity(id: string, model: any, opacity: number) {
    // Find the drawable by ID in the internal model
    const drawables = model.internalModel.drawables
    const drawableIndex = model.internalModel.drawableIds.indexOf(id)
    if (drawableIndex !== -1) {
      // In Cubism, we can set opacity directly or via coreModel
      if (model.internalModel.coreModel.setDrawableOpacity) {
        model.internalModel.coreModel.setDrawableOpacity(drawableIndex, opacity)
      } else {
        // Fallback for different SDK versions
        drawables[drawableIndex].opacity = opacity
      }
    }
  }

  function showAll(drawables: any[], model: any) {
    drawables.forEach((d) => {
      setDrawableOpacity(d.id, model, 1)
      hiddenDrawableIds.value.delete(d.id)
    })
    hiddenDrawableIds.value = new Set(hiddenDrawableIds.value)
  }

  function hideAll(drawables: any[], model: any) {
    drawables.forEach((d) => {
      setDrawableOpacity(d.id, model, 0)
      hiddenDrawableIds.value.add(d.id)
    })
    hiddenDrawableIds.value = new Set(hiddenDrawableIds.value)
  }

  function registerMutation(index: number, data: string, mimeType: string) {
    mutatedTextures.value.set(index, { data, mimeType })
  }

  async function applyTextureMutation(index: number, url: string) {
    let base64 = ''
    if (url.startsWith('data:')) {
      base64 = url.split(',')[1]
    } else {
      // Resolve blob URLs or remote URLs to base64
      try {
        console.info(`[LHACK] Resolving texture URL to base64 for Atlas ${index}...`)
        const response = await fetch(url)
        const blob = await response.blob()
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch (e) {
        console.error('[LHACK] Failed to resolve texture URL to base64:', e)
        return
      }
    }

    // 1. Register for persistence (Export parity)
    registerMutation(index, base64, 'image/png')
    console.info(`[LHACK] Mutation registered for Atlas ${index} (Data Length: ${base64.length})`)
  }

  function resetState() {
    selectedDrawableId.value = null
    hiddenDrawableIds.value.clear()
    mutatedTextures.value.clear()
  }

  return {
    applyTextureMutation,
    closeHackerMode,
    geminiApiKey,
    geminiModel,
    geminiResolution,
    generationActionLabel,
    generationProgress,

    hiddenDrawableIds,
    hideAll,
    isGeneratingTexture,
    isHackerModeActive,
    lastGenerationError,
    mutatedTextures,

    originalZipBuffer,
    registerMutation,
    resetState,
    selectedDrawableId,
    selectedTextureIndex,
    showAiSettings,
    showAll,
    toggleDrawableVisibility,

    toggleHackerMode,
  }
})
