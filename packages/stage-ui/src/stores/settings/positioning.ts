import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

export interface PositionScale {
  x: number
  y: number
  scale: number
}

export const usePositioningStore = defineStore('positioning', () => {
  const positions = useLocalStorageManualReset<Record<string, PositionScale>>('settings/positioning/models', {})

  function getPosition(key: string): PositionScale {
    return positions.value[key] || { scale: 1, x: 0, y: 0 }
  }

  function setPosition(key: string, data: PositionScale) {
    positions.value = { ...positions.value, [key]: data }
  }

  function resetState() {
    positions.reset()
  }

  return {
    getPosition,
    positions,
    resetState,
    setPosition,
  }
})
