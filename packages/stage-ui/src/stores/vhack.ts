import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

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
  const mutatedTextures = ref<Map<number, { data: string; mimeType: string }>>(new Map())

  // Unified AI Generation State
  const isGeneratingTexture = ref(false)
  const generationProgress = ref(0)
  const generationActionLabel = ref<string | null>(null)
  const lastGenerationError = ref<string | null>(null)
  const selectedTextureIndex = ref<number | null>(null)

  // Snapshots
  const snapshotMap = ref<Map<string, any>>(new Map())

  // Persist AI Settings
  watch(geminiApiKey, (v) => localStorage.setItem('vhack_gemini_api_key', v))
  watch(geminiModel, (v) => localStorage.setItem('vhack_gemini_model', v))
  watch(geminiResolution, (v) => localStorage.setItem('vhack_gemini_res', v))

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
    } else {
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
      } else {
        item.node.visible = false
        hiddenNodeUuids.value.add(item.uuid)
      }
    })
    hiddenNodeUuids.value = new Set(hiddenNodeUuids.value)
  }

  function setSourceArrayBuffer(buffer: ArrayBuffer) {
    sourceArrayBuffer.value = buffer
    // Reset mutations when a new model is loaded
    mutatedTextures.value.clear()
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
    closeHackerMode,
    focusNode,
    geminiApiKey,
    geminiModel,
    geminiResolution,
    generationActionLabel,
    generationProgress,

    hiddenNodeUuids,
    hideAll,
    isGeneratingTexture,
    isHackerModeActive,
    lastGenerationError,
    mutatedTextures,
    registerMutation,
    resetState,
    selectedMaterialName,
    selectedNodeName,
    selectedTextureIndex,
    setSourceArrayBuffer,
    showAiSettings,
    showAll,
    snapshotMap,

    sourceArrayBuffer,

    toggleHackerMode,
    toggleNodeVisibility,
  }
})
