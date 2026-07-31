import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useCustomVrmAnimationsStore } from '@proj-airi/stage-ui-three'

import { useDisplayModelsStore } from '../stores/display-models'

export function useIdleAnimations() {
  const displayModelsStore = useDisplayModelsStore()
  const customVrmAnimationsStore = useCustomVrmAnimationsStore()
  const mmdStore = useMmd()

  // Dynamic, format-aware animation options resolver
  function getAvailableModelMotions(modelId: string | undefined): string[] {
    if (!modelId || modelId === 'inherit')
      return []
    const model = displayModelsStore.displayModels.find(m => m.id === modelId)
    if (!model)
      return []

    const format = model.format.toLowerCase()

    if (format.includes('live2d') || format.includes('spine')) {
      const motions = model.motions || []
      return motions.map(m => m.split('/').pop() || m).sort((a, b) => (a || '').localeCompare(b || ''))
    }

    if (format.includes('vrm')) {
      const options = customVrmAnimationsStore.animationOptions || []
      return options.map(opt => opt.value).sort((a, b) => (a || '').localeCompare(b || ''))
    }

    if (format.includes('pmx') || format.includes('pmd') || format.includes('mmd')) {
      const builtIn = mmdStore.availableMotions || []
      const custom = (mmdStore.customMotions || []).map((m: any) => m.name || m.id)
      return [...builtIn, ...custom].sort((a, b) => (a || '').localeCompare(b || ''))
    }

    return model.motions || []
  }

  // Active actor idleAnimations override resolver
  function resolveActiveIdleAnimations(card: any, activeModelId: string | undefined): string[] {
    if (!card)
      return []

    if (activeModelId && card.extensions?.airi?.visual_assets) {
      const matchedAsset = Object.values(card.extensions.airi.visual_assets).find(
        (asset: any) => asset?.manifestation?.modelId === activeModelId,
      )
      if (matchedAsset && (matchedAsset as any).idleAnimations) {
        return (matchedAsset as any).idleAnimations
      }
    }

    return card.extensions?.airi?.acting?.idleAnimations || []
  }

  return {
    getAvailableModelMotions,
    resolveActiveIdleAnimations,
  }
}
