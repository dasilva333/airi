import type { HackerAdapter, HackerApplyMeta, HackerTextureId } from '../adapters/types'
import type { UploadNotice } from '../domain/upload-validation'

import { computed, ref } from 'vue'

export interface HackerReplacement {
  url: string
  source: 'upload' | 'generated'
  fileName?: string
}

export interface HackerGenerationContext {
  textureId: HackerTextureId
  key: string
  revision: number
}

function textureKey(adapter: HackerAdapter, id: HackerTextureId): string {
  return `${adapter.identity}:${id}`
}

/**
 * Adapter-agnostic Hacker Studio controller.
 *
 * Owns only serializable state: selection, mode/prompt, replacement origin,
 * preview flags, revisions, upload feedback, and generation status. The adapter
 * owns live model objects and the actual texture application/export.
 */
export function useHackerStudio(adapter: HackerAdapter) {
  const mode = ref<'local' | 'prompt'>('local')
  const prompt = ref('')
  const selectedTextureId = ref<HackerTextureId | null>(null)
  const replacements = ref<Map<string, HackerReplacement>>(new Map())
  const previewing = ref<Set<string>>(new Set())
  const uploadNotice = ref<UploadNotice | null>(null)
  const uploadError = ref<string | null>(null)

  const isGenerating = ref(false)
  const generationProgress = ref(0)
  const generationActionLabel = ref<string | null>(null)
  const generationError = ref<string | null>(null)
  const generationTargetName = ref<string | null>(null)

  const revisions = new Map<string, number>()

  const selectedTexture = computed(() => {
    if (selectedTextureId.value === null)
      return null
    return adapter.textures.value.find(texture => texture.id === selectedTextureId.value) ?? null
  })

  const selectedKey = computed(() => selectedTextureId.value === null ? null : textureKey(adapter, selectedTextureId.value))
  const currentReplacement = computed(() => selectedKey.value ? replacements.value.get(selectedKey.value) ?? null : null)
  const currentPreviewing = computed(() => selectedKey.value ? previewing.value.has(selectedKey.value) : false)

  function keyFor(id: HackerTextureId): string {
    return textureKey(adapter, id)
  }

  function replacementFor(id: HackerTextureId): HackerReplacement | null {
    return replacements.value.get(keyFor(id)) ?? null
  }

  function previewingFor(id: HackerTextureId): boolean {
    return previewing.value.has(keyFor(id))
  }

  function selectTexture(id: HackerTextureId | null) {
    selectedTextureId.value = id
    clearUploadFeedback()
  }

  function setMode(next: 'local' | 'prompt') {
    mode.value = next
  }

  function setPrompt(next: string) {
    prompt.value = next
  }

  function clearUploadFeedback() {
    uploadNotice.value = null
    uploadError.value = null
  }

  function setUploadNotice(notice: UploadNotice | null) {
    uploadNotice.value = notice
  }

  function setUploadError(error: string | null) {
    uploadError.value = error
  }

  function setReplacement(id: HackerTextureId, url: string, meta: HackerApplyMeta) {
    const next = new Map(replacements.value)
    next.set(keyFor(id), { url, source: meta.source, fileName: meta.fileName })
    replacements.value = next
  }

  function markPreviewing(id: HackerTextureId, value: boolean) {
    const next = new Set(previewing.value)
    if (value)
      next.add(keyFor(id))
    else
      next.delete(keyFor(id))
    previewing.value = next
  }

  function bumpRevision(id: HackerTextureId): number {
    const key = keyFor(id)
    const next = (revisions.get(key) ?? 0) + 1
    revisions.set(key, next)
    return next
  }

  function revisionOf(id: HackerTextureId): number {
    return revisions.get(keyFor(id)) ?? 0
  }

  async function applyUpload(
    id: HackerTextureId,
    dataUrl: string,
    fileName: string | undefined,
    notice: UploadNotice | null = null,
  ): Promise<void> {
    clearUploadFeedback()
    const revision = bumpRevision(id)
    void revision
    await adapter.applyTexture(id, dataUrl, { source: 'upload', fileName })
    setReplacement(id, dataUrl, { source: 'upload', fileName })
    markPreviewing(id, true)
    uploadNotice.value = notice
    generationError.value = null
  }

  async function togglePreview(id: HackerTextureId): Promise<void> {
    const replacement = replacementFor(id)
    if (!replacement)
      return
    if (previewingFor(id)) {
      adapter.restoreTexture(id)
      markPreviewing(id, false)
      return
    }
    await adapter.applyTexture(id, replacement.url, {
      source: replacement.source,
      fileName: replacement.fileName,
    })
    markPreviewing(id, true)
  }

  function revertTexture(id: HackerTextureId): void {
    bumpRevision(id)
    adapter.restoreTexture(id)
    const key = keyFor(id)
    const next = new Map(replacements.value)
    next.delete(key)
    replacements.value = next
    markPreviewing(id, false)
    clearUploadFeedback()
    generationError.value = null
  }

  async function beginGeneration(id: HackerTextureId): Promise<HackerGenerationContext> {
    const context = {
      textureId: id,
      key: keyFor(id),
      revision: bumpRevision(id),
    }
    clearUploadFeedback()
    generationError.value = null
    generationProgress.value = 0
    generationActionLabel.value = null
    generationTargetName.value = adapter.textures.value.find(texture => texture.id === id)?.name || null
    isGenerating.value = true
    return context
  }

  async function getGenerationBase(id: HackerTextureId): Promise<string> {
    return adapter.getGenerationBase(id)
  }

  async function applyGenerationResult(
    context: HackerGenerationContext,
    dataUrl: string,
  ): Promise<boolean> {
    if (context.key !== keyFor(context.textureId) || revisionOf(context.textureId) !== context.revision) {
      generationError.value = 'Generation finished after the texture changed; result discarded.'
      return false
    }
    await adapter.applyTexture(context.textureId, dataUrl, { source: 'generated' })
    setReplacement(context.textureId, dataUrl, { source: 'generated' })
    markPreviewing(context.textureId, true)
    return true
  }

  function setGenerationProgress(value: number, label?: string | null) {
    generationProgress.value = value
    if (label !== undefined)
      generationActionLabel.value = label
  }

  function setGenerationError(error: string | null) {
    generationError.value = error
  }

  function finishGeneration() {
    isGenerating.value = false
    generationTargetName.value = null
  }

  async function exportAsset() {
    if (adapter.capabilities.export !== 'full-bundle')
      throw new Error('Export is unavailable for this adapter')
    return adapter.exportAsset()
  }

  function reset() {
    adapter.reset()
    replacements.value = new Map()
    previewing.value = new Set()
    selectedTextureId.value = null
    uploadNotice.value = null
    uploadError.value = null
    generationError.value = null
    generationProgress.value = 0
    generationActionLabel.value = null
    generationTargetName.value = null
    isGenerating.value = false
    revisions.clear()
  }

  function dispose() {
    adapter.dispose()
  }

  return {
    adapter,
    mode,
    prompt,
    selectedTextureId,
    selectedTexture,
    currentReplacement,
    currentPreviewing,
    replacements,
    previewing,
    uploadNotice,
    uploadError,
    isGenerating,
    generationProgress,
    generationActionLabel,
    generationError,
    generationTargetName,
    keyFor,
    replacementFor,
    previewingFor,
    selectTexture,
    setMode,
    setPrompt,
    setUploadNotice,
    setUploadError,
    applyUpload,
    togglePreview,
    revertTexture,
    beginGeneration,
    getGenerationBase,
    applyGenerationResult,
    setGenerationProgress,
    setGenerationError,
    finishGeneration,
    exportAsset,
    reset,
    dispose,
  }
}
