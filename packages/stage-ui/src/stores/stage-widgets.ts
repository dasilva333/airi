import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface StageWidgetInstance {
  id: string
  entryId?: string
  imageUrl: string
  title?: string
  prompt?: string
  x: number
  y: number
  createdAt: number
}

export const useStageWidgetsStore = defineStore('stage-widgets', () => {
  const activeWidgets = ref<StageWidgetInstance[]>([])

  function spawnWidget(params: {
    id?: string
    entryId?: string
    imageUrl: string
    title?: string
    prompt?: string
    x?: number
    y?: number
  }) {
    const id = params.id || `pip-${nanoid(8)}`

    // Default placement on screen: top-right with cascade offset
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
    const cascadeOffset = (activeWidgets.value.length % 5) * 24
    const defaultX = Math.max(24, screenWidth - 260 - cascadeOffset)
    const defaultY = 72 + cascadeOffset

    const widget: StageWidgetInstance = {
      id,
      entryId: params.entryId,
      imageUrl: params.imageUrl,
      title: params.title || 'Scene Artwork',
      prompt: params.prompt,
      x: params.x !== undefined ? params.x : defaultX,
      y: params.y !== undefined ? params.y : defaultY,
      createdAt: Date.now(),
    }

    // Replace if already exists with same ID, otherwise append
    const existingIdx = activeWidgets.value.findIndex(w => w.id === id)
    if (existingIdx !== -1) {
      activeWidgets.value[existingIdx] = widget
    }
    else {
      activeWidgets.value.push(widget)
    }

    return widget
  }

  function updateWidgetPosition(id: string, pos: { x: number, y: number }) {
    const w = activeWidgets.value.find(item => item.id === id)
    if (w) {
      w.x = pos.x
      w.y = pos.y
    }
  }

  function removeWidget(id: string) {
    activeWidgets.value = activeWidgets.value.filter(item => item.id !== id)
  }

  function clearWidgets() {
    activeWidgets.value = []
  }

  return {
    activeWidgets,
    spawnWidget,
    updateWidgetPosition,
    removeWidget,
    clearWidgets,
  }
})
