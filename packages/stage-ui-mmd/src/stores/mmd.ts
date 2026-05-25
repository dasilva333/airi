import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMmd = defineStore('mmd', () => {
  const availableMorphs = useLocalStorageManualReset<string[]>('settings/mmd/available-morphs', () => [])
  const morphMappings = useLocalStorageManualReset<Record<string, string>>('settings/mmd/morph-mappings', {})
  const hiddenMorphs = useLocalStorageManualReset<string[]>('settings/mmd/hidden-morphs', () => [])

  const currentMotion = ref<string>('swaying_arms_and_hips.vmd')
  const previewExpression = ref<string | null>(null)
  const availableMotions = ref<string[]>([
    'brushoff_nice_and_tidy.vmd',
    'crossed_arms_look_around_confident.vmd',
    'fixing_hair_or_wig.vmd',
    'getting_item_out_of_bra.vmd',
    'hat_flip.vmd',
    'impatient_foot_tapping.vmd',
    'shy.vmd',
    'skittish_mermay.vmd',
    'smelling_something_in_the_air.vmd',
    'something_in_the_sky.vmd',
    'stretching.vmd',
    'swaying_arms_and_hips.vmd',
    'tracker.vmd',
  ])

  function resetState() {
    availableMorphs.reset()
    morphMappings.reset()
    hiddenMorphs.reset()
  }

  return {
    availableMorphs,
    availableMotions,
    currentMotion,
    hiddenMorphs,
    morphMappings,
    previewExpression,
    resetState,
  }
})
