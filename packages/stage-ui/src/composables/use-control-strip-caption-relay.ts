import type { Ref } from 'vue'

import { useBroadcastChannel } from '@vueuse/core'
import { watch } from 'vue'

export interface CaptionSegment {
  text: string
  color: string
  actorId: string
  isActive?: boolean
}

export type CaptionChannelEvent
  = | { type: 'caption-speaker', text: string }
    | { type: 'caption-assistant', segments: CaptionSegment[] }

interface UseControlStripCaptionRelayOptions {
  isElectron: Ref<boolean> | { value: boolean }
}

type ElectronEventaInvoke = (payload?: unknown) => Promise<unknown>

// Hoisted module-scope handles: the strip previously did `await import()` twice
// per caption segment on the hot streaming path. Import once, reuse per event.
let sendCaptionHandle: ElectronEventaInvoke | null = null
let sendCaptionFailed = false

async function getSendCaption(): Promise<ElectronEventaInvoke | null> {
  if (sendCaptionHandle || sendCaptionFailed)
    return sendCaptionHandle
  try {
    const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
    const { electronStageMateSendCaption } = await import('@proj-airi/stage-shared')
    sendCaptionHandle = useElectronEventaInvoke(electronStageMateSendCaption) as ElectronEventaInvoke
    return sendCaptionHandle
  }
  catch (err) {
    console.warn('Failed to init Stage-Mate caption sender:', err)
    sendCaptionFailed = true
    return null
  }
}

// Single-owner relay for `airi-caption-overlay` -> Stage-Mate. Call once per app
// lifetime; the channel must have exactly one watcher (see decomposition P2/P3).
export function useControlStripCaptionRelay(options: UseControlStripCaptionRelayOptions) {
  const { isElectron } = options
  const { data: captionChannelData } = useBroadcastChannel<CaptionChannelEvent, CaptionChannelEvent>({ name: 'airi-caption-overlay' })

  watch(captionChannelData, async (event) => {
    if (!isElectron.value || !event)
      return
    try {
      const sendCaption = await getSendCaption()
      if (!sendCaption)
        return

      if (event.type === 'caption-assistant') {
        const active = event.segments?.find(s => s.isActive)
        if (active && active.text?.trim()) {
          await sendCaption({
            text: active.text,
            isActive: true,
            speaker: active.actorId || 'assistant',
          })
        }
      }
    }
    catch (err) {
      console.warn('Failed to relay caption to Stage-Mate:', err)
    }
  })

  return { captionChannelData }
}

// Devtools hook stays beside the relay so there is one place that imports the
// Stage-Mate caption contract. Idempotent: re-calling reinstalls the same hook.
export function installMateSpeechDevtoolsHook() {
  if (typeof window === 'undefined')
    return
  (window as any).__AIRI_DEVTOOLS_MATE_SPEECH__ = async (text: string) => {
    const sendCaption = await getSendCaption()
    if (!sendCaption)
      throw new Error('Stage-Mate caption sender unavailable')
    return await sendCaption({ text, isActive: true, speaker: 'AIRI' })
  }
}
