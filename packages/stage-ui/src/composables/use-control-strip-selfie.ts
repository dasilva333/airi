import type { Ref } from 'vue'

import { useBroadcastChannel } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

interface UseControlStripSelfieOptions {
  activeCardId: Ref<string | undefined>
  activePopover: Ref<string | null>
  selfieIncludeBg: Ref<boolean>
  getCharacterSelfies: (characterId: string) => Array<{ type: string }>
  updateCardBackground: (characterId: string, bgId: string) => void
}

interface StageCapturePayload {
  characterId: string
  includeBg: boolean
  channelId?: string
}

interface ViewfinderPayload {
  active: boolean
  countdown: number | null
}

// Verbatim extraction of the selfies popover state from ControlStrip.vue.
// Owns both BroadcastChannels (`airi:stage-capture` + `airi:stage-selfie-viewfinder`)
// so the shell can drop them when it adopts this composable. Single owner rule:
// exactly one watcher posts viewfinder state per mount.
export function useControlStripSelfie(options: UseControlStripSelfieOptions) {
  const { activeCardId, activePopover, selfieIncludeBg, getCharacterSelfies, updateCardBackground } = options

  const selfies = computed(() => {
    if (!activeCardId.value)
      return []
    return getCharacterSelfies(activeCardId.value).filter(e => e.type === 'selfie')
  })

  const selfieCountdown = ref<number | null>(null)
  const { post: postCapture } = useBroadcastChannel<StageCapturePayload, StageCapturePayload>({ name: 'airi:stage-capture' })
  const { post: postViewfinderState } = useBroadcastChannel<ViewfinderPayload, ViewfinderPayload>({ name: 'airi:stage-selfie-viewfinder' })

  function triggerSelfie() {
    if (!activeCardId.value) {
      console.warn('[ControlStrip] Cannot trigger selfie: no activeCardId')
      return
    }
    if (selfieCountdown.value !== null)
      return

    console.log('[ControlStrip] Starting selfie countdown for character:', activeCardId.value)
    selfieCountdown.value = 3
    const interval = setInterval(() => {
      if (selfieCountdown.value === null) {
        clearInterval(interval)
        return
      }
      selfieCountdown.value--
      console.log('[ControlStrip] Selfie countdown:', selfieCountdown.value)
      if (selfieCountdown.value === 0) {
        clearInterval(interval)
        selfieCountdown.value = null
        // Wait for the UI/viewfinder overlay to fully hide before triggering capture
        setTimeout(() => {
          console.log('[ControlStrip] Broadcast stage capture request for character:', activeCardId.value, 'includeBg:', selfieIncludeBg.value)
          postCapture({ characterId: activeCardId.value as string, includeBg: selfieIncludeBg.value })
        }, 500)
      }
    }, 1000)
  }

  function selectSelfieBackground(bgId: string) {
    if (activeCardId.value) {
      updateCardBackground(activeCardId.value, bgId)
    }
  }

  watch([activePopover, selfieCountdown], ([popover, countdown]) => {
    postViewfinderState({
      active: popover === 'actor-selfies',
      countdown: countdown as number | null,
    })
  }, { immediate: true })

  return {
    selfies,
    selfieCountdown,
    triggerSelfie,
    selectSelfieBackground,
  }
}
