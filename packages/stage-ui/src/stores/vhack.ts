import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'

export const useVHackStore = defineStore('vhack', () => {
  const isHackerModeActive = ref(false)
  const selectedNodeName = ref<string | null>(null)
  const selectedMaterialName = ref<string | null>(null)
  const hiddenNodeUuids = ref<Set<string>>(new Set())

  // AI Settings (Persistent)
  const geminiApiKey = ref(localStorage.getItem('vhack_gemini_api_key') || '')
  const geminiModel = ref(localStorage.getItem('vhack_gemini_model') || 'gemini-3.1-flash-image-preview')
  const geminiResolution = ref(localStorage.getItem('vhack_gemini_res') || '1K')
  const showAiSettings = ref(false)

  // Surgical persistence state
  const sourceArrayBuffer = ref<ArrayBuffer | null>(null)
  const mutatedTextures = ref<Map<number, { data: string, mimeType: string }>>(new Map())

  // Unified AI Generation State
  const isGeneratingTexture = ref(false)
  const generationProgress = ref(0)
  const generationActionLabel = ref<string | null>(null)
  const lastGenerationError = ref<string | null>(null)
  const selectedTextureIndex = ref<number | null>(null)

  // Snapshots
  const snapshotMap = ref<Map<string, any>>(new Map())

  // Texture replacement workspace (panel-local in spirit, store-scoped so the
  // docked panel can unmount when Avatar Appearance collapses without losing
  // preview/revert state). Images are kept in a plain Map, never reactive.
  interface TextureReplacement { url: string }
  const replacementByIndex = shallowRef<Map<number | string, TextureReplacement>>(new Map())
  const previewingKeys = shallowRef<Set<number | string>>(new Set())
  const originalTextureImages = new Map<string, any>()

  function setTextureReplacement(key: number | string, url: string) {
    const next = new Map(replacementByIndex.value)
    next.set(key, { url })
    replacementByIndex.value = next
  }

  function removeTextureReplacement(key: number | string) {
    const next = new Map(replacementByIndex.value)
    next.delete(key)
    replacementByIndex.value = next
  }

  function markTexturePreviewing(key: number | string, value: boolean) {
    const next = new Set(previewingKeys.value)
    if (value)
      next.add(key)
    else
      next.delete(key)
    previewingKeys.value = next
  }

  function setOriginalTextureImage(uuid: string, image: any) {
    if (!originalTextureImages.has(uuid))
      originalTextureImages.set(uuid, image)
  }

  function getOriginalTextureImage(uuid: string) {
    return originalTextureImages.get(uuid)
  }

  function clearTextureReplacements() {
    replacementByIndex.value = new Map()
    previewingKeys.value = new Set()
    originalTextureImages.clear()
  }

  // Persist AI Settings
  watch(geminiApiKey, v => localStorage.setItem('vhack_gemini_api_key', v))
  watch(geminiModel, v => localStorage.setItem('vhack_gemini_model', v))
  watch(geminiResolution, v => localStorage.setItem('vhack_gemini_res', v))

  function toggleHackerMode() {
    isHackerModeActive.value = !isHackerModeActive.value
  }

  function closeHackerMode() {
    isHackerModeActive.value = false
  }

  function toggleNodeVisibility(uuid: string, node: any) {
    if (hiddenNodeUuids.value.has(uuid)) {
      hiddenNodeUuids.value.delete(uuid)
      node.visible = true
    }
    else {
      hiddenNodeUuids.value.add(uuid)
      node.visible = false
    }
    hiddenNodeUuids.value = new Set(hiddenNodeUuids.value)
  }

  function showAll(nodes: any[]) {
    nodes.forEach((item) => {
      item.node.visible = true
      hiddenNodeUuids.value.delete(item.uuid)
    })
    hiddenNodeUuids.value = new Set(hiddenNodeUuids.value)
  }

  function hideAll(nodes: any[]) {
    nodes.forEach((item) => {
      item.node.visible = false
      hiddenNodeUuids.value.add(item.uuid)
    })
    hiddenNodeUuids.value = new Set(hiddenNodeUuids.value)
  }

  function focusNode(targetUuid: string, nodes: any[]) {
    nodes.forEach((item) => {
      if (item.uuid === targetUuid) {
        item.node.visible = true
        hiddenNodeUuids.value.delete(item.uuid)
      }
      else {
        item.node.visible = false
        hiddenNodeUuids.value.add(item.uuid)
      }
    })
    hiddenNodeUuids.value = new Set(hiddenNodeUuids.value)
  }

  function setSourceArrayBuffer(buffer: ArrayBuffer, options: { resetMutations?: boolean } = {}) {
    sourceArrayBuffer.value = buffer
    // Reset mutations when a new model is loaded. Export loads the source buffer
    // lazily too, so it must opt out or it would clear the edits it is exporting.
    if (options.resetMutations !== false) {
      mutatedTextures.value.clear()
      clearTextureReplacements()
    }
  }

  function registerMutation(index: number, data: string, mimeType: string) {
    mutatedTextures.value.set(index, { data, mimeType })
  }

  function resetState() {
    selectedNodeName.value = null
    selectedMaterialName.value = null
    hiddenNodeUuids.value.clear()
    snapshotMap.value.clear()
  }

  return {
    isHackerModeActive,
    selectedNodeName,
    selectedMaterialName,
    geminiApiKey,
    geminiModel,
    geminiResolution,
    showAiSettings,
    isGeneratingTexture,
    generationProgress,
    generationActionLabel,
    lastGenerationError,
    selectedTextureIndex,

    hiddenNodeUuids,
    snapshotMap,

    replacementByIndex,
    previewingKeys,
    setTextureReplacement,
    removeTextureReplacement,
    markTexturePreviewing,
    setOriginalTextureImage,
    getOriginalTextureImage,
    clearTextureReplacements,

    sourceArrayBuffer,
    mutatedTextures,
    setSourceArrayBuffer,
    registerMutation,

    toggleHackerMode,
    closeHackerMode,
    toggleNodeVisibility,
    showAll,
    hideAll,
    focusNode,
    resetState,
  }
})
