import type { DreamMoodShift, EchoChip, EchoChipType, PCLClaim } from '../types/echo-chip'

import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface PreviewModalState {
  type: 'text' | 'image'
  title: string
  content: string // text content or image URL
  prompt?: string
  id?: string
  entryType?: 'manual' | 'auto' | 'echo' | string
  // Echo chip inspectability fields
  echoType?: EchoChipType
  relevanceScore?: number
  evidenceIndices?: number[]
  citedText?: string[]
  claims?: PCLClaim[]
  moodShift?: DreamMoodShift
  timestamp?: number
  characterId?: string
}

export const useJournalPreviewStore = defineStore('journal-preview', () => {
  const previewModal = ref<PreviewModalState | null>(null)

  function openTextPreview(entry: {
    title: string
    content: string
    id?: string
    entryType?: 'manual' | 'auto' | 'echo' | string
    type?: string
    echoType?: EchoChipType
    relevanceScore?: number
    evidenceIndices?: number[]
    citedText?: string[]
    claims?: PCLClaim[]
    moodShift?: DreamMoodShift
    timestamp?: number
    characterId?: string
  }) {
    previewModal.value = {
      type: 'text',
      title: entry.title,
      content: entry.content,
      id: entry.id,
      entryType: entry.entryType || (entry.type !== 'text' && entry.type !== 'image' ? entry.type : undefined),
      echoType: entry.echoType,
      relevanceScore: entry.relevanceScore,
      evidenceIndices: entry.evidenceIndices,
      citedText: entry.citedText,
      claims: entry.claims,
      moodShift: entry.moodShift,
      timestamp: entry.timestamp,
      characterId: entry.characterId,
    }
  }

  function openEchoPreview(chip: Partial<EchoChip> & { content: string, id?: string }) {
    previewModal.value = {
      type: 'text',
      title: chip.type ? (chip.type.charAt(0).toUpperCase() + chip.type.slice(1).replace('_', ' ')) : 'Echo Memory',
      content: chip.content,
      id: chip.id,
      entryType: 'echo',
      echoType: chip.type,
      relevanceScore: chip.relevanceScore,
      evidenceIndices: chip.evidenceIndices,
      citedText: chip.citedText,
      claims: chip.claims,
      moodShift: chip.moodShift,
      timestamp: chip.createdAt,
      characterId: chip.characterId,
    }
  }

  function openImagePreview(entry: { title: string, url: string | null, prompt?: string, id?: string }) {
    if (!entry.url)
      return
    previewModal.value = {
      type: 'image',
      title: entry.title,
      content: entry.url,
      prompt: entry.prompt,
      id: entry.id,
    }
  }

  function closePreview() {
    previewModal.value = null
  }

  function downloadImage(url: string, title?: string) {
    if (!url)
      return
    const link = document.createElement('a')
    link.href = url
    // Sanitizing the filename for OS compatibility
    const safeTitle = (title || 'Image').replace(/[<>:"/\\|?*]/g, '_')
    link.download = `AIRI-Journal-${safeTitle}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return {
    previewModal,
    openTextPreview,
    openEchoPreview,
    openImagePreview,
    closePreview,
    downloadImage,
  }
})
